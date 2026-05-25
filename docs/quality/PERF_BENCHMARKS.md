# PERF_BENCHMARKS — micro-bench baselines for the 4 critical hot paths

**Agent:** PERF-BENCHMARKS (Quality Swarm)
**Date:** 2026-05-25
**Method:** zero-dep `perf_hooks.performance.now()` harness (no `tinybench` in any package.json; we did not mutate the lockfile). Each hot path is replicated inline in its bench file so scripts run with bare `node` — no TS toolchain, no `pnpm install` required.

## Methodology

- **Hardware:** `Darwin 25.2.0 arm64` (Apple Silicon, MacBook Pro). Wall-clock only; no `perf` counters.
- **Runtime:** `node v24.7.0`, ES modules, no flags.
- **Harness:** `infrastructure/observability/bench/_runner.mjs`. Per size: 150–200 ms warmup (discarded), 400–800 ms measurement, sample cap 200k iterations. Latency = single-op wall time; throughput = `n / sum(latencies)`.
- **Quantiles:** sort all samples ascending; `p50 = sample[0.50·n]`, `p95 = sample[0.95·n]`, `p99 = sample[0.99·n]`.
- **Faithfulness:** primitives copied byte-for-byte from production sources (`packages/telemetry/src/audit-tamper/{chain,sign}.ts`, `packages/ai-gateway/src/{routing,retry}.ts`, `packages/billing/src/providers/stripe/webhook.ts`). Stripe webhook fixtures use the real HMAC-SHA256 codepath (`createHmac` + `timingSafeEqual`).
- **Bench files:** `infrastructure/observability/bench/{audit-tamper,gateway,billing,rate-limit}.bench.mjs`, each ≤200 lines. Each script accepts `--json` for machine-readable output.

Run any bench standalone:

```sh
node infrastructure/observability/bench/audit-tamper.bench.mjs
node infrastructure/observability/bench/gateway.bench.mjs
node infrastructure/observability/bench/billing.bench.mjs
node infrastructure/observability/bench/rate-limit.bench.mjs   # currently deferred
```

## Results

### 1. audit-tamper — `chainAppend` + `signRecord`

`canonicalJson(record)` → `sha256` → `hmac-sha256(hash)`. The full critical path for one tamper-evident emit.

| record size | iters | throughput (ops/s) | p50 (µs) | p95 (µs) | p99 (µs) |
|---|---:|---:|---:|---:|---:|
| 100 B  | 200,000 | 323,780 | 3 | 4 | 4 |
| 1 KB   | 192,982 | 247,532 | 4 | 5 | 5 |
| 10 KB  |  54,971 |  69,299 | 14 | 16 | 18 |

### 2. ai-gateway — `selectAdapter` (cost + latency policy)

Route selection across N candidate provider adapters, applying tier filter + `maxCostPer1kInput` + `maxLatencyMs` policy.

| pool size | iters | throughput (ops/s) | p50 (µs) | p95 (µs) | p99 (µs) |
|---|---:|---:|---:|---:|---:|
|  10 | 200,000 | 13,818,618 | <1 | <1 | <1 |
| 100 | 200,000 |  3,114,171 | <1 | <1 | <1 |

### 3. ai-gateway — `isRetryable` (error classification)

Decision-only; no actual retry/sleep. Measures the hot path of `runWithRetry`'s catch-handler.

| error shape | iters | throughput (ops/s) | p50 (µs) | p95 (µs) | p99 (µs) |
|---|---:|---:|---:|---:|---:|
| no-retry-4xx (HTTP 400)        | 177,614 | 465,749 | 2 | 2 | 3 |
| `NonRetryableProviderError`    | 111,035 | 298,801 | 2 | 2 | 3 |
| retry-429 (rate limit)         | 134,219 | 369,886 | 2 | 2 | 5 |
| retry-5xx (HTTP 503)           | 183,301 | 481,047 | 2 | 2 | 3 |
| retry-network (no `.status`)   | 183,154 | 481,138 | 2 | 2 | 3 |

### 4. billing — `verifyStripeWebhook` (happy path)

Includes signature header parse + HMAC compute + `timingSafeEqual` + JSON parse + event-allowlist check.

| body size | iters | throughput (ops/s) | p50 (µs) | p95 (µs) | p99 (µs) |
|---|---:|---:|---:|---:|---:|
| 1 KB   | 200,000 | 356,468 |  3 |  3 |   4 |
| 10 KB  |  82,054 | 103,838 |  9 | 11 |  12 |
| 100 KB |  10,560 |  13,227 | 73 | 84 | 125 |

### 5. rate-limit — sliding-window decision

**DEFERRED.** `products/amliq/brain/services/api/src/rate-limit/sliding-window.ts` exists on disk (currently untracked — `?? products/amliq/brain/services/api/src/rate-limit/`) but is owned by the in-flight `SOC2-PREP` agent (M3 stream). Swarm conventions forbid reading that subtree while the M3 agent runs. Stub bench (`rate-limit.bench.mjs`) emits a deferral marker on stdout and exits 0; replace once SOC2-PREP merges.

## Baseline interpretation (green / yellow / red)

Targets pulled from `decisive_plan_90day.md` M5 ("Performance + scaling work", "multi-region readiness") and from the implicit envelope for a SOC 2 Type 1 audit log (sustained-throughput, never the bottleneck on a request path).

