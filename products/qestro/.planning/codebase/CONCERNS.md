# Codebase Concerns

**Analysis Date:** 2026-04-22

## Summary

The codebase is feature-rich and deploy-target-diverse, but it carries elevated operational complexity due to duplicated API surfaces, mixed runtime assumptions (Node vs Workers), and inconsistent enforcement of testing/linting rigor between packages.

## High Priority Concerns

## 1) Multiple API surfaces with overlapping scope

**Risk:** Behavior drift, duplicated fixes, and unclear source-of-truth for routes/services.

**Evidence:**
- Parallel API entrypoints in `backend/src/index.ts`, `src/index.ts`, and `apps/api/src/index.ts`.
- Similar route domains spread across `backend/src/routes/`, `src/routes/`, and `apps/api/src/routes/`.

**Impact:** New features and bug fixes can land in one surface while others remain stale.

**Recommendation:**
- Document per-surface ownership and canonical endpoint responsibility.
- Add a short "route authority matrix" under `.planning/codebase/ARCHITECTURE.md` or `/docs`.

## 2) Runtime boundary mismatch (Node-first dependencies in Worker targets)

**Risk:** Production-only failures when Worker runtime lacks Node APIs or package compatibility.

**Evidence:**
- Worker deployment focus in `wrangler.toml` + `backend/wrangler.toml`.
- Rich dependency set in `backend/package.json` including Node-centric integrations.

**Impact:** Integration code can pass local tests yet fail at edge deployment/runtime.

**Recommendation:**
- Add CI check that validates Worker bundles for disallowed Node APIs.
- Separate Worker-safe adapter modules from Node-only modules by folder convention.

## 3) Secrets and environment sprawl

**Risk:** Misconfigured deployments, shadowed env values, accidental secret exposure.

**Evidence:**
- Multiple `.env*` templates/variants at root and package level.
- Cloudflare and non-Cloudflare deployment paths in parallel.
- Historical secret-hygiene warnings captured in `CLAUDE.md`.

**Impact:** Changes may appear successful while targeting inactive environments.

**Recommendation:**
- Define a single source-of-truth env map per deploy target.
- Add automated validation script for required envs before deploy commands.

## Medium Priority Concerns

## 4) Inconsistent lint and test strictness by subsystem

**Risk:** Quality drift and uneven confidence in changes.

**Evidence:**
- Different ESLint/Prettier posture across root, frontend, backend, and mobile configs.
- Coverage thresholds vary (for example backend thresholds relaxed in `backend/jest.config.js`).

**Impact:** Bugs and style regressions are more likely in less-strict packages.

**Recommendation:**
- Establish baseline minimums for all packages, then tighten over phases.
- Track waiver exceptions explicitly in one markdown ledger.

## 5) Large files and route bloat in legacy areas

**Risk:** High cognitive load and fragile edits in long-lived files.

**Evidence:**
- Existing tech-debt notes in `CLAUDE.md` call out oversized route files.
- Service/controller modules include mixed concerns in single files.

**Impact:** Refactoring cost rises; merge conflicts and subtle regressions increase.

**Recommendation:**
- Introduce incremental split plans during upcoming phases (per route/service domain).
- Require "one concern per module" for new code.

## 6) Test matrix breadth vs execution reliability

**Risk:** Slow or flaky CI loops reduce trust in green pipelines.

**Evidence:**
- Multiple frameworks (Jest, Vitest, Playwright, Maestro) and large suite surface in `tests/`.
- Browser/mobile and integration paths depend on infra and external providers.

**Impact:** Teams may skip full-suite runs, reducing release confidence.

**Recommendation:**
- Tier suites into fast/standard/full gates and enforce fast gate on every PR.
- Track flake rate for E2E tests and quarantine unstable tests with owners.

## Lower Priority Concerns

## 7) Documentation drift risk in fast-moving monorepo

