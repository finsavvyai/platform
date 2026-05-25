# TenantIQ -- Comprehensive Requirements Specification

**Project**: TenantIQ -- AI-Powered M365 Security, Compliance & Cost Intelligence for MSPs
**Version**: 3.0
**Date**: 2026-03-29
**Status**: Active Development (76% Readiness)
**Scope**: Full project analysis -- existing features, gaps, and priority roadmap

---

## Executive Summary

TenantIQ is an enterprise-grade Microsoft 365 tenant management platform for Managed Service Providers (MSPs). It provides real-time anomaly detection, CIS benchmark automation, AI-powered remediation, and skill-based pricing. Built on Cloudflare Workers + Hono API, SvelteKit 2.15 + Svelte 5 frontend, Drizzle ORM with D1, and Clerk authentication.

The platform currently implements 72 core features across 10 modules with 70+ API routes, 60+ UI components, 27 sidebar navigation pages, and 100+ CIS benchmark controls. Five priority features remain for enterprise readiness: Enterprise SSO, Copilot Readiness Assessment, Config Snapshot & Drift Detection, Storage Analytics & Quotas, and Admin Panel & Observability.

---

## Table of Contents

1. [Existing Feature Requirements (Implemented)](#1-existing-feature-requirements-implemented)
2. [Gap Analysis -- Existing Feature Deficiencies](#2-gap-analysis--existing-feature-deficiencies)
3. [Priority Feature Requirements (Not Yet Complete)](#3-priority-feature-requirements-not-yet-complete)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Security Requirements](#5-security-requirements)
6. [Testing Requirements](#6-testing-requirements)
7. [User Stories & Personas](#7-user-stories--personas)
8. [Technical Constraints & Dependencies](#8-technical-constraints--dependencies)
9. [Production Readiness Gaps](#9-production-readiness-gaps)

---

## 1. Existing Feature Requirements (Implemented)

### 1.1 Intelligence Engine

**FR-1.1.1**: Inactive User Detection
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Detect users with no sign-in for 30/60/90 days
  - [x] Cross-reference with license cost to calculate monthly cost at risk
  - [x] Generate optimization alerts via the intelligence `/trigger-scan` endpoint
  - [x] Fetch `signInActivity` from Graph API via user-sync cron
  - [ ] Configurable inactivity thresholds per tenant (currently hardcoded)
  - [ ] Scheduled auto-scans without manual trigger

**FR-1.1.2**: License Waste Analysis
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] `/licenses/waste` endpoint queries DB for utilization
  - [x] Intelligence engine supports `license_waste` scan type
  - [x] CSV export for license data
  - [x] AI-powered cost optimizer and license autopilot
  - [ ] Per-SKU cost data from Microsoft Commerce API (currently estimates)
  - [ ] License downgrade recommendation engine with ROI projections

**FR-1.1.3**: Security Misconfiguration Scanning
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] CIS benchmark scanner evaluates 100+ controls
  - [x] Security posture endpoint analyzes MFA, conditional access, risky users
  - [x] Daily security scan cron
  - [x] Multiple security baselines (commercial, regulated)
  - [x] Remediation guidance per control

**FR-1.1.4**: Threat Detection
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Anomaly detection for geographic anomalies and brute force patterns
  - [x] Sign-in logs page with filterable data
  - [x] Risky users fetched from Graph API Identity Protection
  - [x] Behavior analysis UI
  - [ ] Real-time alerting on threat detection (currently batch)

**FR-1.1.5**: Compliance Gap Identification
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] SOC 2, HIPAA, GDPR compliance engines with gap analysis
  - [x] CIS benchmark scanning (100+ controls)
  - [x] Compliance posture aggregation across frameworks
  - [x] Remediation guidance per compliance gap
  - [ ] Custom compliance framework support

**FR-1.1.6**: Backup Health Monitoring
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Backup health rules detect missed/failed backups
  - [x] Nightly backup cron with failure detection
  - [x] Backup health API endpoint
  - [ ] Backup SLA reporting per tenant

### 1.2 Alert & Recommendation System

**FR-1.2.1**: Real-Time Alert Dashboard
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Alert cards with severity indicators, affected user counts, action buttons
  - [x] SSE support for live updates
  - [x] Severity badges and metric cards
  - [x] Alert detail panel with full context

**FR-1.2.2**: Severity-Based Prioritization
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Risk scoring and severity-based ordering
  - [x] `?prioritize=true` query parameter support
  - [x] Business impact scoring

**FR-1.2.3**: AI-Powered Recommendations
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Claude AI analyzes alerts and generates recommendations
  - [x] AI-generated remediation steps and outcome predictions
  - [x] Executive report synthesis

**FR-1.2.4**: Alert History & Trends
- Priority: Medium
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Alert lifecycle tracking (created, acknowledged, resolved, dismissed)
  - [x] Alert analytics with trend data, distribution charts, recurring patterns
  - [x] Score trend chart component

### 1.3 Remediation Engine

**FR-1.3.1**: One-Click Remediation Actions (9 actions)
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Decommission User (disable account, revoke licenses)
  - [x] Enable Conditional Access Policy
  - [x] Block Malicious IP
  - [x] Downgrade License (E5 to E3)
  - [x] Revoke Sessions
  - [x] Force Password Reset
  - [x] Remove Guest User
  - [x] Enable MFA
  - [x] Restrict External Sharing

**FR-1.3.2**: Dry-Run Preview
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] `/remediations/dry-run` endpoint
  - [x] Shows before/after state diff
  - [ ] Frontend diff modal with green/red highlighting

**FR-1.3.3**: Rollback Capability
- Priority: High
- Status: PARTIAL
- Acceptance Criteria:
  - [x] Rollback framework exists
  - [x] `POST /remediations/:id/rollback` endpoint
  - [ ] Complete rollback logic for all 9 actions
  - [ ] Rollback audit logging with reason field
  - [ ] Frontend "Undo" button on remediation history

**FR-1.3.4**: Remediation Scheduling
- Priority: Medium
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Schedule remediations for specific times
  - [x] Queue with delay using Cloudflare Queue

### 1.4 AI Agent (Conversational)

**FR-1.4.1**: Natural Language Security Analysis
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Claude API integration for tenant analysis
  - [x] Streaming responses via SSE
  - [x] Conversation export functionality
  - [x] Context-aware responses using tenant data

### 1.5 Automated Workflows

**FR-1.5.1**: Workflow CRUD & Execution
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Create workflows with trigger types: cron, webhook, manual, conditional
  - [x] Multi-step workflow execution with skip/abort/retry on failure
  - [x] Approval gates for sensitive workflows
  - [x] Guest review and group cleanup workflows
  - [x] Nightly backup cron execution
  - [x] Workflow run history and status tracking

### 1.6 Backup & Recovery

**FR-1.6.1**: Encrypted Backup System
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] AES-256-GCM encrypted backups of M365 tenant data
  - [x] Backup stored in Cloudflare R2
  - [x] Nightly backup cron with failure alerting
  - [x] Backup health analysis with compliance validation (GDPR, HIPAA, SOC2)
  - [ ] Incremental backup support
  - [ ] Content-level backup (individual mailboxes, sites)
  - [ ] Cross-tenant migration capability

### 1.7 User & License Management

**FR-1.7.1**: User Lifecycle Management
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] 10 Graph API actions for user management
  - [x] Lifecycle templates for onboarding/offboarding
  - [x] Bulk user operations
  - [x] User delegation with time-limited access

### 1.8 Security & Compliance Dashboard

**FR-1.8.1**: CIS Benchmark Automation
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] 100+ CIS controls with pass/fail/partial evaluation
  - [x] Score calculation with section breakdown
  - [x] Auto-remediation for supported controls
  - [x] Historical scan comparison
  - [x] CIS scan results persist and cache

