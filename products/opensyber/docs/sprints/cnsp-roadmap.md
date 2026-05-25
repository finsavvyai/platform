# OpenSyber — Cloud-Native Security Platform (CNSP) Roadmap
## Sprints 11–20 | Phases 2–4

**Last updated:** 2026-03-01
**Status:** Planning

---

## North Star Vision

OpenSyber is the **only platform that secures both your AI agents and your cloud
infrastructure from a single pane of glass.** This dual identity is the moat
none of CyberArk, Wiz, or Suridata can easily replicate.

```
                   OpenSyber Unique Position
                   ┌─────────────────────────────┐
                   │  AI Agent Hosting (Origin)  │
                   │  + Cloud Security (CNSP)    │
                   │  + Device Sessions (TF)     │
                   │  + Skill-First Architecture │  ← New
                   └─────────────────────────────┘
                     ↑              ↑           ↑
           No competitor    No competitor    Security as
           has AI agent      has TokenForge  composable skills
           hosting           session binding (marketplace moat)
```

---

## Skill-First Architecture

**Every CNSP capability is an installable skill.** This is the architectural
shift from Sprints 11–20: instead of hardcoding security features into the
platform core, each capability ships as a versioned, audited skill that runs
inside an agent container.

```
Platform Core (always on)
├── Agent container runtime (Hetzner VMs)
├── Vault + RBAC + SSO + Audit
├── Skill installer + marketplace
└── Results aggregator (unified security dashboard)

Security Skills (installable)
├── prowler-aws-cspm          → runs Prowler AWS checks
├── prowler-gcp-cspm          → runs Prowler GCP checks
├── prowler-azure-cspm        → runs Prowler Azure checks
├── prowler-k8s-cspm          → runs Prowler Kubernetes checks
├── vault-rotation-agent      → monitors + rotates credentials
├── attack-path-analyzer      → builds asset graph + BFS paths
├── github-posture            → scans GitHub org security
├── slack-posture             → scans Slack workspace security
├── google-workspace-posture  → scans Google Workspace
├── tenantiq-m365-security    → full M365 security (TenantIQ)  ← PREMIUM
├── ai-compliance-assistant   → LLM compliance chat
├── remediation-engine        → executes fix playbooks
└── soc2-evidence-collector   → gathers SOC2 audit evidence
```

### Skill Profile Schema

Each skill has a **profile** — a typed manifest declaring its capabilities,
required permissions, output schema, and dashboard widgets it contributes:

```typescript
interface SkillProfile {
  id: string                     // 'prowler-aws-cspm'
  version: string                // '1.4.2'
  category: SkillCategory        // 'cspm' | 'saas' | 'identity' | 'ai' | 'compliance'
  provider: string               // 'opensyber' | 'community' | 'partner'
  tier: PlanTier                 // 'free' | 'pro' | 'team' | 'enterprise'

  // What cloud accounts / SaaS apps this skill operates on
  targets: SkillTarget[]         // [{ type: 'aws_account', required: true }]

  // Permissions the skill needs to run (checked against org RBAC)
  requiredPermissions: string[]  // ['cloud.write', 'vault.read']

  // What this skill emits into the platform
  outputs: SkillOutput[]
  // e.g. cspm_findings → populates cspm_findings table
  //      risk_score_delta → feeds risk scoring engine
  //      attack_path_edges → contributes to asset graph
  //      compliance_evidence → feeds SOC2 collector

  // Dashboard widgets this skill registers
  widgets: DashboardWidget[]
  // e.g. "CSPM Findings by Severity" bar chart
  //      "Critical Findings" count card

  // Schedule: how often this skill runs
  schedule: SkillSchedule        // { cron: '0 * * * *' } or event-driven

  // Skill's own config schema (validated with Zod on install)
  configSchema: ZodSchema
}
```

### Why Skill-First Wins

| Approach | Platform Core | Skill-First |
|---|---|---|
| Adding a new SaaS connector | Redeploy API | Publish skill to marketplace |
| Community contribution | PR to monorepo | Publish skill, no access needed |
| TenantIQ M365 integration | Fork + rewrite | Package as skill, install |
| Enterprise custom check | Support ticket | Build + self-publish skill |
| Plan enforcement | Per-feature flags | Per-skill tier gating |
| Versioning | Full deploy | Skill version bump |

---

