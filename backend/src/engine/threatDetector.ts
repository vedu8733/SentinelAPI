import { ThreatType, SeverityLevel, SecurityEvent } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/environment';
import { IncidentService } from '../services/incidentService';

export interface ThreatInspectionContext {
  clientIp: string;
  method: string;
  path: string;
  statusCode: number;
  body?: any;
  query?: any;
  requestLogId?: string;
  authFailed?: boolean;
}

// In-memory sliding window store for failed login attempts
const failedLoginsByIp = new Map<string, number[]>();

// In-memory cooldown tracker to prevent duplicate SecurityEvent noise
const eventCooldowns = new Map<string, number>();

// Deterministic signature patterns for malicious payloads
const SQLI_PATTERNS = [
  /(\b(union(\s+all)?\s+select)\b)/i,
  /('\s*or\s+['"\d\w]+\s*=\s*['"\d\w]+)/i,
  /(;\s*(drop|delete|insert|update|alter|truncate)\s+[a-z_])/i,
  /(--\s*$|#\s*$|\/\*.*?\*\/)/m
];

const PATH_TRAVERSAL_PATTERN = /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f)/i;

/**
 * Checks if an event creation should be suppressed due to active cooldown.
 * Returns true if allowed, false if suppressed.
 */
function shouldEmitEvent(clientIp: string, threatType: ThreatType, signature: string): boolean {
  const now = Date.now();
  const key = `${clientIp}:${threatType}:${signature}`;
  const lastEmitted = eventCooldowns.get(key) || 0;

  if (now - lastEmitted < config.eventCooldownMs) {
    return false;
  }

  eventCooldowns.set(key, now);
  return true;
}

export class ThreatDetector {
  /**
   * Resets in-memory state (primarily for test environments).
   */
  public static resetState(): void {
    failedLoginsByIp.clear();
    eventCooldowns.clear();
  }

  /**
   * Evaluates repeated failed login attempts from a specific client IP.
   */
  public static async recordFailedLogin(
    clientIp: string,
    requestLogId?: string
  ): Promise<SecurityEvent | null> {
    const now = Date.now();
    const timestamps = (failedLoginsByIp.get(clientIp) || []).filter(
      (ts) => now - ts < config.failedLoginWindowMs
    );

    timestamps.push(now);
    failedLoginsByIp.set(clientIp, timestamps);

    if (timestamps.length >= config.failedLoginThreshold) {
      if (!shouldEmitEvent(clientIp, ThreatType.UNAUTHORIZED_ACCESS, 'FAILED_LOGINS')) {
        return null;
      }

      try {
        const event = await prisma.securityEvent.create({
          data: {
            threatType: ThreatType.UNAUTHORIZED_ACCESS,
            severity: SeverityLevel.HIGH,
            clientIp,
            actionTaken: 'LOGGED',
            requestLogId: requestLogId || null,
            details: {
              reason: 'Repeated failed login attempts exceeded threshold',
              attemptCount: timestamps.length,
              threshold: config.failedLoginThreshold,
              windowSeconds: Math.round(config.failedLoginWindowMs / 1000)
            }
          }
        });

        // Trigger incident creation and aggregation
        IncidentService.processSecurityEvent(event).catch((err) => {
          console.error('[ThreatDetector] Failed to process incident for failed login:', err.message);
        });

        return event;
      } catch (err: any) {
        console.error('[ThreatDetector] Failed to persist failed login security event:', err.message);
        return null;
      }
    }

    return null;
  }

  /**
   * Evaluates rate limiting violation.
   */
  public static async recordRateLimitExceeded(
    clientIp: string,
    path: string,
    requestLogId?: string,
    serviceId?: string
  ): Promise<SecurityEvent | null> {
    if (!shouldEmitEvent(clientIp, ThreatType.RATE_LIMIT_EXCEEDED, path)) {
      return null;
    }

    try {
      const event = await prisma.securityEvent.create({
        data: {
          threatType: ThreatType.RATE_LIMIT_EXCEEDED,
          severity: SeverityLevel.MEDIUM,
          clientIp,
          serviceId: serviceId || null,
          actionTaken: 'THROTTLED',
          requestLogId: requestLogId || null,
          details: {
            reason: 'Excessive requests: rate limit threshold exceeded',
            path
          }
        }
      });

      // Trigger incident creation and aggregation
      IncidentService.processSecurityEvent(event).catch((err) => {
        console.error('[ThreatDetector] Failed to process incident for rate limit:', err.message);
      });

      return event;
    } catch (err: any) {
      console.error('[ThreatDetector] Failed to persist rate limit security event:', err.message);
      return null;
    }
  }

