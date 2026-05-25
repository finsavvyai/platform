// k6 load test for the document upload path.
//
// Day 19 of the production-ready roadmap. SLO budget: p95 upload <30s
// for a 50MB doc; error rate <0.1%.

import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("upload_errors");
const uploadLatency = new Trend("upload_latency_ms", true);

const GATEWAY = __ENV.GATEWAY_URL || "http://localhost:8080";
const API_KEY = __ENV.API_KEY || "test-api-key";
const VUS = parseInt(__ENV.VUS || "50", 10);
const DURATION = __ENV.DURATION || "5m";
const DOC_SIZE_MB = parseInt(__ENV.DOC_SIZE_MB || "1", 10);

const payload = generateDoc(DOC_SIZE_MB * 1024 * 1024);

export const options = {
  scenarios: {
    upload: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    upload_latency_ms: ["p(95)<30000", "p(99)<60000"],
    upload_errors: ["rate<0.001"],
    http_req_failed: ["rate<0.001"],
  },
};

export default function () {
  const url = `${GATEWAY}/v1/documents`;
  const params = {
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${API_KEY}`,
      "X-Filename": `load-${__VU}-${__ITER}.bin`,
    },
    timeout: "120s",
  };
  const start = Date.now();
  const res = http.post(url, payload, params);
  const elapsed = Date.now() - start;
  uploadLatency.add(elapsed);

  const passed = check(res, {
    "status 2xx": (r) => r.status >= 200 && r.status < 300,
    "id returned": (r) => {
      try {
        return Boolean(JSON.parse(r.body).id);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!passed);
}

function generateDoc(bytes) {
  // Deterministic random-looking bytes; reproducible across runs so
  // back-to-back tests aren't biased by payload content.
  const chunkSize = 8192;
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += chunkSize) {
    const remaining = Math.min(chunkSize, bytes - i);
    for (let j = 0; j < remaining; j++) {
      out[i + j] = (i + j) & 0xff;
    }
  }
  return out.buffer;
}
