# TenantIQ — Product Capabilities

## AI-Powered Microsoft 365 Control for MSPs

**Secure, optimize, and manage every Microsoft 365 tenant from one control plane.**

TenantIQ is an AI-powered Microsoft 365 operations platform built for MSPs and IT teams managing multiple tenants at scale. It combines continuous security monitoring, CIS benchmark automation, compliance assessments, license cost optimization, backup intelligence, and natural-language tenant management in one unified control plane.

---

## Three Core Pillars

### Secure Tenants

Continuously monitor, detect, and remediate security risks across every managed tenant.

| Capability | Description |
|------------|-------------|
| CIS Benchmark Scanning | 100+ controls evaluated against live tenant configuration with per-section scoring |
| Microsoft Secure Score | Real-time score tracking with historical trend charts and improvement recommendations |
| Threat Detection | Suspicious login patterns, impossible travel analysis, brute-force attempts, risky IP alerting |
| Anomaly Analysis | AI-powered behavior analysis detecting geographic anomalies and deviations from baseline |
| Risky User Monitoring | Integration with Microsoft Identity Protection for credential compromise and suspicious activity |
| Sign-In Log Monitoring | Detailed sign-in event monitoring with filtering by status, location, device, and risk level |
| One-Click Remediation | Execute security fixes with dry-run preview, scheduling, approval gates, and full rollback |

### Control Compliance

Evaluate tenant configurations against regulatory frameworks and generate audit-ready evidence.

| Framework | Coverage | What It Checks |
|-----------|----------|----------------|
| SOC 2 | 27 controls across Trust Service Criteria | Audit logging, access reviews, MFA enforcement, data classification |
| HIPAA | Administrative, Physical, Technical safeguards | Encryption, BAA tracking, minimum necessary access, audit controls |
| GDPR | Data Protection Principles | Processing records, consent, cross-border transfers, DSAR tooling |
| Zero Trust | 6 pillars with maturity scoring | Identity, device, network, application, data, infrastructure |
| Copilot Readiness | Step-by-step adoption guides | Readiness percentage, prerequisite checks, actionable recommendations |

Additional compliance capabilities:

- **Config Snapshots** — Capture complete Microsoft 365 configuration state (conditional access policies, auth methods, named locations, security defaults)
- **Drift Detection** — Compare snapshots over time and alert on unexpected changes with severity classification
- **Evidence Collection** — Generate compliance evidence packages mapped to specific framework controls for auditors

### Cut Microsoft 365 Waste

Turn license management from manual spreadsheets into automated, AI-driven cost optimization.

| Capability | Description |
|------------|-------------|
| License Utilization Analysis | Per-user and per-SKU utilization tracking with feature-level usage data |
| Inactive User Detection | Configurable 30/60/90-day inactivity thresholds with cost impact calculations |
| Downgrade Recommendations | AI-generated suggestions for license tier changes (e.g., E5 to E3) with projected savings |
| Savings Tracking | Realized savings leaderboard across tenants with ROI calculations |
| ROI Dashboards | Per-tenant and portfolio-wide cost savings visualization |
| License Autopilot | Automated optimization analysis with configurable approval gates before execution |

---

## Four Platform Multipliers

### AI Agent

Natural language tenant management powered by Anthropic Claude. 13+ built-in tools for querying users, licenses, security posture, anomaly detection, compliance, cost optimization, tenant comparison, usage heatmaps, savings leaderboards, and executive reports. Streaming SSE responses with tool execution progress cards, suggested action buttons, conversation persistence with search and tagging, and export to Markdown or PDF with expiring share links.

### Multi-Tenant MSP Console

Manage unlimited tenants from one dashboard. Cross-tenant benchmarking compares security scores, compliance status, and license utilization side by side. Centralized operations with a tenant switcher, per-tenant permissions, and organization-scoped data isolation enforced at the middleware layer.

### Workflow Automation

Configurable automation for recurring tenant operations. Onboarding and offboarding templates with multi-step execution (create account, assign licenses, add to groups, configure mailbox, enable MFA). Guest user reviews, group cleanup, license optimization with approval gates. Conditional triggers, event-driven architecture via Microsoft Graph change notifications, and cron-based scheduling.

### Backup & Recovery

AES-256-GCM encrypted backups stored in Cloudflare R2 with per-tenant encryption keys and SHA-256 integrity verification. Nightly cron at 2 AM UTC with failure detection and alerting. Delta sync via Microsoft Graph delta queries (80-90% faster after initial full backup). Config snapshots with drift detection and severity-classified alerts. Cross-tenant migration wizard with pre-flight validation and post-migration verification.

---

## What Makes TenantIQ Different

| Differentiator | What It Means |
|----------------|---------------|
| **Built for MSPs, not adapted for them** | Multi-tenant from day one. Every database query is scoped by organization and tenant ID at the middleware layer. Data isolation is architectural, not bolted on. |
| **AI that can analyze and act** | Not just chat. The AI agent has 13+ tools that query live tenant data and execute real operations — user management, license changes, security analysis, executive reports. |
| **Actionable security, not dashboard-only** | Nine remediation actions execute directly against Microsoft Graph API with dry-run preview, scheduling, approval gates, and complete rollback capability. |
| **Compliance mapped to live configuration** | SOC 2, HIPAA, GDPR, CIS, and Zero Trust engines evaluate real tenant settings and generate evidence packages. Automated scanning on schedule, not manual checklists. |
| **High-performance, low-ops architecture** | Built entirely on Cloudflare Workers, Pages, D1, KV, R2, and Queues. Every API request runs at the edge. No cold starts, no origin servers. |

