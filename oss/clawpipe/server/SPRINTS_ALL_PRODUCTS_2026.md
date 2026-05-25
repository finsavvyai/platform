# FinSavvyAI LLM - Full Sprint Plan (All Products)

## Scope
This plan covers every product surface in this repository:

1. Core Cluster + OpenAI-Compatible Gateway (`src/`)
2. Cloudflare Edge API (`cloudflare-api/`)
3. Control Hub Facade Node Service (`packages/control-hub-node/`)
4. Web Dashboard UX (`src/dashboard/static/`, `packages/control-hub-node/public/`)
5. Channel Connectors (WhatsApp/Slack/Telegram under `src/channels/`)
6. OpenClaw/OpenHands Integration (`src/providers/`, `src/core/`)
7. Desktop App (`desktop-app/`)
8. iOS Companion App (`ios-app/`)
9. Observability + SRE (`observability/`, `deploy/`)
10. CI/CD + Security + QA (`tests/`, `.github/workflows/`, scripts)

## Product Coverage Matrix

| Product Surface | Primary Sprints | Output |
|---|---|---|
| Core Cluster + Gateway | 1, 2, 3, 8 | Stable routing, secure auth, provider orchestration |
| Cloudflare Edge API | 1, 2, 7, 9 | Secure edge ingress, rate limits, runbook-ready operations |
| Control Hub Facade | 1, 4, 5 | Reliable orchestration facade + guided operations UX |
| Web Dashboard UX | 1, 4, 5 | Apple-HIG-aligned onboarding and management states |
| Channel Connectors | 2, 4, 10 | Production-ready WhatsApp/Slack/Telegram onboarding |
| OpenClaw/OpenHands | 3, 7, 8 | Capability routing, retries, governance scoring |
| Desktop App | 6 | Operator-grade controls and telemetry visibility |
| iOS App | 6 | Mobile companion for monitoring + controlled actions |
| Observability + SRE | 7, 9 | Golden signals, alerting, game-day validated runbooks |
| CI/CD + Security + QA | 1, 2, 9 | Mandatory coverage/security/file-length gates |

## Product Vision
Build a production-grade AI orchestration platform where any team can connect channels, route to best LLM skills, and operate safely with enterprise controls and Apple-HIG quality UX.

## Program KPIs
- Availability: `>= 99.9%` API uptime
- Latency: p95 `< 800ms` for non-stream model routing
- Quality: `>= 95%` global line coverage, `100%` for critical modules (auth/routing/policy/channel ingress)
- Security: zero hardcoded secrets, blocking critical CVEs before deploy
- UX: onboarding completion rate `>= 85%`
- Growth: channel activation to first successful run `< 15 minutes`

## Sprint Cadence
- Sprint length: 2 weeks
- Daily: plan, build, test, secure, demo
- Release train: staging each sprint, production every 2 sprints

## Execution Status Snapshot (As of 2026-03-02)

Completed sprints in the active execution track:
- S20: Git stabilization and baseline tagging (`v1.1.0-rc1`)
- S21: Gateway decomposition (gateway reduced to 189 lines)
- S22: Worker/backend decomposition (549 tests passing)
- S23: Python coverage hardening (1,981 tests, 97% coverage)
- S24: Frontend + E2E + multi-language test expansion (446 new non-Python tests)
- S25: Security hardening (auth mode, worker auth, security headers, CORS hardening)
- S26: OpenClaw deep integration (fallback chain, governance gate, retry strategy)
- S27: Channel connectivity foundation (Slack adapter, health monitor, webhook dedup, sandbox)

Current sprint focus:
- **S28 (Next): Control Hub UX (Apple HIG quality)**
- Guided onboarding, dynamic status/action cards, accessibility-first UI states, and UI module decomposition.

## Sprint 1 - Production Baseline
Goal: stabilize foundations and remove release blockers.

- Core: finalize config validation, remove fallback insecure defaults
- Cloudflare: workers.dev + custom domain health checks and rollback path
- Facade: reliable Node startup, typed API contracts, error boundaries
- Dashboard: responsive layout + guided onboarding skeleton
- QA/Security: CI gates for lint, tests, coverage, vuln scan

