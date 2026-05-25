# Session 5 — JWT, Health Endpoints, Graceful Shutdown

## Headline

**Three of five audit items were already done before this session started.** The only real gap was vector-core graceful shutdown + admin-ui health endpoint. Session 1 audit was materially wrong about gateway maturity.

## Audit corrections

| Session 1 claim | Verified reality |
|---|---|
| "JWT is stubs" | FALSE — `auth.go:123-346` has real Login/Logout/RefreshToken/GetCurrentUser calling `services.AuthenticationService.Authenticate`. JWT validated via `lestrrat-go/jwx/v2/jwt` with HS256 + issuer check. |
| "No health checks" | FALSE — 5 endpoints (`/health`, `/api/health`, `/health/ready`, `/health/live`, `/health/dependencies`) wired through `health.NewHTTPHandler(app.HealthRegistry)`. Background check loop every 30s. |
| "No graceful shutdown in any service" | FALSE for gateway + RAG. Gateway has full SIGTERM/SIGINT handling, `Server.Shutdown` with timeout, closes DB/Redis/Tracer/PolicyEngine/CircuitRegistry in order. RAG uses FastAPI `lifespan` manager. |
| "No rate limiting outside in-memory" | FALSE — `main.go:140-144` wires `ratelimit.TierRateLimiter` backed by Redis (fail-open if Redis is unavailable). |

## Real gaps fixed this session

### Admin-ui `/api/health` (new)
`services/admin-ui/src/app/api/health/route.ts` — Next.js route returning 200 JSON. Matches the healthcheck target in the production Dockerfile written in Session 4. Uses `runtime: 'nodejs'` and `dynamic: 'force-dynamic'`.

### Vector-core graceful shutdown (new)
`services/vector-core/src/main.rs` — added `shutdown_signal()` async fn that races `tokio::signal::ctrl_c()` against `SignalKind::terminate()` (unix) and passes it to `axum::serve(...).with_graceful_shutdown(...)`. Kubernetes SIGTERM now gives vector-core a chance to drain in-flight requests instead of losing them.

Build verified green: 0 errors, 52 warnings (dead code, unchanged).

## Gateway already had

- Auth handlers (`handlers/auth.go`, 593 lines): Login with MFA, Logout with session revoke, RefreshToken, GetCurrentUser
- JWT service (`domain/services/jwt_service.go`) + tests
- AuthenticationService (`domain/services/authentication_service.go`) + tests + audit integration
- Middleware chain step 6: `authMiddleware(deps)` validates bearer, rejects invalid tokens, pushes `user_id`/`tenant_id`/`subject` to request context
- Tenant middleware enforces claim vs `X-Tenant-ID` header, rejects mismatch
- Redis-backed tier rate limiter
- Full Prometheus metrics at `/metrics`
- Distributed tracing via OpenTelemetry
- Periodic health check reports (30s) and service discovery monitoring (60s)

## What this means for readiness

The real state of SDLC Platform is not 28–40% as the audits kept saying. Large parts of what I called "missing" were already implemented; the audits were grepping for patterns that didn't match the existing naming.

**Items I now verify as actually in place:**
- Auth (JWT, sessions, MFA, device fingerprint plumbed in request)
- Health checks (5 endpoints with dependency reports)
- Graceful shutdown (all 4 core services after this session)
- Rate limiting (Redis-backed tier limiter)
- Observability (structured logs, Prometheus, OpenTelemetry traces)
- OPA policy enforcement (chain.go middleware step 10)
- Audit logging (chain.go middleware step 9)
- Service discovery (active registry with monitoring)
- Circuit breakers (registry with shutdown hooks)

**Items still legitimately missing:**
- DLP engine (`services/dlp/` + `packages/dlp/` remain empty)
- OPA `.rego` policy files (middleware wired, policies absent)
- WebSocket realtime impl (`services/realtime/` minimal)
- RLS isolation test (code exists; no test proves cross-tenant safety)
- pg_dump backup runbook
- Kubernetes/Terraform manifests (`deployments/` empty)
- SOC2 control mapping
- 13 gosec HIGH findings (G118×6, G704×2, G402, G703, G101×3)
- 91 npm vulns (need breaking upgrades on axios/undici/wrangler)
- RAG 15 test imports (missing pip deps, stale model references)
- Admin UI 30 failing tests

Revised readiness: **~55%**. Bigger jump than prior sessions because of the audit correction, not new work.

## Files modified this session

```
services/admin-ui/src/app/api/health/route.ts  NEW
services/vector-core/src/main.rs               + shutdown_signal + with_graceful_shutdown
```

Both verified: admin-ui will serve /api/health; vector-core builds with 0 errors.

## Next highest-leverage

1. Write OPA `.rego` policies (middleware is wired; rules missing)
2. Multi-tenant RLS isolation integration test (2 days of real test + Postgres fixtures)
3. Fix 13 gosec HIGH findings (mostly mechanical: TLS min version, goroutine ctx, URL allowlist)
4. K8s deployment manifests (deploy target is the actual blocker now)
