# TenantIQ — Sprint Plan: Complete All Missing & Partial Features

> Based on FEATURES.md audit (72 vision features + expanded sub-features)
> Target: 100% feature completion across all 10 modules
> Sprint duration: 2 weeks each

---

## Overview

| Sprint | Theme | Features | Effort |
|--------|-------|----------|--------|
| Sprint 1 | Remediation & Safety | Dry-run API, rollback completion, confirmation UX | Medium |
| Sprint 2 | Compliance & Reporting | Full framework engines, custom report builder, PDF export | High |
| Sprint 3 | Automated Workflows | Guest review, group cleanup, approval gates, nightly backup cron | High |
| Sprint 4 | Intelligence & Monitoring | Backup health monitoring, push notifications, alert trends, email/SMS | High |
| Sprint 5 | AI Agent & Explainability | Tool execution UI, streaming responses, conversation export | Medium |
| Sprint 6 | Backup & Recovery | Incremental backups, content-level backup, cross-tenant migration | High |
| Sprint 7 | User Management & Delegation | Ad-hoc delegation UI, bulk user operations, self-service portal | Medium |
| Sprint 8 | Purview, DLP & Advanced Security | Full Purview API integration, DLP policy management, sensitivity labels | Medium |
| Sprint 9 | Event-Driven Architecture | Webhook-to-workflow bridge, conditional triggers, real-time event bus | Medium |
| Sprint 10 | Polish, Performance & Launch Prep | E2E testing, performance optimization, documentation, launch checklist | Medium |

---

## Sprint 1: Remediation Safety & Dry-Run (Weeks 1-2)

**Goal**: Make remediation actions safe, reversible, and previewable.

### Feature 1.1: Dry-Run API Endpoint
- **Status**: NOT IMPLEMENTED
- **Description**: Allow users to preview exactly what a remediation will change before executing it. Shows a diff of current vs proposed state.
- **Sub-features**:
  - POST `/api/remediations/dry-run` endpoint accepting `alertId` and `actionType`
  - Returns `{ changes: [{ resource, field, currentValue, proposedValue }] }` for each affected resource
  - Each remediation action implements `dryRun()` method returning change preview
  - Frontend "Preview Changes" button on alert cards opens a diff modal
  - Diff modal shows before/after state with green/red highlighting
- **Implementation**:
  - API: Add `/dry-run` route in `apps/api/src/routes/remediations.ts`
  - Backend: Implement `dryRun()` in each action file under `packages/remediation/src/actions/`
  - Frontend: New `DryRunPreview.svelte` component in `apps/web/src/lib/components/`
  - Tests: Add dry-run tests to `apps/api/src/routes/remediations.test.ts`
- **Key files**: `packages/remediation/src/executor.ts`, all 9 action files, `apps/api/src/routes/remediations.ts`

### Feature 1.2: Rollback Completion
- **Status**: PARTIAL
- **Description**: Complete rollback logic for all 9 remediation actions. Currently the framework exists but individual action rollbacks vary in completeness.
- **Sub-features**:
  - Implement `rollback()` for each action: decommission-user (re-enable account, re-assign licenses), block-ip (remove from blocked list), downgrade-license (restore original SKU), enable-mfa (revert to previous state), etc.
  - Store `beforeState` snapshot before every execution
  - Add rollback status tracking (pending, in_progress, completed, failed)
  - Frontend "Undo" button on recent remediations list
  - Rollback audit logging with reason field
- **Implementation**:
  - Backend: Complete `rollback()` in each action file
  - API: Ensure `POST /remediations/:id/rollback` works end-to-end
  - Frontend: Add rollback button to remediation history in `apps/web/src/routes/alerts/`
  - DB: Add `rollback_status`, `rollback_at` columns to remediations table
- **Key files**: `packages/remediation/src/rollback.ts`, all 9 action files

### Feature 1.3: Confirmation UX Enhancement
- **Status**: PARTIAL
- **Description**: Improve the "preview before execute" flow with detailed impact descriptions, affected resource counts, and estimated time.
- **Sub-features**:
  - Confirmation modal shows: action name, affected users/resources count, estimated duration, reversibility indicator
  - "High risk" actions (decommission, block IP) require typing "CONFIRM" before execution
  - Batch confirmation for bulk operations (e.g., downgrade 15 licenses at once)
  - Show remediation history in confirmation modal ("this action was previously attempted X times")