Exit criteria:
- One-command local boot works
- Health endpoints pass for local and edge
- CI required checks all green

## Sprint 2 - Security Hardening
Goal: production security by default.

- Introduce strict auth modes (none/dev/service/jwt) with explicit environment gating
- Add webhook signature validation for channel ingress
- Enforce secure headers and CORS allow-list
- Add rate-limit and abuse controls at edge + app layers
- Add secret rotation runbook and breach response flow

Exit criteria:
- Security tests passing
- No critical/high unresolved vulnerabilities
- Threat model documented and linked in docs

## Sprint 3 - OpenClaw + OpenHands Deep Integration
Goal: deliver seamless orchestration, not just wrappers.

- Unified provider registry with capability discovery
- Skill execution lifecycle: queue, run, stream, retry, recover
- Governance scoring on high-risk actions
- Consistent request/response shape across providers
- Add integration tests for provider fallback and partial failure

Exit criteria:
- OpenClaw and OpenHands routes both pass integration test suite
- Governance policy gate blocks unsafe actions in test cases

## Sprint 4 - Channel Connectivity
Goal: connect any channel without CLI.

- Wizard for WhatsApp/Slack/Telegram connection
- Validate credentials in real time with actionable error copy
- Store channel metadata + health state in a single source
- Add webhook replay protection and idempotency keys
- Add channel smoke tests and sandbox simulation mode

Exit criteria:
- New user can connect one channel end-to-end via UI only
- First inbound message reaches a configured default agent

## Sprint 5 - Control Hub UX (Apple HIG Quality)
Goal: modern, guided, trust-building dashboard experience.

- Replace static forms with guided onboarding flow and progress states
- Add dynamic cards: status, actions, recommendations, failures
- Improve visual system: spacing, typography, motion, accessibility
- Provide in-product tooltips for unknown concepts
- Implement empty/loading/error states for every panel

Exit criteria:
- Usability walkthrough complete with no dead ends
- Accessibility checks pass keyboard + screen-reader baseline

## Sprint 6 - Desktop + iOS Productization
Goal: ship polished client apps for operations.

- Desktop: service control, logs, model operations, secure settings storage
- iOS: read-only + controlled actions for alerts and service status
- Shared API client contracts between apps and gateway
- Crash/error telemetry for both app surfaces
- Signed builds and distribution checklist

Exit criteria:
- Desktop and iOS can perform critical operator flows
- Build artifacts generated reproducibly in CI

## Sprint 7 - Observability and Reliability
Goal: reduce MTTR and improve runtime confidence.

- Golden signals dashboard (latency, traffic, errors, saturation)
- Structured correlation IDs across edge + core + providers
- Alerting for failure patterns (provider failover storms, queue growth)
- Chaos tests for worker and upstream failures
- Automated post-incident template and drill process

Exit criteria:
- Simulated incidents trigger alerts and clear runbook actions
- MTTR playbook validated by at least one game day run

## Sprint 8 - Performance + Cost Optimization
Goal: scale responsibly.

- Request queue tuning and admission control
- Smart provider routing by latency/cost profile
- Caching for model listing and metadata endpoints
- Load tests for sustained and burst traffic
- Capacity planning model by channel and model mix

Exit criteria:
- p95 and error-rate targets hit under load profile
- Cost per 1K requests baseline documented

## Sprint 9 - Compliance and Launch Readiness
Goal: complete enterprise readiness package.

- Security checklist mapped to OWASP ASVS L2 controls
- Data retention and privacy policy implementation hooks
- Audit trails for admin and high-risk actions
- Backup/restore verified for critical state
- Final release checklist with rollback and communication plan

Exit criteria:
- Production readiness review signed off
- Staging-to-prod cutover rehearsal completed successfully

## Sprint 10 - Viral Growth & Production Distribution (Updated)
Goal: product-led expansion beyond dev-only use cases.

- One-click “share workflow” links for non-technical users
- Agent output templates for support/sales/ops use cases
- Slack/WhatsApp “ask AI to review this” flows with human approval mode
- Referral hooks and usage milestone nudges
- Activation funnel instrumentation and cohort tracking