  /**
   * Evaluates unauthorized attempts to access protected routes.
   */
  public static async recordUnauthorizedAccess(
    clientIp: string,
    path: string,
    statusCode: number,
    reason: string,
    requestLogId?: string
  ): Promise<SecurityEvent | null> {
    if (!shouldEmitEvent(clientIp, ThreatType.UNAUTHORIZED_ACCESS, `${path}:${statusCode}`)) {
      return null;
    }

    try {
      const event = await prisma.securityEvent.create({
        data: {
          threatType: ThreatType.UNAUTHORIZED_ACCESS,
          severity: statusCode === 403 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM,
          clientIp,
          actionTaken: 'BLOCKED',
          requestLogId: requestLogId || null,
          details: {
            reason,
            path,
            statusCode
          }
        }
      });

      // Trigger incident creation and aggregation
      IncidentService.processSecurityEvent(event).catch((err) => {
        console.error('[ThreatDetector] Failed to process incident for unauthorized access:', err.message);
      });

      return event;
    } catch (err: any) {
      console.error('[ThreatDetector] Failed to persist unauthorized access security event:', err.message);
      return null;
    }
  }

  /**
   * Inspects payload strings and path markers for deterministic injection attacks.
   * Never stores passwords, tokens, or raw user bodies in the event.
   */
  public static async inspectPayloadPatterns(
    context: ThreatInspectionContext
  ): Promise<SecurityEvent | null> {
    const { clientIp, path, body, query, requestLogId } = context;

    // Stringify query values safely
    const queryStr = query ? JSON.stringify(query) : '';
    // Stringify non-sensitive body fields only (strip password/token fields)
    const sanitizedBody = body ? { ...body } : {};
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.secret;
    const bodyStr = JSON.stringify(sanitizedBody);

    const targetPayload = `${path} ${queryStr} ${bodyStr}`;

    // 1. Path Traversal Detection
    if (PATH_TRAVERSAL_PATTERN.test(path) || PATH_TRAVERSAL_PATTERN.test(queryStr)) {
      if (shouldEmitEvent(clientIp, ThreatType.PATH_TRAVERSAL, 'TRAVERSAL')) {
        try {
          const event = await prisma.securityEvent.create({
            data: {
              threatType: ThreatType.PATH_TRAVERSAL,
              severity: SeverityLevel.HIGH,
              clientIp,
              actionTaken: 'FLAGGED',
              requestLogId: requestLogId || null,
              details: {
                reason: 'Directory traversal sequence identified in request path/query',
                path
              }
            }
          });

          IncidentService.processSecurityEvent(event).catch((err) => {
            console.error('[ThreatDetector] Failed to process incident for traversal event:', err.message);
          });

          return event;
        } catch (err: any) {
          console.error('[ThreatDetector] Failed to persist path traversal event:', err.message);
        }
      }
    }

    // 2. SQL Injection Pattern Detection
    for (const pattern of SQLI_PATTERNS) {
      if (pattern.test(targetPayload)) {
        if (shouldEmitEvent(clientIp, ThreatType.SQL_INJECTION, 'SQLI')) {
          try {
            const event = await prisma.securityEvent.create({
              data: {
                threatType: ThreatType.SQL_INJECTION,
                severity: SeverityLevel.CRITICAL,
                clientIp,
                actionTaken: 'FLAGGED',
                requestLogId: requestLogId || null,
                details: {
                  reason: 'Deterministic SQL injection pattern identified in request parameters',
                  path
                }
              }
            });

            IncidentService.processSecurityEvent(event).catch((err) => {
              console.error('[ThreatDetector] Failed to process incident for SQLi event:', err.message);
            });

            return event;
          } catch (err: any) {
            console.error('[ThreatDetector] Failed to persist SQLi event:', err.message);
          }
        }
        break;
      }
    }

    return null;
  }
}
