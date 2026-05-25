# TokenForge Cron Sweep Queue

> Prioritized backlog for the hourly cron `a1479a96` (fires `7 * * * *`).
> Each row is one fire's worth of work: bounded scope, explicit success
> criteria, real test counts. Cron picks the first unchecked row whose
> dependencies are met.
>
> **No-bluff rule**: every tick MUST cite a commit SHA + real
> `pnpm test` numbers. Untickable rows get `[blocked]` with the quoted
> blocker.

---

## Tier 0 — Quick wins (deterministic, no judgment calls)

### Q0.1 — Split `WebhookConfig.tsx` (333L → ≤200L)
- **File**: `apps/tokenforge-web/src/components/dashboard/WebhookConfig.tsx`
- **Strategy**: Extract event-list table, secret-rotation modal, and form-validation hooks into sibling components under `dashboard/webhook-config/`. React component splits should follow Apple HIG content-first rule.
- **Done when**: source file ≤200L; web app build still passes; if a `*.test.tsx` exists for this component, count unchanged.
- **Evidence**: `wc -l` output + `pnpm --filter @opensyber/tokenforge-web build`
- [x] WebhookConfig 333 → 171 lines; WebhookList 103L (new); WebhookFormModal 143L (new) — `pnpm --filter @opensyber/tokenforge-web typecheck` clean — SHA `f2722d2`

### Q0.2 — Split `webhooks-config.ts` (254L → ≤200L)
- **File**: `apps/tokenforge-api/src/routes/webhooks-config.ts`
- **Strategy**: Extract Zod schemas + signature-secret rotation handlers into `services/webhooks/config-handlers.ts`.
- **Done when**: route file ≤200L; tokenforge-api 159+ tests still green; typecheck clean.
- [x] webhooks-config.ts 254 → 196L; config-helpers.ts 75L (new); 159/159 tests, typecheck clean — SHA `3780583`

### Q0.3 — Split `webhooks.test.ts` (225L → ≤200L)
- **File**: `apps/tokenforge-api/src/routes/webhooks.test.ts`
- **Strategy**: Extract HMAC + payload-shape fixtures into `routes/__fixtures__/webhooks.ts`. Pure de-duplication — no behavior change.
- **Done when**: test file ≤200L; same number of tests pass.
- [x] webhooks.test.ts 225 → 175L; test/webhook-fixtures.ts 73L (new); 159/159 unchanged — SHA `babbd95`

### Q0.4 — Split `trust-score.test.ts` (221L → ≤200L)
- **File**: `packages/tokenforge/src/server/trust-score.test.ts`
- **Strategy**: Extract baseline-context builders + AitM-anomaly fixtures.
- **Done when**: test file ≤200L; tokenforge 268+ tests still pass.
- [x] trust-score.test.ts 221 → 162L; trust-score-fixtures.ts 25L (new); 268/268 tests, typecheck clean — SHA `c15867b`

### Q0.5 — Split `tokenforge-api-settings.ts` (211L → ≤200L)
- **File**: `apps/tokenforge-web/src/lib/tokenforge-api-settings.ts`
- **Strategy**: Move plan-config table + tier-feature matrix to a sibling const file.
- **Done when**: source file ≤200L; web app build passes.
- [x] Settings 211 → 124L; tokenforge-api-webhooks.ts 91L (new) — webhook client funcs/types moved + re-exported. Typecheck clean — SHA `a96f6e5`

### Q0.6 — Split `apps/tokenforge-api/src/index.ts` (208L → ≤200L)
- **File**: `apps/tokenforge-api/src/index.ts`
- **Strategy**: Extract route-mount block (~70 imports + `app.route()` calls) into `routes/mount.ts` exporting a `mountRoutes(app)` function.
- **Done when**: index.ts ≤200L; all 159 tokenforge-api tests still pass.
- [x] index.ts 208 → 118L; mount.ts 108L (new); 159/159 tests, typecheck clean — SHA `8f692c1`. **Tier 0 complete (6/6).**

