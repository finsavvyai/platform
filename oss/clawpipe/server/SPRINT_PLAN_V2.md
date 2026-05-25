# FinSavvyAI - Sprint Plan V2 (2026)

## Current State Assessment

| Product | Completion | Lines | Test Coverage | Status |
|---------|-----------|-------|---------------|--------|
| API Gateway (`gateway.py`) | 98% | 189 (+ routes/) | 88% | Decomposed S21 |
| Master Server | 90% | ~450 | 80% | Needs decomposition |
| Worker Node (`worker_node.py`) | 90% | ~1700 | 75% | Needs decomposition |
| CLI (`finsavvyai_cli.py`) | 85% | ~900 | 70% | Needs decomposition |
| Chat UI | 100% | ~500 | 0% | Needs tests |
| Dashboard | 90% | ~300 | 60% | Needs tests |
| Control Hub (`server.js`) | 95% | ~1400 | 40% | Needs decomposition + tests |
| Desktop App (`simple_backend.go`) | 80% | ~1200 | 30% | Needs decomposition + polish |
| iOS App | 90% | ~800 | 65% | Needs TestFlight |
| CF Edge Worker (`index.js`) | 85% | ~3000 | 20% | Needs decomposition + backend URL |
| Providers (4 adapters) | 100% | ~150 each | 85% | Good |
| Core modules (30+) | 95% | varies | 88% | Good |
| Observability stack | 100% | - | - | Good |
| Agent Governance | 95% | ~300 | 90% | Good |

### Top Blockers
1. ~~Dirty working tree~~: Resolved S20 - all changes committed
2. Four files still exceed 200-line limit (worker_node, cli, control-hub, CF worker)
3. Test coverage below 90% global target
4. CF Worker backend URL not configured

---

## Phase 1: Stabilization (Sprints S20-S22)
> **Goal**: Clean working tree, commit all changes, establish V2 baseline

### Sprint S20 - Git Stabilization & Commit Hygiene (1 week)
> Date: 2026-02-27 to 2026-03-05

- [x] S20.1 Audit all uncommitted changes and group by feature area
- [x] S20.2 Commit batch 1: governance additions (policy_engine, safety_score, openhands_provider)
- [x] S20.3 Commit batch 2: test stabilizations (playwright, unit tests)
- [x] S20.4 Commit batch 3: deploy/infra updates (Dockerfile, docker-compose, scripts)
- [x] S20.5 Commit batch 4: documentation and planning files
- [x] S20.6 Commit batch 5: UI and chat additions
- [x] S20.7 Verify clean `git status` - zero uncommitted changes
- [x] S20.8 Run full test suite and record baseline: 490 tests passing, 45% coverage
- [x] S20.9 Tag `v1.1.0-rc1` baseline
- [x] S20.10 Update PRODUCTION_READINESS.md with new score

**Skills**: `/luna-agents:luna-review`, `/security-review`
**DoD**: Clean git status, all tests pass, v1.1.0-rc1 tagged

---

### Sprint S21 - Gateway Decomposition (1.5 weeks)
> Date: 2026-03-06 to 2026-03-16

**Target**: Split `src/api/gateway.py` (~1800 lines) into <200-line modules

- [x] S21.1 Extract route handlers: `src/api/routes/health.py` (73 lines)
- [x] S21.2 Extract route handlers: `src/api/routes/chat.py` + chat_auth, chat_provider, chat_validation
- [x] S21.3 Extract route handlers: `src/api/routes/models.py` (64 lines)
- [x] S21.4 Extract route handlers: `src/api/routes/governance.py` + agent_decision.py
- [x] S21.5 Extract route handlers: `src/api/routes/openclaw.py` (150 lines)
- [x] S21.6 Extract route handlers: `src/api/routes/cluster_route.py` (142 lines)
- [x] S21.7 Extract middleware: `src/api/middleware/request_tracking.py` (111 lines)
- [x] S21.8 Extract middleware: `src/api/middleware/cors.py` (32 lines)
- [x] S21.9 Extract middleware: `src/api/middleware/rate_limit.py` (45 lines)
- [x] S21.10 Refactor `gateway.py` to thin app factory (189 lines)
- [x] S21.11 Updated test imports for governance, openclaw, agent_decision tests
- [x] S21.12 Verify all tests pass: 490 passed, 0 failures
- [x] S21.13 Coverage check: governance 79%, openclaw 74%, agent_decision 81%, ops 143 lines

**Skills**: `/design`, `/unit`, `/int`, `/luna-agents:luna-plan`
**DoD**: `gateway.py` < 200 lines, all modules tested, all tests pass

