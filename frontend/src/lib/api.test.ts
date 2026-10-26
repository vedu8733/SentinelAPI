import assert from 'node:assert';
import { api, API_BASE_URL } from './api';

async function runApiUnitTests() {
  console.log('=== Frontend API Client & Service Contract Test Suite ===\n');

  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedMethod = '';
  let interceptedHeaders: Record<string, string> = {};

  function setupMockFetch(mockResponse: any, status: number = 200) {
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      interceptedUrl = url.toString();
      interceptedMethod = init?.method || 'GET';
      interceptedHeaders = {};
      if (init?.headers) {
        const h = new Headers(init.headers);
        h.forEach((val, key) => {
          interceptedHeaders[key] = val;
        });
      }

      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => JSON.stringify(mockResponse)
      } as Response;
    }) as any;
  }

  const results: { name: string; passed: boolean; details: string }[] = [];

  function record(name: string, passed: boolean, details: string) {
    results.push({ name, passed, details });
    const tag = passed ? '[PASS]' : '[FAIL]';
    console.log(`${tag} ${name} -> ${details}`);
  }

  try {
    const testToken = 'mock-bearer-token-xyz';

    // -------------------------------------------------------------------------
    // Test 1: listServices dispatches GET /api/services with Bearer token
    // -------------------------------------------------------------------------
    setupMockFetch({
      services: [
        {
          id: 'svc-1',
          name: 'NexaCart Demo Store',
          slug: 'nexacart',
          description: 'E-commerce store',
          upstreamUrl: 'http://127.0.0.1:5001',
          isActive: true,
          totalRequests: 42,
          blockedThreats: 5,
          openIncidents: 1,
          totalIncidents: 2,
          createdAt: '2026-10-24T00:00:00.000Z',
          updatedAt: '2026-10-24T00:00:00.000Z'
        }
      ]
    });

    const servicesRes = await api.listServices(testToken);

    const t1Passed =
      interceptedUrl === `${API_BASE_URL}/api/services` &&
      interceptedMethod === 'GET' &&
      interceptedHeaders['authorization'] === `Bearer ${testToken}` &&
      servicesRes.services.length === 1 &&
      servicesRes.services[0].slug === 'nexacart' &&
      servicesRes.services[0].totalRequests === 42;

    record(
      'api.listServices request contract',
      t1Passed,
      `Target URL: ${interceptedUrl}, Auth: ${interceptedHeaders['authorization']}`
    );

    // -------------------------------------------------------------------------
    // Test 2: getService dispatches GET /api/services/:identifier
    // -------------------------------------------------------------------------
    setupMockFetch({
      service: {
        id: 'svc-1',
        name: 'NexaCart Demo Store',
        slug: 'nexacart',
        description: 'E-commerce store',
        upstreamUrl: 'http://127.0.0.1:5001',
        isActive: true,
        totalRequests: 42,
        blockedThreats: 5,
        openIncidents: 1,
        totalIncidents: 2,
        createdAt: '2026-10-24T00:00:00.000Z',
        updatedAt: '2026-10-24T00:00:00.000Z'
      }
    });

    const singleRes = await api.getService(testToken, 'nexacart');

    const t2Passed =
      interceptedUrl === `${API_BASE_URL}/api/services/nexacart` &&
      interceptedMethod === 'GET' &&
      singleRes.service.slug === 'nexacart';

    record(
      'api.getService by slug identifier contract',
      t2Passed,
      `Target URL: ${interceptedUrl}, Slug: ${singleRes.service.slug}`
    );

    // -------------------------------------------------------------------------
    // Test 3: listIncidents with serviceId filter
    // -------------------------------------------------------------------------
    setupMockFetch({
      incidents: [
        {
          id: 'inc-1',
          serviceId: 'svc-1',
          service: { id: 'svc-1', name: 'NexaCart Demo Store', slug: 'nexacart' },
          title: '[SQL_INJECTION] Test Alert',
          description: 'SQLi detected',
          severity: 'CRITICAL',
          status: 'DETECTED',
          sourceIp: '127.0.0.1',
          detectedAt: '2026-10-24T00:00:00.000Z',
          resolvedAt: null,
          createdAt: '2026-10-24T00:00:00.000Z',
          updatedAt: '2026-10-24T00:00:00.000Z',
          eventCount: 1,
          responseActionCount: 0
        }
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
    });

    const incidentsRes = await api.listIncidents(testToken, {
      page: 1,
      limit: 10,
      serviceId: 'svc-1',
      severity: 'CRITICAL'
    });

    const urlObj = new URL(interceptedUrl);
    const serviceIdParam = urlObj.searchParams.get('serviceId');
    const severityParam = urlObj.searchParams.get('severity');

    const t3Passed =
      serviceIdParam === 'svc-1' &&
      severityParam === 'CRITICAL' &&
      incidentsRes.incidents.length === 1 &&
      incidentsRes.incidents[0].service?.slug === 'nexacart';

    record(
      'api.listIncidents with serviceId filter parameter',
      t3Passed,
      `Query params: serviceId=${serviceIdParam}, severity=${severityParam}`
    );

    // -------------------------------------------------------------------------
    // Test 4: listSecurityEvents request and query parameter contract
    // -------------------------------------------------------------------------
    setupMockFetch({
      events: [
        {
          id: 'ev-1',
          threatType: 'SQL_INJECTION',
          severity: 'CRITICAL',
          actionTaken: 'BLOCKED',
          clientIp: '127.0.0.1',
          details: { path: '/api/gateway/nexacart/api/products?filter=1=1' },
          serviceId: 'svc-1',
          service: { id: 'svc-1', name: 'NexaCart Demo Store', slug: 'nexacart' },
          incidentId: 'inc-1',
          createdAt: '2026-10-24T00:00:00.000Z'
        }
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    });

    const eventsRes = await api.listSecurityEvents(testToken, {
      page: 1,
      limit: 20,
      serviceId: 'svc-1',
      actionTaken: 'BLOCKED'
    });

    const eventsUrl = new URL(interceptedUrl);
    const evServiceId = eventsUrl.searchParams.get('serviceId');
    const evAction = eventsUrl.searchParams.get('actionTaken');

    const t4Passed =
      eventsUrl.pathname === '/api/events' &&
      evServiceId === 'svc-1' &&
      evAction === 'BLOCKED' &&
      eventsRes.events.length === 1 &&
      eventsRes.events[0].threatType === 'SQL_INJECTION' &&
      eventsRes.events[0].actionTaken === 'BLOCKED';

    record(
      'api.listSecurityEvents request and filter contract',
      t4Passed,
      `Target URL: ${eventsUrl.pathname}, serviceId=${evServiceId}, actionTaken=${evAction}`
    );

    // -------------------------------------------------------------------------
    // Test 5: Unified error handling and status code propagation
    // -------------------------------------------------------------------------
    setupMockFetch(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is empty.'
        }
      },
      401
    );

    let errorCaught = false;
    let errorCode = '';
    try {
      await api.listServices('');
    } catch (err: any) {
      errorCaught = true;
      errorCode = err.code;
    }

    const t5Passed = errorCaught && errorCode === 'UNAUTHORIZED';
    record(
      'Unified API error response propagation',
      t5Passed,
      `Error caught with code: ${errorCode}`
    );

    // -------------------------------------------------------------------------
    // Test 6: listSecurityEvents with actionTaken=THROTTLED contract
    // -------------------------------------------------------------------------
    setupMockFetch({
      events: [
        {
          id: 'ev-rate-1',
          threatType: 'RATE_LIMIT_EXCEEDED',
          severity: 'MEDIUM',
          actionTaken: 'THROTTLED',
          clientIp: '127.0.0.1',
          details: { reason: 'Excessive requests: rate limit threshold exceeded' },
          serviceId: 'svc-nexacart',
          service: { id: 'svc-nexacart', name: 'NexaCart Demo Store', slug: 'nexacart' },
          incidentId: 'inc-rate-1',
          createdAt: '2026-10-24T00:00:00.000Z'
        }
      ],
      pagination: { page: 1, limit: 15, total: 1, totalPages: 1 }
    });

    const throttledEventsRes = await api.listSecurityEvents(testToken, {
      page: 1,
      limit: 15,
      serviceId: 'svc-nexacart',
      actionTaken: 'THROTTLED'
    });

    const throttledUrl = new URL(interceptedUrl);
    const t6Passed =
      throttledUrl.pathname === '/api/events' &&
      throttledUrl.searchParams.get('serviceId') === 'svc-nexacart' &&
      throttledUrl.searchParams.get('actionTaken') === 'THROTTLED' &&
      throttledEventsRes.events.length === 1 &&
      throttledEventsRes.events[0].threatType === 'RATE_LIMIT_EXCEEDED' &&
      throttledEventsRes.events[0].actionTaken === 'THROTTLED' &&
      throttledEventsRes.events[0].service?.slug === 'nexacart';

    record(
      'api.listSecurityEvents with actionTaken=THROTTLED contract',
      t6Passed,
      `Target URL: ${throttledUrl.pathname}, actionTaken=${throttledUrl.searchParams.get('actionTaken')}, service=${throttledEventsRes.events[0]?.service?.name}`
    );
  } finally {
    globalThis.fetch = originalFetch;
    const passedCount = results.filter((r) => r.passed).length;
    console.log(`\nAPI Client Test Summary: ${passedCount}/${results.length} tests passed.`);
    if (passedCount !== results.length) {
      process.exit(1);
    }
  }
}

runApiUnitTests();
