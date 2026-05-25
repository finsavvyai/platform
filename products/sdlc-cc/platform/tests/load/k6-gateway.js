import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const latencyP95 = new Trend('latency_p95');
const requestCount = new Counter('total_requests');

// SLA targets
const SLA = {
  P95_LATENCY_MS: 500,
  P99_LATENCY_MS: 1000,
  ERROR_RATE: 0.01, // 1%
  AVAILABILITY: 0.999, // 99.9%
};

export const options = {
  scenarios: {
    // Steady-state: normal production traffic
    steady_state: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      exec: 'steadyState',
      startTime: '0s',
    },
    // Spike: sudden traffic burst
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 300,
      maxVUs: 500,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '10s', target: 200 }, // spike
        { duration: '1m', target: 200 },  // hold spike
        { duration: '10s', target: 10 },  // recover
        { duration: '1m', target: 10 },   // verify recovery
      ],
      exec: 'spikeTest',
      startTime: '6m',
    },
    // Soak: extended duration for memory leaks
    soak: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '15m',
      preAllocatedVUs: 50,
      maxVUs: 100,
      exec: 'soakTest',
      startTime: '9m',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${SLA.P95_LATENCY_MS}`, `p(99)<${SLA.P99_LATENCY_MS}`],
    error_rate: [`rate<${SLA.ERROR_RATE}`],
    http_req_failed: [`rate<${SLA.ERROR_RATE}`],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_TOKEN = __ENV.API_TOKEN || '';

// Production safeguard — see tests/load/k6-rag.js for context.
(function assertSafeTarget() {
  if (__ENV.ALLOW_PROD === '1') return;
  const safe = [
    /^https?:\/\/localhost(:\d+)?(\/|$)/i,
    /^https?:\/\/127\.0\.0\.1(:\d+)?(\/|$)/i,
    /^https?:\/\/.*\.staging\.sdlc\.ai(\/|$)/i,
    /^https?:\/\/.*\.load\.sdlc\.ai(\/|$)/i,
    /^https?:\/\/.*\.sdlc-staging\./i,
  ];
  if (!safe.some((re) => re.test(BASE_URL))) {
    throw new Error(
      `refusing to load-test ${BASE_URL}: not on the staging allowlist. ` +
      `Set ALLOW_PROD=1 to override.`
    );
  }
})();

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_TOKEN}`,
  'X-Tenant-ID': 'load-test-tenant',
  'X-Request-ID': `k6-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
};

// ─── Steady State Test ─────────────────────────
export function steadyState() {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/healthz`);
    check(res, {
      'health check 200': (r) => r.status === 200,
      'health check fast': (r) => r.timings.duration < 100,
    });
    errorRate.add(res.status >= 400);
    requestCount.add(1);
  });

  group('API Endpoints', () => {
    // GET /api/v1/documents
    const listRes = http.get(`${BASE_URL}/api/v1/documents?page=1&per_page=10`, { headers });
    check(listRes, {
      'list documents 200': (r) => r.status === 200,
      'list documents latency': (r) => r.timings.duration < SLA.P95_LATENCY_MS,
      'list documents has body': (r) => r.body && r.body.length > 0,
    });
    errorRate.add(listRes.status >= 400);
    latencyP95.add(listRes.timings.duration);
    requestCount.add(1);

    // POST /api/v1/query (RAG query)
    const queryRes = http.post(
      `${BASE_URL}/api/v1/query`,
      JSON.stringify({
        query: 'What are the security policies?',
        max_results: 5,
        include_sources: true,
      }),
      { headers, timeout: '10s' }
    );
    check(queryRes, {
      'RAG query status ok': (r) => r.status === 200 || r.status === 201,
      'RAG query latency': (r) => r.timings.duration < 2000,
    });
    errorRate.add(queryRes.status >= 400);
    latencyP95.add(queryRes.timings.duration);
    requestCount.add(1);
  });

  sleep(0.5);
}

// ─── Spike Test ────────────────────────────────
export function spikeTest() {
  const res = http.get(`${BASE_URL}/api/v1/documents?page=1&per_page=5`, { headers });
  check(res, {
    'spike: status ok': (r) => r.status === 200,
    'spike: not rate limited': (r) => r.status !== 429,
    'spike: latency acceptable': (r) => r.timings.duration < SLA.P99_LATENCY_MS,
  });
  errorRate.add(res.status >= 500);
  requestCount.add(1);
}

// ─── Soak Test ─────────────────────────────────
export function soakTest() {
  group('Soak - Mixed Workload', () => {
    // Read-heavy workload (80% reads, 20% writes)
    if (Math.random() < 0.8) {
      const res = http.get(`${BASE_URL}/api/v1/documents?page=1&per_page=10`, { headers });
      check(res, {
        'soak read: status ok': (r) => r.status === 200,
        'soak read: latency stable': (r) => r.timings.duration < SLA.P95_LATENCY_MS,
      });
      errorRate.add(res.status >= 400);
    } else {
      const res = http.post(
        `${BASE_URL}/api/v1/query`,
        JSON.stringify({ query: 'soak test query', max_results: 3 }),
        { headers }
      );
      check(res, {
        'soak write: status ok': (r) => r.status === 200 || r.status === 201,
      });
      errorRate.add(res.status >= 400);
    }
    requestCount.add(1);
  });

  sleep(0.2);
}

// ─── Summary Handler ───────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const errRate = data.metrics.error_rate?.values?.rate || 0;
  const totalReqs = data.metrics.total_requests?.values?.count || 0;

  const slaResults = {
    timestamp: new Date().toISOString(),
    sla_compliance: {
      p95_latency: { target: SLA.P95_LATENCY_MS, actual: p95, pass: p95 < SLA.P95_LATENCY_MS },
      p99_latency: { target: SLA.P99_LATENCY_MS, actual: p99, pass: p99 < SLA.P99_LATENCY_MS },
      error_rate: { target: SLA.ERROR_RATE, actual: errRate, pass: errRate < SLA.ERROR_RATE },
    },
    total_requests: totalReqs,
    overall_pass: p95 < SLA.P95_LATENCY_MS && p99 < SLA.P99_LATENCY_MS && errRate < SLA.ERROR_RATE,
  };

  return {
    'tests/load/results/summary.json': JSON.stringify(slaResults, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, opts) {
  const lines = [
    '\n════════════════════════════════════════════════',
    '  SDLC Platform Load Test Results',
    '════════════════════════════════════════════════\n',
  ];

  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const errRate = data.metrics.error_rate?.values?.rate || 0;

  lines.push(`  P95 Latency:  ${p95.toFixed(2)}ms (target: <${SLA.P95_LATENCY_MS}ms) ${p95 < SLA.P95_LATENCY_MS ? '✅' : '❌'}`);
  lines.push(`  P99 Latency:  ${p99.toFixed(2)}ms (target: <${SLA.P99_LATENCY_MS}ms) ${p99 < SLA.P99_LATENCY_MS ? '✅' : '❌'}`);
  lines.push(`  Error Rate:   ${(errRate * 100).toFixed(3)}% (target: <${SLA.ERROR_RATE * 100}%) ${errRate < SLA.ERROR_RATE ? '✅' : '❌'}`);
  lines.push('\n════════════════════════════════════════════════\n');

  return lines.join('\n');
}