---

### Sprint S22 - Worker & Backend Decomposition (1.5 weeks)
> Date: 2026-03-17 to 2026-03-27

**Target**: Split `worker_node.py` (~1700 lines) and other large Python files

- [ ] S22.1 Extract `src/workers/model_manager.py` (model load/unload/health)
- [ ] S22.2 Extract `src/workers/inference_handler.py` (chat completion processing)
- [ ] S22.3 Extract `src/workers/streaming.py` (SSE streaming logic)
- [ ] S22.4 Extract `src/workers/worker_metrics.py` (worker-specific metrics)
- [ ] S22.5 Extract `src/workers/worker_api.py` (route handlers)
- [ ] S22.6 Refactor `worker_node.py` to thin orchestrator (<200 lines)
- [ ] S22.7 Split `finsavvyai_cli.py` into `src/cli/commands/` submodules
- [ ] S22.8 Split `src/core/openclaw_client.py` into client + models
- [x] S22.9 Split `src/core/multi_layer_router.py` into router + task_classifier
- [ ] S22.10 Split `src/core/heartbeat.py` into heartbeat + health_aggregator
- [ ] S22.11 Write/update tests for every new module (95% coverage)
- [ ] S22.12 Run full regression suite

**Skills**: `/design`, `/unit`, `/luna-agents:luna-execute`
**DoD**: All Python files < 200 lines, 90%+ global coverage, tests pass

---

## Phase 2: Test Coverage Hardening (Sprints S23-S24)
> **Goal**: Reach 95% test coverage on critical modules, 90% global

### Sprint S23 - Python Test Coverage Boost (1.5 weeks)
> Date: 2026-03-28 to 2026-04-07

- [ ] S23.1 Write tests for `src/api/routes/chat.py` (streaming, non-streaming, errors)
- [ ] S23.2 Write tests for `src/api/routes/governance.py` (allow, deny, approval)
- [ ] S23.3 Write tests for `src/api/routes/openclaw.py` (text, vision, normalization)
- [ ] S23.4 Write tests for `src/api/middleware/auth.py` (valid, invalid, missing)
- [ ] S23.5 Write tests for `src/api/middleware/rate_limit.py` (limits, burst, cleanup)
- [ ] S23.6 Write tests for `src/workers/model_manager.py`
- [ ] S23.7 Write tests for `src/workers/inference_handler.py`
- [ ] S23.8 Write tests for `src/workers/streaming.py`
- [ ] S23.9 Boost `auth.py` coverage from 77% to 95%
- [ ] S23.10 Boost `gateway` module coverage to 95%
- [ ] S23.11 Add missing tests for `src/channels/`, `src/automation/`, `src/skills/`
- [ ] S23.12 Add missing tests for `src/memory/`, `src/routing/`, `src/devices/`
- [ ] S23.13 Run `pytest --cov-fail-under=90` and verify pass

**Skills**: `/unit`, `/luna-agents:luna-test`
**DoD**: `pytest --cov-fail-under=90` passes, critical modules at 95%

---

### Sprint S24 - Frontend & E2E Test Coverage (1 week)
> Date: 2026-04-08 to 2026-04-14

- [ ] S24.1 Write Playwright tests for Chat UI (`src/chat/index.html`)
- [ ] S24.2 Write Playwright tests for Dashboard (`src/dashboard/static/index.html`)
- [ ] S24.3 Fix and stabilize existing Playwright test suite (deferred from S5)
- [ ] S24.4 Add Desktop App E2E tests (deferred from S5)
- [ ] S24.5 Write Node.js tests for Control Hub `server.js` routes
- [ ] S24.6 Add Cloudflare Worker tests (miniflare or wrangler dev)
- [ ] S24.7 Write integration tests for Chat UI -> Gateway -> Provider flow
- [ ] S24.8 Write integration tests for Control Hub -> Gateway facade flow
- [ ] S24.9 Add iOS XCTest coverage for remaining untested views
- [ ] S24.10 Set up test coverage reporting in CI for all languages

**Skills**: `/unit`, `/int`, `/luna-agents:luna-test`
**DoD**: `npm test` passes (70+ tests), all products have test coverage, CI reports coverage

---

## Phase 3: Frontend Decomposition & HIG Compliance (Sprints S25-S26)
> **Goal**: Decompose large JS/Go files, enforce Apple HIG across all UIs

### Sprint S25 - Control Hub & Edge Worker Decomposition (1.5 weeks)
> Date: 2026-04-15 to 2026-04-25

