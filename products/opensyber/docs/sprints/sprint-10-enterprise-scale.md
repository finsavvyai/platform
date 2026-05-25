> **HISTORICAL:** This sprint doc reflects technology choices at time of writing. Auth migrated from Clerk to Auth.js (March 2026). Compute migrated from Fly.io to Hetzner Cloud. Pricing tiers updated. See `CLAUDE.md` for current stack.

# Sprint 10: Enterprise — Hardening, Scale & Launch (2 weeks)

## Goal
OpenSyber is enterprise-ready: SLA monitoring, data residency controls,
API versioning, extended notifications, plan enforcement, and a
complete security audit. Ready for enterprise sales.

## Dependencies
- Sprint 9 complete (SSO, admin, compliance export)

## Tasks

### 10.1 SLA Monitoring & Uptime Tracking
- [ ] Create D1 migration:
  ```sql
  CREATE TABLE uptime_records (
    id TEXT PRIMARY KEY,
    instanceId TEXT NOT NULL REFERENCES instances(id),
    checkedAt TEXT NOT NULL,
    status TEXT NOT NULL, -- 'up', 'down', 'degraded'
    responseTimeMs INTEGER,
    checkType TEXT NOT NULL -- 'health', 'ping', 'agent'
  );

  CREATE TABLE sla_configs (
    id TEXT PRIMARY KEY,
    orgId TEXT NOT NULL REFERENCES organizations(id),
    targetUptime REAL NOT NULL DEFAULT 99.9,
    checkIntervalMinutes INTEGER NOT NULL DEFAULT 5,
    alertOnBreach INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL
  );
  ```
- [ ] Create `apps/api/src/services/uptime.ts` (< 200 lines):
  - `recordCheck(instanceId, status, responseTimeMs)`
  - `getUptime(instanceId, period)` → percentage (e.g., 99.95%)
  - `getDowntimeEvents(instanceId, period)` → list of outages
  - `checkSlaBreaches(orgId)` → alerts if below target
- [ ] Add uptime check to hourly cron:
  - Ping each running instance's health endpoint
  - Record result in `uptime_records`
  - If down → create alert, notify via channels
- [ ] Write tests for uptime calculation and breach detection

#### SLA Dashboard
- [ ] Create `components/dashboard/security/UptimeChart.tsx`:
  - 90-day uptime bar chart (green/red per day)
  - Overall percentage display (e.g., "99.97%")
  - Incident timeline below chart
- [ ] Create `app/dashboard/security/uptime/page.tsx`:
  - Current uptime percentage
  - SLA target configuration (admin/owner only)
  - Downtime event history
- [ ] Add "Uptime" nav item to security sidebar
- [ ] Write component tests

### 10.2 Data Residency Controls
- [ ] Create D1 migration:
  ```sql
  CREATE TABLE data_residency_configs (
    id TEXT PRIMARY KEY,
    orgId TEXT UNIQUE NOT NULL REFERENCES organizations(id),
    region TEXT NOT NULL, -- 'eu', 'us', 'ap'
    storageRegion TEXT NOT NULL, -- where data is stored
    computeRegion TEXT NOT NULL, -- where agents run
    enforceStrict INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );
  ```
- [ ] Enforce compute region on instance creation:
  - If org has residency config → only allow matching regions
  - EU: eu-central only
  - US: us-east, us-west only
  - AP: ap-southeast only
- [ ] Add residency badge to instance cards (flag emoji + region)
- [ ] Create `app/dashboard/team/residency/page.tsx`:
  - Region selection with compliance explanation
  - Warning: cannot move existing instances
- [ ] Write tests for residency enforcement

### 10.3 Extended Notification Channels
- [ ] Add PagerDuty integration:
  - `channelType: 'pagerduty'`
  - Config: routing key, severity mapping
  - Send via PagerDuty Events API v2
- [ ] Add OpsGenie integration:
  - `channelType: 'opsgenie'`
  - Config: API key, team, priority mapping
  - Send via OpsGenie Alert API
- [ ] Add Microsoft Teams integration:
  - `channelType: 'teams'`
  - Config: webhook URL
  - Send via Teams Incoming Webhook (Adaptive Cards)
- [ ] Add Discord integration:
  - `channelType: 'discord'`
  - Config: webhook URL
  - Send via Discord webhook API (embeds)
- [ ] Update `CreateNotificationChannelForm` with new channel types
- [ ] Write tests for each notification provider

