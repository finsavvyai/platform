# TenantIQ — Sprint Plan: Gap Closure Roadmap

> **Source**: Gap Analysis Report (April 2026)
> **Sprints**: 5–12 (continuing from Iteration 4)
> **Timeline**: April 2026 – January 2027
> **Sprint Duration**: 2 weeks each
> **Goal**: Close all competitive gaps identified in the gap analysis, achieve Series A readiness

---

## Sprint Overview

| Sprint | Dates | Theme | Priority | Key Deliverable |
|--------|-------|-------|----------|-----------------|
| Sprint 5 | Apr 7 – Apr 18 | PSA/RMM Integration — ConnectWise | P1 | ConnectWise Manage bi-directional sync |
| Sprint 6 | Apr 21 – May 2 | PSA/RMM Integration — Datto + Kaseya | P1 | Datto Autotask + Kaseya BMS connectors |
| Sprint 7 | May 5 – May 16 | CIS Controls Expansion (Batch 1) | P1 | 50 new CIS controls (Identity, Data Protection) |
| Sprint 8 | May 19 – May 30 | CIS Controls Expansion (Batch 2) | P1 | 50 more CIS controls (Device, Email, Cloud Apps) |
| Sprint 9 | Jun 2 – Jun 13 | Visual Workflow Builder | P1 | Drag-and-drop builder + 20 templates |
| Sprint 10 | Jun 16 – Jun 27 | White-Label + Config-as-Code | P2 | White-label for Pro tier + GitOps export |
| Sprint 11 | Jun 30 – Jul 11 | Data Backup (Exchange, SPO, Teams) | P2 | Backup engine + restore UI + scheduling |
| Sprint 12 | Jul 14 – Jul 25 | Partner Marketplace + Mobile + Polish | P3 | Partner API, mobile PWA, phishing sim, SPO lifecycle |

---

## Sprint 5 — PSA/RMM Integration: ConnectWise

**Dates**: April 7 – April 18, 2026
**Priority**: P1 — CRITICAL (blocks MSP channel adoption)
**Theme**: Connect TenantIQ to the MSP's core business system

### Why This Is First
Without PSA/RMM integration, MSPs must manually reconcile TenantIQ data with their billing and ticketing systems. Every competitor targeting MSPs (CoreView, Rewst, Augmentt, Liongard) has at least one PSA integration. This is the single biggest adoption blocker.

### Tasks

#### Week 1 — ConnectWise Manage API Integration

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 5.1 | Research ConnectWise Manage REST API v2021.1+, obtain sandbox credentials, document auth flow (client_id + API keys) | `docs/integrations/connectwise.md` | 4h |
| 5.2 | Create ConnectWise API client wrapper with auth, pagination, rate-limit handling, retry logic | `packages/integrations/src/connectwise/client.ts` | 6h |
| 5.3 | Implement Company sync: map TenantIQ tenants ↔ CW Companies (bi-directional, ID mapping table) | `packages/integrations/src/connectwise/company-sync.ts` | 6h |
| 5.4 | Implement Ticket creation: TenantIQ alerts → CW Service Tickets (severity mapping, custom fields, notes) | `packages/integrations/src/connectwise/ticket-sync.ts` | 6h |
| 5.5 | Create D1 migration: `integrations` table (org_id, provider, config_encrypted, mapping_data, last_sync, status) | `packages/db/migrations/0016_integrations.sql` | 3h |
| 5.6 | Create D1 migration: `integration_mappings` table (integration_id, local_id, remote_id, entity_type, synced_at) | `packages/db/migrations/0017_integration_mappings.sql` | 2h |
| 5.7 | Add API routes: `POST /api/integrations/connectwise/connect`, `GET /status`, `POST /sync`, `DELETE /disconnect` | `apps/api/src/routes/integrations-connectwise.ts` | 6h |

