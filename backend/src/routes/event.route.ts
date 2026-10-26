import { Router, Request, Response, NextFunction } from 'express';
import { ThreatType, Role, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/authMiddleware';

export const eventRouter = Router();

const VALID_THREAT_TYPES = Object.values(ThreatType);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * GET /api/events
 * Lists security events with pagination and filtering.
 * Ordered newest first. Includes affected service metadata.
 * Accessible to ADMIN, SECURITY_ANALYST, and AUDITOR.
 */
eventRouter.get(
  '/',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST, Role.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pageStr = req.query.page as string | undefined;
      const limitStr = req.query.limit as string | undefined;
      const serviceId = req.query.serviceId as string | undefined;
      const threatType = req.query.threatType as ThreatType | undefined;
      const actionTaken = req.query.actionTaken as string | undefined;

      const page = pageStr ? parseInt(pageStr, 10) : 1;
      const limit = limitStr ? parseInt(limitStr, 10) : 20;

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

      if (threatType && !VALID_THREAT_TYPES.includes(threatType)) {
        res.status(400).json({
          error: {
            code: 'INVALID_FILTER',
            message: `Invalid threat type. Allowed values: ${VALID_THREAT_TYPES.join(', ')}`
          }
        });
        return;
      }

      const where: Prisma.SecurityEventWhereInput = {};

      if (serviceId) {
        where.serviceId = serviceId;
      }

      if (threatType) {
        where.threatType = threatType;
      }

      if (actionTaken) {
        where.actionTaken = { equals: actionTaken, mode: 'insensitive' };
      }

      const skip = (page - 1) * limit;

      const [total, events] = await Promise.all([
        prisma.securityEvent.count({ where }),
        prisma.securityEvent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          }
        })
      ]);

      const formattedEvents = events.map((ev) => ({
        id: ev.id,
        threatType: ev.threatType,
        severity: ev.severity,
        actionTaken: ev.actionTaken,
        clientIp: ev.clientIp,
        details: ev.details,
        serviceId: ev.serviceId,
        service: ev.service
          ? {
              id: ev.service.id,
              name: ev.service.name,
              slug: ev.service.slug
            }
          : null,
        incidentId: ev.incidentId,
        createdAt: ev.createdAt
      }));

      res.status(200).json({
        events: formattedEvents,
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
