# Sprint 10 — Enterprise Hardening & Scale — Implementation Plan

## Overview
Final sprint: SLA monitoring, data residency, extended notifications,
API versioning (route refactor), plan enforcement, security hardening,
cron job completion, and enterprise pricing page.

**Total tasks: 40** across 5 phases.

---

## Phase 1 — Foundation (Schema, Shared, Route Refactor)

### 1.1 D1 Migration 0010 — New Tables
- [x] Create `packages/db/migrations/0010_enterprise_scale.sql`
- Tables: `uptime_records`, `sla_configs`, `data_residency_configs`, `enterprise_leads`
- Add `'pagerduty'`, `'opsgenie'`, `'teams'`, `'discord'` to notification_channels channelType
  (SQLite: recreate table or accept text column — since Drizzle enum is app-level, just update schema)
- Add `'hipaa'`, `'gdpr'`, `'nist_csf'`, `'pci_dss'` to complianceReports framework enum

### 1.2 Schema Files — Uptime & Residency
- [x] Create `packages/db/src/schema/uptime.ts` (< 100 lines)
  - `uptimeRecords`: id, instanceId, checkedAt, status (up/down/degraded), responseTimeMs, checkType
  - `slaConfigs`: id, orgId (unique), targetUptime, checkIntervalMinutes, alertOnBreach, createdAt
  - `dataResidencyConfigs`: id, orgId (unique), region, storageRegion, computeRegion, enforceStrict, createdAt
- [x] Create `packages/db/src/schema/enterprise.ts` (< 50 lines)
  - `enterpriseLeads`: id, name, email, company, message, createdAt
- [x] Update `packages/db/src/schema/index.ts` — add exports for uptime + enterprise
- [x] Update `packages/db/src/schema/monitoring.ts` — extend notificationChannels channelType enum
  to include `['email', 'webhook', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord']`
- [x] Update `packages/db/src/schema/monitoring.ts` — extend complianceReports framework enum
  to include `['soc2', 'iso27001', 'cis', 'hipaa', 'gdpr', 'nist_csf', 'pci_dss']`

### 1.3 Shared Types & Constants
- [x] Add `enterprise` to Plan type in `packages/shared/src/types/user.ts`
  (or as 'team' alias if not adding DB enum — decision: keep as separate string but don't add DB enum;
  enterprise orgs use `team` plan with custom overrides via `sla_configs` + `data_residency_configs`)
  **Decision: Do NOT add enterprise plan to DB enum.** Enterprise = team plan + SSO + SLA + residency.
  Instead, add a `PLAN_DISPLAY_CONFIGS` entry for marketing page only.

### 1.4 Refactor index.ts — Extract Route Registration
- [x] Create `apps/api/src/routes/register.ts` (< 150 lines)
  - Export `function registerRoutes(app: Hono<...>): void`
  - Move all `import` + `app.route(...)` calls from index.ts into this function
  - index.ts will: create app, apply middleware, call `registerRoutes(app)`, export handlers
- [x] Slim down `apps/api/src/index.ts` to < 80 lines
  - Global middleware (CORS, logger, bodyLimit, tokenForge, rateLimit)
  - `registerRoutes(app)` call
  - Root handler, 404, error handler, scheduled handler

### 1.5 Security Headers Middleware
- [x] Create `apps/api/src/middleware/security-headers.ts` (< 40 lines)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Content-Security-Policy: default-src 'self'`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-DNS-Prefetch-Control: off`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] Apply in `index.ts` global middleware chain (`app.use('*', securityHeaders)`)

### 1.6 CORS Update
- [x] Add `'https://tokenforge.dev'` and `'https://www.tokenforge.dev'` to CORS origins in index.ts

---

## Phase 2 — Services & Backend Logic

### 2.1 Uptime Service
- [x] Create `apps/api/src/services/uptime.ts` (< 150 lines)
  - `recordCheck(db, instanceId, status, responseTimeMs, checkType)` — insert uptimeRecords
  - `getUptime(db, instanceId, period: '24h'|'7d'|'30d'|'90d')` — percentage calculation
  - `getDowntimeEvents(db, instanceId, period)` — list of outage windows
  - `checkSlaBreaches(db, orgId, env)` — compare uptime vs slaConfig.targetUptime, create alert

### 2.2 Extended Notification Providers
- [x] Update `apps/api/src/services/notifications.ts` (stays < 200 lines)
  - Add `sendPagerDuty(config: { routingKey: string }, payload, severityMap)` — Events API v2
  - Add `sendOpsGenie(config: { apiKey: string; team?: string }, payload)` — Alert API
  - Add `sendTeams(config: { webhookUrl: string }, payload)` — Adaptive Card format
  - Add `sendDiscord(config: { webhookUrl: string }, payload)` — Discord embed format
  - Update `notify()` switch to include 4 new cases
  - Validate all webhook URLs with existing `validateWebhookUrl()`

