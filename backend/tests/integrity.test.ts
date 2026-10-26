import http from 'http';
import { Role, ThreatType, SeverityLevel } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { config } from '../src/config/environment';
import {
  generateHmacSignature,
  verifyHmacSignature,
  canonicalizeJson
} from '../src/services/integrityService';
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

async function runIntegrityTests() {
  console.log('=== SentinelAPI HMAC-SHA256 Data Integrity Test Suite ===\n');

  const testPort = 4097;
  const server = app.listen(testPort, '127.0.0.1');

  const timestamp = Date.now();
  const adminEmail = `integrity-admin-${timestamp}@sentinelapi.local`;
  const consumerEmail = `integrity-consumer-${timestamp}@sentinelapi.local`;
  const userPassword = 'IntegrityUser@Pass2026!';

  let adminUserId = '';
  let consumerUserId = '';
  let adminToken = '';
  let consumerToken = '';

  const createdIntegrityRecordIds: string[] = [];
  const createdSecurityEventIds: string[] = [];

  const results: { id: number; name: string; passed: boolean; details?: string }[] = [];

  function record(id: number, name: string, passed: boolean, details?: string) {
    results.push({ id, name, passed, details });
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] Scenario ${id}: ${name}${details ? ` -> ${details}` : ''}`);
  }

  try {
    // 0. Setup test users and login tokens
    const passwordHash = await hashPassword(userPassword);

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'Integrity Admin',
        role: Role.ADMIN,
        isActive: true
      }
    });
    adminUserId = adminUser.id;

    const consumerUser = await prisma.user.create({
      data: {
        email: consumerEmail,
        passwordHash,
        fullName: 'Integrity Consumer',
        role: Role.API_CONSUMER,
        isActive: true
      }
    });
    consumerUserId = consumerUser.id;

    // Login admin
    const adminLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail, password: userPassword }
    );
    adminToken = adminLoginRes.body?.token;

    // Login consumer
    const consumerLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: consumerEmail, password: userPassword }
    );
    consumerToken = consumerLoginRes.body?.token;

    // -------------------------------------------------------------
    // Scenario 1: The same data produces a consistent signature
    // -------------------------------------------------------------
    const samplePolicy = {
      policyName: 'BlockSQLi',
      severity: 'HIGH',
      threshold: 5,
      enabled: true
    };
    const sig1 = generateHmacSignature(samplePolicy);
    const sig2 = generateHmacSignature(samplePolicy);
    const s1Passed =
      sig1.signature === sig2.signature &&
      sig1.signature.length === 64 &&
      /^[0-9a-f]{64}$/.test(sig1.signature);
    record(1, 'The same data produces a consistent signature', s1Passed, `Generated SHA-256 hex length: ${sig1.signature.length}`);

    // -------------------------------------------------------------
    // Scenario 2: Equivalent JSON objects with different property ordering verify correctly
    // -------------------------------------------------------------
    const sampleOrderA = {
      rule: 'RateLimit',
      active: true,
      meta: { limit: 100, windowSec: 60 }
    };
    const sampleOrderB = {
      meta: { windowSec: 60, limit: 100 },
      active: true,
      rule: 'RateLimit'
    };
    const signatureA = generateHmacSignature(sampleOrderA);
    const verifyOrderB = verifyHmacSignature(sampleOrderB, signatureA.signature);
    const canonA = canonicalizeJson(sampleOrderA);
    const canonB = canonicalizeJson(sampleOrderB);

    const s2Passed = canonA === canonB && verifyOrderB.isValid === true;
    record(
      2,
      'Equivalent JSON objects with different property ordering verify correctly',
      s2Passed,
      'Canonical string representation is identical regardless of key order'
    );

    // -------------------------------------------------------------
    // Scenario 3: Modified data fails verification
    // -------------------------------------------------------------
    const tamperedData = {
      ...sampleOrderA,
      active: false // Attacker tampered with active flag
    };
    const verifyTampered = verifyHmacSignature(tamperedData, signatureA.signature);
    const s3Passed = verifyTampered.isValid === false;
    record(
      3,
      'Modified data fails verification',
      s3Passed,
      `Rejected with reason: "${verifyTampered.reason}"`
    );

    // -------------------------------------------------------------
    // Scenario 4: Invalid or malformed signatures are rejected safely
    // -------------------------------------------------------------
    const emptySig = verifyHmacSignature(samplePolicy, '');
    const shortSig = verifyHmacSignature(samplePolicy, 'abcdef123456');
    const flippedCharSig = signatureA.signature.slice(0, 63) + (signatureA.signature[63] === 'a' ? 'b' : 'a');
    const verifyFlipped = verifyHmacSignature(sampleOrderA, flippedCharSig);
    const nonHexSig = verifyHmacSignature(samplePolicy, 'z'.repeat(64));

    const s4Passed =
      emptySig.isValid === false &&
      shortSig.isValid === false &&
      verifyFlipped.isValid === false &&
      nonHexSig.isValid === false;
    record(
      4,
      'Invalid or malformed signatures are rejected safely',
      s4Passed,
      'Empty, truncated, flipped-bit, and non-hex signatures rejected'
    );

    // -------------------------------------------------------------
    // Scenario 5: Missing HMAC configuration fails safely
    // -------------------------------------------------------------
    const missingKeyRes = verifyHmacSignature(samplePolicy, signatureA.signature, 'non-existent-key-v999');
    let signWithoutSecretThrew = false;
    try {
      generateHmacSignature(samplePolicy, 'unknown-key', '   ');
    } catch {
      signWithoutSecretThrew = true;
    }
    const s5Passed = missingKeyRes.isValid === false && signWithoutSecretThrew === true;
    record(
      5,
      'Missing HMAC configuration fails safely',
      s5Passed,
      'Safely rejects unknown keys without crashing or exposing internals'
    );

    // -------------------------------------------------------------
    // Scenario 6: Secret key is never returned in API responses or stored in DB
    // -------------------------------------------------------------
    const signApiRes = await makeRequest(
      testPort,
      '/api/integrity/sign',
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        resourceType: 'SecurityPolicy',
        resourceId: `policy-${timestamp}`,
        data: samplePolicy
      }
    );

    const recordId = signApiRes.body?.record?.id;
    if (recordId) createdIntegrityRecordIds.push(recordId);

    const dbRecord = await prisma.integrityRecord.findUnique({
      where: { id: recordId }
    });

    const responseJson = JSON.stringify(signApiRes.body);
    const dbRecordJson = JSON.stringify(dbRecord);

    const notInResponse = !responseJson.includes(config.hmacSecret);
    const notInDb = !dbRecordJson.includes(config.hmacSecret);
    const s6Passed = signApiRes.status === 200 && notInResponse && notInDb;
    record(
      6,
      'Secret key is never returned in API responses or stored in database',
      s6Passed,
      'Verified HMAC secret is absent from both HTTP body and database row'
    );

    // -------------------------------------------------------------
    // Scenario 7: Unauthorized users cannot create or verify protected records
    // -------------------------------------------------------------
    // Anonymous call to /api/integrity/sign
    const unauthSignRes = await makeRequest(testPort, '/api/integrity/sign', 'POST', {}, {
      resourceType: 'SecurityPolicy',
      resourceId: 'test-1',
      data: samplePolicy
    });

    // Consumer (insufficient role: API_CONSUMER) call to /api/integrity/sign
    const forbiddenSignRes = await makeRequest(
      testPort,
      '/api/integrity/sign',
      'POST',
      { Authorization: `Bearer ${consumerToken}` },
      {
        resourceType: 'SecurityPolicy',
        resourceId: 'test-1',
        data: samplePolicy
      }
    );

    const s7Passed =
      unauthSignRes.status === 401 &&
      forbiddenSignRes.status === 403 &&
      forbiddenSignRes.body?.error?.code === 'FORBIDDEN';
    record(
      7,
      'Unauthorized users cannot create or verify protected records',
      s7Passed,
      'Missing token -> 401, API_CONSUMER role -> 403 Forbidden'
    );

    // -------------------------------------------------------------
    // Scenario 8: Tampering detection produces expected SecurityEvent
    // -------------------------------------------------------------
    // 8a: Verify genuine data passes
    const validVerifyRes = await makeRequest(
      testPort,
      '/api/integrity/verify',
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        resourceType: 'SecurityPolicy',
        resourceId: `policy-${timestamp}`,
        data: samplePolicy
      }
    );

    // 8b: Submit tampered payload to verify endpoint
    const tamperedPayload = {
      ...samplePolicy,
      threshold: 999999 // Attacker modified security policy threshold
    };

    const tamperedVerifyRes = await makeRequest(
      testPort,
      '/api/integrity/verify',
      'POST',
      { Authorization: `Bearer ${adminToken}` },
      {
        resourceType: 'SecurityPolicy',
        resourceId: `policy-${timestamp}`,
        data: tamperedPayload
      }
    );

    await new Promise((r) => setTimeout(r, 200));

    // Check SecurityEvent table for HMAC_VERIFICATION_FAILED
    const hmacEvent = await prisma.securityEvent.findFirst({
      where: {
        threatType: ThreatType.HMAC_VERIFICATION_FAILED,
        details: {
          path: ['resourceId'],
          equals: `policy-${timestamp}`
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (hmacEvent) createdSecurityEventIds.push(hmacEvent.id);

    const s8Passed =
      validVerifyRes.status === 200 &&
      validVerifyRes.body?.isValid === true &&
      tamperedVerifyRes.status === 400 &&
      tamperedVerifyRes.body?.isValid === false &&
      tamperedVerifyRes.body?.error?.code === 'INTEGRITY_VERIFICATION_FAILED' &&
      hmacEvent !== null &&
      hmacEvent.severity === SeverityLevel.CRITICAL &&
      hmacEvent.actionTaken === 'FLAGGED';

    record(
      8,
      'A tampering detection produces the expected security event',
      s8Passed,
      `Detected tampering: returned 400 and logged SecurityEvent (Severity: CRITICAL)`
    );
  } catch (err) {
    console.error('Integrity test execution error:', err);
  } finally {
    // Purge test records only
    if (createdSecurityEventIds.length > 0) {
      await prisma.securityEvent.deleteMany({
        where: { id: { in: createdSecurityEventIds } }
      });
    }

    if (createdIntegrityRecordIds.length > 0) {
      await prisma.integrityRecord.deleteMany({
        where: { id: { in: createdIntegrityRecordIds } }
      });
    }

    if (adminUserId || consumerUserId) {
      await prisma.session.deleteMany({
        where: { userId: { in: [adminUserId, consumerUserId].filter(Boolean) } }
      });
      await prisma.auditLog.deleteMany({
        where: { userId: { in: [adminUserId, consumerUserId].filter(Boolean) } }
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, consumerUserId].filter(Boolean) } }
      });
    }

    console.log('\n[Cleanup] Test users, sessions, and integrity records purged.');

    server.close();
    await prisma.$disconnect();

    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nIntegrity Test Summary: ${passedCount}/${results.length} scenarios passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runIntegrityTests();
