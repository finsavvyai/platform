# SDLC Platform — Full Sprints Plan (All Products)

**Vision reference:** [docs/VISION.md](./VISION.md)  
**Horizon:** 2025–2030, phased by year and quarter  
**Products in scope:** SDLP Gateway, RAG, LLM Gateway, Learning Engine (LAM), Admin Console, Landing & Web App, SDKs, Proxy Worker, DLP, OPA, Infra & Observability  

**Integration roadmap:** [docs/SDLP_INTEGRATION.md](./SDLP_INTEGRATION.md) — RAG, DLP, OPA, LAM wiring and next steps.

---

## Product Map

| Product / Area | Repo Path(s) | Owner Focus |
|----------------|--------------|-------------|
| **SDLP Gateway (Go)** | `services/gateway` | Zero-trust, OPA, audit, telemetry |
| **RAG Engine** | `services/rag`, `services/embedding`, `services/vector-core` | Privacy-preserving retrieval, DLP |
| **LLM Gateway** | `services/llm-gateway` | Provider abstraction, token budgets, prompt firewall |
| **Learning Engine (LAM)** | `services/lam-*.js`, `services/agents` | Policy tuning, DLP learning, feedback loop |
| **Admin Console** | `services/admin-ui` | Policy UI, audit dashboards, AI traceability |
| **Landing & Web App** | `landing-page`, `web-app/landing`, `web-app/auth`, `web-app/dashboard`, `web-app/onboarding` | Acquisition, signup, dashboard UX |
| **Proxy Worker** | `services/proxy-worker`, `services/landing-worker` | API proxy, PII handling, edge |
| **DLP** | `services/dlp`, `packages/dlp` | PII detection, redaction, tokenization |
| **OPA / Policies** | `services/opa`, `packages/policies`, `packages/policy` | Policy evaluation, authorization |
| **SDKs** | `packages/sdk-go`, `packages/sdk-ts`, `packages/sdk-py` | Client integration, docs |
| **Infra & Observability** | `deployments/`, `infra/`, `observability/`, `monitoring/` | Deploy, DR, SLOs, runbooks |

---

## 2025 — MVP + Seed (All Products)

### Q1 2025 — Foundation

| Sprint | Focus | Products | Deliverables |
|--------|--------|----------|--------------|
| **S1** | Gateway + Auth | Gateway, Landing, Auth | Gateway build fixed; signup/auth; API keys in D1; CTAs → `/signup` |
| **S2** | Proxy + PII | Proxy Worker, DLP | OpenAI passthrough; 3 PII types (SSN, email, card); deploy Workers |
| **S3** | Dashboard + Health | Admin UI, Dashboard, Observability | Usage stats, audit log (last 100), `/api/health`, error tracking |
| **S4** | Alpha onboarding | Landing, Docs | Waitlist, docs site, 10 alpha users using product |

### Q2 2025 — Core SDLP

| Sprint | Focus | Products | Deliverables |
|--------|--------|----------|--------------|
| **S5** | RAG + Embedding | RAG, Embedding, Vector-core | Chunking, embeddings, hybrid retrieval; DLP in pipeline |
| **S6** | LLM Gateway | LLM Gateway | Provider abstraction, token budgets, prompt firewall (stub) |
| **S7** | OPA + Policies | OPA, packages/policies | Policy eval in Gateway; basic policy CRUD in Admin UI |
| **S8** | SDKs + Docs | sdk-go, sdk-ts, sdk-py | Quick start, API reference; SDKs call Gateway/Proxy |

### Q3 2025 — Learning & Trust

| Sprint | Focus | Products | Deliverables |
|--------|--------|----------|--------------|
| **S9** | LAM Core | LAM (core, knowledge base, feedback) | Compliance knowledge RAG; feedback loop; 1 agent (Policy Learner) |
| **S10** | LAM Agents | LAM agents (Risk Assessor, Provider Router) | Real-time risk; provider routing; dashboard metrics |
| **S11** | Compliance + Security | DLP, Gateway, Proxy | Audit trail (hash, immutable log); encryption at rest; rate limits |
| **S12** | Billing + Trust | Dashboard, Landing | Stripe; Free/Startup/Enterprise; About, Security page, 5 testimonials |

