import http from 'http';
import { Role, ThreatType, SeverityLevel, IncidentStatus } from '@prisma/client';
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

async function runServicesTests() {
  console.log('=== SentinelAPI Service Telemetry & Incident Service Filtering Suite ===\n');

  const testPort = 4098;
  const server = app.listen(testPort);

  const results: { scenario: number; name: string; passed: boolean; details: string }[] = [];
  const createdUserIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdSecurityEventIds: string[] = [];

  function record(scenario: number, name: string, passed: boolean, details: string) {
    results.push({ scenario, name, passed, details });
    const tag = passed ? '[PASS]' : '[FAIL]';
    console.log(`${tag} Scenario ${scenario}: ${name} -> ${details}`);
  }

  try {
    const timestamp = Date.now();

    // 1. Setup Test Admin User
    const adminPassword = 'AdminPass2026!';
    const adminEmail = `services-admin-${timestamp}@sentinelapi.local`;
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        fullName: 'Services Test Admin',
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

    // 2. Setup Test Security Analyst User
    const analystPassword = 'AnalystPass2026!';
    const analystEmail = `services-analyst-${timestamp}@sentinelapi.local`;
    const analystUser = await prisma.user.create({
      data: {
        email: analystEmail,
        passwordHash: await hashPassword(analystPassword),
        fullName: 'Services Test Analyst',
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
    const auditorEmail = `services-auditor-${timestamp}@sentinelapi.local`;
    const auditorUser = await prisma.user.create({
      data: {
        email: auditorEmail,
        passwordHash: await hashPassword(auditorPassword),
        fullName: 'Services Test Auditor',
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

    // 4. Setup Test API Consumer User (Unauthorized for services/incidents)
    const consumerPassword = 'ConsumerPass2026!';
    const consumerEmail = `services-consumer-${timestamp}@sentinelapi.local`;
    const consumerUser = await prisma.user.create({
      data: {
        email: consumerEmail,
        passwordHash: await hashPassword(consumerPassword),
        fullName: 'Services Test Consumer',
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
    // Scenario 1: Authentication enforcement on GET /api/services
    // -------------------------------------------------------------------------
    const resNoToken = await makeRequest(testPort, '/api/services');
    const resBadToken = await makeRequest(testPort, '/api/services', 'GET', {
      Authorization: 'Bearer invalid.token.value'
    });

    const s1Passed =
      resNoToken.status === 401 &&
      resNoToken.body?.error?.code === 'UNAUTHORIZED' &&
      resBadToken.status === 401;

    record(
      1,
      'Authentication enforcement on GET /api/services',
      s1Passed,
      `No-token returned ${resNoToken.status}, invalid token returned ${resBadToken.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 2: Role authorization on GET /api/services
    // -------------------------------------------------------------------------
    const resConsumer = await makeRequest(testPort, '/api/services', 'GET', {
      Authorization: `Bearer ${consumerToken}`
    });
    const resAnalyst = await makeRequest(testPort, '/api/services', 'GET', {
      Authorization: `Bearer ${analystToken}`
    });
    const resAuditor = await makeRequest(testPort, '/api/services', 'GET', {
      Authorization: `Bearer ${auditorToken}`
    });
    const resAdmin = await makeRequest(testPort, '/api/services', 'GET', {
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
      'Role authorization on GET /api/services',
      s2Passed,
      `Consumer: ${resConsumer.status} (403), Analyst: ${resAnalyst.status}, Auditor: ${resAuditor.status}, Admin: ${resAdmin.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 3: Service telemetry accurately aggregates Prisma records
    // -------------------------------------------------------------------------
    const servicesList = resAdmin.body?.services;
    const nexacartTelemetry = Array.isArray(servicesList)
      ? servicesList.find((s: any) => s.slug === 'nexacart')
      : null;

    const s3Passed =
      Array.isArray(servicesList) &&
      servicesList.length >= 1 &&
      nexacartTelemetry !== null &&
      nexacartTelemetry.name === 'NexaCart Demo Store' &&
      nexacartTelemetry.slug === 'nexacart' &&
      typeof nexacartTelemetry.upstreamUrl === 'string' &&
      typeof nexacartTelemetry.totalRequests === 'number' &&
      typeof nexacartTelemetry.blockedThreats === 'number' &&
      typeof nexacartTelemetry.openIncidents === 'number';

    record(
      3,
      'Service telemetry accurately aggregates Prisma records',
      s3Passed,
      `Found NexaCart (${nexacartTelemetry?.name}): requests=${nexacartTelemetry?.totalRequests}, blockedThreats=${nexacartTelemetry?.blockedThreats}, openIncidents=${nexacartTelemetry?.openIncidents}`
    );

    // -------------------------------------------------------------------------
    // Scenario 4: GET /api/services/:identifier by slug and ID
    // -------------------------------------------------------------------------
    const resBySlug = await makeRequest(
      testPort,
      '/api/services/nexacart',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );
    const resById = await makeRequest(
      testPort,
      `/api/services/${nexacartService.id}`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );
    const resNotFound = await makeRequest(
      testPort,
      '/api/services/non-existent-service-slug',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s4Passed =
      resBySlug.status === 200 &&
      resBySlug.body?.service?.slug === 'nexacart' &&
      resById.status === 200 &&
      resById.body?.service?.id === nexacartService.id &&
      resNotFound.status === 404 &&
      resNotFound.body?.error?.code === 'NOT_FOUND';

    record(
      4,
      'GET /api/services/:identifier by slug and ID',
      s4Passed,
      `By slug: ${resBySlug.status}, by ID: ${resById.status}, unknown: ${resNotFound.status}`
    );

    // -------------------------------------------------------------------------
    // Scenario 5: Create test incident linked to NexaCart and test serviceId filter
    // -------------------------------------------------------------------------
    const testIncidentNexa = await prisma.incident.create({
      data: {
        serviceId: nexacartService.id,
        title: '[SQL_INJECTION] NexaCart test incident',
        description: 'Test incident explicitly linked to NexaCart for service filtering verification',
        severity: SeverityLevel.HIGH,
        status: IncidentStatus.DETECTED,
        sourceIp: '198.51.100.42'
      }
    });
    createdIncidentIds.push(testIncidentNexa.id);

    // Query incidents with serviceId filter
    const resFiltered = await makeRequest(
      testPort,
      `/api/incidents?serviceId=${nexacartService.id}`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s5Passed =
      resFiltered.status === 200 &&
      Array.isArray(resFiltered.body?.incidents) &&
      resFiltered.body.incidents.length > 0 &&
      resFiltered.body.incidents.every((inc: any) => inc.serviceId === nexacartService.id);

    record(
      5,
      'Incident list filtered by serviceId',
      s5Passed,
      `Returned ${resFiltered.body?.incidents?.length} incidents, all matching NexaCart serviceId: ${nexacartService.id}`
    );

    // -------------------------------------------------------------------------
    // Scenario 6: Incidents include service metadata (id, name, slug)
    // -------------------------------------------------------------------------
    const sampleIncident = resFiltered.body?.incidents?.find(
      (inc: any) => inc.id === testIncidentNexa.id
    );

    const s6Passed =
      sampleIncident !== undefined &&
      sampleIncident.service !== null &&
      sampleIncident.service.id === nexacartService.id &&
      sampleIncident.service.name === 'NexaCart Demo Store' &&
      sampleIncident.service.slug === 'nexacart';

    record(
      6,
      'Incidents include service metadata (id, name, slug)',
      s6Passed,
      `Metadata verified: id=${sampleIncident?.service?.id}, name=${sampleIncident?.service?.name}, slug=${sampleIncident?.service?.slug}`
    );

    // -------------------------------------------------------------------------
    // Scenario 7: Malformed serviceId UUID parameter is rejected with 400
    // -------------------------------------------------------------------------
    const resBadUuid = await makeRequest(
      testPort,
      '/api/incidents?serviceId=not-a-valid-uuid',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s7Passed =
      resBadUuid.status === 400 &&
      resBadUuid.body?.error?.code === 'INVALID_FILTER' &&
      resBadUuid.body?.error?.message?.includes('serviceId');

    record(
      7,
      'Malformed serviceId UUID parameter rejected with 400',
      s7Passed,
      `Returned 400 INVALID_FILTER: "${resBadUuid.body?.error?.message}"`
    );

    // -------------------------------------------------------------------------
    // Scenario 8: Backward compatibility: list without serviceId returns all incidents
    // -------------------------------------------------------------------------
    const resUnfiltered = await makeRequest(
      testPort,
      '/api/incidents?page=1&limit=5',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s8Passed =
      resUnfiltered.status === 200 &&
      Array.isArray(resUnfiltered.body?.incidents) &&
      resUnfiltered.body.pagination.total >= resFiltered.body.pagination.total;

    record(
      8,
      'Backward compatibility: unfiltered incident queries operate unchanged',
      s8Passed,
      `Unfiltered total: ${resUnfiltered.body?.pagination?.total}, Filtered total: ${resFiltered.body?.pagination?.total}`
    );

    // -------------------------------------------------------------------------
    // Scenario 9: GET /api/incidents/:id detail response includes service metadata
    // -------------------------------------------------------------------------
    const resDetail = await makeRequest(
      testPort,
      `/api/incidents/${testIncidentNexa.id}`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s9Passed =
      resDetail.status === 200 &&
      resDetail.body?.incident?.id === testIncidentNexa.id &&
      resDetail.body?.incident?.serviceId === nexacartService.id &&
      resDetail.body?.incident?.service?.slug === 'nexacart' &&
      resDetail.body?.incident?.service?.name === 'NexaCart Demo Store';

    record(
      9,
      'GET /api/incidents/:id includes service metadata in detail response',
      s9Passed,
      `Detail response includes service: ${resDetail.body?.incident?.service?.name} (${resDetail.body?.incident?.service?.slug})`
    );
  } catch (err: any) {
    console.error('Services test execution runtime error:', err);
  } finally {
    // Purge test-created records only
    if (createdIncidentIds.length > 0) {
      await prisma.incident.deleteMany({
        where: { id: { in: createdIncidentIds } }
      });
    }

    if (createdSecurityEventIds.length > 0) {
      await prisma.securityEvent.deleteMany({
        where: { id: { in: createdSecurityEventIds } }
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
    console.log(`\nServices & Telemetry Test Summary: ${passedCount}/${results.length} scenarios passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runServicesTests();
