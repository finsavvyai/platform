# OpenSyber -- Claude Browser Extension Instructions

## 1. Application Overview

**Product**: OpenSyber -- Runtime Security for AI Agents
**Mission**: Deploy a secured AI agent in 60 seconds with real-time security monitoring, audited skill marketplace, and compliance-grade hosting.
**URL**: https://opensyber.cloud
**Version**: 0.3.0

### Tech Stack
- **Frontend (OpenSyber)**: Next.js 16, React, Tailwind CSS, Lucide icons, SessionProvider (next-auth)
- **Frontend (TokenForge)**: Next.js, React, Tailwind CSS, Geist font family
- **API**: Cloudflare Worker (Hono framework), D1 database (SQLite), Drizzle ORM
- **Auth**: Auth.js (OAuth -- GitHub, Google, Discord, Microsoft Entra ID), HMAC-SHA256 JWT
- **Payments**: LemonSqueezy (subscriptions: Free, Pro, Team, Enterprise)
- **Component Library**: @opensyber/ui (packages/ui)
- **Shared Types**: @opensyber/shared (packages/shared)

### Target Users
- Solo developers deploying AI agents who need security monitoring
- Pro teams managing multiple agents with skill marketplace access
- Enterprise admins requiring SSO, SAML, audit logs, and compliance
- Skill marketplace creators publishing and monetizing security skills
- MSSPs/partners managing multi-tenant client environments

### Design System
- **Brand color**: Teal #00E5C3 (primary accent)
- **Background**: #080B0F (dark theme only)
- **Surface**: #0D1117, #141B24
- **Border**: #1E2A38
- **Text**: #E8F0F8 (primary), #7A96B2 (secondary), #3D5470 (muted)
- **Fonts**: Bebas Neue (display/headings), Space Mono (mono/labels), DM Sans (body)
- **Min touch target**: 44px (Apple HIG compliance)

---

## 2. Complete Page Inventory

### 2.1 OpenSyber Public Pages (apps/web)

| Route | Purpose | Auth | Key Elements |
|-------|---------|------|--------------|
| `/` | Landing page (HomeClient) | No | Hero, feature grid, pricing CTA, social proof |
| `/sign-in` | Auth.js sign-in | No | OAuth buttons (GitHub, Google, Discord, Microsoft) |
| `/sign-up` | Auth.js sign-up | No | OAuth buttons, redirect to dashboard |
| `/enterprise` | Enterprise sales page | No | Feature cards (SSO, Unlimited, SLA, Residency), contact form (name, email, company, message), trust funnel tracking |
| `/partners` | MSSP/partner program | No | Multi-tenant features, revenue sharing info, 4-step onboarding |
| `/compliance` | Compliance frameworks | No | SOC2, ISO 27001, NIST AI RMF, GDPR, EU AI Act status table |
| `/security` | Security policy | No | Static policy document |
| `/terms` | Terms of service | No | Static legal document |
| `/skills` | Redirects to /marketplace | No | Redirect only |
| `/tokenforge` | TokenForge product page | No | Device binding features, SDK code examples, framework adapters |
| `/openagent` | OpenAgent VS Code extension page | No | Risk examples, feature list, install CTA |
| `/openagent/install` | Extension download page | No | .vsix download link |
| `/marketplace/[slug]` | Skill detail page | Optional | Skill name, description, category, version, verification badge, install count, rating, GitHub link, Install button (requires auth + instance) |
| `/trust/[id]` | Public trust page per instance | No | Live security posture, scorecard, badge, trust funnel tracking |
| `/score/[id]` | Public security scorecard | No | Embeddable score visualization |
| `/achievements/[instanceId]/[slug]` | Public achievement page | No | Achievement badge and details |
| `/threats` | Public threat intelligence page | No | Threat stats bar, breakdown, attack origins, live event feed |
| `/demo` | Demo page | No | Interactive product demonstration |
| `/invitations/[token]/accept` | Invitation acceptance | Yes | Accept team invitation flow |
| `/docs` | Documentation hub | No | Getting started, API, security, skills, agent, FAQ, OASF docs |
| `/docs/getting-started` | Quick start guide | No | Step-by-step setup |
| `/docs/api` | API reference | No | Endpoint documentation |
| `/docs/security` | Security docs | No | Security architecture details |
| `/docs/skills` | Skills documentation | No | Skill development guide |
| `/docs/skills/audit-methodology` | Audit methodology | No | How skills are audited |
| `/docs/agent` | Agent documentation | No | Agent runtime docs |
| `/docs/oasf` | OASF framework docs | No | Open Agent Security Framework |
| `/docs/faq` | FAQ | No | Common questions |
| `/blog/*` | Blog posts (12+ articles) | No | Security articles, threat analysis, industry commentary |

