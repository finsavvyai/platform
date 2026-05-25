# TenantIQ API Reference

**Base URL**: `https://api.tenantiq.app`
**Auth**: Bearer token (JWT HS256) via `Authorization: Bearer <token>` header
**Tenant Scoping**: Most endpoints require `X-Tenant-Id` header or tenant context from JWT

---

## Health & Monitoring

### GET /health/
Health check. Returns 200 if healthy, 503 if unhealthy.
**Auth**: None

### GET /health/ready
Readiness probe for load balancers.
**Auth**: None

### GET /health/live
Liveness probe.
**Auth**: None

### GET /health/detailed
Comprehensive check across D1, KV, and R2 with latency metrics.
**Auth**: None

### GET /health/ping
Ultra-fast liveness probe (no DB).
**Auth**: None

### GET /api/metrics
Internal metrics dashboard: API latency, rate limit stats, cache hit rates.
**Auth**: Admin recommended

### POST /api/metrics/ratelimit
Track a rate-limited request.
**Body**: `{ ip: string }`

---

## Auth & SSO

### GET /api/auth/login
Redirect to Microsoft OAuth2 login. Stores state in KV.
**Auth**: None | **Rate Limit**: 20/5min

### GET /api/auth/callback
OAuth2 callback. Exchanges code for tokens, upserts platform user, issues JWT.
**Auth**: None | **Rate Limit**: 20/5min

### POST /api/auth/refresh
Refresh JWT token with fresh tenant IDs.
**Auth**: Bearer (expired OK within 7d) | **Rate Limit**: 30/5min

### POST /api/auth/logout
Invalidate session in KV.
**Auth**: Bearer

### GET /api/sso
List SSO connections for current org.
**Auth**: Required

### POST /api/sso
Create SAML/OIDC SSO connection.
**Auth**: Required
**Body**: `{ provider, displayName, domain, issuerUrl?, clientId?, metadataUrl?, certificate?, jitEnabled? }`

### PATCH /api/sso/:id
Update SSO connection fields.
**Auth**: Required

### DELETE /api/sso/:id
Delete SSO connection.
**Auth**: Required

### POST /api/sso/:id/test
Test SSO connection reachability and configuration.
**Auth**: Required

---

## Tenants & Dashboard

### GET /api/tenants
List tenants for the user's organization.
**Auth**: Required

### POST /api/tenants
Onboard a new tenant. Validates with Zod. Issues updated JWT.
**Auth**: Required
**Body**: `{ azureTenantId, displayName, domain }`

### GET /api/tenants/:tenantId/dashboard
Aggregated dashboard metrics (users, licenses, alerts, security score).
**Auth**: Required

### POST /api/tenants/:tenantId/sync
Trigger user and license sync from Microsoft Graph.
**Auth**: Required

### DELETE /api/tenants/:tenantId
Disconnect a tenant.
**Auth**: Required

### GET /api/tenants/:tenantId/alerts
Alerts for a specific tenant.
**Auth**: Required

### GET /api/tenants/:tenantId/users
Cached user list for a tenant.
**Auth**: Required

### GET /api/tenants/:tenantId/licenses
Cached license summary for a tenant.
**Auth**: Required

---

## Alerts & Analytics

### GET /api/alerts
List alerts with optional filters.
**Auth**: Required | **Query**: `status`, `severity`, `type`, `prioritize`

### GET /api/alerts/:alertId
Alert detail with history.
**Auth**: Required

### PATCH /api/alerts/:alertId
Update alert status (acknowledged/resolved/dismissed).
**Auth**: Operator+ | **Body**: `{ status, notes? }`

### GET /api/alert-analytics/trends
Alert trend data over time.
**Auth**: Required

### GET /api/alert-analytics/distribution
Alert distribution by type/severity.
**Auth**: Required

### GET /api/alert-analytics/recurring
Recurring alert patterns.
**Auth**: Required

---

## Security

### GET /api/security/dashboard
Unified security dashboard: secure score, MFA rate, CA policies, risky users.
**Auth**: Required | **Cache**: 5min

### GET /api/security/posture
MFA, password policy, and conditional access analysis.
**Auth**: Required

### GET /api/security/compliance
Compliance posture: CA policies, MFA registration, security defaults.
**Auth**: Required

