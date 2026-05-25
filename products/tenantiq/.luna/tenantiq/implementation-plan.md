# TenantIQ Implementation Plan

**Updated**: 2026-04-03
**Status**: Post-Phase 6 — Stabilization + Strategic Gaps
**Readiness**: 85%

---

## Completed (April 3 session)

- [x] Fix all 21 TypeScript errors (API: jwt-keys, copilot-readiness-pdf, graph-subscriptions; Web: toast warning type, export test types, @testing-library/svelte)
- [x] Install @testing-library/svelte — unblocks 138 frontend unit tests
- [x] Create apps/api/vitest.config.ts — API tests now discoverable (862 passing)
- [x] Fix root vitest.config.ts — remove duplicate web test inclusion
- [x] Add `warning` toast type to `apps/web/src/lib/stores/toast.ts`
- [x] Strategic gap plan created — `.luna/tenantiq/strategic-gap-plan.md`

## Completed (Phases 1-6)

- [x] Enterprise SAML/OIDC SSO — `ssoConnections` DB table, `apps/api/src/routes/sso.ts`, `apps/web/src/routes/settings/sso/+page.svelte`
- [x] Copilot Readiness Assessment — 7-category engine in `apps/api/src/lib/copilot/`, API routes, ScoreRing frontend
- [x] Config Snapshot & Drift Detection — `configDrifts` DB table, `apps/api/src/routes/config-drifts.ts`, drift viewer UI
- [x] Storage Analytics & Quotas — scanner + analyzer, `storageAnalytics` DB table, frontend with tabs
- [x] Admin Panel & Observability — `syncJobs`, `platformMetrics`, `auditLogs` tables, 9 API endpoints in `apps/api/src/routes/platform/`, 7 admin pages
- [x] CI/CD pipeline — `.github/workflows/ci.yml` (lint, typecheck, test, e2e, build, security-scan), `.github/workflows/deploy.yml`
- [x] Custom error page — `apps/web/src/routes/+error.svelte` with 404/403/500 handling
- [x] Health check endpoint — `apps/api/src/routes/health.ts`
- [x] Sentry integration — `apps/api/src/lib/sentry.ts`, `apps/web/src/lib/sentry-client.ts`
- [x] Webhook notifications for Slack/Teams — `apps/api/src/lib/webhook-notify.ts` (format detection for Slack/Teams)
- [x] Auth guard on all protected routes
- [x] Billing fix (wrong auth middleware import)
- [x] Security audit of API routes (Zod validation, auth checks)
- [x] Unit tests for new features (12 test files)
- [x] All TypeScript errors fixed (0 errors on both API and Web)
- [x] 100/100 production QA tests passing

---

## Remaining Gaps Summary

| # | Gap | Severity | Phase |
|---|-----|----------|-------|
| 1 | CI missing SAST (Semgrep), secret scan (TruffleHog), license compliance | Critical | 1 |
| 2 | CI missing coverage enforcement (90% line, 85% branch, 100% critical) | Critical | 1 |
| 3 | Auth still HS256 — needs Clerk RS256 dual-mode migration | High | 1 |
| 4 | 0 frontend unit tests (60+ components untested) | Critical | 2 |
| 5 | Limited E2E coverage (6 spec files vs 127 tests/21 sections target) | High | 2 |
| 6 | No `sync-job-tracker` instrumentation on cron handlers | High | 3 |
| 7 | No scheduled-snapshots cron, no storage-scan cron | High | 3 |
| 8 | Wrangler cron triggers missing drift-detection + storage-scan entries | High | 3 |
| 9 | Notification queue missing Slack/Teams/Discord direct integration | Medium | 3 |
| 10 | Drift suppression rules not in DB schema or API | Medium | 4 |
| 11 | Copilot readiness PDF export not connected to Browser Rendering | Medium | 4 |
| 12 | Copilot usage analytics incomplete (ROI, power users) | Medium | 4 |
| 13 | Storage: missing OneDrive per-user, Exchange mailbox, large file, orphaned content scans | Medium | 4 |
| 14 | Remediation rollback incomplete for all 9 actions | High | 4 |
| 15 | No structured error codes across API | Medium | 5 |
| 16 | Feature flags lack targeting rules (org/plan/percentage) | Low | 5 |
| 17 | Inactivity thresholds hardcoded (not per-tenant configurable) | Medium | 5 |
| 18 | Real-time threat alerting (Graph change notifications) not implemented | Medium | 6 |
| 19 | No API versioning strategy | Low | 6 |

