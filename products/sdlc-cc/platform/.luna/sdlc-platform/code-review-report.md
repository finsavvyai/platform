# SDLC Platform — Code Quality Review

**Date:** 2026-04-21
**Scope:** Project-level (services/, packages/)
**Reviewer:** Claude (main-context review after agent pool overload)
**Verdict:** ❌ **NO-GO for production.** Multiple CLAUDE.md hard-rule violations at scale.

---

## Executive Summary

The portfolio-level `CLAUDE.md` establishes non-negotiable engineering rules. This codebase violates the most visible one (200-LOC cap) in **497 production source files**, and the gateway — the security critical entry point — has an incomplete middleware chain plus an explicit authentication bypass marked `TODO(M4)` in shipping code. The underlying architecture is sound (RLS enforced across 17 tenant-scoped tables, OpenAPI3 specs present, multi-service decomposition) but the execution fails portfolio quality gates in ways that would block a merge-to-main under the stated CI policy.

**Ship decision:** Alpha-only. Not beta, not GA.

---

## Critical Issues

### C1. 200-LOC rule: 497 production files over the cap

`CLAUDE.md` (portfolio) hard rule: *"Maximum source file size: 200 lines per file (src/, app/, lib/). Refactor when a file exceeds 200 lines; split by feature/module responsibility."*

Production-source count excluding tests, vendored deps, venvs, wrangler tmp, generated: **497 files over 200 LOC.**

Worst offenders (lines):

| Lines | File |
|------:|------|
| 2988 | `packages/sdk-go/pkg/sdln/test_comprehensive.go` |
| 2341 | `packages/sdk-go/pkg/sdln/qa_types.go` |
| 2223 | `services/gateway/internal/sdk/generate.go` |
| 1955 | `services/dlp/app/testing_and_documentation.py` |
| 1613 | `services/gateway/internal/domain/services/authentication_service.go` |
| 1613 | `packages/sdk-go/pkg/sdln/database_optimization.go` |
| 1538 | `packages/sdk-go/pkg/sdln/testing_framework.go` |
| 1348 | `packages/sdk-go/pkg/sdln/advanced_monitoring_service.go` |
| 1335 | `packages/sdk-go/pkg/sdln/documentation_service.go` |
| 1279 | `services/rag/app/services/alerts/alert_manager.py` |
| 1261 | `packages/sdk-go/pkg/sdln/distributed_tracing_service.go` |
| 1236 | `services/rag/app/services/billing/billing_integration.py` |
| 1208 | `services/rag/app/services/embedding_metadata_service.py` |
| 1206 | `services/rag/app/api/endpoints/context.py` |
| 1183 | `packages/sdk-go/pkg/sdln/realtime_dashboard_service.go` |
| 1163 | `packages/sdk-go/pkg/sdln/log_analysis_service.go` |
| 1160 | `packages/sdk-go/pkg/sdln/interfaces.go` |
| 1155 | `services/dlp/app/services/content_classifier.py` |
| 1151 | `services/rag/app/services/document_processor.py` |
| 1147 | `services/rag/app/services/cost/cost_optimizer.py` |
| 1135 | `services/rag/app/schemas/context.py` |
| 1129 | `services/rag/app/services/embedding_quality_validator.py` |
| 1129 | `services/rag/app/services/cost_optimization_service.py` |
| 1112 | `services/rag/app/services/rag_orchestrator.py` |
| 1080 | `services/dlp/app/services/real_time_scanner.py` |
| 1072 | `services/rag/app/services/token/token_manager.py` |
| 1054 | `services/rag/app/services/analytics/usage_analytics.py` |
| 1042 | `services/rag/app/core/lifecycle.py` |
| 1030 | `services/rag/app/services/budget/budget_manager.py` |
| 1025 | `services/gateway/internal/tools/postman_generator.go` |
| 1017 | `services/rag/app/services/extractors/office_extractors.py` |
| 1014 | `services/gateway/cmd/auth-server/main.go` |

**Recommendation:** Treat this as a dedicated refactor milestone. Sample split guidance:

- `authentication_service.go` (1613) → `authentication_login.go`, `authentication_mfa.go`, `authentication_tokens.go`, `authentication_password_reset.go`, `authentication_api_keys.go`, shared types in `authentication_types.go`.
- `rag_orchestrator.go` equivalents: split by pipeline stage (`ingest.py`, `chunk.py`, `embed.py`, `retrieve.py`, `generate.py`).
- `sdln/*` is generated SDK territory — if truly generated, add to `.luna` exclude list; if hand-written, split by domain.

A fitness-function in CI (`scripts/check-file-size.sh` failing on any src file >200 LOC) will prevent regression.

### C2. Gateway main.go violates cap (658 LOC) and contains release-blocking TODOs

