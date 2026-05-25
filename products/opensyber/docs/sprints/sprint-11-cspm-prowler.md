> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 11: Cloud Security Posture Management (CSPM) + Prowler (2 weeks)

## Goal
Users can connect their cloud accounts (AWS, GCP, Azure) and receive continuous
misconfiguration detection powered by Prowler — surfaced in the existing security
dashboard alongside agent security events.

## Dependencies
- Sprint 10 complete (enterprise foundation)
- Prowler available in Hetzner base image

## Competitive Target
- **Wiz:** Agentless cloud scanning, 400+ checks
- **Suridata:** Misconfiguration detection and alerts

---

## ⚡ MVP PATH (5 days) — Ship and sell immediately

### MVP.1 — Cloud Account Connector (Day 1–2)
```sql
CREATE TABLE cloud_accounts (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES organizations(id),
  userId TEXT NOT NULL,
  provider TEXT NOT NULL,        -- 'aws' | 'gcp' | 'azure'
  name TEXT NOT NULL,
  externalId TEXT,               -- AWS external ID for cross-account
  roleArn TEXT,                  -- AWS: IAM role ARN (encrypted)
  credentials TEXT,              -- GCP/Azure: JSON creds (AES-GCM encrypted)
  status TEXT DEFAULT 'pending', -- 'pending' | 'active' | 'error'
  lastScanAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE cspm_scan_runs (
  id TEXT PRIMARY KEY,
  cloudAccountId TEXT NOT NULL REFERENCES cloud_accounts(id),
  orgId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  completedAt TEXT,
  status TEXT NOT NULL,  -- 'running' | 'complete' | 'failed'
  findingCount INTEGER DEFAULT 0,
  criticalCount INTEGER DEFAULT 0,
  highCount INTEGER DEFAULT 0
);

CREATE TABLE cspm_findings (
  id TEXT PRIMARY KEY,
  scanRunId TEXT NOT NULL REFERENCES cspm_scan_runs(id),
  cloudAccountId TEXT NOT NULL,
  orgId TEXT NOT NULL,
  checkId TEXT NOT NULL,         -- e.g. 'iam_root_access_key_enabled'
  severity TEXT NOT NULL,        -- 'critical' | 'high' | 'medium' | 'low' | 'informational'
  status TEXT NOT NULL,          -- 'fail' | 'pass' | 'muted'
  resourceId TEXT NOT NULL,      -- ARN or cloud resource ID
  resourceType TEXT NOT NULL,    -- e.g. 'AWS::IAM::User'
  region TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  remediation TEXT,
  complianceFrameworks TEXT,     -- JSON array: ['soc2', 'cis']
  firstSeenAt TEXT NOT NULL,
  resolvedAt TEXT,
  mutedAt TEXT,
  mutedBy TEXT
);
```
- [ ] Create D1 migration `0011_cspm.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/cspm.ts`
- [ ] Export from `packages/db/src/schema/index.ts`

### MVP.2 — Prowler Service (Day 2–3)
- [ ] Create `apps/api/src/services/prowler.ts` (< 200 lines):
  ```typescript
  // Calls Prowler CLI on an existing Hetzner VM
  // Uses existing hetzner.ts service to exec into agent container
  export interface ProwlerService {
    runScan(accountId: string, provider: 'aws' | 'gcp' | 'azure'): Promise<ScanRun>
    parseProwlerOutput(jsonOutput: string): ProwlerFinding[]
    mapToFinding(raw: ProwlerFinding, scanRunId: string): CspmFinding
  }
  ```
- [ ] Create `apps/api/src/routes/cloud-accounts.ts`:
  - `GET    /api/cloud-accounts` — list org's accounts
  - `POST   /api/cloud-accounts` — connect new account (stores encrypted creds)
  - `DELETE /api/cloud-accounts/:id` — disconnect + delete findings
  - `POST   /api/cloud-accounts/:id/scan` — trigger on-demand scan
  - `GET    /api/cloud-accounts/:id/findings` — paginated findings list
  - `PATCH  /api/cloud-accounts/:id/findings/:findingId` — mute/unmute
