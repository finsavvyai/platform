# UPM.Plus / AutomationHub — Full Sprints Plan

**Last updated:** February 27, 2026  
**Scope:** All products and capabilities across backend, frontend, agents, and platform.

---

## Product Areas (All Products)

| # | Product / Area | Description | Key APIs / Surfaces |
|---|----------------|-------------|---------------------|
| 1 | **Authentication & Users** | Login, register, JWT, user management | `/auth`, `/users` |
| 2 | **Organizations** | Org CRUD, membership | `/organizations` |
| 3 | **Workflows** | Workflow CRUD, execution, orchestration | `/workflows`, `/orchestration` |
| 4 | **Tasks** | Task queue, execution, monitoring | `/tasks`, `/task-queue` |
| 5 | **Agents** | Agent registry, activation, status | `/agents` |
| 6 | **Documents** | Document ingest, storage | `/documents` |
| 7 | **Knowledge & RAG** | Vector search, RAG, knowledge bases | `/knowledge`, `/vector`, `/rag` |
| 8 | **Conversational AI / Chat** | Chat, NLP, LLM integration | `/chat`, `/nlp`, `/llm` |
| 9 | **Browser Automation** | Browser automation, advanced browser | `/browser` |
| 10 | **Infrastructure** | Ansible, deployment, monitoring | `/ansible`, `/deployment`, `/monitoring` |
| 11 | **Multi-Cloud & Cloudflare** | Cloudflare, multi-cloud orchestration | `/cloudflare`, `/multi-cloud` |
| 12 | **Analytics & Performance** | Advanced analytics, performance | `/analytics`, `/performance` |
| 13 | **Multi-Tenant & Admin** | Tenants, branding, tenant admin | `/tenants`, `/branding`, `/admin` |
| 14 | **Billing** | Billing and usage | `/billing` |
| 15 | **MCP Integration** | MCP protocol, tool ecosystem | `/mcp` |
| 16 | **Health & Observability** | Health checks, metrics | `/health` |

---

## Sprint 1 — Foundation & Auth (Weeks 1–2)

**Goal:** Secure auth, users, orgs; CI green; coverage and security baselines.

- Auth: login, register, JWT, refresh, logout.
- Users: CRUD, profile; org membership.
- Organizations: CRUD, membership.
- Security: input validation, secret handling, audit logging for auth/org actions.
- CI: unit + integration for auth/users/orgs; coverage ≥90% for these paths; SAST, dependency scan, secret scan.
- File size: no new file >200 lines; refactor any that exceed.

**Exit criteria:** All auth/user/org APIs tested, coverage targets met, security checks in CI.

---

## Sprint 2 — Workflows & Tasks (Weeks 3–4)

**Goal:** Workflow persistence, execution, task queue; full test coverage.

- Workflows: DB persistence, versioning, CRUD; execution engine wired to DB.
- Tasks: task queue integration; execution status and history.
- Orchestration: workflow run, step status, error handling.
- Tests: 100% coverage on workflow/task write paths; integration tests for execute flow.
- Refactor: split any file >200 lines in workflow/task modules.

**Exit criteria:** Workflows and tasks fully persisted and tested; CI green.

---

## Sprint 3 — Agents & MCP (Weeks 5–6)

**Goal:** Agent registry, lifecycle, MCP integration; secure and tested.

- Agents: CRUD, activate/deactivate, status; registry consistency.
- MCP: protocol integration, tool discovery, safe execution boundaries.
- Tests: agent endpoints and MCP critical paths at 100% coverage.
- Security: least privilege for agent execution; audit for agent actions.

**Exit criteria:** Agents and MCP fully covered; security and file-size rules respected.

---

## Sprint 4 — Knowledge, RAG & Documents (Weeks 7–8)

**Goal:** Documents, vector store, RAG, knowledge APIs; reliability and tests.

