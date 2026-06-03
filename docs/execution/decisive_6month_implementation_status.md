# Decisive 6-Month Plan - Implementation Status

Status date: 2026-05-26

This tracks repo-local execution for `decisive_plan_90day.md` /
`decisive_plan_90day.html`. The document names are legacy; the plan has been
reframed as a 6-month execution plan with a first-90-days proof phase.

## Week 1 repo-local status

| Item | Status | Evidence / next step |
|---|---|---|
| Reframe plan scope | Done | HTML and Markdown now describe a 6-month execution plan: first 90 days prove, second 90 days close. |
| Add MIT license to `oss/a2a-framework/` | Done | `oss/a2a-framework/LICENSE` exists and is MIT. |
| Add MIT license to `portfolio/a2a-framework/` | Blocked | No `portfolio/a2a-framework/` path exists in this repo. |
| Halt looma-sh archive sweep | Done | `_archive/externalized/looma-sh/SPIN_OUT_PLAN.md` and prior archive manifest now mark ON HOLD / externalize. |
| Halt pixel-pets archive sweep | Done | `_archive/externalized/pixel-pets/EXTERNALIZE_PLAN.md` and prior archive manifest now mark ON HOLD / externalize. |
| Reclassify autoboot / FastPM product | Done in repo | `_archive/fastpm-2026-05/ARCHIVED.md` confirms ARCHIVE classification. Domain redirect/takedown remains external ops. |
| Promote QueryFlux to core product | Already present | `products/queryflux/` exists. `pnpm-workspace.yaml` deliberately excludes `products/*` per repo rule, so no workspace change was made. |
| Move old open-source holding area | Done in repo | `infrastructure/vendored/opensource/` exists and now has a README marking its contents as third-party. |

## Founder-owned Week 1 items

| Item | Status |
|---|---|
| Approve the reframed plan | Pending founder sign-off |
| Send three design-partner intro emails | Pending founder action |
| Schedule ComplyAdvantage intro call | Pending founder action |
| Schedule LSEG / Refinitiv data-licensing intro | Pending founder action |
| Redirect or take down `fastpm.dev` | Pending external ops |

## Next implementation slice

Implemented: `POST /v1/brain/sar-draft` is now mounted when a host provides
a `sarDraft.generator` in `BrainApiConfig`. The endpoint validates tenant
scope, calls the SAR Draft generator, emits exactly one API audit record,
and rejects any generated draft that disables human review.

Implemented next: `HttpSarDraftGenerator` now provides production wiring
for the generator port. It POSTs alert payloads to a separately hosted SAR
Draft runtime, parses both `{ok, draft}` and bare draft responses, rejects
malformed or non-human-review drafts, maps non-2xx responses to
`upstream_error`, and maps transport failures to stable error codes.

Implemented next: `createBrainHostApp()` now composes `createBrainApp()`
with either an explicit SAR generator or `sarDraftRuntime` HTTP config. It
rejects ambiguous generator wiring and leaves the SAR route unmounted when
no SAR generator config is supplied.

Implemented next: `services/api/src/worker.ts` exposes a Worker-style
`fetch` boundary, reads explicit deployment bindings, wires bearer auth,
optional R2 audit writes, and optional SAR runtime HTTP config.

Implemented next: `services/agents/sar-draft/src/sar_draft/http_runtime.py`
defines the Python-side `{ok, draft}` HTTP envelope consumed by the TS
`HttpSarDraftGenerator`.

Implemented next: `HttpSearchAdapter` wires Brain search to a separately
hosted `oss/finsavvy-rag` runtime. Host and Worker config now accept
`searchRuntime` / `BRAIN_SEARCH_*` settings and mount `POST /v1/search`
when configured.

Implemented next: the Worker shell now supports configured HS256 JWT auth
via `BRAIN_JWT_HS256_SECRET`, `BRAIN_JWT_ISSUER`, and
`BRAIN_JWT_AUDIENCE`, while retaining `BRAIN_AUTH_TOKEN` only as a local
smoke-test fallback. This keeps Brain inside the product boundary without
direct `@finsavvyai/auth` imports.

