# TenantIQ API Reference

Base URL: `https://api.tenantiq.io`

All authenticated endpoints require `Authorization: Bearer <jwt>`.
Responses: `{ data: ... }` on success, `{ error: string }` on failure.
Rate limits: 1,000 req/min, 10,000 req/hr. Returns `429` when exceeded.

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health/` | No | Health check with version, uptime, DB/KV status |
| GET | `/health/ready` | No | Readiness probe (DB, KV, Graph API) |
| GET | `/health/live` | No | Liveness probe |

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/login` | No | Initiate OAuth flow, redirects to Azure AD |
| GET | `/api/auth/callback` | No | OAuth callback, exchanges code for tokens, returns JWT |
| POST | `/api/auth/refresh` | Yes | Refresh expired JWT |
| POST | `/api/auth/logout` | Yes | Invalidate session |

## Tenants

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tenants/` | Yes | List tenants for current org |
| POST | `/api/tenants/` | Yes | Register new Azure tenant |
| GET | `/api/tenants/:id` | Yes | Get tenant details |
| DELETE | `/api/tenants/:id` | Yes | Remove tenant and cached data |
| POST | `/api/tenants/:id/sync` | Yes | Trigger Graph API sync |
| GET | `/api/tenants/:id/sync/status` | Yes | Get sync progress |
| GET | `/api/tenants/:id/dashboard` | Yes | Full dashboard data (users, licenses, scores) |
| POST | `/api/tenants/:id/backup/analyze` | Yes | Analyze backup status |
| POST | `/api/tenants/:id/backup/create` | Yes | Create tenant backup |
| POST | `/api/tenants/:id/phishing/scan` | Yes | Run phishing scan |
| POST | `/api/tenants/:id/promo` | Yes | Apply promo code |

### Tenant Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tenants/:tenantId/profile` | Yes | Get tenant profile |
| POST | `/api/tenants/:tenantId/profile` | Yes | Update tenant profile |
| GET | `/api/tenants/:tenantId/security-baseline` | Yes | Get security baseline config |

### Tenant Purview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tenants/:tenantId/purview/` | Yes | Get Purview compliance data |

### Tenant Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tenants/:tenantId/webhooks/config` | Yes | Get webhook config |
| POST | `/api/tenants/:tenantId/webhooks/config` | Yes | Create/update webhook config |
| DELETE | `/api/tenants/:tenantId/webhooks/config` | Yes | Delete webhook config |
| POST | `/api/tenants/:tenantId/webhooks/test` | Yes | Send test webhook |

## Licenses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tenants/:tenantId/licenses/` | Yes | List all licenses for tenant |
| GET | `/api/tenants/:tenantId/licenses/waste` | Yes | Detect wasted/unused licenses |
| POST | `/api/tenants/:tenantId/licenses/optimize` | Yes | Run license optimization |
| GET | `/api/tenants/:tenantId/licenses/export` | Yes | Export license report (CSV) |

## Security

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/security/dashboard` | Yes | Security dashboard (score, alerts, policies) |
| GET | `/api/security/posture` | Yes | Security posture assessment |
| GET | `/api/security/compliance` | Yes | Compliance status (MFA, CA, devices) |
| GET | `/api/security/risks` | Yes | Risk assessment (risky users, creds, detections) |

## CIS Benchmark

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/cis-benchmark/scan` | Yes | Trigger CIS benchmark scan (requires `cis` skill) |
| GET | `/api/cis-benchmark/latest` | Yes | Get latest scan results |
| GET | `/api/cis-benchmark/history` | Yes | Get scan history |
| GET | `/api/cis-benchmark/controls` | Yes | List all CIS controls |

## Compliance

### Compliance Posture

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/compliance-posture/assess` | Yes | Run full compliance assessment |
| GET | `/api/compliance-posture/quick-check` | Yes | Quick compliance check |
| GET | `/api/compliance-posture/frameworks` | Yes | List compliance frameworks |

### Purview DLP

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/purview/dlp` | Yes | DLP policy violations |
| GET | `/api/purview/labels` | Yes | Sensitivity labels |
| GET | `/api/purview/overview` | Yes | Purview overview dashboard |

### Zero Trust

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/zero-trust/assessment` | Yes | Zero Trust maturity assessment |
| GET | `/api/zero-trust/roadmap` | Yes | Zero Trust implementation roadmap |

## Alerts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/alerts/` | Yes | List alerts (filterable by severity, status) |
| GET | `/api/alerts/:alertId` | Yes | Get alert details |
| PATCH | `/api/alerts/:alertId` | Yes (operator+) | Update alert status (acknowledge, resolve) |

### Alert Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/alert-analytics/trends` | Yes | Alert trend data over time |
| GET | `/api/alert-analytics/distribution` | Yes | Alert distribution by type/severity |
| GET | `/api/alert-analytics/recurring` | Yes | Recurring alert patterns |