### GET /api/security/risks
Risk detections: risky users, expiring credentials, suspicious sign-ins.
**Auth**: Required

---

## CIS Benchmark

### POST /api/cis-benchmark/scan
Run full CIS M365 benchmark scan. Skill-gated (`cis`).
**Auth**: Required | **Requires**: Graph API token

### GET /api/cis-benchmark/latest
Get cached latest CIS scan result.
**Auth**: Required

### GET /api/cis-benchmark/history
Scan history with scores (up to 20).
**Auth**: Required

### GET /api/cis-benchmark/controls
Get CIS control catalog and sections.
**Auth**: Required

---

## Copilot Readiness

### POST /api/copilot-readiness/assess
Run 7-category Copilot readiness assessment. Skill-gated (`copilot`).
**Auth**: Required | **Requires**: Graph API token

### GET /api/copilot-readiness/latest
Get cached latest assessment result.
**Auth**: Required

### GET /api/copilot-readiness/history
Assessment history (up to 20).
**Auth**: Required

### GET /api/copilot-readiness/export
Export latest assessment as HTML report.
**Auth**: Required

---

## Copilot Usage & Security

### GET /api/copilot-usage
Cached Copilot usage data.
**Auth**: Required

### POST /api/copilot-usage/scan
Trigger Copilot usage scan from Graph.
**Auth**: Required

### POST /api/copilot-security/scan
Run Copilot security posture analysis.
**Auth**: Required

### GET /api/copilot-security/posture
Get latest Copilot security posture.
**Auth**: Required

### POST /api/copilot-security/analyze-prompt
Analyze a prompt for security risks.
**Auth**: Required

---

## Config Snapshots & Drift Detection

### POST /api/config-snapshots/capture
Capture M365 configuration snapshot.
**Auth**: Required | **Body**: `{ label? }`

### GET /api/config-snapshots
List snapshots (up to 50).
**Auth**: Required

### GET /api/config-snapshots/:id
Get snapshot manifest.
**Auth**: Required

### GET /api/config-snapshots/:id/category/:cat
Get category data within a snapshot.
**Auth**: Required

### POST /api/config-snapshots/:id/baseline
Set snapshot as baseline for drift detection.
**Auth**: Required

### GET /api/config-snapshots/:id/diff/:otherId
Diff two snapshots.
**Auth**: Required

### GET /api/config-drifts
List detected drifts.
**Auth**: Required | **Query**: `severity`, `acknowledged`

### GET /api/config-drifts/summary
Drift summary counts by severity.
**Auth**: Required

### PATCH /api/config-drifts/:id/acknowledge
Acknowledge a specific drift.
**Auth**: Required

### PATCH /api/config-drifts/acknowledge-all
Acknowledge all unacknowledged drifts.
**Auth**: Required

---

## Storage Analytics

### GET /api/storage-analytics
Cached storage overview (OneDrive + SharePoint).
**Auth**: Required

### POST /api/storage-analytics/scan
Trigger full storage scan.
**Auth**: Required

### GET /api/storage-analytics/onedrive
OneDrive per-user breakdown.
**Auth**: Required

### GET /api/storage-analytics/sharepoint
SharePoint per-site breakdown.
**Auth**: Required

### GET /api/storage-analytics/recommendations
Storage optimization suggestions.
**Auth**: Required

### GET /api/storage-analytics/unused-licenses
Unused storage license report.
**Auth**: Required

---

## AI Agent & Engine

### POST /api/tenants/:tenantId/ai/chat
Send message to AI agent with tool execution loop.
**Auth**: Required | **Rate Limit**: 50/hr
**Body**: `{ message, conversationId? }`

### POST /api/tenants/:tenantId/ai/stream
SSE streaming chat endpoint.
**Auth**: Required | **Rate Limit**: 50/hr
**Body**: `{ message, conversationId? }`

### GET /api/tenants/:tenantId/ai/history
Conversation history.
**Auth**: Required

### GET /api/tenants/:tenantId/ai/history/:cid
Single conversation detail.
**Auth**: Required

### GET /api/tenants/:tenantId/ai/conversations/:id/export
Export conversation as markdown or JSON.
**Auth**: Required | **Query**: `format` (markdown|json)

### POST /api/tenants/:tenantId/ai/conversations/:id/share
Create shareable link (expires in 7 days).
**Auth**: Required

