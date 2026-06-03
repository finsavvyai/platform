# Security Hardening Checklist

> Per-area checklist of the security controls a Type 1 audit firm walks
> at engagement open. Each row cites the file that implements the
> control or marks a tracked gap.
> Last refreshed: 2026-05-26.

## HTTP transport

- [x] TLS termination at Cloudflare edge — TLS 1.2+ only. `infrastructure/cloudflare/`.
- [x] HSTS header at edge with 1y max-age + includeSubDomains.
- [x] No HTTP→HTTPS downgrade path; all worker routes HTTPS-only in Wrangler manifest.
- [x] Public key pinning (HPKP) — not used; HSTS and Cloudflare-managed TLS
  policy are the supported controls for this edge posture.

## Secrets management

- [x] Secrets pulled from Cloudflare Workers secret store; never in Git, never in container images, never in logs (`products/amliq/CLAUDE.md` security rules).
- [x] Secret-scan job blocks merges containing secret-shaped strings — `.github/workflows/ci.yml`.
- [x] Rotation policy quarterly for signing keys + HMAC webhook secrets — `RISK_REGISTER.md` row 7.
- [x] Automated rotation for short-lived API tokens —
  `packages/auth/src/jwt.ts` exports `rotateTokenIfNeeded`, which verifies
  the current token through the alg-pinned path, mints a replacement only
  inside the configured renewal window, preserves custom claims, and can
  deny-list the old JTI.

## JWT validation

- [x] Algorithm pinned at verify time — no `alg=none` acceptance. `packages/auth/src/jwt.ts` (hardened 2026-05-24).
- [x] Dependency-injected verifier in brain — `products/amliq/brain/services/api/src/auth.ts` does not re-implement signature checking.
- [x] Required-role gate per route with default deny — `auth.ts` `hasRequiredRole` returns false on missing/non-array roles.
- [x] 100% line + branch coverage on auth middleware critical path.
- [x] JWT `jti` deny-list for revocation — `packages/auth/src/jwt.ts`
  checks an injected `JtiRevocationStore`; `RedisJtiStore` provides the
  production-compatible deny-list adapter without coupling the auth package
  to a Redis SDK.

## Dependency hygiene

- [x] `pnpm audit` runs in CI on every PR; Critical/High blocks merge (`products/amliq/CLAUDE.md` dep-vuln rule).
- [x] Lockfile pinned + checked in.
- [x] No transitive `@finsavvyai/*` imports from `products/*` (round-2 rule); telemetry carve-out only.
- [x] License compliance scan job — `.github/workflows/ci.yml`.

## Input validation

- [x] Tenant ID validated against `TENANT_ID_REGEX` at JWT claim extraction AND every D1 binding call (defence in depth) — `products/amliq/brain/services/api/src/tenant/types.ts`; `products/amliq/brain/services/api/src/audit-prod/state-store.ts`.
- [x] SQL fully parameterised — zero string concatenation in `state-store.ts`.
- [x] Search query length + topK bounds enforced — `products/amliq/brain/services/api/src/search/` validators.
- [x] Zod schemas at every brain route boundary — search and SAR Draft
  JSON bodies validate through `request-schema.ts`; tenant claims still
  validate through the tenant regex guard.

## Output encoding

- [x] JSON responses constructed via Hono `c.json` (no string interpolation into bodies).
- [x] Error responses return stable codes only — `{ ok: false, error: "<stable_code>" }` shape across brain, audit, tenant, rate-limit subsystems.
- [x] No PII in audit `reason` field — enforced by `products/amliq/CLAUDE.md` rule + AMLIQ Brain reason-code convention.

## Logging redaction

- [x] Audit emitter does not log JWT contents — `products/amliq/brain/services/api/src/audit.ts` builds records from `actor_id` only.
- [x] Fallback sink (`console.error`) ships only the already-redacted audit record — `audit.ts` `defaultFallback`.
- [x] No `console.log` of headers or bodies in production code paths.

## Rate limiting

- [x] Pre-auth sliding-window rate limit prevents JWT-verification CPU burn — `products/amliq/brain/services/api/src/rate-limit/middleware.ts`.
- [x] Per-tenant rate limit prevents single-tenant exhaustion of shared capacity — `products/amliq/brain/services/api/src/rate-limit/tenant-rate-limit.ts`.
- [x] `/health` never rate-limited (SEV1 observability invariant) — `middleware.ts` default `bypassPaths`.
- [x] Stable code reasons (`rate_limit.window_exceeded`, `rate_limit.tenant_exceeded`, `rate_limit.store_unavailable`, `rate_limit.config_invalid`) emitted as audit `reason` on every rejection — mesh §10.
- [x] `Retry-After` header set per RFC 7231 §7.1.3.
- [x] 100% line + branch coverage on `decideSlidingWindow`, `checkTenantRateLimit`, and `createRateLimitMiddleware`.

## Tenant isolation

- [x] `TenantContext` frozen + propagated via Hono context — `products/amliq/brain/services/api/src/tenant/middleware.ts`.
- [x] Default-deny on missing/invalid `tnt` JWT claim — `extractTenantId` returns `tenant.missing` or `tenant.unknown`.
- [x] Audit chain HEAD is per-tenant in D1 — `products/amliq/brain/services/api/src/audit-prod/state-store.ts`.
- [x] 100% line + branch coverage on tenant middleware (security-critical).

## Error message disclosure

- [x] Stack traces never returned in HTTP responses — Hono default handler used; no custom error handler that leaks internals.
- [x] 401/403 carry stable error codes (`missing_token`, `invalid_token`, `expired_token`, `revoked_token`, `insufficient_role`, `tenant.missing`, `tenant.unknown`, `tenant.scope_denied`), not free-form messages.
- [x] 429 carries stable rate-limit code, not "you're going too fast" prose.
- [x] 503 `audit_emit_failed` returned when audit chain fails — caller never sees the underlying sink error.

## Vendor risk

- [x] Critical and high vendors tracked with owner, review status, risk,
  mitigations, and evidence paths — `docs/compliance/vendor-risk-register.json`.
- [x] Required vendor IDs and evidence paths validated by
  `tools/validate-vendor-risk.mjs`.

## Next steps before audit (3 items)

1. **Engage SOC 2 auditor** — selection in flight; readiness package is in `docs/compliance/`. Owner: CEO. Target: 2026-06-15.
2. **Engage pen-test firm** — schedule Type 1 walkthrough date; share readiness package + risk register. Owner: Security on-call. Target: 2026-06-30.
3. **DR plan exercise** — tabletop the Cloudflare-region-outage scenario end-to-end (per `INCIDENT_RESPONSE.md` quarterly cadence). Owner: Security on-call. Target: 2026-07-31.