### 2.2 OpenSyber Dashboard Pages (apps/web, auth required)

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/dashboard` | Main overview | Instance status card, security score (0-100), CPU/memory/disk gauges, recent security events list, onboarding checklist (if new), Deploy Instance button (if none), Restart button, payment success banner |
| `/dashboard/agents` | Agent activity | Risk score card, severity stats (critical/high/medium/low), secrets count, risk trend chart (30d), risk distribution bars, cloud findings, Install Extension button, Clear All button |
| `/dashboard/skills` | Installed skills | Table (skill name, category, version, verification status, install date), Uninstall button per skill, Browse Marketplace link |
| `/dashboard/skills/[skillId]/configure` | Skill configuration | Skill-specific parameter forms |
| `/dashboard/skills/submit` | Submit new skill | Skill submission form |
| `/dashboard/logs` | Audit logs | Table (action, skill, details, timestamp), date range filter, Export Audit button |
| `/dashboard/mcp-monitoring` | MCP server monitoring | MCP server list (name, URI, tools count, status, last seen) |
| `/dashboard/getting-started` | Onboarding guide | Checklist, prerequisite status checks, integration guides |
| `/dashboard/achievements` | Achievement gallery | Achievement cards with badges |

#### Security Section

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/dashboard/security` | Security dashboard | Overall score, open alerts count, open incidents count, vulnerability summary (critical/high/medium/low), installed skills (verified/unverified/blocked), last health check, category breakdown, score history chart, threat map visualization, recommendations list, recent events table |
| `/dashboard/security/vulnerabilities` | Vulnerability tracker | Summary cards by severity, table (CVE ID, package, version, severity badge, status badge, detected date), status select (open/in_progress/fixed/ignored/false_positive) |
| `/dashboard/security/alerts` | Security alerts | Triggered alerts table (severity, title, triggered count, status, created date), alert rules table (name, event type, threshold, window, active toggle) |
| `/dashboard/security/alert-rules` | Alert rule management | Create/edit alert rules |
| `/dashboard/security/incidents` | Incident tracker | Table (title as link to detail, severity, status, created date). Status: open/investigating/contained/resolved/closed |
| `/dashboard/security/incidents/[id]` | Incident detail | Title, description, severity, status select, root cause, remediation, assignee, comments, timeline |
| `/dashboard/security/threats` | Threat map | Geographic threat visualization by country, event counts, severity levels |
| `/dashboard/security/network` | Network activity | Table (domain, method, path, status code, action: allowed/blocked, timestamp) |
| `/dashboard/security/files` | File integrity | File baselines (path, SHA-256, last verified), file change events |
| `/dashboard/security/supply-chain` | Supply chain security | Control list (framework, description, status: pass/partial, evidence) |
| `/dashboard/security/compliance` | Compliance reports | Report list (framework, overall score, pass/fail counts, generated date), Export Report button |
| `/dashboard/security/policies` | Security policies | Policy list (name, type, rules, active toggle, created date), Create Policy modal |
| `/dashboard/security/uptime` | Uptime monitoring | Uptime chart visualization |

#### Investigation Section

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/dashboard/kill-chain` | Kill chain correlation | Kill chain rules (name, severity, stages, time window), correlated incidents (rule name, severity, event count, stages) |
| `/dashboard/threat-feed` | Threat intelligence feed | Recent threat entries (title, source, severity, category, description, date, CVE) |
| `/dashboard/attack-paths` | Attack path analysis | Asset list, crown jewels, blast radius graph, graph tooltip, legend, crown jewel paths |

#### Governance Section

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/dashboard/agents/policies` | Agent policies | Policy management for agent behavior |
| `/dashboard/rule-engine` | Rule engine | Rule packs (name, version, rule count, active toggle, last updated), custom rules list |
| `/dashboard/oasf` | OASF assessments | Assessment list (overall score, grade, passing/failing/partial counts, total controls, date) |
| `/dashboard/soc2` | SOC2 readiness | SOC2 compliance checklist and evidence |
| `/dashboard/cloud` | Cloud security (CSPM) | Cloud accounts list, Connect Account modal, scan trigger, provider badges (AWS/Azure/GCP) |
| `/dashboard/cloud/setup` | Cloud setup wizard | Cloud provider connection configuration |
| `/dashboard/cloud/findings` | CSPM findings | Cloud security findings list |
| `/dashboard/assets` | Asset inventory | Asset table with type, sensitivity, crown jewel flag |
| `/dashboard/slo-dashboard` | SLO dashboard | Service level objective metrics |
| `/dashboard/sla` | SLA monitor | SLA configuration and breach monitoring |

