> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 15: SaaS Security Posture Management (2 weeks)

## Goal
Connect popular SaaS applications (GitHub, Slack, Google Workspace, Okta) and
continuously detect misconfigurations, over-permissioned OAuth apps, and shadow
IT exposure. **Completes Milestone B — Attack Path Edition.**

## Dependencies
- Sprint 14 complete (SaaS apps become asset graph nodes)
- Sprint 11 complete (misconfiguration pattern established)

## Competitive Target
- **Suridata:** SaaS misconfiguration detection, OAuth app inventory
- **Wiz:** Agentless coverage extension into SaaS layer

---

## ⚡ MVP PATH (5 days) — GitHub + Slack + Google Workspace

### MVP.1 — SaaS Account Schema (Day 1)
```sql
CREATE TABLE saas_accounts (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL,
  provider TEXT NOT NULL,   -- 'github' | 'slack' | 'google' | 'okta' | 'salesforce'
  name TEXT NOT NULL,
  externalOrgId TEXT,       -- GitHub org name, Slack workspace ID, etc.
  accessToken TEXT,         -- encrypted OAuth token or API key
  tokenScopes TEXT,         -- JSON array of OAuth scopes granted
  status TEXT DEFAULT 'active',
  lastScanAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE saas_scan_runs (
  id TEXT PRIMARY KEY,
  saasAccountId TEXT NOT NULL REFERENCES saas_accounts(id),
  orgId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  completedAt TEXT,
  status TEXT NOT NULL,
  findingCount INTEGER DEFAULT 0
);

CREATE TABLE saas_findings (
  id TEXT PRIMARY KEY,
  scanRunId TEXT NOT NULL REFERENCES saas_scan_runs(id),
  saasAccountId TEXT NOT NULL,
  orgId TEXT NOT NULL,
  checkId TEXT NOT NULL,       -- e.g. 'github_public_repo_secret_scanning_disabled'
  severity TEXT NOT NULL,
  status TEXT NOT NULL,        -- 'fail' | 'pass' | 'muted'
  resourceType TEXT NOT NULL,  -- 'repo' | 'user' | 'app' | 'workspace'
  resourceId TEXT NOT NULL,
  resourceName TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  remediation TEXT,
  firstSeenAt TEXT NOT NULL,
  resolvedAt TEXT,
  mutedAt TEXT
);

CREATE TABLE saas_oauth_apps (
  id TEXT PRIMARY KEY,
  saasAccountId TEXT NOT NULL,
  orgId TEXT NOT NULL,
  appName TEXT NOT NULL,
  appId TEXT NOT NULL,
  publisherName TEXT,
  scopes TEXT NOT NULL,         -- JSON array
  scopeRiskLevel TEXT,          -- 'critical' | 'high' | 'medium' | 'low'
  userCount INTEGER DEFAULT 0,
  isVerified INTEGER DEFAULT 0,
  isApproved INTEGER,           -- null = unknown, 1 = approved, 0 = rejected
  firstDetectedAt TEXT NOT NULL
);
```
- [ ] Create D1 migration `0015_saas_posture.sql`
- [ ] Update Drizzle schema in `packages/db/src/schema/saas.ts`

### MVP.2 — SaaS Connector Framework (Day 1–2)
- [ ] Create `apps/api/src/services/saas/connector.ts` — base interface:
  ```typescript
  export interface SaasConnector {
    provider: string
    scan(accountId: string, token: string): Promise<SaasRawData>
    runChecks(data: SaasRawData): Promise<SaasFinding[]>
    listOAuthApps(token: string): Promise<OAuthApp[]>
  }
  ```
- [ ] Create `apps/api/src/services/saas/github.ts` (< 200 lines):
  - Checks: secret scanning disabled, public repos with admin access,
    branch protection missing on main, stale personal access tokens,
    outside collaborators with write access
- [ ] Create `apps/api/src/services/saas/slack.ts` (< 200 lines):
  - Checks: public channels with sensitive keywords, guest users with admin,
    OAuth apps with excessive scopes, external file sharing enabled
- [ ] Create `apps/api/src/services/saas/google.ts` (< 200 lines):
  - Checks: 2FA not enforced, external sharing on Drive, OAuth apps installed,
    admin account activity, suspicious delegated access

### MVP.3 — SaaS API Routes (Day 2–3)
- [ ] Create `apps/api/src/routes/saas-posture.ts`:
  - `GET    /api/saas/accounts` — list connected apps
  - `POST   /api/saas/accounts` — connect new SaaS account
  - `DELETE /api/saas/accounts/:id` — disconnect
  - `POST   /api/saas/accounts/:id/scan` — trigger on-demand scan
  - `GET    /api/saas/accounts/:id/findings` — findings list
  - `GET    /api/saas/accounts/:id/oauth-apps` — OAuth app inventory
  - `PATCH  /api/saas/oauth-apps/:id` — approve/reject app
- [ ] All routes: `requirePermission('saas.read')` / `saas.write`
- [ ] Add saas permissions to `packages/shared/src/constants/permissions.ts`
- [ ] Write tests