### GET /api/shared/conversations/:token
Public shared conversation view (rate-limited, redacted).
**Auth**: None

### GET /api/ai/status
AI engine status (OpenClaw + Anthropic).
**Auth**: None

### GET /api/ai/agents
List available AI agents.
**Auth**: None

### POST /api/ai/security-scan/:tenantId
Run AI security scan. Skill-gated.
**Auth**: Required

### POST /api/ai/license-optimize/:tenantId
Run AI license optimization.
**Auth**: Required

### POST /api/ai/ask/:tenantId
Natural language query. Skill-gated.
**Auth**: Required | **Body**: `{ question, agent?, provider? }`

### POST /api/ai/chain/:tenantId
Multi-agent chain execution. Skill-gated.
**Auth**: Required | **Body**: `{ preset, provider? }`
**Presets**: `security-audit`, `compliance-check`, `cost-review`, `full-assessment`

---

## Remediations

### GET /api/remediations
Remediation history for a tenant.
**Auth**: Required

### GET /api/remediations/:remediationId
Remediation detail with steps.
**Auth**: Required

### POST /api/remediations/execute
Execute or schedule a remediation.
**Auth**: Operator+ | **Body**: `{ alertId, actionType, actionParameters?, scheduledAt? }`

### POST /api/remediations/dry-run
Preview remediation impact without executing.
**Auth**: Operator+

### GET /api/remediations/scheduled
List scheduled remediations.
**Auth**: Required

### PATCH /api/remediations/scheduled/:id
Reschedule or cancel a scheduled remediation.
**Auth**: Operator+

### POST /api/remediations/:remediationId/rollback
Rollback a completed remediation.
**Auth**: Operator+

---

## Workflows

### GET /api/workflows
List workflows for a tenant.
**Auth**: Required

### GET /api/workflows/:workflowId
Workflow detail with execution history.
**Auth**: Required

### POST /api/workflows
Create a new workflow.
**Auth**: Admin+ | **Body**: `{ name, type, schedule?, parameters?, conditions? }`

---

## Licenses & Cost Optimization

### GET /api/tenants/:tenantId/licenses
License summary with total spend.
**Auth**: Required

### GET /api/tenants/:tenantId/licenses/waste
License waste analysis.
**Auth**: Required

### POST /api/tenants/:tenantId/licenses/optimize
Execute bulk license optimization (queued).
**Auth**: Required | **Body**: `{ userIds, action, targetSku? }`

### GET /api/tenants/:tenantId/licenses/export
Export licenses as CSV.
**Auth**: Required

### GET /api/cost-optimization
Cost optimization analysis for a tenant.
**Auth**: Required

### POST /api/cost-optimization/ai-recommendations
AI-powered cost optimization recommendations.
**Auth**: Required

### GET /api/cost-optimization/summary
Cost optimization summary.
**Auth**: Required

### POST /api/license-autopilot/analyze
Analyze license reclamation candidates.
**Auth**: Required

### GET /api/license-autopilot/config
Get autopilot configuration.
**Auth**: Required

### POST /api/license-autopilot/preview
Preview autopilot actions (dry run).
**Auth**: Required

---

## Users & Management

### GET /api/users
List all users for a tenant from Microsoft Graph.
**Auth**: Required

### GET /api/users/:userId
User detail.
**Auth**: Required

### GET /api/users/:userId/licenses
User's license assignments.
**Auth**: Required

### POST /api/users/:userId/licenses
Assign a license to a user.
**Auth**: Admin+ | **Body**: `{ skuId }`

### DELETE /api/users/:userId/licenses/:skuId
Remove a license from a user.
**Auth**: Admin+

### GET /api/users/licenses/available
List available SKUs for the tenant.
**Auth**: Required

### POST /api/users/:userId/delegate
Create ad-hoc mailbox/OneDrive delegation.
**Auth**: Admin+

### GET /api/users/:userId/delegations
List delegations for a user.
**Auth**: Admin+

### DELETE /api/users/:userId/delegations/:delegationId
Revoke a delegation.
**Auth**: Admin+

### POST /api/users/bulk
Execute batch user operations.
**Auth**: Admin+ | **Body**: `{ userIds, operation, params? }`