### 2.3 Uptime Cron Integration
- [x] Update `apps/api/src/services/health-cron.ts` (stays < 200 lines)
  - After each instance status check, call `uptimeService.recordCheck()`
  - Record `'up'` for running, `'down'` for error/stopped, `'degraded'` for other states

### 2.4 Data Residency Enforcement
- [x] Create `apps/api/src/utils/data-residency.ts` (< 60 lines)
  - `enforceResidency(db, orgId, requestedRegion)` → validates region against config
  - `REGION_MAP: { eu: ['eu-central'], us: ['us-east','us-west'], ap: ['ap-southeast'] }`
  - Returns `{ allowed: boolean; reason?: string }`
- [x] Update `apps/api/src/routes/instances.ts` — add residency check before region validation
  (insert ~5 lines after line 86: if orgId → check residency config → 403 if disallowed)

### 2.5 Plan Enforcement Service
- [x] Create `apps/api/src/services/plan-enforcement.ts` (< 100 lines)
  - `checkSkillLimit(db, userId, plan)` → { allowed: boolean; limit: number; current: number }
  - `checkUnverifiedSkillAllowed(plan)` → boolean
  - `getSecurityDashboardTier(plan)` → 'basic' | 'full' | 'full+audit'
  - All use `PLAN_CONFIGS` from shared package

### 2.6 Cron Job Handlers
- [x] Create `apps/api/src/services/cron-handlers.ts` (< 150 lines)
  - `escalateStaleIncidents(env)` — incidents open > 24h with no response → auto-escalate severity
  - `sendGatewayTokenRotationReminders(env)` — tokens > 90 days old → email warning
  - `aggregateTokenForgeUsage(env)` — sum tf_usage rows per tenant for billing period
- [x] Update `apps/api/src/index.ts` scheduled handler — add 3 new `ctx.waitUntil()` calls

### 2.7 Enterprise Contact Handler
- [x] Create `apps/api/src/routes/enterprise-contact.ts` (< 60 lines)
  - POST `/enterprise/contact` — public endpoint (no auth required)
  - Zod validation: name, email, company, message (all required, string limits)
  - Insert into `enterpriseLeads` table
  - Send notification email to `sales@opensyber.cloud` via Resend
  - Rate limit: 3 per hour per IP

---

## Phase 3 — API Routes

### 3.1 Uptime API Routes
- [x] Create `apps/api/src/routes/uptime.ts` (< 100 lines)
  - GET `/uptime/:instanceId` — requires auth + instance access
  - GET `/uptime/:instanceId/events` — downtime event list
  - Returns: `{ uptime: { percentage, period, totalChecks, downChecks } }`
- [x] Create `apps/api/src/routes/sla-config.ts` (< 80 lines)
  - GET `/sla` — get org's SLA config
  - PUT `/sla` — update SLA config (owner/admin only)
  - Requires org context (X-Org-Id header)

### 3.2 Data Residency Routes
- [x] Create `apps/api/src/routes/data-residency.ts` (< 80 lines)
  - GET `/residency` — get org residency config
  - PUT `/residency` — set/update residency config (owner/admin only)
  - Zod validation: region must be 'eu'|'us'|'ap'

### 3.3 Plan Enforcement in Existing Routes
- [x] Update `apps/api/src/routes/instance-skills.ts` — add skill limit check before installation
  (use `planEnforcement.checkSkillLimit()` + `planEnforcement.checkUnverifiedSkillAllowed()`)
- [x] Create `apps/api/src/routes/plan-features.ts` (< 50 lines)
  - GET `/plan/features` — returns available features for user's current plan
  - Used by frontend to show/hide locked features + upgrade prompts

### 3.4 Update Route Registration
- [x] Update `apps/api/src/routes/register.ts` — add new routes:
  - `/api/security/uptime` → uptimeRoutes
  - `/api/organizations/sla` → slaConfigRoutes
  - `/api/organizations/residency` → dataResidencyRoutes
  - `/api/plan` → planFeatureRoutes
  - `/api/enterprise` → enterpriseContactRoutes

---

## Phase 4 — Frontend

