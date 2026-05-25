# Sprint 24: Agent Security Platform + Thin CSPM -- Requirements

**Scope**: OpenSyber / Sprint 24 Agent Security Platform
**Sprint Duration**: 2 weeks (estimated)
**Author**: Luna Post-Launch Review Agent
**Date**: 2026-03-02
**Status**: Comprehensive Analysis & Enhancement
**Based on**: Original requirements by Luna Requirements Agent

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Project Context & Strategic Positioning](#project-context--strategic-positioning)
3. [Existing Infrastructure Analysis](#existing-infrastructure-analysis)
4. [Functional Requirements](#functional-requirements)
5. [Non-Functional Requirements](#non-functional-requirements)
6. [User Stories & Use Cases](#user-stories--use-cases)
7. [Technical Constraints & Dependencies](#technical-constraints--dependencies)
8. [Priority Matrix & Implementation Order](#priority-matrix--implementation-order)
9. [Schema Changes & Migrations](#schema-changes--migrations)
10. [Gap Analysis](#gap-analysis)
11. [Out of Scope](#out-of-scope)
12. [Success Metrics & Acceptance Criteria](#success-metrics--acceptance-criteria)

---

## Executive Summary

Sprint 24 represents the critical conversion funnel from free OpenAgent VSCode extension users to paying enterprise customers. This sprint completes the agent security platform with two strategic pillars:

### Primary Pillar: Enterprise Agent Dashboard (Main Feature)

**Business Objective**: Convert extension users by demonstrating enterprise-grade visibility and control over AI agent behavior.

**Key Capabilities**:
- Plan/pricing enforcement across all agent and CSPM features
- Real-time alert dispatch on policy violations (Email, Slack, PagerDuty, OpsGenie, Teams, Discord)
- Cross-linkage between agent activity and cloud security findings
- Risk trend time-series visualization for security posture tracking
- Board-ready PDF report export for CISOs
- Scheduled automated CSPM re-scans
- Complete UI/UX with loading skeletons and polished interactions

### Secondary Pillar: Real AWS CSPM Scanner (Supporting Feature)

**Strategic Framing**: "OpenAgent shows what your AI agent accessed on disk. Cloud CSPM shows what it could access in the cloud."

**Scope**: Curated top-20 Prowler-equivalent security checks for AWS. GCP and Azure remain as stubs.

**Success Gates**:

- [ ] 3+ enterprise trials started (via extension → upgrade flow)
- [ ] First paid enterprise contract signed ($399+/mo Team plan)
- [ ] CISO can generate a board-ready PDF report in < 5 minutes
- [ ] Real AWS CSPM scanner running in production with < 30s scan time
- [ ] Alert dispatch working across all 6 channels (Slack, email, etc.)

---

## Project Context & Strategic Positioning

### Market Context (March 2026)

Based on the revised roadmap strategy:

| Competitor | Coverage | Gap |
|---|---|---|
| **CyberArk** | Agent identity & credentials | Runtime behavior monitoring |
| **Protect AI (Palo Alto)** | ML model safety | What agents actually DO |
| **Lakera** | LLM guardrails | File system & bash monitoring |
| **Wiz (Google)** | Cloud posture | Agent-specific threat modeling |

**OpenSyber's Position**: "The runtime security monitor for AI coding agents. We show you exactly what your agent did while you weren't watching."

### Product Architecture Context

**Completed Sprints**:
- Sprints 1-7: Core platform, TokenForge
- Sprint 8: Enterprise RBAC (5 roles, 35 permissions, orgs/teams)
- Sprint 9: SSO, Admin Panel, Compliance
- Sprint 10: Enterprise Hardening & Scale
- Sprint 23: OpenAgent VSCode Extension (PLG launch vehicle)

**Current Sprint (24)**: Agent Security Platform + Thin CSPM
**Next Sprint (25)**: Agent Attack Paths (blast radius visualization)

---

## Existing Infrastructure Analysis

### Database Schemas (Implemented)

**Migration 0011** (`agent_activity`):
- Per-event audit log from VSCode extension
- Fields: userId, orgId, sessionId, agent, type (file_read|bash_exec), risk, path, summary, secretsCount
- Indexes: user, risk, session

**Migration 0012** (Agent Security Platform):
- `agent_policies` -- org-scoped rules (4 rule types)
- `agent_policy_violations` -- enforcement records
- `cloud_accounts` -- AWS/GCP/Azure connections
- `cspm_scan_runs` -- scan execution history
- `cspm_findings` -- individual security findings
- Added `org_id` to `agent_activity`

### API Routes (Implemented)

**Agent Activity**:
- `POST /api/agents/activity/sync` -- extension pushes events
- `GET /api/agents/activity` -- user's activity feed
- `GET /api/agents/activity/summary` -- risk summary
- `DELETE /api/agents/activity` -- clear history

**Team Views** (RBAC-gated):
- `GET /api/agents/team/activity` -- all org activity
- `GET /api/agents/team/summary` -- org-level summary
- `GET /api/agents/team/members` -- per-member stats
- `GET /api/agents/team/risk-score` -- combined agent + CSPM score

**Reports**:
- `POST /api/agents/reports/generate` -- HTML report (plan-gated)
- `GET /api/agents/reports` -- list reports
- `GET /api/agents/reports/:id/download` -- download HTML

**Cloud/CSPM**:
- `GET/POST/PATCH/DELETE /api/cloud/accounts` -- cloud account CRUD
- `POST /api/cloud/accounts/:id/scan` -- trigger scan
- `GET /api/cloud/accounts/:id/scans` -- scan history
- `GET /api/cloud/scans/:id/findings` -- findings per scan
- `GET /api/cloud/findings` -- all findings with filters
- `GET /api/cloud/findings/summary` -- aggregate counts
- `PATCH /api/cloud/findings/:id/mute` -- mute finding
- `PATCH /api/cloud/findings/:id/resolve` -- resolve finding

### Services (Implemented)

| Service | File | Status | Gap |
|---|---|---|---|
| CSPM Scanner | `cspm-scanner.ts` | Mock-only | No real AWS SDK calls |
| Finding Templates | `cspm-finding-templates.ts` | 10 templates | Need 20 for full scope |
| Policy Evaluator | `policy-evaluator.ts` | Implemented | No alert dispatch |
| Risk Score | `combined-risk-score.ts` | Implemented | No time-series |
| Report Export | `agent-report-export.ts` | HTML only | PDF missing |
| Alert Evaluation | `alert-evaluation.ts` | Partial | Integration incomplete |

### Web Pages (Implemented)

**Agent Dashboard**:
- `/dashboard/agents` -- personal activity (score card, stats, risk distribution)
- `/dashboard/agents/team` -- org-wide view
- `/dashboard/agents/team/[userId]` -- per-developer drilldown
- `/dashboard/agents/policies` -- policy CRUD
- `/dashboard/agents/violations` -- violations list

**Cloud Security**:
- `/dashboard/cloud` -- cloud accounts list + connect modal
- `/dashboard/cloud/findings` -- findings list with filters

### Plan Configuration (Implemented)

**Source**: `packages/shared/src/constants/plans.ts`

| Feature | Free | Personal | Pro | Team |
|---|---|---|---|---|
| agentLimit | 1 | 3 | 10 | 50 |
| agentHistoryDays | 7 | 30 | 90 | 365 |
| cloudSync | false | false | true | true |
| teamDashboard | false | false | false | true |
| policyEngine | false | false | true | true |
| pdfReports | false | false | false | true |
| cspmAccounts | 0 | 0 | 3 | 20 |

### RBAC System (Implemented)

**Roles**: 5 tiers (owner > admin > security > developer > viewer)
**Permissions**: 35 granular permissions, O(1) lookup via Sets
**Relevant for Sprint 24**:
- `agent.policy.read` / `agent.policy.write` -- team dashboard, policies, violations
- `cloud.read` / `cloud.write` / `cloud.admin` -- CSPM features

---

## Functional Requirements

### FR-1: Real AWS CSPM Scanner (P0) -- CRITICAL PATH

**Current Gap**: `cspm-scanner.ts` generates random mock findings. No AWS API integration.

**Strategic Importance**: This is the "thin CSPM" supporting feature that validates the agent security narrative. Without real scans, the cloud posture angle is marketing-only.

**Requirement**: Implement real AWS STS AssumeRole + AWS SDK v3 integration to run 20 curated security checks.

**Acceptance Criteria**:

#### AWS SDK Integration
- [ ] AC-1.1: Install `@aws-sdk/client-sts` + modular clients (S3, IAM, EC2, RDS, CloudTrail, GuardDuty)
- [ ] AC-1.2: Verify Cloudflare Workers compatibility:
  - Test each client with `nodejs_compat` flag in `wrangler.toml`
  - Fallback to raw `fetch` + SigV4 signing if SDK exceeds bundle size
  - Max bundle size impact: < 500KB compressed
- [ ] AC-1.3: STS AssumeRole flow:
  - Input: `roleArn` + `externalId` from `cloud_accounts.credentials`
  - Call: `sts.AssumeRole` with `RoleSessionName: 'opensyber-scan-{accountId}'`
  - Output: Temporary credentials (accessKeyId, secretAccessKey, sessionToken)
  - Security: Credentials never logged, never stored, used only for scan duration

#### Security Checks (20 Total)
- [ ] AC-1.4: **S3 Checks** (6):
  1. S3 Block Public Access disabled (`s3:GetPublicAccessBlock`)
  2. S3 bucket with public ACL (`s3:GetBucketAcl`)
  3. S3 bucket versioning disabled (`s3:GetBucketVersioning`)
  4. S3 bucket access logging disabled (`s3:GetBucketLogging`)
  5. S3 bucket default encryption disabled (`s3:GetEncryptionConfiguration`)
  6. S3 bucket policy allows public read (`s3:GetBucketPolicy`)

- [ ] AC-1.5: **IAM Checks** (7):
  7. Root account access keys active (`iam:GetAccountSummary`)
  8. Root MFA not enabled (`iam:GetAccountSummary`)
  9. IAM password policy weak (`iam:GetAccountPasswordPolicy`)
  10. IAM users with no MFA (`iam:ListUsers` + `iam:ListMFADevices`)
  11. IAM policies with admin access (`iam:ListPolicies` + `iam:GetPolicyVersion`)
  12. Access keys older than 90 days (`iam:ListAccessKeys`)
  13. IAM users with console access (`iam:ListUsers`)

- [ ] AC-1.6: **EC2/Network Checks** (5):
  14. Security groups allowing 0.0.0.0/0 SSH (`ec2:DescribeSecurityGroups`)
  15. Security groups allowing 0.0.0.0/0 RDP (`ec2:DescribeSecurityGroups`)
  16. EBS volumes not encrypted (`ec2:DescribeVolumes`)
  17. EBS default encryption disabled (`ec2:GetEbsEncryptionByDefault`)
  18. Default VPC in use (`ec2:DescribeVpcs`)

- [ ] AC-1.7: **RDS Checks** (2):
  19. RDS instances publicly accessible (`rds:DescribeDBInstances`)
  20. RDS instances not encrypted (`rds:DescribeDBInstances`)

#### Finding Generation
- [ ] AC-1.8: Each check produces 0+ findings in `cspm_findings` schema:
  - Map existing 10 templates + add 10 new templates for full 20 checks
  - Severity: critical/high/medium/low per CIS benchmark
  - Compliance frameworks: CIS AWS 1.4, SOC2 CC6.x, etc.
  - Remediation: actionable fix steps
- [ ] AC-1.9: Partial failure handling:
  - If check fails due to permissions, log error + continue other checks
  - Scan run status: 'completed' even if some checks failed
  - Errors stored in `cspm_scan_runs` as metadata (if schema supports) or logs

#### Performance
- [ ] AC-1.10: Scan completes within 30 seconds for typical account:
  - < 100 S3 buckets
  - < 50 security groups
  - < 20 IAM users
- [ ] AC-1.11: Parallelize checks where independent:
  - S3 checks (bucket-level): parallel across buckets
  - IAM checks: sequential (account-level)
  - EC2/RDS checks: parallel across resources

#### Provider Support
- [ ] AC-1.12: GCP returns `{ error: 'GCP not yet supported. Coming in Sprint 29.' }`
- [ ] AC-1.13: Azure returns `{ error: 'Azure not yet supported. Coming in Sprint 30.' }`

#### Testing
- [ ] AC-1.14: Unit tests mock AWS SDK calls (100% coverage on check logic)
- [ ] AC-1.15: Integration test with mocked STS + service responses
- [ ] AC-1.16: Error path tests (credentials expire, permissions denied, rate limits)

**Technical Notes**:
- AWS IAM policy template required for customers (least-privilege, read-only scanning)
- `externalId` prevents confused deputy attacks
- Rate limiting: 5 scans per account per hour (KV-based)

---

### FR-2: Plan/Pricing Enforcement (P0) -- REVENUE BLOCKING

**Current Gap**: No enforcement of plan limits. Activity sync accepts unlimited events.

**Strategic Importance**: Revenue gating. Free users must upgrade to access premium features.

**Requirement**: Enforce all plan limits from `plans.ts` across all agent/CSPM routes.

**Acceptance Criteria**:

#### Middleware Implementation
- [ ] AC-2.1: Create `middleware/plan-enforcement.ts`:
  - `requirePlanFeature(feature: 'cloudSync' | 'teamDashboard' | 'policyEngine' | 'pdfReports')`
  - `requirePlanLimit(limit: 'agentLimit' | 'cspmAccounts', currentValue: number)`
  - Fetch user plan once per request, cache in context
  - Return 403 with upgrade CTA when limit exceeded

#### Activity Sync Enforcement
- [ ] AC-2.2: `POST /api/agents/activity/sync` checks:
  - `cloudSync` feature gate (Free/Personal rejected with 403)
  - `agentLimit`: Count distinct `agent` values within `agentHistoryDays` window
  - `agentHistoryDays`: Reject events older than retention window (400)
- [ ] AC-2.3: Background job purges old activity:
  - Daily cron runs `DELETE FROM agent_activity WHERE created_at < retentionDate`
  - Runs per-user based on their plan's `agentHistoryDays`

#### Route Gating
- [ ] AC-2.4: Team dashboard routes (`/api/agents/team/*`):
  - Require `teamDashboard === true` (Team plan only)
  - Return 403 + upgrade CTA for Pro users
- [ ] AC-2.5: Policy engine routes (`/api/agents/policies/*`):
  - Require `policyEngine === true` (Pro/Team plans)
- [ ] AC-2.6: CSPM routes (`/api/cloud/*`):
  - Check `cspmAccounts` limit before account creation
  - Return 403 when at limit
- [ ] AC-2.7: Report generation:
  - Require `pdfReports === true` (Team plan only)

#### UI Integration
- [ ] AC-2.8: Upgrade CTAs display when:
  - Feature blocked by plan
  - Limit reached (e.g., "3/3 cloud accounts used -- upgrade to Team for 20")
  - Link to `/pricing` with `?upgrade={plan}` query param

#### Testing
- [ ] AC-2.9: Unit tests for each plan tier:
  - Free: 1 agent, 7 days, no cloud sync, no team dashboard
  - Personal: 3 agents, 30 days, no cloud sync
  - Pro: 10 agents, 90 days, cloud sync, no team dashboard, 3 CSPM accounts
  - Team: 50 agents, 365 days, all features, 20 CSPM accounts
- [ ] AC-2.10: Integration tests verify 403 responses at feature boundaries

**Technical Notes**:
- Plan lookup: `SELECT plan FROM users WHERE id = ?` (indexed, fast)
- Cache plan config in request context to avoid repeated lookups
- Retention cron: Batch deletes (1000 rows at a time) to stay within D1 limits

---

### FR-3: Alert Dispatch on Policy Violations (P0) -- ENTERPRISE CONVERSION

**Current Gap**: `policy-evaluator.ts` creates violations but sends no notifications.

**Strategic Importance**: Key enterprise conversion feature. Security teams need real-time alerts.

**Requirement**: Multi-channel alert dispatch when policy violations occur.

**Acceptance Criteria**:

#### Database Schema
- [ ] AC-3.1: Migration 0013 adds `alert_channels` table:
  - Columns: id, orgId, channelType, name, config (encrypted JSON), minSeverity, isActive, createdAt, updatedAt
  - Channel types: 'email' | 'slack' | 'pagerduty' | 'opsgenie' | 'teams' | 'discord'
  - Index on orgId for fast lookup

#### CRUD API
- [ ] AC-3.2: Alert channel endpoints:
  - `GET /api/agents/alert-channels` -- list org channels (requirePermission agent.policy.write)
  - `POST /api/agents/alert-channels` -- create channel
  - `PATCH /api/agents/alert-channels/:id` -- update channel
  - `DELETE /api/agents/alert-channels/:id` -- delete channel
- [ ] AC-3.3: Test endpoint:
  - `POST /api/agents/alert-channels/:id/test` -- sends test notification
- [ ] AC-3.4: All endpoints require `policyEngine === true` (Pro/Team)
- [ ] AC-3.5: Config encryption:
  - Use existing `encrypt()` utility for webhook URLs, API keys
  - Email addresses stored in plaintext (not sensitive)

#### Alert Dispatch Service
- [ ] AC-3.6: Create `services/alert-dispatch.ts`:
  - Input: violation record + list of active channels
  - Filter channels by `minSeverity` (only fire if violation.severity >= channel.minSeverity)
  - Dispatch to each matching channel asynchronously
- [ ] AC-3.7: Channel implementations:
  - **Email** (Resend):
    - Subject: `[OpenSyber Alert] {severity} policy violation -- {policyName}`
    - Body: Violation details, user, activity summary, link to dashboard
    - From: `alerts@opensyber.cloud`
  - **Slack**:
    - POST to webhook URL
    - Block kit formatted message (color-coded by severity)
    - Include: policy name, severity, user, summary, dashboard link
  - **PagerDuty**:
    - POST to Events API v2 (`https://events.pagerduty.com/v2/enqueue`)
    - Severity mapping: critical/high=critical, medium=warning, low=info
    - Dedup key: `{policyId}-{channelId}` (aggregate duplicates)
  - **OpsGenie**:
    - POST to Alert API
    - Priority mapping: critical=P1, high=P2, medium=P3, low=P4
  - **Microsoft Teams**:
    - POST to webhook URL
    - Adaptive card format
  - **Discord**:
    - POST to webhook URL
    - Embed with color-coded severity

#### Integration with Policy Evaluator
- [ ] AC-3.8: `policy-evaluator.ts` calls `dispatchAlerts()` after inserting violations
- [ ] AC-3.9: Async dispatch:
  - Use `ctx.waitUntil(dispatchAlerts(...))` in Hono handler
  - Does not block sync response
- [ ] AC-3.10: Error handling:
  - Failed dispatches logged but don't fail the request
  - Retry logic: 3 retries with exponential backoff for transient errors
  - Dead letter queue: Log permanently failed alerts for review

#### Rate Limiting
- [ ] AC-3.11: Deduplication:
  - Max 1 alert per (policyId, channelId) per minute
  - Use KV store for dedup key with 60s TTL
- [ ] AC-3.12: Per-channel rate limits:
  - Slack: 1 msg/sec (Slack API limit)
  - Email: 10/min (Resend limit)
  - PagerDuty/OpsGenie: no limit (paying customers)

#### UI Components
- [ ] AC-3.13: `/dashboard/agents/alert-channels` page:
  - List existing channels with status indicators
  - Create channel modal (dynamic form per channel type)
  - Test button per channel
  - Edit/delete actions
- [ ] AC-3.14: Channel type icons:
  - Email: Mail icon
  - Slack: Slack brand color
  - PagerDuty: PagerDuty brand color
  - OpsGenie: OpsGenie brand color
  - Teams: Microsoft brand color
  - Discord: Discord brand color

#### Testing
- [ ] AC-3.15: Unit tests for each channel type (mock HTTP calls)
- [ ] AC-3.16: Integration tests verify:
  - Correct channels filtered by minSeverity
  - Deduplication works
  - Rate limiting enforced
  - Errors handled gracefully

**Technical Notes**:
- Resend API key: `RESEND_API_KEY` (already in env)
- Webhook URLs provided by users (stored encrypted)
- `ctx.waitUntil()` is Cloudflare Workers specific (runs after response sent)

---

### FR-4: Agent Activity + CSPM Cross-Linkage (P1) -- DIFFERENTIATION

**Current Gap**: Agent activity and CSPM findings are separate data streams.

**Strategic Importance**: Unique narrative: "Your agent accessed AWS resources with X open findings." No competitor does this.

**Requirement**: Correlate agent activity with cloud posture findings.

**Acceptance Criteria**:

#### Correlation Service
- [ ] AC-4.1: Create `services/activity-cspm-linker.ts`:
  - Input: Activity event + org CSPM findings
  - Output: Related findings (max 5) with relevance score
  - Correlation patterns:
    - **AWS credential file access**: `path` matches `~/.aws/credentials`, `~/.aws/config`
      - Return findings related to IAM users, access keys, MFA
    - **S3 commands in bash**: `summary` contains `aws s3`, `s3://`
      - Extract bucket names, match S3 findings
    - **EC2 commands**: `summary` contains `aws ec2`
      - Match security group, EBS, VPC findings
    - **RDS commands**: `summary` contains `aws rds`
      - Match RDS findings
    - **Secrets detected**: `secretsCount > 0`
      - Return IAM access key findings

#### API Endpoint
- [ ] AC-4.2: `GET /api/agents/activity/:activityId/related-findings`:
  - Returns matching CSPM findings for an activity event
  - Response: `{ data: [{ id, severity, title, resourceType, resourceId }] }`
  - Empty array if no matches

#### UI Integration
- [ ] AC-4.3: Per-developer drilldown (`/dashboard/agents/team/[userId]`):
  - Each activity row has expandable "Related Cloud Findings" section
  - Shows when findings exist (collapsed by default)
  - Displays finding severity badges, clickable to open finding details
- [ ] AC-4.4: Solo agent activity page (`/dashboard/agents`):
  - Banner when recent activity correlates with open findings
  - Message: "Your agent accessed AWS resources with {N} open cloud security findings"
  - CTA button to `/dashboard/cloud/findings`

#### Performance
- [ ] AC-4.5: Query-time correlation (not sync-time):
  - Keeps sync endpoint fast
  - D1 query: `SELECT * FROM cspm_findings WHERE orgId = ? AND status = 'open'`
  - In-memory pattern matching (max 100 findings per org, manageable)

#### Testing
- [ ] AC-4.6: Unit tests for each correlation pattern
- [ ] AC-4.7: Test with realistic activity events + finding sets

**Technical Notes**:
- Best-effort heuristic (false positives acceptable for MVP)
- D1 doesn't support full-text search -- use LIKE or in-memory matching
- More sophisticated correlation in Sprint 25 (Attack Graph)

---

### FR-5: Missing API Endpoints (P0) -- UNBLOCKS UI

**Current Gap**: UI references endpoints that don't exist.

**Acceptance Criteria**:

- [ ] AC-5.1: `GET /api/agents/team/:userId/activity`:
  - Returns paginated activity for specific user in org
  - Query params: `?limit=50&offset=0`
  - Require `agent.policy.read` permission
  - Response: `{ data: [...], hasMore: boolean }`
- [ ] AC-5.2: `GET /api/agents/activity/sessions`:
  - Returns distinct sessions for current user
  - Aggregates per session: eventCount, riskBreakdown, firstEvent, lastEvent
  - Response: `{ data: [{ sessionId, agent, eventCount, critical, high, medium, low, firstEvent, lastEvent }] }`
- [ ] AC-5.3: `GET /api/agents/activity/sessions/:sessionId`:
  - Returns all events for a session, ordered by createdAt
  - Useful for session drilldown
- [ ] AC-5.4: All endpoints use Zod validation
- [ ] AC-5.5: All endpoints enforce auth + plan checks
- [ ] AC-5.6: Unit tests cover success, 401, 403, 404 paths

---

### FR-6: Missing Proxy Routes (P0) -- UNBLOCKS UI

**Current Gap**: Next.js proxy routes don't exist for new endpoints.

**Acceptance Criteria**:

- [ ] AC-6.1: `/api/proxy/agents/team/[userId]/route.ts`:
  - Proxies GET to `/api/agents/team/:userId/activity`
- [ ] AC-6.2: `/api/proxy/agents/alert-channels/route.ts`:
  - Proxies GET/POST to `/api/agents/alert-channels`
- [ ] AC-6.3: `/api/proxy/agents/alert-channels/[id]/route.ts`:
  - Proxies PATCH/DELETE to `/api/agents/alert-channels/:id`
- [ ] AC-6.4: `/api/proxy/agents/alert-channels/[id]/test/route.ts`:
  - Proxies POST to `/api/agents/alert-channels/:id/test`
- [ ] AC-6.5: `/api/proxy/agents/sessions/route.ts`:
  - Proxies GET to `/api/agents/activity/sessions`
- [ ] AC-6.6: `/api/proxy/agents/sessions/[sessionId]/route.ts`:
  - Proxies GET to `/api/agents/activity/sessions/:sessionId`
- [ ] AC-6.7: All use existing `auth() -> getToken() -> fetch() -> NextResponse.json()` pattern
- [ ] AC-6.8: All return 401 for unauthenticated requests

---

### FR-7: Risk Trend Time Series (P1) -- DASHBOARD ENHANCEMENT

**Current Gap**: Risk score is point-in-time only. No historical tracking.

**Acceptance Criteria**:

#### Database Schema
- [ ] AC-7.1: Migration 0013 adds `agent_risk_snapshots` table:
  - Columns: id, userId, orgId, agentScore, cspmScore, combinedScore, grade, agentEventCount, cspmFindingCount, snapshotDate, createdAt
  - Indexes: (userId, snapshotDate), (orgId, snapshotDate)

#### Cron Job
- [ ] AC-7.2: Create `services/risk-snapshot-cron.ts`:
  - Runs daily via Cloudflare Workers cron
  - For each user with activity in past 24h:
    - Compute agent summary (last 24h)
    - Fetch CSPM summary (current open findings)
    - Calculate combined score using existing `computeCombinedRiskScore()`
    - Insert snapshot
  - For each org with activity in past 24h:
    - Compute org-level summary
    - Insert org snapshot

#### API Endpoints
- [ ] AC-7.3: `GET /api/agents/risk-trend?days=30`:
  - Returns current user's risk time series
  - Default 30 days, max 90 (plan-limited)
  - Response: `{ data: [{ date: "2026-03-01", agentScore, cspmScore, combined, grade }] }`
- [ ] AC-7.4: `GET /api/agents/team/risk-trend?days=30`:
  - Returns org-level trend
  - Require `agent.policy.read` permission
- [ ] AC-7.5: `GET /api/agents/team/:userId/risk-trend?days=30`:
  - Returns specific user's trend within org
  - Require `agent.policy.read` permission

#### UI Components
- [ ] AC-7.6: Trend chart in dashboard:
  - Line chart with 3 series: agent score, CSPM score, combined
  - X-axis: dates, Y-axis: 0-100 score
  - Color-coded: green (80-100), amber (60-79), orange (40-59), red (0-39)
  - Hover tooltips show exact scores
- [ ] AC-7.7: Library: Use `recharts` (lightweight, React-friendly) or implement simple SVG chart
- [ ] AC-7.8: Responsive: works on mobile (375px width)

#### Cron Registration
- [ ] AC-7.9: Register in `apps/api/src/index.ts` scheduled handler:
  - Add to existing cron infrastructure
  - Runs at 00:00 UTC daily
  - Uses `ctx.waitUntil()` for non-blocking execution

#### Performance
- [ ] AC-7.10: Snapshot computation batches users/orgs (100 per batch)
- [ ] AC-7.11: Handles D1 write limits (uses `ctx.waitUntil` chain for large orgs)

---

### FR-8: PDF Report Export (P1) -- CISO FEATURE

**Current Gap**: HTML reports only. No PDF download for CISOs.

**Acceptance Criteria**:

#### PDF Generation
- [ ] AC-8.1: Reports generated as PDF and stored in R2:
  - Use `jspdf` + `jspdf-autotable` (pure JS, works in Workers)
  - Bundle size impact: < 400KB
- [ ] AC-8.2: PDF sections:
  - **Cover page**: Org name, report date, combined grade (large letter), "AI Agent Security Report" title
  - **Executive summary**: 3-paragraph narrative, overall risk score, key findings
  - **Agent risk breakdown**: Table with agent type, event count, risk distribution, secrets detected
  - **CSPM findings summary**: Table with critical/high findings, resource type, remediation
  - **Top 20 violations**: Table with policy name, severity, user, summary, date
  - **Recommendations**: 5 prioritized remediation steps
- [ ] AC-8.3: Download endpoint:
  - `GET /api/agents/reports/:id/download?format=pdf`
  - Returns `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="opensyber-report-{date}.pdf"`
- [ ] AC-8.4: Performance:
  - Generation completes within 10 seconds (typical report: 50 violations, 20 findings)
  - Timeout after 15s (Worker CPU limit)
- [ ] AC-8.5: Plan-gated:
  - Requires `pdfReports === true` (Team plan)
  - Returns 403 for Pro users with upgrade CTA
- [ ] AC-8.6: HTML fallback:
  - Existing HTML generation preserved
  - Print-optimized CSS for `window.print()` client-side PDF
- [ ] AC-8.7: Dual format:
  - Generation returns both HTML and PDF URLs
  - Response: `{ data: { htmlUrl: "...", pdfUrl: "..." } }`

#### UI Integration
- [ ] AC-8.8: Reports page shows two download buttons:
  - "Download PDF" (primary, plan-gated)
  - "View HTML" (secondary, always available)
- [ ] AC-8.9: Generate button shows loading state:
  - "Generating report..." (spinner)
  - Timeout after 15s with "Report generation timed out. Try again."

#### Testing
- [ ] AC-8.10: Unit tests for PDF generation with mocked data
- [ ] AC-8.11: Integration test verifies PDF stored in R2
- [ ] AC-8.12: Test plan gating (403 for non-Team users)

**Technical Notes**:
- `jspdf` works in Workers (verified in similar projects)
- Alternative: `pdfkit` (larger bundle, more features)
- Puppeteer/Playwright not available in Workers runtime
- Font handling: Use built-in fonts (no custom font files to keep bundle small)

---

### FR-9: Scheduled CSPM Re-Scan (P1) -- OPERATIONAL EFFICIENCY

**Current Gap**: Scans are manual-only. No automation.

**Acceptance Criteria**:

#### Database Schema
- [ ] AC-9.1: Migration 0013 adds columns to `cloud_accounts`:
  - `scanSchedule` TEXT DEFAULT 'manual' CHECK(scanSchedule IN ('manual', 'daily', 'weekly'))
  - `nextScanAt` TEXT (ISO timestamp, nullable)

#### API Updates
- [ ] AC-9.2: PATCH `/api/cloud/accounts/:id` accepts `scanSchedule` field
- [ ] AC-9.3: Scan schedule options:
  - Manual (default): No automatic scans
  - Daily: Scan every 24 hours
  - Weekly: Scan every 7 days

#### UI Components
- [ ] AC-9.4: Cloud accounts table shows "Schedule" column:
  - Display: "Manual" | "Daily" | "Weekly"
  - Editable via dropdown in account settings modal
- [ ] AC-9.5: Account settings modal:
  - Add "Scan Schedule" section
  - Dropdown: Manual / Daily / Weekly
  - Shows "Next scan: {date}" when scheduled

#### Cron Implementation
- [ ] AC-9.6: Scheduled cron in `apps/api/src/index.ts`:
  - Runs every 5 minutes (configured in `wrangler.toml`)
  - Queries: `SELECT * FROM cloud_accounts WHERE nextScanAt <= now() AND scanSchedule != 'manual'`
  - Triggers scans via existing `runCspmScan()` service
  - Max 5 concurrent scans per invocation (CPU limit)
  - Uses `ctx.waitUntil()` for async execution

#### Scan Scheduling Logic
- [ ] AC-9.7: After each scan (manual or scheduled):
  - Update `nextScanAt` based on `scanSchedule`:
    - 'daily': `now() + 24 hours`
    - 'weekly': `now() + 7 days`
    - 'manual': `null`
- [ ] AC-9.8: Initial schedule:
  - When user changes from manual to daily/weekly:
    - Set `nextScanAt = now() + 1 hour` (first scan in 1 hour)
    - Then follow regular interval

#### Error Handling
- [ ] AC-9.9: Failed scheduled scans:
  - Update account `status` to 'error'
  - Log failure with error message
  - Do not reschedule (manual intervention required)
- [ ] AC-9.10: Retry logic:
  - If scan fails due to transient error (AWS rate limit, timeout):
    - Retry in 1 hour (update `nextScanAt`)
  - If scan fails due to auth (invalid credentials):
    - Do not retry (manual fix required)

#### Plan Enforcement
- [ ] AC-9.11: Scheduled scans require `cspmAccounts > 0`:
  - Free/Personal: Cannot set schedule (dropdown disabled)
  - Pro: Max 3 accounts with schedules
  - Team: Up to 20 accounts with schedules

#### Testing
- [ ] AC-9.12: Unit tests for schedule calculation logic
- [ ] AC-9.13: Integration test verifies cron triggers scans
- [ ] AC-9.14: Test error handling (auth failure, timeout)

**Technical Notes**:
- Cloudflare Workers cron: `cron: "0 */5 * * *"` (every 5 minutes)
- Each scan = multiple AWS API calls (30s CPU limit = 5 scans max)
- Batch processing: Process 5 accounts, re-invoke cron for next batch if more pending

---

### FR-10: Loading Skeletons (P0) -- CLAUDE.md COMPLIANCE

**Current Gap**: Spinners only. No content-aware loading states.

**Requirement**: Replace spinners with structured skeletons matching actual layout.

**Acceptance Criteria**:

#### Skeleton Component
- [ ] AC-10.1: Create `apps/web/src/components/Skeleton.tsx`:
  - Accepts: `variant` ('text' | 'circle' | 'card' | 'row'), `className`, `width`, `height`
  - Uses `animate-pulse` with `bg-neutral-800`
  - Consistent spacing and rounded corners

#### Page-Specific Skeletons
- [ ] AC-10.2: `/dashboard/agents`:
  - Score card skeleton: Large circle + text lines
  - 6 stat card skeletons (grid layout)
  - Risk distribution skeleton: 4 progress bar rows
- [ ] AC-10.3: `/dashboard/cloud`:
  - Header skeleton: Title + button placeholder
  - Table skeleton: 3 rows with column-aligned blocks
- [ ] AC-10.4: `/dashboard/cloud/findings`:
  - Summary cards skeleton: 4 stat cards
  - Findings table skeleton: 5 rows
- [ ] AC-10.5: `/dashboard/agents/team`:
  - Summary stats skeleton: 4 cards
  - Member table skeleton: 3 rows
- [ ] AC-10.6: `/dashboard/agents/team/[userId]`:
  - Member header skeleton: Avatar + name + stats
  - Risk cards skeleton: Score + 4 stats
  - Activity table skeleton: 5 rows
- [ ] AC-10.7: `/dashboard/agents/violations`:
  - Table skeleton with 5 rows

#### Animation
- [ ] AC-10.8: Skeletons use `animate-pulse` utility:
  - Smooth opacity animation (0.5s ease-in-out)
  - No jittery motion
  - Matches Tailwind default pulse timing

#### Accessibility
- [ ] AC-10.9: Skeletons have `role="status"` + `aria-label="Loading..."`
- [ ] AC-10.10: Screen readers announce loading state

#### Implementation Pattern
- [ ] AC-10.11: Each page uses conditional render:
  ```tsx
  {loading ? <PageSkeleton /> : <ActualContent />}
  ```
- [ ] AC-10.12: Skeletons match exact layout of rendered content:
  - Same grid columns
  - Same padding/margins
  - Same border radius

---

## Non-Functional Requirements

### NFR-1: Performance

| Metric | Target | Measurement |
|---|---|---|
| Activity sync response time | < 200ms (100 events) | Hono timing middleware |
| Plan enforcement overhead | < 10ms per request | DB query timing |
| CSPM scan completion (typical account) | < 30s | Scan run timestamps |
| Risk trend API response | < 100ms (90-day history) | API timing logs |
| PDF report generation | < 10s (50 violations) | Generation duration |
| Alert dispatch latency | Non-blocking | Async via `waitUntil` |
| Skeleton render time | < 50ms | React DevTools Profiler |

### NFR-2: Security

| Requirement | Implementation | Verification |
|---|---|---|
| AWS STS credentials never logged | In-memory only, GC after scan | Code review + logging audit |
| Alert channel configs encrypted | AES-GCM via `encrypt()` | DB inspection (should be ciphertext) |
| All endpoints validate auth | `clerkAuth()` middleware | Test 401 responses |
| RBAC permissions checked | `requirePermission()` | Test 403 responses per role |
| Input validation | Zod schemas on all requests | Test malformed inputs |
| IAM policy template (customer) | Least-privilege read-only | Security review |
| External ID for STS | Prevents confused deputy | Code review |
| Rate limiting on scans | KV-based, 5 scans/account/hour | Load test |

### NFR-3: Reliability

| Scenario | Behavior |
|---|---|
| Partial CSPM scan failure | Continue other checks, log errors, mark scan 'completed' |
| Alert dispatch failure | Log error, don't fail sync, retry 3x with backoff |
| Scheduled scan cron overlap | Idempotent: check `nextScanAt` before triggering |
| Risk snapshot cron D1 limits | Batch inserts, use `waitUntil` chains |
| Worker CPU limit exceeded | Graceful degradation, log timeout, retry next cron |

### NFR-4: Testing

| Type | Coverage Target | Tools |
|---|---|---|
| Unit tests (services) | >= 80% line coverage | Vitest |
| Integration tests (routes) | All success + error paths | Hono `app.request()` |
| AWS SDK mocks | 100% (no real AWS calls in CI) | vi.mock() |
| Alert dispatch tests | All 6 channel types | Mock fetch |
| Plan enforcement tests | All 4 plan tiers | Test matrix |
| E2E tests (critical paths) | Agent sync → alert → dashboard | Playwright |

### NFR-5: Observability

| Event | Logging | Metadata |
|---|---|---|
| Scan execution | INFO/ERROR | accountId, duration, findingCount, criticalCount |
| Alert dispatch | INFO/ERROR | channelId, channelType, severity, success/failure |
| Plan enforcement rejection | WARN | userId, feature, limit |
| Policy violation | INFO | policyId, userId, severity, summary |
| Risk snapshot | INFO | userId/orgId, scores, date |

---

## User Stories & Use Cases

### US-1: Solo Developer (Free Plan) → Upgrade Journey

**Persona**: Alex, solo dev using Cursor for side projects

**Story**:
> As a solo developer using the OpenAgent VS Code extension,
> I want to see my agent's activity synced to the cloud dashboard,
> so that I can review what my AI agent accessed across sessions.

**Constraints**:
- 1 agent (Cursor)
- 7-day history retention
- No cloud sync (Free plan limitation)

**Scenarios**:

1. **Initial Discovery**:
   - Alex installs OpenAgent extension
   - Sees "Upgrade to Pro for cloud sync" banner
   - Clicks upgrade link → pricing page

2. **Upgrade Decision**:
   - Reviews Pro plan benefits: 10 agents, 90-day history, cloud sync
   - Upgrades to Pro ($149/mo)
   - Returns to dashboard, cloud sync now enabled

3. **First Sync**:
   - Agent generates 50 events (file reads, bash commands)
   - Extension calls `POST /api/agents/activity/sync`
   - API validates plan (Pro = cloudSync enabled)
   - Events stored, policy evaluation runs
   - Dashboard shows risk score: 72 (Moderate Risk)
   - Alert: "3 high-risk events detected"

**Success Metric**: Free → Pro conversion rate > 5%

---

### US-2: Pro Developer → Cloud Security Awareness

**Persona**: Jordan, senior dev at mid-sized startup (50-person eng team)

**Story**:
> As a Pro developer,
> I want to connect my AWS account and see misconfigurations alongside my agent's activity,
> so that I understand the blast radius of what my agent can access.

**Constraints**:
- Pro plan: 10 agents, 90-day history, 3 CSPM accounts, policy engine
- Team plan not yet purchased (no team dashboard)

**Scenarios**:

1. **Connect AWS Account**:
   - Jordan creates IAM role using OpenSyber template
   - Enters role ARN + external ID in "Connect Account" modal
   - Account status: "Scanning..."
   - 30 seconds later: "Active" with 12 findings (3 critical, 5 high, 4 medium)

2. **Review Findings**:
   - Clicks "View Findings" → `/dashboard/cloud/findings`
   - Top finding: "S3 bucket publicly readable" (critical)
   - Jordan realizes: "My agent just read ~/.aws/credentials and can access this bucket"

3. **Cross-Linkage Discovery**:
   - Goes to `/dashboard/agents`
   - Sees banner: "Your agent accessed AWS resources with 12 open cloud security findings"
   - Clicks "Review Agent Activity" → sees bash command: `aws s3 cp company-data-bucket/...`
   - Related findings shown inline: S3 bucket finding (critical)

4. **Policy Creation**:
   - Goes to `/dashboard/agents/policies`
   - Creates policy: "Alert if agent runs AWS commands"
   - Rule type: `command_pattern`, pattern: `aws (s3|ec2|rds)`
   - Severity: high

5. **Alert Test**:
   - Agent runs `aws s3 ls s3://company-data-bucket/`
   - Policy violation created
   - Email alert sent to Jordan (Pro plan = policyEngine enabled)
   - Slack alert not sent (Team plan required for non-email channels)

**Success Metric**: Pro → Team conversion rate > 10%

---

### US-3: Team Security Lead → Enterprise Oversight

**Persona**: Sam, security lead at 200-person company (15 developers using AI agents)

**Story**:
> As a team security lead,
> I want to see all agents across my organization with risk trends over time,
> so that I can track security posture improvements and report to management.

**Constraints**:
- Team plan: 50 agents, 365-day history, 20 CSPM accounts, team dashboard, PDF reports
- Full alert channel access (Slack, PagerDuty, etc.)

**Scenarios**:

1. **Team Dashboard First View**:
   - Sam accesses `/dashboard/agents/team`
   - Sees org-wide summary:
     - 12 developers with active agents
     - 8,450 total events this month
     - 23 critical, 67 high-risk events
     - 15 secrets detected
   - Combined risk score: 58 (High Risk)

2. **Per-Developer Drilldown**:
   - Clicks into developer "Taylor" (highest critical events)
   - Sees Taylor's profile:
     - Agent: Cursor
     - 1,240 events
     - 5 critical (all file reads of `.env` files)
     - Risk score: 32 (Critical Risk)
   - Drills into critical events:
     - Event: `file_read` of `/app/.env.production`
     - Path: `backend/api/.env`
     - Summary: "Read production environment variables"
     - Secrets detected: 3 (DATABASE_URL, JWT_SECRET, STRIPE_KEY)

3. **Risk Trend Analysis**:
   - Opens risk trend chart (last 30 days)
   - Sees downward trend: 68 → 58 → 52 (improving)
   - Correlates with policy implementations last week
   - Exports chart as PNG for management presentation

4. **Alert Configuration**:
   - Goes to `/dashboard/agents/alert-channels`
   - Creates Slack channel: "#security-alerts"
   - Sets minSeverity: high
   - Clicks "Test" → Slack message received
   - Creates PagerDuty channel for critical only
   - Creates email channel for all violations (CISO wants full visibility)

5. **Policy Rollout**:
   - Creates org-wide policy: "Block .env file access outside /config/"
   - Rule type: `file_pattern`, pattern: `\.env$`
   - Severity: critical
   - All 12 developers' agents now evaluated against this policy
   - First violation fires within 2 hours → Slack alert

6. **PDF Report for CISO**:
   - Goes to `/dashboard/agents/reports`
   - Clicks "Generate Report" (Team plan feature)
   - Waits 8 seconds → "Report ready"
   - Downloads PDF (47 pages, professional formatting)
   - Emails to CISO with subject: "AI Agent Security Report -- March 2026"

**Success Metric**: Team plan MRR > $10,000 (25 customers @ $399/mo)

---

### US-4: CISO → Board Reporting

**Persona**: Dr. Priya, CISO at 500-person enterprise (80 developers, 3 engineering teams)

**Story**:
> As a CISO,
> I want to generate a board-ready PDF security report showing AI agent risk and cloud posture,
> so that I can demonstrate governance over AI tools used in engineering.

**Constraints**:
- Enterprise plan (custom): Unlimited agents, 1-year retention, SSO, custom SLAs
- Board meeting in 3 days -- needs report ASAP

**Scenarios**:

1. **Report Generation**:
   - Priya logs into OpenSyber dashboard
   - Sees org-level combined score: 71 (Grade B, Moderate Risk)
   - Clicks "Generate Monthly Report"
   - Selects date range: March 1-31, 2026
   - Clicks "Generate PDF"

2. **Report Review**:
   - 9 seconds later: "Report ready -- Download PDF"
   - PDF opens:
     - **Cover**: "Acme Corp AI Agent Security Report -- March 2026 -- Grade B"
     - **Executive Summary**: "3 engineering teams, 78 active agents, 12,450 events, 5 critical violations, 28 secrets detected"
     - **Agent Risk**: Breakdown by team (Platform team: Grade A, Mobile team: Grade C, Data team: Grade B)
     - **Cloud Posture**: 3 AWS accounts, 45 findings (8 critical, 12 high)
     - **Top Violations**: 5 critical policy violations (3 .env accesses, 2 AWS credential reads)
     - **Recommendations**: 1) Enable MFA on all agents, 2) Restrict .env file access, 3) Remediate 8 critical cloud findings

3. **Board Presentation**:
   - Priya presents at board meeting
   - Shows risk trend chart (downward trend: good)
   - Highlights: "We have visibility into all AI agent activity"
   - Board asks: "How do we compare to industry?"
   - Priya: "Grade B is above average (most orgs are C or D)"
   - Board approves $50K budget for OpenSyber Team plan upgrade

**Success Metric**: Enterprise plan closed (first $10K+ ARR deal)

---

### US-5: DevOps Engineer → Scheduled Automation

**Persona**: Mike, DevOps engineer at Series B startup

**Story**:
> As a DevOps engineer,
> I want scheduled CSPM scans on my connected AWS accounts,
> so that I catch new misconfigurations without remembering to run manual scans.

**Constraints**:
- Team plan: 20 CSPM accounts, scheduled scans enabled
- Manages 15 AWS accounts (dev, staging, prod per region)

**Scenarios**:

1. **Initial Scan Setup**:
   - Mike connects 15 AWS accounts
   - Runs manual scans for all (takes 8 minutes due to cron batching)
   - Results: 127 findings across all accounts
   - Prioritizes remediation of 12 critical findings

2. **Configure Schedules**:
   - Production accounts (5): Set to "Daily" scans
   - Staging accounts (5): Set to "Weekly" scans
   - Dev accounts (5): Set to "Manual" (not critical)
   - First scheduled scans start in 1 hour

3. **Alert Integration**:
   - Creates Slack channel: "#cloud-security"
   - Connects to alert channel
   - Sets minSeverity: high
   - Tests: "Test alert sent to #cloud-security" ✓

4. **Automatic Detection**:
   - 3 days later, developer creates public S3 bucket in dev account
   - Next daily scan runs (2am UTC)
   - New finding detected: "S3 bucket publicly readable" (critical)
   - Alert dispatched to Slack
   - Mike wakes up to Slack message, fixes bucket before 9am standup

5. **Continuous Improvement**:
   - After 2 weeks, critical findings down from 12 to 3
   - Scan history shows consistent improvements
   - Mike presents to CTO: "Cloud security posture improving thanks to automated scans"

**Success Metric**: Scheduled scans adopted by 60% of Team plan customers

---

## Technical Constraints & Dependencies

### TC-1: Cloudflare Workers Runtime

| Constraint | Limit | Impact |
|---|---|---|
| CPU time (free) | 10ms | Cannot run long scans in free tier |
| CPU time (paid) | 30s | Real CSPM scan possible (but tight) |
| Memory | 128MB | Scan results must be streamed/paged |
| Bundle size | 10MB compressed | AWS SDK modular imports required |
| No filesystem | N/A | Cannot use `fs`, Puppeteer |
| No long-running processes | N/A | Cron-based architecture required |

### TC-2: D1 (SQLite) Limitations

| Constraint | Limit | Mitigation |
|---|---|---|
| Write throughput | ~100 writes/s | Batch inserts, use waitUntil |
| Query size | 1MB max | Pagination, limit results |
| No full-text search | N/A | LIKE queries, in-memory filtering |
| Row size | 2MB max | No large JSON blobs in rows |
| Batch inserts | 100 rows max | Chunk large datasets |

### TC-3: AWS SDK in Workers

| Challenge | Solution |
|---|---|
| Bundle size | Modular clients only, tree-shaking |
| Node.js dependencies | Use `nodejs_compat` flag |
| Alternative | Raw `fetch` + SigV4 signing (smaller) |
| Verification required | Test each client in Worker runtime |

### TC-4: Existing Patterns (Must Follow)

| Pattern | Source |
|---|---|
| Auth | `clerkAuth()` middleware |
| RBAC | `requirePermission('xxx')` |
| Org context | `resolveOrgContext` |
| Response format | `{ data }` / `{ error, message }` |
| DB | Drizzle ORM (no raw SQL) |
| File size | Max 200 lines per file |
| Loading states | Skeletons (CLAUDE.md) |

### TC-5: External Dependencies

| Service | Status | Configuration Required |
|---|---|---|
| AWS STS | New | IAM role template for customers |
| AWS SDK clients | New | Install 7 modular packages |
| Resend (email) | Existing | `RESEND_API_KEY` in env |
| Slack | New | User-provided webhook URLs |
| PagerDuty | New | User-provided API keys |
| OpsGenie | New | User-provided API keys |
| R2 (storage) | Existing | `STORAGE` binding in wrangler.toml |
| KV (rate limit) | Existing | Existing bindings |

### TC-6: Internal Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `packages/shared/plans.ts` | Exists | Source of truth for limits |
| `apps/api/middleware/rbac.ts` | Exists | Add plan enforcement middleware |
| `apps/api/utils/encryption.ts` | Exists | Use for alert channel configs |
| `apps/api/services/cron-handlers.ts` | Exists | Add new cron jobs |
| `packages/db` | Exists | Migration 0013 required |

---

## Priority Matrix & Implementation Order

### Priority Definitions

- **P0**: Blocks release or revenue (Must-have)
- **P1**: Important for enterprise conversion (Should-have)
- **P2**: Nice-to-have (Could-have)

### Effort Estimates

| Effort | Days | Description |
|---|---|---|
| XL | 5d | Complex + uncertain (AWS SDK in Workers) |
| L | 3d | Complex + straightforward (alert dispatch) |
| M | 2d | Moderate complexity |
| S | 1d | Simple + straightforward |
| XS | 0.5d | Very simple |

### Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| AWS SDK bundle size | High | Use modular imports, test early |
| AWS SDK Worker compatibility | High | Verify with `nodejs_compat`, have `fetch` fallback |
| Alert channel integrations | Medium | Well-documented APIs, test each independently |
| PDF generation in Workers | Medium | Use `jspdf`, have HTML fallback |
| Cron job CPU limits | Medium | Batch processing, use waitUntil |
| D1 write limits | Low | Batch inserts, well-understood |

### Priority Matrix

| ID | Requirement | Priority | Effort | Risk | Dependencies |
|---|---|---|---|---|---|
| FR-1 | Real AWS CSPM Scanner | P0 | XL (5d) | High | None (critical path) |
| FR-2 | Plan/Pricing Enforcement | P0 | M (2d) | Low | None |
| FR-5 | Missing API Endpoints | P0 | S (1d) | Low | None |
| FR-6 | Missing Proxy Routes | P0 | XS (0.5d) | Low | FR-5 |
| FR-10 | Loading Skeletons | P0 | S (1d) | Low | None |
| FR-3 | Alert Dispatch | P0 | L (3d) | Medium | None |
| FR-7 | Risk Trend Time Series | P1 | M (2d) | Low | None |
| FR-8 | PDF Report Export | P1 | M (2d) | Medium | None |
| FR-9 | Scheduled CSPM Re-Scan | P1 | S (1d) | Low | FR-1 |
| FR-4 | Cross-Linkage | P1 | M (2d) | Medium | FR-1 |

**Total effort**: ~20.5 days (2 developers, 2-week sprint with buffer)

### Recommended Implementation Order

**Week 1: Foundations + Critical Path**

1. **Day 1-2**: FR-5 + FR-6 (missing endpoints/proxies)
   - Unblocks existing UI
   - Low risk, quick win

2. **Day 3**: FR-10 (loading skeletons)
   - CLAUDE.md compliance
   - Quick win, improves UX

3. **Day 4-5**: FR-2 (plan enforcement)
   - Revenue-blocking
   - Enables all other feature gating

4. **Day 6-10**: FR-1 (real AWS CSPM scanner)
   - Parallel tracks: SDK integration + 20 checks implementation
   - **Critical path**: Start immediately after FR-2
   - Risk mitigation: Test SDK in Workers on Day 6, pivot to `fetch` if needed

**Week 2: Enterprise Features**

5. **Day 11-13**: FR-3 (alert dispatch)
   - Enterprise conversion feature
   - Can parallelize with FR-1 if AWS SDK unblocked

6. **Day 14-15**: FR-7 (risk trends) + FR-9 (scheduled scans)
   - Build on FR-1 foundation
   - Cron infrastructure needed

7. **Day 16-17**: FR-4 (cross-linkage)
   - Differentiation feature
   - Heuristics, can be refined post-launch

8. **Day 18-19**: FR-8 (PDF reports)
   - CISO feature
   - Can use HTML fallback if PDF problematic

9. **Day 20**: Buffer + testing + documentation

---

## Schema Changes & Migrations

### Migration 0013: Agent Security Platform Enhancements

**File**: `packages/db/migrations/0013_agent_security_platform_enhancements.sql`

```sql
-- Sprint 24: Alert channels, risk snapshots, scheduled scans
-- Adds notification infrastructure, historical tracking, and automation

-- ─── Alert Channels ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_channels (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK(channel_type IN ('email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord')),
  name TEXT NOT NULL,
  config TEXT NOT NULL,
  min_severity TEXT NOT NULL DEFAULT 'high' CHECK(min_severity IN ('critical', 'high', 'medium', 'low')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_channels_org ON alert_channels(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_channels_active ON alert_channels(org_id, is_active);

-- ─── Risk Score Snapshots ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_risk_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  agent_score INTEGER NOT NULL DEFAULT 100,
  cspm_score INTEGER NOT NULL DEFAULT 100,
  combined_score INTEGER NOT NULL DEFAULT 100,
  grade TEXT NOT NULL DEFAULT 'A',
  agent_event_count INTEGER NOT NULL DEFAULT 0,
  cspm_finding_count INTEGER NOT NULL DEFAULT 0,
  snapshot_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_user_date ON agent_risk_snapshots(user_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_org_date ON agent_risk_snapshots(org_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_risk_snapshots_date ON agent_risk_snapshots(snapshot_date);

-- ─── Scheduled Scans ─────────────────────────────────────────────────
-- Add columns to existing cloud_accounts table
ALTER TABLE cloud_accounts ADD COLUMN scan_schedule TEXT NOT NULL DEFAULT 'manual' CHECK(scan_schedule IN ('manual', 'daily', 'weekly'));
ALTER TABLE cloud_accounts ADD COLUMN next_scan_at TEXT;

CREATE INDEX IF NOT EXISTS idx_cloud_accounts_next_scan ON cloud_accounts(next_scan_at) WHERE next_scan_at IS NOT NULL;
```

### Drizzle Schema Updates

**New File**: `packages/db/src/schema/alert-channels.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { organizations } from './organizations.js';

export const alertChannels = sqliteTable('alert_channels', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  channelType: text('channel_type', {
    enum: ['email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord'],
  }).notNull(),
  name: text('name').notNull(),
  config: text('config').notNull(), // Encrypted JSON
  minSeverity: text('min_severity', {
    enum: ['critical', 'high', 'medium', 'low'],
  }).notNull().default('high'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
  updatedAt: text('updated_at').notNull().default(new Date().toISOString()),
});
```

**New File**: `packages/db/src/schema/risk-snapshots.ts`

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { organizations } from './organizations.js';
import { users } from './users.js';

export const agentRiskSnapshots = sqliteTable('agent_risk_snapshots', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  agentScore: integer('agent_score').notNull().default(100),
  cspmScore: integer('cspm_score').notNull().default(100),
  combinedScore: integer('combined_score').notNull().default(100),
  grade: text('grade').notNull().default('A'),
  agentEventCount: integer('agent_event_count').notNull().default(0),
  cspmFindingCount: integer('cspm_finding_count').notNull().default(0),
  snapshotDate: text('snapshot_date').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});
```

**Update**: `packages/db/src/schema/cspm.ts`

```typescript
// Add to existing cloudAccounts table definition:
scanSchedule: text('scan_schedule', {
  enum: ['manual', 'daily', 'weekly'],
}).notNull().default('manual'),
nextScanAt: text('next_scan_at'),
```

**Update**: `packages/db/src/schema/index.ts`

```typescript
export * from './alert-channels.js';
export * from './risk-snapshots.js';
```

---

## Gap Analysis

### Gaps Identified from Codebase Review

#### G1: Plan Enforcement Middleware Missing
**Current State**: No `requirePlanFeature` or `requirePlanLimit` middleware exists.
**Impact**: Free users can access premium features without upgrading.
**Priority**: P0 (Revenue blocking)
**Requirement**: FR-2

#### G2: AWS SDK Not Installed
**Current State**: `@aws-sdk/*` packages not in `apps/api/package.json`.
**Impact**: Cannot implement real CSPM scanner.
**Priority**: P0 (Critical path)
**Requirement**: FR-1

#### G3: Alert Dispatch Service Missing
**Current State**: `alert-evaluation.ts` exists but incomplete. No dispatch service.
**Impact**: No notifications for policy violations.
**Priority**: P0 (Enterprise conversion)
**Requirement**: FR-3

#### G4: Risk Snapshots Table Missing
**Current State**: No `agent_risk_snapshots` table in schema.
**Impact**: Cannot show historical trends.
**Priority**: P1 (Dashboard enhancement)
**Requirement**: FR-7

#### G5: PDF Generation Library Missing
**Current State**: No `jspdf` or similar package in dependencies.
**Impact**: Cannot generate PDF reports.
**Priority**: P1 (CISO feature)
**Requirement**: FR-8

#### G6: Scheduled Scan Infrastructure Missing
**Current State**: No `scan_schedule` or `next_scan_at` columns in `cloud_accounts`.
**Impact**: Cannot automate CSPM scans.
**Priority**: P1 (Operational efficiency)
**Requirement**: FR-9

#### G7: Loading Skeletons Not Used
**Current State**: Pages show spinners instead of structured skeletons.
**Impact**: Poor UX, violates CLAUDE.md requirements.
**Priority**: P0 (Compliance)
**Requirement**: FR-10

#### G8: Missing API Endpoints
**Current State**: UI references endpoints that don't exist (e.g., per-user activity).
**Impact**: Broken UI pages.
**Priority**: P0 (Unblocks existing features)
**Requirement**: FR-5

#### G9: Missing Proxy Routes
**Current State**: Next.js proxy routes don't exist for new endpoints.
**Impact**: Frontend cannot call backend.
**Priority**: P0 (Unblocks existing features)
**Requirement**: FR-6

#### G10: CSPM Finding Templates Incomplete
**Current State**: Only 10 templates exist, need 20 for full scope.
**Impact**: Incomplete cloud coverage.
**Priority**: P0 (Feature completeness)
**Requirement**: FR-1

### Gap Priority Matrix

| Gap | Priority | Effort | Blocking |
|---|---|---|---|
| G2: AWS SDK missing | P0 | XS (0.5d) | FR-1 |
| G8: Missing endpoints | P0 | S (1d) | UI |
| G9: Missing proxies | P0 | XS (0.5d) | UI |
| G7: Loading skeletons | P0 | S (1d) | CLAUDE.md |
| G1: Plan enforcement | P0 | M (2d) | Revenue |
| G3: Alert dispatch | P0 | L (3d) | Enterprise |
| G10: Finding templates | P0 | S (1d) | FR-1 |
| G4: Risk snapshots | P1 | S (1d) | FR-7 |
| G5: PDF library | P1 | XS (0.5d) | FR-8 |
| G6: Scheduled scan infra | P1 | S (1d) | FR-9 |

---

## Out of Scope

The following are explicitly **NOT** part of Sprint 24:

### Platform Features (Deferred to Sprint 25+)

- **Agent Attack Paths / Blast Radius Visualization**: Sprint 25 scope
- **Custom Policy Rule Types**: Existing 4 types sufficient for now
- **SSO/SAML Integration for Alert Channels**: Use webhook URLs/API keys instead
- **Multi-Region Data Residency**: Single D1 database for Sprint 24
- **Real-Time WebSocket Streaming**: HTTP polling sufficient for MVP
- **Custom Report Templates**: Single fixed format for Sprint 24
- **Additional Compliance Frameworks**: Existing CIS/SOC2 sufficient

### CSPM Features (Deferred to Sprint 29+)

- **GCP and Azure CSPM**: Only AWS supported in Sprint 24
- **Full Prowler Integration**: Curated top-20 checks only
- **Continuous Re-Scanning (Event-Driven)**: Scheduled scans only (no CloudWatch Events)
- **CSPM Remediation Playbooks**: Manual remediation only
- **Multi-Account Aggregation**: Per-account scans only

### Agent Monitoring (Future Sprints)

- **Agent Binary/Container Monitoring**: VSCode extension activity only
- **Network Traffic Monitoring**: File + bash events only
- **Agent Behavior Profiling (ML-based)**: Rule-based policies only
- **Agent Session Recording**: Event log only (no full session replay)

---

## Success Metrics & Acceptance Criteria

### Sprint-Level Success Gates

| Metric | Target | Measurement |
|---|---|---|
| Enterprise trials started | 3+ | Signups from extension → upgrade flow |
| First paid enterprise contract | $399+/mo (Team) | LemonSqueezy webhook |
| CISO PDF report generation time | < 5 minutes | From click to download |
| Real AWS CSPM scan success rate | > 95% | Production monitoring |
| Alert dispatch success rate | > 98% | Delivery logs |
| Plan enforcement coverage | 100% | All premium features gated |
| Loading skeleton coverage | 100% | All async pages use skeletons |

### Feature-Level Acceptance Criteria

#### FR-1: Real AWS CSPM Scanner
- [ ] AC-ALL: All 20 security checks implemented and tested
- [ ] AC-PERF: Scans complete in < 30s for typical accounts
- [ ] AC-COMPAT: AWS SDK modules work in Cloudflare Workers
- [ ] AC-ERROR: Partial failures handled gracefully

#### FR-2: Plan/Pricing Enforcement
- [ ] AC-COVERAGE: All 7 plan limits enforced (agentLimit, history, cloudSync, team, policies, reports, cspm)
- [ ] AC-GATING: 403 responses with upgrade CTAs
- [ ] AC-PURGE: Background job purges old activity
- [ ] AC-UI: Upgrade CTAs display at limit boundaries

#### FR-3: Alert Dispatch
- [ ] AC-CHANNELS: All 6 channel types working
- [ ] AC-ASYNC: Non-blocking via waitUntil
- [ ] AC-RATE: Deduplication + rate limiting
- [ ] AC-ERROR: Failed deliveries logged, don't block sync

#### FR-4: Cross-Linkage
- [ ] AC-PATTERNS: 5 correlation patterns implemented
- [ ] AC-UI: Related findings shown on activity pages
- [ ] AC-PERF: Query completes in < 100ms

#### FR-5: Missing Endpoints
- [ ] AC-COMPLETE: All 3 missing endpoints implemented
- [ ] AC-VALIDATION: Zod schemas on all requests
- [ ] AC-PERMISSIONS: RBAC checks in place

#### FR-6: Missing Proxies
- [ ] AC-COMPLETE: All 6 proxy routes implemented
- [ ] C-AUTH: 401 responses for unauthenticated

#### FR-7: Risk Trends
- [ ] AC-CRON: Daily snapshots stored
- [ ] AC-API: 3 trend endpoints implemented
- [ ] AC-UI: Chart component renders correctly

#### FR-8: PDF Reports
- [ ] AC-GEN: PDF generation completes in < 10s
- [ ] AC-FORMAT: All 6 sections included
- [ ] AC-PLAN: Team plan gating works
- [ ] AC-FALLBACK: HTML report preserved

#### FR-9: Scheduled Scans
- [ ] AC-SCHEDULE: Daily/weekly options work
- [ ] AC-TRIGGER: Cron fires scans on schedule
- [ ] AC-RETRY: Failed scans retry or mark error
- [ ] AC-PLAN: Plan limit enforced

#### FR-10: Loading Skeletons
- [ ] AC-COVERAGE: All 6 pages use skeletons
- [ ] AC-MATCH: Skeletons match actual layout
- [ ] AC-ANIM: Smooth pulse animation
- [ ] AC-A11Y: Proper ARIA labels

### Quality Gates

| Gate | Criteria | Tool |
|---|---|---|
| Test coverage | >= 80% line (services), >= 90% (routes) | Vitest |
| Type safety | 100% (no `any` except test mocks) | TypeScript strict mode |
| File size | Max 200 lines per file | CLAUDE.md lint |
| Bundle size | < 10MB compressed (API Worker) | wrangler tail |
| Performance | All NFR-1 targets met | Cloudflare Analytics |
| Security | All NFR-2 targets met | Code review + SAST scan |

---

## Appendix

### A. IAM Role Template (Customer-Facing)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "OpenSyberCSPMScan",
      "Effect": "Allow",
      "Action": [
        "s3:GetPublicAccessBlock",
        "s3:GetBucketAcl",
        "s3:GetBucketPolicy",
        "s3:GetBucketVersioning",
        "s3:GetBucketLogging",
        "s3:GetEncryptionConfiguration",
        "iam:GetAccountSummary",
        "iam:GetAccountPasswordPolicy",
        "iam:ListUsers",
        "iam:ListMFADevices",
        "iam:ListPolicies",
        "iam:GetPolicyVersion",
        "iam:ListAccessKeys",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeVolumes",
        "ec2:GetEbsEncryptionByDefault",
        "ec2:DescribeVpcs",
        "rds:DescribeDBInstances",
        "cloudtrail:DescribeTrails",
        "guardduty:ListDetectors"
      ],
      "Resource": "*"
    },
    {
      "Sid": "OpenSyberAssumeRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Principal": {
        "AWS": "arn:aws:iam::OPENSYBER_ACCOUNT_ID:root"
      },
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "CUSTOMER_PROVIDED_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

### B. Alert Channel Config Formats

**Slack**:
```json
{
  "webhookUrl": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX"
}
```

**PagerDuty**:
```json
{
  "routingKey": "pagerduty-integration-key-32chars",
  "severity": "critical"
}
```

**OpsGenie**:
```json
{
  "apiKey": "opsgenie-api-key-32chars",
  "priority": "P1"
}
```

**Email**:
```json
{
  "recipients": ["security@example.com", "ciso@example.com"]
}
```

**Teams**:
```json
{
  "webhookUrl": "https://outlook.office.com/webhook/xxx"
}
```

**Discord**:
```json
{
  "webhookUrl": "https://discord.com/api/webhooks/xxx"
}
```

### C. Risk Score Calculation Formula

```typescript
// Agent score (0-100)
agentScore = max(0, 100 - critical*20 - high*8 - medium*2 - secrets*5)

// CSPM score (0-100)
cspmScore = max(0, 100 - critical*15 - high*5 - medium*1)

// Combined score
combined = round(agentScore * 0.6 + cspmScore * 0.4)

// Grade
grade =
  combined >= 90 ? 'A' :
  combined >= 70 ? 'B' :
  combined >= 50 ? 'C' :
  combined >= 30 ? 'D' : 'F'
```

### D. Environment Variables Required

```bash
# Existing
OPENSYBER_API_URL=https://api.opensyber.cloud
CLERK_SECRET_KEY=sk_...
CLERK_PEM_PUBLIC_KEY=...
DATABASE_ID=...
STORAGE_BUCKET=...
KV_NAMESPACE=...
RESEND_API_KEY=re_...

# New for Sprint 24
# (No new env vars needed -- all per-org configs in DB)
```

---

**Document Status**: Complete
**Last Updated**: 2026-03-02
**Version**: 2.0 (Enhanced from original requirements)
**Next Review**: After Sprint 24 completion
