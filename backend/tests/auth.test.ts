import http from 'http';
import { Role } from '@prisma/client';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { hashPassword, signToken } from '../src/utils/security';

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

async function runAuthAuditTests() {
  console.log('=== SentinelAPI Authentication Audit & Verification Suite ===\n');

  const testPort = 4099;
  const server = app.listen(testPort, '127.0.0.1');

  const timestamp = Date.now();
  const adminEmail = `test-admin-${timestamp}@sentinelapi.local`;
  const adminPassword = 'AdminPassword@2026!';
  const analystEmail = `test-analyst-${timestamp}@sentinelapi.local`;
  const analystPassword = 'AnalystPassword@2026!';

  let adminUserId = '';
  let analystUserId = '';

  const results: { id: number; name: string; passed: boolean; details?: string }[] = [];

  function record(id: number, name: string, passed: boolean, details?: string) {
    results.push({ id, name, passed, details });
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] Scenario ${id}: ${name}${details ? ` -> ${details}` : ''}`);
  }

  try {
    // Setup test users directly in DB
    const adminPassHash = await hashPassword(adminPassword);
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminPassHash,
        fullName: 'Audit Test Administrator',
        role: Role.ADMIN,
        isActive: true
      }
    });
    adminUserId = adminUser.id;

    const analystPassHash = await hashPassword(analystPassword);
    const analystUser = await prisma.user.create({
      data: {
        email: analystEmail,
        passwordHash: analystPassHash,
        fullName: 'Audit Test Analyst',
        role: Role.SECURITY_ANALYST,
        isActive: true
      }
    });
    analystUserId = analystUser.id;

    // -------------------------------------------------------------
    // Scenario 1: Correct credentials allow login
    // -------------------------------------------------------------
    const loginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail, password: adminPassword }
    );
    const adminToken = loginRes.body?.token;
    const loginUser = loginRes.body?.user;
    const s1Passed =
      loginRes.status === 200 &&
      typeof adminToken === 'string' &&
      adminToken.length > 20 &&
      loginUser?.email === adminEmail &&
      loginUser?.role === 'ADMIN' &&
      !('passwordHash' in (loginUser || {}));
    record(1, 'Correct credentials allow login', s1Passed, `Received JWT token and user profile`);

    // -------------------------------------------------------------
    // Scenario 2: Incorrect credentials return a generic authentication error
    // -------------------------------------------------------------
    const wrongPasswordRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail, password: 'WrongPassword!999' }
    );
    const nonExistentUserRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: 'ghost-user@sentinelapi.local', password: 'SomePassword!999' }
    );
    const s2Passed =
      wrongPasswordRes.status === 401 &&
      nonExistentUserRes.status === 401 &&
      wrongPasswordRes.body?.error?.message === 'Invalid email or password.' &&
      nonExistentUserRes.body?.error?.message === 'Invalid email or password.';
    record(
      2,
      'Incorrect credentials return a generic authentication error',
      s2Passed,
      'Both incorrect password and non-existent email return identical 401'
    );

    // -------------------------------------------------------------
    // Scenario 3: Invalid or missing input is rejected
    // -------------------------------------------------------------
    const emptyBodyRes = await makeRequest(testPort, '/api/auth/login', 'POST', {}, {});
    const malformedEmailRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: 'bad-email-format', password: 'password' }
    );
    const missingPasswordRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail }
    );
    const s3Passed =
      emptyBodyRes.status === 400 &&
      malformedEmailRes.status === 400 &&
      missingPasswordRes.status === 400 &&
      emptyBodyRes.body?.error?.code === 'BAD_REQUEST';
    record(
      3,
      'Invalid or missing input is rejected',
      s3Passed,
      'Empty body, invalid email format, and missing password return 400 Bad Request'
    );

    // -------------------------------------------------------------
    // Scenario 4: /api/auth/me rejects missing or invalid tokens
    // -------------------------------------------------------------
    const noHeaderRes = await makeRequest(testPort, '/api/auth/me', 'GET');
    const invalidHeaderRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: 'Basic invalid-basic-auth'
    });
    const malformedTokenRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: 'Bearer invalid.tampered.jwt.signature'
    });
    const s4Passed =
      noHeaderRes.status === 401 &&
      invalidHeaderRes.status === 401 &&
      malformedTokenRes.status === 401;
    record(
      4,
      '/api/auth/me rejects missing or invalid tokens',
      s4Passed,
      'Missing, non-Bearer, and forged tokens all return 401 Unauthorized'
    );

    // -------------------------------------------------------------
    // Scenario 5: A valid token can access /api/auth/me
    // -------------------------------------------------------------
    const meRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: `Bearer ${adminToken}`
    });
    const s5Passed =
      meRes.status === 200 &&
      meRes.body?.user?.id === adminUserId &&
      meRes.body?.user?.email === adminEmail &&
      meRes.body?.user?.role === 'ADMIN' &&
      !('passwordHash' in (meRes.body?.user || {}));
    record(
      5,
      'A valid token can access /api/auth/me',
      s5Passed,
      `Returned authenticated user ${meRes.body?.user?.email}`
    );

    // -------------------------------------------------------------
    // Scenario 6: Logout revokes the session
    // -------------------------------------------------------------
    const logoutRes = await makeRequest(testPort, '/api/auth/logout', 'POST', {
      Authorization: `Bearer ${adminToken}`
    });
    // Verify in database that session is revoked
    const revokedSession = await prisma.session.findFirst({
      where: { userId: adminUserId, revokedAt: { not: null } }
    });
    const s6Passed = logoutRes.status === 200 && Boolean(revokedSession);
    record(6, 'Logout revokes the session', s6Passed, 'Database session revokedAt updated');

    // -------------------------------------------------------------
    // Scenario 7: A revoked session cannot access protected endpoints
    // -------------------------------------------------------------
    const postLogoutMeRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: `Bearer ${adminToken}`
    });
    const s7Passed =
      postLogoutMeRes.status === 401 &&
      postLogoutMeRes.body?.error?.message === 'Session has been revoked.';
    record(
      7,
      'A revoked session cannot access protected endpoints',
      s7Passed,
      'Returned 401: Session has been revoked.'
    );

    // -------------------------------------------------------------
    // Scenario 8: Expired tokens or sessions are rejected
    // -------------------------------------------------------------
    // Part A: Expired JWT (signed with negative expiry)
    const expiredJwt = signToken(
      { sub: adminUserId, sessionId: 'dummy-session-id', role: 'ADMIN', email: adminEmail },
      '-1s'
    );
    const expiredJwtRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: `Bearer ${expiredJwt}`
    });

    // Part B: Valid JWT whose database session expiresAt is in the past
    const loginForExpiredSession = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail, password: adminPassword }
    );
    const tokenForExpiredDbSession = loginForExpiredSession.body?.token;
    // Force session expiration in DB
    await prisma.session.updateMany({
      where: { userId: adminUserId, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 10000) }
    });
    const expiredDbSessionRes = await makeRequest(testPort, '/api/auth/me', 'GET', {
      Authorization: `Bearer ${tokenForExpiredDbSession}`
    });

    const s8Passed =
      expiredJwtRes.status === 401 &&
      expiredJwtRes.body?.error?.message === 'Token has expired.' &&
      expiredDbSessionRes.status === 401 &&
      expiredDbSessionRes.body?.error?.message === 'Session has expired.';
    record(
      8,
      'Expired tokens or sessions are rejected',
      s8Passed,
      'Both expired JWT signature and expired DB session return 401'
    );

    // -------------------------------------------------------------
    // Scenario 9: Passwords are stored as hashes, not plaintext
    // -------------------------------------------------------------
    const dbAdmin = await prisma.user.findUnique({ where: { id: adminUserId } });
    const isArgon2 = dbAdmin?.passwordHash.startsWith('$argon2id$') ?? false;
    const notPlain = dbAdmin?.passwordHash !== adminPassword;
    const hasSaltAndParams = (dbAdmin?.passwordHash.length ?? 0) > 50;
    const s9Passed = isArgon2 && notPlain && hasSaltAndParams;
    record(
      9,
      'Passwords are stored as hashes, not plaintext',
      s9Passed,
      `Verified Argon2id format (${dbAdmin?.passwordHash.substring(0, 15)}...)`
    );

    // -------------------------------------------------------------
    // Scenario 10: Protected endpoints enforce the intended user role
    // -------------------------------------------------------------
    // Analyst logs in
    const analystLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: analystEmail, password: analystPassword }
    );
    const analystToken = analystLoginRes.body?.token;

    // Admin logs in afresh
    const freshAdminLoginRes = await makeRequest(
      testPort,
      '/api/auth/login',
      'POST',
      {},
      { email: adminEmail, password: adminPassword }
    );
    const freshAdminToken = freshAdminLoginRes.body?.token;

    // Analyst attempts to access /api/auth/admin-check -> must receive 403 Forbidden
    const analystRbacRes = await makeRequest(testPort, '/api/auth/admin-check', 'GET', {
      Authorization: `Bearer ${analystToken}`
    });

    // Admin attempts to access /api/auth/admin-check -> must receive 200 OK
    const adminRbacRes = await makeRequest(testPort, '/api/auth/admin-check', 'GET', {
      Authorization: `Bearer ${freshAdminToken}`
    });

    const s10Passed =
      analystRbacRes.status === 403 &&
      analystRbacRes.body?.error?.code === 'FORBIDDEN' &&
      adminRbacRes.status === 200;
    record(
      10,
      'Protected endpoints enforce the intended user role',
      s10Passed,
      'SECURITY_ANALYST returned 403 Forbidden, ADMIN returned 200 OK'
    );
  } catch (error) {
    console.error('Audit test suite runtime error:', error);
  } finally {
    // Clean up test records only
    if (adminUserId || analystUserId) {
      await prisma.session.deleteMany({
        where: { userId: { in: [adminUserId, analystUserId].filter(Boolean) } }
      });
      await prisma.auditLog.deleteMany({
        where: { userId: { in: [adminUserId, analystUserId].filter(Boolean) } }
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, analystUserId].filter(Boolean) } }
      });
      console.log('\n[Cleanup] Test-created user and session records purged.');
    }

    server.close();
    await prisma.$disconnect();

    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nAudit Summary: ${passedCount}/${results.length} scenarios passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runAuthAuditTests();