#### Team Section (plan-gated -- requires org)

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/dashboard/team` | Team members | Member table (name, email, role, accepted date), Invite Member button/modal (email + role select), pending invitations list, Create Org button (if no org) |
| `/dashboard/team/settings` | Org settings | Organization name, settings form, Delete Org section |
| `/dashboard/team/sso` | SSO configuration | SAML 2.0 / OIDC config form (requires admin role) |
| `/dashboard/team/residency` | Data residency | Region selection form (EU, US, Asia Pacific) |
| `/dashboard/agents/team` | Team agents | Per-user agent views |
| `/dashboard/agents/team/[userId]` | User agent detail | Agent activity for specific team member |
| `/dashboard/agents/alert-channels` | Alert channels | Channel configuration for team alerts |
| `/dashboard/agents/violations` | Policy violations | Violation list for team agents |

#### Bottom Rail (Settings/Profile)

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/dashboard/integrations` | Integration catalog | Category sections, integration cards (name, tier badge, description, features), stats bar (total, free tier, categories, webhook-ready) |
| `/dashboard/integrations/[slug]` | Integration detail | Setup instructions, configuration |
| `/dashboard/integrations/health` | Integration health | Status checks for connected integrations |
| `/dashboard/settings` | Settings hub | Subscription card (plan, price, limits), Instance card (name, region, hostname, gateway token, ID), Growth Kit (scorecard share, badge embed), Credential Vault (secrets list, add secret form), Referral section, Danger Zone (delete instance) |
| `/dashboard/settings/api-keys` | API key management | Key list (create, revoke, copy), usage example with curl command |
| `/dashboard/settings/notifications` | Notification channels | Channel list (email/webhook/slack, name, config, active status, delete), Create Notification Channel form (type select, name, config fields) |
| `/dashboard/profile` | User profile | Avatar, name, email, provider, plan, member since, user ID, referral code, connected accounts, Sign Out button |

### 2.3 Admin Panel (apps/web, admin-only)

| Route | Purpose | Key Elements |
|-------|---------|--------------|
| `/admin` | Admin dashboard | Stat cards (total users, instances, organizations, events), active instances, trust funnel (page views, trial starts, signup views, qualified leads, top sources) |
| `/admin/users` | User management | User table with suspend button |
| `/admin/organizations` | Org management | Organization list |
| `/admin/instances` | Instance management | Instance list and controls |
| `/admin/skills` | Skill moderation | Skill moderation cards (approve/reject) |
| `/admin/billing` | Billing overview | Platform billing metrics |
| `/admin/events` | Event log | Platform-wide event log |
| `/admin/metrics` | Platform metrics | Detailed platform analytics |

### 2.4 TokenForge Pages (apps/tokenforge-web)

| Route | Purpose | Auth | Key Elements |
|-------|---------|------|--------------|
| `/` | Landing page | No | Product hero, feature cards, SDK code examples, pricing CTA |
| `/pricing` | Pricing page | No | Plan comparison, LemonSqueezy checkout |
| `/sign-in` | Sign in | No | OAuth buttons |
| `/sign-up` | Sign up | No | OAuth buttons |
| `/auth-callback` | OAuth callback | No | Redirect handler |
| `/trust/[id]` | Public trust page | No | Device trust visualization |
| `/docs` | Documentation | No | Integration guides |
| `/docs/integrations` | Integration docs | No | Framework adapter guides |
| `/docs/integrations/native` | Native integration | No | Direct SDK usage |
| `/docs/siem` | SIEM integration | No | SIEM forwarding setup |
| `/blog` | Blog index | No | Article listing |
| `/blog/session-hijacking-after-mfa` | Blog post | No | Session security article |
| `/blog/microsoft-365-session-security` | Blog post | No | M365 security article |
| `/dashboard` | Overview | Yes | Active sessions, trust score, threats blocked, usage chart, recent sessions, upgrade banner |
| `/dashboard/sessions` | Device sessions | Yes | Sessions table (device, trust score, created, last active, status), revoke action |
| `/dashboard/events` | Security events | Yes | Event log (type, details, timestamp) |
| `/dashboard/alerts` | Alerts | Yes | Alert list and configuration |
| `/dashboard/proxy` | Zero-code proxy | Yes | Proxy configuration for automatic session binding |
| `/dashboard/compliance` | Compliance | Yes | Compliance status and reports |
| `/dashboard/settings` | Settings | Yes | API key management, configuration |
| `/dashboard/docs` | Quick start | Yes | In-dashboard setup guide |
| `/dashboard/onboarding` | Onboarding flow | Yes | Step-by-step setup wizard |

---

## 3. Navigation Map

### 3.1 OpenSyber Dashboard Sidebar

The sidebar uses collapsible groups with sub-groups. It is defined in `apps/web/src/app/dashboard/sidebar-config.ts`.

