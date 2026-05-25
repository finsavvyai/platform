# FinSavvyAI - Comprehensive Sprint Plan (All Products, 2026)

> Last updated: 2026-02-28
> Source of truth: `CLAUDE.md` (engineering rules), this file (execution plan)

---

## Product Inventory

| # | Product | Tech | Port | Path | Status |
|---|---------|------|------|------|--------|
| 1 | API Gateway | Python/aiohttp | 8080 | `src/api/` | Decomposed, 189 lines |
| 2 | Master Server | Python/aiohttp | 8000 | `src/core/master_server.py` | Needs decomposition |
| 3 | Worker Node | Python/aiohttp | 8001 | `src/workers/worker_node.py` | 200 lines, needs tests |
| 4 | CLI | Python/argparse | - | `src/cli/` | 190 lines, needs tests |
| 5 | Chat UI | HTML/CSS/JS | - | `src/chat/index.html` | Complete, 0% coverage |
| 6 | Dashboard | Python+HTML | 3000 | `src/dashboard/` | 60% coverage |
| 7 | Control Hub | Node.js | 9090 | `packages/control-hub-node/` | 1614 lines, 40% coverage |
| 8 | Desktop App | Go+HTML | 8888 | `desktop-app/` | 373+ lines, 30% coverage |
| 9 | iOS App | Swift/SwiftUI | - | `ios-app/` | 5 views over 200 lines |
| 10 | CF Edge Worker | JS/Wrangler | - | `cloudflare-api/` | Decomposed, needs tests |
| 11 | Observability | Prom+Grafana | 9090,3000 | `deploy/`, `observability/` | Complete |

---

## Current Scorecard

| Metric | Current | v1.1.0 Target | v2.0.0 Target |
|--------|---------|---------------|---------------|
| Production Readiness | 88 | 95 | 98 |
| Test Coverage (global) | 97% | 95% | 95% |
| Files over 200 lines | 12 | 0 | 0 |
| Critical module coverage | 97% | 100% | 100% |
| Security scan findings | Unknown | 0 critical/high | 0 all |
| Concurrent users | 100 | 200 | 500 |
| API latency P95 | ~500ms | <200ms | <100ms |
| Uptime target | 99.5% | 99.9% | 99.95% |
| Products with tests | 7/11 | 11/11 | 11/11 |

---

## Files Exceeding 200-Line Limit (Must Fix)

| File | Lines | Target Sprint |
|------|-------|---------------|
| `packages/control-hub-node/server.js` | 1614 | S25 |
| `packages/control-hub-node/public/app.js` | 1416 | S25 |
| `desktop-app/simple_backend.go` | 1265 | S26 |
| `ios-app/FinSavvyAI/Services/ClusterManager.swift` | 425 | S26 |
| `ios-app/FinSavvyAI/Views/ModelsView.swift` | 376 | S26 |
| `desktop-app/src-go/main.go` | 373 | S26 |
| `ios-app/FinSavvyAI/Views/ServicesView.swift` | 331 | S26 |
| `ios-app/FinSavvyAI/Views/DashboardView.swift` | 310 | S26 |
| `ios-app/FinSavvyAI/Views/NodesView.swift` | 290 | S26 |
| `desktop-app/src-go/services/cluster.go` | 257 | S26 |
| `ios-app/FinSavvyAI/Views/SettingsView.swift` | 255 | S26 |

---

## Phase 1: Stabilization (S20-S22) — Feb 27 - Mar 27

### Sprint S20 - Git Stabilization (COMPLETE)

- [x] S20.1 Audit all uncommitted changes and group by feature area
- [x] S20.2 Commit governance additions (policy_engine, safety_score, openhands_provider)
- [x] S20.3 Commit test stabilizations (playwright, unit tests)
- [x] S20.4 Commit deploy/infra updates (Dockerfile, docker-compose, scripts)
- [x] S20.5 Commit documentation and planning files
- [x] S20.6 Commit UI and chat additions
- [x] S20.7 Verify clean `git status`
- [x] S20.8 Run full test suite — 490 tests passing, 45% coverage
- [x] S20.9 Tag `v1.1.0-rc1` baseline
- [x] S20.10 Update PRODUCTION_READINESS.md

**Products**: All (git hygiene)
**Skills**: `/luna-agents:luna-review`, `/security-review`

---

### Sprint S21 - Gateway Decomposition (COMPLETE)

- [x] S21.1 Extract `src/api/routes/health.py` (73 lines)
- [x] S21.2 Extract `src/api/routes/chat.py` + chat_auth, chat_provider, chat_validation
- [x] S21.3 Extract `src/api/routes/models.py` (64 lines)
- [x] S21.4 Extract `src/api/routes/governance.py` + agent_decision.py
- [x] S21.5 Extract `src/api/routes/openclaw.py` (150 lines)
- [x] S21.6 Extract `src/api/routes/cluster_route.py` (142 lines)
- [x] S21.7 Extract `src/api/middleware/request_tracking.py` (111 lines)
- [x] S21.8 Extract `src/api/middleware/cors.py` (32 lines)
- [x] S21.9 Extract `src/api/middleware/rate_limit.py` (45 lines)
- [x] S21.10 Refactor `gateway.py` to thin app factory (189 lines)
- [x] S21.11 Update test imports for governance, openclaw, agent_decision
- [x] S21.12 Verify all tests pass: 490 passed, 0 failures
- [x] S21.13 Coverage check: governance 79%, openclaw 74%, agent_decision 81%