**FR-1.8.2**: Zero Trust Assessment
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Zero trust readiness scoring
  - [x] API route and frontend page

**FR-1.8.3**: Copilot Security Monitoring
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Prompt injection detection (CPG-001)
  - [x] Sensitivity escalation alerts (CPG-002)
  - [x] Bulk data access detection (CPG-003)

### 1.9 Audit & Reporting

**FR-1.9.1**: Audit Logging
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Audit logs for auth events, admin actions, sensitive data mutations
  - [x] Filterable by actor, action, resource type, date range
  - [x] Zod-validated filter inputs

**FR-1.9.2**: Executive Reports
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] AI-generated executive report synthesis
  - [x] PDF export capability
  - [x] Custom report builder

### 1.10 Real-Time Monitoring & Webhooks

**FR-1.10.1**: Webhook Configuration & Delivery
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Webhook configs with URL, secret, notification mode
  - [x] Severity filtering and category filtering
  - [x] Quiet hours support
  - [x] Delivery tracking with retry logic
  - [x] Webhook retry cron

**FR-1.10.2**: Event-Driven Architecture
- Priority: Medium
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Event triggers and event log endpoints
  - [x] Event bridge for webhook-to-workflow integration
  - [x] OpenClaw integration for external event ingestion

### 1.11 Multi-Tenant Architecture

**FR-1.11.1**: Organization & Tenant Isolation
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] All DB queries scoped to current org (`WHERE org_id = ...`)
  - [x] Tenant switcher in UI
  - [x] Tenant comparison across managed tenants
  - [x] MSP benchmark comparison

**FR-1.11.2**: Team Management
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Invite team members with role selection
  - [x] Roles: tenant_admin, tenant_operator, tenant_viewer
  - [x] Remove members (soft delete)
  - [x] Change member roles
  - [x] Revoke pending invitations
  - [ ] Invitation email delivery (URL generated but email sending not confirmed)

### 1.12 Billing & Subscription

**FR-1.12.1**: LemonSqueezy Integration
- Priority: Critical
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Checkout flow for starter/professional/enterprise plans
  - [x] Webhook handling: subscription_created, updated, cancelled, expired, payment_failed
  - [x] Subscription status API
  - [x] Cancel subscription at end of billing period
  - [x] Trial gating on security features (certificates, policies blurred for free users)

