# Security Audit — 2026-05-01

> Internal review across 7 layers. Same discipline as `/ll-no-bluf` — every claim verified against code. Findings ranked Critical / High / Medium / Low / Info.
> Auditor: in-house. External pen test scheduled separately.

## Scope

API worker `tenantiq-api` (`apps/api/src`), web app (`apps/web/src`), CI workflows (`.github/workflows`), wrangler config, and the cert-prep doc set. Out of scope: Microsoft Graph, LemonSqueezy, Cloudflare native infra (covered by their own audits + DPAs).

## Headline

**0 Critical, 0 High, 3 Medium, 3 Low, plus positive findings.** No release-blocking issues. Three concrete code follow-ups documented at the bottom.

## Findings

### M1 — Stateless JWT logout doesn't revoke the token

- **Where**: `apps/api/src/middleware/auth.ts:23-37` (verifyToken) + `routes/auth.ts:220-230` (logout).
- **Behavior**: Logout deletes the `session:{sub}` KV entry and clears the cookie, but `authMiddleware` is purely stateless — it verifies the JWT signature and exp, never consults KV. A stolen JWT remains valid until `exp` (24h) even after the user signs out.
- **Impact**: Token-theft window of up to 24h post-logout. Standard JWT trade-off, but worth closing for cert posture.
- **Fix options** (pick one, ~30 min):
  1. Stateful sessions: `authMiddleware` reads `session:{sub}` and rejects if absent or doesn't match the presented JWT. Pros: clean. Cons: per-request KV read.
  2. Deny-list: on logout, write `revoked:{jti}` to KV with TTL = remaining exp. Middleware checks it. Pros: only one KV read on revoked tokens (cache-miss is fast). Requires adding `jti` to JWT.
- **Recommend**: option 2.

### M2 — JWT verify lacks `audience`/`issuer` checks

- **Where**: `apps/api/src/middleware/auth.ts:30,35` and `apps/api/src/routes/auth-session.ts:18,23`.
- **Behavior**: `jose.jwtVerify(token, key, { algorithms: ['…'] })` without `audience`/`issuer`.
- **Impact**: If `JWT_SECRET` or `RS256_PRIVATE_KEY` ever leaks across services, tokens minted for any audience would still verify on TenantIQ. Defense-in-depth gap, not active vector.
- **Fix**: set `iss: 'tenantiq.app'` + `aud: 'tenantiq-api'` on `signToken`, mirror in `jwtVerify` calls. ~15 min.

### M3 — WS endpoint hard-codes HS256

- **Where**: `apps/api/src/routes/websocket.ts:26`.
- **Behavior**: `jose.jwtVerify(token, secret, { algorithms: ['HS256'] })`. The rest of the auth surface dual-verifies (RS256 preferred, HS256 fallback).
- **Impact**: If/when we drop HS256 entirely, WS connections silently break. WS tickets are 60s-TTL so impact is short, but still noisy.
- **Fix**: replace with `verifyTokenWithFallback` from `auth-session.ts`. ~10 min.

### L1 — Cookie value passed through `decodeURIComponent`

- **Where**: `apps/api/src/middleware/auth.ts:16`.
- **Behavior**: JWT pulled from cookie via `decodeURIComponent`. JWT charset is URL-safe (base64url + dots) so this is normally a no-op. But a malformed cookie value containing `%` could be reshaped before verify. Verify handles it (signature fails on malformed payload), so impact is bounded.
- **Fix**: drop the decode; raw cookie value is what we wrote. ~5 min.

### L2 — Restricted PII (Azure OID) logged on auth-failure paths

- **Where**: `apps/api/src/routes/auth.ts:199` (`[me] user not found … oid: <azureOid>`).
- **Behavior**: Sentry scrubber strips `oid` only when it's a known field name (e.g. inside an `extra` object). Free-text console interpolation isn't structured, so the OID lands in logs verbatim.
- **Impact**: Azure OID is classified Restricted (`docs/DATA_CLASSIFICATION.md`). Log retention + Sentry retention extend exposure.
- **Fix**: log `oid_hash = sha256(azureOid).slice(0,8)` instead. Or remove the OID from the message and rely on structured `extra: { sub: azureOid }` so the scrubber catches it.

### L3 — WS ticket carried in URL query string

- **Where**: `apps/web/src/lib/utils/websocket.ts:37`.
- **Behavior**: `wss://api/api/ws/<tid>?token=<jwt>`. URLs end up in browser history + edge access logs. Already mitigated by 60s TTL on the ticket.
- **Impact**: Token lifetime makes the leak moot in practice. Documented in `docs/THREAT_MODEL.md`.
- **Fix**: optional. Cloudflare Workers WS upgrade can't carry custom auth headers, so query-string is the standard pattern. Leave + monitor.

## Positive findings