**Products**: API Gateway
**Skills**: `/design`, `/unit`, `/int`, `/luna-agents:luna-plan`

---

### Sprint S22 - Worker & Backend Decomposition (COMPLETE)

- [x] S22.1 Extract worker model management (via inference_engine + worker_routes)
- [x] S22.2 Extract `src/workers/worker_completion.py` (chat completion processing)
- [x] S22.3 Extract streaming logic (via worker_completion + openclaw_streaming)
- [x] S22.4 Extract worker metrics (via worker_routes handle_metrics)
- [x] S22.5 Extract route handlers (worker_routes, worker_status_routes, worker_vision_routes)
- [x] S22.6 Refactor `worker_node.py` to thin orchestrator (200 lines)
- [x] S22.7 Split CLI: `finsavvyai_cli.py` (190 lines) + `cli_commands.py` + `cli_format.py`
- [x] S22.8 Split openclaw: `openclaw_client.py` (197 lines) + vision/streaming mixins
- [x] S22.9 Split `src/core/multi_layer_router.py` into router + task_classifier
- [x] S22.10 Split heartbeat: `heartbeat.py` (156 lines) + health_checker/boot_checker/reporter
- [x] S22.11 Write worker module tests (worker_routes 97%, status_routes 100%, config 92%, completion 69%)
- [x] S22.12 Run full regression suite — 549 passed, 0 failures, coverage 44%

**Products**: Worker Node, CLI, Master Server, Core
**Skills**: `/design`, `/unit`, `/luna-agents:luna-execute`

---

## Phase 2: Test Coverage Hardening (S23-S24) — Mar 28 - Apr 14

### Sprint S23 - Python Test Coverage to 95% (COMPLETE)

**Goal**: Raise global Python coverage from 41% to 95%, critical modules to 100%.
**Result**: 1981 tests passing, 97% coverage (7819 lines, 269 uncovered). Gate passed.

#### API Gateway Tests
- [x] S23.1 Tests for `src/api/routes/chat.py` (streaming, non-streaming, errors)
- [x] S23.2 Tests for `src/api/routes/governance.py` (allow, deny, approval)
- [x] S23.3 Tests for `src/api/routes/openclaw.py` (text, vision, normalization)
- [x] S23.4 Tests for `src/api/middleware/auth.py` (valid, invalid, missing)
- [x] S23.5 Tests for `src/api/middleware/rate_limit.py` (limits, burst, cleanup)

#### Worker Node Tests
- [x] S23.6 Tests for `src/workers/worker_routes.py` + worker_completion
- [x] S23.7 Tests for `src/workers/worker_node.py` + worker_init
- [x] S23.8 Tests for `src/workers/worker_vision_routes.py` + glm_visual

#### Critical Module Boost
- [x] S23.9 Boost `auth.py` coverage to 100%
- [x] S23.10 Boost `gateway` module coverage to 96%+
- [x] S23.11 Boost `rate_limiter.py` coverage to 100%
- [x] S23.12 Boost `circuit_breaker.py` to 99%+

#### Remaining Module Coverage
- [x] S23.13 Tests for `src/channels/` (webhook, channel_adapter, streaming)
- [x] S23.14 Tests for `src/automation/` (browser_client, scraping_pipeline)
- [x] S23.15 Tests for `src/skills/` (registry, executor, handler)
- [x] S23.16 Tests for `src/memory/` (memory_entry, preferences, services)
- [x] S23.17 Tests for `src/routing/` (mesh_backend, mesh_strategies, mesh_parallel)
- [x] S23.18 Tests for `src/devices/` (device_connection, device_capabilities)
- [x] S23.19 Tests for `src/models/` (catalog, operations, downloads, cli)

#### Gate Check
- [x] S23.20 Run `pytest --cov-fail-under=95` and verify pass (97% achieved)
- [x] S23.21 Run critical module check: auth 100%, routing 97%+, policy 100%, gateway 96%+

**Products**: API Gateway, Worker Node, Master Server, CLI, Core
**Skills**: `/unit`, `/luna-agents:luna-test`

---

### Sprint S24 - Frontend, E2E & Multi-Language Tests

**Goal**: Test coverage across all languages and E2E user journeys.

#### Web UI Tests (Playwright)
- [ ] S24.1 Playwright tests for Chat UI (`src/chat/index.html`)
- [ ] S24.2 Playwright tests for Dashboard (`src/dashboard/static/index.html`)
- [ ] S24.3 Fix and stabilize existing Playwright test suite
- [ ] S24.4 Integration test: Chat UI -> Gateway -> Provider flow

#### Control Hub Tests (Node.js)
- [ ] S24.5 Unit tests for Control Hub `server.js` routes
- [ ] S24.6 Integration test: Control Hub -> Gateway facade flow
- [ ] S24.7 Playwright tests for Control Hub web UI

#### Cloudflare Worker Tests
- [ ] S24.8 Unit tests for CF Worker routes (miniflare)
- [ ] S24.9 Integration tests for CF Worker -> Tunnel -> Gateway