### MVP.4 — SaaS Posture Dashboard (Day 3–5)
- [ ] Create `apps/web/src/app/dashboard/security/saas/page.tsx`:
  - Connected apps with finding counts
  - OAuth app inventory table: app name, scopes, risk level, status
  - Findings list with severity + remediation
- [ ] Create `components/dashboard/security/ConnectSaasModal.tsx`:
  - Provider select
  - OAuth flow for GitHub/Slack/Google (redirect-based)
  - API key for Okta
- [ ] Create `components/dashboard/security/OAuthAppCard.tsx`:
  - App name, scopes (color-coded by risk), user count
  - Approve / reject / investigate buttons
- [ ] Add SaaS findings into asset graph (Sprint 14)
- [ ] Write component tests

---

## 🔵 FULL PATH (10 days) — Full Suridata parity

Everything in MVP plus:

### FULL.0 — TenantIQ Skill (Day 1, parallel with MVP — **do not build M365 from scratch**)

**Do not hand-build the M365 connector.** Package TenantIQ as an OpenSyber skill instead:

- [ ] Follow [`skill-catalog.md`](../skills/skill-catalog.md) → `tenantiq-m365-security` (P0, 2 days)
- [ ] Extract TenantIQ scanning logic → `SkillProfile.run()` entry point
- [ ] Wire TenantIQ's 14 detection rules → `ctx.emit.saasFinding()` calls
- [ ] Wire TenantIQ's 9 remediation actions → `ctx.emit.remediationSuggestion()` calls
- [ ] Wire TenantIQ's 13 AI tools → `ctx.emit.aiInsight()` calls
- [ ] Store M365 OAuth credentials in vault (`ctx.vault.read()`)
- [ ] Register skill: `tenantiq-m365-security` with 6h cron schedule

**What you get for free vs building from scratch:**

| Built from scratch | TenantIQ skill |
| --- | --- |
| 14 detection rules to write (~5 days) | 14 rules already written ✓ |
| MFA, legacy auth, impossible travel, … | All implemented ✓ |
| 9 remediation action flows | All implemented ✓ |
| 13 AI security tools | All implemented ✓ |
| **5 days of work** | **2 days packaging** |

### FULL.1 — Extended Connectors (non-M365)
- [ ] `apps/api/src/services/saas/okta.ts` — identity provider checks
- [ ] `apps/api/src/services/saas/salesforce.ts` — CRM security checks
- [ ] `apps/api/src/services/saas/jira.ts` — project exposure + ticket leak checks
- [ ] `apps/api/src/services/saas/zoom.ts` — meeting recording exposure
- [ ] M365 → covered by `tenantiq-m365-security` skill (see FULL.0 above)

### FULL.2 — Real-Time Webhook Monitoring
- [ ] GitHub webhooks: alert on new public repo, secret push detected
- [ ] Slack Events API: new OAuth app installed, guest user added
- [ ] Google Workspace push notifications: policy change events
- [ ] Store events in `saas_events` table, correlate with risk score

### FULL.3 — Shadow IT Discovery
- [ ] Scan browser extension permissions via Okta + Azure AD device reports
- [ ] Cross-reference OAuth apps across all connected SaaS accounts
- [ ] Shadow IT risk score: unapproved apps × user count × scope risk

### FULL.4 — Remediation Actions for SaaS
- [ ] "Revoke OAuth app" — call SaaS API to revoke app token
- [ ] "Enable branch protection" — GitHub API call
- [ ] "Enforce 2FA" — send admin notification with direct config link
- [ ] Audit trail for all SaaS remediation actions

### FULL.5 — Compliance Mapping
- [ ] Map SaaS findings to SOC2, ISO27001, GDPR controls
- [ ] Include SaaS posture in compliance export (Sprint 9)
- [ ] "Third-party risk" section in compliance report

---

## Milestone B Checklist
- [ ] Cloud CSPM active (Sprint 11)
- [ ] Attack paths computed (Sprint 14)
- [ ] SaaS accounts connected (Sprint 15)
- [ ] SaaS findings in security dashboard
- [ ] OAuth app inventory available
- [ ] Assets graph includes SaaS apps as nodes
- [ ] CNSP plan tier pricing published
- [ ] Public launch announcement ready

## Definition of Done
- [ ] GitHub, Slack, Google Workspace connectors working
- [ ] SaaS findings surface in dashboard
- [ ] OAuth app inventory populated and actionable
- [ ] SaaS assets appear in attack graph (Sprint 14)
- [ ] Scheduled daily scan via cron
- [ ] All new routes tested (>80% coverage)

## Estimated Effort
| Task | MVP Days | Full Days |
|---|---|---|
| Schema + migration | 0.5 | 0.5 |
| Connector framework + 3 connectors | 2 | 4 |
| API routes | 1 | 2 |
| SaaS posture dashboard | 1.5 | 2 |
| Extended connectors + webhooks | — | 1.5 |
| **Total** | **5** | **10** |
