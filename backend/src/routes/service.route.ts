import { Router, Request, Response, NextFunction } from 'express';
import { Role, IncidentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/authMiddleware';

export const serviceRouter = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * GET /api/services
 * Returns registered ApiService records with live aggregated security telemetry:
 * total request count, blocked threat count, and open incident count.
 * Accessible to ADMIN, SECURITY_ANALYST, and AUDITOR.
 */
serviceRouter.get(
  '/',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST, Role.AUDITOR),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const services = await prisma.apiService.findMany({
        orderBy: { createdAt: 'asc' }
      });

      const serviceTelemetry = await Promise.all(
        services.map(async (svc) => {
          const [totalRequests, blockedThreats, openIncidents, totalIncidents] = await Promise.all([
            prisma.apiRequestLog.count({
              where: { serviceId: svc.id }
            }),
            prisma.securityEvent.count({
              where: {
                serviceId: svc.id,
                actionTaken: 'BLOCKED'
              }
            }),
            prisma.incident.count({
              where: {
                serviceId: svc.id,
                status: {
                  in: [
                    IncidentStatus.DETECTED,
                    IncidentStatus.INVESTIGATING,
                    IncidentStatus.MITIGATED
                  ]
                }
              }
            }),
            prisma.incident.count({
              where: { serviceId: svc.id }
            })
          ]);

          return {
            id: svc.id,
            name: svc.name,
            slug: svc.slug,
            description: svc.description,
            upstreamUrl: svc.baseUrl,
            isActive: svc.isActive,
            totalRequests,
            blockedThreats,
            openIncidents,
            totalIncidents,
            createdAt: svc.createdAt,
            updatedAt: svc.updatedAt
          };
        })
      );

      res.status(200).json({
        services: serviceTelemetry
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/services/:identifier
 * Returns telemetry details for a single service by UUID or slug.
 * Accessible to ADMIN, SECURITY_ANALYST, and AUDITOR.
 */
serviceRouter.get(
  '/:identifier',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST, Role.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = req.params.identifier as string;

      const svc = await prisma.apiService.findFirst({
        where: isValidUuid(identifier)
          ? { id: identifier }
          : { slug: identifier }
      });

      if (!svc) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Service with identifier "${identifier}" was not found.`
          }
        });
        return;
      }

      const [totalRequests, blockedThreats, openIncidents, totalIncidents] = await Promise.all([
        prisma.apiRequestLog.count({
          where: { serviceId: svc.id }
        }),
        prisma.securityEvent.count({
          where: {
            serviceId: svc.id,
            actionTaken: 'BLOCKED'
          }
        }),
        prisma.incident.count({
          where: {
            serviceId: svc.id,
            status: {
              in: [
                IncidentStatus.DETECTED,
                IncidentStatus.INVESTIGATING,
                IncidentStatus.MITIGATED
              ]
            }
          }
        }),
        prisma.incident.count({
          where: { serviceId: svc.id }
        })
      ]);

      res.status(200).json({
        service: {
          id: svc.id,
          name: svc.name,
          slug: svc.slug,
          description: svc.description,
          upstreamUrl: svc.baseUrl,
          isActive: svc.isActive,
          totalRequests,
          blockedThreats,
          openIncidents,
          totalIncidents,
          createdAt: svc.createdAt,
          updatedAt: svc.updatedAt
        }
      });
    } catch (err: any) {
      next(err);
    }
  }
);
