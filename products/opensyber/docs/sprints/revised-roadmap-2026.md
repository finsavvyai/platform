# OpenSyber — Revised Roadmap 2026
## "AI Agent Runtime Security" Pivot

**Last updated:** 2026-03-01
**Supersedes:** `cnsp-roadmap.md` (Sprints 11–22) — original remains as reference
**Reason for revision:** Market structural changes (Wiz→Google $32B, Palo Alto→Protect AI $500M,
CyberArk Secure AI Agents GA Dec 2025, Chrome DBSC Origin Trial) force immediate reprioritization.

---

## The Strategic Pivot

### What changed

| Signal | Implication |
| --- | --- |
| Wiz acquired by Google ($32B, closed Feb 2026) | CSPM is now a Google Cloud feature — commoditized |
| Top 5 CSPM vendors hold 71.8% market share | No room for a pure-play CSPM entrant in 2026 |
| Palo Alto acquired Protect AI ($500M, July 2025) | ML model security is covered — different angle than ours |
| CyberArk launched Secure AI Agents (Dec 2025) | Identity/credentials for AI agents — covered |
| Chrome DBSC in Origin Trial (Oct 2025) | Native device-bound sessions — TokenForge's core value prop |
| AI agent security: only 13 funded startups, $414M total | Real gap: **runtime behavior monitoring** — nobody owns it |
| VCs expecting high-profile AI agent incident in 2026 | Category-defining incident = our launch event |

### The gap nobody is filling

```
CyberArk    →  agent IDENTITY (what credentials does the agent have?)
Protect AI  →  ML MODEL safety (adversarial inputs, data poisoning)
Lakera      →  LLM GUARDRAILS (prompt injection detection)

OpenSyber   →  agent RUNTIME BEHAVIOR (what is it doing right now?)
                File reads, bash commands, network calls, secret access
                Cursor / Cline / Claude Code / Devin / Copilot
```

This is the uncontested position in March 2026.

### Revised north star

> **"OpenSyber is the runtime security monitor for AI coding agents.
> We show you exactly what your agent did while you weren't watching."**

The original vision — "AI agent hosting + CSPM + SSPM + compliance unified" — is still the
long-term destination. But the entry wedge has changed. We enter through the **AI agent
monitoring** door, not the CSPM door.

---

## Revised Timeline

### Phase 1 — Establish the Category (March–June 2026, ~90 days)

**Goal:** Be the first product in market for AI coding agent runtime monitoring.
Get viral distribution. Convert to 10 enterprise customers before CyberArk pivots from
identity-focus to runtime-focus.

---

#### Sprint 23: OpenAgent Launch — Multi-Platform PLG (Now — April 2026)

**Already designed.** See `sprint-23-openagent-plg.md` for full spec.

MVP (10 days):

- VSCode extension: file-interceptor, terminal-interceptor, agent-detector, local SQLite log
- Risk classification: critical/high/medium/low for file paths + bash commands
- Upgrade notification on CRITICAL events
- npm CLI: `npx opensyber-scan`, `npx tokenforge-check`, `npx agent-scan`
- Cloud sync API: `POST /api/v1/agent-monitor/sync` (opt-in)
- Dashboard: "Agent Activity" page (Pro/Enterprise)

Full (20 days, parallel with MVP): Chrome extension, JetBrains plugin, LinkedIn share button,
WhatsApp alerts, Claude Code skills repo, Slack App, OpenAI GPT Store.

**Success gates:**

- [ ] Extension published to VS Marketplace
- [ ] 1,000 installs in first 2 weeks
- [ ] 1 enterprise customer signs up from extension data
- [ ] HN / LinkedIn post goes viral (100+ comments or 500+ reactions)

---

#### Sprint 24: Agent Security Platform — Enterprise Tier (April–May 2026)

**Purpose:** Convert free extension users to paying enterprise customers.
Add thin CSPM as a *supporting feature* inside the agent security story — not the headline.