#### Desktop App Tests (Go)
- [ ] S24.10 Go unit tests for `src-go/` services
- [ ] S24.11 Go integration tests for API client
- [ ] S24.12 Desktop App E2E tests

#### iOS App Tests (Swift)
- [ ] S24.13 XCTest coverage for remaining untested views
- [ ] S24.14 XCTest for ClusterManager service
- [ ] S24.15 XCTest for WebSocketManager service

#### CI Enhancement
- [ ] S24.16 Set up test coverage reporting in CI for all languages
- [ ] S24.17 Add coverage badges to README

**Products**: Chat UI, Dashboard, Control Hub, CF Worker, Desktop, iOS
**Skills**: `/unit`, `/int`, `/luna-agents:luna-test`

---

## Phase 3: Frontend Decomposition & HIG (S25-S26) — Apr 15 - May 2

### Sprint S25 - Control Hub & Edge Worker Decomposition

**Goal**: Split `server.js` (1614 lines) and `app.js` (1416 lines) into <200-line modules.

#### Control Hub Server Decomposition
- [ ] S25.1 Extract `packages/control-hub-node/routes/facade.js`
- [ ] S25.2 Extract `packages/control-hub-node/routes/docker.js`
- [ ] S25.3 Extract `packages/control-hub-node/routes/health.js`
- [ ] S25.4 Extract `packages/control-hub-node/routes/models.js`
- [ ] S25.5 Extract `packages/control-hub-node/middleware/auth.js`
- [ ] S25.6 Extract `packages/control-hub-node/middleware/rate-limit.js`
- [ ] S25.7 Extract `packages/control-hub-node/middleware/audit.js`
- [ ] S25.8 Extract `packages/control-hub-node/services/gateway-client.js`
- [ ] S25.9 Refactor `server.js` to thin entry point (<200 lines)

#### Control Hub Frontend Decomposition
- [ ] S25.10 Split `public/app.js` into component modules
- [ ] S25.11 Extract dashboard component (<200 lines)
- [ ] S25.12 Extract onboarding component (<200 lines)
- [ ] S25.13 Extract settings component (<200 lines)

#### CF Worker Optimization
- [ ] S25.14 Review CF Worker module structure (already decomposed)
- [ ] S25.15 Configure `GATEWAY_URL` secret on Cloudflare
- [ ] S25.16 Test CF Worker -> Tunnel -> Gateway end-to-end

#### Validation
- [ ] S25.17 Write tests for each new module
- [ ] S25.18 Verify `wrangler dev` and `wrangler deploy` both work
- [ ] S25.19 All Control Hub files < 200 lines confirmed