---

## Phase 1: CI/CD Hardening & Auth Migration (Priority: Critical)

**Goal**: All PRs gated by SAST, secret scan, license compliance, coverage thresholds. Auth migrated to Clerk RS256.
**Gate**: CI blocks merge on any Critical/High vulnerability. Coverage enforced. Auth accepts both RS256 and HS256.

### Task 1.1: Add SAST scanning with Semgrep [S]
- Description: Add Semgrep step to `security-scan` job in CI. Scan for TypeScript OWASP top-10 patterns.
- Files: `.github/workflows/ci.yml`
- Dependencies: None
- Done when: `semgrep` runs on every PR with `p/typescript` and `p/owasp-top-ten` rulesets; CI fails on high-severity findings.

### Task 1.2: Add secret scanning with TruffleHog [S]
- Description: Add TruffleHog step to `security-scan` job. Detect committed secrets (API keys, tokens).
- Files: `.github/workflows/ci.yml`
- Dependencies: None
- Done when: `trufflehog` runs on every PR with `--only-verified` flag; CI fails on detected secrets.

### Task 1.3: Add license compliance scanning [S]
- Description: Add `license-checker` step to `security-scan` job. Block GPL-3.0 and AGPL-3.0 dependencies.
- Files: `.github/workflows/ci.yml`
- Dependencies: None
- Done when: `npx license-checker --failOn "GPL-3.0;AGPL-3.0"` runs on every PR.

### Task 1.4: Enforce coverage thresholds in CI [M]
- Description: Configure Vitest coverage in both `apps/api` and `apps/web`. Add coverage-check CI job that parses JSON output and fails below thresholds (90% line, 85% branch). Mark critical path files (auth, billing, remediations, CIS engine) for 100% enforcement.
- Files: `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts` (create), `.github/workflows/ci.yml`, `scripts/check-coverage.sh` (create)
- Dependencies: Task 2.1 (web vitest config)
- Done when: CI fails if coverage drops below thresholds. Coverage artifacts uploaded per PR.

### Task 1.5: Auth migration — Clerk RS256 dual-mode [L]
- Description: Update `apps/api/src/middleware/auth.ts` to try Clerk RS256 JWKS verification first, fall back to HS256. Add `CLERK_DOMAIN` env var to `wrangler.toml`. Update frontend to use Clerk SvelteKit SDK for token issuance. Maintain backward compatibility during migration period.
- Files: `apps/api/src/middleware/auth.ts`, `apps/api/wrangler.toml`, `apps/web/src/hooks.server.ts`, `apps/web/src/lib/stores/auth.ts`
- Dependencies: None
- Done when: API accepts both Clerk RS256 and legacy HS256 tokens. Frontend issues Clerk tokens. Existing sessions continue to work.

### Task 1.6: Security scan job should block merge [S]
- Description: Currently `security-scan` uses `continue-on-error: true` on `pnpm audit`. Make it fail the CI status check on high/critical vulnerabilities.
- Files: `.github/workflows/ci.yml`
- Dependencies: None
- Done when: `status-check` job includes `security-scan` result validation (it already does in `needs` but the audit itself uses `continue-on-error`).

---

## Phase 2: Testing Infrastructure (Priority: Critical)

**Goal**: Frontend unit test coverage established. E2E tests cover all 8 critical flows.
**Gate**: 90% line coverage overall. All 8 critical user flows have passing E2E tests.

### Task 2.1: Frontend testing setup [M]
- Description: Create `apps/web/vitest.config.ts` with Svelte 5 support (`@testing-library/svelte`). Add test scripts to `apps/web/package.json`. Configure coverage output (JSON + HTML).
- Files: `apps/web/vitest.config.ts` (create), `apps/web/package.json`, `apps/web/tsconfig.test.json` (create if needed)
- Dependencies: None
- Done when: `cd apps/web && pnpm test` runs successfully with empty test suite. Coverage configuration outputs JSON.