**Target**: Split `server.js` (~1400 lines) and `cloudflare-api/index.js` (~3000 lines)

- [ ] S25.1 Split Control Hub into `routes/`, `middleware/`, `services/` modules
- [ ] S25.2 Extract `packages/control-hub-node/routes/facade.js`
- [ ] S25.3 Extract `packages/control-hub-node/routes/docker.js`
- [ ] S25.4 Extract `packages/control-hub-node/routes/health.js`
- [ ] S25.5 Extract `packages/control-hub-node/middleware/auth.js`
- [ ] S25.6 Extract `packages/control-hub-node/middleware/rate-limit.js`
- [ ] S25.7 Extract `packages/control-hub-node/middleware/audit.js`
- [ ] S25.8 Refactor `server.js` to thin entry point (<200 lines)
- [ ] S25.9 Split CF Worker into `cloudflare-api/src/handlers/`, `middleware/`, `utils/`
- [ ] S25.10 Refactor `index.js` to thin router (<200 lines)
- [ ] S25.11 Configure `GATEWAY_URL` secret on Cloudflare (connect to backend via Tunnel)
- [ ] S25.12 Write tests for each new module
- [ ] S25.13 Verify `wrangler dev` and `wrangler deploy` both work

**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`
**DoD**: `server.js` and `index.js` both < 200 lines, tests pass, CF Worker connected

---

### Sprint S26 - Desktop App Decomposition & Apple HIG Audit (1 week)
> Date: 2026-04-26 to 2026-05-02

- [ ] S26.1 Split `simple_backend.go` into `cmd/`, `handlers/`, `services/`
- [ ] S26.2 Refactor Go entry point to <200 lines
- [ ] S26.3 Apple HIG audit on Chat UI - fix violations
- [ ] S26.4 Apple HIG audit on Dashboard - fix violations
- [ ] S26.5 Apple HIG audit on Control Hub UI - fix violations
- [ ] S26.6 Apple HIG audit on Desktop App frontend - fix violations
- [ ] S26.7 Unify CSS variable system across all web UIs
- [ ] S26.8 Add dark mode to any UI missing it
- [ ] S26.9 Add accessibility labels and keyboard navigation
- [ ] S26.10 Implement deferred items: Keychain storage, app icons, onboarding flow

**Skills**: `/hig`, `/design`, `/unit`
**DoD**: All files < 200 lines, all UIs pass HIG audit, dark mode everywhere

---

## Phase 4: Security Hardening & Governance (Sprints S27-S28)
> **Goal**: Enterprise security audit, governance API hardening

### Sprint S27 - Security Audit & Hardening (1 week)
> Date: 2026-05-03 to 2026-05-09

- [ ] S27.1 Run OWASP ZAP scan against all API endpoints
- [ ] S27.2 Fix all critical and high findings
- [ ] S27.3 Add CSP headers to all web UIs
- [ ] S27.4 Add HSTS, X-Frame-Options, X-Content-Type-Options headers
- [ ] S27.5 Implement request signing for inter-service communication
- [ ] S27.6 Add API key rotation automation
- [ ] S27.7 Audit and harden all Docker images (non-root, minimal base)
- [ ] S27.8 Add dependency scanning to CI (pip-audit, npm audit)
- [ ] S27.9 Implement secrets rotation runbook
- [ ] S27.10 Penetration test the agent governance endpoint

**Skills**: `/security-review`, `/prod`
**DoD**: Zero critical/high findings, all headers present, CI scans enabled

---

### Sprint S28 - Governance API V2 (1 week)
> Date: 2026-05-10 to 2026-05-16

- [ ] S28.1 Add policy versioning (store and audit policy changes)
- [ ] S28.2 Add approval workflow integration (webhook callback on `require_approval`)
- [ ] S28.3 Add governance audit trail (log all decisions with full context)
- [ ] S28.4 Implement policy templates (pre-built policies for common use cases)
- [ ] S28.5 Add governance dashboard panel (decisions/day, deny rate, safety scores)
- [ ] S28.6 Add rate limiting per-policy (prevent policy abuse)
- [ ] S28.7 Add governance API v2 endpoint with richer response format
- [ ] S28.8 Write comprehensive governance integration tests
- [ ] S28.9 Update docs/AGENT_GOVERNANCE_API.md for v2
- [ ] S28.10 Performance test governance endpoint (target: <10ms latency)

**Skills**: `/design`, `/unit`, `/int`, `/luna-agents:luna-docs`
**DoD**: Governance v2 deployed, <10ms latency, audit trail complete

---

## Phase 5: Production & Launch (Sprints S29-S30)
> **Goal**: Production deploy, monitoring validation, v1.1.0 release

### Sprint S29 - Production Deployment & Validation (1 week)
> Date: 2026-05-17 to 2026-05-23

- [ ] S29.1 Validate Docker Compose full stack (all services healthy)
- [ ] S29.2 Configure and test Cloudflare Tunnel end-to-end
- [ ] S29.3 Run production smoke tests against staging
- [ ] S29.4 Run load tests: 200 concurrent, sustained 20 req/s
- [ ] S29.5 Validate Prometheus metrics and Grafana dashboards
- [ ] S29.6 Validate alerting rules fire correctly
- [ ] S29.7 Run backup/restore drill
- [ ] S29.8 Run go-live checklist (`scripts/go_live_checklist.sh`)
- [ ] S29.9 iOS TestFlight beta build and deploy
- [ ] S29.10 Desktop App macOS .app bundle build and notarize

**Skills**: `/prod`, `/int`, `/luna-agents:luna-deploy`
**DoD**: All services running, monitoring active, load tests pass, apps built

---

### Sprint S30 - Release & Documentation (1 week)
> Date: 2026-05-24 to 2026-05-30

- [ ] S30.1 Final regression: all Python tests pass at 90%+ coverage
- [ ] S30.2 Final regression: all Playwright tests pass
- [ ] S30.3 Final security scan: zero critical/high
- [ ] S30.4 Final file size audit: all files < 200 lines
- [ ] S30.5 Update all documentation (README, API docs, guides)
- [ ] S30.6 Update CHANGELOG.md with v1.1.0 release notes
- [ ] S30.7 Create deployment runbook for v1.1.0
- [ ] S30.8 Tag `v1.1.0` release
- [ ] S30.9 Deploy to production
- [ ] S30.10 Post-launch monitoring (24h stability watch)

**Skills**: `/prod`, `/luna-agents:luna-docs`, `/luna-agents:luna-deploy`
**DoD**: v1.1.0 released, production stable for 24h, all docs updated

---

## Phase 6: V2 Features (Sprints S31-S35)
> **Goal**: New capabilities for the V2 roadmap

### Sprint S31 - Multi-Tenant API Keys & Usage Tracking (1.5 weeks)
> Date: 2026-06-01 to 2026-06-11

- [ ] S31.1 Design multi-tenant API key schema (org -> team -> user)
- [ ] S31.2 Implement key scoping (per-model, per-endpoint permissions)
- [ ] S31.3 Add usage tracking per key (tokens consumed, requests, cost)
- [ ] S31.4 Build usage dashboard panel
- [ ] S31.5 Add usage alerts (budget thresholds)
- [ ] S31.6 Add key analytics endpoint (`GET /v1/usage`)
- [ ] S31.7 Add rate limiting per-key (configurable per tier)
- [ ] S31.8 Write full test suite
- [ ] S31.9 Update API docs

**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`
**DoD**: Multi-tenant keys working, usage tracked, dashboard visible