- **Implementation**:
  - Frontend: Enhance `ConfirmModal.svelte` with impact details
  - New `HighRiskConfirm.svelte` component for destructive actions
  - API: Add `/remediations/impact-preview` endpoint returning affected resource counts
- **Key files**: `apps/web/src/lib/components/ConfirmModal.svelte`, `apps/api/src/routes/remediations.ts`

### Feature 1.4: Remediation Scheduling
- **Description**: NEW — Schedule a remediation to execute at a specific time (e.g., "disable account at 5 PM Friday after offboarding is complete").
- **Sub-features**:
  - Add `scheduledAt` field to remediation execution request
  - Queue with delay using Cloudflare Queue scheduling
  - Show scheduled remediations in a calendar view
  - Cancel/reschedule before execution
- **Implementation**:
  - API: Add `scheduledAt` parameter to POST `/remediations/execute`
  - Backend: Use Cloudflare Queue delayed messages
  - Frontend: Date/time picker in remediation confirmation modal

---

## Sprint 2: Compliance & Reporting (Weeks 3-4)

**Goal**: Full regulatory compliance framework engines and custom report builder.

### Feature 2.1: SOC 2 Compliance Engine
- **Status**: PARTIAL (framework defined, not fully mapped)
- **Description**: Map all SOC 2 Trust Service Criteria to Microsoft 365 controls and evaluate compliance.
- **Sub-features**:
  - Map SOC 2 criteria (CC1-CC9, A1, C1, PI1, P1) to specific M365 settings
  - Check: audit logging enabled (CC7.2), access reviews configured (CC6.1), MFA enforced (CC6.1), data classification labels applied (CC6.7)
  - Generate SOC 2 readiness score (0-100)
  - Produce SOC 2 evidence package (JSON + PDF) for auditor review
  - Track SOC 2 compliance history over time
- **Implementation**:
  - Backend: Expand `apps/api/src/lib/compliance-frameworks.ts` with full control mappings
  - New: `apps/api/src/lib/compliance/soc2-engine.ts` with specific checks
  - API: Enhance `/api/security/compliance` to return per-framework scores
  - Frontend: Framework detail page with control-level pass/fail
- **Key files**: `apps/api/src/lib/compliance-frameworks.ts`, `apps/api/src/routes/compliance-posture.ts`

### Feature 2.2: HIPAA Compliance Engine
- **Description**: Evaluate HIPAA compliance for healthcare organizations.
- **Sub-features**:
  - Map HIPAA safeguards: Administrative (workforce training records), Physical (device management), Technical (encryption, access controls)
  - Check: encryption at rest/transit, BAA tracking, minimum necessary access, audit controls
  - HIPAA risk assessment score with remediation recommendations
  - Evidence collection for HIPAA audits
- **Implementation**:
  - New: `apps/api/src/lib/compliance/hipaa-engine.ts`
  - Reuse CIS benchmark control results where applicable

### Feature 2.3: GDPR Compliance Engine
- **Description**: Evaluate GDPR compliance for organizations handling EU data.
- **Sub-features**:
  - Check: data processing records, consent management, DPO designation, cross-border transfer safeguards
  - Data subject access request (DSAR) tooling: find all data for a user across M365
  - Right to erasure: identify and list all user data locations
  - GDPR readiness score
- **Implementation**:
  - New: `apps/api/src/lib/compliance/gdpr-engine.ts`
  - API: Add `/api/compliance/gdpr/dsar/:userId` endpoint

### Feature 2.4: Custom Report Builder
- **Status**: NOT IMPLEMENTED
- **Description**: Visual report builder where admins select metrics, date ranges, and chart types.
- **Sub-features**:
  - Metric picker: select from available data sources (users, licenses, security, compliance, costs)
  - Date range selector with presets (7d, 30d, 90d, 1y, custom)
  - Chart type selector (bar, line, pie, table, metric card)
  - Layout editor: arrange widgets in a grid (2-4 columns)
  - Save report templates for reuse
  - Schedule report delivery (daily/weekly/monthly email)
  - Export to PDF with branded header/footer
