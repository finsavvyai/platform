> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 20: Enterprise Exit — SOC2 Certification + MSSP + Series A (2.5 weeks)

## Goal
Prepare OpenSyber for enterprise sales at scale: SOC2 Type II certification
workflow, MSSP white-label capability, partner API, and Series A positioning.
**Completes Milestone D — Platform Edition.**

## Dependencies
- All Sprints 11–19 complete
- Legal entity established, SOC2 auditor engaged

## Strategic Context
By Sprint 20, OpenSyber has:
- Cloud security (Prowler CSPM) → matches Wiz
- Identity + vault (RBAC + JIT + rotation) → matches CyberArk
- SaaS posture → matches Suridata
- AI intelligence + auto-remediation → exceeds all three
- Community marketplace → unique moat
- Pricing: CNSP plan $299/mo, Enterprise custom

---

## ⚡ MVP PATH (5 days) — SOC2 evidence + partner API

### MVP.1 — SOC2 Evidence Collection (Day 1–2)
```sql
CREATE TABLE soc2_evidence (
  id TEXT PRIMARY KEY,
  orgId TEXT,                  -- null = platform-level evidence
  controlId TEXT NOT NULL,     -- e.g. 'CC6.1', 'CC7.2', 'A1.1'
  controlName TEXT NOT NULL,
  evidenceType TEXT NOT NULL,  -- 'policy' | 'log' | 'test' | 'screenshot'
  evidenceSource TEXT NOT NULL, -- 'audit_log' | 'compliance_export' | 'manual'
  summary TEXT NOT NULL,
  attachmentUrl TEXT,          -- R2 signed URL to evidence artifact
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  status TEXT DEFAULT 'collected',  -- 'collected' | 'reviewed' | 'auditor_approved'
  collectedAt TEXT NOT NULL
);

CREATE TABLE partner_tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,          -- MSSP company name
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'partner',
  apiKey TEXT NOT NULL,        -- hashed API key for partner API access
  whitelabelDomain TEXT,       -- custom domain for white-label
  logoUrl TEXT,
  primaryColor TEXT,
  maxCustomerOrgs INTEGER DEFAULT 50,
  revenueSharePct REAL DEFAULT 30,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL
);
```
- [ ] Create D1 migration `0020_enterprise_exit.sql`
- [ ] Update Drizzle schema

### MVP.2 — SOC2 Evidence Engine (Day 2–3)
- [ ] Create `apps/api/src/services/soc2-evidence.ts` (< 200 lines):
  ```typescript
  // Maps existing platform data → SOC2 control evidence
  export async function collectCC6_1Evidence(orgId): Promise<Evidence[]>
  // CC6.1: Logical + physical access controls (RBAC audit, JIT logs)
  export async function collectCC7_2Evidence(orgId): Promise<Evidence[]>
  // CC7.2: System monitoring (security incidents, alerts, cron runs)
  export async function collectA1_1Evidence(orgId): Promise<Evidence[]>
  // A1.1: Availability commitments (SLA + uptime records)
  export async function collectAllEvidence(orgId): Promise<void>
  // Runs all collectors, stores in soc2_evidence
  ```
- [ ] Evidence sources (all already exist in DB):
  - Audit logs → CC5.3, CC6.2 evidence
  - RBAC records → CC6.1 evidence
  - Compliance exports → CC4.2 evidence
  - Uptime records → A1.1 evidence
  - JIT access logs → CC6.3 evidence
  - Vault rotation history → CC6.1 evidence
- [ ] `GET /api/soc2/evidence` — list collected evidence by control
- [ ] `POST /api/soc2/evidence/collect` — trigger collection run
- [ ] Write tests

### MVP.3 — Partner API (Day 3–4)
- [ ] Create `apps/api/src/routes/partner.ts`:
  - `POST /api/partner/orgs` — create customer org under partner
  - `GET  /api/partner/orgs` — list partner's customer orgs
  - `GET  /api/partner/orgs/:id/summary` — security posture summary
  - `GET  /api/partner/orgs/:id/findings` — aggregated findings
  - `POST /api/partner/orgs/:id/scan` — trigger scan for customer
- [ ] Partner auth: `X-Partner-Key` header → partner tenant lookup in D1
- [ ] Scope all partner queries to their customer orgs
- [ ] Write tests

### MVP.4 — SOC2 Dashboard + Partner UI (Day 4–5)
- [ ] Create `apps/web/src/app/dashboard/compliance/soc2/page.tsx`:
  - Control list (TSC: CC, A, PI, etc.)
  - Evidence status per control: collected / missing / auditor-reviewed
  - "Collect Evidence" button → triggers collection run
  - Download evidence package (PDF for auditor)
- [ ] Create `apps/web/src/app/partner/page.tsx`:
  - Customer org list with security scores
  - Aggregate risk across all customers
  - "Add Customer" flow
