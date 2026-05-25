# SDLC Platform — Implementation Plan

**Purpose:** Single execution plan tying requirements, design, and sprints into ordered work with clear dependencies and gates.  
**References:** [requirements.md](../.luna/sdlc-platform/requirements.md), [design.md](../.luna/sdlc-platform/design.md), [SPRINTS_PLAN.md](./SPRINTS_PLAN.md), [VISION.md](./VISION.md).

---

## 1. Scope and Goals

| Item | Description |
|------|--------------|
| **Product** | SDLP v3 — Secure Data Learning Platform (trust layer between enterprise data and AI) |
| **Horizon** | 2025 MVP → 2026 Enterprise → 2027+ Autonomy & scale |
| **Quality gates** | 100% coverage on critical paths; ≥90% line / ≥85% branch overall; 0 Critical/High vulns; ≤200 lines/file |
| **Design** | Zero-trust, edge-first, multi-tenant; Apple HIG for all user-facing UI |

---

## 2. Phase Overview

| Phase | Name | Duration | Sprints (2025) | Primary outcome |
|-------|------|----------|----------------|-----------------|
| **0** | Prep & tooling | 1–2 weeks | — | Repo layout, CI, lint, coverage gates |
| **1** | Foundation | 4 weeks | S1–S2 | Gateway + Auth, Proxy + PII, infra ready |
| **2** | Core SDLP | 4 weeks | S3–S4, S5–S6 | Dashboard, RAG, LLM Gateway, alpha onboarding |
| **3** | Policies & SDKs | 4 weeks | S7–S8 | OPA in Gateway, policy CRUD, SDKs + docs |
| **4** | Learning & trust | 4 weeks | S9–S12 | LAM core, agents, audit trail, billing, trust pages |
| **5** | Production readiness | 4 weeks | S13–S16 | SOC2 prep, enterprise (SSO/SAML), public beta, certifications |

---

## 3. Phase 0 — Prep & Tooling (Pre-S1)

**Goal:** Repo and CI ready for multi-service development; no product features.

| # | Task | Owner | Done |
|---|------|--------|------|
| 0.1 | Confirm repo layout: `services/`, `packages/`, `landing-page/`, `web-app/`, `deployments/`, `docs/` | Eng | ☑ |
| 0.2 | Add root `package.json` / workspace config if monorepo (e.g. pnpm workspaces) | Eng | ☑ |
| 0.3 | CI: unit + integration jobs per service; coverage upload; fail on &lt;90% (or per-product gates) | Eng | ☐ |
| 0.4 | CI: SAST, dependency scan, secret scan; block merge on Critical/High | Eng | ☑ |
| 0.5 | Linting: ESLint/Prettier (TS/JS), golangci-lint (Go), ruff/black (Python) | Eng | ☑ |
| 0.6 | Document 200-line file rule and refactor policy in CLAUDE.md / README | Eng | ☐ |
| 0.7 | Create `docs/CHANGELOG.md` and runbook stub under `docs/` or `deployments/` | Eng | ☑ |

**Exit criteria:** CI green on main; coverage and security gates enforced; developers can add services under `services/` and `packages/`.

---

## 4. Phase 1 — Foundation (S1–S2, ~4 weeks)

**Goal:** Gateway with auth, Proxy Worker with PII handling, minimal Landing CTAs; infra and health in place.

### 4.1 Gateway + Auth (S1)

| # | Task | References | Done |
|---|------|-------------|------|
| 1.1 | Implement SDLP Gateway (Go): Chi router, config, graceful shutdown | design § Gateway | ☑ |
| 1.2 | Auth: email/password signup + login, JWT (15min) + refresh, bcrypt, API key validation | FR1.1, design § Auth | ☑ |
| 1.3 | Store API keys / metadata in D1 or PostgreSQL; key hash + prefix | design § API Keys | ☑ |
| 1.4 | Middleware: request ID, logging, security headers, CORS, recovery | design § Gateway middleware | ☑ |
| 1.5 | Health: `/api/health` (and `/ready` if needed) | NFR, design | ☑ |
| 1.6 | Unit + integration tests for auth and middleware; 100% on auth path | TR1, TR2 | ☐ |

### 4.2 Proxy Worker + PII (S2)

| # | Task | References | Done |
|---|------|-------------|------|
| 1.7 | Proxy Worker (Cloudflare): route to Gateway, CORS, optional API key check at edge | FR9, design § Proxy Worker | ☑ |
| 1.8 | PII at edge: detect 3 types (SSN, email, credit card); redact before forwarding | FR2.1, FR9.2 | ☑ |
| 1.9 | Deploy Worker(s); config for backend URL, env, secrets | design § Deployment | ☑ |
| 1.10 | Landing: CTAs (e.g. Request Demo, Start Free Trial) → `/signup` or equivalent | FR7.1 | ☑ |

