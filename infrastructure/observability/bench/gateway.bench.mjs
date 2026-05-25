// Gateway bench: route selection (10/100 providers) + isRetryable decision.
//
// Mirrors packages/ai-gateway/src/{routing.ts,retry.ts,errors.ts} so the
// bench is single-file runnable. If the production routing rules change
// (new policy filter, new tier shape), update both files.
//
// Two scenarios per run:
//   A) selectAdapter() across N=10 and N=100 adapter pools.
//   B) isRetryable() classification across {no-retry, retry-once,
//      retry-exhausted-equivalent} error shapes.

import { runBench, printReport, emitMachineReadable } from "./_runner.mjs";

// --- replicated errors + routing + retry ---

class NoRouteError extends Error {}
class NonRetryableProviderError extends Error {}
class RetryableProviderError extends Error {}

function selectAdapter(adapters, req, policy = {}) {
  if (adapters.length === 0) throw new NoRouteError("no adapters registered");
  let pool = adapters.slice();
  if (req.model !== undefined) {
    pool = pool.filter((a) => a.ref.model === req.model);
    if (pool.length === 0) throw new NoRouteError(`no adapter for model "${req.model}"`);
  }
  pool = pool.filter((a) => a.ref.tier === req.tier);
  if (pool.length === 0) throw new NoRouteError(`no adapter for tier "${req.tier}"`);
  if (policy.preferProvider !== undefined) {
    const f = pool.filter((a) => a.ref.provider === policy.preferProvider);
    if (f.length === 0) throw new NoRouteError("preferProvider not satisfied");
    pool = f;
  }
  if (policy.maxCostPer1kInput !== undefined) {
    const cap = policy.maxCostPer1kInput;
    pool = pool.filter((a) => a.ref.costPer1kInput !== undefined && a.ref.costPer1kInput <= cap);
    if (pool.length === 0) throw new NoRouteError("maxCostPer1kInput not satisfied");
  }
  if (policy.maxLatencyMs !== undefined) {
    const cap = policy.maxLatencyMs;
    pool = pool.filter((a) => a.ref.latencyMsP50 !== undefined && a.ref.latencyMsP50 <= cap);
    if (pool.length === 0) throw new NoRouteError("maxLatencyMs not satisfied");
  }
  return pool[0];
}

function isRetryable(err) {
  if (err instanceof NonRetryableProviderError) return false;
  if (err instanceof RetryableProviderError) return true;
  if (typeof err !== "object" || err === null) return true;
  const s = err.status;
  if (typeof s !== "number") return true;
  if (s === 408 || s === 429) return true;
  if (s >= 400 && s < 500) return false;
  return true;
}

// --- adapter fixtures ---

const PROVIDERS = ["anthropic", "openai", "google", "azure", "local"];
const TIERS = ["fast", "balanced", "frontier"];

function buildAdapters(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = {
      ref: {
        provider: PROVIDERS[i % PROVIDERS.length],
        model: `model-${i}`,
        tier: TIERS[i % TIERS.length],
        costPer1kInput: 0.5 + (i % 10) * 0.1,
        latencyMsP50: 80 + (i % 20),
      },
      complete: async () => ({ text: "", promptTokens: 0, completionTokens: 0 }),
    };
  }
  return out;
}

const ROUTE_SIZES = [10, 100];

const routeBench = await runBench({
  name: "gateway: selectAdapter (policy: cost+latency cap)",
  setup: (n) => {
    const adapters = buildAdapters(n);
    const req = { tenantId: "t", prompt: "hi", tier: "balanced", maxTokens: 256 };
    const policy = { maxCostPer1kInput: 1.5, maxLatencyMs: 95 };
    return { adapters, req, policy };
  },
  op: (ctx) => selectAdapter(ctx.adapters, ctx.req, ctx.policy),
  sizes: ROUTE_SIZES,
  warmupMs: 150,
  measureMs: 600,
});

// --- retry decision bench ---

const RETRY_CASES = [
  { label: "no-retry-4xx", make: () => Object.assign(new Error("bad req"), { status: 400 }) },
  { label: "retry-non-retryable-class", make: () => new NonRetryableProviderError("nope") },
  { label: "retry-429", make: () => Object.assign(new Error("rl"), { status: 429 }) },
  { label: "retry-5xx", make: () => Object.assign(new Error("oops"), { status: 503 }) },
  { label: "retry-network", make: () => new Error("ECONNRESET") },
];

const retryBench = await runBench({
  name: "gateway: isRetryable (mixed error shapes)",
  setup: (label) => {
    const def = RETRY_CASES.find((c) => c.label === label);
    return { make: def.make };
  },
  op: (ctx) => isRetryable(ctx.make()),
  sizes: RETRY_CASES.map((c) => c.label),
  warmupMs: 100,
  measureMs: 400,
});

const machine = process.argv.includes("--json");
if (machine) {
  emitMachineReadable(routeBench);
  emitMachineReadable(retryBench);
} else {
  printReport(routeBench);
  printReport(retryBench);
}
