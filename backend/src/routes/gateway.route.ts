import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { nexacartGatewayRateLimiter } from '../middleware/rateLimiter';
import { GatewayService } from '../services/gatewayService';

export const gatewayRouter = Router();

// Apply dedicated NexaCart gateway rate limiter (120 req/min)
gatewayRouter.use(nexacartGatewayRateLimiter);

/**
 * Catch-all gateway proxy handler for NexaCart store traffic.
 * Handles:
 *   GET /api/gateway/nexacart/api/health
 *   GET /api/gateway/nexacart/api/products
 *   GET /api/gateway/nexacart/api/products/:slug
 *   POST /api/gateway/nexacart/*
 */
gatewayRouter.use(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = process.hrtime.bigint();
  const requestId = req.requestId || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  try {
    // 1. Idempotently retrieve NexaCart ApiService from database
    const service = await GatewayService.getNexaCartService();

    // 2. In-Flight Threat Inspection (SQLi, Path Traversal, Encoding Attacks)
    const isClean = await GatewayService.inspectAndFilterRequest(req, res, service, requestId);
    if (!isClean) {
      // Malicious request was rejected and logged; stop here
      return;
    }

    // 3. Resolve target subpath (e.g. "/api/products" or "/api/health")
    // When mounted at /api/gateway/nexacart, req.url retains the relative subpath and query
    const targetSubpath = req.url || '/';

    // 4. Reverse-Proxy Forward to NexaCart Upstream
    GatewayService.forwardRequest(req, res, service, targetSubpath, requestId, startTime);
  } catch (err) {
    next(err);
  }
});