- **Implementation**:
  - New: `apps/web/src/routes/reports/builder/+page.svelte`
  - New: `apps/web/src/lib/components/reports/` (MetricPicker, ChartWidget, ReportGrid)
  - API: POST `/api/reports/templates` for saving, GET `/api/reports/data` for fetching
  - Backend: `apps/api/src/routes/report-builder.ts`

### Feature 2.5: PDF Export Engine
- **Description**: Generate downloadable PDF reports from any data view.
- **Sub-features**:
  - Server-side PDF generation using `@react-pdf/renderer` or `jspdf`
  - Branded templates with company logo, colors, headers
  - Support for: Executive Report PDF, CIS Benchmark PDF, Compliance Report PDF, License Analysis PDF
  - Scheduled email delivery with PDF attachment
- **Implementation**:
  - Backend: New `apps/api/src/lib/pdf-generator.ts`
  - API: Add `?format=pdf` parameter to report endpoints

### Feature 2.6: Alert Trend Charts
- **Status**: PARTIAL (history exists, charts missing)
- **Description**: Visualize alert trends over time — count by severity, type, and resolution rate.
- **Sub-features**:
  - Alert count over time chart (7d, 30d, 90d) grouped by severity
  - Mean time to resolution (MTTR) metric
  - Alert type distribution pie chart
  - Resolution rate trend line
- **Implementation**:
  - API: New `/api/alerts/trends` endpoint with time aggregation
  - Frontend: Add trend charts to `apps/web/src/routes/alerts/+page.svelte`

---

## Sprint 3: Automated Workflows (Weeks 5-6)

**Goal**: Complete all automated workflow types from the vision.

### Feature 3.1: Guest User Review Workflow
- **Status**: NOT IMPLEMENTED
- **Description**: Quarterly automated review of all guest users with auto-removal of inactive guests.
- **Sub-features**:
  - Cron job: scan guest users quarterly (every 90 days)
  - Identify guests who haven't signed in for 90+ days
  - Identify guests with no group memberships
  - Generate review report listing all guests with last activity date
  - Auto-remove guests inactive for 180+ days (with configurable threshold)
  - Notify tenant admin of pending guest reviews
  - Admin approval flow for guest removal (approve/deny each guest)
  - Track guest review history
- **Implementation**:
  - New: `apps/api/src/cron/guest-review.ts`
  - New: `apps/api/src/lib/workflows/guest-review-engine.ts`
  - API: `/api/workflows/guest-review/run`, `/api/workflows/guest-review/approve`
  - Frontend: Guest review dashboard at `/workflows/guest-review`
  - Add to wrangler.toml cron triggers

### Feature 3.2: Group Cleanup Workflow
- **Status**: NOT IMPLEMENTED
- **Description**: Monthly audit of M365 groups to remove empty, inactive, or orphaned groups.
- **Sub-features**:
  - Cron job: scan groups monthly
  - Identify: empty groups (0 members), orphaned groups (no owner), inactive groups (no activity 90+ days)
  - Generate cleanup report with group details and recommended actions
  - Auto-archive groups meeting configurable thresholds
  - Notify group owners before archival (30-day grace period)
  - Restore archived groups within 30 days
  - Track cleanup history and reclaimed resources
- **Implementation**:
  - New: `apps/api/src/cron/group-cleanup.ts`
  - New: `apps/api/src/lib/workflows/group-cleanup-engine.ts`
  - API: `/api/workflows/group-cleanup/run`, `/api/workflows/group-cleanup/results`
  - Frontend: Group cleanup page at `/workflows/group-cleanup`

### Feature 3.3: License Optimization Approval Gate
- **Status**: PARTIAL (optimization runs but no approval)
- **Description**: Add approval workflow before auto-downgrading or removing licenses.
- **Sub-features**:
  - Generate optimization proposal with affected users and savings estimate
  - Send proposal to tenant admin for review
  - Admin can approve/deny/modify individual line items
  - Approved items execute automatically
  - Track approval history and realized savings
  - Weekly summary email of pending approvals
