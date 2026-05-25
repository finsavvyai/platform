# SPEC — @finsavvyai/ai-gateway

## Contract overview

This package is the canonical contract for two layers of AI traffic
handling: (1) the stateless **orchestrator** (`AiGateway`) — provider
routing, retries with decorrelated jitter, semantic LRU+TTL cache, and
token accounting; and (2) the **edge transport** — Cloudflare-Workers-shaped
JWT verification, sliding-window rate limiting, response cache, security
headers, and audit emission. Both layers are runtime-agnostic ESM and
fully typed. Because `products/*` cannot import `@finsavvyai/*` at runtime
(round-2 isolation), products mirror these shapes and error codes locally;
this spec is the canonical source they are validated against.

## Public surface

From `src/types.ts`:

- `Provider` — `"anthropic" | "openai" | "google" | "azure" | "local"`.
- `ModelTier` — `"fast" | "balanced" | "frontier"`.
- `ModelRef` — `{ provider, model, tier, costPer1kInput?, costPer1kOutput?,
  latencyMsP50? }`.
- `GatewayRequest` — `{ tenantId, prompt, tier, maxTokens, model?,
  cacheKey?, idempotencyKey? }`.
- `ProviderCallResult` — `{ text, promptTokens, completionTokens }`.
- `GatewayResponse` — `ProviderCallResult & { model, cached, attempts,
  inputTokens, outputTokens }`.
- `ProviderAdapter` interface (`ref`, `complete(req)`).
- `SemanticCache` interface (`get`, `set`, `size`).
- `RoutePolicy` — `{ maxCostPer1kInput?, maxLatencyMs?, preferProvider? }`.
- `RetryConfig` — `{ maxAttempts?, baseDelayMs?, maxDelayMs?, jitter?,
  sleep? }`.
- `TokenCounterSnapshot`.

From `src/index.ts` (orchestrator):

- `AiGateway` + `GatewayConfig`.
- `InMemorySemanticCache` + `CacheConfig`, `deriveCacheKey`.
- `TokenCounter`.
- `selectAdapter` (routing).
- `runWithRetry`, `isRetryable`, `backoffDelayMs` (retry primitives).
- Error classes: `NoRouteError`, `NonRetryableProviderError`,
  `RetryableProviderError`, `GatewayExhaustedError`.

From `src/edge/` (re-exported as `edge.*`):

- `createEdgeHandler(config)` — main Workers entry.
- `verifyJwt(token, opts)`, `signHs256(payload, secret)`.
- `extractAuth(request, opts)`, `clientIpOf(request)`.
- `RateLimiter`, `defaultKeyFor`.
- `EdgeResponseCache`, `buildEtag`.
- `InMemoryKvStore` (default `KvStore` impl).
- `securityHeaders`, `withHeaders`.
- `emitAudit`, `redact`.
- `parseCompletionBody`.

## Stable error codes

Orchestrator (carried on the error class `code` property):

- `AI_GATEWAY_NO_ROUTE` — selection produced an empty pool.
- `AI_GATEWAY_NON_RETRYABLE` — provider returned 4xx (except 408/429).
- `AI_GATEWAY_RETRYABLE` — provider returned 5xx / 408 / 429 / network.
- `AI_GATEWAY_EXHAUSTED` — retry budget consumed; carries `cause`.

Edge (carried on the response body and audit event):

- `AI_GATEWAY_EDGE_AUTH_MISSING` — no Bearer header.
- `AI_GATEWAY_EDGE_AUTH_INVALID` — JWT verify failed.
- `AI_GATEWAY_EDGE_RATE_LIMITED` — bucket exhausted.
- `AI_GATEWAY_EDGE_BAD_REQUEST` — completion body parse failure.

## Routes (edge)

| Route          | Method | Auth   | Behavior                                     |
|----------------|--------|--------|----------------------------------------------|
| `/health`      | GET    | none   | 200 `{"status":"ok"}` + security headers     |
| `/v1/complete` | POST   | Bearer | Body → `GatewayRequest` → `complete` → JSON  |
| `*`            | *      | -      | 404 `{"error":"not_found"}`                  |

## Invariants

1. **JWT alg is `HS256` only.** `verifyJwt` MUST reject any other `alg`,
   including `none`. This defeats alg-confusion attacks.
2. **`tenantId` comes from the verified JWT only.** Never from the request
   body, never from a header set by the client.
3. **Verification is constant-time.** `verifyJwt` uses `crypto.subtle`.
4. **Rate limiter is sliding-window** with KV-backed buckets. Corrupt KV
   payloads MUST be treated as empty, not as errors. Recovery is silent.