#### Week 2 — UI, Agreement Sync, Testing

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 5.8 | Implement Agreement sync: TenantIQ billing data → CW Agreements (for MSP billing reconciliation) | `packages/integrations/src/connectwise/agreement-sync.ts` | 6h |
| 5.9 | Create ConnectWise settings page: connection wizard, field mapping UI, sync status dashboard | `apps/web/src/routes/settings/integrations/connectwise/+page.svelte` | 8h |
| 5.10 | Create integration status component: sync history, error log, manual re-sync button, health indicator | `apps/web/src/lib/components/integrations/IntegrationStatus.svelte` | 4h |
| 5.11 | Add cron job: scheduled ConnectWise sync (every 15 min for tickets, hourly for companies/agreements) | `apps/api/src/cron/connectwise-sync.ts` | 4h |
| 5.12 | Create webhook receiver: CW → TenantIQ callback for real-time ticket updates | `apps/api/src/routes/webhooks-connectwise.ts` | 4h |
| 5.13 | Write unit tests (client, sync logic, mapping) + integration tests (API endpoints) | `apps/api/src/test/connectwise/` | 6h |
| 5.14 | Add ConnectWise to integrations hub page: card, logo, description, connect CTA | `apps/web/src/routes/settings/integrations/+page.svelte` | 2h |

### Acceptance Criteria
- [ ] ConnectWise Manage API authenticated and connected via settings UI
- [ ] TenantIQ tenants mapped to CW Companies (bi-directional sync)
- [ ] TenantIQ alerts auto-create CW Service Tickets with severity mapping
- [ ] Billing data syncs to CW Agreements for MSP revenue tracking
- [ ] Scheduled sync runs every 15 min (tickets) and hourly (companies)
- [ ] Webhook receives real-time CW updates
- [ ] All tests passing (unit + integration), 90%+ coverage on new code
- [ ] Integration hub page shows ConnectWise card with status

### Schema Changes
```sql
-- 0016_integrations.sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL, -- 'connectwise' | 'datto' | 'kaseya'
  config_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted API credentials
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | error | disconnected
  last_sync_at TEXT,
  sync_interval_minutes INTEGER DEFAULT 60,
  metadata TEXT, -- JSON: company_id, site_url, etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 0017_integration_mappings.sql
CREATE TABLE integration_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  entity_type TEXT NOT NULL, -- 'tenant' | 'alert' | 'user' | 'agreement'
  local_id TEXT NOT NULL,
  remote_id TEXT NOT NULL,
  remote_name TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(integration_id, entity_type, local_id)
);
```

---

## Sprint 6 — PSA/RMM Integration: Datto Autotask + Kaseya BMS

**Dates**: April 21 – May 2, 2026
**Priority**: P1 — CRITICAL
**Theme**: Complete PSA coverage for the top 3 MSP platforms

### Why
ConnectWise covers ~40% of MSPs. Datto Autotask covers ~30%, Kaseya BMS ~15%. Together these three platforms cover 85%+ of the MSP market. Shipping all three in a single sprint is feasible because the integration patterns from Sprint 5 are reusable.

### Tasks

#### Week 1 — Datto Autotask

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 6.1 | Research Datto Autotask REST API v1.6, document auth (API user + tracking ID), entity schema | `docs/integrations/datto-autotask.md` | 3h |
| 6.2 | Create Datto API client wrapper (auth, pagination, query filters, zone URLs) | `packages/integrations/src/datto/client.ts` | 5h |
| 6.3 | Implement Account sync: TenantIQ tenants ↔ Autotask Accounts | `packages/integrations/src/datto/account-sync.ts` | 5h |
| 6.4 | Implement Ticket creation: alerts → Autotask Tickets (queue mapping, priority, resources) | `packages/integrations/src/datto/ticket-sync.ts` | 5h |
| 6.5 | Implement Contract sync: billing → Autotask Contracts | `packages/integrations/src/datto/contract-sync.ts` | 5h |
| 6.6 | Add API routes: `/api/integrations/datto/*` (connect, status, sync, disconnect) | `apps/api/src/routes/integrations-datto.ts` | 5h |
| 6.7 | Create Datto settings page with connection wizard and field mapping | `apps/web/src/routes/settings/integrations/datto/+page.svelte` | 6h |