**Risk:** Planning and architecture docs become stale after rapid feature work.

**Evidence:**
- Large volume of operational and planning markdown files at repo root and `docs/`.

**Impact:** New contributors and automation agents may rely on outdated assumptions.

**Recommendation:**
- Add periodic doc refresh checkpoints in workflow (`$gsd-map-codebase` cadence).
- Link docs to concrete file paths and update timestamps.

## Suggested Stabilization Sequence

1. Confirm API surface ownership and route authority.
2. Enforce Worker runtime compatibility checks in CI.
3. Normalize deploy/env source-of-truth and preflight validation.
4. Raise minimum lint/coverage bars gradually.
5. Chip away at oversized route/service modules while delivering features.

---

*Concerns analysis: 2026-04-22*
# Codebase Concerns

**Analysis Date:** 2026-04-22

## Tech Debt

**Billing and subscription enforcement is partially stubbed:**
- Issue: Core usage accounting and plan enforcement paths are incomplete, with TODOs and null-return paths in live service code.
- Files: `backend/src/services/SubscriptionService.ts`, `backend/src/services/AIService.ts`, `backend/src/middleware/usageTrackingMiddleware.ts`, `backend/src/routes/payments.ts`
- Impact: Limits can be bypassed, billing state can drift from real usage, and plan-gated functionality can behave inconsistently.
- Fix approach: Implement persistent usage tables and read/write paths, then enforce limits from DB-backed counters before execution/billing-sensitive operations.

**Execution stack still simulates critical behavior:**
- Issue: Test execution service emits synthetic progress and always returns simulated passing output instead of running real Playwright code.
- Files: `backend/src/services/PlaywrightExecutorService.ts`
- Impact: Results can misrepresent system quality, causing false confidence in run status and downstream analytics.
- Fix approach: Replace simulation path with real browser lifecycle execution, artifact capture, timeout handling, and deterministic failure propagation.

**Data source routes use placeholder persistence:**
- Issue: Data source CRUD/helper functions are placeholders returning empty/null responses and logs.
- Files: `backend/src/routes/datasources.ts`
- Impact: Connected data source workflows silently degrade, and feature behavior diverges between UI and backend expectations.
- Fix approach: Implement real repository methods with ownership checks, transactional writes, and integration tests against D1/Postgres adapters.

**Database abstraction has null placeholder exports:**
- Issue: Database layer exposes `null` placeholders and optional `require()` fallbacks for critical query helpers.
- Files: `backend/src/database/drizzle.ts`
- Impact: Runtime behavior depends on startup environment, increasing risk of late failures and inconsistent module contracts.
- Fix approach: Remove placeholder exports, enforce typed initialization at startup, and fail fast if ORM bindings are unavailable.

## Known Bugs

**Active subscription plan mapping appears inconsistent:**
- Symptoms: Active subscription lookup maps `planId` from a `plan` property that is not consistently written in the same service.
- Files: `backend/src/services/SubscriptionService.ts`, `backend/src/config/subscriptionPlans.ts`
- Trigger: Any flow that reads plan-dependent limits/features from `getActiveSubscription()` data.
- Workaround: Normalize plan reads to `planId` and add compatibility mapping during migration if historical records differ.

**Flaky analytics endpoint always returns empty results:**
- Symptoms: API responds with successful payload but zero flaky tests regardless of project history.
- Files: `backend/src/routes/flaky.routes.ts`
- Trigger: Calls to `/api/analytics/flaky` in dashboards or analytics views.
- Workaround: Wire endpoint to test run history tables and detector logic, then guard with feature flag until data source is populated.

**Payment capability endpoints intentionally return 501:**
- Symptoms: Payment method updates, promo codes, and portal access return not implemented responses.
- Files: `backend/src/routes/payments.ts`
- Trigger: Frontend billing actions invoking `/payment-method`, `/payment-methods`, `/promo-code`, `/portal`.
- Workaround: Hide/disable unfinished UI actions behind capability flags until backend handlers are complete.