```
[Pinned] Overview (/dashboard)

[Agent] (collapsible)
  Activity (/dashboard/agents)
  Skills (/dashboard/skills)
  Marketplace (/dashboard/marketplace)
  Bundles (/dashboard/bundles)
  Audit Logs (/dashboard/logs)
  MCP Monitoring (/dashboard/mcp-monitoring)
  Getting Started (/dashboard/getting-started)
  Achievements (/dashboard/achievements)

[Security] (collapsible)
  Dashboard (/dashboard/security)
  Vulnerabilities (/dashboard/security/vulnerabilities)
  -- Detection --
    Alerts (/dashboard/security/alerts)
    Incidents (/dashboard/security/incidents)
    Kill Chain (/dashboard/kill-chain)
  -- Investigation --
    Threat Map (/dashboard/security/threats)
    Threat Feed (/dashboard/threat-feed)
    Attack Paths (/dashboard/attack-paths)
  -- Infrastructure --
    Network (/dashboard/security/network)
    File Integrity (/dashboard/security/files)
    Supply Chain (/dashboard/security/supply-chain)

[Governance] (collapsible)
  -- Policy --
    Agent Policies (/dashboard/agents/policies)
    Policies (/dashboard/security/policies)
    Rule Engine (/dashboard/rule-engine)
  -- Compliance --
    OASF (/dashboard/oasf)
    SOC2 Readiness (/dashboard/soc2)
    Compliance (/dashboard/security/compliance)
    CSPM Findings (/dashboard/cloud/findings)
  -- Operations --
    Cloud Security (/dashboard/cloud)
    Asset Inventory (/dashboard/assets)
    SLO Dashboard (/dashboard/slo-dashboard)
    Uptime (/dashboard/security/uptime)
    SLA Monitor (/dashboard/sla)

[Team] (collapsible, plan-gated -- requires org)
  Members (/dashboard/team)
  Team Settings (/dashboard/team/settings)
  SSO (/dashboard/team/sso)
  Residency (/dashboard/team/residency)
  Team Agents (/dashboard/agents/team)
  Alert Channels (/dashboard/agents/alert-channels)
  Violations (/dashboard/agents/violations)

--- Bottom Rail ---
  Integrations (/dashboard/integrations)
  Settings (/dashboard/settings)
  Profile (/dashboard/profile)
```

### 3.2 Mobile Navigation

Mobile uses a bottom tab bar (49px, HIG-compliant):
- Home -> /dashboard
- Agent -> /dashboard/agents
- Security -> /dashboard/security
- Governance -> /dashboard/oasf
- More -> full-screen sheet with all sidebar items

### 3.3 Admin Sidebar

```
Admin Dashboard (/admin)
Users (/admin/users)
Organizations (/admin/organizations)
Instances (/admin/instances)
Skills (/admin/skills)
Billing (/admin/billing)
Events (/admin/events)
Audit (/admin/audit)
<- Back to Dashboard
```

### 3.4 TokenForge Dashboard Sidebar

```
Overview (/dashboard)
Sessions (/dashboard/sessions)
Events (/dashboard/events)
Alerts (/dashboard/alerts)
Zero-Code Proxy (/dashboard/proxy)
Compliance (/dashboard/compliance)
Settings (/dashboard/settings)
Quick Start (/dashboard/docs)
```

### 3.5 Protected vs Public Routes

**Public**: `/`, `/sign-in`, `/sign-up`, `/enterprise`, `/partners`, `/compliance`, `/security`, `/terms`, `/tokenforge`, `/openagent`, `/marketplace/[slug]`, `/trust/[id]`, `/score/[id]`, `/threats`, `/demo`, `/docs/*`, `/blog/*`, `/achievements/*/*`

**Auth Required (dashboard)**: All `/dashboard/*` routes redirect to `/sign-in` if no session

**Admin Required**: All `/admin/*` routes check `isAdmin` flag from API and redirect to `/dashboard` if not admin

**Plan-Gated**: Team sidebar group shows lock icon and is non-interactive if user has no organization

---

## 4. Feature Catalogue

### 4.1 Instance Management
- **Deploy Instance**: Button on dashboard when no instance exists. Calls `POST /api/instances`
- **Restart Instance**: Button in dashboard header. Calls `POST /api/instances/:id/restart`
- **Rename Instance**: Modal triggered from settings
- **Delete Instance**: Danger zone button in settings. Calls `DELETE /api/instances/:id`
- **Instance Status**: Badge showing running/stopped/provisioning/error
- **Health Metrics**: CPU, memory, disk percentage from `GET /api/instances/:id/health`

### 4.2 Security Dashboard
- **Security Score**: 0-100 composite score with color coding (green >= 80, yellow >= 50, red < 50)
- **Score History Chart**: 30-day trend line from `GET /api/security/instances/:id/score-history`
- **Category Breakdown**: Per-category scores (network, files, supply chain, etc.)
- **Threat Map**: Geographic visualization of threat origins by country
- **Recent Events**: Table with severity badges, event types, timestamps
- **Recommendations**: AI-generated improvement suggestions

