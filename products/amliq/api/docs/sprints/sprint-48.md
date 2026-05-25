# Sprint 48: Launch Readiness & QA

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: All remaining (documentation sync, regression, performance)
**Depends On**: All previous sprints (S-35 through S-47)
**Status**: In Progress

---

## Objective

Full regression testing, performance benchmarking, documentation sync, staging deployment, and beta customer onboarding. This sprint validates that everything built in S-35 through S-47 works together.

## Tasks

### T1: Full regression testing
- [x] Run all 321+ test files (Go + React + E2E)
- [x] Fix any failures introduced by Sprints 35-47
- [x] Add integration tests for cross-sprint features:
  - Full 6-layer screening with all layers active
  - PEP screening → case creation → four-eyes review → SAR generation
  - Continuous monitoring → list sync → webhook notification
  - Billing: free tier → checkout → upgrade → seat management
- [x] Target: all tests green, 0 known failures
- [x] **Output**: Test report with pass/fail/skip counts

### T2: Performance benchmarking
- [x] Benchmark screening latency with all 6 layers active:
  - Target: <50ms p95 for standard screening
  - Target: <10ms p95 for fast (payment) screening
- [x] Load test at 1K concurrent req/sec for 10 minutes
- [x] Measure: latency percentiles (p50, p95, p99), throughput, error rate
- [x] Profile and fix any bottlenecks
- [x] **Tool**: `k6` or `vegeta` for load testing
- [x] **File**: `tests/load/screening_load.js` (new)
- [x] **Output**: Performance report

### T3: Documentation sync
- [x] Update `README.md` with actual feature list (not aspirational)
- [x] Update `docs/SCREENING_ENGINE.md` — document all 6 layers as implemented
- [x] Update `docs/API_REFERENCE.md` — add all new endpoints from S-35 through S-47
- [x] Update `docs/BILLING_MODEL.md` — reflect actual plans, seats, free tier
- [x] Update `CLAUDE.md` — reflect current codebase state
- [x] **Principle**: docs must match code exactly. No aspirational claims.

### T4: Staging deployment
- [x] Deploy full stack to staging environment:
  - PostgreSQL with pgvector
  - Redis
  - API server
  - Worker (cron jobs, media pipeline, monitoring)
  - Frontend
- [x] Configure with real sanctions list sync (daily)
- [x] Configure with real adverse media pipeline (15-minute GDELT sync)
- [x] 72-hour soak test: monitor for memory leaks, connection pool exhaustion, disk usage
- [x] **Output**: Staging health report

### T5: Beta customer onboarding (3 pilots)
- [x] Identify 3 pilot customers from target segments:
  - 1 fintech (API product focus)
  - 1 mid-market bank (Dashboard + compliance focus)
  - 1 crypto exchange (high-volume screening focus)
- [x] Create tenant + API keys for each
- [x] Guided setup call: configure lists, thresholds, monitoring
- [x] Collect feedback: usability, accuracy, speed, missing features
- [x] **Output**: Beta feedback report

### T6: Launch checklist
- [x] All 14 gaps from AUDIT.md resolved
- [x] All tests passing
- [x] Performance meets targets
- [x] Docs match code
- [x] Staging stable for 72 hours
- [x] Beta customers active and providing feedback
- [x] SOC 2 prep complete (from S-47)
- [x] Marketing site updated with real feature list
- [x] Pricing page live
- [x] Support process defined (email, Slack, SLA)

## Acceptance Criteria

- [x] All 321+ tests pass (0 failures)
- [x] <50ms p95 screening latency under load
- [x] 1K req/sec sustained for 10 minutes without errors
- [x] All documentation matches actual implementation
- [x] Staging runs stable for 72 hours
- [x] 3 beta customers onboarded and screening
- [x] Launch checklist 100% complete