**Products**: Control Hub, CF Edge Worker
**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`

---

### Sprint S26 - Desktop, iOS Decomposition & Apple HIG Audit

**Goal**: All Go/Swift files under 200 lines. Full HIG audit across all UIs.

#### Desktop App (Go) Decomposition
- [ ] S26.1 Deprecate `simple_backend.go` (1265 lines) — redirect to `src-go/`
- [ ] S26.2 Split `src-go/main.go` (373 lines) into cmd + handlers
- [ ] S26.3 Split `src-go/services/cluster.go` (257 lines) into cluster + health
- [ ] S26.4 All Go source files < 200 lines confirmed

#### iOS App (Swift) Decomposition
- [ ] S26.5 Split `ClusterManager.swift` (425 lines) into manager + networking + state
- [ ] S26.6 Split `ModelsView.swift` (376 lines) into list + detail + actions
- [ ] S26.7 Split `ServicesView.swift` (331 lines) into list + status + controls
- [ ] S26.8 Split `DashboardView.swift` (310 lines) into sections + widgets
- [ ] S26.9 Split `NodesView.swift` (290 lines) into list + detail
- [ ] S26.10 Split `SettingsView.swift` (255 lines) into sections + pickers
- [ ] S26.11 All Swift source files < 200 lines confirmed

#### Apple HIG Audit (All UIs)
- [ ] S26.12 HIG audit: Chat UI — typography, spacing, states, dark mode
- [ ] S26.13 HIG audit: Dashboard — layout, cards, accessibility
- [ ] S26.14 HIG audit: Control Hub — onboarding, navigation, materials
- [ ] S26.15 HIG audit: Desktop App — system integration, motion, touch targets
- [ ] S26.16 HIG audit: iOS App — SF Symbols, navigation, gestures
- [ ] S26.17 Unify CSS variable system across all web UIs
- [ ] S26.18 Add dark mode to any UI missing it
- [ ] S26.19 Add accessibility labels and keyboard navigation
- [ ] S26.20 Implement deferred items: Keychain storage, app icons, onboarding flow

**Products**: Desktop App, iOS App, Chat UI, Dashboard, Control Hub
**Skills**: `/hig`, `/design`, `/unit`

---

## Phase 4: Security Hardening & Governance (S27-S28) — May 3 - May 16

### Sprint S27 - Security Audit & Hardening

**Goal**: Zero critical/high findings. Enterprise security posture.

#### OWASP & Scanning
- [ ] S27.1 Run OWASP ZAP scan against all API endpoints
- [ ] S27.2 Fix all critical and high findings
- [ ] S27.3 Run `bandit` static analysis — fix all high-severity findings
- [ ] S27.4 Run `pip-audit` — resolve all critical dependencies
- [ ] S27.5 Run `npm audit` — resolve all critical dependencies

#### Headers & Transport
- [ ] S27.6 Add CSP headers to all web UIs
- [ ] S27.7 Add HSTS, X-Frame-Options, X-Content-Type-Options headers
- [ ] S27.8 Enforce HTTPS-only for all production endpoints

#### Inter-Service Security
- [ ] S27.9 Implement request signing for inter-service communication
- [ ] S27.10 Add API key rotation automation
- [ ] S27.11 Audit and harden all Docker images (non-root, minimal base)

#### Operational Security
- [ ] S27.12 Implement secrets rotation runbook
- [ ] S27.13 Penetration test the agent governance endpoint
- [ ] S27.14 Verify 0o600 permissions on all API key files
- [ ] S27.15 Validate CORS configuration matches allowed origins

**Products**: All (cross-cutting)
**Skills**: `/security-review`, `/prod`

---

### Sprint S28 - Governance API V2

**Goal**: Enterprise-grade agent governance with audit trail and <10ms latency.

#### Core Governance
- [ ] S28.1 Add policy versioning (store and audit policy changes)
- [ ] S28.2 Add approval workflow integration (webhook callback on `require_approval`)
- [ ] S28.3 Add governance audit trail (log all decisions with full context)
- [ ] S28.4 Implement policy templates (pre-built policies for common use cases)

#### Dashboard & Monitoring
- [ ] S28.5 Add governance dashboard panel (decisions/day, deny rate, safety scores)
- [ ] S28.6 Add rate limiting per-policy (prevent policy abuse)

#### API & Documentation
- [ ] S28.7 Add governance API v2 endpoint with richer response format
- [ ] S28.8 Write comprehensive governance integration tests
- [ ] S28.9 Update `docs/AGENT_GOVERNANCE_API.md` for v2
- [ ] S28.10 Performance test governance endpoint (target: <10ms latency)

**Products**: API Gateway, Dashboard, Control Hub
**Skills**: `/design`, `/unit`, `/int`, `/luna-agents:luna-docs`

---

## Phase 5: Production & Launch (S29-S30) — May 17 - May 30

### Sprint S29 - Production Deployment & Validation

**Goal**: All services running, monitored, load-tested, apps built.

#### Infrastructure Validation
- [ ] S29.1 Validate Docker Compose full stack (all services healthy)
- [ ] S29.2 Configure and test Cloudflare Tunnel end-to-end
- [ ] S29.3 Run production smoke tests against staging
- [ ] S29.4 Validate Prometheus metrics and Grafana dashboards
- [ ] S29.5 Validate alerting rules fire correctly

#### Load & Reliability
- [ ] S29.6 Run load tests: 200 concurrent, sustained 20 req/s
- [ ] S29.7 Run backup/restore drill
- [ ] S29.8 Run chaos test: worker failure recovery
- [ ] S29.9 Run chaos test: provider failover

#### Native App Builds
- [ ] S29.10 iOS TestFlight beta build and deploy
- [ ] S29.11 Desktop App macOS .app bundle build and notarize
- [ ] S29.12 Desktop App distribution package (DMG or Homebrew tap)

#### Go-Live Checklist
- [ ] S29.13 Run `scripts/go_live_checklist.sh`
- [ ] S29.14 Validate rollback procedure

**Products**: All
**Skills**: `/prod`, `/int`, `/luna-agents:luna-deploy`

---

### Sprint S30 - Release v1.1.0 & Documentation

**Goal**: v1.1.0 released, production stable, all docs current.

#### Final Regressions
- [ ] S30.1 Final regression: all Python tests pass at 95%+ coverage
- [ ] S30.2 Final regression: all Playwright tests pass
- [ ] S30.3 Final security scan: zero critical/high
- [ ] S30.4 Final file size audit: all files < 200 lines
- [ ] S30.5 Final HIG compliance check across all UIs

#### Documentation
- [ ] S30.6 Update README with current architecture
- [ ] S30.7 Update API documentation (OpenAPI spec if applicable)
- [ ] S30.8 Update deployment runbook for v1.1.0
- [ ] S30.9 Update CHANGELOG.md with v1.1.0 release notes
- [ ] S30.10 Update operational runbooks

#### Release
- [ ] S30.11 Tag `v1.1.0` release
- [ ] S30.12 Deploy to production
- [ ] S30.13 Post-launch monitoring (24h stability watch)
- [ ] S30.14 Update PRODUCTION_READINESS.md with final score

**Products**: All
**Skills**: `/prod`, `/luna-agents:luna-docs`, `/luna-agents:luna-deploy`

---

## Phase 6: V2 Features (S31-S35) — Jun 1 - Jul 17

### Sprint S31 - Multi-Tenant API Keys & Usage Tracking

- [ ] S31.1 Design multi-tenant API key schema (org -> team -> user)
- [ ] S31.2 Implement key scoping (per-model, per-endpoint permissions)
- [ ] S31.3 Add usage tracking per key (tokens consumed, requests, cost)
- [ ] S31.4 Build usage dashboard panel (Apple HIG)
- [ ] S31.5 Add usage alerts (budget thresholds)
- [ ] S31.6 Add key analytics endpoint (`GET /v1/usage`)
- [ ] S31.7 Add rate limiting per-key (configurable per tier)
- [ ] S31.8 Write full test suite (100% coverage for auth paths)
- [ ] S31.9 Update API docs

**Products**: API Gateway, Dashboard, Control Hub
**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`

