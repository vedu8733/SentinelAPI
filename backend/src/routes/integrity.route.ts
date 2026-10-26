import { Router, Request, Response, NextFunction } from 'express';
import { ThreatType, SeverityLevel, Role } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/authMiddleware';
import { generateHmacSignature, verifyHmacSignature } from '../services/integrityService';
import { IncidentService } from '../services/incidentService';

export const integrityRouter = Router();

// In-memory cooldown tracker to avoid duplicate SecurityEvents for the same integrity failure
const tamperingAlertCooldowns = new Map<string, number>();

/**
 * POST /api/integrity/sign
 * Generates an HMAC-SHA256 signature and registers an IntegrityRecord for a resource.
 * Restricted to ADMIN and SECURITY_ANALYST roles.
 */
integrityRouter.post(
  '/sign',
  authenticate,
  requireRole(Role.ADMIN, Role.SECURITY_ANALYST),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resourceType, resourceId, data } = req.body || {};

      if (!resourceType || !resourceId || typeof resourceType !== 'string' || typeof resourceId !== 'string') {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Both resourceType and resourceId are required strings.'
          }
        });
        return;
      }

      if (data === undefined || typeof data !== 'object' || data === null) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A non-null JSON object data payload is required for signing.'
          }
        });
        return;
      }

      const { signature, keyId } = generateHmacSignature(data);

      let record = await prisma.integrityRecord.findFirst({
        where: { resourceType, resourceId }
      });

      if (record) {
        record = await prisma.integrityRecord.update({
          where: { id: record.id },
          data: {
            keyId,
            signatureCalculated: signature,
            isValid: true,
            verifiedAt: new Date()
          }
        });
      } else {
        record = await prisma.integrityRecord.create({
          data: {
            resourceType,
            resourceId,
            keyId,
            signatureCalculated: signature,
            isValid: true,
            verifiedAt: new Date()
          }
        });
      }

      res.status(200).json({
        message: 'Integrity record created successfully.',
        record: {
          id: record.id,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          keyId: record.keyId,
          signature: record.signatureCalculated,
          isValid: record.isValid,
          createdAt: record.createdAt,
          verifiedAt: record.verifiedAt
        }
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * POST /api/integrity/verify
 * Verifies a resource payload against its stored HMAC-SHA256 integrity signature.
 * On tampering, flags a SecurityEvent in the database.
 */
integrityRouter.post(
  '/verify',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resourceType, resourceId, data } = req.body || {};

      if (!resourceType || !resourceId || typeof resourceType !== 'string' || typeof resourceId !== 'string') {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Both resourceType and resourceId are required strings.'
          }
        });
        return;
      }

      if (data === undefined || typeof data !== 'object' || data === null) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'A non-null JSON object data payload is required for verification.'
          }
        });
        return;
      }

      const record = await prisma.integrityRecord.findFirst({
        where: { resourceType, resourceId }
      });

      if (!record) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `No stored integrity record found for resource "${resourceType}:${resourceId}".`
          }
        });
        return;
      }

      const verification = verifyHmacSignature(data, record.signatureCalculated, record.keyId);

      if (verification.isValid) {
        await prisma.integrityRecord.update({
          where: { id: record.id },
          data: {
            isValid: true,
            verifiedAt: new Date()
          }
        });

        res.status(200).json({
          isValid: true,
          message: 'Data integrity verified successfully. No tampering detected.',
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          keyId: record.keyId,
          verifiedAt: new Date()
        });
        return;
      }

      // Tampering detected: mark record as invalid
      await prisma.integrityRecord.update({
        where: { id: record.id },
        data: {
          isValid: false,
          verifiedAt: new Date()
        }
      });

      // Avoid spamming duplicate security events if the same failure is checked within 30s
      const cooldownKey = `${resourceType}:${resourceId}`;
      const lastReported = tamperingAlertCooldowns.get(cooldownKey) || 0;
      const now = Date.now();

      if (now - lastReported > 30000) {
        tamperingAlertCooldowns.set(cooldownKey, now);

        const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
        try {
          const event = await prisma.securityEvent.create({
            data: {
              threatType: ThreatType.HMAC_VERIFICATION_FAILED,
              severity: SeverityLevel.CRITICAL,
              clientIp,
              actionTaken: 'FLAGGED',
              details: {
                reason: 'Cryptographic HMAC integrity failure: resource modification detected',
                resourceType,
                resourceId,
                keyId: record.keyId
              }
            }
          });

          IncidentService.processSecurityEvent(event).catch((err) => {
            console.error('[IntegrityRoute] Failed to process incident for tampering event:', err.message);
          });
        } catch (dbErr: any) {
          console.error('[IntegrityRoute] Failed to persist HMAC failure security event:', dbErr.message);
        }
      }

      res.status(400).json({
        isValid: false,
        error: {
          code: 'INTEGRITY_VERIFICATION_FAILED',
          message: 'Data integrity check failed: payload does not match stored cryptographic signature.'
        },
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        keyId: record.keyId
      });
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/integrity/status/:resourceType/:resourceId
 * Retrieves metadata for a stored integrity record.
 */
integrityRouter.get(
  '/status/:resourceType/:resourceId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceType = String(req.params.resourceType);
      const resourceId = String(req.params.resourceId);

      const record = await prisma.integrityRecord.findFirst({
        where: { resourceType, resourceId }
      });

      if (!record) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `No integrity record found for "${resourceType}:${resourceId}".`
          }
        });
        return;
      }

      res.status(200).json({
        record: {
          id: record.id,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          keyId: record.keyId,
          signature: record.signatureCalculated,
          isValid: record.isValid,
          createdAt: record.createdAt,
          verifiedAt: record.verifiedAt
        }
      });
    } catch (err: any) {
      next(err);
    }
  }
);