#### Week 2 — Kaseya BMS + Shared Integration Framework

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 6.8 | Research Kaseya BMS API, document auth flow and entity model | `docs/integrations/kaseya-bms.md` | 3h |
| 6.9 | Create Kaseya API client wrapper | `packages/integrations/src/kaseya/client.ts` | 5h |
| 6.10 | Implement Account + Ticket + Contract sync for Kaseya | `packages/integrations/src/kaseya/sync.ts` | 8h |
| 6.11 | Add API routes: `/api/integrations/kaseya/*` | `apps/api/src/routes/integrations-kaseya.ts` | 4h |
| 6.12 | Create Kaseya settings page | `apps/web/src/routes/settings/integrations/kaseya/+page.svelte` | 5h |
| 6.13 | Refactor: Extract shared integration base class (auth, sync, mapping, error handling) for DRY across all 3 PSAs | `packages/integrations/src/base/integration-provider.ts` | 6h |
| 6.14 | Add cron jobs for Datto + Kaseya sync (same intervals as CW) | `apps/api/src/cron/datto-sync.ts`, `kaseya-sync.ts` | 3h |
| 6.15 | Write unit + integration tests for both Datto and Kaseya | `apps/api/src/test/datto/`, `apps/api/src/test/kaseya/` | 6h |
| 6.16 | Update integrations hub page: add Datto + Kaseya cards | `apps/web/src/routes/settings/integrations/+page.svelte` | 2h |

### Acceptance Criteria
- [ ] Datto Autotask fully connected: accounts ↔ tenants, alerts → tickets, billing → contracts
- [ ] Kaseya BMS fully connected with same feature set
- [ ] Shared base integration class extracted (DRY principle)
- [ ] All 3 PSA integrations visible in integrations hub with status indicators
- [ ] Cron sync running for all 3 on schedule
- [ ] Tests passing, 90%+ coverage on new code
- [ ] Documentation complete for all 3 integrations

---

## Sprint 7 — CIS Controls Expansion (Batch 1: 50 Controls)

**Dates**: May 5 – May 16, 2026
**Priority**: P1 — HIGH (marketing claims 100+, only 18 implemented)
**Theme**: Close the credibility gap — Identity, Access, and Data Protection controls

### Why
The landing page says "100+ Controls." Only 18 are implemented. This is a credibility risk for sales conversations and demo walkthroughs. Splitting into 2 batches (50 each) makes this manageable.

### Tasks

#### Week 1 — Identity & Access Management Controls (25 controls)

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 7.1 | Define 25 Identity & Access CIS controls: MFA enforcement variations, CA policy checks, admin role limits, sign-in risk policies, PIM configuration, session management, password policies | `apps/api/src/lib/cis/controls-identity.ts` | 8h |
| 7.2 | Implement Graph API queries for each control: Conditional Access evaluation, Authentication Methods, Identity Protection, PIM roles | `apps/api/src/lib/cis/evaluators-identity.ts` | 10h |
| 7.3 | Create remediation steps for each control (human-readable + auto-remediation where possible) | `apps/api/src/lib/cis/remediation-identity.ts` | 6h |
| 7.4 | Add control metadata: CIS section references, severity levels, MITRE ATT&CK mapping | `apps/api/src/lib/cis/metadata-identity.ts` | 4h |
| 7.5 | Write table-driven unit tests for all 25 identity controls | `apps/api/src/test/cis/identity-controls.test.ts` | 6h |

#### Week 2 — Data Protection Controls (25 controls)

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 7.6 | Define 25 Data Protection CIS controls: DLP policies, sensitivity labels, external sharing, retention, eDiscovery, information barriers, Purview compliance | `apps/api/src/lib/cis/controls-data.ts` | 8h |
| 7.7 | Implement Graph API + Security & Compliance Center queries for each control | `apps/api/src/lib/cis/evaluators-data.ts` | 10h |
| 7.8 | Create remediation steps for data protection controls | `apps/api/src/lib/cis/remediation-data.ts` | 5h |
| 7.9 | Update CIS scan engine to load new controls, handle new Graph API scopes | `apps/api/src/lib/cis/control-engine.ts` | 4h |
| 7.10 | Update CIS benchmark UI: category filtering, expanded section view, new control cards | `apps/web/src/routes/security/cis/+page.svelte` | 6h |
| 7.11 | Update CIS score calculation: weighted scoring across all categories | `apps/api/src/lib/cis/scoring.ts` | 3h |
| 7.12 | Write table-driven unit tests for all 25 data protection controls | `apps/api/src/test/cis/data-controls.test.ts` | 6h |
| 7.13 | Update Graph API permissions documentation for new scopes required | `docs/permissions.md` | 2h |