Remaining work is external deployment/configuration: set real runtime URLs,
secrets, R2 bindings, DNS, and design-partner/founder GTM actions. A future
platform host may replace HS256 with RS256/JWKS by injecting `AuthVerifier`
through `createBrainHostApp()`.

Implemented next: shared platform packages for the addendum foundation
stream are now verified as spec/reference packages under the round-2
isolation rule. `@finsavvyai/ai-gateway`, `@finsavvyai/billing`,
`@finsavvyai/telemetry`, `@finsavvyai/auth`,
`@finsavvyai/policy-engine`, and `@finsavvyai/shared-types` all pass
workspace test/typecheck/build. The main marketing website build warning
from an accidental Astro content collection was removed by moving pricing
data from `src/content/` to `src/data/`.

Implemented next: closed the SOC 2 CC6.2 JWT revocation repo-local gap.
`packages/auth` now exports `RedisJtiStore`, a Redis-compatible JTI
deny-list adapter that hashes token IDs into namespaced keys and stores
revocations with Redis TTL semantics. `verifyToken()` already consumed
`JtiRevocationStore`, so production hosts can now inject the Redis store
without changing JWT verification code.

Implemented next: closed the SOC 2 PI1.2 Brain route-boundary schema gap.
`POST /v1/search` and `POST /v1/brain/sar-draft` now parse request bodies
through Zod schemas while preserving the existing stable error-code
surface. Tenant claims remain guarded by the tenant regex validator.

Implemented next: closed the security hardening short-lived token rotation
gap. `packages/auth` now exports `rotateTokenIfNeeded`, which verifies the
current JWT through the existing alg-pinned path, rotates only inside a
configured renewal window, preserves custom claims, and can revoke the old
JTI via the injected deny-list store.

Implemented next: closed the SOC 2 P4.2 audit-retention repo-local gap.
Brain now exports `purgeExpiredAuditObjects`, a tenant-scoped R2 retention
purger with default 7-year retention, tenant-id validation, dry-run mode,
delete caps, and cursor continuation for safe staging exercises before
production deletion.

Implemented next: closed the SOC 2 CC9.2 vendor-risk repo-local gap.
The vendor risk register now has a structured JSON source of truth, a
walkthrough document, required critical vendor IDs, per-vendor owners,
mitigations, evidence links, and a Node validator that fails when required
vendors, quarterly review dates, or evidence paths drift.

Implemented next: closed the SOC 2 A1.3 recovery-from-disruption
repo-local gap. The Cloudflare disruption DR runbook now defines triggers,
roles, RTO/RPO, degraded modes, data recovery sources, recovery gates, and
quarterly tabletop evidence, with a validator that keeps the SOC 2 mapping
linked to rollback and incident-response evidence.

Implemented next: closed incident-readiness TBDs in the compliance
package. Postmortem, FinCEN, OFAC, and EU DPA templates now exist;
audit-chain HEAD divergence has a SEV1 runbook; the on-call document no
longer carries placeholder wording for provider IDs; and a validator keeps
those incident-response links intact.

Implemented next: wired compliance readiness into the project gate.
The root `compliance:check` script runs vendor-risk, DR-readiness, and
incident-readiness validators, and CI now has a dedicated
`compliance-readiness` job so those evidence packages cannot drift
silently.

## Verification

| Check | Result |
|---|---|
| `pnpm test` in `products/amliq/brain` | Passed: 24 test files, 237 tests. |
| `pnpm typecheck` in `products/amliq/brain` | Passed. |
| `pnpm build` in `products/amliq/brain` | Passed. |
| Static HTML framing check | Passed: title, scope frame, and old `Decisive 90-Day Plan` title removal verified. |

Post-SAR API slice:

| Check | Result |
|---|---|
| `pnpm test` in `products/amliq/brain` | Passed: 30 test files, 276 tests. |
| `pnpm typecheck` in `products/amliq/brain` | Passed. |
| `pnpm build` in `products/amliq/brain` | Passed. |
| `git diff --check` | Passed. |
| `./.venv/bin/pytest tests` in `services/agents/sar-draft` | Passed: 63 tests, 99% total coverage. |
| `pnpm vitest run services/api/src/sar-draft` | Passed: 2 test files, 16 tests. |
| `pnpm vitest run services/api/src/runtime.test.ts` | Passed: 1 test file, 3 tests. |
| `pnpm vitest run services/api/src/worker.test.ts` | Passed: 1 test file, 4 tests. |
| `./.venv/bin/pytest tests` after SAR HTTP contract | Passed: 68 tests, 99% total coverage. |
| `pnpm vitest run services/api/src/search/http-adapter.test.ts services/api/src/runtime.test.ts services/api/src/worker.test.ts` | Passed: 3 test files, 16 tests. |
| `pnpm vitest run services/api/src/worker-auth.test.ts services/api/src/worker.test.ts` | Passed: 2 test files, 12 tests. |

Post-platform verification:

| Check | Result |
|---|---|
| `pnpm -r typecheck` | Passed: workspace packages and observability. |
| `pnpm -r test` | Passed: workspace packages, observability, and website declared test exception. |
| `pnpm -r build` | Passed after website content-folder warning cleanup. |
| `pnpm --filter @finsavvyai/website-finsavvyai-com build` | Passed with no Astro auto-generated collection warning. |

Post-auth hardening:

| Check | Result |
|---|---|
| `pnpm --filter @finsavvyai/auth test` | Passed: 12 files passed, 1 skipped gap ledger; 111 passed, 7 todo. |
| `pnpm --filter @finsavvyai/auth typecheck` | Passed. |
| `pnpm --filter @finsavvyai/auth build` | Passed. |

Post-Brain input hardening:

| Check | Result |
|---|---|
| `pnpm vitest run services/api/src/search/request-schema.test.ts services/api/src/search/search-handler.test.ts services/api/src/sar-draft/request-schema.test.ts services/api/src/sar-draft/sar-draft-handler.test.ts` | Passed: 4 files, 19 tests. |
| `pnpm typecheck` in `products/amliq/brain` | Passed. |
| `pnpm test` in `products/amliq/brain` | Passed: 32 files, 280 tests. |
| `pnpm build` in `products/amliq/brain` | Passed. |

Post-token-rotation hardening:

| Check | Result |
|---|---|
| `pnpm --filter @finsavvyai/auth test` | Passed: 12 files passed, 1 skipped gap ledger; 116 passed, 7 todo. |
| `pnpm --filter @finsavvyai/auth typecheck` | Passed. |
| `pnpm --filter @finsavvyai/auth build` | Passed. |

Post-retention hardening:

| Check | Result |
|---|---|
| `pnpm vitest run services/api/src/audit-prod/retention.test.ts` | Passed: 1 file, 5 tests. |
| `pnpm typecheck` in `products/amliq/brain` | Passed. |
| `pnpm test` in `products/amliq/brain` | Passed: 33 files, 285 tests. |
| `pnpm build` in `products/amliq/brain` | Passed. |

Post-vendor-risk hardening:

| Check | Result |
|---|---|
| `node tools/validate-vendor-risk.mjs` | Passed: 4 vendors, 3 required. |

Post-DR-readiness hardening:

| Check | Result |
|---|---|
| `node tools/validate-dr-readiness.mjs` | Passed. |

Post-incident-readiness hardening:

| Check | Result |
|---|---|
| `node tools/validate-incident-readiness.mjs` | Passed. |

Post-CI-wiring hardening:

| Check | Result |
|---|---|
| `pnpm compliance:check` | Passed. |