- [ ] Write component tests

---

## 🔵 FULL PATH (14 days) — Full Series A readiness

Everything in MVP plus:

### FULL.1 — SOC2 Type II Continuous Monitoring
- [ ] Automated daily evidence collection for all controls
- [ ] Auditor portal: read-only access for SOC2 auditor to review evidence
- [ ] Evidence gap alerts: "You're missing evidence for CC7.2"
- [ ] Readiness score: percentage of controls with complete evidence

### FULL.2 — ISO 27001 + FedRAMP Readiness
- [ ] ISO 27001 control mapping (similar to SOC2 engine)
- [ ] FedRAMP baseline checks (NIST 800-53)
- [ ] GDPR Article compliance mapping
- [ ] Multi-framework evidence reuse (SOC2 CC6.1 ↔ ISO A.9)

### FULL.3 — White-Label Platform
- [ ] Partner-branded domain: `security.customer.com`
- [ ] Custom logo, color scheme, email templates
- [ ] Remove OpenSyber branding entirely for enterprise partners
- [ ] Custom onboarding flows per partner

### FULL.4 — OpenSyber Partner Program
- [ ] Partner portal: `partners.opensyber.cloud`
- [ ] Revenue dashboard: MRR per customer, commission earned
- [ ] Partner certification: self-paced training + assessment
- [ ] Co-marketing materials and case study templates

### FULL.5 — Series A Metrics Dashboard (Internal)
- [ ] ARR tracking (Monthly Recurring Revenue × 12)
- [ ] NRR (Net Revenue Retention) calculation
- [ ] CAC (Customer Acquisition Cost) by channel
- [ ] LTV:CAC ratio per plan tier
- [ ] Churn analysis: reasons, cohort breakdown
- [ ] Investor-ready metrics export (PDF)

---

## ⚡ CI/CD Security Gate (2 days — add to either path)

A GitHub Action / GitLab CI / Bitbucket Pipe that runs OpenSyber checks as a
**deployment gate**. If risk score is too high or critical findings are open,
the pipeline blocks the deploy. Positions OpenSyber in the developer workflow,
not just the security team's dashboard.

### CICD.1 — Gate API Endpoint (Day 1)

- [ ] Create `apps/api/src/routes/cicd-gate.ts`:

  ```typescript
  // POST /api/v1/gate/check
  // Called by CI/CD pipelines to assess deploy readiness
  // Auth: OPENSYBER_API_KEY (env var, not user JWT)
  interface GateCheckRequest {
    orgId: string
    environment: 'staging' | 'production'
    deployContext?: {          // optional — enriches the check
      repo: string
      branch: string
      commit: string
      author: string
    }
  }
  interface GateCheckResponse {
    decision: 'allow' | 'block' | 'warn'
    riskScore: number
    blockers: GateBlocker[]    // findings that caused block
    warnings: GateWarning[]
    reportUrl: string          // link to full findings in dashboard
  }
  ```

- [ ] Gate logic (configurable thresholds per org):
  - Block if `riskScore > org.gateBlockThreshold` (default: 80)
  - Block if any unresolved CRITICAL finding matches `scope: production`
  - Warn if `riskScore > org.gateWarnThreshold` (default: 60)
  - Allow otherwise
- [ ] Store gate check results in `cicd_gate_runs` table for audit trail
- [ ] Schema:

  ```sql
  CREATE TABLE cicd_gate_configs (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL REFERENCES organizations(id),
    environment TEXT NOT NULL,
    blockThreshold INTEGER DEFAULT 80,
    warnThreshold INTEGER DEFAULT 60,
    blockOnCritical INTEGER DEFAULT 1,
    blockOnComplianceFailure INTEGER DEFAULT 0,
    requiredFrameworks TEXT,   -- JSON: ['soc2'] — block if not passing
    createdAt TEXT NOT NULL
  );

  CREATE TABLE cicd_gate_runs (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL,
    configId TEXT REFERENCES cicd_gate_configs(id),
    environment TEXT NOT NULL,
    decision TEXT NOT NULL,
    riskScore INTEGER,
    blockerCount INTEGER DEFAULT 0,
    repo TEXT,
    branch TEXT,
    commit TEXT,
    author TEXT,
    checkedAt TEXT NOT NULL
  );
  ```

- [ ] Add gate permissions: `gate.read`, `gate.config`
- [ ] Write tests

### CICD.2 — PipeWarden Skill + GitHub Action (Day 2)