**Thin CSPM (supporting feature, not headline):**

The framing is: "OpenAgent shows you what your AI agent accessed on disk.
Cloud CSPM shows you what it could access in the cloud."
They are the same story at different layers.

Tasks:

- [ ] Cloud account connect: AWS IAM role assumption, GCP service account, Azure SP
- [ ] Run Prowler subset (top 20 checks only — public S3, open security groups, root key active)
- [ ] Show findings inside Agent Activity page ("Your agent has write access to this S3 bucket which is publicly readable")
- [ ] Risk score: combine agent behavior risk + cloud misconfiguration risk into one score
- [ ] Store findings in `cspm_findings` table (Sprint 11 schema — already designed)

**Enterprise agent dashboard (main feature):**

- [ ] Team view: all agents across all developers in the org
- [ ] Per-agent profile: activity timeline, risk trend, secrets detected count
- [ ] Policy engine: "Alert if any agent reads a .pem file outside /certs/"
- [ ] Org-level risk score: aggregate across all agents + cloud
- [ ] Export: PDF report for CISO ("AI Agent Security Report — Acme Corp — March 2026")

**Pricing enforcement:**

```
Free    →  1 agent, 7-day history, local only
Pro     →  5 agents, 30-day history, cloud sync, email alerts
Team    →  unlimited agents, 90-day history, team dashboard, Slack/PagerDuty
Enterprise → unlimited, 1yr history, policy engine, PDF reports, SSO, custom SLAs
```

**Success gates:**

- [ ] 3 enterprise trials started (from extension → upgrade flow)
- [ ] First paid enterprise contract signed
- [ ] CISO can generate a PDF report for their board in < 5 minutes

---

#### Sprint 25: Agent Attack Paths (May–June 2026)

**Purpose:** The attack graph — but scoped to AI agents, not generic cloud.

The generic cloud attack graph (original Sprint 14) is too broad and too hard to
differentiate from Wiz's Security Graph (which is now Google's). But an
**AI-agent-specific attack path** is a new story nobody is telling:

> "Show me every secret this Cursor agent could reach from the current repo,
> given the cloud permissions it inherited from the developer's AWS credentials."

This reframes Sprint 14's graph engine (BFS/DFS on nodes/edges) into a product
with a clear, scary demo: plug in your agent session → see the blast radius.

Tasks:

- [ ] `assets` table: files, env vars, cloud resources, SaaS apps
- [ ] `asset_relations` table: edges — read_access, write_access, network_access, secret_access
- [ ] BFS traversal from agent session → reachable secrets
- [ ] Attack path visualization (D3.js or graphology — already in tech stack)
- [ ] "Crown jewel" flagging: mark which assets are most sensitive
- [ ] Blast radius: "if this agent is compromised, attacker reaches N secrets, M cloud resources"

**The demo:**

```
Agent: Cursor (developer: john@acme.com)
Inherited credentials: AWS dev role (john's local ~/.aws/credentials)

Reachable from this agent session:
  → 14 S3 buckets (3 contain customer PII)
  → 2 RDS databases (prod read replica)
  → 1 Secrets Manager secret (database master password)

Attack path (4 hops):
  Cursor process → ~/.aws/credentials → AWS role → RDS → customer_data table
```

That demo sells enterprise contracts. No competitor can show this.

**Success gates:**

- [ ] Demo works end-to-end on a test AWS account
- [ ] Attack path visualization renders in < 2s for 1,000 assets
- [ ] 5 prospects see the demo; 3 convert to trial

---

### Phase 2 — Enterprise Hardening (July–August 2026, ~60 days)

**Goal:** Reach enterprise-grade reliability, get SOC2 controls in place,
raise seed/Series A on the "AI agent security category leader" story.

---

#### Sprint 26: AI Agent Compliance (July 2026)

**Purpose:** The compliance angle on AI agent security — unique and timely.

