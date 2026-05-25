# FinSavvy Cluster — Consolidation TODOs

> This file accumulates cross-agent handoff items. Append-only — each
> contributing agent adds a clearly-scoped section. Do not edit other
> agents' sections.

## Bridge: Brain dependence

Added by **CLUSTER-BRIDGE** (Brain Week 2 swarm, 2026-05-25).

Source of truth for the bridge contract:
`products/amliq/brain/inference/DESIGN.md` and
`products/amliq/brain/inference/README.md`.

Brain consumes cluster as a **separately-running HTTP service** (no
in-process import; round-2 boundary rule). For that to work, cluster
needs the following before Brain can flip from synthetic-test mode to
real cluster traffic in any environment.

### Must-do (release-blocking for Brain GA on cluster-backed tier)

1. **Accept Brain-issued JWT.**
   - Audience: `cluster`.
   - Scope: `inference:complete`.
   - TTL: ≤300s (Brain default 60s).
   - Verification: pin Brain's public key out-of-band into cluster
     config (`BRAIN_JWT_PUBKEY`). Reject expired, wrong-aud,
     wrong-scope, or unknown-issuer tokens with HTTP 401.
   - Constant-time signature comparison (matches AMLIQ security rules).

2. **Expose OpenAI-compatible `POST /v1/chat/completions`.**
   - Non-streaming response in v0.1 (Brain rejects `stream: true`
     intentionally).
   - Required request fields honored: `model`, `messages`,
     `temperature`, `top_p`, `max_tokens`, `stop`, `tools`,
     `tool_choice`.
   - Response must include `id`, `model`, `created`, `choices[]`,
     `usage{prompt_tokens, completion_tokens, total_tokens}`.
   - Error responses use standard HTTP semantics: 4xx for client
     faults (Brain will not retry), 5xx/408/429 for transient (Brain
     will retry with decorrelated jitter).

3. **Expose `GET /health`** per Brain Week 2 mesh contract §1 (and
   round-3 mesh contract §1) so Brain can include cluster as a probe in
   `/health.checks[]`. Shape:
   ```json
   {
     "status": "ok|degraded|down",
     "version": "x.y.z",
     "uptime_s": 12345,
     "checks": [ { "name": "model_router", "status": "ok" } ]
   }
   ```

4. **Publish env-config into Brain's deploy docs.**
   - `FINSAVVY_CLUSTER_URL` — base URL Brain's `ClusterInferenceProvider`
     points to.
   - `FINSAVVY_CLUSTER_JWT_PUBKEY` — Brain JWT verification public key
     pinned at cluster boot.
   - Note: these go into Brain's deploy docs (owned by BRAIN-SCAFFOLD);
     this TODO is the handoff trigger.

### Nice-to-have (post-GA)

- SSE streaming on `/v1/chat/completions` so Brain v0.2 can ship
  streaming agent responses.
- `/v1/models` listing so Brain can surface available routing tiers in
  the analyst console.
- Per-tenant quota enforcement keyed off the JWT `sub` claim.

### Why this matters

Without §1-§3 the bridge in `products/amliq/brain/inference/` will only
work against synthetic tests. The interface is locked and wire-tested,
but real traffic between Brain and Cluster is gated on cluster
engineering completing this section. Brain ships fallback-to-cloud
behavior so end users are not blocked while cluster catches up.