Exit criteria:
- Time-to-value and retention metrics are measurable
- At least two non-dev use cases have validated user adoption

## Phase 8: Viral Growth & Production Distribution (S41-S45)

### Sprint S41 — Zero-Config Deploy & Distribution
Goal: `docker run` → first API response in under 5 minutes.

- One-liner Docker, PyPI (`pip install finsavvyai`), Homebrew formulae
- `finsavvyai quickstart` wizard and `finsavvyai doctor` diagnostics
- Railway / Fly.io / Render one-click deploy buttons in README
- `/health?verbose=true` reporting setup completion percentage
- CI auto-publish pipeline: Docker Hub, GHCR, PyPI on every semver tag

Exit criteria:
- Fresh machine to first `/v1/chat/completions` response in < 5 min
- `finsavvyai doctor` reports all checks pass on clean install

### Sprint S42 — Live Demo & Interactive Playground
Goal: zero-friction try-before-you-install experience.

- Rate-limited public demo at `demo.finsavvyai.com` with Fly.io/Railway
- `/docs` Scalar interactive playground auto-generated from routes
- Embeddable chat widget (`widget.js`, < 15KB gzipped)
- Demo seed data: sample models, preset conversations, screenshot kit

Exit criteria:
- Demo reachable publicly; playground renders all route schemas
- Widget loads and sends a message end-to-end in < 3s

### Sprint S43 — OpenAI Drop-In Badge & Developer Experience
Goal: change `base_url`, nothing else.

- `GET /v1/compat` endpoint with machine-readable compatibility matrix
- OpenAI Python SDK + Node.js SDK compat test suites in CI
- Migration guides for ChatGPT, LangChain, LlamaIndex, AutoGen
- README "Works with" logo row: OpenAI SDK, LangChain, LlamaIndex
- `openai-version`, `openai-processing-ms`, `x-request-id` headers on all responses

Exit criteria:
- Official openai SDK creates a client and completes a chat in tests
- `/v1/compat` returns `coverage_percent >= 80`

### Sprint S44 — Model Arena & Community Benchmarks
Goal: head-to-head model comparisons that users share.

- Arena tab in Chat UI: blind A/B vote between two model responses
- ELO leaderboard updated in real-time and persisted
- Shareable result links (unique URL per comparison session)
- Model capability matrix page listing all connected models

Exit criteria:
- Arena records votes and updates leaderboard without page reload
- Share link reproduces comparison result for anonymous visitors

### Sprint S45 — Star-Seeking Docs, Community & Launch
Goal: Product Hunt #1, 250 GitHub stars in 30 days.

- README overhaul: badge row, hero GIF, 3-tab install, feature grid, comparison table
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` live in repo root
- GitHub Discussions enabled; issue templates (Bug, Feature, Provider Request, Q&A)
- Product Hunt launch kit, Hacker News Show HN post, Twitter/X thread
- SEO: `og:image`, `og:description`, Twitter cards, `site.json` sitemap

Exit criteria:
- README renders correctly on GitHub mobile and desktop
- Community files pass `all-contributors` and `standard-readme` lint
- Launch posts scheduled and reviewed

## Global Backlog Rules
- Priority order: Security > Reliability > User onboarding > Features > Nice-to-have UI polish
- Every feature requires: threat check, tests, observability, docs
- No release with failing CI gates
- No new source file above 200 lines (split modules early)
- Apple HIG compliance is mandatory for web/desktop/iOS UI surfaces

## Definition of Done (All Sprints)
- Tests: unit + integration + e2e relevant to change
- Coverage: project gate met; critical module gate met
- Security: static and dependency scans pass
- Observability: logs, metrics, and tracing added for new behavior
- UX: empty/loading/error states present and accessible
- Docs: README/docs/operational notes updated

## Program Summary
This roadmap covers all products and enforces one shared delivery contract:
1. Fully tested (coverage-first)
2. Fully secured (secure-by-default)
3. Modular codebase (max 200 lines per source file)
4. Apple HIG quality for all UI products

