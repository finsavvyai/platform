# Codebase Concerns

**Analysis Date:** 2026-04-22

## Tech Debt

**Gateway handlers return placeholders or mock data for production routes:**
- Issue: Several mounted gateway handlers still contain TODO-backed placeholder behavior instead of integrated persistence/services.
- Files: `services/gateway/internal/interfaces/http/handlers/file_management.go`, `services/gateway/internal/interfaces/http/handlers/rag.go`, `services/gateway/internal/interfaces/http/handlers/auth.go`, `services/gateway/internal/interfaces/http/handlers/memory.go`
- Impact: API contracts may return synthetic data, masking integration gaps and creating false-positive health during manual testing.
- Fix approach: Replace each TODO path with concrete repository/service calls, then add handler-level integration tests per route.

**Policy management internals contain non-functional resolution paths:**
- Issue: Conflict and version management code paths acknowledge operations but do not implement core logic (priority/merge/removal, impact analysis, sorting).
- Files: `services/gateway/internal/policy/conflict_detector.go`, `services/gateway/internal/policy/version_manager.go`, `services/gateway/internal/policy/bundle_manager.go`
- Impact: Policy operations appear successful while correctness and rollback safety are not guaranteed.
- Fix approach: Implement rule mutation workflows and deterministic version ordering, then add storage-backed tests for each conflict/rollback scenario.

**High volume of excluded Go files causes architecture drift:**
- Issue: Many gateway files are excluded with `//go:build ignore`, including middleware and service paths.
- Files: `services/gateway/internal/infrastructure/middleware/auth.go`, `services/gateway/internal/infrastructure/middleware/policy_enforcement.go`, `services/gateway/internal/infrastructure/storage/retention_cleanup_service.go`, `services/gateway/internal/interfaces/http/handlers/file_management.go`, `services/gateway/cmd/auth-server/main.go`
- Impact: "Intended" implementations can diverge from compiled runtime behavior and create misleading maintenance paths.
- Fix approach: Either remove ignored legacy paths or promote selected ones into the active build with compatibility tests guarding the migration.

## Known Bugs

**Login endpoint is not actually public in the active gateway chain:**
- Symptoms: `/api/v1/auth/login` sits behind auth middleware, so unauthenticated requests are rejected before login handler execution.
- Files: `services/gateway/cmd/server/router.go`, `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/interfaces/http/routes/routes.go`
- Trigger: POST to `/api/v1/auth/login` without `Authorization: Bearer ...`.
- Workaround: Send any non-empty bearer token to pass chain auth; this is not a valid production behavior.

**Request context contract mismatch breaks authenticated business handlers:**
- Symptoms: Multiple handlers expect `ctx.Value("user_id")` to be `uuid.UUID`, but active chain middleware only stores `CtxKeyAuthSub` and tenant context.
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/interfaces/http/handlers/user.go`, `services/gateway/internal/interfaces/http/handlers/document.go`, `services/gateway/internal/interfaces/http/handlers/rag.go`, `services/gateway/internal/interfaces/http/handlers/auth.go`
- Trigger: Call authenticated endpoints that require `user_id` context after passing simple bearer check.
- Workaround: None in active chain; requires middleware wiring or handler contract change.

## Security Considerations

**Authentication bypass via non-validated bearer subject:**
- Risk: Any non-empty bearer token is accepted as identity, without signature, expiry, issuer, or audience validation.
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/interfaces/http/middleware/chain_test.go`
- Current mitigation: Header presence and prefix checks only.
- Recommendations: Integrate real JWT/API key validation and bind validated claims to typed context values.

**Authorization middleware is wired but non-enforcing:**
- Risk: Policy step in active chain does not deny/allow based on policy engine output.
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`
- Current mitigation: None in active execution path (pass-through behavior).
- Recommendations: Execute policy decision before `next.ServeHTTP`, deny on explicit policy failure, and test with allow/deny fixtures.

**Tenant trust boundary relies on caller-controlled headers:**
- Risk: Tenant identity and rate-limit partitioning can be set by `X-Tenant-ID`, which is not cryptographically bound to a verified identity.
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/infrastructure/ratelimit/tier_rate_limiter.go`
- Current mitigation: Optional fallback to auth subject when header missing.
- Recommendations: Derive tenant from validated token claims and reject mismatches between claim tenant and header tenant.

**Gateway worker JWT verification is explicitly simplified:**
- Risk: Manual token parsing path can be bypassed or drift from secure verification expectations.
- Files: `services/gateway-worker/src/index.ts`
- Current mitigation: Comment-level guidance only.
- Recommendations: Replace helper with a vetted JWT library and enforce claim validation centrally.

## Performance Bottlenecks