### GET /api/users/bulk/:batchId
Check batch operation status.
**Auth**: Admin+

### POST /api/users/import
CSV-based user import.
**Auth**: Admin+

---

## Team Management

### GET /api/team
List team members and pending invitations.
**Auth**: Required

### POST /api/team/invite
Invite a new team member.
**Auth**: Required | **Body**: `{ email, role? }`

### DELETE /api/team/:userId
Remove a team member.
**Auth**: Required

### PATCH /api/team/:userId/role
Change a member's role.
**Auth**: Required | **Body**: `{ role }`

### DELETE /api/team/invitations/:inviteId
Revoke a pending invitation.
**Auth**: Required

---

## Governance

### POST /api/governance/sync
Sync workspace inventory from Graph.
**Auth**: Required

### GET /api/governance/workspaces
List workspaces with filters.
**Auth**: Required | **Query**: `filter` (inactive|external|no_owner), `type`

### GET /api/governance/workspaces/:id
Workspace detail.
**Auth**: Required

---

## User Lifecycle

### GET /api/lifecycle/templates
List lifecycle templates.
**Auth**: Required

### POST /api/lifecycle/templates
Create a lifecycle template.
**Auth**: Required | **Body**: `{ name, type, steps, requiresApproval? }`

### DELETE /api/lifecycle/templates/:id
Delete a lifecycle template.
**Auth**: Required

### POST /api/lifecycle/execute
Execute lifecycle template against a user.
**Auth**: Required | **Body**: `{ templateId, targetUserId, targetUserEmail? }`

### GET /api/lifecycle/executions
List lifecycle executions.
**Auth**: Required

---

## Onboarding

### POST /api/onboarding/plan
Generate intelligent onboarding plan for a new employee.
**Auth**: Required
**Body**: `{ userName, email, role, department, startDate, similarUserEmail? }`

### POST /api/onboarding/ai-recommendations
Get AI-powered onboarding recommendations.
**Auth**: Required

### POST /api/onboarding/execute
Execute onboarding plan (dry run by default).
**Auth**: Required | **Body**: `{ plan, dryRun? }`

### GET /api/onboarding/templates
Role-based onboarding templates.
**Auth**: Required

### POST /api/onboarding/welcome-email
Generate personalized welcome email.
**Auth**: Required

### POST /api/onboarding/checklist
Generate Day 1/Week 1/Month 1 checklist.
**Auth**: Required

### POST /api/onboarding/status
Track onboarding progress.
**Auth**: Required

### GET /api/onboarding/progress/:onboardingId
Real-time onboarding progress.
**Auth**: Required

---

## Anomaly Detection

### POST /api/anomaly-detection/scan
Run anomaly detection on login events and activity.
**Auth**: Required

### POST /api/anomaly-detection/login-check
Check login events for anomalies only.
**Auth**: Required

### POST /api/anomaly-detection/activity-check
Check activity metrics for anomalies only.
**Auth**: Required

---

## Compliance & Purview

### POST /api/compliance-posture/assess
Full compliance posture assessment.
**Auth**: Required

### GET /api/compliance-posture/quick-check
Quick compliance check.
**Auth**: Required

### GET /api/compliance-posture/frameworks
Compliance frameworks status.
**Auth**: Required | **Cache**: 10min

### GET /api/purview/dlp
DLP policies from Purview.
**Auth**: Required

### GET /api/purview/labels
Sensitivity labels.
**Auth**: Required

### GET /api/purview/overview
Purview compliance overview.
**Auth**: Required

### GET /api/zero-trust/assessment
Zero Trust assessment across 6 pillars.
**Auth**: Required

### GET /api/zero-trust/roadmap
Zero Trust improvement roadmap.
**Auth**: Required

---

## Intelligence & Scans

### GET /api/intelligence/scans
List security intelligence scans.
**Auth**: Required

### GET /api/intelligence/scans/:scanId
Scan detail with findings.
**Auth**: Required

### GET /api/intelligence/user-activity
User activity intelligence.
**Auth**: Required

### GET /api/intelligence/user-activity/:userId
Per-user activity detail.
**Auth**: Required

### POST /api/intelligence/trigger-scan
Trigger intelligence scan.
**Auth**: Admin+

---

## Health Score

### GET /api/health-score
Compute tenant health score across 6 dimensions.
**Auth**: Required