- **Implementation**:
  - New: `apps/api/src/lib/workflows/approval-engine.ts`
  - API: `/api/approvals` CRUD, `/api/approvals/:id/approve`, `/api/approvals/:id/deny`
  - Frontend: Approval queue page at `/workflows/approvals`
  - DB: New `approvals` table

### Feature 3.4: Nightly Backup Cron
- **Status**: PARTIAL (backup exists, no cron)
- **Description**: Automated nightly backup of tenant configuration data.
- **Sub-features**:
  - Cron: run at 2 AM UTC daily
  - Full config snapshot: conditional access policies, auth methods, named locations, security defaults, directory settings
  - Compare with previous night's snapshot for drift detection
  - Alert on configuration drift (unexpected changes)
  - Retention: keep daily backups for 30 days, weekly for 90 days, monthly for 1 year
  - Backup health dashboard showing last backup time, size, status per tenant
- **Implementation**:
  - New: `apps/api/src/cron/nightly-backup.ts`
  - Enhance: `apps/api/src/lib/backup.ts` with scheduled full backup
  - Add to wrangler.toml: `{ cron = "0 2 * * *" }`
  - Frontend: Backup health section on `/backups`

### Feature 3.5: Workflow Notification Integration
- **Description**: NEW — Send notifications when workflows complete, fail, or need approval.
- **Sub-features**:
  - Email notification on workflow completion (success/failure)
  - Slack/Teams notification on workflow failure
  - In-app notification for pending approvals
  - Weekly workflow summary report
- **Implementation**:
  - Enhance: `apps/api/src/cron/workflow-trigger.ts` with notification dispatch
  - Use existing `apps/api/src/lib/notifications.ts` and webhook delivery

---

## Sprint 4: Intelligence & Monitoring (Weeks 7-8)

**Goal**: Complete the intelligence engine and notification systems.

### Feature 4.1: Backup Health Monitoring
- **Status**: NOT IMPLEMENTED
- **Description**: Continuously monitor backup health and alert on failures.
- **Sub-features**:
  - Track: last successful backup time, backup size trend, success/failure rate
  - Alert if no successful backup in 48+ hours
  - Alert if backup size drops significantly (>50% decrease)
  - Alert if backup encryption key rotation is overdue (90+ days)
  - Backup health dashboard with per-tenant status cards
  - Backup SLA compliance tracking (99.9% uptime target)
- **Implementation**:
  - New: `packages/intel/src/rules/backup-health.ts`
  - API: `/api/health-score/backup` endpoint
  - Frontend: Backup health section on `/backups`

### Feature 4.2: Push Notifications (Browser)
- **Status**: NOT IMPLEMENTED
- **Description**: Web Push notifications for critical events.
- **Sub-features**:
  - Service worker registration for push notifications
  - User opt-in/opt-out for push notification categories
  - Push on: critical security alerts, remediation completion, backup failure, workflow approval needed
  - Notification grouping (batch similar notifications)
  - Click-to-navigate: clicking notification opens relevant page
  - Notification preferences page in settings
- **Implementation**:
  - New: `apps/web/src/service-worker.ts` with push subscription
  - New: `apps/api/src/lib/web-push.ts` using Web Push protocol
  - API: `/api/push/subscribe`, `/api/push/unsubscribe`
  - Frontend: Notification preferences in `/settings`
  - Store push subscriptions in D1

### Feature 4.3: Email Notification Service
- **Status**: PARTIAL (framework exists, sending is stubbed)
- **Description**: Send real emails for alerts, reports, and workflow notifications.
- **Sub-features**:
  - Integrate with Resend (or SendGrid) for transactional email
  - Email templates: security alert, workflow completion, weekly digest, executive report, invitation
  - HTML email with responsive design and TenantIQ branding
  - Email delivery tracking (sent, delivered, opened, bounced)
  - Unsubscribe management per category
  - Rate limiting to prevent email flood
- **Implementation**:
  - Complete: `apps/api/src/queues/notification-sender.ts` with Resend integration
  - New: `apps/api/src/lib/email-templates/` with Handlebars templates
  - Add RESEND_API_KEY to wrangler.toml secrets