### 1.13 Skill Marketplace

**FR-1.13.1**: Skill-Based Feature Gating
- Priority: High
- Status: IMPLEMENTED
- Acceptance Criteria:
  - [x] Server-side skill gate middleware
  - [x] Skill activation with active/trial/locked states
  - [x] Trial expiry checking
  - [x] Free skills (dashboard, health) always available
  - [x] Graceful degradation for existing tenants without skill data
  - [x] 20 skills: backup, compliance, cost optimization, etc.

---

## 2. Gap Analysis -- Existing Feature Deficiencies

### GAP-001: Incomplete Rollback for Remediation Actions
- Severity: High
- Description: The rollback framework exists but individual action rollbacks are incomplete for several of the 9 remediation actions. `beforeState` snapshots are not consistently stored.
- Impact: Users cannot reliably undo security remediations, creating risk for production environments.
- Required Work:
  - Complete `rollback()` for all 9 actions
  - Store `beforeState` snapshot before every execution
  - Add rollback status tracking (pending, in_progress, completed, failed)
  - Frontend "Undo" button on remediation history
  - Rollback audit logging

### GAP-002: No Frontend Unit Tests
- Severity: High
- Description: 86 API test files exist, but 0 frontend test files. The web app has 60+ components with no unit test coverage.
- Impact: Regression risk is high for UI changes. Portfolio CLAUDE.md requires 90% line coverage overall.
- Required Work:
  - Set up Vitest for SvelteKit component testing
  - Write tests for all critical components (TrialGate, Sidebar, AlertCard, CIS controls, etc.)
  - Target 90% line coverage for `apps/web/src/`

### GAP-003: Limited E2E Test Coverage
- Severity: High
- Description: Only 1 e2e spec file exists (`audit-prod.spec.ts` at 198 lines). CLAUDE.md references 127 tests across 21 sections but they are not present.
- Impact: Critical user flows are not automated. Manual testing is required for every release.
- Required Work:
  - Implement e2e tests for all 8 critical flows defined in CLAUDE.md
  - Cover all 4 personas (MSP admin, tenant engineer, contractor, free-tier)
  - Reach 127 tests across 21 sections

### GAP-004: Missing CI/CD Pipeline
- Severity: Critical
- Description: No GitHub Actions workflow files found. Portfolio CLAUDE.md requires CI to run unit, integration, and smoke tests for every PR, plus SAST, dependency vulnerability, secret scan, and license compliance scans.
- Impact: No automated quality gates. PRs can be merged with failing tests, security vulnerabilities, or coverage regressions.
- Required Work:
  - Create `.github/workflows/ci.yml` with test, lint, typecheck, coverage
  - Add SAST scanning (e.g., Semgrep)
  - Add dependency vulnerability scanning
  - Add secret scanning
  - Add license compliance scanning
  - Enforce coverage thresholds (90% line, 85% branch, 100% critical paths)

### GAP-005: Inactivity Thresholds Not Configurable Per Tenant
- Severity: Medium
- Description: Inactive user detection uses hardcoded 30/60/90-day thresholds. MSP customers need per-tenant customization.
- Impact: Inflexible for enterprises with different compliance requirements.
- Required Work:
  - Add `tenant_settings` table or KV-based per-tenant config
  - Allow threshold configuration via Settings UI
  - Pass tenant-specific thresholds to intelligence engine

### GAP-006: Real-Time Threat Alerting Gap
- Severity: Medium
- Description: Threat detection runs in batch mode (cron-based scans). No real-time streaming for high-severity threats.
- Impact: Critical threats may go unnoticed for hours between scan intervals.
- Required Work:
  - Implement Graph API change notifications (webhooks from Microsoft)
  - Process security events in real-time via Cloudflare Queue
  - Push alerts via SSE, push notifications, and configured webhook channels

### GAP-007: Auth Uses HS256 JWT
- Severity: Medium
- Description: The auth system uses HS256 symmetric JWTs with a shared `JWT_SECRET`. CLAUDE.md references Clerk (RS256) but the actual implementation uses custom JWT verification with `jose`.
- Impact: HS256 is less secure than RS256 for distributed systems. The shared secret is a single point of compromise.
- Required Work:
  - Evaluate migrating to RS256 with public/private key pair
  - Or fully integrate Clerk JWT verification as documented

### GAP-008: Feature Flag System Limited
- Severity: Low
- Description: Feature flags are boolean-only with no targeting rules, no percentage rollouts, and no user/org-level targeting.
- Impact: Cannot gradually roll out features to specific tenants or user segments.
- Required Work:
  - Add targeting rules (org-level, plan-level, percentage rollout)
  - Add feature flag management UI in platform admin

### GAP-009: Missing Input Validation on Several Routes
- Severity: Medium
- Description: While Zod schemas exist in `packages/shared/src/schemas.ts`, not all API routes use them. Several routes parse `c.req.json()` without Zod validation (e.g., team invite, config snapshot capture).
- Impact: Invalid input could cause unexpected behavior or security issues.
- Required Work:
  - Audit all routes for Zod validation
  - Create shared validation middleware
  - Apply to all POST/PUT/PATCH endpoints