### Task 2.2: Critical component unit tests [L]
- Description: Write unit tests for the most critical UI components: `Sidebar.svelte`, `AlertCard.svelte`, `TrialGate.svelte`, `CIS ControlTable.svelte`, `MetricCard.svelte`, `ScoreRing.svelte`, `DashboardContent.svelte`, `CookieConsent.svelte`, `OnboardingWizard.svelte`, `SkillGate.svelte`.
- Files: `apps/web/src/lib/components/**/*.test.ts` (10+ new test files)
- Dependencies: Task 2.1
- Done when: 10+ critical components have unit tests. Each test covers rendering, props, user interactions, and accessibility.

### Task 2.3: Svelte stores & utility unit tests [M]
- Description: Write tests for all stores (`auth.ts`, `tenant.ts`, `skills.ts`, `toast.ts`, `theme.ts`) and utility functions (`format.ts`, `export.ts`, `focus-trap.ts`).
- Files: `apps/web/src/lib/stores/*.test.ts`, `apps/web/src/lib/utils/*.test.ts` (8+ new test files)
- Dependencies: Task 2.1
- Done when: All stores tested for state transitions. All utilities tested for edge cases.

### Task 2.4: E2E critical flow tests [L]
- Description: Implement Playwright E2E tests for the 8 critical flows defined in requirements (TEST-003.1). Each flow as a separate spec file. Use 4 personas (MSP admin, tenant engineer, contractor, free-tier).
- Files: `tests/e2e/flows/tenant-onboard.spec.ts`, `tests/e2e/flows/cis-scan.spec.ts`, `tests/e2e/flows/threat-alert.spec.ts`, `tests/e2e/flows/workflow-schedule.spec.ts`, `tests/e2e/flows/copilot-readiness.spec.ts`, `tests/e2e/flows/team-invite.spec.ts`, `tests/e2e/flows/skill-install.spec.ts`, `tests/e2e/flows/multi-tenant.spec.ts`
- Dependencies: None
- Done when: 8 spec files covering all critical flows. Each uses appropriate persona fixture. All pass against local dev server.

### Task 2.5: Shared package tests [S]
- Description: Test all Zod schemas in `packages/shared/src/schemas.ts` with valid and invalid inputs. Test type guards and constants.
- Files: `packages/shared/src/schemas.test.ts` (expand), `packages/shared/src/config/*.test.ts`
- Dependencies: None
- Done when: All Zod schemas have positive and negative test cases. 100% branch coverage on schema validation.

---

## Phase 3: Cron Jobs, Queue Processors & Observability (Priority: High)

**Goal**: All background jobs instrumented with sync-job-tracker. Missing cron triggers registered. Notification queue sends to Slack/Teams/Discord.
**Gate**: Platform admin can view all sync job statuses, re-trigger failed jobs, and see real-time metrics.

### Task 3.1: Create sync-job-tracker utility [M]
- Description: Implement the `trackSyncJob` wrapper per design doc. Every cron handler wraps its execution with this utility to log start/completion/failure to `sync_job_logs` table.
- Files: `apps/api/src/lib/sync-job-tracker.ts` (create), `apps/api/src/lib/sync-job-tracker.test.ts` (create)
- Dependencies: `syncJobs` table already exists in schema
- Done when: `trackSyncJob(db, jobType, tenantId, fn)` inserts running status, updates on completion/failure with duration and item counts.

### Task 3.2: Instrument existing cron handlers [M]
- Description: Wrap all 7 existing cron handlers (`user-sync.ts`, `security-scan.ts`, `compliance-scan.ts`, `drift-detection.ts`, `nightly-backup.ts`, `scheduled-scans.ts`, `workflow-trigger.ts`) with `trackSyncJob`.
- Files: `apps/api/src/cron/*.ts` (7 files modified)
- Dependencies: Task 3.1
- Done when: Every cron run creates a `sync_job_logs` record. Platform admin dashboard shows real-time job statuses.

### Task 3.3: Add scheduled-snapshots cron [M]
- Description: Create cron handler that captures config snapshots on a per-tenant schedule (stored in KV as `snapshot-schedule:{tenantId}`). Default daily at 02:00 UTC. Auto-labels snapshots.
- Files: `apps/api/src/cron/scheduled-snapshots.ts` (create), `apps/api/src/cron/scheduled-snapshots.test.ts` (create)
- Dependencies: Config snapshot capture route already exists
- Done when: Cron runs, reads per-tenant schedule from KV, triggers snapshot capture, logs via sync-job-tracker.

