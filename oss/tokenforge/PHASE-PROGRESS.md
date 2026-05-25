# TokenForge Phase Progress

Tracks progress through the 12-phase build plan in `CISCO-dua.md` §11.

## Current verified totals (as of Phase 10)

Numbers traceable to `pnpm -r test` and `pnpm test:coverage`. Per-phase
notes below describe the increment delivered at each phase, not running
totals — phase-end coverage % drift as later phases add new files.

| Workspace | typecheck | tests | non-test source files |
|---|---|---|---|
| `packages/protocol` | clean | 71 | 12 `.ts` |
| `packages/db` | clean | — | 2 `.ts` |
| `packages/hono` | clean | 20 | 5 `.ts` |
| `packages/browser` | clean | 38 | 8 `.ts` |
| `apps/api` | clean | 95 | 21 `.ts` |
| `apps/dashboard` | clean (1 warning) | 14 | 23 `.ts` + 13 `.svelte` |
| `examples/saas-demo` | clean | 5 | 2 `.ts` |
| **total** | | **243 passed** | **73 `.ts` + 13 `.svelte`** |

All non-test source files are under the 200-line CLAUDE.md cap. Top-5
by line count is in the *File-size status* section below.

Coverage snapshot (latest run):

| Package | lines | branches | funcs |
|---|---|---|---|
| `packages/protocol` | 93.66% | 87.61% | 95.83% |
| `packages/hono` | 95.89% | 86.53% | 100% |
| `packages/browser` | 93.95% | 90% | 90% |
| `apps/api` | 96.98% | 90.05% | 98.66% |

All packages above the portfolio gate of 90% lines / 85% branches / 90% funcs.

## Phase status