**Phase 1 exit criteria:** Users can sign up, log in, use API keys; Proxy redacts PII and forwards to Gateway; health and CI gates pass.

---

## 5. Phase 2 — Core SDLP (S3–S6, ~8 weeks)

**Goal:** Dashboard and observability, RAG (chunking, embeddings, retrieval), LLM Gateway abstraction; alpha onboarding path.

### 5.1 Dashboard + Observability (S3–S4)

| # | Task | References | Done |
|---|------|-------------|------|
| 2.1 | Dashboard: org overview, usage stats, recent activity, quick actions | FR7.3 | ☐ |
| 2.2 | Audit log: last N (e.g. 100) entries, filters (time, user, action) | FR6.2 | ☐ |
| 2.3 | Error tracking and basic metrics (e.g. Prometheus + Grafana or provider) | NFR8, design § Observability | ☐ |
| 2.4 | Alpha: waitlist, docs site, onboarding flow for first 10 users | S4 | ☐ |

### 5.2 RAG + Embedding (S5)

| # | Task | References | Done |
|---|------|-------------|------|
| 2.5 | Document ingestion: PDF, DOCX, TXT; store raw in R2; metadata in DB | FR3.1, design § RAG, Document Processor | ☐ |
| 2.6 | Chunking: 500–1000 tokens, overlap, semantic boundaries | FR3.2, design § Chunking | ☐ |
| 2.7 | DLP in pipeline: detect/redact PII during ingestion | FR2, FR3.1 | ☐ |
| 2.8 | Embeddings: one provider (e.g. OpenAI); cache; store in pgvector (1536) | FR3.3, design § RAG | ☐ |
| 2.9 | Vector + hybrid search; top-K, filters; p95 &lt;200ms | FR3.4, design § Vector Search | ☐ |
| 2.10 | Tests: ingestion, chunking, search; 100% on critical paths | TR1, TR2 | ☐ |

### 5.3 LLM Gateway (S6)

| # | Task | References | Done |
|---|------|-------------|------|
| 2.11 | Provider abstraction: OpenAI (required), Anthropic; unified completion API | FR4.1, design § LLM Gateway | ☐ |
| 2.12 | Token budget per org; track usage; throttle at limit | FR4.2 | ☐ |
| 2.13 | Prompt firewall (stub): block list or simple rules; log blocked requests | FR4.3 | ☐ |
| 2.14 | Output sanitization: PII detection/redaction on response | FR4.4 | ☐ |
| 2.15 | Tests: provider calls, budget, firewall; 100% on auth + budget path | TR1, TR2 | ☐ |

**Phase 2 exit criteria:** Dashboard and audit visible; RAG ingest + search with DLP; LLM Gateway with budgets and firewall; alpha users onboarded.

---

## 6. Phase 3 — Policies & SDKs (S7–S8, ~4 weeks)

**Goal:** OPA policy evaluation in Gateway; policy CRUD and testing in Admin UI; SDKs (Go, TS, Python) and API docs.

### 6.1 OPA + Policies (S7)

| # | Task | References | Done |
|---|------|-------------|------|
| 3.1 | Integrate OPA in Gateway: authorize each request; cache decisions (e.g. 5min TTL) | FR1.2, design § OPA | ☐ |
| 3.2 | RBAC: roles Owner, Admin, Editor, Viewer; map to OPA input | FR1.2, design § RBAC | ☐ |
| 3.3 | Admin UI: list/create/edit policies (Rego); syntax highlight; test interface | FR6.1 | ☐ |
| 3.4 | Policy versioning and impact preview before deploy | FR6.1 | ☐ |
| 3.5 | Tests: OPA allow/deny, RBAC, policy CRUD | TR1, TR2 | ☐ |

### 6.2 SDKs + Docs (S8)

| # | Task | References | Done |
|---|------|-------------|------|
| 3.6 | Go SDK: client, auth (API key), RAG search/ingest, LLM completion; examples | FR8.1, design § Go SDK | ☐ |
| 3.7 | TypeScript SDK: browser + Node; same surface; types | FR8.3, design § TypeScript SDK | ☐ |
| 3.8 | Python SDK: sync + async; type hints; examples | FR8.2, design § Python SDK | ☐ |
| 3.9 | API reference (OpenAPI/Swagger) and quick start (&lt;15 min to first query) | DR1, DR3 | ☐ |
| 3.10 | SDKs call Gateway/Proxy in CI; no Critical/High | TR1 | ☐ |

**Phase 3 exit criteria:** All API requests go through OPA; policies manageable in Admin; SDKs and docs allow &lt;15 min to first query.

---

## 7. Phase 4 — Learning & Trust (S9–S12, ~4 weeks)

**Goal:** LAM core (compliance knowledge, feedback), first agents (Policy Learner, Risk Assessor, Provider Router); immutable audit trail; billing (Stripe); trust content.

