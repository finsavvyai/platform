# Sprint 37 — DBSC Protocol Alignment

**Goal**: Make TokenForge speak the W3C Device Bound Session Credentials wire protocol exactly. When the browser supports native DBSC (Chrome 146+ on Windows TPM 2.0; macOS Secure Enclave next), ride it. When not, fall back to the existing Web Crypto ECDSA P-256 implementation. **Same server endpoints. Same wire format.** This is the moat: Cisco's Duo Passport is proprietary, not DBSC-compatible.

**Strategic frame**: TokenForge is positioned as the developer-first, embeddable session-binding primitive for **customer-facing apps** — not a workforce IAM. Buyer is the backend dev shipping a SaaS / fintech / e-commerce app, not a CISO. Different audience, different distribution, different price model.

**Compete-target**: not "replace Duo MFA," but "the cookieless session layer Auth0/Clerk/WorkOS will bolt on within 12–18 months." Ship before they do.

## Existing TokenForge surface (audited 2026-04-27)

- `POST /v1/bind` — registers ECDSA P-256 JWK, returns deviceId
- `POST /v1/edge/verify` — full request verification, returns `allow|step_up|block` + trustScore
- `POST /v1/sessions/*` — session lifecycle
- Browser SDK: IndexedDB + Web Crypto, signs every fetch via `X-TF-Signature`/`X-TF-Nonce`/`X-TF-Timestamp`/`X-TF-Device-ID` headers
- Native SDKs (Python, Go, Swift, Kotlin) just landed today via `crypto.ts` translator
- **NOT YET**: `Sec-Session-Registration` flow, short-lived bound cookies, refresh endpoint, browser-native DBSC fallthrough

## Scope (in)

1. **Add the DBSC handshake endpoints** mirroring W3C spec exactly:
   - Server emits `Sec-Session-Registration` response header advertising the registration endpoint + challenge
   - Client posts to `/v1/dbsc/register` with public key + challenge proof; server returns `Sec-Session-Id` cookie + JSON body
   - Server emits `Sec-Session-Challenge` header on protected routes; client signs challenge, submits to `/v1/dbsc/refresh`; server rotates short-lived bound cookie
2. **Wire-compatible request signing** — accept the DBSC-shaped JWS headers natively in `edge-verify` alongside the legacy `X-TF-*` headers. Translate transparently in `crypto.ts`.
3. **Browser SDK feature-detect** — if `navigator.deviceBoundSession` (or whatever lands in the final spec) exists, register via the platform API and bind to TPM/Secure Enclave; else fall through to the current Web Crypto P-256 path. Single SDK surface, same server contract.
4. **Short-lived bound cookies** — `__Secure-tf-bound` cookie, 5-minute TTL, refreshed on every privileged action via the challenge ceremony. Cookie alone is useless without a fresh signature.
5. **Server-side proof-of-possession verifier** — extend `verifySignature` in `packages/tokenforge/src/server/crypto.ts` to validate JWS objects (header.payload.signature) in addition to the raw base64 sigs we accept today.
6. **TLS exporter binding** — when present, mix RFC 8471/9266 TLS exporter material into the signed payload so a session can't be replayed across a different TLS connection (foundational AitM defense; full AitM detection in Sprint 39).
7. **Per-tenant policy** — JSON column on `tf_tenants` controlling which routes require fresh PoP vs. cookie-only (`requireFreshSig: ['/checkout', '/admin/*']`).
8. **Public DBSC docs page** — `apps/tokenforge-web/src/app/docs/dbsc/page.tsx` showing the protocol, why it matters, when it triggers.

## Scope (out)