### Acceptance Criteria
- [ ] 68 total CIS controls operational (18 existing + 50 new)
- [ ] Each control has: evaluation logic, remediation steps, severity level, CIS section reference
- [ ] CIS benchmark page shows new controls with filtering by category
- [ ] Score calculation updated with weighted categories
- [ ] Graph API permissions documented for all new scopes
- [ ] 100% of new controls have table-driven unit tests

---

## Sprint 8 — CIS Controls Expansion (Batch 2: 50 Controls)

**Dates**: May 19 – May 30, 2026
**Priority**: P1 — HIGH
**Theme**: Complete 100+ CIS controls — Device Management, Email, Cloud Apps, Audit

### Tasks

#### Week 1 — Device Management + Email Security (25 controls)

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 8.1 | Define 13 Device Management controls: Intune enrollment, compliance policies, BitLocker, Windows Hello, MDM authority, device encryption, update rings | `apps/api/src/lib/cis/controls-device.ts` | 6h |
| 8.2 | Define 12 Email & Collaboration controls: anti-phishing policies, safe links, safe attachments, DKIM/DMARC/SPF, transport rules, external forwarding, Teams meeting policies | `apps/api/src/lib/cis/controls-email.ts` | 6h |
| 8.3 | Implement Graph + Exchange Online evaluators for all 25 controls | `apps/api/src/lib/cis/evaluators-device.ts`, `evaluators-email.ts` | 12h |
| 8.4 | Create remediation steps for device + email controls | `apps/api/src/lib/cis/remediation-device.ts`, `remediation-email.ts` | 6h |
| 8.5 | Write tests for device + email controls | `apps/api/src/test/cis/device-controls.test.ts`, `email-controls.test.ts` | 6h |

#### Week 2 — Cloud Apps + Audit + Final Integration (25 controls)

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 8.6 | Define 13 Cloud Application controls: app registrations, OAuth consent, enterprise apps, service principals, API permissions, app proxy | `apps/api/src/lib/cis/controls-apps.ts` | 6h |
| 8.7 | Define 12 Audit & Logging controls: unified audit log, mailbox auditing, sign-in log retention, diagnostic settings, alert policies, activity alerts | `apps/api/src/lib/cis/controls-audit.ts` | 6h |
| 8.8 | Implement evaluators for all 25 controls | `apps/api/src/lib/cis/evaluators-apps.ts`, `evaluators-audit.ts` | 10h |
| 8.9 | Create remediation steps | `apps/api/src/lib/cis/remediation-apps.ts`, `remediation-audit.ts` | 5h |
| 8.10 | Refactor CIS control loader: dynamic control registry, lazy loading by category, caching | `apps/api/src/lib/cis/control-registry.ts` | 4h |
| 8.11 | Update CIS UI: 6 category tabs (Identity, Data, Device, Email, Apps, Audit), summary donut chart, export per-category | `apps/web/src/routes/security/cis/+page.svelte` | 6h |
| 8.12 | Update CIS PDF export to include all 118 controls | `apps/api/src/routes/cis-benchmark-export.ts` | 3h |
| 8.13 | Write tests for apps + audit controls | `apps/api/src/test/cis/apps-controls.test.ts`, `audit-controls.test.ts` | 6h |
| 8.14 | End-to-end test: full CIS scan across all 118 controls | `tests/e2e/cis-full-scan.e2e.test.ts` | 4h |

### Acceptance Criteria
- [ ] 118 total CIS controls operational (18 + 50 + 50)
- [ ] 6 categories fully covered: Identity, Data, Device, Email, Apps, Audit
- [ ] CIS page has category tabs with per-category scores
- [ ] PDF export includes all controls with pass/fail/remediation
- [ ] All controls have table-driven unit tests
- [ ] Full end-to-end CIS scan test passing
- [ ] Marketing can truthfully claim "100+ CIS controls"

