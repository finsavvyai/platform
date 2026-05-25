# AMLIQ Brain — Vertical RAG for Compliance Teams

**Product brief — May 2026**

*Companion to `finsavvyai_full_extended_consolidation_plan.md` and `finsavvyai_consolidation_plan_addendum.md`.*

---

## 1. One-line position

**The organizational brain for compliance teams in regulated financial services** — unified AI search + agent workflows across regulatory filings, internal policies, sanctions data, transaction context, and case history, with audit-grade traceability that horizontal enterprise-AI products (Doti, Glean, Microsoft Copilot) cannot match for this buyer.

## 2. Naming

Recommendation: launch as **AMLIQ Brain** rather than a new brand. Reasons:

- AMLIQ already has a positioning thesis ("AI-native AML investigations") and a planned product surface — Brain extends that surface from "investigator tool" to "team/org platform"
- Single-brand focus is critical at this stage; another brand dilutes the 8-product narrative further
- The Doti acquisition was for a *focused, well-defined* product. AMLIQ Brain = AMLIQ evolving from analyst tool to compliance ops platform = same focus discipline

Alternative if Brain feels too narrow: **AMLIQ** is the umbrella, with two SKUs — `AMLIQ Investigate` (the current AML analyst tool) and `AMLIQ Brain` (the org-level platform).

## 3. The thesis

Three forces in May 2026 create the opening:

**Buyer pain.** SAR filing is the most-penalized BSA violation. Tier-2 banks deploying behavioral monitoring see 40–60% alert reduction. Fintechs in Series B+ have a Compliance Officer but a 2-5 person team drowning in alerts, regulatory updates, and case backlogs. They cannot afford LSEG World-Check (six figures/year) and they cannot use Glean (horizontal — doesn't know AML).

**Doti-shaped exit window.** Salesforce just bought Doti for ~$100M after 1 year for $7M raised. The horizontal-RAG category is consolidating into platform giants. The next acquisition wave will hit **vertical RAG** as those same giants look for industry-specific story to plug into their compliance/financial-services suites. LSEG, Moody's, NICE Actimize, ComplyAdvantage, FIS all need a defensive AI-native acquisition in the next 18 months.

**Horizontals can't follow.** Glean has SOC 2 + ISO 27001 + HIPAA + GDPR. They *technically* can serve regulated FSI. But their economics demand horizontal scale — they won't build AML-specific agents, sanctions data integrations, SAR draft templates, or banking-core connectors (Mambu, Temenos, Finastra). The vertical depth is the moat.

## 4. ICP (initial customer profile)

**Primary v1 buyer:** Head of Compliance / MLRO at a Series B–D fintech or tier-2 regional bank.

- **Team size:** 2–15 compliance professionals
- **Pain:** Drowning in regulatory updates, alert backlog, SAR queue. Currently uses spreadsheets + Slack + a basic transaction monitoring tool. Cannot justify World-Check ($150-500K/yr) but their auditor will flag the gap within 12 months.
- **Budget:** $20K-$80K/yr (vs World-Check's $150K+ and Glean's $50K+ horizontal that doesn't solve their problem)
- **Decision cycle:** 60-90 days; champion is the MLRO, blocker is procurement/security review
- **Trigger:** Failed audit finding, regulator visit, new product launch (esp. crypto, lending, payments), Series-B+ funding round

**Adjacent buyers (v2-v3):**
- Crypto exchanges (huge compliance burden, no established vendor)
- Insurance carriers (Solvency II reporting + audit trails)
- Money services businesses (state-by-state licensing complexity)
- Healthcare GRC teams (HIPAA + state regs + payor compliance) — natural expansion off AML

## 5. Product surface

### Search (table stakes)
Unified RAG across:
- Regulatory filings (FinCEN, FFIEC, BSA, AML5, EU AI Act, MiCA, FATF guidance, state regs)
- Internal policies (AML program, KYC procedures, sanctions screening rules)
- Sanctions/PEP data (OFAC SDN, EU consolidated list, UN, optional Dow Jones Risk feed)
- Transaction context (from connected core banking systems)
- Case history (every SAR, every investigation outcome, every dispositioned alert)
- Adverse media (optional Refinitiv/ComplyAdvantage feed)

Citations on every answer. Audit log of every retrieval (regulator-grade).

### Agents (the wedge)

Start with three high-value agents that compress hours into minutes:

1. **SAR Draft Agent** — given a flagged transaction + customer history, drafts the SAR narrative pulling from transaction context, prior cases, and regulatory templates. Analyst reviews and approves; never autonomous filing.
2. **Regulatory Change Agent** — subscribes to FinCEN/FFIEC/EBA/MAS update feeds; when a rule changes, drafts the policy delta + impact analysis + suggested team actions, opens a Jira ticket.
3. **Alert Triage Agent** — for each alert from the bank's TM system, retrieves context (customer KYC, prior behavior, similar dispositioned alerts) and pre-classifies as likely-false-positive / needs-investigation / escalate-to-SAR with reasoning chain.

Each agent: action log, source citations, reversibility (every action has a "rejected/edited" path), 1:1 attribution to a human analyst at approval time.

### Connectors (table stakes for enterprise)

Phase 1 (must-have): Slack, Confluence, Jira, Microsoft Teams, Google Drive, SharePoint
Phase 2 (high-value): Mambu, Temenos, Finastra (core banking), Actimize, SAS, Nice (legacy TM systems)
Phase 3 (premium): Dow Jones Risk feed, Refinitiv adverse media, ComplyAdvantage screening API

MCP-native — all connectors are MCP servers, both consumed internally and exposable to customer's own agents (Claude, Cursor, custom).

### Audit-grade infrastructure

Non-negotiable. The product is unsellable to a regulated buyer without:
- Tamper-evident log of every agent action (hash chain or KMS-signed)
- Every retrieved chunk has a citation back to source-of-truth doc with version + timestamp
- Per-user, per-action permission model (mirror organizational hierarchy)
- Data residency: EU customer = EU vector DB, US customer = US vector DB
- SAML/SCIM for identity (table stakes for regulated)
- Customer-managed encryption keys (CMK) at higher tiers
- SOC 2 Type 1 at GA, Type 2 within 12 months, ISO 27001 within 18

## 6. Differentiation matrix

| Capability | AMLIQ Brain | Glean | Doti (now Salesforce) | Hummingbird | Unit21 | Sardine |
|---|---|---|---|---|---|---|
| Horizontal org search | ✅ vertical-scoped | ✅✅ best-in-class | ✅ Salesforce-integrated | ❌ | ❌ | ❌ |
| AML-specific agents | ✅ core | ❌ | ❌ | ✅ | ✅ | ✅ |
| Banking core integrations | ✅ phase 2 | ❌ | ❌ | ✅ | ✅ | ✅ |
| Sanctions/PEP feeds | ✅ phase 1 | ❌ | ❌ | ✅ | ✅ | ⚠️ partial |
| Audit-grade traceability | ✅ core | ✅ Protect tier | ⚠️ inherited | ✅ | ✅ | ✅ |
| Regulatory change monitoring | ✅ core | ⚠️ generic | ❌ | ❌ | ❌ | ❌ |
| MCP-native (BYO-agent) | ✅ core | ⚠️ early | ✅ | ❌ | ❌ | ❌ |
| Price point (mid-market) | ✅ $20-80K | ❌ $50K+ | n/a | ❌ $80K+ | ❌ $100K+ | ❌ $80K+ |
| Open-source primitives | ✅ via mcp-tooling, a2a-framework | ❌ | ❌ | ❌ | ❌ | ❌ |

**The winning lane:** Hummingbird/Unit21/Sardine are AML *case management* — they own the alert-to-SAR workflow. They don't own the broader knowledge layer (policies, regulatory feeds, ad-hoc research). AMLIQ Brain owns the knowledge layer + adds case-management-adjacent agents. Position as complementary at first (works alongside existing TM/case tools), competitive at scale.

## 7. Technical architecture

What you already have:

| Component | Source path | Role in AMLIQ Brain |
|---|---|---|
| RAG primitives | `/Users/shaharsolomon/dev/projects/FinSavvyAI_Distributed_RAG/` | Vector index + retrieval; needs hardening for production scale |
| MCP connectors | `finsavvyai-platform/oss/mcp-tooling/` (810 files) | Slack, Jira, Confluence, Drive, eventually banking core |
| Agent-to-agent | `finsavvyai-platform/oss/a2a-framework/` (152 files) | Multi-agent workflows (e.g., alert triage → SAR draft → review) |
| Auth (SAML/SCIM/RBAC) | `finsavvyai-platform/packages/auth/` | Enterprise identity |
| Telemetry + audit logs | `finsavvyai-platform/packages/telemetry/` | Audit-grade event logging |
| AI gateway | `finsavvyai-platform/packages/ai-gateway/` (production base from fintech-suite api-gateway) | Provider routing, semantic cache, BYO-model |
| Billing | `finsavvyai-platform/packages/billing/` | Subscription tiers |
| Policy engine | `finsavvyai-platform/packages/policy-engine/` | PII redaction rules, data-residency policies |
| AMLIQ engines (Q3 fold) | `products/amliq/engines/quantumbeam/` + `engines/ml-fraud/` | Fraud scoring inside the case-context-pull |
| Distributed LLM | `02_AI_AGENTS/llm/` | Optional self-hosted inference for customers requiring on-prem |

What you build new:

1. **Compliance corpus ingest pipeline** — scheduled crawlers for FinCEN/FFIEC/EBA/MAS feeds, with diff detection to trigger Regulatory Change Agent
2. **SAR template library + draft renderer** — versioned templates per jurisdiction (FinCEN SAR, UK SAR, etc.)
3. **Sanctions/PEP normalizer** — ingest OFAC SDN + EU consolidated + UN into common entity model
4. **Per-customer vector DB provisioning** — multi-tenant pgvector or per-tenant Qdrant; data residency-aware
5. **Tamper-evident audit log** — hash-chained events; optional anchoring to public ledger for high-assurance customers
6. **Compliance certification track** — SOC 2 prep, security questionnaire automation, vendor due-diligence pack

What you don't build (deliberately):
- Transaction monitoring engine (use customer's existing — Actimize, SAS, in-house). Brain consumes alerts, doesn't generate them.
- Customer-facing KYC onboarding (Sardine/Persona/Alloy own this). Brain reads KYC results from connected systems.
- Sanctions screening API (Brain pulls customer's existing screening results; doesn't replace screening providers).

## 8. 6-month MVP plan

**Month 1: Foundations**
- Promote `FinSavvyAI_Distributed_RAG` to `products/amliq/brain/rag/` and harden (production-grade pgvector or Qdrant)
- Build compliance corpus ingest for FinCEN + FFIEC (start narrow)
- Wire `packages/auth` + `packages/telemetry` into Brain skeleton

**Month 2: First connectors + search**
- Slack + Confluence + Google Drive MCP integrations (reuse `oss/mcp-tooling/`)
- Search UI with citation rendering
- Tamper-evident audit log spike

**Month 3: First agent (SAR Draft)**
- Build SAR template library (US FinCEN first)
- SAR Draft Agent end-to-end: alert input → context retrieval → template fill → human review UI
- Multi-tenant data isolation

**Month 4: Design partner enablement**
- Onboard 2-3 design partners (target: 1 Series B+ fintech, 1 tier-2 bank, 1 crypto exchange)
- Add Jira + Microsoft Teams connectors
- Regulatory Change Agent v1

**Month 5: Hardening + compliance prep**
- Alert Triage Agent v1
- Security review + penetration test
- SOC 2 Type 1 audit kickoff
- Pricing + packaging finalized

**Month 6: GA launch**
- SOC 2 Type 1 complete
- Marketing site (atop existing `websites/finsavvyai.com/`)
- Series A pitch materials updated to feature Brain
- First 5 paying customers ($20-50K ACV each)

**Stretch (month 7-9):** Banking-core integrations (Mambu first), Dow Jones Risk feed, EU expansion (data residency).

## 9. How this changes the FinsavvyAI portfolio narrative

### Updated product table

| Product | Role | Status |
|---|---|---|
| PushCI | Trust AI-generated code | Tier 1 launch |
| PipeWarden OSS | OSS detection engine for AI PRs | Tier 1 launch |
| Qestro | Autonomous runtime QA | Tier 2 |
| LunaOS | Operate AI engineering workflows | Tier 2 (positioning fix needed) |
| OpenSyber | Secure AI runtime execution | Tier 2 (window closing) |
| SDLC.cc | Govern AI software delivery | Tier 2 |
| **AMLIQ Investigate** | AI-native AML investigation (current AMLIQ scope) | Tier 1 stretch |
| **AMLIQ Brain** (new) | **Vertical RAG + compliance ops platform for regulated FSI** | **Tier 1 — new wedge** |
| TenantIQ | M365 governance for MSPs | Tier 1 launch |
| QueryFlux (8th, if approved) | AI-native database workspace | Tier 1 |

### Updated investor narrative addition

After the existing "AMLIQ is the same operating principle (autonomous investigation) applied to a specific high-value vertical: AML at 1/10 the cost of World-Check" line, add:

> **AMLIQ Brain extends the same vertical wedge from the individual analyst to the entire compliance organization** — replacing fragmented spreadsheets, Slack threads, and ad-hoc searches with a single audit-grade AI layer that answers questions, drafts SARs, and tracks regulatory change. Horizontal enterprise-AI players (Glean, Salesforce/Doti) cannot serve this buyer because the vertical depth (sanctions data, banking integrations, regulator-specific templates, jurisdiction-aware audit trails) isn't justifiable in their economics. We can — because we're vertical-first.

### Updated GTM funnel

Two parallel motions:

**Developer funnel** (unchanged): Cursor → PushCI → Qestro → OpenSyber → SDLC.cc

**Compliance funnel** (new): MLRO → AMLIQ Brain (free corpus search tier) → AMLIQ Brain Pro (agents + SAR draft) → AMLIQ Investigate (deep case management) → multi-product enterprise contract including TenantIQ for M365 governance + SDLC.cc for board-level AI policy

## 10. Decisions needed from founder

Ten yes/no items to lock before kickoff:

1. **Naming** — "AMLIQ Brain" as sub-brand, or new brand entirely?
2. **Scope of v1** — Single jurisdiction (US/FinCEN) for first 6 months, or US + UK + EU?
3. **Self-hosted option** — Offer on-prem from day 1 (uses `02_AI_AGENTS/llm` distributed cluster), or cloud-only for first 12 months?
4. **Open-source primitives** — Release `FinSavvyAI_Distributed_RAG` upgrade as OSS (matches "sell the picks" strategy), or keep proprietary?
5. **Existing AMLIQ work** — Pause the current `products/amliq/` migration (aegis backend, ML fraud, QuantumBeam folding) to prioritize Brain, or run both in parallel with shared engineering?
6. **Design partner targets** — Which 3 to pursue first? (Recommend: one Israeli fintech in your network, one US tier-2 bank via warm intro, one crypto exchange that's already in pain)
7. **Pricing model** — Per-seat ($X/compliance user/month), per-tenant ($X/yr flat with usage caps), or hybrid?
8. **Build vs partner for sanctions/PEP feeds** — License Dow Jones Risk from day 1 ($$$$ but credible), use OFAC public data only for MVP, or partner with ComplyAdvantage for embedded screening?
9. **Brain as separate fundraise** — Roll Brain into the existing Series A pitch, or position as a separate seed under the FinsavvyAI brand (Doti-shaped)?
10. **Acquirer-target shortlist** — If the 18-month exit play is real, who are the 3 acquirers to build relationships with NOW? (Recommend: LSEG, Moody's, NICE Actimize)

---

## Sources

- [Salesforce acquires Doti AI for ~$100M — Ctech](https://www.calcalistech.com/ctechnews/article/bksy0dqewe)
- [Doti AI — TechCrunch (Jan 2025)](https://techcrunch.com/2025/01/22/doti-gives-enterprises-a-flexible-ai-powered-search-experience-to-unlock-their-data-silos/)
- [Top 7 industries with stringent AI compliance needs in 2026 — Glean](https://www.glean.com/perspectives/top-7-industries-with-stringent-ai-compliance-needs-in-2026)
- [Using AI for effective regulatory change monitoring — Glean](https://www.glean.com/perspectives/using-ai-for-effective-regulatory-change-monitoring)
- [The Complete Guide to AML Compliance for Fintechs in 2026 — FluxForce](https://www.fluxforce.ai/blog/guide-to-aml-compliance-for-fintechs)
- [BSA/AML in 2025–2026 — Wolters Kluwer](https://www.wolterskluwer.com/en/expert-insights/bsa-aml-in-2025-2026)
- [AML Compliance Software for Banks Buyer's Guide 2026 — Youverify](https://youverify.co/blog/aml-compliance-software-banks-complete-buyers-guide)
- [Unit21 Agentic AI AML Platform](https://www.unit21.ai/products/aml-transaction-monitoring)
- [Sardine Agentic Financial Crime Platform](https://www.sardine.ai/)
