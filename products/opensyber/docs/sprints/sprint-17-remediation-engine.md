> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 17: Autonomous Remediation Engine (2 weeks)

## Goal
OpenSyber stops just finding problems — it fixes them. Configurable remediation
playbooks run automatically (or with approval gates) to close misconfigurations
in cloud and SaaS environments. **Completes Milestone C — Intelligence Edition.**

## Dependencies
- Sprint 11 complete (CSPM findings are remediation targets)
- Sprint 15 complete (SaaS findings are remediation targets)
- Sprint 16 complete (AI recommendations inform playbooks)

## Competitive Target
- **Differentiator:** No competitor offers automated remediation as a first-class feature
- Wiz has "Wiz Remediation" (beta, limited); Suridata is advisory-only

---

## ⚡ MVP PATH (4 days) — Pre-built playbooks for top misconfigs

### MVP.1 — Remediation Schema (Day 1)
```sql
CREATE TABLE remediation_playbooks (
  id TEXT PRIMARY KEY,
  orgId TEXT,                  -- null = system/built-in playbook
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  checkId TEXT,                -- maps to cspm_findings.checkId
  provider TEXT,               -- 'aws' | 'gcp' | 'azure' | 'github' | 'slack'
  steps TEXT NOT NULL,         -- JSON array of RemediationStep
  requiresApproval INTEGER DEFAULT 1,
  isBuiltIn INTEGER DEFAULT 1,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL
);

CREATE TABLE remediation_runs (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  playbookId TEXT NOT NULL REFERENCES remediation_playbooks(id),
  findingId TEXT NOT NULL,
  triggeredBy TEXT NOT NULL,   -- userId or 'ai_auto' or 'scheduled'
  status TEXT DEFAULT 'pending', -- 'pending_approval' | 'running' | 'success' | 'failed' | 'rolled_back'
  approvedBy TEXT,
  approvedAt TEXT,
  startedAt TEXT,
  completedAt TEXT,
  stepsCompleted INTEGER DEFAULT 0,
  output TEXT,                 -- JSON execution log
  error TEXT,
  rolledBackAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE remediation_approvals (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL REFERENCES remediation_runs(id),
  orgId TEXT NOT NULL,
  requestedAt TEXT NOT NULL,
  reviewedBy TEXT,
  reviewedAt TEXT,
  decision TEXT,               -- 'approved' | 'rejected'
  notes TEXT
);
```
- [ ] Create D1 migration `0017_remediation.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/security.ts`

### MVP.2 — Playbook Engine (Day 1–2)
- [ ] Create `apps/api/src/services/remediation-engine.ts` (< 200 lines):
  ```typescript
  export interface RemediationStep {
    id: string
    name: string
    type: 'api_call' | 'cli_command' | 'manual_instruction'
    config: Record<string, unknown>
    rollback?: RemediationStep
  }
  export async function executePlaybook(runId: string): Promise<void>
  export async function rollbackRun(runId: string): Promise<void>
  export async function matchPlaybook(finding: CspmFinding): Promise<Playbook|null>
  ```
- [ ] Create built-in playbooks for top 10 AWS misconfigurations:
  1. `s3_bucket_public_access_enabled` → enable S3 Block Public Access
  2. `iam_root_access_key_enabled` → alert + manual guide
  3. `ec2_security_group_unrestricted_ssh` → restrict port 22 to org CIDR
  4. `cloudtrail_log_validation_disabled` → enable log file validation
  5. `rds_snapshot_public` → make snapshot private
  6. `iam_user_mfa_not_enabled` → enforce MFA via IAM policy
  7. `s3_bucket_versioning_disabled` → enable versioning
  8. `lambda_function_public_access_policy` → remove public access policy
  9. `vpc_flow_logs_disabled` → enable VPC flow logs
  10. `kms_key_rotation_disabled` → enable automatic key rotation