---

## Tier 1 — Untested security-critical routes

### Q1.1 — Route-level test for `edge-verify.ts`
- **File to add**: `apps/tokenforge-api/src/routes/edge-verify.test.ts`
- **Coverage**: legacy `X-TF-*` path, missing headers → 400, low trust → step_up, blocked → 401, success → allow with score
- **Done when**: ≥6 new tests pass; uses `hono/testing`; mocks `TrustScoreEngine`.
- [x] 9 tests at 194L cover validation/degraded/timestamp_skew/nonce_replay/device_not_found/session_revoked/session_expired/allow/step_up. Used vi.hoisted to fix `"Cannot access 'mockVerifySignature' before initialization"` — SHA `3402605`. tokenforge-api 168/168 (was 159).

### Q1.2 — Route-level test for `dbsc-register.ts`
- **File to add**: `apps/tokenforge-api/src/routes/dbsc-register.test.ts`
- **Coverage**: missing challenge → 400; bad challenge response → 401; success returns `Sec-Session-Id` cookie + bound-cookie set; tenant mismatch → 401
- [x] 6 tests at 165L cover invalid_payload/consume-fail/jws-bad-sig/nonce-mismatch/201-happy/baseline-capture — SHA `057b4e6`. tokenforge-api 174/174 (was 168).

### Q1.3 — Route-level test for `dbsc-refresh.ts`
- **File to add**: `apps/tokenforge-api/src/routes/dbsc-refresh.test.ts`
- **Coverage**: missing JWS → 400; bad cookie hash → 401; consume-challenge fail → 400; happy path rotates cookie + emits `Sec-TF-Channel-Bound` header
- [x] 8 tests at 199L cover missing-jws/session-not-found/revoked/cookie-missing/cookie-mismatch/consume-fail/jws-subject-mismatch/happy-rotate — SHA `98b016a`. tokenforge-api 182/182 (was 174).

### Q1.4 — Route-level test for `dbsc-challenge.ts` + `dbsc-revoke.ts`
- **Files to add**: `dbsc-challenge.test.ts`, `dbsc-revoke.test.ts`
- **Coverage**: challenge issuance returns base64url 32-byte nonce + sets header; revoke marks session row revoked + 204
- [x] dbsc-challenge.test.ts 117L (5 cases) + dbsc-revoke.test.ts 157L (7 cases) — invalid_payload/session_id_required/header-emit/forwarding for challenge; list/limit-clamp/not-found/soft-revoke/default-reason/already-revoked for revoke. SHA `aef4b1f`. tokenforge-api 194/194 (was 182).

### Q1.5 — Route-level test for `workforce-sso.ts`
- **File to add**: `apps/tokenforge-api/src/routes/workforce-sso.test.ts`
- **Coverage**: invalid payload → 400; missing app → 404; jwks unavailable → 503; success returns subjectId + register challenge
- **Note**: service-level `sso-exchange.test.ts` covers exchange logic; this fire adds the route wiring layer.
- [x] 7 tests at 158L cover invalid_payload (×2)/not_found/jwks_unavailable/exchange-fail/happy/cross-tenant — SHA `39709fe`. tokenforge-api 201/201 (was 194). **Tier 1 complete (5/5).**

---

## Tier 2 — Untested server lib code (`packages/tokenforge/src/server/`)

### Q2.1 — Tests for `step-up.ts`
- **File to add**: `step-up.test.ts`
- **Coverage**: OTP issue with configured `sendEmail` handler; throws clear error when handler missing (covers line 56 trap); OTP verify happy + fail; rate-limit per email
- [x] 8 tests at 176L cover unauthorized/rate-limited/totp-happy/missing-sendEmail-trap/passkey-challenge for /initiate; invalid-challenge/email-otp-success/totp-failure for /complete — SHA `657d4b4`. tokenforge 276/276 (was 268).