## TenantIQ Integration (First-Party Premium Skill)

TenantIQ (`~/dev/projects/tenantiq`) is an AI-powered Microsoft 365 security
platform built in parallel. It has **14 detection rules, 9 remediation actions,
and 13 AI tools** — all directly applicable to OpenSyber's SaaS posture sprint.

### Correlation Map

| TenantIQ Feature | OpenSyber Sprint | Skill ID |
|---|---|---|
| 6 security rules (MFA, legacy auth, impossible travel...) | Sprint 15 | `tenantiq-m365-security` |
| 9 remediation actions (revoke session, downgrade license...) | Sprint 17 | `tenantiq-m365-remediation` |
| License optimization engine | Sprint 15 | `tenantiq-m365-licensing` |
| 13 AI tools (health score, compliance, anomaly...) | Sprint 16 | `tenantiq-ai-tools` |
| Microsoft Graph API client (`packages/graph`) | Sprint 15 | shared library |
| Audit + workflow engine | Sprint 17 | integrated into playbooks |

### Integration Strategy

```
Option A: TenantIQ as Deployable Skill (recommended for MVP)
  Package TenantIQ's intelligence engine as an OpenSyber agent skill.
  The skill runs in an agent container, calls Microsoft Graph,
  and emits findings into OpenSyber's cspm_findings + saas_findings tables.
  → Zero code duplication. TenantIQ ships independently AND as a skill.

Option B: Deep M365 Connector (Sprint 15 full path)
  Re-implement TenantIQ's Graph API client as an OpenSyber saas connector.
  OpenSyber calls Graph directly, no separate container.
  → More tightly integrated but duplicates TenantIQ logic.

Option C: Cross-Platform API Bridge
  TenantIQ exposes a webhook → OpenSyber subscribes to events.
  OpenSyber ingests TenantIQ alerts as saas_findings.
  → Fastest to integrate, loosest coupling.
```

**Recommended:** Option A for Sprint 15 MVP (5 days to package + integrate),
upgrade to Option B in Sprint 18 full path.

### TenantIQ Skill Profile

```typescript
const tenantiqM365Skill: SkillProfile = {
  id: 'tenantiq-m365-security',
  version: '1.0.0',
  category: 'saas',
  provider: 'opensyber',        // first-party
  tier: 'pro',                  // Pro plan and above

  targets: [{ type: 'microsoft_365_tenant', required: true }],

  requiredPermissions: ['saas.write', 'vault.read'],

  outputs: [
    { type: 'saas_findings', table: 'saas_findings' },
    { type: 'risk_score_delta', source: 'tenantiq' },
    { type: 'remediation_suggestions', category: 'm365' },
  ],

  widgets: [
    { id: 'mfa-compliance', title: 'MFA Coverage', type: 'gauge' },
    { id: 'm365-risk-score', title: 'M365 Risk Score', type: 'score_card' },
    { id: 'license-waste', title: 'License Savings Available', type: 'stat' },
  ],

  schedule: { cron: '0 */6 * * *' },  // every 6 hours
}
```

---

## What's Already Built (Sprints 1–10)

| Capability | Competitor Equivalent | Status |
|---|---|---|
| AI agent containers (Hetzner VMs) | Unique — no competitor | ✅ Complete |
| Credential vault (AES-GCM) | CyberArk Secrets Manager | ✅ Complete |
| RBAC (5 roles, 35 permissions) | CyberArk Identity | ✅ Complete |
| SAML + OIDC SSO | CyberArk Identity | ✅ Complete |
| Audit logging (actor + action) | CyberArk Audit | ✅ Complete |
| Compliance frameworks (7 total) | Wiz Compliance | ✅ Complete |
| Security incidents + policies | Wiz Threat Detection | ✅ Complete |
| Notification channels (7 types) | Wiz Alerts | ✅ Complete |
| SLA + uptime monitoring | Custom | ✅ Complete |
| TokenForge device-bound sessions | Unique — no competitor | ✅ Complete |
| Multi-tenancy + org management | Enterprise standard | ✅ Complete |

**Competitor Gap Summary:**
- vs. CyberArk: Missing credential rotation + JIT access
- vs. Wiz: Missing cloud misconfiguration scanning + attack path graph
- vs. Suridata: Missing SaaS posture management + OAuth app inventory

---

## Reading This Document

