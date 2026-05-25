# Production Readiness Plan

**Started:** 2026-04-22  
**Status:** In Progress

## Objective

Prepare `sdlc-platform` for a production-grade launch with strong security, reliability, and operational readiness while preserving the current product roadmap.

## Exit Criteria

- Authentication and tenant isolation are enforced end-to-end.
- Policy enforcement is active (deny/allow behavior validated).
- Core API routes return real backend behavior (no placeholder responses).
- Critical-path integration tests pass in CI.
- Observability and alerting cover auth, gateway, RAG, and billing paths.
- Production deployment runbooks and rollback paths are validated.

## Wave 1 (Start Now): Security + Correctness Blockers

### 1) Identity and access hardening

- [ ] Replace permissive bearer checks with real JWT/API-key validation in gateway middleware.
- [ ] Standardize typed auth context used by all handlers.
- [ ] Derive tenant identity from verified claims; reject header/claim mismatch.
- [ ] Enforce MFA verification branch where declared in auth flow.

### 2) Policy enforcement hardening

- [ ] Make middleware enforce deny/allow decisions (no pass-through on protected paths).
- [ ] Add tests for explicit deny and allow scenarios.
- [ ] Validate policy failures produce safe, deterministic API responses.

### 3) Remove placeholder behavior on production routes

- [ ] Replace TODO/mock behavior in auth, file, memory, and RAG handlers.
- [ ] Wire handlers to real repositories/services.
- [ ] Add route-level integration tests for each replaced placeholder path.

## Wave 2: Reliability + Performance Baseline

- [ ] Reduce per-request Redis pressure in rate limiting path (batch/lua where practical).
- [ ] Split global rate-limit bucket into route-group buckets.
- [ ] Add tenant-scoped pagination and indexes for high-volume audit paths.
- [ ] Implement retention/lifecycle automation for stored artifacts.

## Wave 3: Operational Readiness

- [ ] Define SLOs and alerts for auth failure rate, p95 latency, and error budgets.
- [ ] Finalize deployment/rollback runbooks and test in staging.
- [ ] Add production smoke tests (health, auth, policy deny, RAG query, billing).
- [ ] Confirm secret hygiene in CI (generated artifacts ignored, secret scan required).

## Wave 4: Product Polish + GTM Execution

- [ ] Tighten onboarding flow from account creation to first successful guarded request.
- [ ] Align docs and claims with actual enforced behavior (alpha vs beta vs GA messaging).
- [ ] Execute competitive sequence: OSS gateway -> free-tier proxy -> extension / arena.
- [ ] Publish launch assets (comparison, quickstart, runbooks, SLA posture).

## Launch path (when you are ready to ship an environment)

Use the step-by-step checklist (smoke tests, env vars, Langfuse gating, post-launch metrics):

- `.luna/sdlc-platform/launch-checklist.md`

**Current gateway baseline (code):** the HTTP server uses the unified middleware stack in `services/gateway/internal/interfaces/http/middleware/chain.go` (auth, tenant, rate limit, audit, policy, etc.). The Langfuse-compatible surface is **off by default** and only mounts when `SDLC_LANGFUSE_ENABLED=true`; until API-key resolution is implemented, keep that flag unset in production.

## Immediate Execution Order

1. Fix auth + tenant trust boundary in gateway middleware. *(Middleware chain is present; continue validating behavior on real routes and in CI.)*
2. Enforce policy decision path.
3. Replace placeholder handlers on protected endpoints.
4. Add integration tests for auth/policy/RAG/file critical paths.
5. Gate merges on those tests.

## Tracking

- Primary planning inputs:
  - `.planning/codebase/CONCERNS.md`
  - `.planning/codebase/ARCHITECTURE.md`
  - `.planning/competitive-moves-plan.md`
- Next command after this plan:
  - `$gsd-plan-phase 1`