### 4.3 Vulnerability Management
- **Vulnerability Table**: CVE ID, package, version, severity, status, detected date
- **Status Transitions**: open -> in_progress -> fixed (or ignored/false_positive)
- **Summary Cards**: Count by severity (critical/high/medium/low)
- **API**: `GET /api/security/instances/:id/vulnerabilities`

### 4.4 Alert System
- **Triggered Alerts**: Table with severity, title, triggered count, status (open/acknowledged/resolved)
- **Alert Rules**: Configurable rules (event type, severity filter, threshold, window minutes, cooldown)
- **Create Alert Rule**: Modal form
- **Alert Actions**: Acknowledge, resolve, dismiss
- **API**: `GET/POST /api/security/instances/:id/alerts`, `GET/POST /api/security/instances/:id/alert-rules`

### 4.5 Incident Management
- **Incident List**: Table with title, severity, status
- **Incident Detail**: Full page with description, root cause, remediation, assignee, comments, status history
- **Create Incident**: Modal with title, description, severity
- **Status Transitions**: open -> investigating -> contained -> resolved -> closed
- **Add Comment**: Text input on incident detail page
- **API**: `GET/POST /api/security/instances/:id/incidents`, `GET/PUT /api/security/instances/:id/incidents/:id`

### 4.6 Skill Marketplace
- **Browse**: Public marketplace at /marketplace with grid layout
- **Skill Detail**: Name, description, category, version, verification status, install count, rating, GitHub link
- **Install Skill**: Button on detail page, requires auth and instance. Calls `POST /api/instances/:id/skills`
- **Uninstall Skill**: Button in installed skills table. Calls `DELETE /api/instances/:id/skills/:skillId`
- **Configure Skill**: Form at /dashboard/skills/[skillId]/configure
- **Submit Skill**: Form at /dashboard/skills/submit for marketplace publishing
- **Categories**: network_scanner, vuln_assessment, log_analyzer, compliance_checker, threat_intel, custom
- **Verification Statuses**: pending, scanning, reviewing, approved, rejected, revoked

### 4.7 Agent Activity (VS Code Extension)
- **Summary**: Risk score card (0-100), severity breakdown, secrets detected
- **Risk Trend**: 30-day chart from `GET /api/proxy/agents/risk-trend`
- **Risk Distribution**: Horizontal bar chart by severity
- **Cloud Findings**: CSPM findings from connected cloud accounts
- **Clear Activity**: Destructive action to wipe all agent activity
- **VS Code Extension Link**: Direct to VS Code Marketplace

### 4.8 Team/Organization Management
- **Create Organization**: Button when no org exists. Calls `POST /api/organizations`
- **Member Table**: Name, email, role badge, accepted date
- **Invite Member**: Modal form (email, role select). Calls `POST /api/organizations/:id/invitations`
- **Cancel Invitation**: Button per pending invite
- **Remove Member**: Button per member (admin only)
- **Change Role**: Role select dropdown per member (admin only)
- **Roles**: owner, admin, member, viewer (hierarchy enforced)
- **Accept Invitation**: Page at /invitations/[token]/accept
- **Org Settings**: Name edit, delete org section
- **SSO Config**: SAML 2.0 / OIDC configuration form (admin only)
- **Data Residency**: Region selection (EU, US, Asia Pacific)

### 4.9 Billing and Plans
- **Plans**: Free ($0), Pro ($49/mo), Team ($29/seat/mo), Enterprise (custom)
- **Subscription Card**: Shows current plan, price, instance limit, audit retention, support level
- **Upgrade Link**: Points to /pricing with LemonSqueezy checkout
- **Payment Success Banner**: Shown after successful checkout redirect
- **Referral Section**: Referral code display and sharing
- **API**: LemonSqueezy webhooks for subscription lifecycle

### 4.10 Settings
- **Subscription**: Plan details and upgrade CTA
- **Instance Config**: Name, region, hostname, gateway token, instance ID
- **Growth Kit**: Scorecard share card, badge embed code
- **Credential Vault**: Encrypted secrets list (key/value), add secret form, delete secret
- **API Keys**: Create, revoke, copy keys. Usage example with curl
- **Notification Channels**: Email, webhook, Slack. Create form with type-specific fields, delete button
- **Profile**: Avatar, name, email, OAuth provider, plan, member since, referral code, connected accounts, sign out

### 4.11 Integrations
- **Catalog**: Categorized grid of 24+ integrations (SIEM, notification, cloud, etc.)
- **Integration Detail**: Setup instructions per integration
- **Health Check**: Status of connected integrations
- **Tier Badges**: Free/Pro/Team per integration

### 4.12 Governance and Compliance
- **OASF Assessments**: Open Agent Security Framework scoring with grade
- **SOC2 Readiness**: Control checklist and evidence collection
- **Compliance Reports**: Generate and export reports (PDF) per framework
- **Security Policies**: Create/manage policies (name, type, rules, active toggle)
- **Rule Engine**: Rule packs (versioned rule bundles), custom rules
- **Agent Policies**: Agent-specific behavior policies
- **Policy Builder**: Visual policy construction at /dashboard/policies/builder

