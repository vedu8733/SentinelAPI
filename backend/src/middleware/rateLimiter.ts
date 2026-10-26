import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/environment';
import { ThreatDetector } from '../engine/threatDetector';
import { GatewayService } from '../services/gatewayService';

/**
 * ARCHITECTURAL NOTICE:
 * This rate limiting implementation uses an in-memory storage provider.
 *
 * Characteristics & Limitations:
 * 1. Process Isolation: Counters reset whenever the Node.js server process restarts.
 * 2. Single-Instance Bound: Rate limit counters are local to this process and are
 *    not synchronized across multi-instance clusters (which would require Redis or Memcached).
 *    This is intentionally chosen to keep SentinelAPI lightweight, deterministic, and self-contained.
 * 3. IP Spoofing Guard: Uses Express req.ip (bound to socket address unless trust proxy is explicitly enabled).
 */

/**
 * Standard HTTP 429 response handler that also notifies ThreatDetector.
 */
function handleLimitReached(
  req: Request,
  res: Response,
  message: string,
  serviceIdResolver?: () => Promise<string | undefined>
): void {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const path = req.originalUrl || req.url;

  // Asynchronously record security event for rate limit violation
  const recordEvent = async () => {
    let serviceId: string | undefined;
    if (serviceIdResolver) {
      try {
        serviceId = await serviceIdResolver();
      } catch (err: any) {
        console.error('[RateLimiter] Error resolving serviceId for rate limit:', err.message);
      }
    }
    await ThreatDetector.recordRateLimitExceeded(clientIp, path, undefined, serviceId);
  };

  recordEvent().catch((err) => {
    console.error('[RateLimiter] Error logging rate limit security event:', err.message);
  });

  res.status(429).json({
    error: {
      code: 'TOO_MANY_REQUESTS',
      message
    }
  });
}

/**
 * Global API Rate Limiter
 * Default: 100 requests per 1 minute window.
 * Excludes /api/gateway/* routes which use their own dedicated service rate limiter.
 */
export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false,  // Disable X-RateLimit-* headers
  skip: (req: Request) => Boolean(
    req.originalUrl?.startsWith('/api/gateway') || req.path?.startsWith('/gateway')
  ),
  handler: (req: Request, res: Response) => {
    handleLimitReached(
      req,
      res,
      'Too many API requests from this IP. Please wait before retrying.'
    );
  }
});

/**
 * Sensitive Authentication Rate Limiter (for /api/auth/login)
 * Default: 10 attempts per 1 minute window.
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.authRateLimitWindowMs,
  max: config.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    handleLimitReached(
      req,
      res,
      'Too many login attempts from this IP. Access temporarily throttled.'
    );
  }
});

/**
 * Dedicated NexaCart Gateway Rate Limiter
 * Default: 120 requests per 1 minute window.
 * Governs traffic passing through /api/gateway/nexacart/* without starving native SentinelAPI endpoints.
 */
export const nexacartGatewayRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: config.nexacartRateLimitWindowMs,
  max: config.nexacartRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    handleLimitReached(
      req,
      res,
      'NexaCart gateway rate limit exceeded. Please wait before retrying.',
      async () => {
        const service = await GatewayService.getNexaCartService();
        return service.id;
      }
    );
  }
});