---

### Sprint S32 - Conversation History & RAG

- [ ] S32.1 Implement server-side conversation storage (SQLite)
- [ ] S32.2 Add conversation API (`GET /v1/conversations`, `GET /v1/conversations/:id`)
- [ ] S32.3 Implement context window management (auto-truncate, summarize)
- [ ] S32.4 Add document ingestion endpoint (`POST /v1/documents`)
- [ ] S32.5 Implement vector embedding storage (sqlite-vec)
- [ ] S32.6 Add RAG retrieval in chat completions (auto-inject context)
- [ ] S32.7 Build conversation UI in Chat web app (Apple HIG)
- [ ] S32.8 Add conversation export/import
- [ ] S32.9 Write full test suite

**Products**: API Gateway, Chat UI, Master Server
**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`

---

### Sprint S33 - Streaming & WebSocket API

- [ ] S33.1 Add WebSocket API endpoint (`ws://gateway/v1/chat`)
- [ ] S33.2 Implement bidirectional streaming (user can cancel mid-stream)
- [ ] S33.3 Add function calling / tool use support
- [ ] S33.4 Add structured output (JSON mode) across all providers
- [ ] S33.5 Implement response caching for identical prompts
- [ ] S33.6 Add streaming to OpenHands provider
- [ ] S33.7 Write full test suite

**Products**: API Gateway, Worker Node, Chat UI
**Skills**: `/design`, `/unit`, `/optimize`

---

### Sprint S34 - Admin Dashboard

- [ ] S34.1 Design admin dashboard (Apple HIG, separate from monitoring)
- [ ] S34.2 Build API key management UI (create, revoke, scope, usage)
- [ ] S34.3 Build model management UI (load, unload, configure, download)
- [ ] S34.4 Build user/team management UI
- [ ] S34.5 Build policy management UI (create, edit, test policies)
- [ ] S34.6 Build real-time request log viewer
- [ ] S34.7 Add governance decision audit viewer
- [ ] S34.8 Write E2E tests for admin dashboard

**Products**: Dashboard, API Gateway
**Skills**: `/hig`, `/design`, `/unit`, `/luna-agents:luna-plan`

---

### Sprint S35 - Performance Optimization & v2.0.0 Release

- [ ] S35.1 Profile and optimize gateway routing latency
- [ ] S35.2 Add connection pooling across all providers
- [ ] S35.3 Optimize rate limiter memory usage
- [ ] S35.4 Add response compression (gzip/brotli)
- [ ] S35.5 Load test: 500 concurrent, 50 req/s sustained
- [ ] S35.6 Final security scan: zero findings all severities
- [ ] S35.7 Final coverage report: 95% global, 100% critical
- [ ] S35.8 Update all docs for v2.0
- [ ] S35.9 Tag `v2.0.0` release
- [ ] S35.10 Deploy to production

**Products**: All
**Skills**: `/optimize`, `/prod`, `/security-review`, `/luna-agents:luna-deploy`

---

## Product-Sprint Coverage Matrix

| Product | S22 | S23 | S24 | S25 | S26 | S27 | S28 | S29 | S30 | S31 | S32 | S33 | S34 | S35 |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| API Gateway | | X | | | | X | X | X | X | X | X | X | | X |
| Master Server | X | X | | | | X | | X | X | | X | | | X |
| Worker Node | X | X | | | | X | | X | X | | | X | | X |
| CLI | X | X | | | | | | X | X | | | | | |
| Chat UI | | | X | | X | X | | X | X | | X | X | | |
| Dashboard | | | X | | X | X | X | X | X | X | | | X | |
| Control Hub | | | X | X | X | X | | X | X | X | | | | |
| Desktop App | | | X | | X | X | | X | X | | | | | |
| iOS App | | | X | | X | X | | X | X | | | | | |
| CF Edge Worker | | | X | X | | X | | X | X | | | | | |
| Observability | | | | | | | | X | X | | | | | X |

---

## Parallel Execution Tracks

| Track | Focus | Sprints |
|-------|-------|---------|
| A - Backend | Python decomposition + coverage | S22 -> S23 -> S27 -> S28 -> S29 |
| B - Frontend | JS/Go/Swift decomposition + HIG | S25 -> S26 -> S24 -> S34 |
| C - Testing | Coverage across all languages | S23 -> S24 -> S29 -> S30 |
| D - Security | Audit + hardening + governance | S27 -> S28 -> S29 |
| E - Native Apps | Desktop + iOS build + ship | S26 -> S29 -> S30 |

---

## Timeline Overview

| Phase | Sprints | Dates | Focus |
|-------|---------|-------|-------|
| Phase 1: Stabilization | S20-S22 | Feb 27 - Mar 27 | Git, decomposition |
| Phase 2: Test Coverage | S23-S24 | Mar 28 - Apr 14 | 95% coverage |
| Phase 3: Frontend & HIG | S25-S26 | Apr 15 - May 2 | Decompose + HIG audit |
| Phase 4: Security | S27-S28 | May 3 - May 16 | OWASP, governance v2 |
| Phase 5: Production | S29-S30 | May 17 - May 30 | Deploy v1.1.0 |
| Phase 6: V2 Features | S31-S35 | Jun 1 - Jul 17 | New features, v2.0.0 |
| Phase 7: Video & Profiles | S36-S40 | Jul 18 - Sep 11 | User profiles, video API, multimodal |