### 4.13 Cloud Security (CSPM)
- **Cloud Accounts**: Connect AWS/Azure/GCP accounts
- **Scan**: Trigger security scans
- **Findings**: CSPM finding list with severity and remediation
- **Setup Wizard**: Step-by-step cloud connection

### 4.14 Investigation Tools
- **Attack Paths**: Graph visualization of attack surfaces, blast radius, crown jewels
- **Kill Chain**: Multi-stage attack correlation rules and detected incidents
- **Threat Feed**: Curated threat intelligence entries
- **Threat Map**: Geographic threat visualization
- **Asset Inventory**: Full asset catalog with sensitivity and crown jewel markers

### 4.15 Monitoring
- **SLO Dashboard**: Service level objectives tracking
- **SLA Monitor**: Uptime targets and breach alerts
- **Uptime Chart**: Historical uptime visualization
- **MCP Monitoring**: Model Context Protocol server status

### 4.16 TokenForge Features
- **Device Sessions**: Cryptographically bound ECDSA P-256 sessions
- **Trust Scoring**: 7-signal trust score (device fingerprint, IP, session age, behavior, etc.)
- **Events**: Session security event log (hijack attempts, trust score changes)
- **Alerts**: Configurable alerts for session anomalies
- **Zero-Code Proxy**: Automatic session binding without code changes
- **Compliance**: Session security compliance reporting
- **API Keys**: TokenForge-specific API key management

---

## 5. User Flows

### 5.1 Signup to First Agent

1. Visit `/` landing page
2. Click "Get Started" -> redirected to `/sign-in`
3. Choose OAuth provider (GitHub, Google, Discord, Microsoft)
4. Redirected to `/dashboard` (first time shows onboarding checklist)
5. Dashboard shows empty state with "Deploy Instance" button
6. Click Deploy -> API creates Hetzner VM, provisions agent container
7. Instance status transitions: provisioning -> running
8. Dashboard populates with health metrics and security score

### 5.2 Agent Deployment

1. From `/dashboard` empty state, click "Deploy Instance"
2. System calls `POST /api/instances` which provisions Hetzner VM
3. Agent container starts with security tools (osquery, seccomp)
4. Gateway token generated and stored in KV
5. Instance appears on dashboard with status badge
6. Health metrics begin flowing (CPU, memory, disk)
7. Security baseline scan runs automatically

### 5.3 Skill Installation

1. Navigate to `/dashboard/skills` or sidebar "Skills"
2. Click "Browse Marketplace" button
3. Browse skill grid at `/marketplace`
4. Click skill card -> `/marketplace/[slug]` detail page
5. Review verification status, install count, rating
6. Click "Install" button (requires auth + active instance)
7. API calls `POST /api/instances/:id/skills` with skill ID
8. Skill appears in installed skills table
9. Optionally configure at `/dashboard/skills/[skillId]/configure`

### 5.4 Team Invitation

1. Navigate to `/dashboard/team`
2. If no org, click "Create Organization" button
3. Fill org name, submit
4. Click "Invite Member" button
5. Modal: enter email address, select role (admin/member/viewer)
6. API sends invitation email via Resend
7. Invitee receives email with link to `/invitations/[token]/accept`
8. Invitee signs in (or signs up) and accepts
9. New member appears in member table

### 5.5 Billing Upgrade

1. From dashboard sidebar, click plan section showing "Upgrade"
2. Or navigate to `/pricing`
3. Select plan (Pro/Team/Enterprise)
4. LemonSqueezy checkout opens (embedded or redirect)
5. Complete payment
6. Webhook fires `subscription_created` -> API updates user plan
7. Redirect to `/dashboard` with PaymentSuccessBanner
8. Plan-gated features (Team sidebar, unverified skills, etc.) unlock

### 5.6 Alert Creation and Management

1. Navigate to `/dashboard/security/alerts`
2. View existing triggered alerts table
3. Scroll to "Alert Rules" section
4. Click create button to open modal
5. Fill: name, event type, severity filter, threshold, window (minutes), cooldown
6. Submit -> API creates rule at `POST /api/security/instances/:id/alert-rules`
7. When conditions met, alert triggers and appears in alerts table
8. Click to acknowledge or resolve alert

### 5.7 Security Score Improvement

1. View score on `/dashboard` or `/dashboard/security`
2. Hover security score card to see improvement recommendations
3. Navigate to `/dashboard/security` for detailed category breakdown
4. Address top recommendations:
   - Install verified security skills
   - Configure alert rules
   - Set up notification channels
   - Enable file integrity monitoring
   - Connect cloud accounts for CSPM
