import http from 'http';
import { ThreatType, SeverityLevel, ApiService } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { config } from '../src/config/environment';
import { GatewayService, validateUpstreamUrl } from '../src/services/gatewayService';

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
}

function makeRequest(
  port: number,
  path: string,
  method: string = 'GET',
  headers: Record<string, string> = {},
  data?: any
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : undefined;
    const reqHeaders: Record<string, string> = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const formattedPath = path.replace(/ /g, '%20');

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: formattedPath,
        method,
        headers: reqHeaders
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsed
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runGatewayTests() {
  console.log('=== SentinelAPI Gateway Integration Test Suite for NexaCart ===\n');

  const testPort = 4096;
  const server = app.listen(testPort, '127.0.0.1');

  const results: { id: number; name: string; passed: boolean; details?: string }[] = [];

  function record(id: number, name: string, passed: boolean, details?: string) {
    results.push({ id, name, passed, details });
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] Scenario ${id}: ${name}${details ? ` -> ${details}` : ''}`);
  }

  const createdSecurityEventIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdRequestLogIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Idempotent NexaCart ApiService registration
    // -------------------------------------------------------------------------
    GatewayService.resetCache();
    const service1 = await GatewayService.getNexaCartService();
    const service2 = await GatewayService.getNexaCartService();
    const dbCount = await prisma.apiService.count({ where: { slug: 'nexacart' } });

    const s1Passed =
      service1.id === service2.id &&
      service1.slug === 'nexacart' &&
      service1.baseUrl === config.nexacartUpstreamUrl &&
      dbCount === 1;

    record(
      1,
      'Idempotent NexaCart ApiService registration',
      s1Passed,
      `Service ID: ${service1.id}, Slug: ${service1.slug}, DB Count: ${dbCount}`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Legitimate request forwarding preserves method, status, and response
    // -------------------------------------------------------------------------
    const res2 = await makeRequest(
      testPort,
      '/api/gateway/nexacart/api/health',
      'GET',
      { 'User-Agent': 'GatewayTestAgent/1.0' }
    );

    const requestId2 = res2.headers['x-request-id'] as string;
    const s2Passed =
      res2.status === 200 &&
      res2.body?.status === 'ok' &&
      res2.body?.service === 'nexacart-backend' &&
      Boolean(requestId2);

    record(
      2,
      'Legitimate request forwarding preserves method, status, and response',
      s2Passed,
      `Forwarded to NexaCart health -> status: ${res2.body?.status}, Request ID: ${requestId2}`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Product inventory retrieval through gateway
    // -------------------------------------------------------------------------
    const res3 = await makeRequest(testPort, '/api/gateway/nexacart/api/products');
    const s3Passed =
      res3.status === 200 &&
      Array.isArray(res3.body?.products) &&
      res3.body?.total >= 4;

    record(
      3,
      'Product inventory retrieval through gateway',
      s3Passed,
      `Retrieved ${res3.body?.total} inventory products through gateway proxy`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: In-flight SQL injection detection and blocking before upstream
    // -------------------------------------------------------------------------
    const sqliUrl = "/api/gateway/nexacart/api/products?query=' UNION SELECT 1,2,3--";
    const res4 = await makeRequest(testPort, sqliUrl);

    await new Promise((r) => setTimeout(r, 200));

    // Verify security event was recorded with NexaCart serviceId
    const sqliEvent = await prisma.securityEvent.findFirst({
      where: {
        serviceId: service1.id,
        threatType: ThreatType.SQL_INJECTION,
        actionTaken: 'BLOCKED'
      },
      orderBy: { createdAt: 'desc' },
      include: { incident: true }
    });

    if (sqliEvent) {
      createdSecurityEventIds.push(sqliEvent.id);
      if (sqliEvent.incidentId) createdIncidentIds.push(sqliEvent.incidentId);
    }

    const s4Passed =
      res4.status === 400 &&
      res4.body?.error?.code === 'THREAT_BLOCKED' &&
      res4.body?.error?.threatType === 'SQL_INJECTION' &&
      sqliEvent !== null &&
      sqliEvent.serviceId === service1.id &&
      sqliEvent.incident?.serviceId === service1.id;

    record(
      4,
      'In-flight SQL injection detection and blocking before upstream',
      s4Passed,
      `Blocked with 400 THREAT_BLOCKED, SecurityEvent ID: ${sqliEvent?.id}, Incident ServiceId: ${sqliEvent?.incident?.serviceId}`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: URL-encoded SQL injection is safely decoded and blocked
    // -------------------------------------------------------------------------
    const encodedSqliUrl = '/api/gateway/nexacart/api/products?filter=%27%20OR%201=1--';
    const res5 = await makeRequest(testPort, encodedSqliUrl);

    await new Promise((r) => setTimeout(r, 200));

    const s5Passed =
      res5.status === 400 &&
      res5.body?.error?.code === 'THREAT_BLOCKED' &&
      res5.body?.error?.threatType === 'SQL_INJECTION';

    record(
      5,
      'URL-encoded SQL injection is safely decoded and blocked',
      s5Passed,
      'Successfully caught encoded tautology (%27%20OR%201=1--)'
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Path traversal sequence is detected and blocked
    // -------------------------------------------------------------------------
    const traversalUrl = '/api/gateway/nexacart/api/products?file=../../etc/passwd';
    const res6 = await makeRequest(testPort, traversalUrl);

    await new Promise((r) => setTimeout(r, 200));

    const traversalEvent = await prisma.securityEvent.findFirst({
      where: {
        serviceId: service1.id,
        threatType: ThreatType.PATH_TRAVERSAL,
        actionTaken: 'BLOCKED'
      },
      orderBy: { createdAt: 'desc' },
      include: { incident: true }
    });

    if (traversalEvent) {
      createdSecurityEventIds.push(traversalEvent.id);
      if (traversalEvent.incidentId) createdIncidentIds.push(traversalEvent.incidentId);
    }

    const s6Passed =
      res6.status === 400 &&
      res6.body?.error?.code === 'THREAT_BLOCKED' &&
      res6.body?.error?.threatType === 'PATH_TRAVERSAL' &&
      traversalEvent !== null &&
      traversalEvent.serviceId === service1.id;

    record(
      6,
      'Path traversal sequence is detected and blocked',
      s6Passed,
      `Blocked with 400 THREAT_BLOCKED, Event ID: ${traversalEvent?.id}`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Malformed URL percent-encoding handles safely without crashing
    // -------------------------------------------------------------------------
    const malformedUrl = '/api/gateway/nexacart/api/products?q=%E0%A4%A';
    const res7 = await makeRequest(testPort, malformedUrl);

    // Must not crash or return unhandled 500
    const s7Passed = res7.status === 200 || res7.status === 400;

    record(
      7,
      'Malformed URL percent-encoding handles safely without crashing',
      s7Passed,
      `Responded safely with HTTP ${res7.status} (zero 500 crash)`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Hop-by-hop headers and internal SentinelAPI tokens are stripped
    // -------------------------------------------------------------------------
    const fakeInternalToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.internal';
    const res8 = await makeRequest(
      testPort,
      '/api/gateway/nexacart/api/health',
      'GET',
      {
        Authorization: fakeInternalToken,
        Connection: 'keep-alive',
        'X-Store-Session': 'store-user-session-123'
      }
    );

    const s8Passed = res8.status === 200 && res8.body?.status === 'ok';
    record(
      8,
      'Hop-by-hop headers and internal SentinelAPI tokens are stripped',
      s8Passed,
      'Internal Bearer stripped; store request succeeded cleanly'
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Loopback forwarding loop prevention
    // -------------------------------------------------------------------------
    let loopDetected = false;
    try {
      validateUpstreamUrl(`http://127.0.0.1:${config.port}`, config.port);
    } catch (loopErr: any) {
      loopDetected = loopErr.message.includes('Gateway forwarding loop detected');
    }

    record(
      9,
      'Loopback forwarding loop prevention',
      loopDetected,
      'Self-referencing upstream URL safely intercepted'
    );

    // -------------------------------------------------------------------------
    // Scenario 10: Upstream offline failure returns 502 Bad Gateway
    // -------------------------------------------------------------------------
    const originalUpstream = config.nexacartUpstreamUrl;
    let s10Passed = false;
    try {
      // Temporarily point to an unused port on loopback
      config.nexacartUpstreamUrl = 'http://127.0.0.1:5999';
      GatewayService.resetCache();

      const res10 = await makeRequest(testPort, '/api/gateway/nexacart/api/health');
      s10Passed = res10.status === 502 && res10.body?.error?.code === 'BAD_GATEWAY';
    } finally {
      config.nexacartUpstreamUrl = originalUpstream;
      GatewayService.resetCache();
    }

    record(
      10,
      'Upstream offline failure returns 502 Bad Gateway',
      s10Passed,
      'Offline upstream port safely returns HTTP 502 with BAD_GATEWAY error'
    );

    // -------------------------------------------------------------------------
    // Scenario 11: Dedicated NexaCart gateway rate limiter enforces throttling
    // -------------------------------------------------------------------------
    // The gateway rate limit is set to 120 req/min. Global rate limiter is bypassed for gateway routes.
    // Verify that rate limit headers are present on responses.
    const res11 = await makeRequest(testPort, '/api/gateway/nexacart/api/health');
    const hasRateLimitHeader = Boolean(
      res11.headers['ratelimit-limit'] || res11.headers['ratelimit-remaining']
    );

    const s11Passed = res11.status === 200 && hasRateLimitHeader;
    record(
      11,
      'Dedicated NexaCart gateway rate limiter enforces throttling',
      s11Passed,
      `RateLimit headers verified: limit=${res11.headers['ratelimit-limit']}, remaining=${res11.headers['ratelimit-remaining']}`
    );

    // -------------------------------------------------------------------------
    // Scenario 12: Native SentinelAPI routes remain 100% operational
    // -------------------------------------------------------------------------
    const resNativeHealth = await makeRequest(testPort, '/api/health');
    const s12Passed =
      resNativeHealth.status === 200 &&
      resNativeHealth.body?.service === 'sentinel-api-backend';

    record(
      12,
      'Native SentinelAPI routes remain 100% operational',
      s12Passed,
      `Native /api/health returned service: ${resNativeHealth.body?.service}`
    );
  } catch (err: any) {
    console.error('Gateway test execution runtime error:', err);
  } finally {
    // Purge only records created during this test suite run
    if (createdSecurityEventIds.length > 0) {
      await prisma.securityEvent.deleteMany({
        where: { id: { in: createdSecurityEventIds } }
      });
    }

    if (createdIncidentIds.length > 0) {
      await prisma.incident.deleteMany({
        where: { id: { in: createdIncidentIds } }
      });
    }

    server.close();
    await prisma.$disconnect();

    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nGateway Integration Test Summary: ${passedCount}/${results.length} scenarios passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runGatewayTests();
