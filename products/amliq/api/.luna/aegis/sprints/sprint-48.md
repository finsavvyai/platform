# Sprint 48: Launch Readiness & QA

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: All remaining (documentation sync, regression, performance)
**Depends On**: All previous sprints (S-35 through S-47)
**Status**: Not Started

---

## Objective

Full regression testing, performance benchmarking, documentation sync, staging deployment, and beta customer onboarding. This sprint validates that everything built in S-35 through S-47 works together.

## Tasks

### T1: Full regression testing
- [ ] Run all 321+ test files (Go + React + E2E)
- [ ] Fix any failures introduced by Sprints 35-47
- [ ] Add integration tests for cross-sprint features:
  - Full 6-layer screening with all layers active
  - PEP screening → case creation → four-eyes review → SAR generation
  - Continuous monitoring → list sync → webhook notification
  - Billing: free tier → checkout → upgrade → seat management
- [ ] Target: all tests green, 0 known failures
- [ ] **Output**: Test report with pass/fail/skip counts

### T2: Performance benchmarking
- [ ] Benchmark screening latency with all 6 layers active:
  - Target: <50ms p95 for standard screening
  - Target: <10ms p95 for fast (payment) screening
- [ ] Load test at 1K concurrent req/sec for 10 minutes
- [ ] Measure: latency percentiles (p50, p95, p99), throughput, error rate
- [ ] Profile and fix any bottlenecks
- [ ] **Tool**: `k6` or `vegeta` for load testing
- [ ] **File**: `tests/load/screening_load.js` (new)
- [ ] **Output**: Performance report

### T3: Documentation sync
- [ ] Update `README.md` with actual feature list (not aspirational)
- [ ] Update `docs/SCREENING_ENGINE.md` — document all 6 layers as implemented
- [ ] Update `docs/API_REFERENCE.md` — add all new endpoints from S-35 through S-47
- [ ] Update `docs/BILLING_MODEL.md` — reflect actual plans, seats, free tier
- [ ] Update `CLAUDE.md` — reflect current codebase state
- [ ] **Principle**: docs must match code exactly. No aspirational claims.

### T4: Staging deployment
- [ ] Deploy full stack to staging environment:
  - PostgreSQL with pgvector
  - Redis
  - API server
  - Worker (cron jobs, media pipeline, monitoring)
  - Frontend
- [ ] Configure with real sanctions list sync (daily)
- [ ] Configure with real adverse media pipeline (15-minute GDELT sync)
- [ ] 72-hour soak test: monitor for memory leaks, connection pool exhaustion, disk usage
- [ ] **Output**: Staging health report

### T5: Beta customer onboarding (3 pilots)
- [ ] Identify 3 pilot customers from target segments:
  - 1 fintech (API product focus)
  - 1 mid-market bank (Dashboard + compliance focus)
  - 1 crypto exchange (high-volume screening focus)
- [ ] Create tenant + API keys for each
- [ ] Guided setup call: configure lists, thresholds, monitoring
- [ ] Collect feedback: usability, accuracy, speed, missing features
- [ ] **Output**: Beta feedback report

### T6: Launch checklist
- [ ] All 14 gaps from AUDIT.md resolved
- [ ] All tests passing
- [ ] Performance meets targets
- [ ] Docs match code
- [ ] Staging stable for 72 hours
- [ ] Beta customers active and providing feedback
- [ ] SOC 2 prep complete (from S-47)
- [ ] Marketing site updated with real feature list
- [ ] Pricing page live
- [ ] Support process defined (email, Slack, SLA)

## Acceptance Criteria

- [ ] All 321+ tests pass (0 failures)
- [ ] <50ms p95 screening latency under load
- [ ] 1K req/sec sustained for 10 minutes without errors
- [ ] All documentation matches actual implementation
- [ ] Staging runs stable for 72 hours
- [ ] 3 beta customers onboarded and screening
- [ ] Launch checklist 100% complete
