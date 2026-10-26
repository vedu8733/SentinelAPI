import http from 'http';
import { Role, ThreatType, SeverityLevel } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { hashPassword } from '../src/utils/security';

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

async function runEventsTests() {
  console.log('=== SentinelAPI Security Events Endpoint Test Suite ===\n');

  const testPort = 4097;
  const server = app.listen(testPort);

  const results: { scenario: number; name: string; passed: boolean; details: string }[] = [];
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  function record(scenario: number, name: string, passed: boolean, details: string) {
    results.push({ scenario, name, passed, details });
    const tag = passed ? '[PASS]' : '[FAIL]';
    console.log(`${tag} Scenario ${scenario}: ${name} -> ${details}`);
  }

  try {
    const timestamp = Date.now();

    // 1. Setup Test Admin User
    const adminPassword = 'AdminPass2026!';
    const adminEmail = `events-admin-${timestamp}@sentinelapi.local`;
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        fullName: 'Events Test Admin',
        role: Role.ADMIN,
        isActive: true
      }
    });
    createdUserIds.push(adminUser.id);

    const adminLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail, password: adminPassword }
    );
    const adminToken = adminLoginRes.body?.token;

    // 2. Setup Test Analyst User
    const analystPassword = 'AnalystPass2026!';
    const analystEmail = `events-analyst-${timestamp}@sentinelapi.local`;
    const analystUser = await prisma.user.create({
      data: {
        email: analystEmail,
        passwordHash: await hashPassword(analystPassword),
        fullName: 'Events Test Analyst',
        role: Role.SECURITY_ANALYST,
        isActive: true
      }
    });
    createdUserIds.push(analystUser.id);

    const analystLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: analystEmail, password: analystPassword }
    );
    const analystToken = analystLoginRes.body?.token;

    // 3. Setup Test Auditor User
    const auditorPassword = 'AuditorPass2026!';
    const auditorEmail = `events-auditor-${timestamp}@sentinelapi.local`;
    const auditorUser = await prisma.user.create({
      data: {
        email: auditorEmail,
        passwordHash: await hashPassword(auditorPassword),
        fullName: 'Events Test Auditor',
        role: Role.AUDITOR,
        isActive: true
      }
    });
    createdUserIds.push(auditorUser.id);

    const auditorLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: auditorEmail, password: auditorPassword }
    );
    const auditorToken = auditorLoginRes.body?.token;

    // 4. Setup Test Consumer User
    const consumerPassword = 'ConsumerPass2026!';
    const consumerEmail = `events-consumer-${timestamp}@sentinelapi.local`;
    const consumerUser = await prisma.user.create({
      data: {
        email: consumerEmail,
        passwordHash: await hashPassword(consumerPassword),
        fullName: 'Events Test Consumer',
        role: Role.API_CONSUMER,
        isActive: true
      }
    });
    createdUserIds.push(consumerUser.id);

    const consumerLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: consumerEmail, password: consumerPassword }
    );
    const consumerToken = consumerLoginRes.body?.token;

    // Fetch existing NexaCart ApiService
    const nexacartService = await prisma.apiService.findUnique({
      where: { slug: 'nexacart' }
    });

    if (!nexacartService) {
      throw new Error('NexaCart ApiService record not found in database.');
    }

    // -------------------------------------------------------------------------
    // Scenario 1: Authentication enforcement on GET /api/events
    // -------------------------------------------------------------------------
    const resNoAuth = await makeRequest(testPort, '/api/events');
    const resBadAuth = await makeRequest(testPort, '/api/events', 'GET', {
      Authorization: 'Bearer invalid.token.signature'
    });

    const s1Passed =
      resNoAuth.status === 401 &&
      resNoAuth.body?.error?.code === 'UNAUTHORIZED' &&
      resBadAuth.status === 401;

    record(
      1,
      'Authentication enforcement on GET /api/events',
      s1Passed,
      `No-auth returned ${resNoAuth.status}, bad-auth returned ${resBadAuth.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Role-based authorization on GET /api/events
    // -------------------------------------------------------------------------
    const resConsumer = await makeRequest(testPort, '/api/events', 'GET', {
      Authorization: `Bearer ${consumerToken}`
    });
    const resAnalyst = await makeRequest(testPort, '/api/events', 'GET', {
      Authorization: `Bearer ${analystToken}`
    });
    const resAuditor = await makeRequest(testPort, '/api/events', 'GET', {
      Authorization: `Bearer ${auditorToken}`
    });
    const resAdmin = await makeRequest(testPort, '/api/events', 'GET', {
      Authorization: `Bearer ${adminToken}`
    });

    const s2Passed =
      resConsumer.status === 403 &&
      resConsumer.body?.error?.code === 'FORBIDDEN' &&
      resAnalyst.status === 200 &&
      resAuditor.status === 200 &&
      resAdmin.status === 200;

    record(
      2,
      'Role-based authorization on GET /api/events',
      s2Passed,
      `Consumer: ${resConsumer.status} (403), Analyst: ${resAnalyst.status}, Auditor: ${resAuditor.status}, Admin: ${resAdmin.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Event ordering and pagination metadata
    // -------------------------------------------------------------------------
    const resPaginated = await makeRequest(
      testPort,
      '/api/events?page=1&limit=5',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const eventsList = resPaginated.body?.events;
    const pagination = resPaginated.body?.pagination;

    // Verify events are sorted descending by createdAt
    let isOrdered = true;
    if (Array.isArray(eventsList) && eventsList.length > 1) {
      for (let i = 0; i < eventsList.length - 1; i++) {
        if (new Date(eventsList[i].createdAt).getTime() < new Date(eventsList[i + 1].createdAt).getTime()) {
          isOrdered = false;
          break;
        }
      }
    }

    const s3Passed =
      resPaginated.status === 200 &&
      Array.isArray(eventsList) &&
      pagination?.page === 1 &&
      pagination?.limit === 5 &&
      typeof pagination?.total === 'number' &&
      typeof pagination?.totalPages === 'number' &&
      isOrdered;

    record(
      3,
      'Event ordering newest-first and pagination metadata',
      s3Passed,
      `Returned ${eventsList?.length} items, total: ${pagination?.total}, ordered: ${isOrdered}`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: Filter events by serviceId and verify service metadata
    // -------------------------------------------------------------------------
    const resServiceFilter = await makeRequest(
      testPort,
      `/api/events?serviceId=${nexacartService.id}&limit=10`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const nexaEvents = resServiceFilter.body?.events;
    const allMatchService =
      Array.isArray(nexaEvents) &&
      nexaEvents.length > 0 &&
      nexaEvents.every((e: any) => e.serviceId === nexacartService.id && e.service?.slug === 'nexacart');

    const s4Passed = resServiceFilter.status === 200 && allMatchService;

    record(
      4,
      'Filter events by serviceId with service metadata',
      s4Passed,
      `Returned ${nexaEvents?.length} events for NexaCart, all attributed correctly`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Filter events by threatType
    // -------------------------------------------------------------------------
    const resThreatFilter = await makeRequest(
      testPort,
      '/api/events?threatType=SQL_INJECTION&limit=10',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const sqliEvents = resThreatFilter.body?.events;
    const allMatchThreat =
      Array.isArray(sqliEvents) &&
      sqliEvents.length > 0 &&
      sqliEvents.every((e: any) => e.threatType === 'SQL_INJECTION');

    const s5Passed = resThreatFilter.status === 200 && allMatchThreat;

    record(
      5,
      'Filter events by threatType (SQL_INJECTION)',
      s5Passed,
      `Returned ${sqliEvents?.length} events, all matching threatType: SQL_INJECTION`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Filter events by actionTaken (BLOCKED)
    // -------------------------------------------------------------------------
    const resActionFilter = await makeRequest(
      testPort,
      '/api/events?actionTaken=BLOCKED&limit=10',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const blockedEvents = resActionFilter.body?.events;
    const allMatchAction =
      Array.isArray(blockedEvents) &&
      blockedEvents.length > 0 &&
      blockedEvents.every((e: any) => e.actionTaken?.toUpperCase() === 'BLOCKED');

    const s6Passed = resActionFilter.status === 200 && allMatchAction;

    record(
      6,
      'Filter events by actionTaken (BLOCKED)',
      s6Passed,
      `Returned ${blockedEvents?.length} events, all matching actionTaken: BLOCKED`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Malformed query parameters return 400 with consistent errors
    // -------------------------------------------------------------------------
    const resBadPage = await makeRequest(
      testPort,
      '/api/events?page=0',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );
    const resBadLimit = await makeRequest(
      testPort,
      '/api/events?limit=200',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );
    const resBadUuid = await makeRequest(
      testPort,
      '/api/events?serviceId=invalid-uuid',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );
    const resBadThreat = await makeRequest(
      testPort,
      '/api/events?threatType=UNKNOWN_ATTACK_VECTOR',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s7Passed =
      resBadPage.status === 400 &&
      resBadPage.body?.error?.code === 'INVALID_PARAMETER' &&
      resBadLimit.status === 400 &&
      resBadLimit.body?.error?.code === 'INVALID_PARAMETER' &&
      resBadUuid.status === 400 &&
      resBadUuid.body?.error?.code === 'INVALID_FILTER' &&
      resBadThreat.status === 400 &&
      resBadThreat.body?.error?.code === 'INVALID_FILTER';

    record(
      7,
      'Malformed query parameters return 400 with consistent error codes',
      s7Passed,
      `Bad page: ${resBadPage.status}, Bad limit: ${resBadLimit.status}, Bad UUID: ${resBadUuid.status}, Bad threat: ${resBadThreat.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Empty results handling
    // -------------------------------------------------------------------------
    const unusedUuid = '00000000-0000-4000-8000-000000000000';
    const resEmpty = await makeRequest(
      testPort,
      `/api/events?serviceId=${unusedUuid}`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s8Passed =
      resEmpty.status === 200 &&
      Array.isArray(resEmpty.body?.events) &&
      resEmpty.body.events.length === 0 &&
      resEmpty.body.pagination.total === 0;

    record(
      8,
      'Empty results handling returns clean 200 with empty array',
      s8Passed,
      `Returned ${resEmpty.body?.events?.length} events, pagination total: ${resEmpty.body?.pagination?.total}`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: Rate-limit event service attribution & actionTaken=THROTTLED filter
    // -------------------------------------------------------------------------
    const throttledEvent = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.RATE_LIMIT_EXCEEDED,
        severity: SeverityLevel.MEDIUM,
        clientIp: '192.168.10.99',
        serviceId: nexacartService.id,
        actionTaken: 'THROTTLED',
        details: {
          reason: 'Excessive requests: rate limit threshold exceeded',
          path: '/api/gateway/nexacart/api/products'
        }
      }
    });
    createdEventIds.push(throttledEvent.id);

    const resThrottled = await makeRequest(
      testPort,
      `/api/events?actionTaken=THROTTLED&serviceId=${nexacartService.id}`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const throttledEvents = resThrottled.body?.events;
    const foundThrottled =
      Array.isArray(throttledEvents) &&
      throttledEvents.some(
        (e: any) =>
          e.id === throttledEvent.id &&
          e.actionTaken === 'THROTTLED' &&
          e.serviceId === nexacartService.id &&
          e.service?.slug === 'nexacart'
      );

    const s9Passed = resThrottled.status === 200 && foundThrottled;

    record(
      9,
      'Rate-limit event service attribution & actionTaken=THROTTLED filter',
      s9Passed,
      `HTTP ${resThrottled.status}, found rate limit event attributed to NexaCart (${nexacartService.slug})`
    );
  } catch (err: any) {
    console.error('Events test execution runtime error:', err);
  } finally {
    if (createdEventIds.length > 0) {
      await prisma.securityEvent.deleteMany({
        where: { id: { in: createdEventIds } }
      });
    }

    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: createdUserIds } }
      });
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } }
      });
    }

    server.close();
    await prisma.$disconnect();

    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nSecurity Events Test Summary: ${passedCount}/${results.length} scenarios passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runEventsTests();