### Q4 2025 — Production Readiness

| Sprint | Focus | Products | Deliverables |
|--------|--------|----------|--------------|
| **S13** | SOC2 prep | All services, Infra | Controls, policies, multi-region, backups, DR runbook |
| **S14** | Enterprise features | Gateway, Admin UI, SSO package | SAML 2.0, SCIM, RBAC, team management |
| **S15** | Public beta | Landing, Dashboard, Docs | Open signup, “Beta” badge, 200 users, 20 paying |
| **S16** | Certifications | All | SOC 2 Type I in progress; HIPAA BAA; GDPR DPA template |

---

## 2026 — Enterprise Readiness

| Quarter | Themes | Products | Key Outcomes |
|---------|--------|----------|--------------|
| **Q1** | Multi-tenant, DR | Gateway, RAG, LLM, Deployments | Tenant isolation; DR tested; first enterprise pilots |
| **Q2** | SOC2/ISO | All | SOC 2 Type II; ISO 27001 roadmap; Fintech/Healthtech pilots |
| **Q3** | Scale & SLA | Observability, Monitoring, Runbooks | 99.9% uptime; SLO dashboards; on-call playbooks |
| **Q4** | Marketplace prep | SDKs, Admin UI, Docs | Certified connectors; partner onboarding docs |

---

## 2027 — Autonomy v1

| Quarter | Themes | Products | Key Outcomes |
|---------|--------|----------|--------------|
| **Q1–Q2** | Self-learning policies | LAM, OPA, Gateway | Policy Learner in production; DLP trainers |
| **Q3** | Learning Engine | LAM feedback, RAG, LLM | Cost/latency/accuracy optimization agents |
| **Q4** | Autonomy dashboards | Admin UI, Observability | Policy and learning effectiveness metrics |

---

## 2028 — SDLP Cloud & Marketplace

| Quarter | Themes | Products | Key Outcomes |
|---------|--------|----------|--------------|
| **Q1–Q2** | SaaS platform | All services, Infra | Multi-tenant SaaS; region-based; pay-per-query |
| **Q3** | Certified connectors | Gateway, RAG, SDKs | AWS, GCP, Oracle, Snowflake connectors |
| **Q4** | Marketplace | Admin UI, Docs | SDLC Hub; partner listings; Compliance-as-a-Service |

---

## 2029–2030 — Global Standardization

| Theme | Products | Key Outcomes |
|--------|----------|--------------|
| Secure AI protocol | Gateway, RAG, LLM | Open framework for secure AI–data exchange |
| Federated RAG | RAG, Vector-core, Learning Engine | Cross-org retrieval with privacy |
| Post-quantum | DLP, Gateway, Infra | Crypto roadmap and pilot |

---

## Cross-Cutting per Sprint

- **Quality:** Unit + integration tests; coverage gates per product.
- **Security:** SAST, dependency scan, secrets scan; no Critical/High in main.
- **Design:** Apple HIG alignment for all user-facing UI (Landing, Dashboard, Admin UI).
- **Code:** Max 200 lines per file; refactor when exceeded.
- **Docs:** Changelog and runbook updates for deploy and incident response.

---

## Success Metrics (All Products)

| Metric | Target |
|--------|--------|
| Gateway p95 latency | &lt;100 ms |
| RAG retrieval latency | &lt;200 ms p95 |
| Test coverage (critical paths) | 100% |
| Test coverage (overall) | ≥90% |
| Security scan | 0 Critical/High |
| Uptime | 99.9% (2026+) |
| File size | ≤200 lines |

---

*Last updated: February 2026. Align with [VISION.md](./VISION.md) and [archive/LAUNCH_ROADMAP.md](./archive/LAUNCH_ROADMAP.md) for week-level tasks.*
