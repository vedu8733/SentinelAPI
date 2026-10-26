import {
  Incident,
  SecurityEvent,
  ResponseAction,
  IncidentStatus,
  SeverityLevel,
  ThreatType,
  PolicyType,
  ActionType,
  ActionStatus,
  PolicyAction
} from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/environment';

// Severity numeric weight for escalation comparison
const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  [SeverityLevel.LOW]: 1,
  [SeverityLevel.MEDIUM]: 2,
  [SeverityLevel.HIGH]: 3,
  [SeverityLevel.CRITICAL]: 4
};

// Strict incident status lifecycle transitions
export const VALID_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.DETECTED]: [
    IncidentStatus.INVESTIGATING,
    IncidentStatus.MITIGATED,
    IncidentStatus.FALSE_POSITIVE
  ],
  [IncidentStatus.INVESTIGATING]: [
    IncidentStatus.MITIGATED,
    IncidentStatus.RESOLVED,
    IncidentStatus.FALSE_POSITIVE
  ],
  [IncidentStatus.MITIGATED]: [
    IncidentStatus.RESOLVED,
    IncidentStatus.INVESTIGATING
  ],
  [IncidentStatus.RESOLVED]: [
    IncidentStatus.INVESTIGATING // Reopen
  ],
  [IncidentStatus.FALSE_POSITIVE]: [
    IncidentStatus.INVESTIGATING // Reopen
  ]
};

// ThreatType to PolicyType mapping
const THREAT_TO_POLICY_MAP: Partial<Record<ThreatType, PolicyType>> = {
  [ThreatType.SQL_INJECTION]: PolicyType.SQLI_PROTECTION,
  [ThreatType.XSS]: PolicyType.XSS_PROTECTION,
  [ThreatType.PATH_TRAVERSAL]: PolicyType.PATH_TRAVERSAL,
  [ThreatType.RATE_LIMIT_EXCEEDED]: PolicyType.RATE_LIMITING,
  [ThreatType.HMAC_VERIFICATION_FAILED]: PolicyType.HMAC_INTEGRITY,
  [ThreatType.MALFORMED_PAYLOAD]: PolicyType.PAYLOAD_VALIDATION
};

// PolicyAction to ActionType mapping
const POLICY_ACTION_TO_ACTION_TYPE: Record<PolicyAction, ActionType> = {
  [PolicyAction.BLOCK]: ActionType.IP_BLOCK,
  [PolicyAction.THROTTLE]: ActionType.IP_THROTTLE,
  [PolicyAction.QUARANTINE_IP]: ActionType.IP_BLOCK,
  [PolicyAction.LOG_ONLY]: ActionType.NOTIFICATION_SENT
};

/**
 * In-memory keyed lock to serialize concurrent event processing for the same clientIp + threatType.
 * Prevents race conditions where simultaneous events create duplicate incidents instead of aggregating.
 */
class KeyedAsyncLock {
  private activeLocks = new Map<string, Promise<void>>();

  public async acquire<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.activeLocks.get(key) || Promise.resolve();
    let releaseLock: () => void;
    const current = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.activeLocks.set(key, previous.then(() => current));

    await previous;
    try {
      return await task();
    } finally {
      releaseLock!();
      if (this.activeLocks.get(key) === current) {
        this.activeLocks.delete(key);
      }
    }
  }
}

const eventAggregationLock = new KeyedAsyncLock();