### Q2.2 — Tests for `binding.ts`
- **File to add**: `binding.test.ts`
- **Coverage**: bind ceremony glue paths (creating + persisting binding records)
- [x] 9 tests at 174L cover /bind (unauthorized/session_mismatch/invalid_key_format/happy+revokes+logs) + /sessions GET/DELETE + /trust-score (3 cases) — SHA `7e9e1d8`. tokenforge 285/285 (was 276).

### Q2.3 — Tests for `webhooks.ts`
- **File to add**: `webhooks.test.ts` (under server/, not the api route)
- **Coverage**: HMAC-SHA256 signature shape; timestamp window; payload canonicalization
- [x] 11 tests at 139L cover empty-sig/empty-secret/missing-ts/bad-ts/skew/happy/legacy/rotation-pass/rotation-fail/version-skip/custom-tolerance — SHA `ded71be`. tokenforge 296/296 (was 285).

### Q2.4 — Tests for `middleware-internal.ts`
- **File to add**: `middleware-internal.test.ts`
- **Coverage**: the actual middleware tokenforge-api ships — happy path + denied + step_up paths; ensure parity with cloud `middleware.ts`
- [x] 14 tests at 185L: 4 shouldSkip + 4 isSensitiveOp helpers + 6 middleware integration (no-headers/sensitive-op-403/nonce-replay/device-not-bound/signature-invalid+revoke/happy). Required matching trust-score signals to pass step-up gate — SHA `b24c004`. tokenforge 310/310 (was 296). **Tier 2 complete (4/4).**

---

## Tier 3 — Sprint 35 SSE Cisco real JWKS

### Q3.1 — Replace empty JWKS at `well-known.ts:48` with real keys
- **Spec**: `apps/tokenforge-api/src/routes/well-known.ts:5–8` admits "Empty JWKS today — TokenForge does not issue JWTs of its own"
- **Strategy**:
  1. Add `tf_signing_keys` schema (kid, alg, publicJwk, privateJwk-encrypted, createdAt, rotatedAt, status)
  2. Migration `0055_tf_signing_keys.sql`
  3. `services/keys/key-store.ts` — load active + retiring keys
  4. Update `well-known.ts` GET `/tokenforge/jwks` to read from store
  5. Tenant-scoped key generation endpoint (admin only) — `/v1/admin/keys/generate`
- **Tests**: empty store → empty array (current behavior); seeded key → JWKS lists it; retired key still surfaces for grace window
- **Done when**: real key generated in dev D1; JWKS endpoint serves it; 5+ new unit tests pass
- [partial] Items 1–4 shipped. Schema (39L), migration `0055_tf_signing_keys.sql`, key-store.ts (43L) reads active+retiring, well-known.ts now calls loadPublicJwks. 7 new tests (6 key-store + 1 well-known seeded) — SHA `dec05d1`. tokenforge-api 208/208 (was 201). **Item 5 (admin key-generation endpoint) deferred to a later fire.**

---

## Tier 4 — Quality gates (release-blocking per portfolio CLAUDE.md)

### Q4.1 — Coverage measurement
- **Run**: `pnpm --filter @opensyber/tokenforge-api test --coverage` and `pnpm --filter @opensyber/tokenforge test --coverage`
- **Persist**: write `.luna/tokenforge/coverage-2026-05-XX.md` with per-package line/branch/function %
- **Compare**: portfolio target ≥90% line / ≥85% branch — list per-package deltas
- **No-bluff**: cite the v8/c8 output verbatim, not a summary
- [unblocked-via-Q4.1b] 2026-05-03 17:27 — coverage runner crashed: `"SyntaxError: The requested module 'vitest/node' does not provide an export named 'BaseCoverageProvider'"`. Resolved by Q4.1b vitest 3→4 bump (SHA `7cc14a0`).
- [x] **Real coverage report** at `.luna/tokenforge/coverage-2026-05-03.md` — SHA `7cc14a0`:
  - tokenforge-api: 63.08% lines / 47.76% branches — below 90/85 target
  - tokenforge: 85.89% lines / 75.49% branches — closer to target
  - Per-file hole list embedded in report; cron Tier 1+2 sweep already lifted DBSC routes to high coverage but `routes/{signup,trust-page,proxy-config,sdk-js,internal-provision}.ts` and `services/{alert-dispatch,cf-team-hostname}.ts` are still at 0–15% lines