## Remediations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/remediations/` | Yes | List remediations |
| GET | `/api/remediations/:remediationId` | Yes | Get remediation details |
| POST | `/api/remediations/execute` | Yes (operator+) | Execute remediation action |
| POST | `/api/remediations/dry-run` | Yes | Preview remediation (dry run) |
| POST | `/api/remediations/:id/rollback` | Yes (operator+) | Rollback a remediation |
| GET | `/api/remediations/scheduled` | Yes | List scheduled remediations |
| PATCH | `/api/remediations/scheduled/:id` | Yes | Update scheduled remediation |

## AI

### AI Agent (per-tenant)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/tenants/:tenantId/ai/ask` | Yes | Ask AI agent a question |
| GET | `/api/tenants/:tenantId/ai/history` | Yes | Get conversation history |
| GET | `/api/tenants/:tenantId/ai/history/:cid` | Yes | Get specific conversation |
| POST | `/api/tenants/:tenantId/ai/stream` | Yes | Stream AI response (SSE) |

### AI Engine

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ai/status` | Yes | AI engine status |
| GET | `/api/ai/agents` | Yes | List available AI agents |
| POST | `/api/ai/security-scan/:tenantId` | Yes | AI security scan |
| POST | `/api/ai/license-optimize/:tenantId` | Yes | AI license optimization |
| POST | `/api/ai/ask/:tenantId` | Yes | AI question (engine route) |
| POST | `/api/ai/chain/:tenantId` | Yes | Chain multiple AI operations |

### AI Export

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tenants/:tenantId/ai/conversations/:id/export` | Yes | Export conversation |
| POST | `/api/tenants/:tenantId/ai/conversations/:id/share` | Yes | Share conversation link |
| GET | `/api/shared/conversations/:token` | No | View shared conversation |

## Workflows

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/workflows/` | Yes | List workflows |
| GET | `/api/workflows/:workflowId` | Yes | Get workflow details |
| POST | `/api/workflows/` | Yes (admin+) | Create workflow |

## Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/users/` | Yes | List users (from Graph API) |
| GET | `/api/users/:userId` | Yes | Get user details |
| GET | `/api/users/:userId/licenses` | Yes | Get user licenses |
| POST | `/api/users/:userId/licenses` | Yes (admin+) | Assign license to user |
| DELETE | `/api/users/:userId/licenses/:skuId` | Yes (admin+) | Remove license |
| GET | `/api/users/licenses/available` | Yes | List available license SKUs |

### User Delegation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/delegations/` | Yes (admin+) | List all delegations |
| POST | `/api/users/:userId/delegate` | Yes (admin+) | Create delegation |
| GET | `/api/users/:userId/delegations` | Yes (admin+) | List user delegations |
| DELETE | `/api/users/:userId/delegations/:delegationId` | Yes (admin+) | Revoke delegation |

### User Bulk Operations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/users/bulk` | Yes (admin+) | Bulk user operation (enable/disable/license) |
| GET | `/api/users/bulk/:batchId` | Yes (admin+) | Get batch operation status |
| POST | `/api/users/import` | Yes (admin+) | Import users from CSV |

## Governance

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/governance/sync` | Yes | Sync workspaces from Graph API |
| GET | `/api/governance/workspaces` | Yes | List workspaces |
| GET | `/api/governance/workspaces/:id` | Yes | Get workspace details |

### Storage Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/storage-analytics/` | Yes | Get storage usage data |
| POST | `/api/storage-analytics/scan` | Yes | Trigger storage scan |

### Guest Review

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/guest-review/results` | Yes | Get guest review results |
| POST | `/api/guest-review/run` | Yes | Run guest access review |
| POST | `/api/guest-review/approve` | Yes | Approve/revoke guest access |
| GET | `/api/guest-review/history` | Yes | Guest review history |

### Group Cleanup

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/group-cleanup/results` | Yes | Get cleanup results |
| POST | `/api/group-cleanup/run` | Yes | Run group cleanup analysis |
| POST | `/api/group-cleanup/archive` | Yes | Archive inactive groups |
| GET | `/api/group-cleanup/history` | Yes | Cleanup history |

## Lifecycle

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/lifecycle/templates` | Yes | List lifecycle templates |
| POST | `/api/lifecycle/templates` | Yes | Create lifecycle template |
| DELETE | `/api/lifecycle/templates/:id` | Yes | Delete template |
| POST | `/api/lifecycle/execute` | Yes | Execute lifecycle action (onboard/offboard) |
| GET | `/api/lifecycle/executions` | Yes | List execution history |

## Copilot

### Copilot Readiness

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/copilot-readiness/assess` | Yes | Run readiness assessment |
| GET | `/api/copilot-readiness/latest` | Yes | Get latest assessment |
| GET | `/api/copilot-readiness/history` | Yes | Assessment history |