- Documents: ingest, storage, metadata; access control.
- Knowledge: knowledge base CRUD; vector index updates.
- Vector search & RAG: query API, retrieval, citation; error handling.
- Tests: 100% coverage on document/knowledge write and RAG query paths.
- Performance: basic caching and timeouts for vector/RAG.

**Exit criteria:** Document and knowledge flows covered; RAG quality checks in CI.

---

## Sprint 5 — Conversational AI & Chat (Weeks 9–10)

**Goal:** Chat, NLP, LLM integration; safe and observable.

- Chat: session handling, history, streaming; rate limits.
- NLP/LLM: intent parsing, LLM calls; fallbacks and timeouts.
- Security: prompt/output validation; no secrets in logs.
- Tests: chat and LLM integration tests; critical paths 100%.
- UX: Apple HIG alignment for chat UI (contrast, focus, labels).

**Exit criteria:** Chat and NLP/LLM paths tested and secure; UX review done.

---

## Sprint 6 — Browser Automation (Weeks 11–12)

**Goal:** Browser automation and advanced browser features; safe and tested.

- Browser: session lifecycle, navigation, actions; credential handling.
- Advanced browser: screenshots, complex flows, self-healing where applicable.
- Security: sandboxing, no credential leakage; audit for automation runs.
- Tests: browser service and API tests; critical paths 100%.
- Refactor: keep services and routes ≤200 lines per file.

**Exit criteria:** Browser automation covered and secure; file-size compliance.

---

## Sprint 7 — Infrastructure (Ansible, Deploy, Monitor) (Weeks 13–14)

**Goal:** Ansible, deployment, monitoring APIs; production-ready.

- Ansible: playbook run, inventory, idempotency; safe execution.
- Deployment: deploy pipeline, status, rollback hooks.
- Monitoring: metrics ingestion, dashboards, alerting integration.
- Tests: infra APIs and execution paths; 100% on deploy/monitor writes.
- Security: least privilege for Ansible; audit for deploy actions.

**Exit criteria:** Infra APIs tested and documented; security checks pass.

---

## Sprint 8 — Multi-Cloud & Cloudflare (Weeks 15–16)

**Goal:** Cloudflare and multi-cloud orchestration; consistent APIs and tests.

- Cloudflare: config, DNS, Workers/Pages where applicable; error handling.
- Multi-cloud: abstraction layer, provider-agnostic operations.
- Tests: Cloudflare and multi-cloud APIs; critical paths 100%.
- Skills: use `cloudflare-deploy` skill for deployment flows where relevant.

**Exit criteria:** Multi-cloud and Cloudflare covered; deployment path validated.

---

## Sprint 9 — Analytics, Performance & Billing (Weeks 17–18)

**Goal:** Analytics, performance APIs, and billing; accurate and tested.

- Advanced analytics: aggregation, reporting APIs; tenant isolation.
- Performance: metrics, profiling endpoints; no PII in metrics.
- Billing: usage aggregation, billing APIs; 100% coverage on billing logic.
- Tests: analytics and billing critical paths; integration tests.

**Exit criteria:** Analytics and billing fully tested; coverage and security met.

---

## Sprint 10 — Multi-Tenant, Branding & Admin (Weeks 19–20)

**Goal:** Tenancy, branding, admin; secure and HIG-aligned.

- Tenants: tenant CRUD, isolation, switching.
- Branding: themes, assets, domain verification; safe uploads.
- Admin: tenant admin, user/org admin; RBAC and audit.
- Tests: 100% coverage on tenant/branding/admin write paths.
- UX: Apple HIG for settings, branding, and admin screens.

**Exit criteria:** Multi-tenant and admin secure and tested; UX sign-off.

---

## Sprint 11 — Frontend & UX Polish (Weeks 21–22)

**Goal:** All product UIs connected, accessible, and HIG-aligned.