### GAP-010: Migration Feature Disabled
- Severity: Low
- Description: `MIGRATION_ENABLED` flag is set to `false` -- cross-tenant migration is not production-ready.
- Impact: Cannot migrate data between tenants, a feature requested by MSPs.

---

## 3. Priority Feature Requirements (Not Yet Complete)

### 3.1 Enterprise SAML/OIDC SSO

**FR-3.1.1**: Per-Organization SSO Provider Configuration
- Priority: Critical (enterprise sales blocker)
- Description: Allow each organization to configure their own SAML 2.0 or OIDC identity provider for single sign-on.
- Acceptance Criteria:
  - [ ] Settings page to configure SSO provider per organization
  - [ ] Support SAML 2.0 with metadata URL or XML upload
  - [ ] Support OIDC with discovery URL, client ID, and client secret
  - [ ] Store provider config encrypted in D1 (`sso_configs` table)
  - [ ] SSO-initiated login flow (IdP-initiated and SP-initiated)
  - [ ] Fallback to standard login if SSO is not configured
  - [ ] SSO session management with configurable session duration
  - [ ] Admin can enforce SSO-only login (disable password auth for org)

**FR-3.1.2**: Just-in-Time User Provisioning
- Priority: Critical
- Acceptance Criteria:
  - [ ] Auto-create platform_users on first SSO login
  - [ ] Map SAML attributes / OIDC claims to TenantIQ user fields (email, name, role)
  - [ ] Configurable default role for JIT-provisioned users
  - [ ] Attribute-to-role mapping rules (e.g., group claim "admins" -> tenant_admin)
  - [ ] Deprovisioning: disable user when removed from IdP group
  - [ ] Audit log entry for each JIT provisioning event

**FR-3.1.3**: IdP Testing & Validation
- Priority: High
- Acceptance Criteria:
  - [ ] Test connection button that validates IdP configuration
  - [ ] Support verified with Okta, Azure AD (Entra ID), and Google Workspace
  - [ ] Error messages with actionable guidance when configuration fails
  - [ ] SSO debug log for troubleshooting

**FR-3.1.4**: SSO Migration Path
- Priority: Medium
- Acceptance Criteria:
  - [ ] Existing email/password users can link to SSO identity
  - [ ] Grace period where both auth methods work during migration
  - [ ] Admin notification when SSO is configured for first time
  - [ ] Rollback: admin can disable SSO and restore password auth

### 3.2 Copilot Readiness Assessment

**FR-3.2.1**: Readiness Scan Engine
- Priority: High
- Status: PARTIAL (API routes exist, assessment engine basic)
- Description: Comprehensive scan of M365 tenant for Copilot deployment readiness.
- Acceptance Criteria:
  - [x] `POST /api/copilot-readiness/assess` endpoint (skill-gated)
  - [x] Cache results in KV with 2-hour TTL
  - [x] Historical assessment tracking
  - [ ] Scan dimensions: data governance, security posture, license readiness, user readiness, information architecture
  - [ ] Score each dimension 0-100 with weighted overall score
  - [ ] Check: sensitivity labels configured and applied
  - [ ] Check: DLP policies active for sensitive content
  - [ ] Check: SharePoint/OneDrive permissions not overshared
  - [ ] Check: external sharing policies appropriate
  - [ ] Check: eligible licenses (E3/E5 + Copilot add-on) assigned
  - [ ] Check: user training completion status (if available via Graph)

**FR-3.2.2**: Readiness Report & Export
- Priority: High
- Acceptance Criteria:
  - [ ] Generate PDF report with readiness scores per dimension
  - [ ] Include actionable recommendations ranked by impact
  - [ ] Executive summary suitable for stakeholder presentations
  - [ ] Comparison view: readiness score over time (trend chart)
  - [ ] Benchmark against industry averages (MSP benchmark data)

**FR-3.2.3**: Copilot Usage Analytics
- Priority: Medium
- Status: PARTIAL (route exists)
- Acceptance Criteria:
  - [x] `/api/copilot-usage` endpoint
  - [ ] Track Copilot adoption rates per user/department
  - [ ] Identify power users vs inactive Copilot license holders
  - [ ] Calculate Copilot ROI (productivity gains vs license cost)
  - [ ] Surface data access anomalies via Copilot interactions

### 3.3 Config Snapshot & Drift Detection

**FR-3.3.1**: Configuration Capture
- Priority: High
- Status: IMPLEMENTED (capture, list, view, diff endpoints exist)
- Acceptance Criteria:
  - [x] `POST /api/config-snapshots/capture` captures M365 configuration state
  - [x] Store snapshots in KV with manifest and per-category data
  - [x] List snapshots ordered by creation date
  - [x] View individual snapshot categories
  - [ ] Capture all critical config categories: conditional access, auth methods, security defaults, mail flow rules, DLP policies, compliance policies, Azure AD roles
  - [ ] Scheduled automatic snapshots (daily/weekly via cron)
  - [ ] Snapshot labeling and tagging for compliance audits