## Security Considerations

**WebSocket authentication accepts user identity without JWT verification:**
- Risk: Any client can claim arbitrary `userId` and join user-scoped channels.
- Files: `backend/src/services/WebSocketService.ts`
- Current mitigation: Connection metadata and event logging only; no cryptographic validation.
- Recommendations: Require signed token verification in socket auth flow, bind connection identity to verified claims, and reject unauthenticated room joins.

**Security-critical secrets have insecure defaults:**
- Risk: Deployments without explicit env config can run with fallback secrets like `default-secret`.
- Files: `backend/src/config/config.ts`, `src/services/sso/provider-manager.ts`
- Current mitigation: Environment-based overrides exist.
- Recommendations: Remove insecure defaults, enforce startup validation for required secrets, and fail boot in non-test environments when missing.

**Sensitive token handling appears in logs and mock auth paths:**
- Risk: Password reset tokens are logged, and multiple auth/profile/password operations remain mock implementations.
- Files: `src/api/auth.ts`, `src/services/auth-service.ts`
- Current mitigation: KV expiry for reset tokens and basic auth error handling.
- Recommendations: Remove token logging, complete real password update/verification flows, and add audit logs for auth-sensitive state transitions.

**Weak cryptography utilities are available for password/encryption use:**
- Risk: SHA-256 password hashing + manual salt and XOR-based encryption are not suitable for credential or sensitive data protection.
- Files: `shared/utils/index.ts`
- Current mitigation: Inline comments warn that these are not production-grade.
- Recommendations: Migrate to `argon2`/`bcrypt` for password hashing, replace XOR with standard AEAD primitives, and prohibit insecure helpers in production paths.

## Performance Bottlenecks

**Timer-heavy orchestration can over-allocate intervals at runtime:**
- Problem: Health checks and polling jobs create per-endpoint/per-integration intervals; cron parsing is simplified to fixed 5-minute intervals.
- Files: `backend/src/services/APIManagementService.ts`
- Cause: Interval-per-resource model and coarse schedule parsing.
- Improvement path: Centralize scheduling queue, deduplicate timers, and use real cron parser with bounded worker pool/backpressure.

**Request path includes dynamic module import for subscription limit routing:**
- Problem: Recording routes dynamically import subscription service during request processing.
- Files: `backend/src/routes/recordingRoutes.ts`
- Cause: Runtime import within middleware.
- Improvement path: Move imports to module scope, cache service instance, and profile route latency before/after change.

**Unbounded retry loop risks endless resource consumption:**
- Problem: Retry utility includes `while (true)` exponential backoff with no max attempts.
- Files: `shared/utils/index.ts`
- Cause: Infinite retry strategy without circuit breaker.
- Improvement path: Add max attempt/time budget, failure classification, and cancellation support.

## Fragile Areas

**Large multi-responsibility services are difficult to modify safely:**
- Files: `backend/src/services/APIManagementService.ts`, `src/services/analytics-reporting.ts`, `src/services/mobile/DeviceManager.ts`
- Why fragile: High line count and mixed concerns (API lifecycle, scheduling, sync, reporting, provider logic) increase coupling and regression risk.
- Safe modification: Isolate by domain modules (scheduler, provider adapter, persistence, transport), then add contract tests per module boundary.
- Test coverage: Gaps around full end-to-end behavior under concurrency and timer-driven state changes.

**Mock and placeholder routes coexist with production-facing contracts:**
- Files: `backend/src/mockRoutes.ts`, `backend/src/routes/webRecording.ts`, `backend/src/routes/datasources.ts`
- Why fragile: Behavior can differ across environments, and unfinished routes are easy to expose accidentally.
- Safe modification: Gate mock routes with explicit environment checks and centralized feature flags.
- Test coverage: Add route-level tests asserting mock endpoints are disabled in production configurations.