| Layer | Verified |
|---|---|
| Tenant isolation | every D1 query sampled is `WHERE org_id = ?`/`WHERE organization_id = ?`/`WHERE tenant_id = ?`; `authMiddleware` enforces `X-Tenant-Id` against JWT's `tenantIds` |
| SQL injection | dynamic SQL exists (`scim/users.ts`, `scim/groups.ts`, `branding.ts`, `sso-handlers.ts`, `account-deletion.ts`) but all interpolated identifiers come from hardcoded allowlists — no user input reaches the SQL string. Values fully bound. |
| OAuth state/nonce CSRF | state KV write with 5-min TTL; nonce verified against id_token claim in `verifyAzureIdToken` |
| Refresh-token at-rest crypto | AES-256-GCM via `GRAPH_TOKEN_KEK` with explicit IV per write (`graph-token-store.ts`) |
| Secrets management | every secret (32 total) via `wrangler secret put`, none in repo, none echoed in logs (TruffleHog + Gitleaks in CI) |
| Webhook integrity | TokenForge: HMAC-SHA256 + ±5min `X-TF-Timestamp` replay window. OpenClaw: HMAC + ±5min `payload.timestamp`. LemonSqueezy: HMAC + KV-digest idempotency (vendor doesn't sign timestamp). |
| Webhook constant-time compare | `signatureMatches` in `tf-webhook.ts:100` uses constant-time; `verifyWebhookSignature` in `lemonsqueezy.ts` uses `crypto.timingSafeEqual` |
| CSRF | Hono `csrf` middleware on all routes except SCIM; CORS preflight + `SameSite=Lax` cookie + JSON-CT bypass = layered defense |
| Rate limiting | `/auth/login` + `/auth/login/personal` + `/auth/login/linkedin` + `/auth/exchange` + `/api/account` (DELETE) + `/billing/checkout` all rate-limited via KV-backed `rateLimitMiddleware` |
| Security headers | HSTS `max-age=31536000; includeSubDomains` (preload pending), CSP (default-src self), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locked down |
| Session cookie | `HttpOnly`, `Secure` (prod), `SameSite=Lax`, scoped to `tenantiq.app` apex domain |
| Sentry PII scrubber | URL query, sensitive headers, request body/cookies, extra/contexts (recursive), user (id only), breadcrumbs all scrubbed (`docs/SENTRY_SCRUBBING.md`) |
| Cascade contract | `apps/api/src/lib/account-deletion.test.ts` asserts cascade hits exactly the 33 documented tables (drift-locked) |
| OAUTH_SCOPES drift | `scripts/check-cert-drift.ts` enforces every scope in code is justified in `docs/GRAPH_PERMISSIONS.md` |
| RS256 keys | live `https://api.tenantiq.app/api/.well-known/jwks.json` returns `kid: tenantiq-rs256-1` |
| Account deletion | smoke + cascade-contract test pass; live `/api/account/export` (GDPR Art. 15) and `DELETE /api/account` (Art. 17) returning 200/401/403 as documented |

## Soft observations (not findings, just visibility)

- **Single-vendor concentration** (Cloudflare): hosting, D1, KV, R2, Pages, DNS, registrar. A Cloudflare extended outage = full platform outage. Documented in `docs/BUSINESS_CONTINUITY.md`. Cross-cloud DR is a backlog item.
- **No SOC 2 yet**: Type I drafted, Type II requires 6 months of operating evidence. Not blocking M365 Cert Level 1.
- **No external pen test yet**: scheduled. Report becomes the addendum to the Partner Center submission.
- **LemonSqueezy webhook** doesn't sign a timestamp — we substitute KV-digest idempotency. Acceptable per vendor spec but worth flagging if their API ever changes.

## Action plan

| ID | Severity | Action | ETA |
|---|---|---|---|
| M1 | Medium | JWT `jti` claim + KV deny-list on logout | 30 min |
| M2 | Medium | `iss`/`aud` claims on signToken + verify | 15 min |
| M3 | Medium | WS verify uses dual-algorithm fallback | 10 min |
| L1 | Low | Drop `decodeURIComponent` on cookie token | 5 min |
| L2 | Low | Hash Azure OID before logging | 5 min |
| L3 | Low | Document the WS query-string trade-off in threat model | — done |

Total fix budget: ~65 minutes. None blocks demo or M365 Cert L1 submission. All can ship as one PR.

## Reproducing this audit

```sh
# Tenant isolation:
grep -rEn "DB\.prepare\(.*WHERE\b" apps/api/src --include="*.ts" \
  | grep -v "org_id\|organization_id\|tenant_id\|WHERE id\|WHERE email\|WHERE azure_oid\|test"

# SQL injection candidates (must all use allowlists):
grep -rn '\${' apps/api/src --include="*.ts" | grep -E "FROM|WHERE|INSERT|UPDATE"

# Auth surface:
grep -rn "jose.jwtVerify\|signToken\|extractToken" apps/api/src --include="*.ts"

# Drift:
pnpm tsx scripts/check-cert-drift.ts

# Live posture:
BASE_URL=https://app.tenantiq.app API_URL=https://api.tenantiq.app \
  npx playwright test cert-prep-smoke --project=chromium --reporter=list
```

Auditor sign-off goes in this file's `## History` section once the M1–M3 fixes ship.