**Per-request Redis pressure in rate limiting pipeline:**
- Problem: Active limiter performs concurrent tracking plus minute/hour/day checks for each request.
- Files: `services/gateway/internal/infrastructure/ratelimit/tier_rate_limiter.go`
- Cause: Multiple Redis operations per request (`INCR/EXPIRE` windows + concurrent counters).
- Improvement path: Use Lua-scripted batched checks, endpoint bucketing only where needed, and local short-lived token cache for hot tenants.

**Unbounded audit log access pattern in worker endpoint:**
- Problem: Audit logs endpoint reads ordered rows directly with caller-provided pagination only.
- Files: `services/gateway-worker/src/index.ts`
- Cause: No tenant predicate and no indexed filter constraints in the query path.
- Improvement path: Add tenant/user scoping and indexed cursor pagination.

## Fragile Areas

**Middleware/handler identity model inconsistency:**
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/interfaces/http/handlers/*.go`
- Why fragile: Handlers assume strongly typed identity context that chain does not provide.
- Safe modification: Define a single typed auth context struct and enforce it in middleware contract tests before handler execution.
- Test coverage: Missing end-to-end tests covering authenticated CRUD endpoints with context propagation.

**Dual middleware implementations with different behavior:**
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/infrastructure/middleware/middleware.go`, `services/gateway/internal/infrastructure/middleware/auth.go`
- Why fragile: Active and ignored middleware stacks encode different auth/rate-limit semantics.
- Safe modification: Keep one canonical middleware tree in compiled path and archive or delete obsolete alternates.
- Test coverage: Current tests validate chain basics but do not prove full parity with infrastructure middleware intentions.

## Scaling Limits

**Single global endpoint bucket reduces fairness under mixed traffic:**
- Current capacity: Rate checks are applied against endpoint key `"global"` in middleware path.
- Limit: Heavy traffic on one route can consume shared request budgets for unrelated operations.
- Scaling path: Split buckets by route groups (`auth`, `query`, `upload`, `admin`) and reserve budgets per critical path.

**Unimplemented retention and lifecycle automation blocks storage growth control:**
- Current capacity: Retention cleanup scaffolding exists but matching/actions/scheduling are TODOs.
- Limit: Data lifecycle cost and storage growth are unbounded for tenants using file-heavy workflows.
- Scaling path: Implement scheduled policy-driven cleanup with dry-run reports and progressive rollout by tenant.

## Dependencies at Risk

**Packaging artifacts are generated in repo paths without ignore coverage:**
- Risk: Build metadata and generated artifacts can be accidentally committed, creating noisy diffs and release drift.
- Impact: Reproducibility and review quality degrade when generated metadata changes unexpectedly.
- Migration plan: Add ignore rules for generated packaging artifacts and gate CI to reject accidental metadata-only commits.
- Files: `packages/sdk-py/sdlc_sdk.egg-info/PKG-INFO`, `packages/sdk-py/sdlc_sdk.egg-info/SOURCES.txt`, `.gitignore`

## Missing Critical Features

**MFA verification is declared but not enforced:**
- Problem: Login flow branches on MFA requirement but does not validate `MFACode`.
- Blocks: Reliable step-up authentication and compliance-grade account protection.
- Files: `services/gateway/internal/interfaces/http/handlers/auth.go`

**Policy and RAG integrations are exposed before real backend wiring:**
- Problem: Public API surfaces for policy evaluate/query return mock or placeholder results.
- Blocks: Trustworthy enforcement and retrieval quality in production workflows.
- Files: `services/gateway/internal/interfaces/http/handlers/rag.go`, `services/gateway-worker/src/index.ts`, `apps/gateway-go/main.go`

## Test Coverage Gaps

**No behavior tests for gateway file/RAG handler implementations:**
- What's not tested: Real route-level behavior for `RAGQuery`, `IngestDocument`, `SearchDocuments`, and file management endpoints in active gateway routing.
- Files: `services/gateway/internal/interfaces/http/handlers/rag.go`, `services/gateway/internal/interfaces/http/handlers/file_management.go`, `services/gateway/cmd/server/router_e2e_test.go`
- Risk: Placeholder and permission regressions can ship undetected.
- Priority: High

**No regression test for auth-path accessibility and identity propagation contract:**
- What's not tested: `/api/v1/auth/login` unauthenticated accessibility and `user_id` context propagation to authenticated handlers.
- Files: `services/gateway/cmd/server/router.go`, `services/gateway/internal/interfaces/http/middleware/chain.go`, `services/gateway/internal/interfaces/http/handlers/auth.go`
- Risk: Authentication flow breakage and silent 401 behavior across core endpoints.
- Priority: High

**No policy enforcement tests in active middleware chain:**
- What's not tested: Deny/allow behavior of policy middleware in compiled chain.
- Files: `services/gateway/internal/interfaces/http/middleware/chain.go`
- Risk: Authorization bypass can persist while middleware appears present.
- Priority: High

---

*Concerns audit: 2026-04-22*