**FR-3.3.2**: Snapshot Diff & Comparison
- Priority: High
- Status: IMPLEMENTED (diff endpoint exists)
- Acceptance Criteria:
  - [x] `GET /api/config-snapshots/:id/diff/:otherId` computes diff
  - [x] Diff categorized by config section
  - [ ] Visual diff viewer in UI with side-by-side comparison
  - [ ] Highlight security-relevant changes in red
  - [ ] Export diff as PDF or JSON

**FR-3.3.3**: Drift Detection & Alerting
- Priority: High
- Status: IMPLEMENTED (cron exists with severity classification)
- Acceptance Criteria:
  - [x] Cron compares latest two snapshots per tenant
  - [x] Classifies drifts by severity (critical/high/medium/low)
  - [x] Creates alerts for critical/high severity drifts
  - [x] Stores drift reports in KV
  - [ ] Drift notification via configured channels (email, Slack, Teams)
  - [ ] Drift suppression rules (ignore known-safe changes)
  - [ ] Drift remediation: one-click revert to previous snapshot state

### 3.4 Storage Analytics & Quotas

**FR-3.4.1**: SharePoint/OneDrive Storage Scanning
- Priority: Medium
- Status: PARTIAL (basic scan exists, limited to SharePoint sites)
- Acceptance Criteria:
  - [x] `POST /api/storage-analytics/scan` fetches SharePoint site storage
  - [x] Per-site usage in GB with utilization percentage
  - [x] Summary with total/used storage and site count
  - [x] Results cached in KV for 1 hour
  - [ ] OneDrive per-user storage scanning
  - [ ] Mailbox storage scanning (Exchange Online)
  - [ ] Storage growth trend analysis (week-over-week, month-over-month)
  - [ ] Large file detection (files over configurable threshold)
  - [ ] Orphaned content detection (content in deleted user OneDrives)

**FR-3.4.2**: Quota Management & Recommendations
- Priority: Medium
- Acceptance Criteria:
  - [ ] Quota alerts when storage exceeds configurable thresholds (80%, 90%, 95%)
  - [ ] Per-user storage reports with ranking
  - [ ] Unused license detection (users with storage but no sign-in)
  - [ ] Automated cleanup recommendations (stale sites, old versions, recycled items)
  - [ ] Cost projection: estimated storage costs based on growth rate

**FR-3.4.3**: Storage Compliance
- Priority: Medium
- Acceptance Criteria:
  - [ ] Identify sites/drives without retention policies
  - [ ] Check for PII/sensitive data in unprotected locations
  - [ ] Storage governance report for compliance audits

### 3.5 Admin Panel & Observability

**FR-3.5.1**: Platform Admin Dashboard
- Priority: High
- Status: PARTIAL (basic admin stats route exists)
- Acceptance Criteria:
  - [x] Platform admin role check (admin, super_admin, platform_admin)
  - [x] Basic stats: total users, active users, total orgs, active subscriptions, monthly revenue
  - [x] Recent signups and recent logins lists
  - [ ] Real-time platform health dashboard (API response times, error rates, queue depths)
  - [ ] Tenant health overview: sync status, last scan time, alert counts per tenant
  - [ ] Revenue analytics: MRR, churn rate, ARPU, plan distribution
  - [ ] Usage analytics: feature adoption rates, skill activation rates
  - [ ] System resource utilization (D1 row counts, KV key counts, R2 storage used)

**FR-3.5.2**: Sync Job Monitoring
- Priority: High
- Acceptance Criteria:
  - [ ] Dashboard showing all sync jobs (user-sync, security-scan, compliance-scan, drift-detection, etc.)
  - [ ] Per-job status: last run time, duration, success/failure, items processed
  - [ ] Error log viewer with stack traces and affected tenants
  - [ ] Manual re-trigger button for failed jobs
  - [ ] Sync job performance trends over time

**FR-3.5.3**: Tenant Health Monitoring
- Priority: High
- Acceptance Criteria:
  - [ ] Health score per tenant (composite of: token validity, last sync age, alert count, CIS score)
  - [ ] Unhealthy tenant detection with automatic alerts to platform admins
  - [ ] Token expiry monitoring with proactive refresh
  - [ ] Data freshness indicators (last sync timestamps per data type)

**FR-3.5.4**: Admin Notification System
- Priority: Medium
- Status: PARTIAL (admin-notifications route exists)
- Acceptance Criteria:
  - [x] Admin notifications endpoint
  - [ ] Platform-wide announcements to all users
  - [ ] Maintenance window scheduling with advance notification
  - [ ] Degraded service notifications
  - [ ] New feature announcements

---

## 4. Non-Functional Requirements

### NFR-001: Performance

**NFR-001.1**: API Response Time
- All read endpoints must respond within 200ms (p95) from Cloudflare edge
- Write endpoints must respond within 500ms (p95)
- AI-powered endpoints (Claude analysis) must respond within 10 seconds
- Streaming endpoints must send first byte within 1 second