### Task 3.4: Add storage-scan cron [M]
- Description: Create cron handler that runs weekly storage scans for all active tenants. Stores results in `storageAnalytics` table. Generates quota alerts when thresholds exceeded.
- Files: `apps/api/src/cron/storage-scan.ts` (create), `apps/api/src/cron/storage-scan.test.ts` (create)
- Dependencies: Storage analytics scan route already exists
- Done when: Weekly cron triggers full storage scan per tenant. Quota alerts created for resources above 80%/90%/95%.

### Task 3.5: Register new cron triggers in wrangler.toml [S]
- Description: Add cron entries for drift-detection (every 6 hours), scheduled-snapshots (daily at 2am), storage-scan (weekly Sunday at 3am), and tenant-health-score (every 15 min) to `wrangler.toml` triggers.
- Files: `apps/api/wrangler.toml`
- Dependencies: Tasks 3.3, 3.4
- Done when: `wrangler.toml` has cron entries for all 10+ scheduled tasks. Worker scheduled handler routes to correct cron function.

### Task 3.6: Notification queue — Slack/Teams/Discord integration [M]
- Description: Enhance `apps/api/src/queues/notification-sender.ts` to use `webhook-notify.ts` for delivering notifications to configured Slack, Teams, and Discord channels (Discord uses simple webhook format). Currently it only does email + web push.
- Files: `apps/api/src/queues/notification-sender.ts`, `apps/api/src/lib/webhook-notify.ts` (add Discord format)
- Dependencies: Webhook config already stores URLs
- Done when: Notification queue checks `webhook_configs` for tenant, sends formatted messages to Slack (Block Kit), Teams (Adaptive Card), Discord (embed), and generic webhooks.

### Task 3.7: Tenant health score cron [M]
- Description: Implement 15-minute cron that computes per-tenant health scores (token validity 30pts, sync freshness 25pts, CIS score 25pts, alert count 20pts). Write to `platformMetrics` or a new `tenant_health_scores` view.
- Files: `apps/api/src/cron/tenant-health.ts` (create), `apps/api/src/cron/tenant-health.test.ts` (create)
- Dependencies: `platformMetrics` table exists
- Done when: Health scores computed every 15 min. Platform admin dashboard shows unhealthy tenants. Alerts fire for tenants scoring below 50.

---

## Phase 4: Feature Completeness (Priority: High)

**Goal**: Fill remaining acceptance criteria gaps in the 5 priority features and remediation rollback.
**Gate**: All acceptance criteria checkboxes in requirements.md are checked for priority features.

### Task 4.1: Drift suppression rules — schema + API + UI [M]
- Description: Add `drift_suppression_rules` table to D1 schema. Create API endpoints (GET/POST/DELETE `/api/drift/suppression-rules`). Build `SuppressionRuleManager.svelte` component. Wire drift-detection cron to filter suppressed diffs before alerting.
- Files: `packages/db/src/schema-d1.ts`, `apps/api/src/routes/config-drifts.ts`, `apps/web/src/lib/components/config/SuppressionRuleManager.svelte` (create), `apps/api/src/cron/drift-detection.ts`
- Dependencies: Drift detection cron exists
- Done when: Admins can create rules to suppress known-safe drift changes. Cron filters suppressed changes before creating alerts.

### Task 4.2: Config snapshot revert via Graph API [L]
- Description: Implement `POST /api/config-snapshots/:id/revert/:category` that reads a snapshot's category data and applies it back to the tenant via Graph API write operations. Start with conditional access policies.
- Files: `apps/api/src/routes/config-snapshots.ts`, `apps/api/src/lib/graph-client.ts`
- Dependencies: Snapshot data already captured
- Done when: Admin can revert conditional access policy changes to a previous snapshot state. Dry-run shows diff before applying. Audit log records revert.