Each sprint has two implementation tracks:

```
⚡ MVP PATH  — Ship in days. Reuses existing infra. Enough to sell.
🔵 FULL PATH — Complete implementation. Maximum competitive parity.
```

A sprint can be shipped at ⚡ level immediately and upgraded to 🔵 in a later
iteration. Both paths share the same schema — no data migration needed.

---

## Phase Map

```
Phase 1 (Sprints 1–10): Foundation          ████████████████████  DONE
Phase 2 (Sprints 11–13): CNSP MVP           ░░░░░░░░░░░░░░░░░░░░  Next
Phase 3 (Sprints 14–15): Graph Intelligence ░░░░░░░░░░░░░░░░░░░░  Upcoming
Phase 4 (Sprints 16–17): AI + Automation    ░░░░░░░░░░░░░░░░░░░░  Planned
Phase 5 (Sprints 18–20): Platform + Exit    ░░░░░░░░░░░░░░░░░░░░  Future
```

---

## Milestones

### Milestone A — "Cloud Security Edition" (End of Sprint 13)
**Trigger:** Open beta for CNSP features.
**Capability:** Cloud accounts connected, misconfigurations detected and scored.
**Revenue event:** Pro plan bump +$50/mo for CNSP add-on.
**Competitive claim:** "Prowler-powered cloud scanning + CyberArk-level vault in one platform."

### Milestone B — "Attack Path Edition" (End of Sprint 15)
**Trigger:** Public launch of CNSP tier.
**Capability:** Attack path visualization + SaaS posture.
**Revenue event:** Introduce CNSP plan tier ($299/mo).
**Competitive claim:** "See every attack path from your SaaS apps to your cloud."

### Milestone C — "Intelligence Edition" (End of Sprint 17)
**Trigger:** Enterprise sales motion begins.
**Capability:** AI prioritization + autonomous remediation.
**Revenue event:** Enterprise custom pricing unlocked.
**Competitive claim:** "The only platform that automatically remediates cloud misconfigurations."

### Milestone D — "Platform Edition" (End of Sprint 20)
**Trigger:** Partner + MSSP channel launch.
**Capability:** Multi-cloud, marketplace, SOC2 certification.
**Revenue event:** Series A / strategic acquisition positioning.
**Competitive claim:** "The unified security platform for the AI-native enterprise."

---

## Sprint Overview

| Sprint | Focus | Phase | ⚡ MVP Days | 🔵 Full Days | Milestone |
| --- | --- | --- | --- | --- | --- |
| 11 | Cloud CSPM + Prowler (AWS/GCP/Azure) | 2 | 5 | 10 | → A |
| **11b** | **Skill SDK ← UNLOCK** | **2** | **3** | **8** | **Parallel dev** |
| 12 | Credential Rotation + JIT | 2 | 4 | 8 | → A |
| 13 | Risk Intelligence | 2 | 3 | 7 | **A** |
| 14 | Attack Graph | 3 | 5 | 12 | → B |
| 15 | SaaS Posture + TenantIQ skill | 3 | 5 | 10 | **B** |
| 16 | AI Threat Intelligence + FinSavvyAI skill | 4 | 4 | 10 | → C |
| 17 | Remediation Engine | 4 | 4 | 10 | **C** |
| 18 | Multi-Cloud Framework (AWS + GCP + Azure) | 5 | 5 | 14 | → D |
| 19 | Security Marketplace | 5 | 4 | 10 | → D |
| 20 | Enterprise Exit + SOC2 | 5 | 5 | 14 | **D** |
| 21 | Platform Connect (SOAR + AutomationHub skill) | 6 | 4 | 10 | → E |
| 22 | Platform Data (GraphQL + Trust Portal) | 6 | 5 | 12 | **E** |

> **Sprint 11b unlocks parallel development.** After the SDK ships, Sprints 12–15
> can all start simultaneously across multiple developers/teams. The TenantIQ
> team can package M365 security as a skill during Sprint 12–13 while the
> internal team builds the attack graph. All skills converge by Sprint 15.
>
> See [parallel-execution-plan.md](parallel-execution-plan.md) for the full
> 4-track timeline achieving 35-day wall-clock vs 57-day sequential.

---

## Dependency Graph