### Feature 4.4: SMS Notification Service
- **Description**: NEW — Send SMS for critical-only alerts (P0 security events).
- **Sub-features**:
  - Integrate with Twilio for SMS delivery
  - Only critical severity events trigger SMS
  - Phone number verification flow
  - SMS delivery tracking
  - Configurable quiet hours (no SMS between 10 PM - 7 AM unless P0)
- **Implementation**:
  - New: `apps/api/src/lib/sms-sender.ts` with Twilio integration
  - Add phone number field to user profile

### Feature 4.5: Alert Trend Analytics
- **Description**: Time-series analysis of alerts for pattern detection.
- **Sub-features**:
  - Alert volume trend (daily/weekly/monthly)
  - MTTR (mean time to resolution) by severity
  - Top alert categories over time
  - Recurring alert detection (same alert firing repeatedly)
  - Alert fatigue detection (too many low-severity alerts)
  - Predictive alerting (forecast based on trends)
- **Implementation**:
  - API: `/api/alerts/analytics` with time-series aggregation
  - Frontend: Analytics dashboard on `/alerts`

---

## Sprint 5: AI Agent Enhancement (Weeks 9-10)

**Goal**: Improve AI agent UX with streaming, explainability, and advanced tools.

### Feature 5.1: Tool Execution Progress UI
- **Status**: PARTIAL (tools execute but progress is basic)
- **Description**: Show step-by-step tool execution in the chat UI with collapsible details.
- **Sub-features**:
  - Real-time streaming of AI responses (not wait-for-complete)
  - Tool execution cards showing: tool name, input parameters, execution time, result summary
  - Collapsible detail view for each tool result
  - Error state with retry button for failed tools
  - "AI is thinking..." animation during processing
  - Copy tool results to clipboard
- **Implementation**:
  - API: Switch to SSE streaming for `/api/tenants/:id/ai/chat`
  - Frontend: New `ToolExecutionCard.svelte` and `StreamingMessage.svelte` components
  - Enhance `apps/web/src/routes/ai/+page.svelte`

### Feature 5.2: Conversation Export & Sharing
- **Description**: NEW — Export AI conversations for documentation or sharing.
- **Sub-features**:
  - Export conversation as Markdown
  - Export as PDF with TenantIQ branding
  - Share conversation via link (read-only, expiring)
  - Pin important conversations to the top
  - Tag conversations with labels (security, optimization, compliance)
- **Implementation**:
  - API: `/api/ai/conversations/:id/export`
  - Frontend: Export button in chat UI header

### Feature 5.3: AI Agent Suggested Actions
- **Description**: NEW — After AI analysis, suggest one-click actions the user can take.
- **Sub-features**:
  - AI generates action buttons based on conversation context
  - Actions link to remediation, configuration, or navigation
  - "Apply recommendation" button that executes AI suggestions
  - Action confirmation before execution
- **Implementation**:
  - Backend: Add `suggestedActions` field to AI response
  - Frontend: Render action buttons below AI messages

### Feature 5.4: Multi-Tenant AI Context
- **Description**: NEW — Allow AI to compare data across tenants for MSP users.
- **Sub-features**:
  - AI can query multiple tenants in a single conversation
  - Cross-tenant comparison tool (security scores, license utilization)
  - "Which tenant has the worst security posture?" queries
  - Aggregate MSP-level recommendations
- **Implementation**:
  - Add `tenant_comparison` tool to AI tool definitions
  - Enhance AI context builder to support multi-tenant queries

---

## Sprint 6: Backup & Recovery (Weeks 11-12)

**Goal**: Content-level backup, incremental sync, and migration support.

### Feature 6.1: Incremental Backups via Delta Queries
- **Status**: NOT IMPLEMENTED
- **Description**: Use Microsoft Graph delta queries for efficient incremental backup.
- **Sub-features**:
  - Store delta tokens per resource type (users, groups, policies)
  - On each backup run, use delta token to fetch only changes since last backup
  - Reduce backup time by 80-90% after initial full backup
  - Handle delta token expiration (fall back to full backup)
  - Track backup efficiency metrics (items synced, time saved)