### Copilot Usage

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/copilot-usage/` | Yes | Get usage data |
| POST | `/api/copilot-usage/scan` | Yes | Trigger usage scan |

## Config Snapshots

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/config-snapshots/capture` | Yes | Capture config snapshot |
| GET | `/api/config-snapshots/` | Yes | List snapshots |
| GET | `/api/config-snapshots/:id` | Yes | Get snapshot details |
| GET | `/api/config-snapshots/:id/category/:cat` | Yes | Get snapshot by category |
| GET | `/api/config-snapshots/:id/diff/:otherId` | Yes | Diff two snapshots |

## Reports

### Executive Report

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/executive-report/generate` | Yes | Generate executive report |
| POST | `/api/executive-report/email-preview` | Yes | Preview report email |
| GET | `/api/executive-report/pdf-preview` | Yes | PDF report preview |

### Report Builder

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/report-builder/metrics` | Yes | List available metrics |
| POST | `/api/report-builder/generate` | Yes | Generate custom report |
| POST | `/api/report-builder/templates` | Yes | Save report template |
| GET | `/api/report-builder/templates` | Yes | List saved templates |

## Backups

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/backup-health/` | Yes | Backup health for current tenant |
| GET | `/api/backup-health/all` | Yes (admin+) | Backup health across all tenants |

## Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/graph` | No | Microsoft Graph webhook receiver |
| GET | `/api/webhooks/subscriptions` | Yes | List webhook subscriptions |
| POST | `/api/webhooks/subscriptions` | Yes (admin+) | Create subscription |
| DELETE | `/api/webhooks/subscriptions/:subscriptionId` | Yes (admin+) | Delete subscription |

### Webhook Config

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/webhook-config/` | Yes | Get webhook configuration |
| POST | `/api/webhook-config/` | Yes | Create/update webhook config |
| POST | `/api/webhook-config/test` | Yes | Send test webhook |

### OpenClaw Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/webhooks/openclaw/receive` | No | Receive OpenClaw webhook |
| POST | `/api/webhooks/openclaw/deliver` | Yes | Deliver webhook to tenant |
| GET | `/api/webhooks/openclaw/deliveries/:tenantId` | Yes | List deliveries |
| GET | `/api/webhooks/openclaw/stats/:tenantId` | Yes | Delivery stats |

### OpenClaw Integration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/integrations/openclaw/status` | Yes | Integration status |
| GET | `/api/integrations/openclaw/platforms` | Yes | List platforms |
| POST | `/api/integrations/openclaw/platforms/:platformId/connect` | Yes | Connect platform |
| POST | `/api/integrations/openclaw/platforms/:platformId/disconnect` | Yes | Disconnect platform |

## Push Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/push/subscribe` | Yes | Subscribe to push notifications |
| DELETE | `/api/push/unsubscribe` | Yes | Unsubscribe |
| GET | `/api/push/preferences` | Yes | Get notification preferences |
| PATCH | `/api/push/preferences` | Yes | Update preferences |

## Approvals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/approvals/` | Yes | List pending approvals |
| GET | `/api/approvals/history` | Yes | Approval history |
| GET | `/api/approvals/:id` | Yes | Get approval details |
| POST | `/api/approvals/:id/decide` | Yes (admin+) | Approve or reject |

## Migration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/migration/plan` | Yes | Create migration plan |
| POST | `/api/migration/execute` | Yes | Execute migration |
| GET | `/api/migration/:id/status` | Yes | Get migration status |

## Portal (Self-Service)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/portal/me` | Yes | Get current user profile |
| GET | `/api/portal/me/licenses` | Yes | Get own licenses |
| POST | `/api/portal/me/license-request` | Yes | Request a license |
| GET | `/api/portal/me/activity` | Yes | Get own activity log |

## MSP

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/msp/overview` | Yes | MSP overview (all tenants summary) |

### MSP Benchmark

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/msp-benchmark/` | Yes | Cross-tenant benchmark scores |

## Analytics

### Intelligence

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/intelligence/scans` | Yes | List security scans |
| GET | `/api/intelligence/scans/:scanId` | Yes | Get scan details |
| GET | `/api/intelligence/user-activity` | Yes | User activity summary |
| GET | `/api/intelligence/user-activity/:userId` | Yes | Per-user activity |
| POST | `/api/intelligence/trigger-scan` | Yes (admin+) | Trigger new scan |

### Anomaly Detection

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/anomaly-detection/scan` | Yes | Run anomaly detection scan |
| POST | `/api/anomaly-detection/login-check` | Yes | Check login anomalies |
| POST | `/api/anomaly-detection/activity-check` | Yes | Check activity anomalies |