**Do not build from scratch.** Package PipeWarden
(`~/dev/projects/03_Enterprize_application/products/fintech-suite/pipewarden`)
as an OpenSyber skill. PipeWarden is a **production-ready** CI/CD security
gateway with 168 E2E tests, 5-platform support, and sub-50ms response time.
See [skill-catalog.md](../skills/skill-catalog.md#pipewarden-cicd-security).

Packaging steps (replaces hand-building the GitHub Action from scratch):

- [ ] Extract PipeWarden's scanning logic → skill runner (`ctx.emit.finding()`)
- [ ] Replace PipeWarden auth with OpenSyber gateway token (X-Gateway-Token)
- [ ] Build Docker image → deploy as Hetzner agent container
- [ ] Register `pipewarden-cicd-security` skill profile in marketplace

Then wrap the gate API with a thin GitHub Action:

```yaml
# Usage in customer's workflow:
- name: OpenSyber Security Gate
  uses: opensyber/security-gate@v1
  with:
    api-key: ${{ secrets.OPENSYBER_API_KEY }}
    environment: production
    fail-on: block          # block | warn | never
  # Outputs:
  # decision: allow | block | warn
  # risk-score: 0-100 (powered by PipeWarden skill)
  # report-url: https://app.opensyber.cloud/...
```

- [ ] Create `packages/github-action/` (thin wrapper — 50 lines max):
  - `action.yml` — metadata
  - `src/index.ts` — calls `POST /api/v1/gate/check`, sets outputs
  - Annotates PR with PipeWarden findings summary
- [ ] Gate config UI: `app/dashboard/settings/cicd/page.tsx`
- [ ] Write action tests (vitest + nock)

**What PipeWarden adds vs hand-built gate:**

- 5 CI/CD platforms (GitHub, GitLab, Jenkins, Bitbucket, Azure DevOps)
- DDoS protection + rate limiting built in
- VS Code extension for in-editor gate feedback
- 168 existing E2E tests included

### CICD.3 — GitLab + Bitbucket Support

Already covered by PipeWarden's existing integrations. Wire up:

- [ ] GitLab CI component using PipeWarden's existing GitLab webhook handler
- [ ] Bitbucket Pipe using PipeWarden's existing Bitbucket connector
- [ ] Generic `curl`-based fallback for any CI:

  ```bash
  # Any CI system:
  curl -X POST https://api.opensyber.cloud/api/v1/gate/check \
    -H "X-Api-Key: $OPENSYBER_API_KEY" \
    -d '{"orgId":"org_xxx","environment":"production"}' \
    | jq -e '.decision != "block"'
  ```

---

## Milestone D Checklist
- [ ] SOC2 evidence collection automated (Sprint 20)
- [ ] Partner API functional (Sprint 20)
- [ ] Multi-cloud coverage complete (Sprint 18)
- [ ] Security marketplace live (Sprint 19)
- [ ] AI intelligence + remediation live (Sprints 16–17)
- [ ] All compliance frameworks covered (SOC2, ISO, HIPAA, GDPR, PCI, NIST)
- [ ] Series A deck narrative: "The unified security platform for AI-native enterprises"
- [ ] Pilot enterprise customers (5+) with reference stories

## Definition of Done
- [ ] SOC2 evidence collected for all 17 trust service criteria
- [ ] Partner API functional with customer org management
- [ ] Auditor-ready evidence package exportable
- [ ] Partner portal live with revenue dashboard
- [ ] All new routes tested (>80% coverage)
- [ ] Security audit clean on all new endpoints

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| SOC2 evidence engine | 2 | 3 |
| Partner API | 1.5 | 3 |
| Dashboard pages | 1 | 2 |
| White-label + ISO/FedRAMP | — | 3 |
| Series A metrics + partner program | — | 2.5 |
| **Total** | **5** | **14** |

---

## Total Roadmap Investment Summary

| Path | Sprints 11–20 Total | Calendar Time |
|---|---|---|
| ⚡ All sprints at MVP level | ~44 days | ~9 weeks |
| 🔵 All sprints at full level | ~104 days | ~21 weeks |
| **Recommended: MVP-first + iterate** | **~44 days MVP → then upgrade** | **~9 weeks to Milestone A** |

### Recommended Execution Order
1. Sprint 11 (CSPM) ⚡ — 5 days — immediate market entry
2. Sprint 12 (Vault lifecycle) ⚡ — 4 days — close CyberArk gap
3. Sprint 13 (Risk intelligence) ⚡ — 3 days — **Milestone A, open beta**
4. Sprint 14 (Attack graph) ⚡ — 5 days — differentiation begins
5. Sprint 15 (SaaS posture) ⚡ — 5 days — **Milestone B, public launch**
6. Sprint 11–15 🔵 upgrades — 27 days — deepen each feature
7. Sprint 16 (AI) ⚡ — 4 days — unique market positioning
8. Sprint 17 (Remediation) ⚡ — 4 days — **Milestone C, enterprise sales**
9. Sprint 18–19 🔵 — 24 days — build the moat
10. Sprint 20 🔵 — 14 days — **Milestone D, Series A**