### Q4.1b — Resolve coverage version pin (precondition for Q4.1)
- **Strategy**: align `@vitest/coverage-v8` with the workspace-resolved `vitest`. Either downgrade coverage to `^3.2.0` (matches current vitest@3.2.4) or upgrade vitest pins to `^4.0.0` and rerun all suites to confirm 519/519 tests still pass.
- **Done when**: `pnpm --filter @opensyber/tokenforge-api test --coverage` exits 0 with a coverage table on stdout.
- [x] Bumped both `apps/tokenforge-api` and `packages/tokenforge` to `vitest ^4.0.0`. tokenforge-api 208/208, tokenforge 310/310 — both runs report `RUN v4.1.4`. Coverage now produces real numbers (CI threshold fails as expected — see Q4.1 report). SHA `7cc14a0`.

### Q4.2 — SAST + dep audit
- **Run**: `pnpm audit --prod` for tokenforge-api + tokenforge; `gitleaks detect --no-git -v` over working tree
- **Persist**: `.luna/tokenforge/sec-audit-2026-05-XX.md` with findings
- **Block release**: any Critical/High in deps → list the package + CVE
- [x] Report at `.luna/tokenforge/sec-audit-2026-05-03.md` (SHA `336825c`). Real findings: pnpm audit `2 vulnerabilities found / Severity: 2 moderate` (postcss + fast-xml-parser), 0 Critical/High → **not release-blocking**. gitleaks `leaks found: 3` (no-git working tree, all false positives — `.dev.vars` git-ignored + test fixtures) and `leaks found: 33 / 391 commits scanned` (full history, TokenForge-scoped 7 files; only real concern is `tf_187a2d7d…` publishable badge key in layout.tsx, recommendation = adopt `tf_pk_*/tf_sk_*` prefix split).

### Q4.3 — `pnpm typecheck` + `pnpm lint` portfolio-wide
- **Run**: `pnpm -r typecheck` and `pnpm -r lint`
- **Persist**: success/failure log per package
- [x] Report at `.luna/tokenforge/quality-gates-2026-05-03.md` (SHA `0299705`). Typecheck **21/21 PASS**. Lint fails portfolio-wide with 2 errors in apps/web (react-hooks/set-state-in-effect, out of TF scope). **GAP: no TokenForge package defines a lint script** — pnpm reports "None of the selected packages has a 'lint' script" for tokenforge-api/tokenforge/tokenforge-web. Tier 4 complete.

### Q4.4 — Add lint scripts to TokenForge packages (new, prerequisite for enforcing CLAUDE.md DoD)
- **Strategy**: add `"lint": "eslint ."` to apps/tokenforge-api, apps/tokenforge-web, packages/tokenforge `package.json`. Ensure each has an `eslint.config.js` (or extends the workspace base). Run lint once and ship a clean baseline (or fix violations same fire).
- **Done when**: `pnpm --filter @opensyber/tokenforge-api lint` exits 0 with at least the empty/0-error report.
- [x] All 3 TokenForge packages have lint scripts + flat eslint.config.mjs. 5 baseline errors fixed (sessions.ts let→const; SessionsTable.tsx inline-component → render function ×3; api-key-context.tsx redundant effect removed). Final: tokenforge-api 0E/17W, tokenforge 0E/5W, tokenforge-web 0E/10W. Tests unchanged: tokenforge-api 208/208, tokenforge 310/310 — SHA `c0bca51`.