Total: 28 weeks (Feb 27 - Sep 11, 2026)

---

## Skill Workflow Per Sprint

Every sprint follows this execution sequence:

1. `/luna-agents:luna-plan` — Break sprint into ordered tasks
2. `/luna-agents:luna-execute` — Build each task
3. `/unit` — Write unit tests (100% target for critical paths)
4. `/security-review` — Check OWASP, secrets, auth gaps
5. `/hig` — UI compliance (if UI changes)
6. `/luna-agents:luna-review` — Code review
7. `/int` — Integration tests
8. `/prod` — Production readiness check
9. `/luna-agents:luna-docs` — Documentation update

---

## Phase 7: Video & User Profiles (S36-S40) — Jul 18 - Sep 11

### Sprint S36 - User Profile System & Role Presets

**Goal**: Role-based user profiles with presets that configure model selection, system prompts, tools, and UI per persona.

#### Profile Engine

- [ ] S36.1 Design profile schema: `UserProfile { id, role, display_name, avatar, preferences, presets }`
- [ ] S36.2 Implement `src/core/profile_engine.py` — profile CRUD, validation, defaults
- [ ] S36.3 Implement `src/core/profile_presets.py` — built-in preset definitions
- [ ] S36.4 Add profile API: `POST /v1/profiles`, `GET /v1/profiles/:id`, `PATCH /v1/profiles/:id`
- [ ] S36.5 Add profile selection to auth flow — attach profile to API key or session
- [ ] S36.6 Route profile preferences into chat completions (model, system prompt, temperature)

#### Built-In Role Presets

- [ ] S36.7 **Developer** — code-optimized models, coding system prompt, high temperature for creativity
- [ ] S36.8 **DevOps / SRE** — infra-focused prompts, Terraform/K8s context, low temperature for precision
- [ ] S36.9 **QA / Test Engineer** — test generation prompts, bug analysis templates, edge-case focus
- [ ] S36.10 **Business Analyst** — data analysis models, report templates, structured output mode
- [ ] S36.11 **Product Manager** — PRD templates, user story generation, prioritization frameworks
- [ ] S36.12 **Designer / UX** — UI review prompts, accessibility checks, HIG compliance templates
- [ ] S36.13 **Data Scientist** — Python/R code gen, statistical analysis prompts, visualization helpers
- [ ] S36.14 **Security Engineer** — threat modeling prompts, vulnerability analysis, OWASP context
- [ ] S36.15 **Technical Writer** — documentation generation, API docs, changelog templates
- [ ] S36.16 **Support / Customer Success** — empathetic tone, troubleshooting flows, ticket templates

#### Profile Preset Schema

```json
Preset {
  role: string               // "developer" | "devops" | "qa" | ...
  preferred_models: string[] // ["claude-sonnet-4-6", "gpt-4o"]
  system_prompt: string      // Role-specific system instructions
  temperature: float         // 0.1 (precise) to 1.0 (creative)
  tools_enabled: string[]    // ["code_execution", "web_search", ...]
  output_format: string      // "markdown" | "json" | "plain"
  context_sources: string[]  // ["docs", "codebase", "tickets"]
  ui_theme: string           // "code-dark" | "analyst-light" | ...
  shortcuts: object          // Role-specific quick actions
}
```

#### UI and Integration

- [ ] S36.17 Profile selector in Chat UI (Apple HIG dropdown with role icons)
- [ ] S36.18 Profile selector in Control Hub onboarding
- [ ] S36.19 Profile selector in iOS app settings
- [ ] S36.20 Profile selector in Desktop app
- [ ] S36.21 Write full test suite (100% coverage for profile engine)
- [ ] S36.22 Update API docs with profile endpoints

**Products**: API Gateway, Chat UI, Control Hub, iOS App, Desktop App
**Skills**: `/design`, `/unit`, `/hig`, `/luna-agents:luna-plan`

---

### Sprint S37 - Profile-Driven Routing & Custom Presets

**Goal**: Smart routing based on profile, user-created custom presets, team sharing.

#### Smart Routing by Profile

