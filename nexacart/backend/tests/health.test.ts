import http from 'http';
import { app } from '../src/app';

interface HttpResponse {
  status: number;
  body: any;
}

function makeRequest(port: number, path: string): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET'
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runHealthTest() {
  console.log('=== NexaCart Backend Health & Route Test Suite ===\n');
  const testPort = 5099;
  const server = app.listen(testPort, '127.0.0.1');

  try {
    // 1. Check /api/health
    const healthRes = await makeRequest(testPort, '/api/health');
    console.log(`[${healthRes.status === 200 ? 'PASS' : 'FAIL'}] Scenario 1: Health endpoint responds with 200 OK -> status: ${healthRes.body?.status}`);

    // 2. Check /api/products
    const prodRes = await makeRequest(testPort, '/api/products');
    console.log(`[${prodRes.status === 200 ? 'PASS' : 'FAIL'}] Scenario 2: Products endpoint responds with 200 OK -> total: ${prodRes.body?.total}`);

    // 3. Check 404 for unknown route
    const notFoundRes = await makeRequest(testPort, '/api/non-existent-route');
    console.log(`[${notFoundRes.status === 404 ? 'PASS' : 'FAIL'}] Scenario 3: Unknown route returns 404 NOT_FOUND`);

    const allPassed = healthRes.status === 200 && prodRes.status === 200 && notFoundRes.status === 404;
    console.log(`\nNexaCart Health Test: ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
    server.close();
    if (!allPassed) process.exit(1);
  } catch (err) {
    console.error('Test error:', err);
    server.close();
    process.exit(1);
  }
}

runHealthTest();