### POST /api/health-score/ai-analysis
AI-powered health score analysis.
**Auth**: Required

---

## Reports & Export

### POST /api/executive-report/generate
Generate executive report with metrics.
**Auth**: Required

### POST /api/executive-report/email-preview
Preview executive report email.
**Auth**: Required

### GET /api/executive-report/pdf-preview
Generate PDF-ready HTML executive report.
**Auth**: Required

### GET /api/report-builder/metrics
Available metrics for report builder.
**Auth**: Required

### POST /api/report-builder/generate
Generate custom metric report.
**Auth**: Required

### POST /api/report-builder/templates
Save report template.
**Auth**: Required

### GET /api/report-builder/templates
List saved report templates.
**Auth**: Required

### POST /api/savings-report/generate
Generate branded savings report for clients.
**Auth**: Required

---

## MSP & Benchmarking

### GET /api/msp/overview
MSP cross-tenant overview.
**Auth**: Required

### GET /api/msp-benchmark
Cross-tenant benchmark comparison.
**Auth**: Required | **Cache**: 5min

### GET /api/msp-profit/overview
MSP profit dashboard showing ROI per tenant.
**Auth**: Required

### POST /api/tenant-comparison/compare
Compare two tenants side by side.
**Auth**: Required

### GET /api/tenant-comparison/preview
Preview comparison data.
**Auth**: Required

### GET /api/savings/leaderboard
Savings leaderboard across tenants.
**Auth**: Required

### GET /api/savings/roi
ROI calculations.
**Auth**: Required

### GET /api/savings/achievements
Savings achievements/milestones.
**Auth**: Required

### GET /api/usage-heatmap
Usage heatmap for the tenant.
**Auth**: Required

### POST /api/usage-heatmap/custom
Custom usage heatmap with parameters.
**Auth**: Required

### GET /api/usage-heatmap/adoption-score
M365 adoption score.
**Auth**: Required

---

## Billing

### POST /api/billing/checkout
Create LemonSqueezy checkout session.
**Auth**: Required | **Body**: `{ plan }` (starter|professional|enterprise)

### POST /api/billing/webhook
LemonSqueezy webhook handler.
**Auth**: Webhook signature

### GET /api/billing/subscription
Get current subscription status.
**Auth**: Required

### POST /api/billing/cancel
Cancel subscription at period end.
**Auth**: Required

---

## Marketplace (Azure)

### POST /api/marketplace/webhook
Azure Marketplace webhook.
**Auth**: Marketplace token

### POST /api/marketplace/resolve
Resolve marketplace token.
**Auth**: None

### POST /api/marketplace/activate
Activate marketplace subscription.
**Auth**: None

### GET /api/marketplace/subscriptions
List marketplace subscriptions.
**Auth**: Admin+

---

## Webhooks & Events

### POST /api/webhooks/graph
Receive Microsoft Graph change notifications.
**Auth**: None (Graph validation)

### GET /api/webhooks/subscriptions
List active Graph webhook subscriptions.
**Auth**: Required

### POST /api/webhooks/subscriptions
Create Graph webhook subscription.
**Auth**: Admin+

### DELETE /api/webhooks/subscriptions/:subscriptionId
Delete Graph webhook subscription.
**Auth**: Admin+

### GET /api/webhook-config
Get webhook notification config (Slack/Teams).
**Auth**: Required

### POST /api/webhook-config
Save webhook notification config.
**Auth**: Required

### POST /api/webhook-config/test
Test webhook delivery.
**Auth**: Required

### GET /api/event-triggers
List event trigger rules.
**Auth**: Required

### POST /api/event-triggers
Create event trigger.
**Auth**: Admin+

### PATCH /api/event-triggers/:id
Update event trigger.
**Auth**: Admin+

### DELETE /api/event-triggers/:id
Delete event trigger.
**Auth**: Admin+

### POST /api/event-triggers/test
Test event trigger matching.
**Auth**: Required

### GET /api/events/log
Event log with filters.
**Auth**: Required

### GET /api/events/log/:id
Event detail.
**Auth**: Required

### GET /api/events/stats
Event statistics.
**Auth**: Required

### POST /api/events/replay/:id
Replay an event.
**Auth**: Admin+

---

## Approvals

