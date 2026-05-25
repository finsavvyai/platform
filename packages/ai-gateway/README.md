# @finsavvyai/ai-gateway

AI gateway with two layers, both ESM, both runtime-agnostic, both fully typed.

## Layer 1 — orchestrator (round 1)

Stateless provider routing, retries, semantic cache, token accounting.

Exports `AiGateway`, `InMemorySemanticCache`, `TokenCounter`, `selectAdapter`,
`runWithRetry`, plus error types (`NoRouteError`, `NonRetryableProviderError`,
`RetryableProviderError`, `GatewayExhaustedError`) and the supporting types
(`ProviderAdapter`, `ModelRef`, `GatewayRequest`, `GatewayResponse`,
`SemanticCache`, `RoutePolicy`, `RetryConfig`).

Selection logic:

- Optional `model` match → narrow.
- Tier match → narrow.
- Policy filters (`preferProvider`, `maxCostPer1kInput`, `maxLatencyMs`) → narrow.
- Empty pool → `NoRouteError`.

Retry logic:

- Exponential backoff with decorrelated jitter.
- 4xx (except 408/429) short-circuits as non-retryable.
- Idempotency key preserved across attempts.

Cache logic:

- Bounded LRU + lazy TTL.
- Keyed by `(model, normalized_prompt_hash)`.
- Cache hits do **not** increment token counters.

## Layer 2 — edge transport (round 2, promoted from `portfolio/fintech-suite/api-gateway`)

Cloudflare-Workers-compatible primitives wrapping the orchestrator. Web Fetch
`Request`/`Response` only — no Hono coupling. Mount with
`app.all('*', toHandler(...))` if you want Hono, or use directly as a Workers
`fetch` handler.

```ts
import { AiGateway, edge } from "@finsavvyai/ai-gateway";

const gateway = new AiGateway({ adapters: [...] });
const handler = edge.createEdgeHandler({
  gateway,
  jwtSecret: env.JWT_SECRET,
  kv: env.RATE_LIMIT_KV,      // any KvStore-shaped binding
  rateLimit: { windowMs: 60_000, maxRequests: 60 },
  audit: (e) => console.log(JSON.stringify(e)),
  enableHsts: true,
});

export default { fetch: handler };
```

Edge surface today:

| Route               | Method | Auth     | Behavior                                                |
|---------------------|--------|----------|---------------------------------------------------------|
| `/health`           | GET    | none     | `200 {"status":"ok"}` + security headers                |
| `/v1/complete`      | POST   | Bearer   | Body → `GatewayRequest` → `AiGateway.complete` → JSON   |
| `*`                 | *      | -        | `404 {"error":"not_found"}`                             |

Hardening choices (deliberately stricter than the source):

- **JWT verify uses `crypto.subtle.verify`** (constant-time per spec). Source
  used `crypto.subtle.verify` too, but had inconsistent handling around
  alg/typ — we enforce `alg=HS256` strictly to defeat alg-confusion attacks.
- **Tenant id comes from the verified JWT only**, never from the request body.
- **Rate limiter is sliding-window** with KV-backed buckets and corruption
  recovery (corrupt KV payloads are treated as empty, not as errors).
- **Audit emitter redacts** Bearer tokens and JWT-shaped strings in reason
  fields before calling the sink.
- **Errors carry stable codes** (`AI_GATEWAY_EDGE_AUTH_*`,
  `AI_GATEWAY_EDGE_RATE_LIMITED`, `AI_GATEWAY_EDGE_BAD_REQUEST`).

Edge exports (via `edge.*`):

- `createEdgeHandler(config)` — main entry.
- `verifyJwt(token, opts)`, `signHs256(payload, secret)`.
- `extractAuth(request, opts)`, `clientIpOf(request)`.
- `RateLimiter`, `defaultKeyFor`.
- `EdgeResponseCache`, `buildEtag`.
- `InMemoryKvStore` (default `KvStore`).
- `securityHeaders`, `withHeaders`.
- `emitAudit`, `redact`.
- `parseCompletionBody`.

## What's intentionally NOT here

- **D1 migrations.** The gateway primitive is stateless. See
  `migrations/README.md`. PipeWarden's 552 lines of product schema belong
  with the PipeWarden product, not here.
- **Hono routes for the PipeWarden domain** (`/api/pipelines`, `/api/alerts`,
  `/api/gitlab`, billing/blockchain/quantum routes). Those are product code,
  not gateway primitives.
- **Playwright E2E suite.** Heavy — requires `wrangler dev` or a staging URL.
  One representative spec is preserved at `e2e-tests/preserved/health.spec.ts`
  in `describe.skip` mode; see `e2e-tests/README.md` for activation steps.

## Coverage

178 tests. Round-1 surfaces hold at 100% lines/branches/functions/statements.
Edge layer at 99.5% lines / 96.8% branches / 100% functions — clear of the
swarm 90/85/90 thresholds.

## Layout

```
src/
  accounting.ts     gateway.ts        retry.ts
  cache.ts          index.ts          routing.ts
  errors.ts         test-fixtures.ts  types.ts
  edge/
    audit.ts        handler.ts        rate-limit.ts
    errors.ts       jwt.ts            response-cache.ts
    extract-auth.ts kv-memory.ts      security-headers.ts
    index.ts        parse-completion.ts  types.ts
migrations/         README.md         (intentionally empty)
e2e-tests/          README.md         preserved/health.spec.ts (skipped)
```