### 7.1 LAM Core (S9–S10)

| # | Task | References | Done |
|---|------|-------------|------|
| 4.1 | LAM core: consume audit/events; compliance knowledge RAG; feedback loop | FR5, design § Learning Engine | ☐ |
| 4.2 | Policy Learner agent: suggest policy changes; sandbox test; human approval | FR5.1 | ☐ |
| 4.3 | Risk Assessor + Provider Router agents; dashboard metrics | S10 | ☐ |
| 4.4 | Tests: agent logic, feedback ingestion; coverage gates | TR1, TR2 | ☐ |

### 7.2 Compliance + Security (S11)

| # | Task | References | Done |
|---|------|-------------|------|
| 4.5 | Audit log: hash chaining, immutable store; 7-year retention strategy | FR6.2, design § Audit Logs | ☐ |
| 4.6 | Encryption at rest (DB, R2); rate limits enforced | NFR4, design § Security | ☐ |
| 4.7 | DLP: extend PII/PHI types; redaction/tokenization audit log | FR2 | ☐ |

### 7.3 Billing + Trust (S12)

| # | Task | References | Done |
|---|------|-------------|------|
| 4.8 | Stripe: Free / Startup / Enterprise tiers; subscription + usage-based | IR4, design | ☐ |
| 4.9 | Landing: About, Security page; 5 testimonials/case studies | FR7.1 | ☐ |
| 4.10 | Tests: billing and payment flows (test mode); 100% on payment path | TR1, TR3 | ☐ |

**Phase 4 exit criteria:** LAM agents run; audit immutable; encryption and rate limits in place; Stripe live for pilot; trust pages and testimonials up.

---

## 8. Phase 5 — Production Readiness (S13–S16, ~4 weeks)

**Goal:** SOC2 prep, enterprise features (SSO/SAML, RBAC, teams), public beta, certification track.

### 8.1 SOC2 Prep & Enterprise (S13–S14)

| # | Task | References | Done |
|---|------|-------------|------|
| 5.1 | Controls and policies doc; multi-region/backups; DR runbook | NFR5, design § DR | ☐ |
| 5.2 | SAML 2.0 SSO; SCIM; team management | FR1.1, S14 | ☐ |
| 5.3 | RBAC and OPA aligned with enterprise roles | FR1.2 | ☐ |

### 8.2 Beta & Certifications (S15–S16)

| # | Task | References | Done |
|---|------|-------------|------|
| 5.4 | Public beta: open signup, “Beta” badge; target 200 users, 20 paying | S15 | ☐ |
| 5.5 | SOC 2 Type I in progress; HIPAA BAA; GDPR DPA template | S16, CR1–CR2 | ☐ |
| 5.6 | Runbooks: deploy, rollback, incident response | DR4 | ☐ |

**Phase 5 exit criteria:** Enterprise SSO and teams available; public beta live; SOC2/HIPAA/GDPR tracks started; runbooks in place.

---

## 9. Dependencies and Ordering

- **Phase 0** must complete before Phase 1 (CI and repo structure).
- **Phase 1** (Gateway, Proxy, Auth) is required for all later phases.
- **Phase 2** RAG and LLM Gateway can be parallelized after Gateway + Auth; Dashboard/Observability can start in parallel with RAG.
- **Phase 3** OPA depends on Gateway; SDKs depend on stable Gateway/Proxy APIs.
- **Phase 4** LAM depends on audit log and events; billing depends on Dashboard and Stripe integration.
- **Phase 5** depends on Phases 1–4; SOC2 and enterprise features can overlap.

---

## 10. Quality and Security Checklist (Every PR)

| Check | Requirement |
|-------|-------------|
| Tests | Unit + integration; critical paths 100%; overall ≥90% line, ≥85% branch |
| Security | No secrets in code; input validation; SAST/dep/secret scan; 0 Critical/High |
| File size | New/modified files in `src/`, `app/`, `lib/`, `services/*/`, `packages/*/src/` ≤200 lines |
| Design | User-facing UI: Apple HIG; accessibility (keyboard, labels, contrast) |
| Docs | Changelog and runbooks updated for deploy/incident changes |

---

## 11. Success Metrics (from SPRINTS_PLAN / NFR)

| Metric | Target |
|--------|--------|
| Gateway p95 latency | &lt;100 ms |
| RAG retrieval p95 | &lt;200 ms |
| Critical path coverage | 100% |
| Overall coverage | ≥90% line, ≥85% branch |
| Security (main) | 0 Critical/High |
| Uptime (2026+) | 99.9% |
| Max file size | 200 lines |

---

## 12. Document History

| Date | Change |
|------|--------|
| 2026-03-07 | Initial implementation plan from requirements, design, and sprints |

---

*Align with [SPRINTS_PLAN.md](./SPRINTS_PLAN.md) for sprint-level detail and [VISION.md](./VISION.md) for strategy.*