**Billing and plan checks rely on partially implemented internals:**
- Files: `backend/src/services/SubscriptionService.ts`, `backend/src/middleware/usageTrackingMiddleware.ts`, `backend/src/services/AIService.ts`
- Why fragile: Plan checks call into methods that return `null`/fallback or TODO branches, making policy outcomes implicit.
- Safe modification: Implement deterministic policy engine over persisted usage/subscription state.
- Test coverage: Add matrix tests per plan for recording, execution, API, and storage limits.

## Scaling Limits

**Worker concurrency defaults are static and low for burst workloads:**
- Current capacity: `MAX_CONCURRENT_JOBS` defaults to `10` and `JOB_TIMEOUT` defaults to `300000`.
- Limit: Queue latency grows quickly with bursty test execution volume.
- Scaling path: Add autoscaled worker fleet, per-tenant concurrency controls, and queue-depth-driven scaling policies.

**Connector generation has fixed per-user cap:**
- Current capacity: `MCPOVERFLOW_MAX_CONNECTORS_PER_USER` defaults to `50`.
- Limit: High-volume integration users hit hard cap regardless of tier/usage patterns.
- Scaling path: Move to plan-aware quota model and apply archival/cleanup workflows for stale connectors.

**SSO manager constrains concurrent auth requests:**
- Current capacity: `maxConcurrentAuthRequests` set to `100`.
- Limit: High-traffic enterprise SSO events can saturate auth pipeline.
- Scaling path: Introduce distributed queueing and horizontal partitioning per provider/tenant.

## Dependencies at Risk

**Drizzle ORM availability is optional in one integration layer:**
- Risk: Query helper exports can degrade to null if module resolution fails.
- Impact: Runtime failures in services that assume active ORM primitives.
- Migration plan: Enforce hard dependency and typed initialization contract in startup bootstrap.

**Dual billing-provider surface increases integration drift risk:**
- Risk: Stripe and LemonSqueezy flows coexist with partially implemented routes and plan IDs.
- Impact: Subscription state mismatches and webhook handling inconsistencies.
- Migration plan: Choose primary billing provider per environment, unify plan identity mapping, and enforce webhook contract tests.

## Missing Critical Features

**Production-grade payment lifecycle is incomplete:**
- Problem: Payment method management, promo logic, and customer portal are unimplemented.
- Blocks: Full self-serve billing management and support for common subscription operations.

**Recording execution lifecycle is incomplete in route surface:**
- Problem: Execution-related recording routes are commented out pending controller readiness.
- Blocks: End-to-end recording-to-execution workflows and feature parity across plans.

## Test Coverage Gaps

**Security-critical fallback and TODO paths are under-validated:**
- What's not tested: JWT enforcement in WebSocket auth path, default-secret boot failure behavior, and password reset token logging prevention.
- Files: `backend/src/services/WebSocketService.ts`, `backend/src/config/config.ts`, `src/api/auth.ts`
- Risk: Security regressions can ship undetected in auth/session flows.
- Priority: High

**Billing placeholder endpoints and incomplete usage tracking lack enforcement tests:**
- What's not tested: Behavior for unimplemented billing endpoints and DB-backed limit enforcement under real usage accumulation.
- Files: `backend/src/routes/payments.ts`, `backend/src/services/SubscriptionService.ts`, `backend/src/middleware/usageTrackingMiddleware.ts`
- Risk: Plan enforcement and billing UX regressions remain invisible until production usage.
- Priority: High

**Timer/scheduler load behavior lacks stress coverage:**
- What's not tested: Interval lifecycle correctness and resource behavior under high endpoint/integration counts.
- Files: `backend/src/services/APIManagementService.ts`, `backend/src/workers/testExecutor.ts`
- Risk: Memory/timer leaks and delayed job execution under scale.
- Priority: Medium

---

*Concerns audit: 2026-04-22*
