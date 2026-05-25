// Deep-load scenarios for the RAG service. Covers three regimes:
//   1. ingest — bulk document upload simulating backfills
//   2. query_fanout — high concurrency semantic search
//   3. audit_write — append-only audit log write volume
//
// Run:
//   k6 run --env BASE_URL=https://rag.staging.sdlc.cc \
//          --env API_TOKEN=$STAGING_TOKEN \
//          tests/load/k6-rag.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const ingestErrors = new Rate('ingest_errors');
const ingestLatency = new Trend('ingest_latency_ms');
const queryErrors = new Rate('query_errors');
const queryLatency = new Trend('query_latency_ms');
const auditErrors = new Rate('audit_errors');
const auditCounter = new Counter('audit_writes_total');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8001';
const API_TOKEN = __ENV.API_TOKEN || '';
const TENANT = __ENV.LOAD_TENANT || 'load-test-tenant';

// Production safeguard: this script generates ~5K audit writes/s plus 1K
// concurrent query VUs and will DoS anything it's pointed at. Only allow
// localhost and explicitly-named staging/load hosts. Override with
// ALLOW_PROD=1 if you know what you're doing.
(function assertSafeTarget() {
  if (__ENV.ALLOW_PROD === '1') return;
  const safe = [
    /^https?:\/\/localhost(:\d+)?(\/|$)/i,
    /^https?:\/\/127\.0\.0\.1(:\d+)?(\/|$)/i,
    /^https?:\/\/rag\.staging\.sdlc\.cc(\/|$)/i,
    /^https?:\/\/rag\.load\.sdlc\.cc(\/|$)/i,
    /^https?:\/\/.*\.sdlc-staging\./i,
  ];
  const ok = safe.some((re) => re.test(BASE_URL));
  if (!ok) {
    throw new Error(
      `refusing to load-test ${BASE_URL}: not on the staging allowlist. ` +
      `Set ALLOW_PROD=1 to override (and own the outage you cause).`
    );
  }
})();

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_TOKEN}`,
  'X-Tenant-ID': TENANT,
};

export const options = {
  scenarios: {
    // Simulate backfill ingest: 200 docs/sec for 2m → 24K docs (extrapolates
    // to 1M docs in ~70 minutes of real load)
    ingest: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      exec: 'ingest',
      startTime: '0s',
    },
    // 1K concurrent RAG queries (proxy for 10K at full-fleet scale)
    query_fanout: {
      executor: 'constant-vus',
      vus: 1000,
      duration: '3m',
      exec: 'queryFanout',
      startTime: '2m30s',
    },
    // Audit write storm: 5K writes/sec (proxy for 100K/s multi-region)
    audit_write: {
      executor: 'constant-arrival-rate',
      rate: 5000,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 200,
      maxVUs: 800,
      exec: 'auditWrite',
      startTime: '5m45s',
    },
  },
  thresholds: {
    'ingest_errors': ['rate<0.02'],
    'query_errors': ['rate<0.01'],
    'audit_errors': ['rate<0.001'],
    'ingest_latency_ms': ['p(95)<2000'],
    'query_latency_ms': ['p(95)<800', 'p(99)<1500'],
  },
};

function randomDoc() {
  const id = `doc-${__VU}-${__ITER}-${Date.now()}`;
  return {
    id,
    title: `Load test doc ${id}`,
    body: 'The quick brown fox jumps over the lazy dog. '.repeat(40),
    metadata: { source: 'k6-rag', tenant: TENANT },
  };
}

export function ingest() {
  const res = http.post(`${BASE_URL}/v1/documents`, JSON.stringify(randomDoc()), {
    headers,
    timeout: '10s',
  });
  check(res, {
    'ingest 2xx': (r) => r.status >= 200 && r.status < 300,
    'ingest returns id': (r) => r.body && r.body.length > 0,
  });
  ingestErrors.add(res.status >= 400);
  ingestLatency.add(res.timings.duration);
}

const QUERIES = [
  'what are our data retention policies',
  'list all users with admin role',
  'summarize the Q1 compliance report',
  'find documents mentioning PII detection',
  'show recent security incidents',
];

export function queryFanout() {
  const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const res = http.post(
    `${BASE_URL}/v1/query`,
    JSON.stringify({ query: q, top_k: 10, include_sources: true }),
    { headers, timeout: '5s' },
  );
  check(res, {
    'query 2xx': (r) => r.status >= 200 && r.status < 300,
    'query has results': (r) => r.body && r.body.length > 0,
  });
  queryErrors.add(res.status >= 400);
  queryLatency.add(res.timings.duration);
  sleep(0.05);
}

export function auditWrite() {
  const res = http.post(
    `${BASE_URL}/v1/audit/events`,
    JSON.stringify({
      actor: `load-vu-${__VU}`,
      action: 'load.test.write',
      resource: 'document',
      resource_id: `doc-${__ITER}`,
      timestamp: new Date().toISOString(),
    }),
    { headers, timeout: '2s' },
  );
  check(res, { 'audit 2xx': (r) => r.status >= 200 && r.status < 300 });
  auditErrors.add(res.status >= 400);
  auditCounter.add(1);
}

export function handleSummary(data) {
  const pick = (name, field) => data.metrics[name]?.values?.[field] ?? 0;
  const summary = {
    timestamp: new Date().toISOString(),
    ingest: {
      p95_ms: pick('ingest_latency_ms', 'p(95)'),
      error_rate: pick('ingest_errors', 'rate'),
    },
    query: {
      p95_ms: pick('query_latency_ms', 'p(95)'),
      p99_ms: pick('query_latency_ms', 'p(99)'),
      error_rate: pick('query_errors', 'rate'),
    },
    audit: {
      writes: pick('audit_writes_total', 'count'),
      error_rate: pick('audit_errors', 'rate'),
    },
  };
  return {
    'tests/load/results/rag-summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2) + '\n',
  };
}