### Task 4.3: Copilot readiness PDF export [M]
- Description: Wire the existing `generateReadinessReportHtml` to Cloudflare Browser Rendering binding for PDF conversion. Store in R2 with 7-day TTL. Add `GET /api/copilot-readiness/report/pdf` endpoint.
- Files: `apps/api/src/routes/copilot-readiness.ts`, `apps/api/src/lib/copilot/readiness-report.ts`, `apps/api/wrangler.toml` (add browser binding)
- Dependencies: Report HTML template exists
- Done when: PDF downloads via API. Stored in R2. Frontend button triggers download.

### Task 4.4: Copilot usage analytics expansion [M]
- Description: Expand `/api/copilot-usage` to track per-user adoption rates, identify power users vs inactive license holders, and calculate Copilot ROI (productivity gains vs license cost).
- Files: `apps/api/src/routes/copilot-usage.ts`, `apps/web/src/routes/security/copilot-usage/+page.svelte`
- Dependencies: Basic route exists
- Done when: Usage table shows per-user adoption. ROI card displays estimated productivity gains. Inactive Copilot license holders flagged.

### Task 4.5: Storage analytics — OneDrive, Exchange, large files [L]
- Description: Expand storage scanner to cover OneDrive per-user (`/users/{id}/drive?$select=quota`), Exchange mailboxes (`/reports/getMailboxUsageDetail`), large file detection (`/drives/{id}/items?$filter=size gt {threshold}`), and orphaned content (deleted-user OneDrives).
- Files: `apps/api/src/lib/storage/scanner.ts` (or equivalent), `apps/api/src/routes/storage-analytics.ts`
- Dependencies: Basic SharePoint scan exists
- Done when: Full scan covers SharePoint + OneDrive + Exchange. Large files listed. Orphaned content detected. Storage trend chart shows growth over time.

### Task 4.6: Remediation rollback completion [L]
- Description: Complete rollback logic for all 9 remediation actions. Ensure `beforeState` is stored before every execution. Add rollback status tracking. Build frontend "Undo" button on remediation history.
- Files: `apps/api/src/routes/remediation-rollback.ts`, `apps/api/src/lib/remediation-actions/` (multiple files), `apps/web/src/routes/workflows/+page.svelte` (or remediation history page)
- Dependencies: Rollback framework exists
- Done when: All 9 actions have working rollback. `beforeState` captured on every execution. UI shows "Undo" button with confirmation dialog. Rollback audit log entry created.

### Task 4.7: Snapshot scheduling API + UI [S]
- Description: Add `POST /api/config-snapshots/schedule` endpoint to configure per-tenant snapshot frequency (daily/weekly). Build `SnapshotScheduleForm.svelte` in config section.
- Files: `apps/api/src/routes/config-snapshots.ts`, `apps/web/src/lib/components/config/SnapshotScheduleForm.svelte` (create)
- Dependencies: Task 3.3 (scheduled-snapshots cron)
- Done when: Admin sets snapshot schedule via UI. Schedule stored in KV. Cron reads and executes.

### Task 4.8: Snapshot diff export as PDF/JSON [S]
- Description: Add `GET /api/config-snapshots/:id/export` that returns the diff as downloadable JSON or PDF.
- Files: `apps/api/src/routes/config-snapshots.ts`
- Dependencies: Diff computation exists
- Done when: API returns formatted JSON or PDF diff. Frontend adds "Export" button to diff viewer.

---

## Phase 5: API Quality & Developer Experience (Priority: Medium)

**Goal**: Structured error codes, configurable thresholds, feature flag targeting, API polish.
**Gate**: All API errors use structured error codes. Per-tenant configuration available. Feature flags support org-level targeting.

### Task 5.1: Structured error codes [M]
- Description: Define an `ErrorCode` enum covering all error categories (AUTH_001, TENANT_001, GRAPH_001, etc.). Update all API error responses to include `{ error: string, code: string, details?: unknown }`. Create error factory utility.
- Files: `packages/shared/src/error-codes.ts` (create), `apps/api/src/lib/errors.ts` (create), `apps/api/src/routes/*.ts` (gradual migration)
- Dependencies: None
- Done when: All new routes use structured error codes. Existing routes migrated incrementally. Frontend can switch on error codes for user-friendly messages.