| Phase | Title | Status | Notes |
|---|---|---|---|
| 1 | Skeleton | 🟡 partial | Repo tree + schema + Worker stub + dashboard stub + CI workflow shipped. **Manual prereqs not done**: domain registration, Cloudflare account/D1 provisioning, secrets. |
| 2 | Protocol primitives | ✅ | Ported `crypto`, `jws-verify`, `bound-cookie`, `dbsc-challenge` from opensyber into `@tokenforge/protocol`. Added `jws-sign` (server-side ES256 signer), `jwk` (JWK↔CryptoKey + thumbprint helpers), `peekJwsClaims` helper for routing-layer use. Phase delivered: 6 src modules + 6 test files. |
| 3 | Register + refresh endpoints | ✅ | `/v1/sessions/{register,refresh,:id/revoke}` + `GET /v1/sessions` mounted in `apps/api`. `X-TokenForge-Key` middleware (SHA-256 + timing-safe). KV-backed `ChallengeStore`. Drizzle adapter for prod, in-memory adapter (`InMemoryDb`) for tests. Phase delivered: 1 integration test file (sessions-flow) + 4 unit test files (api-key, kv-mem, db-mem, kv-challenge-store). |
| 4 | Browser SDK | ✅ | `@tokenforge/browser` Web Crypto path: ECDSA P-256 keypair (extractable=false private), IndexedDB storage adapter, DPoP signer, fetch interceptor handling 401 + Sec-Session-Challenge with auto-refresh + replay. Events: `bound` / `refreshed` / `step_up_required` / `session_revoked` / `binding_lost`. Demo at `apps/api/test/fixtures/demo.html`. Native DBSC + WebAuthn deferred to Phase 8. Phase delivered: 5 test files (signer, storage, tokenforge, interceptor, webcrypto transport). |
| 5 | Hono middleware drop-in | ✅ | `@tokenforge/hono` exposes `tokenforge({appId, apiKey, onLogin, onStepUp, onRevoked})`. Default mounts `POST /__tokenforge/{register,refresh}` proxies, sets first-party cookies, swaps `refresh_url` to customer origin. `TokenForgeClient` for direct revoke. Reference app at `examples/saas-demo/` covers login → register → dashboard. Phase delivered: 3 hono test files (middleware, client, cookies) + 1 saas-demo e2e test file. |
| 6 | Dashboard v1 (customer mode) | 🟡 | SvelteKit pages: home counters, `/apps` list, `/apps/new` create form, `/apps/[id]/created` one-time API-key reveal, `/apps/[id]` overview, `/apps/[id]/sessions` with subject filter, `/audit` with per-app filter, `/billing` 3-tier grid. `DashboardStore` interface + `MemoryDashboardStore` adapter (seeded with demo tenant + 1 app + 3 sessions). Issued API keys are byte-compatible with `apps/api` so keys verify end-to-end. Phase delivered: 2 unit test files (api-keys, store-mem). **Phase 6.1 follow-up**: Drizzle/D1 adapter, Better Auth full integration, LemonSqueezy webhook handler. |
| 7 | Risk signals + webhooks | 🟡 | 7 detectors per spec §3.4 (`geo_drift`, `asn_change`, `ua_drift`, `tls_exporter_mismatch`, `replay_window_anomaly`, `concurrent_ip_anomaly`, `latency_drift`) + `computeSignals` aggregator with step_up/block escalation. Wired into `/v1/sessions/refresh` — response carries `signals` + `action`, fans out to webhook subscribers. HMAC-SHA256 signed deliveries with timestamp, exponential-backoff retries, 4xx no-retry / 5xx + 429 retry. `/v1/webhooks` CRUD with one-shot secret reveal + `/v1/webhooks/:id/test` fire endpoint. Dashboard `/apps/[id]/webhooks` page mirrors the contract. Phase delivered: 5 new api test files (signals, risk, dispatcher, webhooks store, webhooks-flow) summing to 47 added tests. **Phase 7.1 follow-up**: Cloudflare Queues binding for at-least-once delivery, D1 persistence for webhooks + delivery log. |
| 8 | Native DBSC path | ✅ | `verifyDbscRegistrationJwt` in `@tokenforge/protocol` validates the W3C-shape JWS (in-band `jwk` header, `aud` + `jti` payload). `secSessionRegistrationHeader` builder for the response header. `POST /v1/sessions/dbsc-register` accepts `Content-Type: application/jwt`, consumes the challenge, binds with `binding_class: 'native_dbsc'`, returns W3C-shape JSON (`session_identifier`, `refresh_url`, `scope`, `credentials`). Browser `detectNativeDbsc()` + `primeNativeDbsc()` feature-detect via `navigator.deviceBoundSession` and the `Sec-Session-Registration` response header. `TokenForge.bind()` tries native first when `preferDbsc: true` (default), falls back transparently to Web Crypto. Phase delivered: 3 new test files (`dbsc-registration.test.ts` 9 tests, `dbsc.test.ts` 7 tests, `dbsc-register-flow.test.ts` 7 tests = 23 added tests). |
| 9 | Workforce mode foundations | 🟡 | Policy DSL + `evaluatePolicy` + `reconcilePolicy` in `@tokenforge/protocol` (per spec §5.1: `if_any` / `if_all` / nested `and` / `geo_country_in` / `asn_in` / `binding_class` / `concurrent_ips_gt` / `signal` clauses). OIDC primitives in protocol: `fetchDiscovery`, `fetchJwks`, `verifyIdToken` (RS256 + ES256, `iss`/`aud`/`exp`/`nonce`/`kid` checks). `POST /v1/sso/:appId/callback` accepts a customer-validated OAuth dance result (`id_token` + browser pubkey), verifies against the IdP's live JWKS, binds the session under the IdP's `sub`. Workforce policy resolver wired into `/v1/sessions/refresh` so a stored policy can override the Phase-7 risk action (always at-or-stricter via `reconcilePolicy`). Phase delivered: 3 protocol files (policy, oidc-verify, oidc-discovery) with 28 added tests + 1 api route (sso.oidc.ts) with 6 e2e tests. **Phase 9.1 follow-up**: dashboard IdP-config UI, `policyResolver` hooked to a real per-app `policies` table, optional TokenForge-driven OAuth redirect helper. |
| 10 | Workforce dashboard | 🟡 | Five new dashboard tabs wired off `/apps/[id]/`: **Users** (subjects derived from session bindings, with active-session count), **Policies** (CSV-of-country-codes shortcut + raw DSL JSON paste; smoke-evaluated against a dummy context before insert; toggle/delete actions), **Sessions** (extended with a per-row `revoke` form action that writes an audit row), **Compliance** (event-type breakdown + CSV/JSON export endpoints at `/apps/[id]/compliance/export.{csv,json}`). `DashboardStore` interface extended with `listSubjects` / `revokeSession` / `listPolicies` / `getPolicy` / `insertPolicy` / `setPolicyEnabled` / `deletePolicy`. `MemoryDashboardStore` split across 3 files (`store-mem-core.ts` 142 lines + `store-mem.ts` 111 lines + `store-mem-seed.ts` 59 lines) so each stays under the 200-line cap. Phase delivered: 4 server-route files + 2 SvelteKit `+server.ts` export endpoints + 4 `+page.svelte` views + 4 new store-mem unit tests. **Phase 10.1 follow-up**: SCIM-style user provisioning hook, per-policy diff viewer, signed compliance manifest. |
| 11 | SAML + SCIM | ⬜ | samlify or @node-saml/passport-saml. |
| 12 | Polish + launch prep | ⬜ | Marketing site, mdsvex docs, OpenAPI, npm publish, status page. |