- [ ] All routes: `requirePermission('cloud.write')` or `cloud.read`
- [ ] Add new permissions to `packages/shared/src/constants/permissions.ts`:
  - `cloud.read`, `cloud.write`, `cloud.admin`
- [ ] Write tests for all routes

### MVP.3 — CSPM Dashboard (Day 3–4)
- [ ] Create `apps/web/src/app/dashboard/security/cloud/page.tsx`:
  - Summary cards: total findings, critical, high, passing
  - Findings table: checkId, resource, severity, status, age
  - Mute button per finding
  - "Run Scan" button
- [ ] Create `apps/web/src/app/dashboard/security/cloud/accounts/page.tsx`:
  - List connected accounts
  - "Connect Account" button → setup wizard
- [ ] Create `components/dashboard/security/ConnectCloudAccountModal.tsx`:
  - Provider select (AWS/GCP/Azure)
  - AWS: role ARN + external ID + trust policy instructions
  - GCP: service account JSON upload
  - Azure: client ID + secret + tenant ID
- [ ] Add "Cloud Security" to security sidebar nav
- [ ] Write component tests

### MVP.4 — Scheduled Scans (Day 5)
- [ ] Add to existing hourly cron in `security-cron.ts`:
  - For each active cloud account: run Prowler scan if `lastScanAt` > 24h ago
  - Create scan run record, parse output, store findings
  - If new CRITICAL findings: trigger notification via existing channels
- [ ] Write cron test

---

## 🔵 FULL PATH (10 days) — Complete competitive parity

Everything in MVP plus:

### FULL.1 — Multi-Cloud Deep Integration
- [ ] AWS: Cross-account IAM role federation (no stored credentials)
- [ ] GCP: Workload Identity Federation
- [ ] Azure: Managed Identity
- [ ] Kubernetes: service account token + RBAC audit
- [ ] Full Prowler check catalog: 400+ checks, all services

### FULL.2 — Finding Enrichment
- [ ] Cross-reference findings with threat intel feeds (NVD, MITRE)
- [ ] Map findings to compliance controls automatically (CIS Level 1/2, SOC2)
- [ ] Tag findings by affected service (IAM, S3, EC2, Lambda...)
- [ ] Finding history: track when status changed

### FULL.3 — Advanced Dashboard
- [ ] Trend charts: finding count over time (30 days)
- [ ] Severity heatmap by service
- [ ] Compliance posture per framework (CIS score)
- [ ] Export findings as CSV/PDF (reuse Sprint 9 export service)
- [ ] Drill-down by resource type

### FULL.4 — Continuous Monitoring
- [ ] Real-time scan trigger on CloudTrail events (AWS)
- [ ] GCP Pub/Sub + Azure Event Grid integration
- [ ] Configurable scan frequency per account (hourly/daily/weekly)
- [ ] Auto-create security incident when critical finding appears

### FULL.5 — Remediation Hints (Preview for Sprint 17)
- [ ] Each finding: "Fix this" expandable panel
- [ ] AWS Console deep-link to misconfigured resource
- [ ] CLI command to remediate (copy-paste ready)

---

## Definition of Done
- [ ] AWS account connection works end-to-end
- [ ] Prowler scan runs and findings appear in dashboard
- [ ] Findings can be muted with audit trail
- [ ] Scheduled daily scan running via cron
- [ ] Critical findings trigger notifications
- [ ] All routes have tests (>80% coverage)
- [ ] Cloud accounts page live in dashboard
- [ ] No regression in agent hosting features

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Prowler service | 1 | 2 |
| API routes | 1 | 2 |
| CSPM dashboard | 1.5 | 3 |
| Scheduled scan | 0.5 | 1 |
| Multi-cloud + enrichment | — | 1.5 |
| **Total** | **5** | **10** |