---

### Sprint S32 - Conversation History & RAG (1.5 weeks)
> Date: 2026-06-12 to 2026-06-22

- [ ] S32.1 Implement server-side conversation storage (SQLite)
- [ ] S32.2 Add conversation API (`GET /v1/conversations`, `GET /v1/conversations/:id`)
- [ ] S32.3 Implement context window management (auto-truncate, summarize)
- [ ] S32.4 Add document ingestion endpoint (`POST /v1/documents`)
- [ ] S32.5 Implement vector embedding storage (sqlite-vec)
- [ ] S32.6 Add RAG retrieval in chat completions (auto-inject relevant context)
- [ ] S32.7 Build conversation UI in Chat web app
- [ ] S32.8 Add conversation export/import
- [ ] S32.9 Write full test suite

**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`
**DoD**: Conversations persisted, RAG retrieval working, UI built

---

### Sprint S33 - Streaming Improvements & WebSocket API (1 week)
> Date: 2026-06-23 to 2026-06-29

- [ ] S33.1 Add WebSocket API endpoint (`ws://gateway/v1/chat`)
- [ ] S33.2 Implement bidirectional streaming (user can cancel mid-stream)
- [ ] S33.3 Add function calling / tool use support
- [ ] S33.4 Add structured output (JSON mode) across all providers
- [ ] S33.5 Implement response caching for identical prompts
- [ ] S33.6 Add streaming to OpenHands provider (currently non-native)
- [ ] S33.7 Write full test suite

