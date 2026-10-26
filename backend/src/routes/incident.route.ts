import { Router, Request, Response, NextFunction } from 'express';
import {
  IncidentStatus,
  SeverityLevel,
  ThreatType,
  ActionType,
  Role,
  Prisma
} from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { IncidentService } from '../services/incidentService';

export const incidentRouter = Router();

const VALID_STATUSES = Object.values(IncidentStatus);
const VALID_SEVERITIES = Object.values(SeverityLevel);
const VALID_THREAT_TYPES = Object.values(ThreatType);
const VALID_ACTION_TYPES = Object.values(ActionType);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * GET /api/incidents
 * Lists security incidents with pagination and filtering.
 * Accessible to ADMIN, SECURITY_ANALYST, and AUDITOR.
 */
incidentRouter.get(
  '/',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST, Role.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pageStr = req.query.page as string | undefined;
      const limitStr = req.query.limit as string | undefined;
      const severity = req.query.severity as SeverityLevel | undefined;
      const status = req.query.status as IncidentStatus | undefined;
      const threatType = req.query.threatType as ThreatType | undefined;
      const sourceIp = req.query.sourceIp as string | undefined;
      const serviceId = req.query.serviceId as string | undefined;

      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const limit = limitStr ? parseInt(limitStr, 10) : 10;

      if (isNaN(page) || page < 1) {
        res.status(400).json({
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Query parameter "page" must be a positive integer.'
          }
        });
        return;
      }

      if (isNaN(limit) || limit < 1 || limit > 100) {
        res.status(400).json({
          error: {
            code: 'INVALID_PARAMETER',
            message: 'Query parameter "limit" must be between 1 and 100.'
          }
        });
        return;
      }

      if (serviceId && !isValidUuid(serviceId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_FILTER',
            message: 'Query parameter "serviceId" must be a valid UUID format.'
          }
        });
        return;
      }

      if (severity && !VALID_SEVERITIES.includes(severity)) {
        res.status(400).json({
          error: {
            code: 'INVALID_FILTER',
            message: `Invalid severity level. Allowed values: ${VALID_SEVERITIES.join(', ')}`
          }
        });
        return;
      }

      if (status && !VALID_STATUSES.includes(status)) {
        res.status(400).json({
          error: {
            code: 'INVALID_FILTER',
            message: `Invalid incident status. Allowed values: ${VALID_STATUSES.join(', ')}`
          }
        });
        return;
      }

      if (threatType && !VALID_THREAT_TYPES.includes(threatType)) {
        res.status(400).json({
          error: {
            code: 'INVALID_FILTER',
            message: `Invalid threat type. Allowed values: ${VALID_THREAT_TYPES.join(', ')}`
          }
        });
        return;
      }

      const where: Prisma.IncidentWhereInput = {};

      if (serviceId) {
        where.serviceId = serviceId;
      }

      if (severity) {
        where.severity = severity;
      }

      if (status) {
        where.status = status;
      }

      if (sourceIp) {
        where.sourceIp = { contains: sourceIp };
      }

      if (threatType) {
        where.events = {
          some: {
            threatType
          }
        };
      }

      const skip = (page - 1) * limit;

      const [total, incidents] = await Promise.all([
        prisma.incident.count({ where }),
        prisma.incident.findMany({
          where,
          skip,
          take: limit,
          orderBy: { detectedAt: 'desc' },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            _count: {
              select: {
                events: true,
                responseActions: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true
              }
            }
          }
        })
      ]);

      const formattedIncidents = incidents.map((inc) => ({
        id: inc.id,
        serviceId: inc.serviceId,
        service: inc.service
          ? {
              id: inc.service.id,
              name: inc.service.name,
              slug: inc.service.slug
            }
          : null,
        title: inc.title,
        description: inc.description,
        severity: inc.severity,
        status: inc.status,
        sourceIp: inc.sourceIp,
        assignedTo: inc.assignedTo,
        detectedAt: inc.detectedAt,
        resolvedAt: inc.resolvedAt,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
        eventCount: inc._count.events,
        responseActionCount: inc._count.responseActions
      }));

      res.status(200).json({
        incidents: formattedIncidents,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/incidents/:id
 * Fetches an incident by ID along with its associated security events and response actions.
 * Accessible to ADMIN, SECURITY_ANALYST, and AUDITOR.
 */
incidentRouter.get(
  '/:id',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST, Role.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;

      if (!isValidUuid(id)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ID',
            message: 'Incident ID must be a valid UUID format.'
          }
        });
        return;
      }

      const incident = await prisma.incident.findUnique({
        where: { id },
        include: {
          events: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              threatType: true,
              severity: true,
              clientIp: true,
              actionTaken: true,
              details: true,
              createdAt: true
            }
          },
          responseActions: {
            orderBy: { appliedAt: 'desc' }
          },
          assignedTo: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true
            }
          },
          service: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              events: true,
              responseActions: true
            }
          }
        }
      });

      if (!incident) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Incident with ID "${id}" was not found.`
          }
        });
        return;
      }

      res.status(200).json({
        incident: {
          id: incident.id,
          serviceId: incident.serviceId,
          service: incident.service
            ? {
                id: incident.service.id,
                name: incident.service.name,
                slug: incident.service.slug
              }
            : null,
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          status: incident.status,
          sourceIp: incident.sourceIp,
          assignedTo: incident.assignedTo,
          detectedAt: incident.detectedAt,
          resolvedAt: incident.resolvedAt,
          createdAt: incident.createdAt,
          updatedAt: incident.updatedAt,
          eventCount: incident._count.events,
          responseActionCount: incident._count.responseActions,
          events: incident.events,
          responseActions: incident.responseActions
        }
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * PATCH /api/incidents/:id/status
 * Transitions an incident to a new lifecycle status.
 * Rejects invalid transitions and records an audit log.
 * Restricted to ADMIN and SECURITY_ANALYST.
 */
incidentRouter.patch(
  '/:id/status',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status: newStatus, notes } = req.body || {};

      if (!isValidUuid(id)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ID',
            message: 'Incident ID must be a valid UUID format.'
          }
        });
        return;
      }

      if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS',
            message: `A valid target status is required. Allowed values: ${VALID_STATUSES.join(', ')}`
          }
        });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || undefined;

      try {
        const updated = await IncidentService.updateIncidentStatus(id, newStatus, {
          id: req.user?.id,
          clientIp,
          userAgent,
          notes
        });

        res.status(200).json({
          message: `Incident status updated to ${newStatus}.`,
          incident: {
            id: updated.id,
            status: updated.status,
            resolvedAt: updated.resolvedAt,
            updatedAt: updated.updatedAt
          }
        });
      } catch (err: any) {
        if (err.message === 'INCIDENT_NOT_FOUND') {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: `Incident with ID "${id}" was not found.`
            }
          });
          return;
        }

        if (err.message.startsWith('INVALID_STATUS_TRANSITION')) {
          res.status(400).json({
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: err.message
            }
          });
          return;
        }

        throw err;
      }
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * POST /api/incidents/:id/actions
 * Records a simulated response action for an incident.
 * Suppresses duplicate active actions of the same type.
 * Restricted to ADMIN and SECURITY_ANALYST.
 */
incidentRouter.post(
  '/:id/actions',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { actionType, reason } = req.body || {};

      if (!isValidUuid(id)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ID',
            message: 'Incident ID must be a valid UUID format.'
          }
        });
        return;
      }

      if (!actionType || !VALID_ACTION_TYPES.includes(actionType)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ACTION_TYPE',
            message: `A valid actionType is required. Allowed values: ${VALID_ACTION_TYPES.join(', ')}`
          }
        });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = (req.headers['user-agent'] as string) || undefined;

      try {
        const action = await IncidentService.createManualResponseAction(id, actionType, {
          id: req.user!.id,
          fullName: req.user!.fullName,
          clientIp,
          userAgent,
          reason
        });

        res.status(201).json({
          message: 'Simulated response action recorded successfully.',
          responseAction: action
        });
      } catch (err: any) {
        if (err.message === 'INCIDENT_NOT_FOUND') {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: `Incident with ID "${id}" was not found.`
            }
          });
          return;
        }

        if (err.message.startsWith('DUPLICATE_ACTION')) {
          res.status(409).json({
            error: {
              code: 'DUPLICATE_ACTION',
              message: err.message
            }
          });
          return;
        }

        throw err;
      }
    } catch (err: any) {
      next(err);
    }
  }
);
