> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 13: Risk Intelligence Layer (1.5 weeks)

## Goal
Unify all security signals (CSPM findings, security incidents, vault status,
compliance score, uptime) into a single risk score per asset and organization.
Add an AI-powered "explain this finding" feature as a preview of Sprint 16.
**This completes Milestone A — Cloud Security Edition.**

## Dependencies
- Sprint 11 complete (CSPM findings data)
- Sprint 12 complete (vault rotation status)
- Existing `security-score.ts` service (extends)

## Competitive Target
- **Wiz:** Contextual risk prioritization, CVSS-based scoring
- **Suridata:** Risk mapping + prioritized remediation

---

## ⚡ MVP PATH (3 days) — Unified risk score, ship Milestone A

### MVP.1 — Risk Score Schema (Day 1)
```sql
CREATE TABLE risk_scores (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  entityType TEXT NOT NULL,    -- 'org' | 'instance' | 'cloud_account' | 'secret'
  entityId TEXT NOT NULL,
  score INTEGER NOT NULL,      -- 0–100 (100 = critical risk)
  breakdown TEXT NOT NULL,     -- JSON: { cspm: 40, incidents: 30, vault: 20, uptime: 10 }
  trend TEXT,                  -- 'improving' | 'worsening' | 'stable'
  previousScore INTEGER,
  computedAt TEXT NOT NULL,
  UNIQUE(orgId, entityType, entityId)
);

CREATE TABLE threat_intel (
  id TEXT PRIMARY KEY,
  cveId TEXT,
  severity TEXT NOT NULL,      -- CVSS severity
  cvssScore REAL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  affectedProducts TEXT,       -- JSON array
  publishedAt TEXT NOT NULL,
  source TEXT NOT NULL         -- 'nvd' | 'mitre' | 'internal'
);
```
- [ ] Create D1 migration `0013_risk_intelligence.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — Risk Scoring Service (Day 1–2)
- [ ] Create `apps/api/src/services/risk-scoring.ts` (< 200 lines):
  ```typescript
  // Aggregates signals into a 0-100 risk score
  // Higher = more risk. Components:
  //   CSPM: critical=40pts, high=20pts, medium=5pts
  //   Incidents: unresolved critical=30pts
  //   Vault: overdue rotation=15pts each
  //   Uptime: <99% last 7 days=10pts
  //   Compliance: failed controls add proportional pts
  export async function computeOrgRiskScore(orgId): Promise<RiskScore>
  export async function computeInstanceRiskScore(instanceId): Promise<RiskScore>
  export async function computeCloudAccountRiskScore(accountId): Promise<RiskScore>
  ```
- [ ] Add risk score computation to hourly cron
- [ ] Add `GET /api/risk/scores` route — list all entity scores for org
- [ ] Add `GET /api/risk/scores/:entityType/:entityId` — single entity score
- [ ] Write tests covering each signal contribution

### MVP.3 — Risk Dashboard (Day 2–3)
- [ ] Enhance existing security dashboard `page.tsx`:
  - Top-level org risk score (big number + color indicator)
  - Risk breakdown ring chart (CSPM / Incidents / Vault / Uptime)
  - Per-instance risk scores in instances table (colored badge)
- [ ] Create `components/dashboard/security/RiskScoreCard.tsx`:
  - Score (0–100), severity label, trend arrow
  - Last computed timestamp
- [ ] Create `components/dashboard/security/RiskBreakdown.tsx`:
  - Horizontal bar showing contribution of each signal
- [ ] Write component tests

---

## 🔵 FULL PATH (7 days) — Intelligence layer with AI preview

Everything in MVP plus:

### FULL.1 — Threat Intelligence Feed
- [ ] Create `apps/api/src/services/threat-intel.ts` (< 200 lines):
  - Fetch NVD CVE feed (daily cron)
  - Match CVEs against installed agent skills and OS packages
  - Correlate with CSPM findings
- [ ] Show affected CVEs per instance in security dashboard

### FULL.2 — AI Finding Explanation (Preview for Sprint 16)
- [ ] Create `apps/api/src/routes/ai-explain.ts`:
  - `POST /api/ai/explain` — body: `{ findingId }`
  - Calls OpenAI API with finding context + remediation
  - Returns plain-English explanation + step-by-step fix
- [ ] "Explain this" button on each CSPM finding row
  - Streaming response displayed in expandable panel
- [ ] Rate limit: 10 explanations/day on Free, unlimited on Pro+
- [ ] Write tests with mocked OpenAI responses

### FULL.3 — Risk Trend Analysis
- [ ] Store score history (last 90 days)
- [ ] Risk trend chart: line graph over time
- [ ] Comparative benchmark: "Your org is in the top 30% of similar orgs"
- [ ] Risk forecast: simple linear regression on 7-day trend

### FULL.4 — Alert Rules for Risk Score
- [ ] Trigger notification when org risk score exceeds threshold
- [ ] Configurable: score > 70 → Slack alert, score > 90 → PagerDuty page
- [ ] Daily/weekly risk digest email (reuse email service)

### FULL.5 — Compliance Score Integration
- [ ] Map risk score directly to compliance control status
- [ ] SOC2 CC7.2: continuous risk monitoring evidence
- [ ] Include risk score history in compliance export

---

## Milestone A Checklist
- [ ] Cloud accounts connected (Sprint 11)
- [ ] CSPM findings flowing (Sprint 11)
- [ ] Credential rotation active (Sprint 12)
- [ ] JIT access working (Sprint 12)
- [ ] Unified risk score computed (Sprint 13)
- [ ] Risk visible in security dashboard
- [ ] Open beta announcement ready

## Definition of Done
- [ ] Risk score computed for org + all instances
- [ ] Risk breakdown visible in security dashboard
- [ ] Score recalculated hourly via cron
- [ ] CSPM findings contribute to score
- [ ] All new routes tested (>80% coverage)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Risk scoring service | 1 | 2 |
| Risk dashboard components | 1 | 2 |
| Threat intel feed + AI explain | — | 2 |
| Trend analysis + alerts | — | 0.5 |
| **Total** | **3** | **7** |