**Skills**: `/design`, `/unit`, `/optimize`
**DoD**: WebSocket API working, tool use supported, streaming across all providers

---

### Sprint S34 - Admin Dashboard & Management UI (1.5 weeks)
> Date: 2026-06-30 to 2026-07-10

- [ ] S34.1 Design admin dashboard (Apple HIG, separate from monitoring dashboard)
- [ ] S34.2 Build API key management UI (create, revoke, scope, view usage)
- [ ] S34.3 Build model management UI (load, unload, configure, download)
- [ ] S34.4 Build user/team management UI
- [ ] S34.5 Build policy management UI (create, edit, test policies)
- [ ] S34.6 Build real-time request log viewer
- [ ] S34.7 Add governance decision audit viewer
- [ ] S34.8 Write E2E tests for admin dashboard

**Skills**: `/hig`, `/design`, `/unit`, `/luna-agents:luna-plan`
**DoD**: Admin dashboard deployed, all management functions working

---

### Sprint S35 - Performance Optimization & v2.0 Release (1 week)
> Date: 2026-07-11 to 2026-07-17

- [ ] S35.1 Profile and optimize gateway routing latency
- [ ] S35.2 Add connection pooling across all providers
- [ ] S35.3 Optimize rate limiter memory usage
- [ ] S35.4 Add response compression (gzip/brotli)
- [ ] S35.5 Load test: 500 concurrent, 50 req/s sustained
- [ ] S35.6 Final security scan
- [ ] S35.7 Final coverage report (target: 95% global)
- [ ] S35.8 Update all docs for v2.0
- [ ] S35.9 Tag `v2.0.0` release
- [ ] S35.10 Deploy to production

**Skills**: `/optimize`, `/prod`, `/security-review`, `/luna-agents:luna-deploy`
**DoD**: v2.0.0 released, 500 concurrent supported, 95% coverage

---

## Timeline Overview

| Phase | Sprints | Duration | Dates | Focus |
|-------|---------|----------|-------|-------|
| Phase 1: Stabilization | S20-S22 | 4 weeks | Feb 27 - Mar 27 | Git cleanup, file decomposition |
| Phase 2: Test Coverage | S23-S24 | 2.5 weeks | Mar 28 - Apr 14 | 90%+ coverage |
| Phase 3: Frontend & HIG | S25-S26 | 2.5 weeks | Apr 15 - May 2 | JS/Go decomposition, HIG audit |
| Phase 4: Security | S27-S28 | 2 weeks | May 3 - May 16 | Security audit, governance v2 |
| Phase 5: Production | S29-S30 | 2 weeks | May 17 - May 30 | Deploy, v1.1.0 release |
| Phase 6: V2 Features | S31-S35 | 7 weeks | Jun 1 - Jul 17 | New features, v2.0.0 release |

**Total: ~20 weeks (Feb 27 - Jul 17, 2026)**

### Parallel Tracks
- **Track A (Backend)**: S20 -> S21 -> S22 -> S23 -> S27 -> S29
- **Track B (Frontend)**: S20 -> S25 -> S26 -> S24 -> S34
- **Track C (Testing)**: S23 -> S24 -> S29 -> S30
- **Track D (Security)**: S27 -> S28 -> S29

---

## Success Metrics

| Metric | Current | v1.1.0 Target | v2.0.0 Target |
|--------|---------|---------------|---------------|
| Production Readiness Score | 88 | 95 | 98 |
| Test Coverage (global) | 88% | 90% | 95% |
| Max File Size | ~3000 lines | 200 lines | 200 lines |
| API Latency P95 (routing) | ~500ms | <200ms | <100ms |
| Concurrent Users | 100+ | 200+ | 500+ |
| Security Scan Findings | unknown | 0 critical/high | 0 all severities |
| Uptime Target | 99.5% | 99.9% | 99.95% |
| Products with Tests | 7/11 | 11/11 | 11/11 |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Gateway decomposition breaks routing | High | Medium | Feature flags, incremental extraction, full regression |
| Worker decomposition breaks inference | High | Medium | Extract read-only modules first, test each step |
| CF Worker split breaks edge proxy | Medium | Low | Use `wrangler dev` for local testing before deploy |
| Test coverage push slows feature work | Low | High | Dedicate sprints, don't mix coverage with features |
| iOS TestFlight requires Apple cert | Medium | Medium | Set up provisioning early in S29 |
| Performance regression from decomposition | Medium | Low | Benchmark before/after each sprint |
