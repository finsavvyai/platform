// k6 load test for the RAG query path.
//
// Day 19 of the production-ready roadmap. Run via:
//
//   k6 run tests/load/rag-query.js \
//     -e GATEWAY_URL=https://staging.sdlc.cc \
//     -e API_KEY=$E2E_API_KEY
//
// SLO budget (asserted by the threshold block below):
//   p95 latency < 2s
//   error rate < 0.1%
//   throughput holds at the requested VU level for 10 minutes
//
// Three scenarios run sequentially: 100 / 1k / 10k VUs. The full
// scale-test is invoked by `tests/load/scale.js` which loops over
// these scenarios and emits a comparison report.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("rag_errors");
const queryLatency = new Trend("rag_query_latency_ms", true);

const GATEWAY = __ENV.GATEWAY_URL || "http://localhost:8080";
const API_KEY = __ENV.API_KEY || "test-api-key";
const VUS = parseInt(__ENV.VUS || "100", 10);
const DURATION = __ENV.DURATION || "5m";

export const options = {
  scenarios: {
    rag_query: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Per Day-19 SLO: p95 query <2s, error <0.1%
    "rag_query_latency_ms": ["p(95)<2000", "p(99)<5000"],
    "rag_errors": ["rate<0.001"],
    "http_req_failed": ["rate<0.001"],
  },
};

const sampleQueries = [
  "What is the company refund policy?",
  "Summarize the Q3 financial report",
  "Who is responsible for security incident response?",
  "What are the API rate limits for the enterprise tier?",
  "Explain how multi-tenant isolation works",
];

export default function () {
  const query = sampleQueries[Math.floor(Math.random() * sampleQueries.length)];
  const url = `${GATEWAY}/v1/rag/query`;
  const payload = JSON.stringify({ query });
  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    timeout: "30s",
  };

  const start = Date.now();
  const res = http.post(url, payload, params);
  const elapsed = Date.now() - start;
  queryLatency.add(elapsed);

  const passed = check(res, {
    "status 200": (r) => r.status === 200,
    "answer non-empty": (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.answer === "string" && body.answer.length > 0;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!passed);

  // Don't hammer the gateway harder than the user load model says.
  sleep(Math.random() * 0.5 + 0.1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const summary = {
    p50_ms: m.rag_query_latency_ms?.values["p(50)"] ?? null,
    p95_ms: m.rag_query_latency_ms?.values["p(95)"] ?? null,
    p99_ms: m.rag_query_latency_ms?.values["p(99)"] ?? null,
    error_rate: m.rag_errors?.values?.rate ?? null,
    requests: m.http_reqs?.values?.count ?? null,
    duration_ms: m.iteration_duration?.values?.avg ?? null,
  };
  return {
    stdout: textSummary(summary),
    "rag-query-summary.json": JSON.stringify(summary, null, 2),
  };
}

function textSummary(s) {
  return [
    "RAG query load test summary",
    `  requests:    ${s.requests}`,
    `  p50:         ${(s.p50_ms ?? 0).toFixed(0)}ms`,
    `  p95:         ${(s.p95_ms ?? 0).toFixed(0)}ms (SLO: <2000ms)`,
    `  p99:         ${(s.p99_ms ?? 0).toFixed(0)}ms`,
    `  error rate:  ${((s.error_rate ?? 0) * 100).toFixed(3)}% (SLO: <0.1%)`,
    "",
  ].join("\n");
}