---

## What Buyers Care About

- **Reduce tenant risk faster** — Continuous CIS scanning and anomaly detection surface threats before they escalate
- **Standardize M365 hardening across clients** — Apply consistent security baselines with cross-tenant benchmarking
- **Cut unused license spend automatically** — AI-powered detection and autopilot optimization with approval gates
- **Handle more tenants without adding headcount** — Workflow automation and natural-language AI agent eliminate repetitive tasks
- **Prove compliance readiness with audit-ready evidence** — Framework-mapped assessments with exportable evidence packages
- **Act immediately with rollback-safe remediation** — One-click fixes with dry-run preview and full state capture for reversal

---

## Technical Foundation

| Dimension | Details |
|-----------|---------|
| Frontend | SvelteKit 2.15 + Svelte 5, deployed on Cloudflare Pages |
| API | Hono 4 on Cloudflare Workers, TypeScript strict mode, 120+ endpoints |
| Database | Cloudflare D1 (SQLite), 15 tables, Drizzle ORM |
| Cache | Cloudflare KV for tokens, scores, scan results, rate limits |
| Storage | Cloudflare R2 for PDF reports, CSV exports, encrypted backups |
| Queues | Cloudflare Queues for async scan processing, notifications, remediation |
| Tests | 955 unit tests, 127 end-to-end browser tests across 21 sections |
| Security | AES-256-GCM encryption, RBAC, KV-based rate limiting, Zod validation, audit logging |

**Scheduled Jobs**:

| Schedule | Job |
|----------|-----|
| Every 6 hours | User and license sync from Microsoft Graph |
| Every hour | Security scan |
| Daily at 2 AM UTC | Nightly encrypted backup |
| Daily at 3 AM UTC | Compliance scan |
| Every 15 minutes | Workflow trigger check |
| Every 5 minutes | Webhook delivery retries |

---

## Integration Points

| Integration | Purpose |
|-------------|---------|
| **Microsoft Graph API** | Users, groups, licenses, security alerts, conditional access, audit logs, mail, SharePoint, OneDrive, Teams, Identity Protection, Purview |
| **Anthropic Claude** | Natural language tenant management, security analysis, optimization recommendations, executive reports |
| **Resend** | Transactional email: security alerts, workflow notifications, weekly digests, team invitations |
| **Twilio** | SMS delivery for P0 critical security alerts with quiet hours support |
| **LemonSqueezy** | Subscription billing: plan management, usage tracking, invoicing |
| **SDLC.cc** | AI compliance proxy for regulated environments requiring AI usage governance |
| **OpenClaw** | Webhook bridge to Slack, Teams, Discord, and other messaging platforms |

---

## Pricing

| Plan | Price | Best For |
|------|-------|----------|
| **Starter** | $49/tenant/month | Small MSPs and individual IT teams getting started |
| **Professional** (recommended) | $99/tenant/month | Growing MSPs needing full security, compliance, and automation |
| **Enterprise** | Custom pricing | Large MSPs requiring dedicated support, SLAs, and custom integrations |

---

## Frequently Asked Questions

**What Microsoft permissions are required?**
TenantIQ uses Microsoft Graph API with both delegated and application-only access. Required permissions include reading users, groups, licenses, security alerts, conditional access policies, audit logs, mail metadata, and SharePoint/OneDrive configuration. Remediation actions require additional write permissions granted per-tenant during onboarding.

**How is tenant data isolated?**
Every database query is scoped by organization ID and tenant ID at the API middleware layer. Data isolation is enforced architecturally — not by application convention. Each tenant's backup data is encrypted with a unique AES-256-GCM key.

**Where is data stored?**
All data is stored on Cloudflare's global network. Structured data lives in Cloudflare D1 (SQLite). Cached tokens and scores use Cloudflare KV. Encrypted backups, PDF reports, and exports are stored in Cloudflare R2.

**Can remediation actions be rolled back?**
Yes. Every remediation action captures full before-state and after-state. Rollback restores the previous configuration with a single click. Dry-run preview is available before execution, and scheduling allows timed execution with approval gates.

**What compliance frameworks are covered?**
TenantIQ evaluates tenant configurations against SOC 2 (Trust Service Criteria), HIPAA (Administrative, Physical, Technical safeguards), GDPR (Data Protection Principles), CIS Microsoft 365 Benchmark (100+ controls), and Zero Trust maturity (6 pillars). Copilot readiness assessment is also included.

**How does the AI agent work?**
The AI agent is powered by Anthropic Claude with function calling. It has access to 13+ tools that query live tenant data — users, licenses, security posture, compliance status, cost metrics, and more. It can execute up to 10 tool iterations per query, streams responses in real time, and generates suggested actions based on analysis results. Conversations are persisted and exportable.