Enterprises need to answer: "Do our AI agents comply with our security policies?"
No framework has AI-agent-specific controls yet. OpenSyber can define them.

> "We are the first platform that generates a compliance report for AI coding agent governance."

Framework: **OpenSyber AI Agent Security Framework (OASF)** — 15 controls.

Sample controls:

```
OASF-01: All AI agent sessions are monitored and logged
OASF-02: Agents cannot access production secrets without step-up approval
OASF-03: Agent activity is reviewed by a human within 24 hours
OASF-04: Secret detection is active on all agent file operations
OASF-05: Agent sessions are isolated from production environments
```

These map to SOC2 CC6.x, ISO 27001 A.12, NIST CSF PR.AC-4.
CISOs can use this report in their SOC2 audit as evidence of "AI governance program."

Tasks:

- [ ] Define OASF 1.0 (15 controls) — publish as open standard
- [ ] Evidence collection: auto-map agent activity logs → OASF controls
- [ ] Compliance score per org: % of OASF controls passing
- [ ] PDF evidence report: "Your AI Agent Compliance Report — March 2026"
- [ ] SOC2 mapping table (OASF → SOC2 CC6.x controls)
- [ ] `compliance_controls` table + `evidence_items` table (Sprint 20 schema — reuse)

**Success gates:**

- [ ] OASF 1.0 published publicly (blog post + PDF)
- [ ] 1 enterprise customer uses OASF report in their SOC2 audit
- [ ] Compliance score widget live on enterprise dashboard

---

#### Sprint 27: Marketplace + Ecosystem (July–August 2026)

**Purpose:** Let others build on top of OpenSyber's agent monitoring runtime.

The skill-first architecture (from the original CNSP roadmap) becomes the foundation
for an ecosystem of AI agent monitoring plugins.

Priority skills to enable:

- `cursor-monitor` — Cursor-specific telemetry (file edits, AI completions, context windows used)
- `cline-monitor` — Cline-specific telemetry
- `devin-monitor` — Devin sandbox activity logging
- `github-copilot-monitor` — Copilot suggestion + acceptance logging
- `secret-vault-bridge` — connect agent activity to HashiCorp Vault / AWS Secrets Manager
- `siem-forwarder` — stream agent events to Splunk, Datadog, Elastic

Marketplace tasks:

- [ ] Skill SDK: `SkillProfile`, `SkillContext`, `SkillEmitter` types (Sprint 11b — already designed)
- [ ] Skill packaging: `.opensyber-skill` format + validation pipeline
- [ ] Marketplace listing page (Sprint 19 — reuse schema)
- [ ] Revenue share: 70/30 (developer gets 70%) — already in PRD
- [ ] First 3 first-party skills published (cursor-monitor, secret-vault-bridge, siem-forwarder)

**Success gates:**

- [ ] Marketplace live with 3 skills
- [ ] 1 external developer publishes a skill
- [ ] 1 enterprise customer requests a custom skill via marketplace

---

#### Sprint 28: Enterprise Exit Prep (August 2026)

**Purpose:** Series A readiness. SOC2 Type 1 controls in place.
OpenAPI spec published. Multi-region groundwork.

Tasks:

- [ ] OpenAPI 3.0 spec auto-generation (all `/api/v1/` routes)
- [ ] SOC2 Type 1 controls for AI agent governance (OASF → SOC2 mapping as evidence)
- [ ] SCIM provisioning (enterprise user sync)
- [ ] Multi-region: Cloudflare deployment to EU-West, US-East regions
- [ ] SLA monitoring: Cloudflare Analytics + Sentry uptime dashboard
- [ ] Dependency scanning enforced in CI (Sprint 10 — already in place, verify)
- [ ] Series A data room: MRR chart, customer list, NRR, CAC/LTV

**Success gates:**