### 10.4 API Versioning
- [ ] Create `apps/api/src/routes/v1/` directory:
  - Move all current routes into v1 namespace
  - Mount at `/api/v1/*`
- [ ] Keep `/api/*` as alias to `/api/v1/*` for backward compat
- [ ] Add `API-Version` response header
- [ ] Add deprecation headers for future v2 migration
- [ ] Update all proxy routes in web app to use `/api/v1/`
- [ ] Update all agent API calls to use `/api/v1/`
- [ ] Write tests verifying both paths work

### 10.5 Plan Enforcement (Complete)
- [ ] Enforce `verifiedSkillLimit` on skill installation:
  - Free: max 3 verified skills
  - Personal: max 10
  - Pro/Team: unlimited
- [ ] Enforce `allowUnverifiedSkills`:
  - Free/Personal: reject unverified skill installs
  - Pro/Team: allow with warning
- [ ] Enforce `securityDashboard` tier:
  - `basic`: hide advanced pages (compliance, threats, network)
  - `full`: show everything
  - `full+audit`: show everything + audit export
- [ ] Enforce `auditLogRetentionDays` in cron:
  - Delete old entries per plan
- [ ] Add upgrade prompts on locked features:
  - "Upgrade to Pro to access compliance reports"
  - Link to pricing/checkout
- [ ] Write tests for all plan limit checks

### 10.6 Security Audit
- [ ] Review all API routes for auth bypass:
  - Every route must check Clerk auth or gateway token
  - Badge routes: add optional auth or rate limit
- [ ] Review all DB queries for injection:
  - All must use Drizzle parameterized queries
  - No raw SQL string concatenation
- [ ] Review all user inputs for validation:
  - Zod schemas on all POST/PATCH request bodies
  - String length limits on all text fields
  - Sanitize HTML in any user-generated content
- [ ] Add request body size limits:
  - Default: 1MB max request body
  - Skill upload: 10MB max
- [ ] Add CORS lockdown:
  - Production: only `opensyber.cloud` and `tokenforge.dev`
  - Dev: `localhost:*`
- [ ] Security headers on all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000`
  - `Content-Security-Policy: default-src 'self'`
- [ ] Write security-focused tests

### 10.7 Scheduled Job Completion
- [ ] Add cron jobs (extend existing hourly cron):
  - Audit log cleanup (retention enforcement per plan)
  - Automatic incident escalation (24h no response → escalate)
  - Subscription payment dunning (3 attempts over 7 days)
  - Gateway token rotation reminder (90-day warning)
  - Uptime checks (ping all running instances)
  - Usage metric aggregation (for TokenForge billing)
- [ ] Write tests for each cron job handler

### 10.8 Enterprise Pricing & Sales Page
- [ ] Add Enterprise plan to pricing:
  - Custom pricing, "Contact Sales" CTA
  - Features: unlimited instances, SAML SSO, dedicated support,
    custom SLA, data residency, compliance exports, admin panel
- [ ] Create `/enterprise` page:
  - Enterprise value proposition
  - Security certifications and compliance
  - Customer logos (placeholder)
  - Contact form → sends to sales@opensyber.cloud
- [ ] Create enterprise contact form handler:
  - POST `/api/enterprise/contact`
  - Sends email to internal team via Resend
  - Stores lead in D1 `enterprise_leads` table
- [ ] Write tests for contact form

## Definition of Done
- [ ] SLA monitoring active with uptime tracking
- [ ] Data residency enforced per organization
- [ ] 7 notification channels supported (email, webhook, Slack, PagerDuty, OpsGenie, Teams, Discord)
- [ ] API versioned at `/api/v1/`
- [ ] All plan limits enforced everywhere
- [ ] Security audit complete with all findings fixed
- [ ] All cron jobs running and tested
- [ ] Enterprise pricing page live
- [ ] Full E2E test: enterprise customer journey
- [ ] All new code has tests (>80% coverage)

## Estimated Effort
| Task | Days |
|---|---|
| 10.1 SLA monitoring | 2 |
| 10.2 Data residency | 1 |
| 10.3 Extended notifications | 2 |
| 10.4 API versioning | 1 |
| 10.5 Plan enforcement | 1 |
| 10.6 Security audit | 1 |
| 10.7 Cron jobs | 1 |
| 10.8 Enterprise page | 1 |
| **Total** | **10 days** |