---

## Sprint 9 — Visual Workflow Builder

**Dates**: June 2 – June 13, 2026
**Priority**: P1 — HIGH (Rewst has 120+ templates, TenantIQ has 4)
**Theme**: Transform from 4 hardcoded workflows to a flexible visual builder

### Tasks

#### Week 1 — Workflow Engine + Template Library

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 9.1 | Design workflow DSL: steps (action, condition, loop, delay, approval), connectors (Graph, alert, notification), trigger types (schedule, event, manual, AI) | `packages/shared/src/types/workflow-dsl.ts` | 6h |
| 9.2 | Build workflow execution engine: step runner, condition evaluator, loop handler, error recovery, audit trail | `apps/api/src/lib/workflows/engine.ts` | 10h |
| 9.3 | Create 10 license management templates: reclaim unused, downgrade E5→E3, remove departed, bulk assign, trial expiry, overage alert, monthly reconciliation, optimization report, audit license changes, cost allocation | `apps/api/src/lib/workflows/templates/license/` | 8h |
| 9.4 | Create 5 security templates: disable risky user, force MFA enrollment, block legacy auth, revoke app consent, quarantine compromised mailbox | `apps/api/src/lib/workflows/templates/security/` | 5h |
| 9.5 | Create 5 user lifecycle templates: onboard new user, offboard departing, convert guest to member, bulk password reset, inactive user cleanup | `apps/api/src/lib/workflows/templates/lifecycle/` | 5h |

#### Week 2 — Visual Builder UI + Testing

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 9.6 | Build visual workflow canvas component: drag-and-drop nodes, connection lines, zoom/pan, mini-map | `apps/web/src/lib/components/workflows/WorkflowCanvas.svelte` | 10h |
| 9.7 | Build step configuration panel: step type selector, parameter forms, condition builder, output mapping | `apps/web/src/lib/components/workflows/StepConfig.svelte` | 6h |
| 9.8 | Build workflow template gallery: search, filter by category, preview, one-click install | `apps/web/src/routes/workflows/templates/+page.svelte` | 5h |
| 9.9 | Create 5 governance templates: empty group cleanup, guest access review, sharing link audit, Teams policy enforcement, SPO permission audit | `apps/api/src/lib/workflows/templates/governance/` | 5h |
| 9.10 | Add API routes: `POST /api/workflows/create`, `PUT /update`, `POST /execute`, `GET /runs`, `POST /clone` | `apps/api/src/routes/workflows-v2.ts` | 6h |
| 9.11 | Add workflow versioning: save versions, compare diffs, rollback to previous | `apps/api/src/lib/workflows/versioning.ts` | 4h |
| 9.12 | Write unit tests for workflow engine + all 25 templates | `apps/api/src/test/workflows/` | 8h |
| 9.13 | E2E test: create workflow from template → configure → dry-run → execute → verify result | `tests/e2e/workflow-builder.e2e.test.ts` | 4h |

### Acceptance Criteria
- [ ] Visual drag-and-drop workflow builder operational
- [ ] 25 pre-built templates across 4 categories (license, security, lifecycle, governance)
- [ ] Workflow DSL supports: actions, conditions, loops, delays, approvals
- [ ] Template gallery with search, filter, preview, one-click install
- [ ] Workflow versioning with rollback
- [ ] Dry-run mode on all workflows
- [ ] All templates have unit tests, E2E test passing

---

## Sprint 10 — White-Label + Configuration-as-Code

**Dates**: June 16 – June 27, 2026
**Priority**: P2 — MEDIUM
**Theme**: Enterprise features that unlock new revenue streams

### Tasks