```
Sprint 11 (CSPM)
    └─→ Sprint 13 (Risk scoring needs findings data)
            └─→ Sprint 14 (Graph needs scored assets)
                    └─→ Sprint 16 (AI needs graph context)
                            └─→ Sprint 17 (Remediation needs AI decisions)

Sprint 12 (Vault rotation)
    └─→ Sprint 14 (Graph maps secrets to assets)

Sprint 15 (SaaS)
    └─→ Sprint 14 (SaaS apps are graph nodes)
    └─→ Sprint 16 (AI classifies SaaS risk)

Sprint 18 (Multi-cloud)
    └─→ Sprint 11 (Extends Prowler connectors)
    └─→ Sprint 14 (Extends graph with cloud topology)

Sprint 19 (Marketplace)
    └─→ Sprint 11 (Custom Prowler checks as skills)
    └─→ Sprint 17 (Custom remediation playbooks)

Sprint 20 (Exit)
    └─→ All previous sprints complete
```

---

## Existing Infrastructure Reuse Map

| New Capability | Reuses | Notes |
|---|---|---|
| Prowler scanning | Hetzner VMs | Run Prowler CLI in agent container |
| Cloud account auth | Vault service | Store AWS keys encrypted |
| Finding storage | D1 + Drizzle | New tables, same patterns |
| Risk scores | Security score service | Extend existing score algorithm |
| Attack paths | D1 recursive CTEs | No Neo4j needed for MVP |
| SaaS connectors | Notification providers pattern | Same adapter interface |
| AI prioritization | OpenAI API via Worker | No GPU infra needed |
| Remediation | Cloudflare Workflows | Serverless, zero new ops |
| Marketplace | Skills marketplace (existing) | Extend current skill system |
| SOC2 evidence | Compliance export (Sprint 9) | Extend existing PDF export |

### Portfolio Product Substitutions (60% Build-Time Reduction)

| Planned Feature | Hand-Built Days | Portfolio Skill | Package Days | Saving |
| --- | --- | --- | --- | --- |
| CI/CD Security Gate (Sprint 20) | 2 | `pipewarden-cicd-security` | 1 | **1 day + 4 extra platforms** |
| NL Security Queries (Sprint 16) | 2.5 | `queryflux-mcp` + `querylens-nl-sql` | 2.5 | **same time, 2× capability** |
| M365 / SaaS connector (Sprint 15) | 5 | `tenantiq-m365-security` | 2 | **3 days + 14 detection rules** |
| Fraud risk signal (Sprint 13) | ✗ (not planned) | `quantumbeam-fraud-detection` | 3 | **new enterprise capability** |
| MCP connector generation (Sprint 19) | ✗ (not planned) | `mcpoverflow-connector-gen` | 2 | **"skill factory" for any API** |
| Dependency CVE scanning (Sprint 11) | ✗ (not planned) | `upm-dependency-audit` | 3 | **fills Prowler's blind spot** |
| Session security for agents | partial | `tokenforge-session-security` | 0.5 | **already in monorepo** |

> Full skill profiles and packaging steps → [skill-catalog.md](../skills/skill-catalog.md)

---

## New Database Tables (All Phases)

```sql
-- Phase 2 (Sprints 11–13)
cloud_accounts          -- connected AWS/GCP/Azure accounts
cspm_scan_runs          -- Prowler scan execution history
cspm_findings           -- individual misconfiguration findings
risk_scores             -- computed risk scores per asset
threat_intel            -- external threat feed entries
vault_rotation_policies -- rotation schedule per secret
vault_rotation_history  -- rotation audit trail
jit_access_requests     -- just-in-time privilege requests

-- Phase 3 (Sprints 14–15)
assets                  -- cloud + SaaS + agent asset inventory
asset_relations         -- edges in the security graph
attack_paths            -- computed BFS paths to critical assets
saas_accounts           -- connected SaaS application accounts
saas_findings           -- SaaS misconfiguration findings
saas_scan_runs          -- SaaS posture scan history

-- Phase 4 (Sprints 16–17)
ai_insights             -- LLM-generated finding explanations
ai_recommendations      -- AI remediation suggestions
remediation_playbooks   -- step-by-step fix workflows
remediation_runs        -- execution history of playbooks
remediation_approvals   -- approval gate decisions

-- Phase 5 (Sprints 18–20)
cloud_topology          -- network topology per cloud account
marketplace_submissions -- community security check submissions
soc2_evidence           -- SOC2 control evidence records
partner_tenants         -- MSSP white-label tenant configs
webhook_subscriptions   -- outbound security event webhooks
webhook_deliveries      -- webhook delivery history + retry state
cicd_gate_configs       -- per-environment deployment gate thresholds
cicd_gate_runs          -- CI/CD gate check audit trail

-- Phase 6 (Sprints 21–22)
automation_rules        -- trigger/action automation rules
automation_runs         -- automation execution history
trust_portals           -- public compliance trust portal config
```