### Health Score

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health-score/` | Yes | Tenant health score |
| POST | `/api/health-score/ai-analysis` | Yes | AI-powered health analysis |

### Usage Heatmap

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/usage-heatmap/` | Yes | Service usage heatmap |
| POST | `/api/usage-heatmap/custom` | Yes | Custom date range heatmap |
| GET | `/api/usage-heatmap/adoption-score` | Yes | Adoption score |

### Tenant Comparison

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/tenant-comparison/compare` | Yes | Compare tenants |
| GET | `/api/tenant-comparison/preview` | Yes | Comparison preview |

### Cost Optimization

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cost-optimization/` | Yes | Cost optimization opportunities |
| POST | `/api/cost-optimization/ai-recommendations` | Yes | AI cost recommendations |
| GET | `/api/cost-optimization/summary` | Yes | Cost summary |

### Savings Leaderboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/savings/leaderboard` | Yes | Savings leaderboard |
| GET | `/api/savings/roi` | Yes | ROI calculations |
| GET | `/api/savings/achievements` | Yes | Cost-saving achievements |

### License Autopilot

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/license-autopilot/analyze` | Yes | Run autopilot analysis |
| GET | `/api/license-autopilot/config` | Yes | Get autopilot config |
| POST | `/api/license-autopilot/preview` | Yes | Preview autopilot actions |

## Onboarding

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/onboarding/plan` | Yes | Create onboarding plan |
| POST | `/api/onboarding/ai-recommendations` | Yes | AI onboarding recommendations |
| POST | `/api/onboarding/execute` | Yes | Execute onboarding step |

### Onboarding Tracking

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/onboarding/templates` | Yes | List onboarding templates |
| POST | `/api/onboarding/welcome-email` | Yes | Send welcome email |
| POST | `/api/onboarding/checklist` | Yes | Update onboarding checklist |
| POST | `/api/onboarding/status` | Yes | Update onboarding status |
| GET | `/api/onboarding/progress/:onboardingId` | Yes | Get onboarding progress |

## Team

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/team/` | Yes | List team members |
| POST | `/api/team/invite` | Yes | Invite team member |
| DELETE | `/api/team/:userId` | Yes | Remove team member |
| PATCH | `/api/team/:userId/role` | Yes | Update member role |
| DELETE | `/api/team/invitations/:inviteId` | Yes | Cancel invitation |

## Platform Admin

### Platform Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/platform/auth/login` | No | Platform admin login |
| POST | `/platform/auth/verify` | Yes | Verify platform token |
| GET | `/platform/auth/me` | Yes | Get platform user profile |

### Platform Organizations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/platform/organizations/` | Yes | List organizations |
| GET | `/platform/organizations/:orgId` | Yes | Get organization details |
| POST | `/platform/organizations/` | Yes | Create organization |
| PATCH | `/platform/organizations/:orgId` | Yes | Update organization |
| DELETE | `/platform/organizations/:orgId` | Yes | Delete organization |
| GET | `/platform/organizations/:orgId/stats` | Yes | Organization stats |

### Platform Users

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/platform/users/` | Yes (admin) | List platform users |
| GET | `/platform/users/:userId` | Yes | Get user details |
| POST | `/platform/users/` | Yes (admin) | Create platform user |
| PATCH | `/platform/users/:userId` | Yes | Update user |
| DELETE | `/platform/users/:userId` | Yes | Delete user |
| POST | `/platform/users/invite` | Yes | Invite user |
| GET | `/platform/users/invitations` | Yes | List invitations |

### Platform Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/platform/subscriptions/` | Yes | List subscriptions |
| POST | `/platform/subscriptions/` | Yes | Create subscription |
| PATCH | `/platform/subscriptions/:subscriptionId` | Yes | Update subscription |
| GET | `/platform/subscriptions/usage` | Yes | Usage metrics |
| POST | `/platform/subscriptions/usage` | Yes | Record usage |
| GET | `/platform/subscriptions/invoices` | Yes | List invoices |
| GET | `/platform/subscriptions/expiring` | Yes | Expiring subscriptions |

## Events

### Event Triggers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/event-triggers/` | Yes | List event trigger rules |
| POST | `/api/event-triggers/` | Yes (admin+) | Create event trigger rule |
| PATCH | `/api/event-triggers/:id` | Yes (admin+) | Update trigger rule |

### Event Log

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events/log` | Yes | List event log entries |
| GET | `/api/events/log/:id` | Yes | Get event details |
| GET | `/api/events/stats` | Yes | Event statistics |
| POST | `/api/events/replay/:id` | Yes | Replay an event |

## Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings/ai-provider` | Yes | Get AI provider config |
| POST | `/api/settings/ai-provider` | Yes | Update AI provider config |