### GET /api/approvals
List pending approvals.
**Auth**: Required

### GET /api/approvals/history
Approval history.
**Auth**: Required

### GET /api/approvals/:id
Approval detail.
**Auth**: Required

### POST /api/approvals/:id/decide
Approve or reject.
**Auth**: Admin+

---

## Guest Review & Group Cleanup

### GET /api/guest-review/results
Latest guest review results.
**Auth**: Required

### POST /api/guest-review/run
Trigger guest user review.
**Auth**: Required

### POST /api/guest-review/approve
Approve guest removal.
**Auth**: Admin+

### GET /api/guest-review/history
Guest review history.
**Auth**: Required

### GET /api/group-cleanup/results
Latest group cleanup results.
**Auth**: Required

### POST /api/group-cleanup/run
Trigger group cleanup scan.
**Auth**: Required

### POST /api/group-cleanup/archive
Archive selected groups.
**Auth**: Admin+

### GET /api/group-cleanup/history
Group cleanup history.
**Auth**: Required

---

## Federated Identity & Credential Rotation

### POST /api/federated-identity/audit
Run federated identity credential audit.
**Auth**: Required

### GET /api/federated-identity/latest
Get latest audit result.
**Auth**: Required

### POST /api/credential-rotation/declare-breach
Initialize credential rotation checklist.
**Auth**: Required

### POST /api/credential-rotation/rotate
Mark a credential as rotated.
**Auth**: Required

### POST /api/credential-rotation/verify
Verify credential rotation.
**Auth**: Required

### GET /api/credential-rotation/report
Get rotation completeness report.
**Auth**: Required

---

## After-Hours Escalation

### POST /api/after-hours/evaluate
Evaluate if an event should be escalated.
**Auth**: Required

### GET /api/after-hours/config
Get tenant business hours config.
**Auth**: Required

### PUT /api/after-hours/config
Update business hours config.
**Auth**: Required

### POST /api/after-hours/record-login
Record a business-hours login.
**Auth**: Required

---

## Self-Service Portal

### GET /api/portal/me
Current user profile from cache.
**Auth**: Required

### GET /api/portal/me/licenses
Own license assignments.
**Auth**: Required

### POST /api/portal/me/license-request
Request additional license (creates approval).
**Auth**: Required | **Body**: `{ skuId, reason }`

### GET /api/portal/me/activity
Recent sign-in activity.
**Auth**: Required

---

## Backup & Migration

### GET /api/backup-health
Backup health status for tenant.
**Auth**: Required

### GET /api/backup-health/all
All backup health data.
**Auth**: Admin+

### POST /api/migration/plan
Create cross-tenant migration plan.
**Auth**: Admin+

### POST /api/migration/execute
Execute migration plan.
**Auth**: Admin+

### GET /api/migration/:id/status
Migration status.
**Auth**: Required

---

## Push Notifications

### POST /api/push/subscribe
Subscribe to web push notifications.
**Auth**: Required

### DELETE /api/push/unsubscribe
Unsubscribe from push notifications.
**Auth**: Required

### GET /api/push/preferences
Get notification preferences.
**Auth**: Required

### PATCH /api/push/preferences
Update notification preferences.
**Auth**: Required

---

## Audit

### GET /api/audit/logs
Audit logs with filters.
**Auth**: Required | **Query**: `eventType`, `actorId`, `startDate`, `endDate`

### GET /api/audit/reports
Compliance reports.
**Auth**: Required

---

## Settings

### GET /api/settings/ai-provider
Get AI provider configuration.
**Auth**: None

### POST /api/settings/ai-provider
Update AI provider (no-op currently).
**Auth**: None

---

## Platform Admin

Mounted under `/platform`. Includes:
- `/platform/auth` -- Platform authentication
- `/platform/organizations` -- Organization management
- `/platform/users` -- Platform user management
- `/platform/subscriptions` -- Subscription management
- `/platform/admin/overview` -- Admin dashboard overview
- `/platform/admin/stats` -- Platform statistics
- `/platform/admin/notifications` -- Admin notifications
- `/platform/admin/sync` -- Sync job management
- `/platform/admin/metrics` -- Platform metrics
- `/platform/admin/audit` -- Admin audit logs
- `/platform/admin/alerts` -- Admin alert management