- Per product: connect Dashboard, Workflows, Agents, Documents, Browser, Multi-Cloud, Analytics, Billing, Settings, Admin to real APIs.
- Accessibility: contrast, focus order, screen reader labels, keyboard nav.
- Motion: meaningful only; reduce clutter and steps for key tasks.
- Design: spacing, typography, and components aligned to Apple HIG.
- E2E: smoke tests for main flows (login, workflow run, agent, billing).

**Exit criteria:** All main flows work in UI; accessibility and HIG review done.

---

## Sprint 12 — Hardening & Release (Weeks 23–24)

**Goal:** Production readiness; release checklist and docs.

- Coverage: ≥90% line, ≥85% branch; 100% on auth, payments, permissions, security.
- Security: SAST, dependency scan, secret scan, license scan; no Critical/High open.
- File size: no file >200 lines in `src/`, `app/`, `lib/`.
- Monitoring: health, metrics, rollback procedure documented.
- Docs: release notes, runbooks, product-specific release checklist.
- Definition of Done: CI green, coverage and security met, UX reviewed.

**Exit criteria:** Release checklist complete; go/no-go for production.

---

## Summary Table

| Sprint | Focus | Main products |
|--------|--------|----------------|
| 1 | Foundation & Auth | Auth, Users, Organizations |
| 2 | Workflows & Tasks | Workflows, Tasks, Orchestration |
| 3 | Agents & MCP | Agents, MCP |
| 4 | Knowledge & RAG | Documents, Knowledge, Vector, RAG |
| 5 | Conversational AI | Chat, NLP, LLM |
| 6 | Browser Automation | Browser, Advanced Browser |
| 7 | Infrastructure | Ansible, Deployment, Monitoring |
| 8 | Multi-Cloud | Cloudflare, Multi-Cloud |
| 9 | Analytics & Billing | Analytics, Performance, Billing |
| 10 | Multi-Tenant & Admin | Tenants, Branding, Admin |
| 11 | Frontend & UX | All product UIs, Accessibility, HIG |
| 12 | Hardening & Release | Coverage, Security, Docs, Release |
| 13 | External Integrations | OpenClaw, OpenHands, resilience, health |

---

## Sprint 13 — External Integrations: OpenClaw & OpenHands (Weeks 25–26)

**Goal:** Production-ready OpenClaw and OpenHands integration with full robustness.

- **Resilience layer:** Circuit breaker and rate limiter for external calls (`backend/app/integrations/resilience.py`); reuse in adapters.
- **OpenHands:** `OpenHandsAdapter` (Cloud API); `DevelopmentAgent` registered in registry; tasks delegate to OpenHands with timeout and quota.
- **OpenClaw:** Webhook receiver `POST /api/v1/integrations/openclaw/incoming` with signature verification, idempotency (Redis), task/chat creation; optional outbound reply.
- **Health:** `/health/detailed` includes optional integrations (openclaw, openhands) with status and latency.
- **Config:** `integrations_config.py` and env vars; feature flags per integration.
- **Audit:** Log all external agent invocations and webhook receipts.
- **Tests:** Unit tests for adapter, agent, webhook; integration test for health and webhook (when enabled).

**Exit criteria:** OpenClaw webhook and OpenHands agent working behind feature flags; circuit breaker and rate limits applied; health reports integrations; files ≤200 lines.

---

## Optional Integrations (Reference)

- **OpenClaw:** Multi-channel gateway. See `docs/INTEGRATION_OPENCLAW_OPENHANDS.md`.
- **OpenHands:** Development agent. Uses `ExternalAgentAdapter` in `backend/app/integrations/base.py`.

---

## Cross-Cutting Rules (All Sprints)

- **Coverage:** 100% critical paths (auth, payments, data writes, permissions, security). ≥90% line, ≥85% branch overall.
- **Security:** SAST, dependency, secret, license scans in CI; block on Critical/High.
- **File size:** Max 200 lines per file in `src/`, `app/`, `lib/`.
- **Design:** Apple HIG for all user-facing UI; accessibility required.
- **Definition of Done:** CI passing, coverage and security met, docs updated, UX reviewed where applicable.
