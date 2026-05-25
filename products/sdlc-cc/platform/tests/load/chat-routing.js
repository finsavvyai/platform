// k6 load test for the /v1/chat path (BEAT-PLAN S1.2 + Day 50).
//
// Exercises:
//   - hard-cap pre-flight (spend.Check) before the upstream call
//   - routing classifier + Policy.Decide model selection
//   - FallbackChain provider routing (Day 49)
//
// Run:
//   k6 run tests/load/chat-routing.js \
//     -e GATEWAY_URL=https://staging.sdlc.cc \
//     -e API_KEY=$E2E_API_KEY
//
// SLOs (asserted by thresholds below):
//   p95 latency < 4s   (LLM round-trip dominates; routing overhead < 50ms)
//   error rate < 1%
//   sustained 200 VUs for 5 minutes
//
// X-Model-Tier mix mirrors the production headers we expect: 70% no
// header (lets Classify drive), 20% balanced, 10% premium.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("chat_error_rate");
const routingHeaderLatency = new Trend("routing_header_latency");

const GATEWAY_URL = __ENV.GATEWAY_URL || "https://staging.sdlc.cc";
const API_KEY = __ENV.API_KEY || "";

export const options = {
  scenarios: {
    chat_steady: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 50 },
        { duration: "1m", target: 200 },
        { duration: "5m", target: 200 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<4000", "p(99)<8000"],
    chat_error_rate: ["rate<0.01"],
  },
};

const PROMPTS = [
  "Summarise this paragraph in two bullets.",
  "Explain quicksort in one sentence.",
  "Translate 'good morning' to Spanish.",
  "What does HMAC stand for?",
  "Compose a 3-sentence email asking for a status update.",
];

const TIER_DISTRIBUTION = [
  ...Array(7).fill(""),         // 70% — no header, Classify drives
  ...Array(2).fill("balanced"), // 20%
  ...Array(1).fill("premium"),  // 10%
];

export default function () {
  const tier = TIER_DISTRIBUTION[Math.floor(Math.random() * TIER_DISTRIBUTION.length)];
  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
  if (tier) headers["X-Model-Tier"] = tier;

  const body = JSON.stringify({
    messages: [{ role: "user", content: prompt }],
    max_tokens: 128,
  });

  const t0 = Date.now();
  const res = http.post(`${GATEWAY_URL}/v1/chat`, body, { headers });
  const dt = Date.now() - t0;
  if (tier) routingHeaderLatency.add(dt, { tier });

  const ok = check(res, {
    "status 200/402": (r) => r.status === 200 || r.status === 402,
    "no 5xx": (r) => r.status < 500,
  });
  if (!ok) errorRate.add(1);
  else errorRate.add(0);

  // Light pacing so a single VU isn't pinning a connection at 100% RPS.
  sleep(0.5 + Math.random() * 1.5);
}

export function handleSummary(data) {
  return {
    "tests/load/results/chat-routing-summary.json": JSON.stringify(data, null, 2),
  };
}