- **Implementation**:
  - New: `apps/api/src/lib/backup/delta-sync.ts`
  - Enhance: `apps/api/src/lib/backup.ts` with delta query support
  - Store delta tokens in KV with tenant-scoped keys

### Feature 6.2: Content-Level Backup (Exchange/SharePoint)
- **Description**: PARTIAL (config only, not content)
- **Sub-features**:
  - Exchange: backup mailbox metadata (folder structure, rules, signatures)
  - SharePoint: backup site structure, lists, permissions, content types
  - OneDrive: backup file metadata and folder structure
  - Teams: backup team settings, channels, tabs, connectors
  - Note: actual file/email content backup requires Microsoft 365 Backup APIs (preview)
- **Implementation**:
  - New: `apps/api/src/lib/backup/exchange-backup.ts`
  - New: `apps/api/src/lib/backup/sharepoint-backup.ts`
  - New: `apps/api/src/lib/backup/teams-backup.ts`

### Feature 6.3: Cross-Tenant Migration Workflow
- **Description**: PARTIAL (backup/restore exists but no migration UI)
- **Sub-features**:
  - Migration wizard: select source tenant, select target tenant, choose data to migrate
  - Pre-flight check: validate permissions, quota, compatibility
  - Migrate: users, groups, policies, configurations
  - Post-migration validation: compare source vs target
  - Migration audit log
- **Implementation**:
  - New: `apps/api/src/lib/migration/migration-engine.ts`
  - API: `/api/migration/plan`, `/api/migration/execute`, `/api/migration/validate`
  - Frontend: Migration wizard at `/settings/migration`

### Feature 6.4: Backup Comparison & Drift Alerts
- **Description**: NEW — Compare any two backups and alert on unexpected drift.
- **Sub-features**:
  - Side-by-side diff viewer for any two snapshots
  - Automated drift detection: compare latest snapshot vs previous
  - Alert on: new conditional access policies, changed auth methods, removed security settings
  - Drift severity classification (critical: security settings changed, low: display name changed)
  - Drift dashboard with timeline
- **Implementation**:
  - Enhance: `/api/config-snapshots/:id/diff/:otherId`
  - New: `apps/api/src/cron/drift-detection.ts`
  - Frontend: Drift alerts on `/backups/config`

---

## Sprint 7: User Management & Delegation (Weeks 13-14)

**Goal**: Complete user lifecycle features and self-service capabilities.

### Feature 7.1: Ad-Hoc Delegation UI
- **Status**: PARTIAL (steps exist but no standalone UI)
- **Description**: Standalone UI for delegating OneDrive/mailbox access outside of offboarding.
- **Sub-features**:
  - Select user, select delegate, choose scope (OneDrive, mailbox, both)
  - Set delegation expiry (temporary or permanent)
  - Delegate notification email
  - Delegation audit log
  - Revoke delegation UI
- **Implementation**:
  - Frontend: New `/users/:id/delegate` page
  - API: `/api/users/:userId/delegate` POST/DELETE
  - Reuse lifecycle step handlers

### Feature 7.2: Bulk User Operations UI
- **Description**: NEW — Perform actions on multiple users at once.
- **Sub-features**:
  - Multi-select users from user list
  - Bulk actions: assign license, remove license, disable accounts, reset passwords, add to group
  - Progress tracking for bulk operations
  - Batch confirmation with affected user count
  - CSV import for bulk user creation
- **Implementation**:
  - Frontend: Add checkbox selection to user list
  - API: POST `/api/users/bulk` accepting array of operations
  - Backend: Queue bulk operations via REMEDIATION_QUEUE

### Feature 7.3: User Self-Service Portal
- **Description**: NEW — Allow end users to perform common tasks themselves.
- **Sub-features**:
  - Self-service password reset request
  - View own license assignments
  - Request additional licenses (with admin approval)
  - View own sign-in activity
  - Update profile information
- **Implementation**:
  - New: `/portal` route group with limited permissions
  - API: `/api/portal/me` endpoints with viewer-level access

---

## Sprint 8: Purview & Advanced Security (Weeks 15-16)

