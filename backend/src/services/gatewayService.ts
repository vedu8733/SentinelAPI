import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { URL } from 'url';
import { Request, Response } from 'express';
import { ThreatType, SeverityLevel, ApiService } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/environment';
import { IncidentService } from './incidentService';

// Deterministic signature patterns for malicious payloads
const SQLI_PATTERNS = [
  /(\b(union(\s+all)?\s+select)\b)/i,
  /('\s*or\s+['"\d\w]+\s*=\s*['"\d\w]+)/i,
  /(\b(or\s+1\s*=\s*1)\b)/i,
  /(\b(or\s+'1'\s*=\s*'1')\b)/i,
  /(;\s*(drop|delete|insert|update|alter|truncate)\s+[a-z_])/i,
  /(--\s*$|#\s*$|\/\*.*?\*\/)/m
];

const PATH_TRAVERSAL_PATTERNS = [
  /(?:\.\.\/|\.\.\\)/,
  /%2e%2e(?:%2f|\/|%5c|\\)/i,
  /\.\.(?:%2f|%5c)/i
];

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host'
]);

/**
 * Safely decodes a URI string up to 2 passes to counter double encoding.
 * Gracefully handles malformed percent-encoding without throwing.
 */
export function safeDecodeUri(value: string): string {
  let decoded = value;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      // In case of malformed percent-encoding like '%E0%A4%A', break cleanly
      break;
    }
  }
  return decoded;
}

/**
 * Sanitizes URLs to remove sensitive query parameters (tokens, keys, passwords).
 */
export function sanitizeGatewayUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, 'http://localhost');
    const sensitiveKeys = ['token', 'password', 'key', 'secret', 'auth', 'apikey', 'access_token'];
    for (const key of sensitiveKeys) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, '[REDACTED]');
      }
    }
    return url.pathname + (url.search ? safeDecodeUri(url.search) : '');
  } catch {
    return rawUrl;
  }
}

/**
 * Validates that the configured upstream URL does not point to SentinelAPI itself.
 */
export function validateUpstreamUrl(upstreamUrl: string, gatewayPort: number): URL {
  let parsed: URL;
  try {
    parsed = new URL(upstreamUrl);
  } catch {
    throw new Error(`Invalid upstream URL configuration: "${upstreamUrl}".`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parseInt(parsed.port || (parsed.protocol === 'https:' ? '443' : '80'), 10);

  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0';

  if (isLoopback && port === gatewayPort) {
    throw new Error(
      `Gateway forwarding loop detected: Upstream URL "${upstreamUrl}" matches SentinelAPI's own listening port (${gatewayPort}).`
    );
  }

  return parsed;
}

export interface ThreatEvaluationResult {
  isThreat: boolean;
  threatType?: ThreatType;
  severity?: SeverityLevel;
  reason?: string;
}

/**
 * Evaluates inbound request components (path, query, body) for SQLi and Path Traversal.
 */
export function evaluateGatewayThreat(
  rawPath: string,
  query: Record<string, any>,
  body: any
): ThreatEvaluationResult {
  const decodedPath = safeDecodeUri(rawPath);
  const rawQueryStr = query ? JSON.stringify(query) : '';
  const decodedQueryStr = safeDecodeUri(rawQueryStr);

  // Strip sensitive fields from body inspection copy
  const sanitizedBody = body && typeof body === 'object' ? { ...body } : body;
  if (sanitizedBody && typeof sanitizedBody === 'object') {
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.secret;
  }
  const bodyStr = sanitizedBody ? JSON.stringify(sanitizedBody) : '';
  const decodedBodyStr = safeDecodeUri(bodyStr);

  // Combined inspection payload
  const combinedPayload = `${rawPath} ${decodedPath} ${rawQueryStr} ${decodedQueryStr} ${bodyStr} ${decodedBodyStr}`;

  // 1. Path Traversal Check
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (
      pattern.test(rawPath) ||
      pattern.test(decodedPath) ||
      pattern.test(rawQueryStr) ||
      pattern.test(decodedQueryStr) ||
      pattern.test(bodyStr) ||
      pattern.test(decodedBodyStr)
    ) {
      return {
        isThreat: true,
        threatType: ThreatType.PATH_TRAVERSAL,
        severity: SeverityLevel.HIGH,
        reason: 'Directory traversal sequence identified in gateway request parameters or path'
      };
    }
  }

  // 2. SQL Injection Check
  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(combinedPayload)) {
      return {
        isThreat: true,
        threatType: ThreatType.SQL_INJECTION,
        severity: SeverityLevel.CRITICAL,
        reason: 'Deterministic SQL injection pattern identified in gateway request parameters'
      };
    }
  }

  return { isThreat: false };
}