### Task 5.2: Per-tenant configurable inactivity thresholds [S]
- Description: Store per-tenant settings in KV (`tenant-settings:{tenantId}`). Add settings API endpoint. Pass tenant-specific thresholds to intelligence engine instead of hardcoded 30/60/90.
- Files: `apps/api/src/routes/tenants.ts` (add settings endpoints), `apps/api/src/services/intelligence-engine.ts`, `apps/web/src/routes/settings/+page.svelte`
- Dependencies: None
- Done when: Admin can configure inactivity thresholds (30/60/90/custom) per tenant via Settings. Intelligence engine reads tenant-specific config.

### Task 5.3: Feature flag targeting rules [M]
- Description: Extend feature flag system to support org-level, plan-level, and percentage rollout targeting. Add feature flag management UI in platform admin panel.
- Files: `apps/api/src/lib/feature-flags.ts` (create or expand), `apps/api/src/routes/platform/feature-flags.ts` (create), `apps/web/src/routes/platform/feature-flags/+page.svelte` (create)
- Dependencies: None
- Done when: Feature flags support JSON targeting rules `{ orgs: [], plans: [], percentage: 0-100 }`. Platform admin can toggle flags via UI.

### Task 5.4: Frontend dry-run diff modal [S]
- Description: Build a diff viewer modal for remediation dry-run results. Show before/after state with green/red highlighting.
- Files: `apps/web/src/lib/components/remediation/DryRunDiffModal.svelte` (create)
- Dependencies: Dry-run API exists
- Done when: Clicking "Preview" on a remediation shows a modal with colored diff. User can confirm or cancel.

---

## Phase 6: Advanced Features & Polish (Priority: Medium)

**Goal**: Real-time alerting, storage compliance, API versioning, and remaining polish items.
**Gate**: All items in requirements.md Section 9 (Production Readiness Gaps) resolved.

### Task 6.1: Graph API change notifications for real-time threats [L]
- Description: Register Graph API change notification subscriptions for security alerts, risky sign-ins, and policy changes. Process events in real-time via Cloudflare Queue. Push alerts via SSE + configured channels.
- Files: `apps/api/src/routes/graph-subscriptions.ts` (create), `apps/api/src/routes/graph-webhook.ts` (create), `apps/api/src/lib/graph-client.ts`
- Dependencies: Webhook config and notification queue exist
- Done when: High-severity security events trigger near-real-time alerts (< 5 min latency vs current batch-only approach).

### Task 6.2: Storage compliance reporting [M]
- Description: Identify sites/drives without retention policies, check for PII in unprotected locations, generate storage governance report.
- Files: `apps/api/src/lib/storage/compliance-checker.ts` (create), `apps/api/src/routes/storage-analytics.ts`
- Dependencies: Task 4.5 (expanded storage scanner)
- Done when: Storage compliance report available via API. Shows sites without retention, potential PII locations, and governance recommendations.

### Task 6.3: Platform admin — revenue analytics [M]
- Description: Build MRR, churn rate, ARPU, and plan distribution charts for the platform admin revenue page. Query LemonSqueezy API or aggregate from local subscription data.
- Files: `apps/api/src/routes/platform/admin-overview.ts`, `apps/web/src/routes/platform/admin/revenue/+page.svelte` (create or expand)
- Dependencies: Billing integration exists
- Done when: Revenue page shows MRR trend, churn %, ARPU, and plan distribution pie chart.

### Task 6.4: Platform admin — usage analytics [S]
- Description: Track feature adoption rates and skill activation rates across all tenants.
- Files: `apps/api/src/routes/platform/admin-metrics.ts`, `apps/web/src/routes/platform/admin/usage/+page.svelte` (create or expand)
- Dependencies: Skill marketplace exists
- Done when: Usage page shows which features/skills are most used, adoption trends over time.

### Task 6.5: API versioning strategy [S]
- Description: Add `/api/v1/` prefix routing. Document versioning policy. Keep `/api/` as alias for latest version during transition.
- Files: `apps/api/src/index.ts`, documentation
- Dependencies: None
- Done when: All routes accessible via `/api/v1/`. Existing `/api/` routes continue to work. Versioning policy documented.