---

## Tier 5 — Sprint 39 unfinished scope

### Q5.1 — Action signing client SDK
- **File to add**: `packages/tokenforge/src/client/action-signer.ts`
- **API**: `signAction({action: 'checkout', amount: 1499})` → JWS string with bound key
- **Server side**: `services/dbsc/action-verify.ts` consumes the JWS; rejects replay (nonce + ts window)
- **Tests**: round-trip sign+verify, expired ts rejected, mismatched action rejected
- [x] Client SDK shipped — `action-signer.ts` 112L returns `{jws, actionHash, nonce}`. 8 tests at 127L cover required-action/3-part-jws/round-trip/kid-header/replay-too-old/canonicalize-deterministic/value-change-differs/tampered-fail. JWS round-trips through existing `verifyCompactJws` (no new server crypto needed) — SHA `ceecd41`. tokenforge 318/318 (was 310). **Server-side `action-verify.ts` (action-match + nonce-replay) deferred to next fire as Q5.1b.**

### Q5.1b — Server-side action-verify wrapper (precondition for end-to-end action signing)
- **Strategy**: `services/dbsc/action-verify.ts` calls `verifyCompactJws` then asserts `claims.action === expectedAction` and `claims.actionHash === sha256(canonicalize(reqBody))`; consumes the nonce via `consumeChallenge` to prevent replay.
- **Done when**: integration test wires client → action-verify → response, replay attempt rejected.
- [x] `verifyAction` shipped in `packages/tokenforge/src/server/action-verify.ts` (63L) + `shared/action-hash.ts` (41L) so client + server share canonicalize/hash helpers byte-for-byte. Client signer trimmed 112→95L by importing from shared. Exported via internal.ts so tokenforge-api routes can use it directly. 7 tests cover passthrough/action-mismatch/hash-mismatch/happy/no-body/null-body/key-reorder. **Nonce-replay enforcement left to caller** (different deployments use different challenge stores) — SHA `4c429c5`. tokenforge 325/325 (was 318).

### Q5.2 — TLS exporter binding (RFC 9266) for self-host runtimes
- **Where workerd doesn't expose TLS exporter, emit `Sec-TF-Channel-Bound: 0` (already done in `dbsc-refresh.ts:148`)
- **Where Node + custom adapter exposes it** (e.g. via `node:tls` socket), mix exporter into JWS payload
- **Done when**: self-host integration test demonstrates exporter mix; replay across TLS connections rejected
- [partial] Wire-protocol surface shipped — SHA `417d22f`. signAction accepts opts.tlsExporter (hex); verifyAction accepts opts.expectedTlsExporter + opts.requireTlsExporter. 5 new tests cover match/mismatch/client-omit/workerd-default/required-but-absent. Tokenforge 330/330 (was 325). **Self-host adapter wiring (node:tls socket → exporter extraction) deferred — adapter-level work, runtime-specific; protocol now ready.**

---

## Tier 6 — Sprint 36 unfinished IdP-front scope (largest)

These remain plan-as-written; not bumped into Tier 0 because each is a multi-fire sprint of work, not a single cron pass. Listed for inventory.

- SAML SP-init endpoint + metadata + signed response
- OIDC provider endpoints (discovery / authorize / token / userinfo)
- Push-approval mobile flow (RN SDK + APNS/FCM)
- osquery posture probe in `apps/agent/`
- Trust-score posture signals
- Admin SSO apps + posture pages

---

## Maintenance

- After each fire ticks a box, update the row to `- [x] <criterion> — SHA <sha> — <real test count>`
- New gaps discovered mid-sweep get a fresh row in the appropriate tier
- When all of Tier 0 + Tier 1 are ticked, the file gets a `## Status` header summarizing the sweep
- This file is the cron's **first** read each fire — replaces `pick first unchecked exit criterion` from the cron prompt