- [ ] OpenAPI spec published at `api.opensyber.cloud/openapi.json`
- [ ] SOC2 Type 1 audit started (auditor engaged)
- [ ] 10 paying enterprise customers
- [ ] $50K+ MRR

---

### Phase 3 — Platform Expansion (September 2026+)

**Goal:** Now that the AI agent security category is established and we have
revenue + customers, expand into the adjacent layers originally planned in the CNSP roadmap.
The positioning flips: "OpenSyber monitors your AI agents AND your cloud AND your SaaS —
one platform."

---

#### Sprint 29: Full CSPM (September 2026)

Original Sprint 11 scope, now as a platform expansion — not the lead product.

- Full Prowler integration (all checks — not just the top 20 subset from Sprint 24)
- Continuous re-scan (cron + event-driven drift detection)
- Risk score per resource / account / organization
- `cloud_accounts`, `cspm_findings` tables (already designed in Sprint 11 spec)

---

#### Sprint 30: SaaS Posture + AI Agent SaaS Access (September–October 2026)

Original Sprint 15 scope. Now with an AI-agent angle:

> "What SaaS apps can your AI agent access via OAuth tokens in the developer's browser?"

- M365 / Google Workspace / GitHub / Slack posture
- OAuth app risk scoring
- Detect if AI agents have been granted OAuth tokens to SaaS apps
- `saas_accounts`, `saas_findings`, `saas_oauth_apps` tables (Sprint 15 schema)

---

#### Sprint 31: Credential Lifecycle + Agent Secret Access (October 2026)

Original Sprint 12 scope, reframed:

> "These are the secrets your AI agents touched in the last 30 days. Here's which ones should be rotated."

- HashiCorp Vault + AWS Secrets Manager + Azure Key Vault integration
- Secret age tracking + rotation policy enforcement
- JIT access: grant agent temporary secret access, auto-expire
- `vault_rotation_policies`, `jit_access_requests` tables (Sprint 12 schema)

---

#### Sprint 32: AI Intelligence Layer (October–November 2026)

Original Sprint 16 scope — Claude claude-sonnet-4-6 powered.

- Natural language query: "Show me all agents that accessed .env files last week"
- LLM-based threat explanation: "This agent behavior is consistent with..."
- Auto-triage: real risk vs. normal dev activity
- Compliance narrative generation for OASF reports
- `ai_insights`, `ai_recommendations` tables (Sprint 16 schema)

---

#### Sprint 33: Remediation Engine (November 2026)

Original Sprint 17 scope.

- DAG-based playbook execution (Cloudflare Workflows)
- One-click agent suspension (for compromised agents)
- Policy auto-enforcement: revoke agent session on policy violation
- `remediation_playbooks`, `remediation_runs` tables (Sprint 17 schema)

---

#### Sprint 34: Series A Exit Milestone (December 2026)

- Full SOC2 Type 2 audit complete
- OpenSyber AI Agent Security Framework (OASF) recognized externally
- Multi-cloud: AWS, GCP, Azure, K8s full coverage
- Strategic acquisition positioning: Palo Alto / CrowdStrike / Cisco / ServiceNow as targets

---

### TokenForge — Parallel Track

**Assessment:** Chrome DBSC (Device Bound Session Credentials) is in Origin Trial
(Chrome 135, Oct 2025). Expected GA: 2026. This is a browser-native implementation of
exactly what TokenForge provides.

**Recommended approach:**

```
Phase A (Now → Q2 2026):  Ship TokenForge Pro. Monetize the gap before DBSC GA.
Phase B (Q3 2026):         Position as "TokenForge works across all browsers + backends —
                            DBSC is Chrome-only, Windows-only, no server SDK."
Phase C (2027+):           Pivot TokenForge to DBSC migration tool / hybrid layer.
                            Help companies transition from custom session security to DBSC.
```

TokenForge is a self-contained product. It gets one sprint to launch properly (TokenForge
Launch Sprint — parallel to Sprint 24), then maintenance-only until the DBSC landscape is clear.