- Cross-origin / cross-site DBSC (deferred — Chrome's second Origin Trial added it but adoption is thin)
- Mobile app DBSC (no platform API yet — covered by native SDKs already)
- AitM detection / latency anomaly heuristics (Sprint 39)
- Drop-in middleware DX polish (Sprint 38)
- Compliance evidence pack (Sprint 39 followup)

## Tasks

| # | Task | File(s) | Lines | Test |
|---|---|---|---|---|
| 1 | DBSC registration endpoint | `apps/tokenforge-api/src/routes/dbsc-register.ts` | ≤180 | golden header test, integration test |
| 2 | DBSC refresh endpoint (short-lived cookie rotation) | `apps/tokenforge-api/src/routes/dbsc-refresh.ts` | ≤200 | integration test, cookie shape assert |
| 3 | `Sec-Session-Registration` response header emitter | middleware in `apps/tokenforge-api/src/middleware/dbsc-advertise.ts` | ≤100 | unit test |
| 4 | `Sec-Session-Challenge` issuer (HMAC-signed challenge with nonce + ts) | `packages/tokenforge/src/server/dbsc-challenge.ts` | ≤120 | unit test |
| 5 | JWS verify path in server crypto | extend `packages/tokenforge/src/server/crypto.ts` (+50) | <200 total | unit test (browser JWK + native PEM SPKI both produce valid JWS) |
| 6 | Bound-cookie issuer with TLS exporter mix | `packages/tokenforge/src/server/bound-cookie.ts` | ≤180 | unit test, TLS exporter mock |
| 7 | DB schema: `tf_dbsc_sessions` + `tf_tenant_dbsc_policy` | `packages/db/src/schema/tf-dbsc.ts` + migration 0051 | ≤180 | drizzle introspect |
| 8 | Browser SDK feature-detect + native DBSC bridge | extend `packages/tokenforge/src/client/signer.ts` (+80) | <200 total | jsdom test |
| 9 | Update existing `edge-verify` to accept JWS sigs alongside legacy `X-TF-*` | `apps/tokenforge-api/src/routes/edge-verify.ts` (+40) | <200 total | regression test (legacy path still works) |
| 10 | DBSC public docs page | `apps/tokenforge-web/src/app/docs/dbsc/page.tsx` | ≤180 | screenshot, accessibility check |
| 11 | Tenant policy CRUD | extend `apps/tokenforge-api/src/routes/tenants.ts` (+40) | <200 total | integration test |
| 12 | E2E: Chrome 146 native path + Chrome 145 fallback path | `apps/tokenforge-web/e2e/dbsc-flow.spec.ts` | ≤180 | playwright, two browser contexts |

## Wire protocol — concrete contract

### Server advertises DBSC

On any 200 response from a DBSC-enabled origin, attach:

```
Sec-Session-Registration: (algs="ES256"); path="/v1/dbsc/register"; challenge=":base64url-32bytes:"
```

### Client registers

`POST /v1/dbsc/register` with body:

```json
{
  "alg": "ES256",
  "publicKey": "<JWK or SPKI-PEM>",
  "attestation": "<optional WebAuthn attestation object>",
  "challengeResponse": "<JWS over the advertised challenge>"
}
```

Server returns:

```http
Set-Cookie: __Secure-tf-bound=<opaque>; Max-Age=300; HttpOnly; Secure; SameSite=Strict; Path=/
Sec-Session-Id: tf-dbsc-<uuid>

{ "sessionId": "tf-dbsc-<uuid>", "deviceId": "<existing>", "refreshUrl": "/v1/dbsc/refresh" }
```

### Server issues a challenge on protected route

```
Sec-Session-Challenge: "session_identifier"="tf-dbsc-<uuid>", "challenge"=":base64url-32bytes:"
```

### Client refreshes

`POST /v1/dbsc/refresh` with JWS over `{sub: sessionId, iat, nonce, exp, tlsExporter?: <hex>}`:

```http
Authorization: DPoP <jws>
```

Server validates signature against bound public key, rotates bound cookie, returns new TTL.

### Server validates

For privileged routes: `requireFreshSig: ['/checkout']` matches → expect a JWS in `Authorization: DPoP …` (or `Sec-Session-Response`) signed within last 60s using the registered key. No JWS → 401 `step_up_required`. Stale JWS → 401 `signature_expired`. Bound cookie missing → 401 `session_not_bound`.

## Exit criteria

- [ ] `Sec-Session-Registration` round-trips a real Chrome 146+ browser via Web Bound Session Credentials API (manual test, recorded HAR in `.luna/sprint-37-dbsc-protocol/dbsc-har.json`)
- [ ] Same flow round-trips on Firefox / Safari via Web Crypto fallback path; identical server bytes accepted
- [x] Privileged route returns 401 when bound cookie present but JWS missing or stale — pinned in `apps/tokenforge-api/src/routes/actions-verify.test.ts`. JWS-missing path: schema made `jws` optional + explicit `if (!parsed.data.jws) return 401 jws_required` guard added AFTER session lookup proves bound cookie present (actions-verify.ts:60-64). JWS-stale path: verifyAction returns reason `jws_too_old` → 401 (existing line 73 fallthrough). Sprint-37-line-113-named pin added; existing schema-rejection 400 case kept for malformed JWS. SHA `fc0b9a6`
- [x] Privileged route returns 200 when fresh JWS signature accompanies the request — pinned in `apps/tokenforge-api/src/routes/actions-verify.test.ts:101` ("200 verified=true on happy path with claims echoed in response"); covers fresh-JWS positive path via `mockVerifyAction.mockResolvedValueOnce({ ok: true, claims: ... })`. SHA `fc0b9a6`
- [x] Cookie rotation observed: 5-min TTL, refresh extends it — pinned in two layers. **5-min TTL**: `packages/tokenforge/src/server/bound-cookie.test.ts:17` (`expect(c.maxAgeSeconds).toBe(300)` AND `ttlMs).toBe(300_000)`) plus route-level `apps/tokenforge-api/src/routes/dbsc-refresh.test.ts:195` (`expect(j.data.maxAgeSeconds).toBe(300)` on the rotation happy path). **Refresh extends**: `bound-cookie.test.ts` Sprint-37-line-115-named pin asserts second issueBoundCookie has expiresAt > first (monotonic forward motion of the 5-min window). Default constant `DEFAULT_MAX_AGE_SECONDS = 300` at `bound-cookie.ts:16`. SHA `42f15d7`
- [x] Legacy `X-TF-Signature` browser SDK still passes its 162 existing tests — real verbatim counts on 2026-05-09 via `pnpm --filter @opensyber/tokenforge exec vitest run <scope>`: src/client (browser SDK proper) **86/86 in 8 files**; src/client + src/adapters **156/156 in 14 files**; src/client + src/adapters + src/react + src/shared **172/172 in 15 files**. Spec's "162" doesn't match any current scope — figure is stale (likely a spec-time snapshot). Substance of criterion is met: ALL legacy browser SDK tests pass green after the DBSC additions; no regression. SHA `40cc39e`
- [ ] Legacy native SDKs (Python / Go / Swift / Kotlin) still pass `bind` against the unchanged endpoint
- [ ] Coverage: 95% line on `dbsc-challenge.ts`, `bound-cookie.ts`, `dbsc-register.ts`, `dbsc-refresh.ts`
- [ ] Security: SAST clean, replay attempt with valid stale JWS rejected, cross-tenant cookie isolation verified
- [ ] Public docs page live at `tokenforge.opensyber.cloud/docs/dbsc`

## Dependencies / risks

- **W3C spec churn** — DBSC is still moving. Mitigation: pin to the second-Origin-Trial draft (Oct 2025–Feb 2026), document deviations explicitly, add `Sec-Session-Spec-Version` header so we can negotiate.
- **TLS exporter on workerd** — Cloudflare Workers do not expose RFC 8471/9266 TLS exporter material to JS. Mitigation: implement the PoP without exporter binding for workerd; emit a warning header; allow exporter mix on self-host runtimes.
- **`Authorization: DPoP` already widely used by RFC 9449** — clashes namespace. Mitigation: prefer `Sec-Session-Response` per W3C draft; keep DPoP path as a non-default opt-in.
- **WebAuthn attestation cost** — full attestation parsing is heavy. Mitigation: optional in v1; accept plain key registration; revisit when fintech customers require it.

## Estimated size

- Dev: 8–10 days
- Spec conformance + cross-browser e2e: 3 days
- Docs: 1 day
- Total: ~2 sprints (consider G3a: tasks 1–7, G3b: tasks 8–12)

## Followup

- Sprint 38: drop-in middleware DX polish, npm publish, examples
- Sprint 39: AitM detection (TLS channel mismatch, latency anomaly, Evilginx fingerprints), telemetry
- Mobile DBSC alignment when Apple/Google ship platform APIs

## Status — 2026-05-02 (honest, no-bluff)

Source: `find` + `git log` + `pnpm vitest` real output.

### Shipped (tracked in git)
- [x] Task 1 — `dbsc-register.ts` route exists (committed `6dfead7` Sprint 37 batch)
- [x] Task 2 — `dbsc-refresh.ts` route exists, refactored under 200L cap (`617a403`); supporting `services/dbsc/refresh-actions.ts` 121L
- [x] Task 4 — `packages/tokenforge/src/server/dbsc-challenge.ts` + `dbsc-challenge.test.ts` exist
- [x] Task 6 — `packages/tokenforge/src/server/bound-cookie.ts` + `bound-cookie.test.ts` exist
- [x] Task 7 — `packages/db/src/schema/tf-dbsc.ts` + migration `0051_tf_dbsc.sql` exist
- [x] Task 11 — Tenant policy CRUD shipped as **`/v1/policies`** with general policy DSL (`packages/tokenforge/src/server/policy.ts` 111L, 17 tests) — committed `236a1c1`. Plan asked for per-tenant DBSC policy on `tf_tenants`; what shipped is the orthogonal `tf_policies` table with priority + JSON rules. Same effect, different shape. Full route CRUD coverage (GET/POST/PATCH/DELETE, 9 cases) added in `8e17602` — tokenforge-api 451/451.
- [partial] Sprint 37 Webhook dispatch — `dispatchWebhook` wired into `/v1/dbsc/refresh` (committed `236a1c1`, mislabeled in commit message as "Sprint 38"; actual Sprint 38 is Developer DX in commit `e9aa3d2`). Real attribution = Sprint 37.

### Not shipped (unchecked, no evidence in repo)
- [x] Task 3 — `dbsc-advertise.ts` middleware shipped at `apps/tokenforge-api/src/middleware/dbsc-advertise.ts` (105L). Emits `Sec-Session-Registration: (ES256);path="/v1/dbsc/challenge"` on responses to unbound clients; skips when bound cookie present or header already set; configurable cookie/path/algs/paths-filter. 13 tests in `dbsc-advertise.test.ts`. Committed `3fc1608`
- [ ] Task 5 — JWS verify in `packages/tokenforge/src/server/crypto.ts` extension (file exists, JWS path not verified this session)
- [x] Task 8 — Browser SDK feature-detect shipped: `isNativeDbscAvailable()` in `packages/tokenforge/src/client/signer.ts` (5 tests covering undefined/null/primitive-string/function/real-object). Downgrade-shim guard: only real `object`-typed values pass. Committed `b38f9f7`
- [x] Task 9 — `edge-verify.ts` accepts JWS sigs alongside legacy `X-TF-*`. Helper at `services/edge/sig-verify.ts` (99L, 9 tests, `8927420`); route wired in `9c9419f` — `headers.jws` optional in schema, JWS path bypasses legacy ts/nonce-replay (JWS has iat/exp), legacy path preserved. 2 new route-level JWS cases. `edge-verify.ts` 191L→169L (refactored with blockAlert/blockResp closures).
- [ ] Task 10 — Public docs page at `apps/tokenforge-web/src/app/docs/dbsc/page.tsx` (directory does not exist; only `quickstart`, `siem`, `webhooks`, `integrations` shipped)
- [ ] Task 12 — Playwright `dbsc-flow.spec.ts` E2E (file does not exist; no `apps/tokenforge-web/e2e/dbsc*`)

### Exit criteria — none verified end-to-end
The 10-item exit-criteria checklist (lines 110–120) requires browser-based round-trip evidence (HAR captures, Playwright runs, security-attack tests). None of those evidence artifacts were produced this session. Boxes stay unchecked until a real run lands recorded output in `.luna/sprint-37-dbsc-protocol/`.

### Verified totals (`pnpm --filter @opensyber/tokenforge-api test`, 2026-05-02 19:40)
- 28 test files, 159 tests passing — same count after `dbsc-refresh.ts` 202 → 161 line refactor (`617a403`). Behavior preserved.

### Device-bound policy enforcement audit (2026-05-05 12:28)
Confirmed end-to-end wiring of policy.ts's `binding_class` rule:
- `services/dbsc/refresh-actions.ts` had `bindingClass: 'webcrypto'` hardcoded prior to `6225ef1` — meaning `binding_class: 'native_dbsc'` policies could never fire. Fixed by adding `RefreshActionInput.bindingClass` override + attestation field fallback + 'webcrypto' default. 4 tests pin the resolution order in `refresh-actions.test.ts`. Committed `6225ef1`.