#### Week 1 — White-Label for Professional Tier

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 10.1 | Create branding configuration schema: logo, favicon, primary/secondary colors, company name, custom domain, email sender name | `packages/shared/src/types/branding.ts` | 3h |
| 10.2 | Add branding table to D1: `org_branding` (org_id, logo_url, favicon_url, colors_json, custom_domain, email_from) | `packages/db/migrations/0018_org_branding.sql` | 2h |
| 10.3 | Build branding API routes: `GET /api/branding`, `PUT /api/branding`, `POST /api/branding/logo` (R2 upload) | `apps/api/src/routes/branding.ts` | 5h |
| 10.4 | Implement CSS variable injection: load org branding at app init, override design system tokens | `apps/web/src/lib/stores/branding.ts` | 4h |
| 10.5 | Build branding settings page: logo upload, color picker, domain config, preview pane | `apps/web/src/routes/settings/branding/+page.svelte` | 8h |
| 10.6 | Update email templates to use org branding (logo, colors, sender name) | `apps/api/src/lib/email/templates.ts` | 4h |
| 10.7 | Update PDF report headers to use org branding | `apps/api/src/routes/executive-report-pdf.ts` | 3h |
| 10.8 | Add custom domain support via Cloudflare for SaaS (CNAME validation + SSL) | `apps/api/src/routes/branding-domain.ts` | 6h |

#### Week 2 — Configuration-as-Code (GitOps)

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 10.9 | Design config export schema: JSON/YAML representation of M365 config (CA policies, auth methods, security defaults, DLP rules, retention) | `packages/shared/src/types/config-export.ts` | 4h |
| 10.10 | Build config export engine: read current config from Graph API → serialize to structured JSON/YAML | `apps/api/src/lib/config-export/exporter.ts` | 8h |
| 10.11 | Build config import engine: read JSON/YAML → validate → diff against current state → apply changes with dry-run | `apps/api/src/lib/config-export/importer.ts` | 8h |
| 10.12 | Add API routes: `POST /api/config/export`, `POST /api/config/import`, `POST /api/config/diff`, `POST /api/config/apply` | `apps/api/src/routes/config-export.ts` | 5h |
| 10.13 | Build config export UI: select categories, preview JSON, download, copy-to-clipboard | `apps/web/src/routes/backups/export/+page.svelte` | 5h |
| 10.14 | Build config import UI: upload JSON/YAML, diff viewer (side-by-side), approve changes, apply with dry-run | `apps/web/src/routes/backups/import/+page.svelte` | 6h |
| 10.15 | Add Git integration: push config to GitHub/GitLab repo on schedule (optional) | `apps/api/src/lib/config-export/git-push.ts` | 6h |
| 10.16 | Write tests for export/import/diff engine | `apps/api/src/test/config-export/` | 5h |

### Acceptance Criteria
- [ ] White-label branding available on Professional + Enterprise tiers
- [ ] Custom logo, colors, domain, email sender name configurable
- [ ] PDF reports and emails reflect org branding
- [ ] Config export produces valid JSON/YAML of full M365 state
- [ ] Config import with diff viewer and dry-run before applying
- [ ] Optional Git push to GitHub/GitLab on schedule
- [ ] Tests passing, branding preview functional

---

## Sprint 11 — Data Backup (Exchange, SharePoint, Teams)

**Dates**: June 30 – July 11, 2026
**Priority**: P2 — HIGH (CoreView and Hornetsecurity both have this)
**Theme**: Complete data protection story beyond configuration backup

### Tasks

#### Week 1 — Backup Engine + Exchange

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 11.1 | Design backup architecture: incremental backup via Graph API (delta queries), storage in R2, per-tenant encryption (AES-256-GCM), retention policies | `docs/architecture/backup-engine.md` | 4h |
| 11.2 | Build backup orchestrator: schedule manager, job queue, progress tracking, error recovery | `apps/api/src/lib/backup/orchestrator.ts` | 8h |
| 11.3 | Implement Exchange backup: mailbox export via Graph API (messages, folders, attachments), incremental using delta tokens | `apps/api/src/lib/backup/exchange-backup.ts` | 10h |
| 11.4 | Implement Exchange restore: select mailbox → select date range → restore to original or alternate location | `apps/api/src/lib/backup/exchange-restore.ts` | 8h |
| 11.5 | Add D1 migrations: `backup_jobs` table (id, org_id, tenant_id, type, status, items_count, size_bytes, started_at, completed_at, error), `backup_items` table | `packages/db/migrations/0019_backup_jobs.sql` | 3h |
| 11.6 | Add API routes: `POST /api/backups/start`, `GET /api/backups/jobs`, `POST /api/backups/restore`, `GET /api/backups/browse` | `apps/api/src/routes/backup-data.ts` | 6h |