**NFR-001.2**: Frontend Performance
- Largest Contentful Paint (LCP) under 2.5 seconds
- First Input Delay (FID) under 100ms
- Cumulative Layout Shift (CLS) under 0.1
- Time to Interactive (TTI) under 3 seconds
- Loading skeletons must appear within 200ms (no blank flash)

**NFR-001.3**: Data Sync Performance
- Full tenant sync (users + licenses + security) must complete within 60 seconds for tenants with up to 10,000 users
- Incremental sync must complete within 15 seconds
- CIS benchmark scan must complete within 30 seconds

### NFR-002: Scalability

**NFR-002.1**: Tenant Scale
- Support 1,000 concurrent organizations
- Support up to 50 managed tenants per MSP organization
- Support up to 100,000 cached M365 users per tenant

**NFR-002.2**: Data Scale
- D1 must handle up to 10 million rows across all tables
- KV must handle up to 1 million keys with acceptable read latency
- R2 must handle up to 10TB of backup storage

**NFR-002.3**: API Rate Limits
- Auth endpoints: 20 requests per 5 minutes per IP (currently configured)
- Standard API endpoints: 100 requests per minute per user
- Scan/sync endpoints: 10 requests per minute per tenant
- Microsoft Graph API: respect Graph throttling (429) with exponential backoff

### NFR-003: Reliability

**NFR-003.1**: Availability
- Target 99.9% uptime for API endpoints
- Graceful degradation when external services (Graph API, Claude API) are unavailable
- Automatic retry with exponential backoff for transient failures

**NFR-003.2**: Data Durability
- Backup data encrypted and stored in R2 with cross-region redundancy
- D1 database with automatic backups
- KV data with TTL-based expiry (not relied upon for durable storage)

**NFR-003.3**: Error Handling
- All API errors return structured JSON: `{ error: string, details?: unknown }`
- Sentry integration for error tracking and alerting
- Structured logging via custom logger
- No unhandled promise rejections in production

### NFR-004: Accessibility

**NFR-004.1**: WCAG 2.1 AA Compliance
- Minimum contrast ratio 4.5:1 for normal text, 3:1 for large text
- All interactive elements keyboard navigable
- Screen reader labels on all form inputs and buttons
- Focus trap in modals and slide-over panels
- Dark mode support with proper contrast in both themes

### NFR-005: Internationalization

**NFR-005.1**: Language Support
- Priority: Low (post-launch)
- English-only for initial launch
- Architecture must support future i18n without major refactoring
- Date/time formatting must respect user locale

---

## 5. Security Requirements

### SEC-001: Authentication & Authorization

**SEC-001.1**: Session Security
- JWT tokens with 24-hour expiry
- Token refresh endpoint with clock tolerance
- Session invalidation on logout (KV-based session store)
- Rate limiting on auth endpoints (20 req/5min per IP)
- Audit logging for all auth events (login, logout, refresh)

**SEC-001.2**: Multi-Tenant Isolation
- All database queries must include organization/tenant scope
- No cross-tenant data leakage in API responses
- Tenant context validated via middleware before route handlers

**SEC-001.3**: Role-Based Access Control
- Platform roles: admin, super_admin, platform_admin
- Tenant roles: tenant_admin, tenant_operator, tenant_viewer
- Admin-only operations: team management, billing, SSO configuration
- Viewer restrictions: read-only access, no remediation execution

### SEC-002: Data Protection

**SEC-002.1**: Encryption
- Graph API tokens encrypted at rest (access_token_encrypted, refresh_token_encrypted in D1)
- Backup data encrypted with AES-256-GCM per tenant
- Webhook secrets stored encrypted
- All transport over HTTPS (HSTS enforced in production)

**SEC-002.2**: Secret Management
- No secrets in source code or environment variables exposed to client
- API keys validated at startup via `validateEnv`
- Graph API tokens stored in KV with TTL, not in client-accessible storage

### SEC-003: Security Headers
- Content-Security-Policy enforced
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- HSTS in production (max-age=31536000)

### SEC-004: Input Validation
- All API inputs must be validated with Zod schemas
- Output encoding for all user-generated content in UI
- SQL injection prevention via Drizzle ORM parameterized queries
- CORS restricted to allowed origins only

### SEC-005: Compliance Scanning (CI/CD)
- SAST scan on every PR
- Dependency vulnerability scan on every PR
- Secret scanning on every PR
- License compliance scan on every PR
- Block release on any unresolved Critical or High vulnerability

---

## 6. Testing Requirements

### TEST-001: Unit Testing

**TEST-001.1**: API Unit Tests
- Framework: Vitest
- Current: 86 test files in `apps/api/src/routes/`
- Target: 100% coverage for critical paths (auth, billing, remediations, CIS engine)
- Target: 90% line coverage, 85% branch coverage overall

**TEST-001.2**: Frontend Unit Tests
- Framework: Vitest + @testing-library/svelte
- Current: 0 test files
- Required:
  - [ ] All UI components in `apps/web/src/lib/components/`
  - [ ] All Svelte stores (auth, tenant, skills, toast, theme)
  - [ ] All utility functions
  - [ ] Routing guards and auth hooks
  - [ ] Target: 90% line coverage