### Task 6.6: Copilot readiness MSP benchmark [S]
- Description: Implement `GET /api/copilot-readiness/benchmark` that compares a tenant's readiness score against the aggregate of all tenants in the MSP's portfolio.
- Files: `apps/api/src/routes/copilot-readiness.ts`
- Dependencies: Copilot assessments stored in DB
- Done when: Benchmark endpoint returns percentile ranking and average scores across MSP portfolio.

### Task 6.7: Admin announcements & maintenance windows [S]
- Description: Expand platform admin notifications to support platform-wide announcements, maintenance window scheduling with advance notice, and degraded service notifications.
- Files: `apps/api/src/routes/platform/admin-notifications.ts`, `apps/web/src/routes/platform/admin/announcements/+page.svelte` (create)
- Dependencies: Admin notifications route exists
- Done when: Admin can create announcements visible to all users. Maintenance windows show countdown banner.

### Task 6.8: Invitation email delivery verification [S]
- Description: Confirm team invitation emails are actually delivered via Resend. Add delivery status tracking.
- Files: `apps/api/src/routes/team.ts`, `apps/api/src/lib/email/` (verify integration)
- Dependencies: Team invite route exists
- Done when: Invitation emails confirmed delivered. Delivery status shown in team management UI.

---

## Estimated Effort Summary

| Phase | Tasks | Total Complexity | Est. Days |
|-------|-------|-----------------|-----------|
| Phase 1: CI/CD + Auth | 6 | 2S + 2S + 1M + 1L = ~5 pts | 3-4 |
| Phase 2: Testing | 5 | 1S + 2M + 2L = ~8 pts | 5-7 |
| Phase 3: Cron/Queue/Observability | 7 | 1S + 5M + 1M = ~7 pts | 4-5 |
| Phase 4: Feature Completeness | 8 | 2S + 3M + 3L = ~10 pts | 6-8 |
| Phase 5: API Quality | 4 | 2S + 2M = ~4 pts | 2-3 |
| Phase 6: Advanced/Polish | 8 | 4S + 2M + 1M + 1L = ~6 pts | 4-5 |
| **Total** | **38** | | **24-32 days** |

---

## Readiness Projection

| Milestone | Readiness | Description |
|-----------|-----------|-------------|
| Phases 1-6 complete | 82% | Features built, CI exists, tests partial |
| Current (April 3) | 85% | TS clean, 1000+ tests passing, strategic plan |
| After test stabilization | 88% | All unit tests green, E2E validated |
| After file-size refactoring | 90% | 200-line limit compliance |
| After production deploy | 92% | Live site with all 6 phases deployed |
| After CIS expansion (100+) | 95% | Marketing ↔ reality alignment |
| After PSA integration | 97% | ConnectWise + Autotask bidirectional sync |
| After workflow templates | 98% | 25+ pre-built workflow templates |
| After visual builder | 100% | Full market competitiveness |

---

## Phase 7: Strategic Competitive Gaps (NEW — from gap analysis)

See full plan: `.luna/tenantiq/strategic-gap-plan.md`

### 7.1 CIS Controls Expansion (19 → 100+) [XL]
- Split control-definitions.ts into per-section files
- Add 80+ controls across Identity, Application, Data, Email, Audit, Device
- Add corresponding Graph API check implementations
- Timeline: April W1-W2 (Phase A), May W1-W2 (Phase B+C)

### 7.2 PSA/RMM Integration — ConnectWise + Autotask [L]
- New `packages/integrations/` package
- DB tables: `psa_connections`, `psa_tenant_mappings`, `psa_tickets`
- API: 7 endpoints for connection management and sync
- Cron: 15-min ticket sync from alerts → PSA
- Timeline: April W3-W4 (ConnectWise), May W4 (Autotask)

### 7.3 Workflow Templates (4 → 25) [M]
- Template JSON definitions in `apps/api/src/lib/workflows/templates/`
- 25 templates across 6 categories: lifecycle, license, security, compliance, governance, cost
- Template marketplace page with one-click install
- Timeline: May W3

### 7.4 File-Size Compliance [L]
- 29 TypeScript files and 6 Svelte files exceed 200-line limit
- Worst offenders: tenants.ts (1352), ai-engine/index.ts (987), phishing/+page.svelte (1011)
- Split by responsibility, extract sub-routes, decompose components
- Timeline: Ongoing — address alongside feature work
