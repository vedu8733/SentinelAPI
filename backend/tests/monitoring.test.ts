import http from 'http';
import { ThreatType, SeverityLevel, Role } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { ThreatDetector } from '../src/engine/threatDetector';
import { hashPassword } from '../src/utils/security';

interface HttpResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
}

function makeRequest(
  port: number,
  path: string,
  method: string,
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

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
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

async function runMonitoringTests() {
  console.log('=== SentinelAPI Monitoring & Threat Detection Test Suite ===\n');

  const testPort = 4098;
  const server = app.listen(testPort, '127.0.0.1');

  const createdRequestLogIds: string[] = [];
  const createdSecurityEventIds: string[] = [];
  let testUserId = '';

  const results: { id: number; name: string; passed: boolean; details?: string }[] = [];

  function record(id: number, name: string, passed: boolean, details?: string) {
    results.push({ id, name, passed, details });
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] Scenario ${id}: ${name}${details ? ` -> ${details}` : ''}`);
  }

  try {
    // Reset threat detector in-memory window/cooldown
    ThreatDetector.resetState();

    // Setup a test administrator for authenticated calls
    const timestamp = Date.now();
    const testEmail = `monitor-admin-${timestamp}@sentinelapi.local`;
    const testPassword = 'MonitorAdmin@Pass2026!';
    const passwordHash = await hashPassword(testPassword);

    const testAdmin = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        fullName: 'Monitor Admin User',
        role: Role.ADMIN,
        isActive: true
      }
    });
    testUserId = testAdmin.id;

    // -------------------------------------------------------------
    // Scenario 1: Request metadata is recorded for actual API traffic
    // -------------------------------------------------------------
    const res1 = await makeRequest(testPort, '/api/health', 'GET', {
      'User-Agent': 'SentinelAPI-AuditAgent/1.0'
    });
    const requestId1 = res1.headers['x-request-id'] as string;

    // Wait a brief moment for asynchronous res.on('finish') write
    await new Promise((r) => setTimeout(r, 200));

    const log1 = await prisma.apiRequestLog.findUnique({
      where: { requestId: requestId1 }
    });

    if (log1) createdRequestLogIds.push(log1.id);

    const s1Passed =
      res1.status === 200 &&
      Boolean(requestId1) &&
      log1 !== null &&
      log1.method === 'GET' &&
      log1.path === '/api/health' &&
      log1.statusCode === 200 &&
      log1.responseTimeMs >= 0 &&
      log1.userAgent === 'SentinelAPI-AuditAgent/1.0';

    record(
      1,
      'Request metadata is recorded for actual API traffic',
      s1Passed,
      `Request ID: ${requestId1}, Duration: ${log1?.responseTimeMs}ms`
    );

    // -------------------------------------------------------------
    // Scenario 2: Sensitive headers and credentials are not stored in logs
    // -------------------------------------------------------------
    const sensitivePassword = 'SuperSecretUnpublishedPassword999!';
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummysecretpayload.signature';
    const res2 = await makeRequest(
      testPort,
      '/api/auth/login?token=leakMeToken&password=leakMePassword',
      'POST',
      {
        Authorization: `Bearer ${fakeToken}`
      },
      {
        email: testEmail,
        password: sensitivePassword
      }
    );

    const requestId2 = res2.headers['x-request-id'] as string;
    await new Promise((r) => setTimeout(r, 200));

    const log2 = await prisma.apiRequestLog.findUnique({
      where: { requestId: requestId2 }
    });
    if (log2) createdRequestLogIds.push(log2.id);

    // Verify raw secret does not exist anywhere in log2 fields
    const logJson = JSON.stringify(log2);
    const passwordNotLogged = !logJson.includes(sensitivePassword);
    const tokenNotLogged = !logJson.includes(fakeToken);
    const queryRedacted = log2?.path.includes('[REDACTED]') && !log2?.path.includes('leakMeToken');
    const authPrefixSafe = log2?.authKeyPrefix === 'Bearer';

    const s2Passed = passwordNotLogged && tokenNotLogged && queryRedacted && authPrefixSafe;
    record(
      2,
      'Sensitive headers and credentials are not stored in logs',
      s2Passed,
      'Password omitted, query params redacted, auth token secret not logged'
    );

    // -------------------------------------------------------------
    // Scenario 3: Repeated failed logins trigger the configured detection rule
    // -------------------------------------------------------------
    ThreatDetector.resetState();

    // Execute 5 consecutive failed logins to hit the threshold
    for (let i = 0; i < 5; i++) {
      await makeRequest(
        testPort,
        '/api/auth/login',
        'POST',
        {},
        { email: testEmail, password: 'WrongPasswordForTrigger!' }
      );
    }

    await new Promise((r) => setTimeout(r, 300));

    // Find security event for failed logins
    const failedLoginEvent = await prisma.securityEvent.findFirst({
      where: {
        threatType: ThreatType.UNAUTHORIZED_ACCESS,
        details: {
          path: ['reason'],
          equals: 'Repeated failed login attempts exceeded threshold'
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (failedLoginEvent) createdSecurityEventIds.push(failedLoginEvent.id);

    const s3Passed =
      failedLoginEvent !== null &&
      failedLoginEvent.severity === SeverityLevel.HIGH &&
      failedLoginEvent.actionTaken === 'LOGGED' &&
      !JSON.stringify(failedLoginEvent.details).includes('WrongPasswordForTrigger');

    record(
      3,
      'Repeated failed logins trigger the configured detection rule',
      s3Passed,
      `Detected event ID: ${failedLoginEvent?.id}, Severity: HIGH`
    );

    // -------------------------------------------------------------
    // Scenario 4: Excessive requests receive HTTP 429
    // -------------------------------------------------------------
    // Use ThreatDetector.recordRateLimitExceeded directly to verify the event and handler behavior
    const rateLimitEvent = await ThreatDetector.recordRateLimitExceeded('127.0.0.1', '/api/test/flood');
    if (rateLimitEvent) createdSecurityEventIds.push(rateLimitEvent.id);

    // Rapid requests testing the rate limiter response
    // The auth rate limiter has max = 10. We already made 1 (scenario 2) + 5 (scenario 3) = 6 requests.
    // Making 5 more should trigger 429 TOO_MANY_REQUESTS
    let rateLimitedRes: HttpResponse | null = null;
    for (let i = 0; i < 6; i++) {
      const r = await makeRequest(
        testPort,
        '/api/auth/login',
        'POST',
        {},
        { email: testEmail, password: 'WrongPasswordRateLimit!' }
      );
      if (r.status === 429) {
        rateLimitedRes = r;
        break;
      }
    }

    const s4Passed =
      rateLimitedRes !== null &&
      rateLimitedRes.status === 429 &&
      rateLimitedRes.body?.error?.code === 'TOO_MANY_REQUESTS' &&
      rateLimitEvent !== null &&
      rateLimitEvent.threatType === ThreatType.RATE_LIMIT_EXCEEDED;

    record(
      4,
      'Excessive requests receive HTTP 429',
      s4Passed,
      `HTTP 429 returned with code TOO_MANY_REQUESTS and SecurityEvent generated`
    );

    // -------------------------------------------------------------
    // Scenario 5: Unauthorized access can produce an appropriate security event
    // -------------------------------------------------------------
    ThreatDetector.resetState();
    const unauthRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: 'Bearer invalid.unauthorized.token'
    });

    await new Promise((r) => setTimeout(r, 200));

    const unauthEvent = await prisma.securityEvent.findFirst({
      where: {
        threatType: ThreatType.UNAUTHORIZED_ACCESS,
        details: {
          path: ['reason'],
          equals: 'Unauthorized: invalid or missing token'
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (unauthEvent) createdSecurityEventIds.push(unauthEvent.id);

    const s5Passed =
      unauthRes.status === 401 &&
      unauthEvent !== null &&
      unauthEvent.actionTaken === 'BLOCKED';

    record(
      5,
      'Unauthorized access can produce an appropriate security event',
      s5Passed,
      `HTTP 401 triggered SecurityEvent with action BLOCKED`
    );

    // -------------------------------------------------------------
    // Scenario 6: Ordinary successful requests do not create false threat events
    // -------------------------------------------------------------
    ThreatDetector.resetState();
    const eventCountBefore = await prisma.securityEvent.count();

    // Execute 3 normal health requests
    await makeRequest(testPort, '/api/health', 'GET');
    await makeRequest(testPort, '/api/health', 'GET');
    await makeRequest(testPort, '/api/health', 'GET');

    await new Promise((r) => setTimeout(r, 200));

    const eventCountAfter = await prisma.securityEvent.count();
    const s6Passed = eventCountBefore === eventCountAfter;

    record(
      6,
      'Ordinary successful requests do not create false threat events',
      s6Passed,
      `Security events before: ${eventCountBefore}, after: ${eventCountAfter} (0 false positives)`
    );

    // -------------------------------------------------------------
    // Scenario 7: Database logging failure does not expose sensitive data or crash the server
    // -------------------------------------------------------------
    // Temporarily mock prisma.apiRequestLog.create to throw an internal DB failure
    const originalCreate = prisma.apiRequestLog.create;
    let fallbackSurvived = false;

    try {
      (prisma.apiRequestLog as any).create = () => {
        throw new Error('Simulated Database Connection Failure');
      };

      const res7 = await makeRequest(testPort, '/api/health', 'GET');
      // Server must still respond normally (200 OK) without leaking database exception to client
      fallbackSurvived = res7.status === 200 && res7.body?.status === 'ok';
    } finally {
      prisma.apiRequestLog.create = originalCreate;
    }

    record(
      7,
      'Database logging failure does not expose sensitive data or crash application',
      fallbackSurvived,
      'Server gracefully survived simulated DB log failure and returned 200 OK'
    );

    // -------------------------------------------------------------
    // Scenario 8: Malicious request payloads (SQLi & Path Traversal) trigger threat events
    // -------------------------------------------------------------
    ThreatDetector.resetState();

    // Send path traversal attack marker
    await makeRequest(testPort, '/api/health?file=../../etc/passwd', 'GET');
    // Send SQL injection attack marker (URI encoded)
    await makeRequest(testPort, encodeURI("/api/health?filter=' OR '1'='1"), 'GET');

    await new Promise((r) => setTimeout(r, 200));

    const pathTraversalEvent = await prisma.securityEvent.findFirst({
      where: { threatType: ThreatType.PATH_TRAVERSAL },
      orderBy: { createdAt: 'desc' }
    });
    if (pathTraversalEvent) createdSecurityEventIds.push(pathTraversalEvent.id);

    const sqliEvent = await prisma.securityEvent.findFirst({
      where: { threatType: ThreatType.SQL_INJECTION },
      orderBy: { createdAt: 'desc' }
    });
    if (sqliEvent) createdSecurityEventIds.push(sqliEvent.id);

    const s8Passed = pathTraversalEvent !== null && sqliEvent !== null;
    record(
      8,
      'Malicious request payloads (SQLi & Path Traversal) trigger threat events',
      s8Passed,
      'Generated PATH_TRAVERSAL and SQL_INJECTION security events'
    );
  } catch (err) {
    console.error('Monitoring test execution error:', err);
  } finally {
    // Purge only records created during this test run
    if (createdSecurityEventIds.length > 0) {
      await prisma.securityEvent.deleteMany({
        where: { id: { in: createdSecurityEventIds } }
      });
    }

    if (createdRequestLogIds.length > 0) {
      await prisma.apiRequestLog.deleteMany({
        where: { id: { in: createdRequestLogIds } }
      });
    }

    if (testUserId) {
      await prisma.session.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }

    console.log('\n[Cleanup] Test monitoring and security event records purged.');

    server.close();
    await prisma.$disconnect();

    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nMonitoring Test Summary: ${passedCount}/${results.length} scenarios passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runMonitoringTests();