**TEST-001.3**: Shared Package Tests
- Current: `schemas.test.ts` in shared package
- Required:
  - [ ] All Zod schemas validated with valid/invalid inputs
  - [ ] Type guard functions tested
  - [ ] Constants verified

### TEST-002: Integration Testing

**TEST-002.1**: API Integration Tests
- Test API endpoints with real D1 test database (miniflare)
- Test Graph API integrations with stub responses
- Test Clerk webhook payloads
- Test workflow execution end-to-end
- Test billing webhook handling

### TEST-003: End-to-End Testing

**TEST-003.1**: Critical Flow Coverage (Playwright)
- Flow 1: MSP login -> Connect Azure tenant -> Sync users/licenses -> Dashboard populated
- Flow 2: Trigger CIS scan -> View control results -> Auto-remediate control
- Flow 3: Email threat detected -> View alert -> Acknowledge -> Notification cleared
- Flow 4: Configure compliance workflow -> Schedule execution -> View history
- Flow 5: Setup Copilot readiness assessment -> View scores -> Export as PDF
- Flow 6: Invite team member -> Accept invitation -> Access tenant with correct role
- Flow 7: Create skill -> Install -> Monitor execution
- Flow 8: Multi-tenant: Switch between 2 orgs -> Verify data isolation

**TEST-003.2**: Persona-Based Testing
- MSP Admin: full access, billing, team management
- Tenant Engineer: read security, create workflows, no billing
- Contractor: read-only, limited time access via invitation
- Free-tier: 1 tenant, core features only, trial gates enforced

---

## 7. User Stories & Personas

### Persona 1: MSP Administrator (Primary)

**US-001**: As an MSP admin, I want to connect multiple Microsoft 365 tenants so I can manage all my clients' security from a single dashboard.
- Acceptance: Onboarding wizard guides through Azure AD app registration, consent grant, and first sync.

**US-002**: As an MSP admin, I want to run CIS benchmark scans across all tenants so I can identify security gaps before they become incidents.
- Acceptance: Batch scan trigger, per-tenant score comparison, MSP benchmark ranking.

**US-003**: As an MSP admin, I want to auto-remediate common security issues so I can reduce my team's manual workload.
- Acceptance: One-click remediation with dry-run preview, rollback, and audit trail.

**US-004**: As an MSP admin, I want monthly executive reports for each client so I can demonstrate the value of my managed security service.
- Acceptance: AI-generated executive summary with PDF export, trend charts, and recommendations.

**US-005**: As an MSP admin, I want to configure SSO for my organization so my team can log in with our corporate identity provider.
- Acceptance: SAML/OIDC configuration in settings, JIT provisioning, enforce SSO-only login.

**US-006**: As an MSP admin, I want to assess each client's Copilot readiness so I can advise them on safe deployment.
- Acceptance: Readiness score with dimensional breakdown, PDF export, trend tracking.

### Persona 2: Tenant Engineer

**US-007**: As a tenant engineer, I want to investigate security alerts so I can understand and respond to threats quickly.
- Acceptance: Alert detail panel with AI-powered context, affected resources, recommended actions.

**US-008**: As a tenant engineer, I want to create automated workflows so repetitive security tasks run without my intervention.
- Acceptance: Workflow builder with cron/webhook/manual triggers, approval gates, run history.

**US-009**: As a tenant engineer, I want to monitor configuration drift so I can catch unauthorized changes.
- Acceptance: Snapshot comparison, drift alerts, severity classification.

### Persona 3: Contractor (Read-Only)

**US-010**: As a contractor with temporary access, I want to view security posture without being able to make changes.
- Acceptance: Viewer role restricts all write operations, time-limited invitation link.

### Persona 4: Free-Tier User

**US-011**: As a free-tier user, I want to try core features with one tenant so I can evaluate before purchasing.
- Acceptance: Dashboard, health check, basic alerts available. Security details blurred behind trial gate. Clear upgrade CTA.

---

## 8. Technical Constraints & Dependencies

### External Dependencies

| Dependency | Purpose | Risk Level | Mitigation |
|---|---|---|---|
| Microsoft Graph API | User, license, security, policy data | High | Cache in D1/KV, retry with backoff, graceful degradation |
| Anthropic Claude API | AI analysis, recommendations, reports | Medium | Fallback to rule-based analysis, cache AI results |
| LemonSqueezy | Billing, subscriptions | Medium | Webhook retry, manual reconciliation |
| Clerk | Authentication (documented, partially used) | Low | Custom JWT auth as fallback (currently primary) |
| Cloudflare D1 | Primary database | High | Single-region SQLite, monitor row limits |
| Cloudflare KV | Caching, sessions, feature flags | Medium | TTL-based, not for durable data |
| Cloudflare R2 | Backup storage | Low | Standard S3-compatible durability |
| Sentry | Error tracking | Low | Application continues without Sentry |

### Architecture Constraints