Do not schedule more than 1 additional sprint for TokenForge feature development.
Watch the DBSC Origin Trial status — if it reaches GA before Q4 2026, accelerate Phase C.

---

## Revised Sprint Summary

| Sprint | Focus | When | Gate |
| --- | --- | --- | --- |
| **23** | OpenAgent: VSCode + CLI + multi-platform PLG | March 2026 | 1,000 installs, first enterprise trial |
| **24** | Agent Security Platform + thin CSPM | April–May 2026 | First paid enterprise contract |
| **25** | Agent Attack Paths (blast radius visualization) | May–June 2026 | Demo converts 3 prospects |
| **26** | AI Agent Compliance (OASF 1.0) | July 2026 | Used in 1 SOC2 audit |
| **27** | Marketplace + Skill Ecosystem | July–August 2026 | 3 skills live, 1 external publisher |
| **28** | Enterprise Exit Prep (Series A) | August 2026 | 10 customers, $50K+ MRR |
| **TF** | TokenForge Launch (parallel track) | April 2026 | First paid TokenForge customer |
| **29** | Full CSPM | September 2026 | — |
| **30** | SaaS Posture + Agent SaaS Access | September–October 2026 | — |
| **31** | Credential Lifecycle + Agent Secret Access | October 2026 | — |
| **32** | AI Intelligence Layer | October–November 2026 | — |
| **33** | Remediation Engine | November 2026 | — |
| **34** | Series A Exit Milestone | December 2026 | SOC2 Type 2, Series A close |

---

## What We Are NOT Building (2026)

These items from the original CNSP roadmap are **explicitly deferred** until Phase 3
or until we have enterprise customer demand that justifies them:

| Deferred | Reason |
| --- | --- |
| Full CSPM as lead product (Sprints 11-13 original) | Google owns CSPM via Wiz acquisition |
| SSPM as standalone module (Sprint 15 original) | No PLG wedge; build after agent security is established |
| Full credential rotation (Sprint 12 original) | HashiCorp Vault already solves this for enterprises |
| Generic attack graph (Sprint 14 original) | Reframed as agent-specific attack paths in Sprint 25 |
| GraphQL API (Sprint 22 original) | REST OpenAPI 3.0 first; GraphQL if enterprise demand |
| Full SOC2 Type 2 (Sprint 20 original) | Sprint 26 does OASF + SOC2 mapping; Type 2 audit in Sprint 34 |

---

## Success Metrics (Revised)

| Metric | Target | When |
| --- | --- | --- |
| VSCode extension installs | 10,000 | End of Sprint 23 |
| Enterprise trials started | 10 | End of Sprint 24 |
| First paid enterprise contract | $2,000+/mo | Sprint 24 |
| MRR | $50,000 | Sprint 28 (August 2026) |
| Enterprise customers | 25 | Sprint 28 |
| ARR run-rate at Series A | $600K | December 2026 |
| NPS | > 60 | Sprint 28 |
| OASF 1.0 recognized externally | Blog posts / analyst mentions | Sprint 26 |

---

## The Competitive Clock

The window on AI agent runtime monitoring is **12–18 months**:

```
Now (March 2026)      CyberArk covers identity. Palo Alto covers ML models.
                      Runtime behavior monitoring: nobody.

Q3 2026               CyberArk likely pivots to runtime after first public incident.
                      Window: 6 months to establish category leadership.

Q4 2026               Enterprise customers will want "the standard" platform.
                      If we have 25 customers + OASF framework, we ARE the standard.

2027                  Acquisition interest from Palo Alto / CrowdStrike / ServiceNow.
                      They need the runtime layer to complete their AI security story.
```

**This is the race. Sprint 23 starts it. Ship fast.**

---

*This document supersedes `cnsp-roadmap.md` as the active execution plan.
The original CNSP roadmap remains valid as the Phase 3 expansion blueprint.*