5. Score updates on next health check cycle

### 5.8 Notification Channel Setup

1. Navigate to `/dashboard/settings/notifications`
2. View existing channels (if any)
3. Scroll to "Add New Channel" form
4. Select type: email, webhook, or Slack
5. Fill type-specific fields (email address, webhook URL, Slack webhook URL)
6. Enter channel name
7. Submit -> API creates channel
8. Channel appears in list with active status

### 5.9 Enterprise Contact / Demo Request

1. Visit `/enterprise` (optionally via trust page referral)
2. View feature cards and included items
3. Fill contact form: name, work email, company name, message
4. Submit -> API sends notification to sales
5. Success confirmation shown
6. Trust funnel event tracked if from trust page referral

---

## 6. Component Library Reference (packages/ui)

### Available Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Button` | `variant`: primary/secondary/danger/ghost, `size`: sm/md/lg, `loading`: boolean | Styled button with loading spinner |
| `Card` | `title?`: string, `description?`: string, `className?` | Bordered card container |
| `Badge` | `variant`: info/warning/critical/success/neutral/blue | Colored pill badge |
| `StatusBadge` | `status`: string (auto-maps to variant) | Status-aware badge (running=success, error=critical, etc.) |
| `Table` | `className?` | Responsive table wrapper with overflow scroll |
| `TableHead` | children | Styled table header row |
| `TableRow` | `className?` | Hover-highlighted table row |
| `TableCell` | `className?` | Padded table cell |
| `MetricCard` | `icon`, `label`, `value`, `subtext?`, `showBar?`, `barPercent?` | Metric display with optional progress bar |
| `EmptyState` | `icon`, `title`, `description`, `action?` | Centered empty state with icon and optional action |
| `ProgressBar` | `value`: number (0-100), `color`: blue/green/yellow/red | Animated progress bar |

### App-Level Components (apps/web/src/components)

**Dashboard**:
- `InstanceStatusBadge` - Instance running/stopped/error badge
- `RestartButton` - Instance restart with confirmation
- `DeployInstanceButton` - Deploy new instance
- `DeleteInstanceButton` - Destroy instance (danger)
- `RenameInstanceButton` - Edit instance name
- `OnboardingChecklist` - Getting started steps
- `PaymentSuccessBanner` - Post-checkout banner
- `RiskTrendChart` - 30-day risk trend
- `TrustScoreIndicator` - Sidebar trust score display
- `Breadcrumbs` - Auto-generated breadcrumbs
- `NavigationProgress` - Page loading indicator
- `UpgradePrompt` - Plan upgrade CTA
- `ReferralSection` - Referral code sharing
- `BadgeEmbed` - Embeddable security badge code
- `ScorecardShareCard` - Shareable scorecard
- `AchievementCard` / `AchievementGrid` - Gamification elements

**Security**:
- `ScoreHistoryChart` - Score over time
- `ThreatMapViz` - Geographic threat map
- `CreateAlertRuleModal` - Alert rule creation form
- `AlertActionButtons` - Acknowledge/resolve actions
- `AlertRuleActions` - Edit/delete rule actions
- `CreateIncidentModal` - Incident creation form
- `IncidentStatusSelect` - Status transition dropdown
- `AddIncidentComment` - Comment form
- `VulnerabilityStatusSelect` - Vuln status dropdown
- `CreatePolicyModal` - Policy creation form
- `PolicyActions` - Policy edit/delete/toggle
- `SecretsList` - Vault secret list
- `AddSecretForm` - Add encrypted secret
- `CreateNotificationChannelForm` - Channel setup form
- `DeleteNotificationChannelButton` - Channel removal
- `ExportAuditButton` - Audit log export
- `ExportReportButton` - Compliance report export
- `GenerateComplianceReport` - Report generation trigger
- `NotificationChannelFields` - Dynamic form fields by channel type
- `UptimeChart` - Uptime visualization

**Team**:
- `CreateOrgButton` - Organization creation
- `InviteMemberButton` / `InviteMemberModal` - Invitation flow
- `MemberTable` - Team member list
- `MemberRoleSelect` - Role change dropdown
- `PendingInvitations` - Invitation list
- `CancelInvitationButton` - Cancel pending invite
- `RemoveMemberButton` - Remove team member
- `RoleBadge` - Role display badge
- `SsoConfigForm` - SAML/OIDC configuration
- `ResidencyForm` - Data residency settings
- `OrgSettingsForm` - Organization settings
- `DeleteOrgSection` - Organization deletion
- `AcceptInvitationClient` - Invitation acceptance

**Marketplace**:
- `SkillGrid` - Marketplace skill grid
- `InstallSkillButton` - Skill installation trigger

**Motion**:
- `FadeIn` - Fade-in animation wrapper
- `StaggerChildren` - Staggered animation for lists
- `CountUp` - Animated number counter

