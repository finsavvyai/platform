# `@finsavvyai/amliq-brain/inference`

Brain ↔ FinSavvy Cluster inference bridge. The single sanctioned coupling
between AMLIQ Brain and FinSavvy Cluster.

See `DESIGN.md` for the full rationale (decision #15 — "Both": cluster
stays a CORE product; Brain depends on it over HTTP, not in-process).

## What's in this module

| Export | Purpose |
|---|---|
| `InferenceProvider` | The interface Brain agents code against. |
| `ClusterInferenceProvider` | HTTP client for FinSavvy Cluster. OpenAI Chat Completions wire format. JWT auth via DI signer. Retries 5xx/408/429/network. |
| `FallbackInferenceProvider` | Sequential failover across providers. Used to wrap cluster + cloud for local-cluster-down scenarios. |
| `CompletionRequest`, `CompletionResponse`, `TokenUsage`, `ChatMessage`, `ChatTool` | Wire-shape types. |
| `JwtSigner` | Signer interface — DI only. No key material in this module. |
| `InferenceError` and subclasses | Typed errors for transport / provider / exhaustion failures. |

What is **not** here: streaming (v0.2), in-process cluster import (never
— violates the boundary), `@finsavvyai/*` runtime imports (round-2 rule),
real cluster URLs, real key material.

## Typical wiring

```ts
import {
  ClusterInferenceProvider,
  FallbackInferenceProvider,
  type InferenceProvider,
  type JwtSigner,
} from "@finsavvyai/amliq-brain/inference";

const signer: JwtSigner = host.makeJwtSigner(); // host wires keys
const cluster = new ClusterInferenceProvider({
  clusterUrl: process.env.FINSAVVY_CLUSTER_URL!,
  signer,
});

// Optional: wrap with cloud fallback for local-cluster-down resilience.
const cloud: InferenceProvider = host.makeCloudProvider();
const inference: InferenceProvider = new FallbackInferenceProvider({
  providers: [cluster, cloud],
  onAttemptError: (err) => telemetry.warn("inference_attempt_failed", { err }),
});

const res = await inference.complete({
  model: "qwen3-7b",
  messages: [{ role: "user", content: "Summarise this SAR draft..." }],
  tenantId: tenant.hash,
});
```

## Retry semantics

Matches `packages/ai-gateway/src/retry.ts`. Decorrelated jitter, base
50ms, cap 2000ms, 3 attempts by default. Retried: `fetch` rejection,
`AbortError` (timeout), HTTP 5xx, 408, 429. Not retried: any other 4xx,
JSON-parse errors.

Completion is treated as **non-idempotent**: we only retry while the
response stream has not started. Streaming will need a separate retry
strategy (out of scope for v0.1).

## Cluster-side TODOs (handoff to FinSavvy Cluster)

Tracked in `products/finsavvy-cluster/CONSOLIDATION_TODO.md` under
"Bridge: Brain dependence":

1. **JWT acceptance.** Cluster must accept Brain-issued JWTs (aud
   `cluster`, scope `inference:complete`). Brain's signing key is pinned
   out-of-band into cluster config.
2. **`POST /v1/chat/completions`.** OpenAI-compatible request/response
   shape. Non-streaming first; SSE streaming in v0.2.
3. **`GET /health`.** Round-3 mesh contract §1 shape so Brain can
   include cluster as a health probe.
4. **Env-config docs.** Publish `FINSAVVY_CLUSTER_URL` and the Brain
   JWT public-key fingerprint (`FINSAVVY_CLUSTER_JWT_PUBKEY`) into
   Brain's deploy docs.

Until these are done, the bridge is wire-only: shape locked, real
cluster traffic is gated behind cluster engineering completing §1-§3.

## Constraints honored

- 200-line file cap. TS strict. No `any`. No silent catches.
- No `@finsavvyai/*` imports. Signer is DI.
- No imports from `products/finsavvy-cluster/`. Out-of-process contract.
- No real cluster URLs in tests. Synthetic `https://cluster.test.invalid`.
- Critical paths (retry, fallback) targeted for 100% coverage; overall
  module targets the portfolio 90/85 line/branch baseline.

## Files

```
inference/
├── DESIGN.md
├── README.md
└── src/
    ├── types.ts              — public interface + errors + types
    ├── cluster-provider.ts   — HTTP impl
    ├── fallback-provider.ts  — sequential failover wrapper
    ├── http-internal.ts      — non-exported retry/wire helpers
    ├── index.ts              — public re-exports
    ├── cluster-provider.test.ts
    └── fallback-provider.test.ts
```