5. **Audit emitter redacts** Bearer tokens and JWT-shaped strings in reason
   fields before invoking the sink. Failure to redact is a security defect.
6. **Cache hits do NOT increment token counters.** Accounting is for billed
   provider calls only.
7. **Retry preserves `idempotencyKey`** across attempts (forwarded to
   provider so the provider can dedupe).
8. **4xx (except 408 / 429) short-circuits as non-retryable.**
9. **Retry uses decorrelated jitter** (Polly-style), capped at `maxDelayMs`.
10. **Edge errors carry stable codes.** Body shape: `{ error: <code>,
    message: <human> }`. The `error` field is the contract; `message` is
    free text and may change.
11. **Selection narrows in order:** model → tier → policy. Empty pool at
    any step throws `NoRouteError` with a reason explaining which filter
    emptied it.

## Test coverage gates

Critical paths (100% lines / branches / functions):

- `jwt.ts` `verifyJwt` and `signHs256` — alg enforcement, signature check.
- `rate-limit.ts` `RateLimiter` — bucket math, corruption recovery.
- `audit.ts` `emitAudit`, `redact` — redaction patterns.
- `retry.ts` `runWithRetry`, `isRetryable`, `backoffDelayMs` — retry
  classification and backoff.
- `routing.ts` `selectAdapter` — full selection algorithm.
- `cache.ts` `InMemorySemanticCache.get` / `.set` — eviction + TTL.
- `errors.ts` and `edge/errors.ts` — error code surface.

Other surfaces: ≥90% lines, ≥85% branches.

Headline coverage today: 178 tests; round-1 surfaces 100% across the four
metrics; edge layer 99.5% lines / 96.8% branches / 100% functions.

## Versioning policy

- Semver.
- Breaking changes:
  - renaming or removing an `AI_GATEWAY_*` code,
  - changing the JWT alg policy,
  - changing how `tenantId` is derived,
  - changing the rate-limit algorithm (sliding window → fixed window),
  - narrowing `Provider` / `ModelTier`,
  - changing route paths or response body shape.
- All breaking changes require:
  - major bump,
  - addendum in this file's `## Changelog`,
  - PRs against each known consumer to update mirrors.
- New optional `RoutePolicy` filters, new `ProviderAdapter` impls, new
  error subclasses with new codes are minor bumps.

## Known consumers

These code paths mirror types or behavior from this spec (no direct
import):

- `products/amliq/brain/services/api/src/` — has its own `AuthClaims`,
  `AuditRecord`, `AuditSink`, `AuditInput` structurally identical to the
  edge versions (round-2 boundary forces the duplication). High drift risk.
- `products/amliq/api/decision/src/server.ts` — also carries an `AuthClaims`
  mirror; same drift risk.
- `products/amliq/brain/services/api/src/rate-limit/` — has its own
  `RateLimitConfig` / `RateLimitDecision` mirror (M3-owned).
- `products/queryflux/openai-app/` — references the gateway surface
  conceptually but is on a different deployment path.

See `docs/quality/CANONICAL_SPEC.md` for the full inventory and drift checks.

## Cross-references

- `@finsavvyai/shared-types` SPEC defines `AuditEvent` / `AuditEventBase` —
  the edge `emitAudit` payload MUST satisfy that contract.
- `@finsavvyai/telemetry` is the canonical home for `AuditRecord` /
  `AuditSink`; the edge mirror exists only because the edge cannot import
  across the round-2 boundary.
- `@finsavvyai/policy-engine` SPEC defines `Policy` (authorization);
  `RoutePolicy` here is a *different* policy concept (provider routing).
  Do not unify the two.
- `@finsavvyai/auth` is the canonical home for principal claims; the edge
  `AuthResult` mirrors a subset for boundary-purity reasons.

## Migration path

If a future round carves out `@finsavvyai/ai-gateway` from the isolation
rule:

1. Add the carve-out clause to `docs/architecture/ISOLATION_RULES.md`,
   scoped per layer (edge vs orchestrator may carve out separately).
2. Start with the orchestrator (pure logic, easy to vendor). Edge layer
   carve-out depends on Workers deployment topology being stable.
3. Replace product-local mirrors of `AuthClaims`, `AuditRecord`,
   `AuditSink`, `AuditInput`, `RateLimitConfig` with `import type` from
   this package. Begin with `products/amliq/brain/services/api/src/`.
4. Keep `ProviderAdapter` impls in the product or in a separate package —
   they pull in vendor SDKs that the gateway intentionally avoids.
5. Add a CI guard that forbids product-local re-declarations of
   `verifyJwt`, the rate-limit algorithm, or `emitAudit`.