**Goal**: Deep Purview integration and advanced security features.

### Feature 8.1: Full Purview DLP Integration
- **Status**: PARTIAL (UI exists, backend limited)
- **Description**: Full integration with Microsoft Purview DLP policies.
- **Sub-features**:
  - Fetch DLP policies from Graph API
  - DLP policy compliance status per policy
  - DLP incident tracking (policy matches, violations)
  - DLP policy recommendations based on data classification
  - Enable/disable DLP policies via remediation
- **Implementation**:
  - New: `apps/api/src/lib/purview/dlp-engine.ts`
  - API: `/api/security/purview/dlp` endpoints
  - Enhance: Purview UI components with real data

### Feature 8.2: Sensitivity Label Management
- **Description**: Manage and monitor Microsoft Information Protection sensitivity labels.
- **Sub-features**:
  - List all sensitivity labels with usage statistics
  - Track label adoption rate across documents
  - Identify unlabeled documents in sensitive locations
  - Recommend labeling policies based on content type
- **Implementation**:
  - New: `apps/api/src/lib/purview/labels-engine.ts`
  - API: `/api/security/purview/labels`

### Feature 8.3: Zero Trust Assessment
- **Description**: NEW — Evaluate tenant against Zero Trust architecture principles.
- **Sub-features**:
  - Check: identity verification (MFA, passwordless), device compliance, network security, application security, data protection, infrastructure
  - Zero Trust maturity score (0-100)
  - Comparison against Microsoft Zero Trust deployment guide
  - Step-by-step remediation roadmap
- **Implementation**:
  - New: `apps/api/src/lib/security/zero-trust-engine.ts`
  - Frontend: Zero Trust assessment page at `/security/zero-trust`

---

## Sprint 9: Event-Driven Architecture (Weeks 17-18)

**Goal**: Complete webhook-to-workflow bridge and real-time event bus.

### Feature 9.1: Webhook-to-Workflow Bridge
- **Status**: PARTIAL (webhooks received but not mapped to workflows)
- **Description**: Automatically trigger workflows when Graph webhooks fire.
- **Sub-features**:
  - Map webhook resource types to workflow triggers (e.g., "user.deleted" triggers offboarding workflow)
  - Configurable trigger rules per tenant
  - Event filtering (only trigger on specific conditions)
  - Event deduplication (prevent duplicate workflow runs)
  - Event replay for missed webhooks
- **Implementation**:
  - Enhance: `apps/api/src/lib/webhook-processor.ts` with workflow dispatch
  - New: `apps/api/src/lib/event-bridge.ts`
  - API: `/api/webhooks/triggers` CRUD for trigger rules

### Feature 9.2: Advanced Conditional Triggers
- **Description**: Enhanced conditional logic with AND/OR/NOT operators and dynamic thresholds.
- **Sub-features**:
  - Condition builder UI: drag-and-drop condition groups
  - Operators: equals, contains, greater than, less than, regex match
  - Boolean logic: AND, OR, NOT, nested groups
  - Dynamic thresholds: "if failed logins > 2x baseline"
  - Time-based conditions: "only between 9 AM - 5 PM", "not on weekends"
- **Implementation**:
  - New: `apps/api/src/lib/workflows/condition-evaluator.ts`
  - Frontend: Condition builder component

### Feature 9.3: Event Audit Trail
- **Description**: NEW — Complete audit trail for all webhook events and workflow triggers.
- **Sub-features**:
  - Log every incoming webhook with payload, timestamp, processing result
  - Track event-to-workflow mapping decisions
  - Event replay capability for debugging
  - Event volume metrics and rate limiting alerts
- **Implementation**:
  - DB: `webhook_events` table
  - API: `/api/events/log` with filtering

---

## Sprint 10: Polish, Performance & Launch (Weeks 19-20)

**Goal**: Production readiness, performance optimization, and launch preparation.

### Feature 10.1: E2E Test Suite Completion
- **Description**: Complete all 198 browser tests in CLAUDE_BROWSER_TEST_SUITE.md to 100% pass rate.
- **Sub-features**:
  - Fix remaining 3 failing tests (team page, security routes, OpenClaw)
  - Add Playwright automation for critical P0 tests
  - CI/CD pipeline runs E2E tests on every PR
  - Visual regression testing for UI components