export class IncidentService {
  /**
   * Processes a newly emitted SecurityEvent:
   * 1. Aggregates the event into an active incident if one matches category + client IP within the aggregation window.
   * 2. Otherwise creates a new Incident.
   * 3. Escalates severity if the new event has higher severity.
   * 4. Evaluates policy-driven simulated response action (with duplicate suppression).
   * Serialized per clientIp:threatType to guarantee concurrency safety.
   */
  public static async processSecurityEvent(
    event: SecurityEvent
  ): Promise<{
    incident: Incident;
    responseAction: ResponseAction | null;
    isAggregated: boolean;
  }> {
    const clientIp = event.clientIp || '127.0.0.1';
    const threatType = event.threatType;
    const lockKey = `${clientIp}:${threatType}`;

    return await eventAggregationLock.acquire(lockKey, async () => {
      const windowStart = new Date(Date.now() - config.incidentAggregationWindowMs);

      // Look for an existing active incident matching clientIp and threatType within the sliding window
      const existingIncident = await prisma.incident.findFirst({
        where: {
          sourceIp: clientIp,
          serviceId: event.serviceId || null,
          status: { in: [IncidentStatus.DETECTED, IncidentStatus.INVESTIGATING] },
          updatedAt: { gte: windowStart },
          events: {
            some: {
              threatType
            }
          }
        },
        include: {
          events: true
        }
      });

      let incident: Incident;
      let isAggregated = false;

      if (existingIncident) {
        // 1. Group into existing incident
        isAggregated = true;

        // Link event to this incident
        await prisma.securityEvent.update({
          where: { id: event.id },
          data: { incidentId: existingIncident.id }
        });

        // Escalate severity if incoming event is higher
        const currentWeight = SEVERITY_WEIGHTS[existingIncident.severity];
        const newWeight = SEVERITY_WEIGHTS[event.severity];
        const targetSeverity = newWeight > currentWeight ? event.severity : existingIncident.severity;

        incident = await prisma.incident.update({
          where: { id: existingIncident.id },
          data: {
            severity: targetSeverity,
            updatedAt: new Date()
          }
        });
      } else {
        // 2. Create new incident
        const title = `[${threatType}] Security alert from ${clientIp}`;
        const description = `Automated incident created following detection of ${threatType} from client ${clientIp}.`;

        incident = await prisma.incident.create({
          data: {
            title,
            description,
            severity: event.severity,
            status: IncidentStatus.DETECTED,
            sourceIp: clientIp,
            serviceId: event.serviceId || null,
            detectedAt: event.createdAt || new Date()
          }
        });

        // Link event to new incident
        await prisma.securityEvent.update({
          where: { id: event.id },
          data: { incidentId: incident.id }
        });
      }

      // 3. Evaluate policy-driven response action proposal
      const responseAction = await IncidentService.evaluatePolicyResponseAction(incident, event);

      return {
        incident,
        responseAction,
        isAggregated
      };
    });
  }

  /**
   * Deterministically maps threat events and security policies to proposed simulated response actions.
   * Suppresses duplicate actions if one of the same type is already pending or applied.
   * Respects disabled policies without silently falling back to aggressive defaults.
   */
  public static async evaluatePolicyResponseAction(
    incident: Incident,
    event: SecurityEvent
  ): Promise<ResponseAction | null> {
    const policyType = THREAT_TO_POLICY_MAP[event.threatType];
    let proposedActionType: ActionType;
    let reasonText: string;

    // Check for configured security policy for this threat type
    let configuredPolicy = null;
    if (policyType) {
      configuredPolicy = await prisma.securityPolicy.findFirst({
        where: {
          policyType
        },
        orderBy: {
          updatedAt: 'desc' // Deterministic ordering for conflicting policies
        }
      });
    }

    if (configuredPolicy) {
      if (!configuredPolicy.isEnabled) {
        // Safe policy handling: When an administrator explicitly disables a policy,
        // do not silently bypass the policy with aggressive default fallback actions (e.g. IP_BLOCK).
        return null;
      }

      proposedActionType = POLICY_ACTION_TO_ACTION_TYPE[configuredPolicy.action] || ActionType.NOTIFICATION_SENT;
      reasonText = `Policy-triggered response: "${configuredPolicy.name}" (${configuredPolicy.action})`;
    } else {
      // Safe deterministic defaults when no matching policy is configured in database
      switch (incident.severity) {
        case SeverityLevel.CRITICAL:
          proposedActionType = ActionType.IP_BLOCK;
          reasonText = `Default automated response for CRITICAL severity ${event.threatType}`;
          break;
        case SeverityLevel.HIGH:
          proposedActionType = ActionType.IP_BLOCK;
          reasonText = `Default automated response for HIGH severity ${event.threatType}`;
          break;
        case SeverityLevel.MEDIUM:
          proposedActionType = ActionType.IP_THROTTLE;
          reasonText = `Default automated response for MEDIUM severity ${event.threatType}`;
          break;
        case SeverityLevel.LOW:
        default:
          proposedActionType = ActionType.NOTIFICATION_SENT;
          reasonText = `Default automated notification for LOW severity ${event.threatType}`;
          break;
      }
    }

    const target = incident.sourceIp || 'UNKNOWN';

    // Duplicate suppression: Prevent repeated events from triggering unlimited duplicate response actions
    const existingAction = await prisma.responseAction.findFirst({
      where: {
        incidentId: incident.id,
        actionType: proposedActionType,
        target,
        status: { in: [ActionStatus.PENDING, ActionStatus.APPLIED] }
      }
    });

    if (existingAction) {
      // Duplicate action suppressed safely
      return null;
    }

    // Explicitly record simulated prototype action
    const simulatedReason = `[SIMULATED PROTOTYPE ACTION] ${reasonText}. Real enforcement pending manual approval.`;

    const responseAction = await prisma.responseAction.create({
      data: {
        incidentId: incident.id,
        actionType: proposedActionType,
        target,
        status: ActionStatus.PENDING,
        reason: simulatedReason,
        appliedAt: new Date()
      }
    });

    // Record audit log for response action proposal
    await prisma.auditLog.create({
      data: {
        action: 'RESPONSE_ACTION_PROPOSED',
        entityType: 'ResponseAction',
        entityId: responseAction.id,
        clientIp: incident.sourceIp,
        details: {
          incidentId: incident.id,
          actionType: proposedActionType,
          target,
          status: ActionStatus.PENDING,
          isSimulated: true
        }
      }
    });

    return responseAction;
  }