---

## AI Agent Hosting — Always On the Plate

The AI agent hosting capability **must never regress.** Every sprint must pass:

- [ ] Existing agent container tests still green
- [ ] Hetzner VM provisioning still functional
- [ ] Gateway token auth still working
- [ ] Skill marketplace still operational
- [ ] Vault still accessible to agents

New CNSP features should **enhance** agent security, not compete with it:
- Cloud CSPM findings should surface in the agent's security dashboard
- Attack graph should include agent containers as nodes
- AI remediation should be applicable to agent security events
- SOC2 evidence should cover agent operations

---

## Go-to-Market by Milestone

### Milestone A positioning
> "OpenSyber now detects cloud misconfigurations across AWS, GCP, and Azure —
> automatically, continuously, and in the same dashboard where you manage your
> AI agents. No new tools, no new vendors."

### Milestone B positioning
> "See every attack path from your connected SaaS apps to your cloud infrastructure.
> OpenSyber maps the full blast radius of any vulnerability, so your team knows
> exactly what to fix first."

### Milestone C positioning
> "OpenSyber doesn't just find problems — it fixes them. Automated remediation
> playbooks run in seconds, with a full approval trail for compliance."

### Milestone D positioning
> "The only unified security platform purpose-built for the AI-native enterprise.
> Secure your AI agents, your cloud, your SaaS apps, and your user sessions from
> a single control plane."

### Milestone E positioning
> "OpenSyber is the security infrastructure layer for the modern enterprise.
> Every developer, every pipeline, every vendor questionnaire, every board
> report — all powered by a single API."

---

## Phase Map (Updated)

```text
Phase 1 (Sprints 1–10):   Foundation          ████████████████████  DONE
Phase 2 (Sprints 11–13):  CNSP MVP            ░░░░░░░░░░░░░░░░░░░░  Next
Phase 3 (Sprints 14–15):  Graph Intelligence  ░░░░░░░░░░░░░░░░░░░░  Upcoming
Phase 4 (Sprints 16–17):  AI + Automation     ░░░░░░░░░░░░░░░░░░░░  Planned
Phase 5 (Sprints 18–20):  Platform + Exit     ░░░░░░░░░░░░░░░░░░░░  Future
Phase 6 (Sprints 21–22):  Platform Data       ░░░░░░░░░░░░░░░░░░░░  Future
```

---

## Milestone E — "Platform Edition" (End of Sprint 22)

**Trigger:** Developer and partner ecosystem launch.
**Capability:** GraphQL API, public Trust Portal, Security Score API, full automation.
**Revenue event:** Usage-based API billing tier, Trust Portal Pro upgrade.
**Competitive claim:** "The security infrastructure layer — not just a dashboard."

---

## Files in This Directory

| File | Sprint | Status |
|---|---|---|
| `sprint-11-cspm-prowler.md` | 11 | Planning |
| `sprint-11b-skill-sdk.md` | 11b | Planning ← **Build first for parallel dev** |
| `sprint-12-credential-lifecycle.md` | 12 | Planning |
| `sprint-13-risk-intelligence.md` | 13 | Planning |
| `sprint-14-attack-graph.md` | 14 | Planning |
| `sprint-15-saas-posture.md` | 15 | Planning |
| `sprint-16-ai-intelligence.md` | 16 | Planning (+ MCP Server) |
| `sprint-17-remediation-engine.md` | 17 | Planning |
| `sprint-18-multicloud.md` | 18 | Planning |
| `sprint-19-marketplace.md` | 19 | Planning (+ Webhooks + Blueprints) |
| `sprint-20-enterprise-exit.md` | 20 | Planning (+ CI/CD Gate) |
| `sprint-21-platform-connect.md` | 21 | Planning |
| `sprint-22-platform-data.md` | 22 | Planning |