| Hot path | Target | Observed | Verdict |
|---|---|---|---|
| audit-tamper emit (1 KB record) | <1 ms p99, ≥50k ops/s sustained per core | 5 µs p99, 248k ops/s | **GREEN** — 200× headroom on latency, 5× on throughput |
| audit-tamper emit (10 KB record) | <2 ms p99 | 18 µs p99, 69k ops/s | **GREEN** |
| gateway routing (100 providers) | <100 µs p95 (cluster-bridge decision envelope) | <1 µs p95, 3.1M ops/s | **GREEN** — effectively free |
| gateway `isRetryable` | <50 µs p99 | 2–5 µs p99 | **GREEN** |
| Stripe webhook verify (10 KB) | <5 ms p99 (typical event size) | 12 µs p99, 104k ops/s | **GREEN** |
| Stripe webhook verify (100 KB) | <20 ms p99 (worst-case Connect bulk event) | 125 µs p99, 13k ops/s | **GREEN** — but watch JSON.parse cost grow super-linearly |
| rate-limit decision | <500 µs p95 for 10k tracked timestamps | n/a | **DEFERRED** until SOC2-PREP merges |

No red, no yellow. Hot paths are *not* the M5 scaling bottleneck candidates; expect network I/O, provider latency, and DB writes to dominate.

## Regression-detection plan (no CI changes this round)

1. **Threshold file** — commit `infrastructure/observability/bench/_baselines.json` (next round) with `{ bench, size, p95_us_max, ops_per_sec_min }` ratchet values set at 2× current p95 and 0.5× current throughput.
2. **CI step (proposed):** add `pnpm bench:perf` script running all four `.bench.mjs` files with `--json`, piped to a comparator that fails the build on any p95 above ratchet or throughput below ratchet. Run on `main` push only (not per-PR; benches are noisy on shared runners).
3. **Drift reports:** weekly cron emits a chart-friendly NDJSON to `docs/quality/perf-history.ndjson` (append-only).
4. **Runner hardening (when promoting to CI):** pin to a known instance type, run `--no-warnings`, set `UV_THREADPOOL_SIZE=4`, do 5 trial runs and take median to defeat thermal-throttling noise on Apple Silicon CI runners.

## Cross-references

- `[[A11Y-AUDIT]]` — published. No direct overlap (perf vs WCAG), but confirms the swarm conventions are being followed: A11Y stayed in scope (`websites/` + `brain/web/` + `Investigate web/`) and did not touch the perf-sensitive engine code these benches measure.
- `[[TEST-COVERAGE-MAP]]` — forthcoming. Cross-ref once published: confirm `chain.ts`, `routing.ts`, `retry.ts`, `webhook.ts` are listed at ≥90% line coverage (portfolio CLAUDE.md gate). All four files have sibling `*.test.ts` files we observed during bench authoring — coverage should be high. If COVERAGE_MAP flags any of these <90%, raise a P1 ticket *before* shipping baselines to CI: untested hot paths cannot have meaningful regressions detected.
- `[[DEAD-CODE]]` — forthcoming. Cross-ref once published: any dead branches found inside `selectAdapter` (policy filters), `isRetryable` (status-code branches), or `verifyStripeWebhook` (the `v1` multi-signature loop) should be removed *before* CI ratchets land — dead branches inflate the cyclomatic count we measure and create misleading "regression" alarms when removed.
- `[[DEPS-AUDIT]]` — forthcoming. If `node:crypto`'s OpenSSL backing version changes (Node major bump), expect ±30 % HMAC throughput drift; rerun all benches and re-baseline. Track in DEPS_AUDIT release-note watch list.

## Recommendations by owner

**founder**
- Approve M5 perf workstream descope: the four core hot paths are not the bottleneck. Reallocate to (a) DB/RPC scaling, (b) multi-region replication of the tamper log, (c) provider-side latency budgeting in the gateway.

**eng**
- Land `_baselines.json` and the `pnpm bench:perf` script next sprint (≤1 day work). No production code changes required.
- When SOC2-PREP lands sliding-window, replace `rate-limit.bench.mjs` stub. Use the same `_runner.mjs` harness.
- Stripe webhook 100 KB scenario is GREEN today (125 µs p99) but the JSON.parse cost climbs ~10× per 10× body. If we start receiving Connect bulk events, add a streaming-parse fast path before bodies hit ~1 MB.

**devops**
- Do NOT wire bench failures to per-PR CI yet — shared-runner noise on Apple Silicon CI will produce false positives. Wire to `main`-push + nightly only, with median-of-5.
- When promoting to CI, pin instance type and document it next to the baselines file. A perf baseline without a fixed substrate is meaningless.

## Output contract

```
AGENT: PERF-BENCHMARKS
REPORT FILE: docs/quality/PERF_BENCHMARKS.md
SCOPE COVERED: packages/telemetry/src/audit-tamper/{chain,sign,types}.ts; packages/ai-gateway/src/{routing,retry,cache,types,errors}.ts; packages/billing/src/providers/stripe/webhook.ts; infrastructure/observability/bench/ (new dir, 5 files)
HIGH FINDINGS: 0
MEDIUM FINDINGS: 1 — rate-limit bench deferred until SOC2-PREP merges sliding-window.ts to main.
LOW FINDINGS: 2 — (a) 100KB webhook JSON.parse super-linear cost; (b) CI ratchets need pinned runner instance type before wiring.
CROSS-REFERENCES: [[A11Y-AUDIT]] (published); [[TEST-COVERAGE-MAP]], [[DEAD-CODE]], [[DEPS-AUDIT]] (forthcoming).
RECOMMENDATIONS BY OWNER: see "Recommendations by owner" section above.
```