  /**
   * Validates and applies a status transition for an incident.
   * Records an audit log entry for the lifecycle transition.
   */
  public static async updateIncidentStatus(
    incidentId: string,
    newStatus: IncidentStatus,
    actor: { id?: string; clientIp?: string; userAgent?: string; notes?: string }
  ): Promise<Incident> {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident) {
      throw new Error('INCIDENT_NOT_FOUND');
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[incident.status] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: Cannot transition from ${incident.status} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
      );
    }

    const resolvedAt = newStatus === IncidentStatus.RESOLVED ? new Date() : (incident.status === IncidentStatus.RESOLVED ? null : incident.resolvedAt);

    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        status: newStatus,
        resolvedAt
      }
    });

    // Write audit record
    await prisma.auditLog.create({
      data: {
        userId: actor.id || null,
        action: 'INCIDENT_STATUS_UPDATED',
        entityType: 'Incident',
        entityId: incident.id,
        clientIp: actor.clientIp || null,
        userAgent: actor.userAgent || null,
        details: {
          previousStatus: incident.status,
          newStatus,
          notes: actor.notes || null
        }
      }
    });

    return updated;
  }

  /**
   * Records a manual simulated response action requested by an authorized user.
   */
  public static async createManualResponseAction(
    incidentId: string,
    actionType: ActionType,
    actor: { id: string; fullName: string; clientIp?: string; userAgent?: string; reason?: string }
  ): Promise<ResponseAction> {
    const incident = await prisma.incident.findUnique({
      where: { id: incidentId }
    });

    if (!incident) {
      throw new Error('INCIDENT_NOT_FOUND');
    }

    const target = incident.sourceIp || 'UNKNOWN';

    // Duplicate check for active actions
    const existingAction = await prisma.responseAction.findFirst({
      where: {
        incidentId: incident.id,
        actionType,
        target,
        status: { in: [ActionStatus.PENDING, ActionStatus.APPLIED] }
      }
    });

    if (existingAction) {
      throw new Error(`DUPLICATE_ACTION: A pending or active ${actionType} action already exists for target ${target}.`);
    }

    const reason = `[SIMULATED PROTOTYPE ACTION] [Manual request by ${actor.fullName}]: ${actor.reason || 'Manual response action requested'}`;

    const action = await prisma.responseAction.create({
      data: {
        incidentId: incident.id,
        actionType,
        target,
        status: ActionStatus.PENDING,
        reason,
        appliedAt: new Date()
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: 'MANUAL_RESPONSE_ACTION_RECORDED',
        entityType: 'ResponseAction',
        entityId: action.id,
        clientIp: actor.clientIp || null,
        userAgent: actor.userAgent || null,
        details: {
          incidentId: incident.id,
          actionType,
          target,
          status: ActionStatus.PENDING,
          isSimulated: true
        }
      }
    });

    return action;
  }
}
