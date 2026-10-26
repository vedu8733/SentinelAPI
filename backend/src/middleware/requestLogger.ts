import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ThreatDetector } from '../engine/threatDetector';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Extracts a reliable client IP address without blindly trusting spoofable X-Forwarded-For headers.
 */
function getReliableClientIp(req: Request): string {
  // If behind a trusted reverse proxy configured via Express 'trust proxy', req.ip is sanitized.
  // Otherwise, fallback directly to the socket remote address.
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Sanitizes URLs to remove sensitive query parameters (e.g., tokens, keys, passwords).
 */
function sanitizePath(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, 'http://localhost');
    const sensitiveKeys = ['token', 'password', 'key', 'secret', 'auth', 'apikey', 'access_token'];
    for (const key of sensitiveKeys) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return url.pathname + (url.search ? decodeURIComponent(url.search) : '');
  } catch {
    return rawUrl;
  }
}

/**
 * Global API Request Monitoring Middleware.
 * Records transaction metadata to ApiRequestLog without storing secrets or bodies.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // For gateway routes, gatewayService handles dedicated in-flight threat inspection,
  // ApiService attribution, and forwarding proxy lifecycle logging.
  if ((req.originalUrl || req.url || '').startsWith('/api/gateway')) {
    return next();
  }

  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startTime = process.hrtime.bigint();
  const clientIp = getReliableClientIp(req);
  const authHeader = req.headers.authorization;
  const hasAuthHeader = Boolean(authHeader || req.headers['x-api-key']);

  // Extract non-sensitive key prefix if API key format is present, never the secret
  let authKeyPrefix: string | null = null;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    authKeyPrefix = 'Bearer';
  } else if (typeof req.headers['x-api-key'] === 'string') {
    authKeyPrefix = req.headers['x-api-key'].substring(0, 7) + '...';
  }

  // Hook into response finish event
  res.on('finish', async () => {
    const endTime = process.hrtime.bigint();
    const responseTimeMs = Math.round(Number(endTime - startTime) / 1e6);
    const sanitizedUrl = sanitizePath(req.originalUrl || req.url);

    let requestLogId: string | undefined;

    try {
      const log = await prisma.apiRequestLog.create({
        data: {
          requestId,
          clientIp,
          method: req.method,
          path: sanitizedUrl,
          statusCode: res.statusCode,
          responseTimeMs,
          requestSize: Number(req.headers['content-length']) || null,
          responseSize: Number(res.getHeader('content-length')) || null,
          hasAuthHeader,
          authKeyPrefix,
          userAgent: (req.headers['user-agent'] as string) || null
        }
      });
      requestLogId = log.id;
    } catch (err: any) {
      // Safe logging failure fallback: Never crash server and never leak secrets
      console.error('[RequestLogger] Failed to write API request log:', err.message);
    }

    // Trigger deterministic rule-based threat evaluation
    try {
      // Rule: Payload pattern inspection (SQLi, Path Traversal)
      await ThreatDetector.inspectPayloadPatterns({
        clientIp,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        body: req.body,
        query: req.query,
        requestLogId
      });

      // Rule: Repeated failed login attempts
      if (res.statusCode === 401 && (req.originalUrl || req.url).startsWith('/api/auth/login')) {
        await ThreatDetector.recordFailedLogin(clientIp, requestLogId);
      }

      // Rule: Unauthorized attempts to access protected endpoints
      if (
        (res.statusCode === 401 || res.statusCode === 403) &&
        !(req.originalUrl || req.url).startsWith('/api/auth/login')
      ) {
        await ThreatDetector.recordUnauthorizedAccess(
          clientIp,
          sanitizedUrl,
          res.statusCode,
          res.statusCode === 403 ? 'Forbidden: insufficient role permissions' : 'Unauthorized: invalid or missing token',
          requestLogId
        );
      }
    } catch (threatErr: any) {
      console.error('[ThreatDetector] Error during threat evaluation:', threatErr.message);
    }
  });

  next();
}