- **Implementation**:
  - Update Playwright tests in `tests/e2e/`
  - Add to GitHub Actions workflow

### Feature 10.2: Performance Optimization
- **Description**: Optimize load times, API response times, and bundle size.
- **Sub-features**:
  - Lazy-load heavy components (charts, diff viewer, report builder)
  - API response caching for expensive Graph queries (KV with TTL)
  - Database query optimization (add missing indexes)
  - Bundle analysis and tree-shaking
  - Target: <2s initial load, <500ms API responses
- **Implementation**:
  - Analyze with `npx vite-bundle-visualizer`
  - Add KV caching layer to Graph queries
  - Review D1 query plans

### Feature 10.3: Documentation
- **Description**: Complete user and developer documentation.
- **Sub-features**:
  - User guide: getting started, connecting tenant, running scans, interpreting results
  - API documentation: OpenAPI spec for all 60+ endpoints
  - Developer guide: architecture, contributing, local setup
  - Admin guide: deployment, configuration, monitoring
- **Implementation**:
  - User docs: `/docs/user-guide.md`
  - API docs: Auto-generate from Hono routes
  - Architecture: `/docs/architecture.md`

### Feature 10.4: Launch Checklist
- **Description**: Final verification before production launch.
- **Sub-features**:
  - Security audit: SAST, DAST, dependency scan, secret scan
  - Performance audit: Lighthouse scores, Core Web Vitals
  - Accessibility audit: WCAG 2.1 AA compliance
  - Legal: Terms of service, privacy policy, DPA
  - Monitoring: error tracking (Sentry), uptime monitoring, alerting
  - Runbook: incident response procedures
  - Rollback plan: documented rollback procedure for each component
- **Implementation**:
  - Checklist doc: `/docs/launch-checklist.md`
  - CI pipeline additions for security scanning

---

## Dependencies & Risk Matrix

| Sprint | Depends On | Risk Level | Key Risk |
|--------|-----------|------------|----------|
| Sprint 1 | None | Low | Well-defined scope, existing framework |
| Sprint 2 | None | Medium | SOC2/HIPAA/GDPR mapping requires domain expertise |
| Sprint 3 | Sprint 1 (approval gate reuses remediation) | Medium | Guest/group cleanup needs careful Graph API pagination |
| Sprint 4 | Sprint 3 (backup cron) | Medium | Push notifications require service worker testing |
| Sprint 5 | None | Low | AI streaming is well-supported by Claude API |
| Sprint 6 | Sprint 4 (backup health) | High | Delta queries require careful state management |
| Sprint 7 | Sprint 1 (delegation uses remediation) | Low | UI-heavy, well-scoped |
| Sprint 8 | None | High | Purview APIs may require additional Azure permissions |
| Sprint 9 | Sprint 3 (workflow engine) | Medium | Event bridge complexity |
| Sprint 10 | All sprints | Low | Integration testing across all features |

---

## Capacity Planning

| Sprint | Estimated Story Points | New Files | Modified Files |
|--------|----------------------|-----------|----------------|
| Sprint 1 | 21 | 5 | 8 |
| Sprint 2 | 34 | 12 | 6 |
| Sprint 3 | 34 | 10 | 8 |
| Sprint 4 | 29 | 8 | 6 |
| Sprint 5 | 21 | 6 | 4 |
| Sprint 6 | 29 | 8 | 4 |
| Sprint 7 | 21 | 6 | 4 |
| Sprint 8 | 26 | 6 | 4 |
| Sprint 9 | 21 | 6 | 4 |
| Sprint 10 | 21 | 8 | 10 |
| **Total** | **257** | **75** | **58** |

---

## Success Criteria

At the end of Sprint 10:
- All 72 vision features at IMPLEMENTED status
- All expanded sub-features delivered
- 100% pass rate on browser test suite
- 90%+ unit test coverage on critical paths
- <2s page load, <500ms API response
- Zero critical/high security vulnerabilities
- Complete documentation for users, developers, and admins