**Admin**:
- `UserTable` - Admin user management table
- `SuspendUserButton` - User suspension
- `SkillModerationCard` - Skill review card

**Attack Graph**:
- `BlastRadiusGraph` - Attack surface visualization
- `BlastRadiusSummary` - Impact summary
- `CrownJewelPaths` - Critical asset paths
- `GraphTooltip` - Hover information
- `GraphLegend` - Graph legend

---

## 7. API Endpoints Map

### Authentication
- `POST /api/auth/*` - Auth.js routes (OAuth callbacks)
- `GET /api/user` - Current user data (plan, isAdmin, onboardingCompletedAt)

### Instances
- `GET /api/instances` - List user instances
- `POST /api/instances` - Deploy new instance
- `GET /api/instances/:id/health` - Health metrics
- `POST /api/instances/:id/restart` - Restart instance
- `DELETE /api/instances/:id` - Delete instance

### Skills
- `GET /api/skills/:slug` - Skill detail (public)
- `GET /api/instances/:id/skills` - Installed skills
- `POST /api/instances/:id/skills` - Install skill
- `DELETE /api/instances/:id/skills/:skillId` - Uninstall skill

### Security
- `GET /api/security/instances/:id/dashboard` - Security dashboard data
- `GET /api/security/instances/:id/score-history` - Score trend
- `GET /api/security/instances/:id/threat-map` - Geographic threats
- `GET /api/security/instances/:id/alerts` - Alerts list
- `GET/POST /api/security/instances/:id/alert-rules` - Alert rules
- `GET /api/security/instances/:id/incidents` - Incidents list
- `GET/PUT /api/security/instances/:id/incidents/:id` - Incident detail
- `GET /api/security/instances/:id/vulnerabilities` - Vulnerabilities
- `GET /api/security/user/notification-channels` - Notification channels
- `POST /api/security/user/notification-channels` - Create channel
- `DELETE /api/security/user/notification-channels/:id` - Delete channel

### Organizations
- `GET /api/organizations` - List user orgs
- `POST /api/organizations` - Create org
- `GET /api/organizations/:id` - Org detail with members
- `POST /api/organizations/:id/invitations` - Invite member

### Settings
- `GET /api/keys` - API keys
- `POST /api/keys` - Create API key
- `DELETE /api/keys/:id` - Revoke API key
- `GET /api/instances/:id/secrets` - Vault secrets
- `POST /api/instances/:id/secrets` - Add secret
- `DELETE /api/instances/:id/secrets/:id` - Delete secret

### Admin
- `GET /api/admin/stats` - Platform statistics

### Other
- `POST /api/ingest` - Event ingestion (X-API-Key auth)
- `GET /api/proxy/agents` - Agent activity proxy
- `GET /api/proxy/agents/risk-trend` - Risk trend proxy
- `POST /api/proxy/enterprise/contact` - Enterprise contact form
- `GET /api/oasf/assessments` - OASF assessments
- `GET /api/assets` - Asset inventory
- `GET /api/attack-paths/crown-jewels` - Crown jewel assets

---

## 8. Keyboard Shortcuts and Special Interactions

- **Skip to content**: Hidden link at top of page, visible on keyboard focus
- **Sidebar collapse**: Sidebar is full-width on lg, icon-only on md, hidden on mobile
- **Mobile sheet**: "More" tab opens full-screen bottom sheet with all nav items
- **Collapsible groups**: Sidebar groups expand/collapse with chevron animation
- **Hover tooltips**: Security score card shows recommendations on hover
- **Confirm dialogs**: Destructive actions (clear activity, delete instance) use browser `confirm()`
- **Loading states**: Skeleton components for agents, team, cloud, findings, violations
- **AI Chat Widget**: Floating chat widget on dashboard (AiChatWidget component)

---

## 9. Key Patterns and Conventions

### Data Fetching
- Server components use `getApiToken()` + `apiClient()` for SSR data loading
- Client components use `fetch('/api/proxy/...')` for client-side fetching
- `Promise.allSettled` used for parallel requests where partial failure is acceptable
- TokenForge dashboard uses `useApi()` hook with AbortSignal support

### Auth Pattern
```
Server: auth() -> session -> getApiToken() -> apiClient(endpoint, { token })
Client: fetch('/api/proxy/...') -> Next.js API route -> forwarded to CF Worker
```

### Error States
- Empty states use centered layout with icon, title, description, and optional action
- API failures fall back to empty/default data (never crash the page)
- Console.error for debugging, no user-facing error details

### Status Badge Color Mapping
- **Green**: running, ready, approved, active, fixed, resolved, pass
- **Yellow**: warning, pending, scanning, reviewing, in_progress, acknowledged
- **Red**: error, critical, revoked, rejected, open
- **Blue**: info, provisioning, installing
- **Gray**: destroying, suspended, inactive, ignored, false_positive, closed