- **Max 200 lines per source file** (enforced by portfolio CLAUDE.md)
- **Cloudflare Workers runtime**: No Node.js-specific APIs, 128MB memory limit, 30s CPU time limit
- **D1 SQLite**: No foreign keys enforced at runtime, no stored procedures, 500MB database limit
- **KV eventual consistency**: Writes may take up to 60 seconds to propagate globally
- **Single-region D1**: Database is not globally distributed (latency for non-primary region users)

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| API Runtime | Cloudflare Workers + Hono | Hono latest |
| Frontend | SvelteKit + Svelte 5 | SvelteKit 2.15 |
| Database ORM | Drizzle ORM | Latest |
| Database | Cloudflare D1 (SQLite) | N/A |
| Auth | Custom JWT (jose) + Clerk (documented) | N/A |
| AI | Anthropic Claude API | Claude Sonnet/Opus |
| Billing | LemonSqueezy | API v1 |
| Monorepo | pnpm workspaces + Turborepo | Latest |
| Testing | Vitest + Playwright | Latest |

---

## 9. Production Readiness Gaps

### Critical (Must Fix Before Launch)

| ID | Gap | Impact | Effort |
|---|---|---|---|
| PROD-001 | No CI/CD pipeline | No automated quality gates, PRs merge without checks | High |
| PROD-002 | 0 frontend unit tests | UI regressions undetected | High |
| PROD-003 | 1 e2e test file vs 127 required | Critical flows not automated | High |
| PROD-004 | No SAST/dependency scanning | Security vulnerabilities undetected | Medium |
| PROD-005 | Incomplete rollback for remediation | Production risk for Graph API changes | Medium |
| PROD-006 | No rate limiting on most API routes | DDoS and abuse vulnerability | Medium |

### High (Should Fix Before Launch)

| ID | Gap | Impact | Effort |
|---|---|---|---|
| PROD-007 | Enterprise SSO not built | Blocks MSP enterprise sales | High |
| PROD-008 | Missing input validation on several routes | Security risk | Medium |
| PROD-009 | No database migration management in CI | Schema changes risky | Medium |
| PROD-010 | Platform admin dashboard incomplete | No operational visibility | Medium |
| PROD-011 | Sync job monitoring absent | Cannot detect stale data | Medium |
| PROD-012 | No structured error codes | API consumers cannot programmatically handle errors | Low |

### Medium (Address Post-Launch)

| ID | Gap | Impact | Effort |
|---|---|---|---|
| PROD-013 | Copilot readiness scan dimensions incomplete | Feature value limited | Medium |
| PROD-014 | Storage analytics limited to SharePoint sites | Missing OneDrive/Exchange | Medium |
| PROD-015 | Feature flags lack targeting rules | Cannot do gradual rollouts | Low |
| PROD-016 | No health check endpoint for load balancers | Cannot monitor uptime externally | Low |
| PROD-017 | HS256 JWT vs RS256 | Lower security for distributed auth | Medium |
| PROD-018 | No API versioning | Breaking changes affect all consumers | Low |

---

## Appendix A: Database Schema Summary

15 D1 tables defined in `packages/db/src/schema-d1.ts`:

| Table | Purpose |
|---|---|
| organizations | Multi-tenant org records with billing plan |
| tenants | Azure tenant connections with encrypted tokens |
| platform_users | TenantIQ platform users with roles |
| users_cache | Synced M365 users from Graph API |
| licenses_cache | Synced M365 license SKUs |
| user_licenses | Per-user license assignments |
| security_alerts | Generated security/optimization/compliance alerts |
| webhook_configs | Per-tenant webhook notification config |
| webhook_deliveries | Webhook delivery tracking with retry |
| config_snapshots | Configuration snapshot metadata |
| invitations | Team member invitation records |
| subscriptions | LemonSqueezy subscription records |
| audit_log | Audit trail for all platform actions |
| workflows | Automated workflow definitions |
| workflow_runs | Workflow execution history |

## Appendix B: API Route Count

155 registered routes across 75+ route files covering:
- Authentication (4 routes)
- Tenant management (15+ routes)
- Intelligence & alerts (12+ routes)
- Remediation (8+ routes)
- CIS benchmark (6+ routes)
- Config snapshots (5 routes)
- Copilot (6+ routes)
- Governance (4+ routes)
- Workflows (6+ routes)
- Users & team (8+ routes)
- Billing (4 routes)
- Reporting (8+ routes)
- Platform admin (6+ routes)
- Integrations (4+ routes)
- And 50+ additional specialized routes

## Appendix C: Cron Jobs

| Cron | Purpose | Schedule |
|---|---|---|
| user-sync | Sync M365 users from Graph API | Configurable |
| security-scan | Run security posture scan | Daily |
| compliance-scan | Run compliance framework evaluations | Configurable |
| drift-detection | Compare config snapshots, create alerts | Daily |
| guest-review | Review and flag stale guest users | Weekly |
| group-cleanup | Identify ownerless/empty groups | Weekly |
| nightly-backup | Create encrypted tenant backups | Nightly |
| scheduled-remediation | Execute queued remediations | Continuous |
| webhook-retry | Retry failed webhook deliveries | Every 5 min |
| workflow-trigger | Execute scheduled workflows | Per trigger config |