## Known coverage drift

Phase 4 originally hit 100% lines on `packages/browser`. Phase 8 added
the native-DBSC code path (`primeNativeDbsc` HEAD-probe + the
`makeNativeStub` helper in `tokenforge.ts`); the browser package now
sits at 93.95% lines / 90% branches / 90% funcs — still above the gate
but not the original 100%. Filling those branches is queued for the
next iteration.

`packages/protocol` `jws-verify.ts` exposes `peekJwsClaims` (added in
Phase 3 for the routing layer) which has no protocol-package test —
its branches are exercised by `apps/api` integration tests. That's why
`jws-verify.ts` shows 82.14% lines / 66.66% funcs in the protocol
coverage table even though the function is exercised end-to-end.

## File-size status

The portfolio CLAUDE.md cap is **200 lines per source file** (`src/`,
`app/`, `lib/`). Current top-5 longest source files (test files
excluded):

| Lines | File |
|------:|---|
| 178 | `apps/api/src/routes/sessions.refresh.ts` |
| 165 | `apps/api/src/index.ts` |
| 163 | `apps/api/src/routes/sso.oidc.ts` |
| 150 | `apps/api/src/routes/sessions.dbsc-register.ts` |
| 149 | `packages/protocol/src/oidc-verify.ts` |
| 142 | `apps/dashboard/src/lib/server/store-mem-core.ts` |
| 142 | `packages/browser/src/core/tokenforge.ts` |

The Phase-10 in-memory store grew past the 200-line cap on the first
pass (`store-mem.ts` peaked at 285 lines after adding subjects /
policies / revoke). Refactored into `store-mem-core.ts` (142) +
`store-mem.ts` (111) + `store-mem-seed.ts` (59) — three files behind
the same `MemoryDashboardStore` class via inheritance + a free seed
function. The previous "all under 200" guarantee is restored.

All under the 200-line cap. None within 5 lines of the limit besides
`store-mem.ts` (196) — a candidate for the next refactor pass.

## Manual prerequisites (out-of-process — you must do these)

Before Phase 1 can be marked done:

- [ ] Register `tokenforge.dev` domain
- [ ] Create or pick the Cloudflare account that owns this product
- [ ] `cd tokenforge && pnpm install`
- [ ] `cd tokenforge && pnpm --filter @tokenforge/api wrangler d1 create tokenforge`
   - then paste the returned `database_id` into `apps/api/wrangler.toml`
- [ ] `wrangler d1 migrations apply tokenforge --remote`
- [ ] Set Cloudflare secrets:
  - `wrangler secret put BETTER_AUTH_SECRET`
  - `wrangler secret put RESEND_API_KEY`
  - `wrangler secret put LEMON_SQUEEZY_KEY`
- [ ] Add GitHub repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] Confirm DNS routing for `api.tokenforge.dev`, `dashboard.tokenforge.dev`, `tokenforge.dev`

Once those are done, `GET /v1/health` against `api.tokenforge.dev` returns `{status: "ok", db: "reachable"}` — that's the Phase 1 done line per spec §11.

## Open spec questions (CISCO-dua.md §14) — still blocking

1. Domain confirmation — `tokenforge.dev`?
2. Cookie domain strategy — first-party on customer's app domain?
3. Free tier limits — 1k MAU + 7-day audit?
4. Workforce GTM — gated "contact us" or self-serve?
5. Brand split — one product, two modes?
6. OpenSyber/AMLIQ outbound webhook formats — now or later?