#### Week 2 — SharePoint + Teams + UI

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 11.7 | Implement SharePoint backup: site collections, document libraries, lists, pages via Graph API delta queries | `apps/api/src/lib/backup/sharepoint-backup.ts` | 8h |
| 11.8 | Implement Teams backup: channel messages, files, tabs, wiki via Graph API | `apps/api/src/lib/backup/teams-backup.ts` | 8h |
| 11.9 | Implement restore for SharePoint + Teams | `apps/api/src/lib/backup/sharepoint-restore.ts`, `teams-restore.ts` | 8h |
| 11.10 | Build backup dashboard: job history, storage usage, schedule config, restore wizard | `apps/web/src/routes/backups/data/+page.svelte` | 8h |
| 11.11 | Build restore wizard: browse backup → select items → choose destination → preview → execute | `apps/web/src/lib/components/backups/RestoreWizard.svelte` | 6h |
| 11.12 | Add backup scheduling cron: configurable per tenant (daily/weekly), retention policies (30/60/90 days) | `apps/api/src/cron/data-backup.ts` | 4h |
| 11.13 | Write tests for backup engine, all 3 providers, restore logic | `apps/api/src/test/backup/` | 6h |

### Acceptance Criteria
- [ ] Exchange mailbox backup + restore operational (incremental, encrypted)
- [ ] SharePoint site backup + restore operational
- [ ] Teams channel backup + restore operational
- [ ] Backup dashboard shows job history, storage usage, health
- [ ] Restore wizard with browse → select → preview → execute
- [ ] Scheduling: daily/weekly per tenant with configurable retention
- [ ] Per-tenant AES-256-GCM encryption in R2
- [ ] Tests passing

---

## Sprint 12 — Partner Marketplace + Mobile + Final Polish

**Dates**: July 14 – July 25, 2026
**Priority**: P3 — NICE TO HAVE
**Theme**: Ecosystem, mobile access, and competitive feature parity

### Tasks

#### Week 1 — Partner Marketplace + API

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 12.1 | Design partner API: OAuth2 client credentials flow, scoped permissions, rate limiting, webhook subscriptions | `docs/api/partner-api.md` | 4h |
| 12.2 | Build partner registration + API key management | `apps/api/src/routes/partners.ts` | 6h |
| 12.3 | Build partner SDK (TypeScript): auth, tenants, alerts, workflows, reports | `packages/partner-sdk/src/` | 8h |
| 12.4 | Create partner marketplace page: browse integrations, install, configure, rate | `apps/web/src/routes/marketplace/partners/+page.svelte` | 6h |
| 12.5 | Implement phishing simulation: email templates, campaign scheduling, click tracking, report generation | `apps/api/src/lib/phishing/` | 8h |
| 12.6 | Build phishing simulation UI: create campaign, select templates, target users, view results | `apps/web/src/routes/security/phishing/+page.svelte` | 6h |

#### Week 2 — Mobile PWA + SharePoint Lifecycle + Final Polish

| # | Task | File(s) | Est |
|---|------|---------|-----|
| 12.7 | Convert web app to installable PWA: service worker, manifest, offline indicators, push notifications | `apps/web/static/manifest.json`, `apps/web/src/service-worker.ts` | 6h |
| 12.8 | Optimize mobile layouts: responsive breakpoints for all dashboard pages, touch-friendly controls | `apps/web/src/app.css` (responsive rules) | 6h |
| 12.9 | Build mobile-optimized alert view: swipe actions (acknowledge, snooze, escalate) | `apps/web/src/lib/components/mobile/AlertCard.svelte` | 4h |
| 12.10 | Implement SharePoint site lifecycle: creation policies, expiration, archival, renewal notifications | `apps/api/src/lib/governance/site-lifecycle.ts` | 6h |
| 12.11 | Build site lifecycle UI: site inventory, expiration calendar, bulk actions, policy editor | `apps/web/src/routes/governance/sites/+page.svelte` | 5h |
| 12.12 | Final integration tests across all Sprint 5-12 features | `tests/e2e/gap-closure-regression.e2e.test.ts` | 6h |
| 12.13 | Update landing page: PSA integrations, 118 CIS controls, workflow builder, backup, marketplace | `apps/web/src/routes/(marketing)/+page.svelte` | 4h |
| 12.14 | Update CHANGELOG.md with all Sprint 5-12 features as v1.0.0 | `CHANGELOG.md` | 2h |

