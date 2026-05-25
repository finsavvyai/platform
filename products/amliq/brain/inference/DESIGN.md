# Brain ↔ Cluster Inference Bridge — Design

> Scope: `products/amliq/brain/inference/`.
> Owner: CLUSTER-BRIDGE (Brain Week 2 swarm).
> Status: Design v0.1.

## Decision being implemented

Decision #15 (cluster), user-resolved version: **Both.**

- `products/finsavvy-cluster/` remains the 9th CORE product. It owns its own
  tree, build, and release cadence (see `products/finsavvy-cluster/CLAUDE.md`).
- AMLIQ Brain **depends on** the cluster via an HTTP control-plane contract
  defined in this module. Brain does **not** import cluster code in-process.

This bridge is the *only* sanctioned coupling between Brain and Cluster.
Brain code that needs inference imports `@finsavvyai/amliq-brain/inference`;
it never imports `products/finsavvy-cluster/*`.

## Why HTTP, not direct lib import

1. **Process boundary.** Cluster is multi-node, leader-elected, runs on
   separate hosts (often the user's workstations). It is not a library;
   it is a service.
2. **Out-of-tree releaseability.** Cluster can be hosted by FinsavvyAI,
   self-hosted by the customer, or one day replaced by a vendor that ships
   the same wire format. None of those replacements are feasible behind a
   linker import.
3. **OpenAI shape is the industry interop pattern.** Most providers
   (vLLM, Ollama, Together, Anyscale, Groq, OpenRouter, Bedrock-via-proxy)
   ship an OpenAI-compatible Chat Completions endpoint. Matching that shape
   gives us provider-replaceability for free and matches what cluster will
   expose (cluster-side TODO §3 below).
4. **Round-2 rule.** `products/*` cannot import `@finsavvyai/*` directly;
   the same boundary discipline applies cluster-to-cluster.

## Request flow

```
agent (in Brain)
  └─ prompt + tools + tenant ctx
       └─ InferenceProvider.complete(req)        [interface, types.ts]
            └─ ClusterInferenceProvider          [cluster-provider.ts]
                 ├─ signs short-lived JWT (DI signer)
                 ├─ POST <clusterUrl>/v1/chat/completions
                 │     headers: Authorization: Bearer <jwt>
                 │     body:    OpenAI Chat Completions request
                 ├─ AbortController timeout (default 30s, configurable)
                 ├─ retry per ai-gateway pattern (5xx + 408/429 + network)
                 └─ map response → CompletionResponse
```

When local cluster is down (laptop closed, leader election in progress)
the agent layer should wrap the cluster provider in
`FallbackInferenceProvider` with a cloud provider as the fallback. The
fallback wrapper preserves the same `InferenceProvider` interface so
agents stay provider-agnostic.

## Auth model

- Brain issues a **short-lived JWT** (≤5 min, audience `cluster`) per
  inference call.
- Signer is **dependency-injected** (no key material baked into this
  module; matches AMLIQ no-secrets-in-image rule).
- Cluster verifies the JWT using a public key it pins out-of-band.
- JWT carries: `sub` (Brain tenant id), `aud` (`cluster`),
  `exp` (now + ≤300s), `iat`, `jti`, and a `scope` claim
  (`inference:complete`).

The cluster does not yet accept JWTs — it currently relies on its own
admin token. See cluster-side TODO §1.

## Idempotency + retry rules

Inference completion is treated as **non-idempotent by default** because
sampling is stochastic. We still retry on transport faults — request was
never delivered, no model work happened — but we do NOT retry once the
response stream has started.

Retry surface matches `packages/ai-gateway/src/retry.ts`:

| Failure | Retry? |
|---|---|
| `fetch` rejected (network) | yes |
| `AbortError` from timeout | yes |
| HTTP 5xx | yes |
| HTTP 408, 429 | yes |
| HTTP other 4xx | no |
| Parse error on response body | no (cluster contract bug, surface it) |

Default 3 attempts, decorrelated jitter, base 50ms, cap 2000ms. All
configurable via constructor.

## Streaming (out of scope for v0.1)

OpenAI's `stream: true` is intentionally rejected by the cluster provider
in v0.1 — keeps the response-mapping path small and lets us hit the
critical-path coverage bar. Streaming lands in a follow-up under the same
interface (`completeStream(req): AsyncIterable<Delta>`).

## File layout

```
inference/
├── DESIGN.md                 (this file)
├── README.md                 (bridge usage + cluster-side TODOs)
├── src/
│   ├── types.ts              (InferenceProvider + req/resp shapes)
│   ├── cluster-provider.ts   (ClusterInferenceProvider)
│   ├── fallback-provider.ts  (FallbackInferenceProvider)
│   └── index.ts              (re-exports)
└── src/
    ├── cluster-provider.test.ts
    └── fallback-provider.test.ts
```

All files ≤200 lines (portfolio rule). TS strict. No `any`.

## Cross-agent contracts honored

- **Mesh §2 (cluster bridge):** `InferenceProvider` interface lives in
  `inference/src/types.ts` as required. Talks to cluster via HTTP only.
- **Mesh §4 (health):** cluster-side TODO §3 wires `/health` per the
  round-3 mesh shape so Brain probes can include cluster liveness.
- **Round-2 rule:** no `@finsavvyai/*` imports in this module; signer is
  injected.
- **AMLIQ no-secrets rule:** JWT signer is DI, never bundled.

## Cluster-side TODOs (handoff)

See `products/finsavvy-cluster/CONSOLIDATION_TODO.md` (new section
"Bridge: Brain dependence"):

1. Accept Brain-issued JWT (audience `cluster`, scope
   `inference:complete`). Pin Brain's public key out-of-band.
2. Expose OpenAI-compatible `POST /v1/chat/completions` (non-streaming
   first, streaming in v0.2).
3. Expose `GET /health` per round-3 mesh contract §1 shape so Brain can
   include cluster as a health probe.
4. Publish cluster URL + Brain JWT public-key fingerprint into Brain's
   env-config docs (`FINSAVVY_CLUSTER_URL`,
   `FINSAVVY_CLUSTER_JWT_PUBKEY`).

## Open questions (deferred, not blocking v0.1)

- Per-tenant cluster pools vs single shared cluster — wait for first
  Brain Pro customer demand.
- Streaming protocol (SSE vs WebSocket vs chunked transfer) — pick once
  cluster decides what it natively serves.
- Model-routing hints (Brain passes a tier preference) — wait for
  cluster's routing DSL to stabilize (cluster CLAUDE.md TODO §5).