export class GatewayService {
  private static cachedNexaCartService: ApiService | null = null;

  /**
   * Idempotently retrieves or creates the NexaCart ApiService record in SentinelAPI database.
   */
  public static async getNexaCartService(): Promise<ApiService> {
    if (this.cachedNexaCartService) {
      return this.cachedNexaCartService;
    }

    const service = await prisma.apiService.upsert({
      where: { slug: 'nexacart' },
      update: {
        baseUrl: config.nexacartUpstreamUrl,
        isActive: true
      },
      create: {
        name: 'NexaCart Demo Store',
        slug: 'nexacart',
        description: 'NexaCart E-Commerce Demo Store protected by SentinelAPI Gateway',
        baseUrl: config.nexacartUpstreamUrl,
        isActive: true
      }
    });

    this.cachedNexaCartService = service;
    return service;
  }

  /**
   * Resets cached service instance (for testing).
   */
  public static resetCache(): void {
    this.cachedNexaCartService = null;
  }

  /**
   * Pre-forwarding inspection and security event recording.
   * Returns true if request is clean and should proceed; false if blocked.
   */
  public static async inspectAndFilterRequest(
    req: Request,
    res: Response,
    service: ApiService,
    requestId: string
  ): Promise<boolean> {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const rawPath = req.originalUrl || req.url;

    const evaluation = evaluateGatewayThreat(rawPath, req.query, req.body);

    if (evaluation.isThreat && evaluation.threatType) {
      const sanitizedUrl = sanitizeGatewayUrl(rawPath);

      // Record SecurityEvent explicitly linked to NexaCart ApiService
      try {
        const event = await prisma.securityEvent.create({
          data: {
            threatType: evaluation.threatType,
            severity: evaluation.severity || SeverityLevel.HIGH,
            clientIp,
            serviceId: service.id,
            actionTaken: 'BLOCKED',
            details: {
              reason: evaluation.reason || 'Malicious threat pattern detected',
              path: sanitizedUrl,
              method: req.method,
              gatewayBlocked: true
            }
          }
        });

        // Trigger incident creation and aggregation
        IncidentService.processSecurityEvent(event).catch((err) => {
          console.error('[GatewayService] Incident processing error:', err.message);
        });
      } catch (dbErr: any) {
        console.error('[GatewayService] Failed to record security event:', dbErr.message);
      }

      // Block request before reaching upstream
      res.status(400).json({
        error: {
          code: 'THREAT_BLOCKED',
          message: 'Request blocked by SentinelAPI Security Gateway: Malicious payload pattern identified.',
          threatType: evaluation.threatType,
          requestId
        }
      });

      // Record ApiRequestLog for the blocked threat
      prisma.apiRequestLog.create({
        data: {
          requestId,
          clientIp,
          serviceId: service.id,
          method: req.method,
          path: sanitizedUrl,
          statusCode: 400,
          responseTimeMs: 1,
          requestSize: req.headers['content-length'] ? Number(req.headers['content-length']) : null,
          userAgent: (req.headers['user-agent'] as string) || null
        }
      }).catch((logErr) => {
        console.error('[GatewayService] Failed to record blocked request log:', logErr.message);
      });

      return false;
    }

    return true;
  }

