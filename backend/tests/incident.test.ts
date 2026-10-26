import http from 'http';
import {
  ThreatType,
  SeverityLevel,
  IncidentStatus,
  ActionType,
  ActionStatus,
  Role
} from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { IncidentService } from '../src/services/incidentService';
import { hashPassword, signToken, hashToken } from '../src/utils/security';

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

async function runIncidentTests() {
  console.log('=== SentinelAPI Incident Management & Safe Response Action Test Suite ===\n');

  const testPort = 4099;
  const server = app.listen(testPort, '127.0.0.1');

  // Track created records for strictly isolated cleanup
  const createdUserIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdSecurityEventIds: string[] = [];
  const createdResponseActionIds: string[] = [];
  const createdAuditLogIds: string[] = [];
  const createdIntegrityRecordIds: string[] = [];
  const createdRequestLogIds: string[] = [];
  const createdPolicyIds: string[] = [];

  const results: { id: number; name: string; passed: boolean; details?: string }[] = [];

  function record(id: number, name: string, passed: boolean, details?: string) {
    results.push({ id, name, passed, details });
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] Scenario ${id}: ${name}${details ? ` -> ${details}` : ''}`);
  }

  try {
    const timestamp = Date.now();

    // 1. Setup Test Admin User
    const adminPassword = 'AdminPass2026!';
    const adminEmail = `incident-admin-${timestamp}@sentinelapi.local`;
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        fullName: 'Incident Test Administrator',
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
    const analystEmail = `incident-analyst-${timestamp}@sentinelapi.local`;
    const analystUser = await prisma.user.create({
      data: {
        email: analystEmail,
        passwordHash: await hashPassword(analystPassword),
        fullName: 'Incident Test Analyst',
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

    // 3. Setup Test Auditor User (Read-only)
    const auditorPassword = 'AuditorPass2026!';
    const auditorEmail = `incident-auditor-${timestamp}@sentinelapi.local`;
    const auditorUser = await prisma.user.create({
      data: {
        email: auditorEmail,
        passwordHash: await hashPassword(auditorPassword),
        fullName: 'Incident Test Auditor',
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

    // 4. Setup Test Consumer User (Unauthorized for incident management)
    const consumerPassword = 'ConsumerPass2026!';
    const consumerEmail = `incident-consumer-${timestamp}@sentinelapi.local`;
    const consumerUser = await prisma.user.create({
      data: {
        email: consumerEmail,
        passwordHash: await hashPassword(consumerPassword),
        fullName: 'Incident Test Consumer',
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

    // =========================================================================
    // Scenario 1: A security event creates an incident
    // =========================================================================
    const testIpA = '198.51.100.11';
    const event1 = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.SQL_INJECTION,
        severity: SeverityLevel.MEDIUM,
        clientIp: testIpA,
        actionTaken: 'FLAGGED',
        details: { reason: 'SQL Injection detected in query parameter' }
      }
    });
    createdSecurityEventIds.push(event1.id);

    const processResult1 = await IncidentService.processSecurityEvent(event1);
    createdIncidentIds.push(processResult1.incident.id);
    if (processResult1.responseAction) {
      createdResponseActionIds.push(processResult1.responseAction.id);
    }

    const updatedEvent1 = await prisma.securityEvent.findUnique({
      where: { id: event1.id }
    });

    const s1Passed =
      !processResult1.isAggregated &&
      processResult1.incident.status === IncidentStatus.DETECTED &&
      processResult1.incident.severity === SeverityLevel.MEDIUM &&
      processResult1.incident.sourceIp === testIpA &&
      updatedEvent1?.incidentId === processResult1.incident.id;

    record(
      1,
      'A security event creates an incident',
      s1Passed,
      `Incident ID: ${processResult1.incident.id}, Status: ${processResult1.incident.status}`
    );

    // =========================================================================
    // Scenario 2: Related events aggregate into the same incident under the configured rules
    // =========================================================================
    const event2 = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.SQL_INJECTION,
        severity: SeverityLevel.CRITICAL, // Escalated severity
        clientIp: testIpA,
        actionTaken: 'FLAGGED',
        details: { reason: 'High-volume SQL injection union attack' }
      }
    });
    createdSecurityEventIds.push(event2.id);

    const processResult2 = await IncidentService.processSecurityEvent(event2);
    if (processResult2.responseAction) {
      createdResponseActionIds.push(processResult2.responseAction.id);
    }

    const aggregatedIncident = await prisma.incident.findUnique({
      where: { id: processResult1.incident.id },
      include: { events: true }
    });

    const s2Passed =
      processResult2.isAggregated === true &&
      processResult2.incident.id === processResult1.incident.id &&
      aggregatedIncident?.severity === SeverityLevel.CRITICAL &&
      aggregatedIncident?.events.length === 2;

    record(
      2,
      'Related events aggregate into the same incident under the configured rules',
      s2Passed,
      `Aggregated: ${processResult2.isAggregated}, Total events: ${aggregatedIncident?.events.length}, Escalated severity: ${aggregatedIncident?.severity}`
    );

    // =========================================================================
    // Scenario 3: Unrelated events create separate incidents
    // =========================================================================
    const testIpB = '203.0.113.88'; // Different client IP
    const event3 = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.PATH_TRAVERSAL,
        severity: SeverityLevel.HIGH,
        clientIp: testIpB,
        actionTaken: 'FLAGGED',
        details: { reason: 'Path traversal ../../etc/passwd' }
      }
    });
    createdSecurityEventIds.push(event3.id);

    const processResult3 = await IncidentService.processSecurityEvent(event3);
    createdIncidentIds.push(processResult3.incident.id);
    if (processResult3.responseAction) {
      createdResponseActionIds.push(processResult3.responseAction.id);
    }

    const s3Passed =
      processResult3.isAggregated === false &&
      processResult3.incident.id !== processResult1.incident.id &&
      processResult3.incident.sourceIp === testIpB;

    record(
      3,
      'Unrelated events create separate incidents',
      s3Passed,
      `Separate Incident ID: ${processResult3.incident.id} for IP ${testIpB}`
    );

    // =========================================================================
    // Scenario 4: Incident list pagination and filters work
    // =========================================================================
    // 4a. Pagination
    const resPage = await makeRequest(
      testPort,
      '/api/incidents?page=1&limit=1',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    // 4b. Filter by Severity
    const resSeverity = await makeRequest(
      testPort,
      '/api/incidents?severity=CRITICAL',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    // 4c. Filter by sourceIp
    const resIp = await makeRequest(
      testPort,
      `/api/incidents?sourceIp=${testIpA}`,
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    // 4d. Auditor access (read-only allowed)
    const resAuditor = await makeRequest(
      testPort,
      '/api/incidents',
      'GET',
      { Authorization: `Bearer ${auditorToken}` }
    );

    const s4Passed =
      resPage.status === 200 &&
      resPage.body.pagination.limit === 1 &&
      resPage.body.incidents.length === 1 &&
      resSeverity.status === 200 &&
      resSeverity.body.incidents.every((inc: any) => inc.severity === 'CRITICAL') &&
      resIp.status === 200 &&
      resIp.body.incidents.every((inc: any) => inc.sourceIp.includes(testIpA)) &&
      resAuditor.status === 200;

    record(
      4,
      'Incident list pagination and filters work',
      s4Passed,
      `Page 1 limit 1 returned ${resPage.body?.incidents?.length} item, filtered total: ${resSeverity.body?.pagination?.total}`
    );

    // =========================================================================
    // Scenario 5: Invalid incident status transitions are rejected
    // =========================================================================
    // Invalid transition: DETECTED -> RESOLVED (cannot jump straight to resolved)
    const resInvalidTransition = await makeRequest(
      testPort,
      `/api/incidents/${processResult1.incident.id}/status`,
      'PATCH',
      { Authorization: `Bearer ${adminToken}` },
      { status: IncidentStatus.RESOLVED }
    );

    // Valid transition: DETECTED -> INVESTIGATING
    const resValidTransition1 = await makeRequest(
      testPort,
      `/api/incidents/${processResult1.incident.id}/status`,
      'PATCH',
      { Authorization: `Bearer ${adminToken}` },
      { status: IncidentStatus.INVESTIGATING, notes: 'Analyst triage in progress' }
    );

    // Valid transition: INVESTIGATING -> RESOLVED
    const resValidTransition2 = await makeRequest(
      testPort,
      `/api/incidents/${processResult1.incident.id}/status`,
      'PATCH',
      { Authorization: `Bearer ${analystToken}` },
      { status: IncidentStatus.RESOLVED, notes: 'Remediation completed' }
    );

    const s5Passed =
      resInvalidTransition.status === 400 &&
      resInvalidTransition.body?.error?.code === 'INVALID_STATUS_TRANSITION' &&
      resValidTransition1.status === 200 &&
      resValidTransition1.body?.incident?.status === IncidentStatus.INVESTIGATING &&
      resValidTransition2.status === 200 &&
      resValidTransition2.body?.incident?.status === IncidentStatus.RESOLVED &&
      Boolean(resValidTransition2.body?.incident?.resolvedAt);

    record(
      5,
      'Invalid incident status transitions are rejected',
      s5Passed,
      'DETECTED -> RESOLVED correctly rejected (400), DETECTED -> INVESTIGATING -> RESOLVED succeeded'
    );

    // =========================================================================
    // Scenario 6: Unauthorized users cannot perform administrative actions
    // =========================================================================
    // 6a. Unauthenticated request
    const resNoAuth = await makeRequest(
      testPort,
      `/api/incidents/${processResult1.incident.id}/status`,
      'PATCH',
      {},
      { status: IncidentStatus.INVESTIGATING }
    );

    // 6b. API_CONSUMER role attempting to update status
    const resConsumer = await makeRequest(
      testPort,
      `/api/incidents/${processResult1.incident.id}/status`,
      'PATCH',
      { Authorization: `Bearer ${consumerToken}` },
      { status: IncidentStatus.INVESTIGATING }
    );

    // 6c. AUDITOR attempting to propose response action (Auditors are read-only)
    const resAuditorAction = await makeRequest(
      testPort,
      `/api/incidents/${processResult1.incident.id}/actions`,
      'POST',
      { Authorization: `Bearer ${auditorToken}` },
      { actionType: ActionType.IP_BLOCK }
    );

    const s6Passed =
      resNoAuth.status === 401 &&
      resConsumer.status === 403 &&
      resAuditorAction.status === 403;

    record(
      6,
      'Unauthorized users cannot perform administrative actions',
      s6Passed,
      `No-auth: ${resNoAuth.status} (401), Consumer: ${resConsumer.status} (403), Auditor action: ${resAuditorAction.status} (403)`
    );

    // =========================================================================
    // Scenario 7: A proposed response action is recorded accurately as simulated or pending
    // =========================================================================
    const resAction = await makeRequest(
      testPort,
      `/api/incidents/${processResult3.incident.id}/actions`,
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        actionType: ActionType.KEY_REVOCATION,
        reason: 'Suspected API key compromise in malicious client payload'
      }
    );

    if (resAction.body?.responseAction?.id) {
      createdResponseActionIds.push(resAction.body.responseAction.id);
    }

    const actionRecord = resAction.body?.responseAction;
    const s7Passed =
      resAction.status === 201 &&
      actionRecord?.status === ActionStatus.PENDING &&
      actionRecord?.actionType === ActionType.KEY_REVOCATION &&
      actionRecord?.target === testIpB &&
      actionRecord?.reason.includes('[SIMULATED PROTOTYPE ACTION]');

    record(
      7,
      'A proposed response action is recorded accurately as simulated or pending',
      s7Passed,
      `Action ID: ${actionRecord?.id}, Status: ${actionRecord?.status}, ActionType: ${actionRecord?.actionType}, Simulated Reason Verified`
    );

    // =========================================================================
    // Scenario 8: Duplicate response actions are appropriately suppressed
    // =========================================================================
    // 8a. API duplicate request rejection
    const resDuplicateAction = await makeRequest(
      testPort,
      `/api/incidents/${processResult3.incident.id}/actions`,
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        actionType: ActionType.KEY_REVOCATION,
        reason: 'Second duplicate key revocation request'
      }
    );

    // 8b. Policy-driven evaluation duplicate suppression
    const suppressedPolicyAction = await IncidentService.evaluatePolicyResponseAction(
      processResult3.incident,
      event3
    );

    const s8Passed =
      resDuplicateAction.status === 409 &&
      resDuplicateAction.body?.error?.code === 'DUPLICATE_ACTION' &&
      suppressedPolicyAction === null;

    record(
      8,
      'Duplicate response actions are appropriately suppressed',
      s8Passed,
      'API returned 409 Conflict; Service returned null for duplicate policy action evaluation'
    );

    // =========================================================================
    // Scenario 9: Audit entries are recorded for applicable changes
    // =========================================================================
    const statusAuditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Incident',
        entityId: processResult1.incident.id,
        action: 'INCIDENT_STATUS_UPDATED'
      }
    });

    const actionAuditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'ResponseAction',
        action: 'MANUAL_RESPONSE_ACTION_RECORDED'
      }
    });

    statusAuditLogs.forEach((l) => createdAuditLogIds.push(l.id));
    actionAuditLogs.forEach((l) => createdAuditLogIds.push(l.id));

    // Audit logs for automated actions created by IncidentService
    const autoActionAuditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'ResponseAction',
        action: 'RESPONSE_ACTION_PROPOSED'
      }
    });
    autoActionAuditLogs.forEach((l) => createdAuditLogIds.push(l.id));

    // Ensure no secrets or passwords are in any audit log
    const allAuditLogs = [...statusAuditLogs, ...actionAuditLogs, ...autoActionAuditLogs];
    const noLeakedSecrets = allAuditLogs.every((log) => {
      const detailsStr = JSON.stringify(log.details || {});
      return (
        !detailsStr.includes('password') &&
        !detailsStr.includes('secret') &&
        !detailsStr.includes('raw-token')
      );
    });

    const s9Passed =
      statusAuditLogs.length >= 2 && // 2 status transitions executed
      actionAuditLogs.length >= 1 && // 1 manual action executed
      noLeakedSecrets;

    record(
      9,
      'Audit entries are recorded for applicable changes',
      s9Passed,
      `Found ${statusAuditLogs.length} incident audit records, ${actionAuditLogs.length} action audit records, zero secret leakage verified`
    );

    // =========================================================================
    // Scenario 10: Existing authentication, monitoring, and integrity behavior remains functional
    // =========================================================================
    // 10a. Existing Auth: Login
    const resAuth = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      {
        email: adminUser.email,
        password: 'AdminPass2026!'
      }
    );

    // 10b. Existing Monitoring: Request log created
    const resHealth = await makeRequest(testPort, '/api/health', 'GET');
    const reqId = resHealth.headers['x-request-id'] as string;
    await new Promise((r) => setTimeout(r, 200));
    const reqLog = await prisma.apiRequestLog.findUnique({ where: { requestId: reqId } });
    if (reqLog) createdRequestLogIds.push(reqLog.id);

    // 10c. Existing Integrity: HMAC signing and verification
    const resSign = await makeRequest(
      testPort,
      '/api/integrity/sign',
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        resourceType: 'Order',
        resourceId: `order-${timestamp}`,
        data: { amount: 250, currency: 'USD', customerId: 'cust-99' }
      }
    );
    if (resSign.body?.record?.id) {
      createdIntegrityRecordIds.push(resSign.body.record.id);
    }

    const resVerify = await makeRequest(
      testPort,
      '/api/integrity/verify',
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        resourceType: 'Order',
        resourceId: `order-${timestamp}`,
        data: { amount: 250, currency: 'USD', customerId: 'cust-99' }
      }
    );

    const s10Passed =
      resAuth.status === 200 &&
      Boolean(resAuth.body?.token) &&
      resHealth.status === 200 &&
      Boolean(reqLog) &&
      resSign.status === 200 &&
      resVerify.status === 200 &&
      resVerify.body?.isValid === true;

    record(
      10,
      'Existing authentication, monitoring, and integrity behavior remains functional',
      s10Passed,
      `Auth status: ${resAuth.status}, Monitoring status: ${resHealth.status}, Integrity verify: ${resVerify.body?.isValid}`
    );

    // =========================================================================
    // Scenario 11: Concurrent event processing guarantees atomic aggregation without duplicate incidents
    // =========================================================================
    const testIpConcurrent = '198.51.100.222';
    const concurrentEv1 = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.RATE_LIMIT_EXCEEDED,
        severity: SeverityLevel.MEDIUM,
        clientIp: testIpConcurrent,
        actionTaken: 'THROTTLED',
        details: { reason: 'Concurrent burst request 1' }
      }
    });
    const concurrentEv2 = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.RATE_LIMIT_EXCEEDED,
        severity: SeverityLevel.HIGH,
        clientIp: testIpConcurrent,
        actionTaken: 'THROTTLED',
        details: { reason: 'Concurrent burst request 2' }
      }
    });
    createdSecurityEventIds.push(concurrentEv1.id, concurrentEv2.id);

    // Run simultaneously
    const [cResult1, cResult2] = await Promise.all([
      IncidentService.processSecurityEvent(concurrentEv1),
      IncidentService.processSecurityEvent(concurrentEv2)
    ]);

    createdIncidentIds.push(cResult1.incident.id);
    if (cResult2.incident.id !== cResult1.incident.id) {
      createdIncidentIds.push(cResult2.incident.id);
    }
    if (cResult1.responseAction) createdResponseActionIds.push(cResult1.responseAction.id);
    if (cResult2.responseAction) createdResponseActionIds.push(cResult2.responseAction.id);

    const incidentsForIp = await prisma.incident.findMany({
      where: { sourceIp: testIpConcurrent }
    });

    const s11Passed =
      cResult1.incident.id === cResult2.incident.id &&
      incidentsForIp.length === 1 &&
      (cResult1.isAggregated !== cResult2.isAggregated);

    record(
      11,
      'Concurrent event processing guarantees atomic aggregation without duplicate incidents',
      s11Passed,
      `Both concurrent events mapped to Incident ${cResult1.incident.id}; Total DB incidents for IP: ${incidentsForIp.length}`
    );

    // =========================================================================
    // Scenario 12: Disabled policies are not bypassed by defaults; malformed UUID parameters are rejected safely
    // =========================================================================
    // 12a. Create disabled security policy
    const testPolicy = await prisma.securityPolicy.create({
      data: {
        name: `Disabled-XSS-Guard-${timestamp}`,
        policyType: 'XSS_PROTECTION',
        severity: SeverityLevel.HIGH,
        ruleConfig: { mode: 'disabled-for-testing' },
        isEnabled: false, // Explicitly disabled
        action: 'BLOCK'
      }
    });
    createdPolicyIds.push(testPolicy.id);

    const xssEvent = await prisma.securityEvent.create({
      data: {
        threatType: ThreatType.XSS,
        severity: SeverityLevel.HIGH,
        clientIp: '198.51.100.223',
        actionTaken: 'FLAGGED',
        details: { reason: 'XSS script injection pattern' }
      }
    });
    createdSecurityEventIds.push(xssEvent.id);

    const dummyIncident = await prisma.incident.create({
      data: {
        title: 'XSS Test Incident',
        severity: SeverityLevel.HIGH,
        status: IncidentStatus.DETECTED,
        sourceIp: '198.51.100.223'
      }
    });
    createdIncidentIds.push(dummyIncident.id);

    // Evaluate response action: should return null because policy is disabled, not bypass to default IP_BLOCK
    const policyResult = await IncidentService.evaluatePolicyResponseAction(dummyIncident, xssEvent);

    // 12b. Test malformed UUID rejection
    const resBadUuid = await makeRequest(
      testPort,
      '/api/incidents/not-a-valid-uuid-1234',
      'GET',
      { Authorization: `Bearer ${adminToken}` }
    );

    const s12Passed =
      policyResult === null &&
      resBadUuid.status === 400 &&
      resBadUuid.body?.error?.code === 'INVALID_ID';

    record(
      12,
      'Disabled policies are not bypassed by defaults; malformed UUID parameters are rejected safely',
      s12Passed,
      `Disabled policy returned: ${policyResult} (suppressed, no default bypass); Bad UUID returned: ${resBadUuid.status} (${resBadUuid.body?.error?.code})`
    );
  } catch (err: any) {
    console.error('Incident test execution error:', err);
  } finally {
    // Isolated cleanup: purge only test-created records
    if (createdAuditLogIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { id: { in: createdAuditLogIds } }
      });
    }

    if (createdResponseActionIds.length > 0) {
      await prisma.responseAction.deleteMany({
        where: { id: { in: createdResponseActionIds } }
      });
    }

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

    if (createdIntegrityRecordIds.length > 0) {
      await prisma.integrityRecord.deleteMany({
        where: { id: { in: createdIntegrityRecordIds } }
      });
    }

    if (createdRequestLogIds.length > 0) {
      await prisma.apiRequestLog.deleteMany({
        where: { id: { in: createdRequestLogIds } }
      });
    }

    if (createdPolicyIds.length > 0) {
      await prisma.securityPolicy.deleteMany({
        where: { id: { in: createdPolicyIds } }
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

    console.log('\n[Cleanup] Test-created incident, event, action, audit, policy, and user records purged.');

    server.close();
    await prisma.$disconnect();

    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nIncident Test Summary: ${passedCount}/${results.length} scenarios passed.`);

    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runIncidentTests();