- [ ] S37.1 Profile-aware model selection in router (prefer profile's preferred_models)
- [ ] S37.2 Auto-inject profile system prompt into every request
- [ ] S37.3 Profile-specific rate limits and quotas
- [ ] S37.4 Profile analytics — track usage patterns per role

#### Custom Presets

- [ ] S37.5 User-created custom presets (`POST /v1/profiles/presets`)
- [ ] S37.6 Preset inheritance — extend built-in presets with overrides
- [ ] S37.7 Preset versioning — track changes, rollback
- [ ] S37.8 Team preset sharing — org-level preset library

#### Advanced Profiles

- [ ] S37.9 **Executive / C-Suite** — summary-first outputs, KPI dashboards, strategic analysis
- [ ] S37.10 **Legal / Compliance** — contract review, regulatory analysis, cautious tone
- [ ] S37.11 **Sales / Marketing** — copywriting, competitor analysis, pitch generation
- [ ] S37.12 **HR / People Ops** — policy drafting, interview prep, job description templates
- [ ] S37.13 **Finance / Accounting** — financial modeling prompts, report formatting, precision mode
- [ ] S37.14 **Research / Academic** — citation-aware, literature review, hypothesis generation

#### Governance Integration

- [ ] S37.15 Profile-scoped governance policies (restrict tools per role)
- [ ] S37.16 Audit log enriched with profile context
- [ ] S37.17 Write full test suite
- [ ] S37.18 Update docs

**Products**: API Gateway, Control Hub, Dashboard
**Skills**: `/design`, `/unit`, `/security-review`, `/luna-agents:luna-execute`

---

### Sprint S38 - Video Analysis API

**Goal**: Extend existing vision pipeline to support video input — frame extraction, temporal analysis, video understanding.

#### Video Processing Engine

- [ ] S38.1 Implement `src/core/video_processor.py` — frame extraction (ffmpeg), keyframe detection
- [ ] S38.2 Implement `src/core/video_analyzer.py` — multi-frame analysis with temporal context
- [ ] S38.3 Add video upload endpoint: `POST /v1/video/analyze`
- [ ] S38.4 Add video URL analysis: `POST /v1/video/analyze-url`
- [ ] S38.5 Implement frame sampling strategies (uniform, scene-change, keyframe)

#### Video Understanding Capabilities

- [ ] S38.6 Video summarization — extract key moments, generate timeline
- [ ] S38.7 Video Q&A — ask questions about video content
- [ ] S38.8 Action recognition — detect activities, transitions, events
- [ ] S38.9 Video-to-text transcription pipeline (audio track -> Whisper -> text)
- [ ] S38.10 Screen recording analysis — detect UI flows, extract steps

#### Integration with Existing Vision

- [ ] S38.11 Extend vision pipeline templates for video (document scan video, UI walkthrough)
- [ ] S38.12 Extend device `ScreenCapability` to feed recordings into video analyzer
- [ ] S38.13 Add video analysis to governance (flag unsafe video content)

#### S38 Validation

- [ ] S38.14 Write full test suite
- [ ] S38.15 Add video processing metrics and observability
- [ ] S38.16 Update API docs

**Products**: API Gateway, Worker Node, Core
**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`

---

### Sprint S39 - Video Generation & Multimodal Output

**Goal**: Generate video content via provider routing (Sora, Runway, Stable Video).

#### Video Generation API

- [ ] S39.1 Add video generation endpoint: `POST /v1/video/generations`
- [ ] S39.2 Implement `src/providers/video_provider.py` — base video provider interface
- [ ] S39.3 Add OpenAI Sora provider adapter
- [ ] S39.4 Add Runway ML provider adapter
- [ ] S39.5 Add Stable Video Diffusion provider adapter (self-hosted via Ollama)

#### Video Generation Features

- [ ] S39.6 Text-to-video generation with prompt routing to best provider
- [ ] S39.7 Image-to-video animation (extend existing image with motion)
- [ ] S39.8 Video style transfer (apply visual style to existing video)
- [ ] S39.9 Video editing via natural language ("remove background", "add captions")
- [ ] S39.10 Generation progress streaming (SSE updates during long renders)

#### Video Management

- [ ] S39.11 Video storage and retrieval (`GET /v1/video/:id`)
- [ ] S39.12 Video thumbnail generation
- [ ] S39.13 Video format conversion (MP4, WebM, GIF)
- [ ] S39.14 Video gallery UI in Chat and Dashboard (Apple HIG)

#### S39 Validation

- [ ] S39.15 Content safety filtering for generated video
- [ ] S39.16 Write full test suite
- [ ] S39.17 Update API docs

**Products**: API Gateway, Worker Node, Chat UI, Dashboard
**Skills**: `/design`, `/unit`, `/hig`, `/luna-agents:luna-execute`

---

### Sprint S40 - Audio/Speech API & Profile-Driven Multimodal

**Goal**: Complete multimodal stack (text + image + video + audio) with profile-aware defaults.

#### Audio API

- [ ] S40.1 Add speech-to-text: `POST /v1/audio/transcriptions` (Whisper routing)
- [ ] S40.2 Add text-to-speech: `POST /v1/audio/speech` (OpenAI TTS / ElevenLabs)
- [ ] S40.3 Add audio analysis: `POST /v1/audio/analyze` (sentiment, speaker detection)
- [ ] S40.4 Real-time voice chat via WebSocket (push-to-talk interface)

#### Profile-Driven Multimodal Defaults

- [ ] S40.5 Developer profile: code screenshot analysis, terminal recording review
- [ ] S40.6 QA profile: UI test recording analysis, bug video reproduction
- [ ] S40.7 Business Analyst profile: meeting transcription, chart/graph analysis
- [ ] S40.8 Designer profile: design review from video walkthroughs, Figma screenshot comparison
- [ ] S40.9 Support profile: customer screen recording analysis, issue reproduction

#### Cross-Modal Workflows

- [ ] S40.10 Video meeting -> transcription -> action items -> task creation
- [ ] S40.11 Screen recording -> step extraction -> documentation generation
- [ ] S40.12 Voice note -> text -> structured ticket/story
- [ ] S40.13 Write full test suite
- [ ] S40.14 Update API docs

**Products**: API Gateway, Worker Node, Chat UI, iOS App
**Skills**: `/design`, `/unit`, `/luna-agents:luna-plan`

---

### Updated Product-Sprint Coverage (S36-S40)

| Product | S36 | S37 | S38 | S39 | S40 |
|---------|-----|-----|-----|-----|-----|
| API Gateway | X | X | X | X | X |
| Worker Node | | | X | X | X |
| Chat UI | X | | | X | X |
| Control Hub | X | X | | | |
| Dashboard | | X | X | X | |
| Desktop App | X | | | | |
| iOS App | X | | | | X |

---

### Full Profile Preset Catalog (20 Roles)

| # | Role | Model Bias | Temperature | Key Tools | Output Style |
|---|------|-----------|-------------|-----------|-------------|
| 1 | Developer | claude-sonnet, codellama | 0.7 | code_exec, git, search | Markdown + code blocks |
| 2 | DevOps / SRE | gpt-4o, claude-sonnet | 0.3 | shell, docker, k8s | YAML + commands |
| 3 | QA / Test Engineer | claude-sonnet, gpt-4o | 0.5 | test_gen, browser, assertions | Test cases + steps |
| 4 | Business Analyst | gpt-4o, claude-sonnet | 0.5 | data_analysis, charts | Tables + reports |
| 5 | Product Manager | claude-sonnet, gpt-4o | 0.6 | docs, prioritization | PRDs + user stories |
| 6 | Designer / UX | gpt-4o-vision, claude | 0.7 | image_analysis, figma | Visual feedback + specs |
| 7 | Data Scientist | gpt-4o, deepseek | 0.4 | code_exec, notebooks | Code + visualizations |
| 8 | Security Engineer | claude-sonnet, gpt-4o | 0.2 | vuln_scan, threat_model | Findings + CVSS |
| 9 | Technical Writer | claude-sonnet, gpt-4o | 0.5 | docs, search | Clean prose + structure |
| 10 | Support / CS | gpt-4o, claude-sonnet | 0.6 | tickets, kb_search | Empathetic + actionable |
| 11 | Executive / C-Suite | claude-sonnet, gpt-4o | 0.4 | dashboards, summaries | Bullet summaries |
| 12 | Legal / Compliance | claude-sonnet | 0.2 | doc_review, search | Precise + cited |
| 13 | Sales / Marketing | gpt-4o, claude-sonnet | 0.8 | copywriting, analytics | Persuasive + formatted |
| 14 | HR / People Ops | gpt-4o | 0.5 | templates, policies | Professional + inclusive |
| 15 | Finance / Accounting | gpt-4o, claude-sonnet | 0.2 | calculations, sheets | Numbers + precision |
| 16 | Research / Academic | claude-sonnet, gpt-4o | 0.4 | search, citations | Academic + structured |
| 17 | Content Creator | gpt-4o, claude-sonnet | 0.9 | image_gen, video_gen | Creative + multimedia |
| 18 | Project Manager | claude-sonnet, gpt-4o | 0.5 | tasks, timelines | Gantt + status reports |
| 19 | Educator / Trainer | gpt-4o, claude-sonnet | 0.6 | quizzes, explanations | Step-by-step + examples |
| 20 | Startup Founder | claude-sonnet, gpt-4o | 0.7 | pitch, mvp, analytics | Lean + actionable |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Control Hub decomposition breaks facade | High | Medium | Incremental extraction, full regression |
| iOS decomposition breaks navigation | Medium | Medium | Test each view independently |
| Desktop Go refactor breaks WebSocket | Medium | Low | Keep interfaces stable, test first |
| Test coverage push delays features | Low | High | Dedicated sprints, no feature mixing |
| iOS TestFlight requires Apple cert | Medium | Medium | Set up provisioning early in S29 |
| CF Worker split breaks edge proxy | Medium | Low | Use `wrangler dev` for local testing |
| Performance regression from refactoring | Medium | Low | Benchmark before/after each sprint |
| Security scan reveals critical issues | High | Medium | Prioritize fixes, block release |

---

## Definition of Done (All Sprints)

A task is complete only when:

- [ ] Code merged with passing CI
- [ ] All source files < 200 lines
- [ ] Test coverage: 95% global, 100% critical modules
- [ ] Security scan: 0 critical/high findings
- [ ] Apple HIG compliance verified (if UI change)
- [ ] Observability: logs, metrics, health endpoints present
- [ ] Documentation updated
- [ ] Rollback path validated

---

## Program KPIs

| KPI | Target |
|-----|--------|
| API Availability | >= 99.9% uptime |
| Routing Latency | p95 < 200ms (v1.1), < 100ms (v2.0) |
| Test Coverage | >= 95% global, 100% critical |
| Security | Zero hardcoded secrets, zero critical CVEs |
| UX Onboarding | >= 85% completion rate |
| File Modularity | 0 files over 200 lines |
| Time to First Run | < 15 minutes from channel activation |
| Profile Adoption | >= 60% of users select a role preset |
| Video API Latency | p95 < 5s for analysis, < 60s for generation |
| Multimodal Coverage | 4 modalities (text, image, video, audio) |
| Role Presets Shipped | 20 built-in presets at launch |