  /**
   * Reverse-proxies an HTTP request to the NexaCart backend upstream.
   */
  public static forwardRequest(
    req: Request,
    res: Response,
    service: ApiService,
    targetSubpath: string,
    requestId: string,
    startTime: bigint
  ): void {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    let upstreamUrlObj: URL;
    try {
      upstreamUrlObj = validateUpstreamUrl(config.nexacartUpstreamUrl, config.port);
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'GATEWAY_CONFIGURATION_ERROR',
          message: err.message
        }
      });
      return;
    }

    // Build upstream target path: preserve query string and subpath
    const upstreamPath = targetSubpath.startsWith('/') ? targetSubpath : `/${targetSubpath}`;

    // Filter and sanitize outbound headers
    const outboundHeaders: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lowerKey)) {
        continue;
      }
      // Never forward SentinelAPI's internal Bearer authorization token
      if (lowerKey === 'authorization' && typeof value === 'string' && value.startsWith('Bearer ')) {
        continue;
      }
      if (value !== undefined) {
        outboundHeaders[lowerKey] = value;
      }
    }

    // Set trustworthy gateway headers
    outboundHeaders['host'] = upstreamUrlObj.host;
    outboundHeaders['x-request-id'] = requestId;
    const existingXff = req.headers['x-forwarded-for'];
    outboundHeaders['x-forwarded-for'] = existingXff ? `${existingXff}, ${clientIp}` : clientIp;
    outboundHeaders['x-forwarded-proto'] = req.protocol;
    outboundHeaders['x-forwarded-host'] = req.get('host') || `${config.host}:${config.port}`;

    // Prepare body payload if applicable
    let bodyBuffer: Buffer | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      bodyBuffer = Buffer.from(JSON.stringify(req.body), 'utf8');
      outboundHeaders['content-type'] = 'application/json';
      outboundHeaders['content-length'] = bodyBuffer.length.toString();
    }

    const transport = upstreamUrlObj.protocol === 'https:' ? https : http;

    const proxyReq = transport.request(
      {
        protocol: upstreamUrlObj.protocol,
        hostname: upstreamUrlObj.hostname,
        port: upstreamUrlObj.port || (upstreamUrlObj.protocol === 'https:' ? 443 : 80),
        path: upstreamPath,
        method: req.method,
        headers: outboundHeaders,
        timeout: 8000 // 8-second upstream timeout requirement
      },
      (upstreamRes) => {
        const statusCode = upstreamRes.statusCode || 502;
        res.status(statusCode);

        // Forward response headers (excluding hop-by-hop)
        for (const [resKey, resVal] of Object.entries(upstreamRes.headers)) {
          if (!HOP_BY_HOP_HEADERS.has(resKey.toLowerCase()) && resVal !== undefined) {
            res.setHeader(resKey, resVal);
          }
        }
        res.setHeader('X-Request-Id', requestId);

        // Pipe upstream response body to client
        upstreamRes.pipe(res);

        // Record request log on finish
        res.on('finish', async () => {
          const endTime = process.hrtime.bigint();
          const responseTimeMs = Math.round(Number(endTime - startTime) / 1e6);
          try {
            await prisma.apiRequestLog.create({
              data: {
                requestId,
                clientIp,
                serviceId: service.id,
                method: req.method,
                path: sanitizeGatewayUrl(req.originalUrl || req.url),
                statusCode: res.statusCode,
                responseTimeMs,
                requestSize: bodyBuffer ? bodyBuffer.length : null,
                userAgent: (req.headers['user-agent'] as string) || null
              }
            });
          } catch (logErr: any) {
            console.error('[GatewayService] Failed to record request log:', logErr.message);
          }
        });
      }
    );

    // Upstream Timeout Handling (504 Gateway Timeout)
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'NexaCart upstream server timed out after 8000ms.'
          }
        });
      }
    });

    // Upstream Failure Handling (502 Bad Gateway)
    proxyReq.on('error', (err: any) => {
      if (!res.headersSent) {
        const isConnRefused = err.code === 'ECONNREFUSED';
        res.status(502).json({
          error: {
            code: 'BAD_GATEWAY',
            message: isConnRefused
              ? 'Unable to connect to NexaCart upstream server. Service may be offline.'
              : `Gateway proxy error: ${err.message}`
          }
        });
      }
    });

    if (bodyBuffer) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  }
}