`services/gateway/cmd/server/main.go` is 658 lines — the entrypoint of the security-critical service. Three inline TODOs in this file alone:

- `:322` — `// TODO: Re-enable when handlers and routes packages are restored` — core API routes disabled.
- `:348` — `// TODO(M4): wire to api_keys table; today accept any non-empty pair.` — auth bypass (see security report).
- `:498` — `// TODO: Implement metrics` — telemetry hole.

53 TODO/FIXME occurrences across 19 gateway files. `CLAUDE.md`: *"No TODO/FIXME in release branches without a linked tracked issue."*

### C3. Middleware chain does not match the 14-step golden order

`services/gateway/cmd/server/main.go:285-294` applies only 5 middleware layers:

1. `chimw.RequestID`
2. `chimw.RealIP`
3. `chimw.Recoverer`
4. `chimw.Timeout(60s)`
5. proxy middleware

`CLAUDE.md` golden order (14 steps) requires, in this sequence: RequestID, Log, Recovery, CORS, Security (CSP/HSTS/X-Frame-Options), Auth, Tenant, RateLimit, Validate, Audit, Policy, Version, Compress, Metrics.

**Missing from the router setup:**

- Structured Log middleware (app-level logger is present but not attached to every request)
- CORS middleware (no `cors.Handler` seen)
- Security headers middleware (no CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options` applied globally)
- Auth middleware (global) — only the Langfuse handler has a per-handler basic/bearer check, and that check is a no-op (C2)
- Tenant extraction middleware (no `tenant_id` propagated into `app.current_tenant_id` for RLS)
- Validate middleware (OpenAPI schema validation not wired)
- Audit middleware
- Policy (OPA) middleware — `policyEngine` is constructed but never attached as middleware
- Version middleware
- Compress middleware
- Metrics middleware (the `/metrics` endpoint exists, but per-request `prometheus` instrumentation middleware does not)

This is both a quality issue and a security issue (see security report Critical S1/S2). The 5-middleware chain would fail a code review under the portfolio standard.

### C4. Two `main.go` entrypoints, 1672 LOC total

`services/gateway/cmd/server/main.go` (658) and `services/gateway/cmd/auth-server/main.go` (1014). The project structure implies a single gateway binary per CLAUDE.md. The second `main.go` is **5× over the cap** and its existence as a second long-lived entrypoint is undocumented in the README/code map.

---

## Major Issues

### M1. Generated vs. hand-written SDK files unclear

`packages/sdk-go/pkg/sdln/*.go` contains ~15 files between 1000–2341 LOC. If these are generated from `services/gateway/internal/sdk/generate.go`, they should be in `.gitignore` or annotated with `// Code generated by ... DO NOT EDIT.` and excluded from the 200-LOC audit. Today they are committed as normal sources and inherit the rule.

**Action:** either add generator header + exclusion glob to the size fitness function, or regenerate these into split modules.

### M2. RAG services cluster of 1000+ LOC files

`services/rag/app/services/` has multiple files in the 1000–1280 LOC range (`alert_manager.py`, `billing_integration.py`, `embedding_metadata_service.py`, `token_manager.py`, `rag_orchestrator.py`, `cost_optimizer.py`, `budget_manager.py`). These are the SRP-violators most likely to cause merge conflicts and hardest to test to 90%+ branch coverage.

**Action:** each 1000+ LOC service class should become a package with ≤5 files, each ≤200 LOC, with a thin public surface in `__init__.py`.

### M3. DLP service with 1000+ LOC files in a security-critical path

`services/dlp/app/testing_and_documentation.py` (1955), `services/dlp/app/services/content_classifier.py` (1155), `services/dlp/app/services/real_time_scanner.py` (1080), `services/dlp/app/services/multi_tenant_manager.py` (991). DLP is a zero-trust compliance control — it must meet the 100% critical-path coverage bar, which is unrealistic while files are this large.

### M4. `services/gateway/internal/sdk/generate.go` at 2223 LOC

The SDK generator itself is a 2223-line Go file. It should be decomposed per target language (`generate_go.go`, `generate_py.go`, `generate_ts.go`, `generate_common.go`) plus an orchestrator.

### M5. `services/gateway/internal/tools/postman_generator.go` at 1025 LOC

Tooling, but still production source. Same split treatment.

### M6. Disabled core API routes

`main.go:321-322`:
```go
// API routes (handlers/routes pending refactoring)
// TODO: Re-enable when handlers and routes packages are restored
```

The gateway currently exposes only `/health`, `/metrics`, service-discovery, a couple of `/api/v1/openclaw` and `/api/v1/claw` routes, and the Langfuse surface. The tenants / users / files / policies / DLP / vector endpoints defined in `api/openapi-extensions.yaml` do not appear to be wired. OpenAPI specs that don't correspond to served routes are worse than no spec.

---

## Minor Issues

### N1. `coverage.out` committed

`services/gateway/coverage.out`, `services/llm-gateway/coverage.out` are in-tree. Coverage artifacts belong in CI, not git.

### N2. Build artifacts in tree

`services/gateway/bin/`, `services/gateway/server`, `services/.wrangler/tmp/*` are checked in or not gitignored. The git status shows several `?? .../models/` folders and `services/gateway/server` as untracked — easy path to accidentally committing binaries.

### N3. `services/lam-knowledge-base.js` at service root

Stray JS file at `services/` root (not in a subdirectory). Should move into a `services/agents/` or `services/lam/` package.

### N4. Duplicate / overlapping migrations

`database/migrations/001_create_extensions_and_types.sql` and `001_initial_schema.sql` share the `001` prefix. `002_authentication_system.sql` and `002_create_core_tables.sql` likewise. Migration tooling typically requires unique version prefixes — confirm only one set is applied.

### N5. `packages/sdk-go/simple_test.go` at package root

Loose test file at the package root rather than under the package it tests. Standard Go layout puts tests next to the code they exercise.

### N6. Multiple `README.md` / `*_SUMMARY.md` per service

`EMBEDDING_SERVICE_README.md`, `IMPLEMENTATION_SUMMARY.md`, `README_EMBEDDING_SERVICE.md`, `DLP_SUMMARY.md`, `OPENAPI3_MIGRATION.md`, `OPENAPI3_QUICKSTART.md`, `SECURITY_110_ACHIEVEMENT.md` — markdown artifacts accumulate. Move historical summaries to `docs/history/` and keep one canonical `README.md` per service.

---

## Recommendations

### Immediate (before any production-facing release)

1. **Stop TODOs in release branches.** Grep-gate in CI for `TODO|FIXME|XXX|HACK` in `services/**/*.{go,py,ts,js}` that does not include an issue reference (`TODO(#1234)`). Currently 53 occurrences in gateway alone.
2. **Fix the Langfuse handler auth** (see Security C2). Either wire to the `api_keys` table or disable the surface.
3. **Restore the full middleware chain** per CLAUDE.md's 14-step golden order, or document the delta as intentional with a scoped issue.
4. **Add a file-size fitness function** in CI:
   ```bash
   find services packages -type f \( -name '*.go' -o -name '*.py' -o -name '*.ts' \) \
     ! -path '*/node_modules/*' ! -path '*/.venv/*' ! -path '*/vendor/*' \
     ! -name '*_test.go' ! -name 'test_*.py' ! -name '*.test.ts' \
     | xargs wc -l | awk '$1 > 200 && $2 != "total" {print; over++} END {exit over>0}'
   ```
   Start by gating `git diff --stat main` so *new* files cannot exceed 200 LOC, then put the existing violations on a burn-down.

### Short-term (next sprint)

5. Refactor the worst 10 files (all 1000+ LOC) into sub-packages.
6. Wire OPA policy middleware to the router — it is constructed but unused.
7. Mark generated SDK files (`DO NOT EDIT` header + exclusion glob).
8. Consolidate the two `main.go` entrypoints or document why there are two.
9. Ensure every endpoint in `openapi-extensions.yaml` has a corresponding router registration (contract tests can enforce this via `chi.Walk`).

### Medium-term

10. Decompose RAG services (`rag_orchestrator.py`, `token_manager.py`, `cost_optimizer.py`, `budget_manager.py`) into ≤200-LOC modules.
11. Decompose DLP services, particularly `content_classifier.py` and `real_time_scanner.py`, to meet the 100% critical-path coverage target realistically.
12. Move `coverage.out`, build binaries, and `.wrangler/tmp` out of tracked tree.

---

## Code Quality Assessment

| Category | Status | Notes |
|----------|--------|-------|
| File size rule (≤200 LOC) | ❌ Fail | 497 production files over cap; top offender 2988 LOC |
| Type safety | ⚠️ Unverified here | Spot-checks clean; full audit pending |
| Middleware chain | ❌ Fail | 5 of 14 golden-order steps applied |
| No TODO/FIXME in release | ❌ Fail | 53 in gateway |
| OpenAPI spec coverage | ⚠️ Partial | Specs complete; handlers disabled |
| RLS migration | ✅ Pass | All 17 tenant-scoped tables enabled |
| Error handling | ⚠️ Unverified | Requires deeper sampling |
| Dependency injection | ✅ Pass (gateway) | `Application` struct uses constructor injection |

## Go / No-Go

**No-Go for production, Beta, or SOC2 scope.** Alpha-only.

The codebase has strong bones (RLS, OpenAPI, service decomposition) and is roughly at the 65% readiness claimed in `CLAUDE.md`, but the CLAUDE.md portfolio rules are **contractual quality gates** and are failing in ways that would block every PR's CI if enforced. Close C1–C4 before re-reviewing.