### 4.1 Web Proxy Routes
- [x] Create proxy routes for new API endpoints (5 files, each < 40 lines):
  - `apps/web/src/app/api/proxy/security/uptime/[instanceId]/route.ts` — GET
  - `apps/web/src/app/api/proxy/organizations/[orgId]/sla/route.ts` — GET/PUT
  - `apps/web/src/app/api/proxy/organizations/[orgId]/residency/route.ts` — GET/PUT
  - `apps/web/src/app/api/proxy/plan/features/route.ts` — GET
  - `apps/web/src/app/api/proxy/enterprise/contact/route.ts` — POST (no auth needed)

### 4.2 Uptime Dashboard Page
- [x] Create `apps/web/src/components/dashboard/security/UptimeChart.tsx` (< 120 lines)
  - 90-day bar chart using CSS grid (no chart library)
  - Each day: green bar (up), red (down), yellow (degraded)
  - Overall percentage display with large number
  - SLA target line indicator
- [x] Create `apps/web/src/app/dashboard/security/uptime/page.tsx` (< 100 lines)
  - Current uptime percentage, SLA target display
  - UptimeChart component
  - Downtime event history table
- [x] Create `apps/web/src/app/dashboard/security/uptime/loading.tsx`
- [x] Add "Uptime" nav item to security sidebar in `dashboard/layout.tsx`

### 4.3 Data Residency Page
- [x] Create `apps/web/src/app/dashboard/team/residency/page.tsx` (< 100 lines)
  - Region selection (EU/US/AP) with flag emoji + compliance explanation
  - Warning: "Cannot move existing instances after setting"
  - Current config display

### 4.4 Notification Channel Form Update
- [x] Update `apps/web/src/components/dashboard/security/CreateNotificationChannelForm.tsx`
  (or wherever the form lives)
  - Add PagerDuty: routing key input
  - Add OpsGenie: API key + team inputs
  - Add Teams: webhook URL input
  - Add Discord: webhook URL input
  - Dynamic form fields based on selected channel type

### 4.5 Plan Feature Gating
- [x] Create `apps/web/src/components/dashboard/UpgradePrompt.tsx` (< 50 lines)
  - "Upgrade to Pro" card with feature description + CTA button
  - Used on locked pages (compliance, threats, network, audit export)
- [x] Update locked pages to check plan and show UpgradePrompt:
  - Security compliance page
  - Audit export button

### 4.6 Enterprise Pricing & Contact Page
- [x] Update `apps/web/src/app/pricing/page.tsx` — add Enterprise card:
  - "Custom" price, "Contact Sales" CTA → links to `/enterprise`
  - Features: unlimited instances, SAML SSO, SLA monitoring, data residency, dedicated support
- [x] Create `apps/web/src/app/enterprise/page.tsx` (< 120 lines)
  - Enterprise value proposition (3-4 feature blocks)
  - Security certifications section
  - Contact form (name, email, company, message)
  - Submits to `/api/proxy/enterprise/contact`

---

## Phase 5 — Testing & Polish

### 5.1 Uptime Service Tests
- [x] Create `apps/api/src/services/uptime.test.ts`
  - Test recordCheck, getUptime calculation, getDowntimeEvents, checkSlaBreaches

### 5.2 Notification Provider Tests
- [x] Create `apps/api/src/services/notifications.test.ts`
  - Test all 7 channel types (email, webhook, slack, pagerduty, opsgenie, teams, discord)
  - Test webhook URL validation (SSRF prevention)
  - Test notify() dispatch routing

### 5.3 Data Residency Tests
- [x] Create `apps/api/src/utils/data-residency.test.ts`
  - Test enforceResidency for EU/US/AP regions
  - Test allowed/disallowed region combinations
  - Test no config = all regions allowed

### 5.4 Plan Enforcement Tests
- [x] Create `apps/api/src/services/plan-enforcement.test.ts`
  - Test skill limits for each plan tier
  - Test unverified skill check
  - Test security dashboard tier mapping

### 5.5 Route Tests
- [x] Create `apps/api/src/routes/uptime.test.ts` — auth, instance access, uptime data
- [x] Create `apps/api/src/routes/enterprise-contact.test.ts` — validation, success, rate limit

### 5.6 Security Headers Test
- [x] Create `apps/api/src/middleware/security-headers.test.ts`
  - Verify all 7 security headers present on responses

### 5.7 Cron Handler Tests
- [x] Create `apps/api/src/services/cron-handlers.test.ts`
  - Test incident escalation logic
  - Test gateway token rotation reminder
  - Test TokenForge usage aggregation

---

## Execution Order

Phase 1 (Foundation) → Phase 2 (Services) → Phase 3 (Routes) → Phase 4 (Frontend) → Phase 5 (Tests)

Within each phase, tasks are independent and can be done in listed order.

## File Count Estimate
- New files: ~35
- Modified files: ~12
- Total tasks: 40