### MVP.3 — Remediation API Routes (Day 2–3)
- [ ] Create `apps/api/src/routes/remediation.ts`:
  - `GET    /api/remediation/playbooks` — list available playbooks
  - `POST   /api/remediation/playbooks` — create custom playbook
  - `POST   /api/remediation/run` — trigger playbook for a finding
  - `GET    /api/remediation/runs` — list runs with status
  - `GET    /api/remediation/runs/:id` — run details + step log
  - `POST   /api/remediation/runs/:id/approve` — approve pending run
  - `POST   /api/remediation/runs/:id/rollback` — rollback completed run
- [ ] `requirePermission('remediation.execute')` on run routes
- [ ] Write tests

### MVP.4 — Remediation Dashboard (Day 3–4)
- [ ] Create `app/dashboard/security/remediation/page.tsx`:
  - Pending approval queue (most urgent first)
  - Active runs with progress indicator
  - Run history with status + output log
- [ ] Add "Fix this" button to each CSPM finding row:
  - If playbook exists: shows "Auto-fix available"
  - Click → opens confirmation modal with playbook steps preview
- [ ] Create `components/dashboard/security/RemediationRunModal.tsx`:
  - Playbook name + steps list
  - "Requires approval" indicator
  - Confirm / Cancel
- [ ] Write component tests

---

## 🔵 FULL PATH (10 days) — Full automation with custom workflows

Everything in MVP plus:

### FULL.1 — Custom Playbook Builder
- [ ] Visual step builder (drag-drop interface)
- [ ] Step types:
  - `api_call`: HTTP request to cloud/SaaS API
  - `cli_command`: shell command on Hetzner agent VM
  - `notify`: send notification via existing channels
  - `wait_for_approval`: pause execution for human review
  - `verify`: run a check to confirm fix applied
- [ ] Conditional steps: `if finding.severity === 'critical' then auto_approve`
- [ ] Import/export playbooks as JSON (community sharing)

### FULL.2 — AI-Generated Playbooks
- [ ] Sprint 16 AI → generate playbook for any finding
- [ ] User reviews AI-generated steps before saving
- [ ] Confidence score per AI-generated step
- [ ] "Generate fix for this finding" → one-click playbook creation

### FULL.3 — Approval Workflows
- [ ] Configurable approval policies per finding severity:
  - Critical: require Owner approval
  - High: require Admin or Security approval
  - Medium/Low: auto-approve
- [ ] Slack interactive approval (button in Slack message)
- [ ] Approval timeout: auto-escalate after X hours
- [ ] Delegation: approve on behalf of out-of-office reviewer

### FULL.4 — Rollback + Verification
- [ ] Every API_call step generates a rollback step automatically
- [ ] Post-fix verification: re-run the Prowler check after fix
- [ ] "Fix verified" or "Fix failed" status update
- [ ] Auto-rollback on verification failure

### FULL.5 — Scheduled + Triggered Remediation
- [ ] Auto-trigger: if finding persists > X days → auto-run playbook
- [ ] Scheduled maintenance window: batch remediation at low-traffic times
- [ ] AI auto-remediation mode (Pro+ feature): low-risk fixes run automatically

---

## Milestone C Checklist
- [ ] AI explanations on all findings (Sprint 16)
- [ ] AI recommendations visible (Sprint 16)
- [ ] Auto-remediation for top 10 AWS misconfigs (Sprint 17)
- [ ] Approval workflow for critical fixes
- [ ] Remediation audit trail
- [ ] Enterprise sales deck updated with automation story
- [ ] "Intelligence Edition" pricing page live

## Definition of Done
- [ ] 10 built-in AWS remediation playbooks
- [ ] Approval workflow functional
- [ ] Remediation runs visible in dashboard
- [ ] Rollback works for completed runs
- [ ] Fix triggers CSPM re-scan to verify
- [ ] All new routes tested (>80% coverage)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Playbook engine | 1.5 | 3 |
| 10 built-in playbooks | 1 | 1 |
| API routes | 0.5 | 1.5 |
| Remediation dashboard + UI | 0.5 | 2 |
| Custom builder + AI playbooks | — | 2 |
| **Total** | **4** | **10** |