### Acceptance Criteria
- [ ] Partner API with OAuth2, SDK published
- [ ] Partner marketplace page operational
- [ ] Phishing simulation: create campaigns, track clicks, generate reports
- [ ] PWA installable on mobile with push notifications
- [ ] Mobile-optimized dashboard layouts for all key pages
- [ ] SharePoint site lifecycle management operational
- [ ] Landing page updated with all new features
- [ ] CHANGELOG updated as v1.0.0
- [ ] Full regression E2E suite passing

---

## Resource Estimates Summary

| Sprint | Theme | Dev Hours | New Files (est.) | New Tests (est.) |
|--------|-------|-----------|------------------|------------------|
| Sprint 5 | ConnectWise PSA | ~56h | ~15 | ~40 |
| Sprint 6 | Datto + Kaseya PSA | ~52h | ~18 | ~35 |
| Sprint 7 | CIS Batch 1 (50 controls) | ~64h | ~12 | ~100 |
| Sprint 8 | CIS Batch 2 (50 controls) | ~60h | ~14 | ~100 |
| Sprint 9 | Workflow Builder | ~63h | ~20 | ~50 |
| Sprint 10 | White-Label + GitOps | ~61h | ~16 | ~30 |
| Sprint 11 | Data Backup | ~69h | ~14 | ~40 |
| Sprint 12 | Marketplace + Mobile + Polish | ~61h | ~16 | ~30 |
| **Total** | | **~486h** | **~125 files** | **~425 tests** |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| ConnectWise API sandbox access delayed | Sprint 5 blocked | Medium | Apply for sandbox early, use mock API for development |
| Graph API throttling during CIS scan (100+ controls) | Scan timeout | High | Implement batch evaluation, caching, exponential backoff |
| Workflow builder UI complexity exceeds estimate | Sprint 9 delayed | Medium | Ship basic builder first, add advanced features in follow-up |
| R2 storage costs for data backup | Budget overrun | Low | Implement retention policies, compress before upload, tier pricing |
| Exchange backup via Graph API rate limits | Backup incomplete | High | Use delta queries, incremental backup, parallel streams with throttle |
| Mobile PWA offline support scope creep | Sprint 12 delayed | Medium | Ship online-only PWA first, add offline in v1.1 |

---

## Definition of Done (All Sprints)

Every sprint must meet these criteria before closing:

- [ ] All tasks completed and merged to main
- [ ] Unit test coverage ≥ 90% on new code
- [ ] No file exceeds 200 lines
- [ ] All API endpoints have Zod validation
- [ ] All DB queries scoped by org_id
- [ ] No TypeScript `any` types
- [ ] JSDoc on all public functions
- [ ] E2E tests passing for critical flows
- [ ] CHANGELOG.md updated
- [ ] Loading skeletons on all new pages
- [ ] Dark mode support on all new components
- [ ] Keyboard navigation on all interactive elements

---

## Post-Sprint 12: What's Next

After completing Sprints 5–12, TenantIQ will have closed all P1/P2/P3 gaps identified in the gap analysis. Remaining opportunities for v1.1+:

- **Multi-SaaS support** (Google Workspace, AWS IAM) — P3, estimated Q1 2027
- **Advanced device management** (Intune deep integration) — P4, estimated Q1 2027
- **AI workflow generation** (describe workflow in natural language → Claude generates it) — innovation sprint
- **SOC integration** (Sentinel, Splunk, PagerDuty escalation) — P3, estimated Q4 2026
- **Compliance certifications** (SOC 2 Type II for TenantIQ itself) — Series A requirement
