# OpenSyber — Full Browser Test Plan v2

**Target:** `https://opensyber.cloud`
**API:** `https://opensyber-api.broad-dew-49ad.workers.dev`
**Test Tool:** Claude Browser Extension (Claude in Chrome)
**Updated:** 2026-03-18 — includes 10 new enterprise security features

---

## Pre-Test Setup

1. Open Chrome with Claude extension active
2. Navigate to `https://opensyber.cloud`
3. Have a test account ready (or create one during Test 1)
4. Have a second email for team invite testing

---

## SECTION A: PUBLIC PAGES (Unauthenticated)

### A1. Landing Page
- Navigate to `https://opensyber.cloud`
- Verify: Hero section with product messaging
- Verify: Nav bar with Pricing, Skills, Docs, Blog, Demo, Threats links
- Verify: "Get Started" and "See Live Demo" CTAs visible
- Verify: Footer renders with links
- Resize to 375px → content stacks vertically

### A2. Pricing
- Navigate to `/pricing`
- Verify: 4 plan cards — Personal ($0), Pro ($149/mo), Team ($399/mo), Enterprise (Custom)
- Verify: Pro has "Most Popular" badge
- Verify: "Get Started" buttons link to `/sign-up`

### A3. Marketplace (Public)
- Navigate to `/marketplace`
- Verify: Category filter buttons render (All, Productivity, Developer, Finance, etc.)
- Verify: Skill cards with name, description, rating, install count
- Click category filters → verify filtering works
- Click a skill → verify `/marketplace/[slug]` detail page

### A4. Skill Detail
- Navigate to `/marketplace/secret-scanner`
- Verify: Name, description, stats (installs, rating, version)
- Verify: "Sign in" message for unauthenticated users

### A5. Documentation
- Navigate to `/docs` → verify landing
- Click Getting Started, API Reference, Security → each loads

### A6. Blog
- Navigate to `/blog` → verify post list
- Click a post → verify full content

### A7. Demo
- Navigate to `/demo` → verify interactive shell loads
- Verify: Tabs clickable (Overview, Events, Network)

### A8. Enterprise
- Navigate to `/enterprise` → verify contact form renders
- Verify: SSO, unlimited instances, SLA features listed

### A9. Legal & Error Pages
- `/terms` → Terms of Service renders
- `/privacy` → Privacy Policy renders
- `/nonexistent-xyz` → Custom 404 page

---

## SECTION B: AUTHENTICATION

### B1. Sign Up
- Navigate to `/sign-up` → Clerk form renders
- Create account → redirects to `/dashboard`

### B2. Sign Out & Sign In
- Sign out → redirects to `/`
- Navigate to `/dashboard` → redirects to `/sign-in`
- Sign in → redirects to `/dashboard`

### B3. Protected Route Guard
- Sign out, navigate to `/dashboard/security` → redirects to `/sign-in`
- Navigate to `/dashboard/ai` → redirects to `/sign-in`

---

## SECTION C: ONBOARDING & INSTANCE

### C1. Empty Dashboard
- Sign in fresh (no instances)
- Verify: Empty state with "Deploy Instance" CTA
- Verify: Sidebar navigation renders

### C2. Deploy Instance
- Click "Deploy Instance" → form appears (name + region)
- Enter name, select region, click Deploy
- Verify: Loading state, page reloads with instance card

### C3. Instance Settings
- Navigate to `/dashboard/settings`
- Verify: Plan card, instance card, vault section, growth kit, danger zone

### C4. Delete Instance
- Settings → Danger Zone → Delete Instance
- Verify: Confirmation dialog → confirms deletion

---

## SECTION D: SECURITY INBOX (NEW — Datadog-inspired)

### D1. Security Inbox Overview
- Navigate to `/dashboard/security-inbox`
- Verify: "Security Inbox" heading renders
- Verify: Summary bar with item count and category chips
- Verify: Filter row with category pills (All, Vulnerability, Misconfiguration, Incident, Identity, Compliance, Agent)
- Verify: Severity and Status filter dropdowns
- Verify: Inbox cards render with priority score badge, title, category chip, severity badge

### D2. Inbox Filtering
- Click "Vulnerability" filter → only vulnerability items shown
- Click "Incident" filter → only incident items
- Select "Critical" from severity dropdown → only critical items
- Click "All" → all items return

### D3. Inbox Actions
- Click "Snooze" on an item → item moves to snoozed status
- Click "Dismiss" on an item → item removed from list
- Switch status filter to "Snoozed" → snoozed item visible

---

## SECTION E: THREAT LEVEL (NEW — CrowdStrike CrowdScore)

### E1. Threat Level Dashboard
- Navigate to `/dashboard/threat-level`
- Verify: Large circular gauge (SVG) showing score 0-100
- Verify: Score number in center with level label (e.g., "Medium")
- Verify: Delta badge showing change vs yesterday
- Verify: 30-day sparkline trend chart

### E2. Contributing Factors
- Verify: 6 factor cards in grid (Active Incidents, Vulnerability Exposure, Agent Risk, Cloud Posture, Identity Risk, Compliance Gap)
- Each shows: name, score bar, weight, trend arrow (up/down/stable)

### E3. Threat Events
- Verify: Recent events table with type, severity badge, source, timestamp, description

---

## SECTION F: CONTAINER SECURITY (NEW — Prisma Cloud)

### F1. Container Overview
- Navigate to `/dashboard/container-security`
- Verify: 4 stat cards (Total Images, Vulnerable, Running Containers, Critical CVEs)
- Verify: Image registry grid with cards

### F2. Image Cards
- Verify: Each shows image name+tag, registry badge, severity breakdown, size, scan timestamp
- Verify: "Scan Now" and "View CVEs" buttons

### F3. Filtering
- Filter by registry (Docker Hub, ECR, GCR) → only matching images
- Filter by severity → updates results
- Search by image name → filters cards

### F4. CVE Timeline & Tables
- Verify: SVG line chart showing CVEs over 30 days
- Verify: Top vulnerable images table sorted by critical CVEs
- Verify: Runtime container list with status dots, CPU/mem bars, risk scores

---

## SECTION G: MITRE ATT&CK (NEW — Datadog)

### G1. Coverage Overview
- Navigate to `/dashboard/mitre-attack`
- Verify: "MITRE ATT&CK Coverage" heading
- Verify: 4 stat cards (Total Techniques, Full Coverage, Partial, None) with percentages

### G2. Heatmap Grid
- Verify: Column per tactic (12 columns), cells per technique
- Verify: Cells color-coded (green=full, amber=partial, gray=none)
- Hover a cell → shows technique name and ID tooltip/title
- Click a cell → detail panel appears with technique info

### G3. Detail Panel
- Click a technique cell → panel shows name, MITRE ID, coverage badge, detection count
- Verify: "Add Detection" button visible

### G4. Legend
- Verify: Legend with Full/Partial/None color squares

---

## SECTION H: COMPOSITE ALERTS (NEW — Lacework)

### H1. Composite Alerts Overview
- Navigate to `/dashboard/composite-alerts`
- Verify: Stats row (Active Alerts, Events Correlated, Noise Reduction)
- Verify: Alert cards with severity badge, title, confidence % badge

### H2. Alert Cards
- Verify: Each shows attack narrative, MITRE tactic pills, affected assets, time range, status badge
- Click expand → correlated event timeline appears
- Verify: Timeline shows numbered events with timestamps, type badges, descriptions

### H3. Filtering & Actions
- Filter by status (Active, Investigating, Resolved)
- Verify: Acknowledge/Dismiss buttons on expanded alerts

---

## SECTION I: STORYLINES (NEW — SentinelOne)

### I1. Storyline List
- Navigate to `/dashboard/storylines`
- Verify: List of storyline cards on left panel
- Each card: title, severity badge, verdict badge, status badge, agent name, node count

### I2. Process Tree
- Click a storyline → right panel shows process tree
- Verify: Tree nodes with icons by type (Terminal/File/Globe/Key)
- Verify: Malicious nodes highlighted with red background
- Verify: Node details (name, description, timestamp)

### I3. Actions
- Verify: "Contain" and "Resolve" buttons visible
- Verify: Kill chain progress bar shows MITRE stages

---

## SECTION J: AI-SPM (NEW — Orca)

### J1. AI Model Inventory
- Navigate to `/dashboard/ai-spm`
- Verify: 4 stat cards (Total AI Models, Active Agents, High Risk, Sensitive Data)
- Verify: Type filter pills (All, LLM, Agent, Embedding, Fine-tuned)

### J2. Model Cards
- Verify: 2-column grid of model cards
- Each shows: name, provider badge, type chip, risk score bar
- Verify: Data access tags (Source Code, Credentials, PII, API Keys)
- Verify: Permission tags (File Read, Shell Execute, Network Access)
- Verify: Prompt injection test results (passed/failed counts)
- Verify: Sensitive data exposure red banner (if applicable)

### J3. Filtering
- Click "Agent" type pill → only agent models shown
- Select "High Risk" from risk dropdown → only high-risk models
- Click "All" → all models return

---

## SECTION K: IaC SCANNER (NEW — Prisma Cloud)

### K1. Scanner Overview
- Navigate to `/dashboard/iac-scanner`
- Verify: 4 stat cards (Total Scans, Pass Rate %, Critical Findings, Files Scanned)
- Verify: Framework filter pills (All, Terraform, CloudFormation, Kubernetes, Dockerfile)

### K2. Scan Results Table
- Verify: Rows with fileName, framework badge, status badge, finding counts, lines scanned
- Click Terraform pill → only Terraform scans shown
- Click a scan row → expanded detail shows findings

### K3. Findings Detail
- Verify: Expanded row shows severity badge, rule name, resource, line number
- Verify: Remediation text in gray box

### K4. Upload
- Verify: "Upload & Scan" button visible (placeholder action)

---

## SECTION L: SOAR WORKFLOWS (NEW — Datadog)

### L1. Workflows Overview
- Navigate to `/dashboard/workflows`
- Verify: 4 stat cards (Active Workflows, Total Runs, Avg Duration, Success Rate %)
- Verify: Status filter pills (All, Active, Inactive, Draft)

### L2. Workflow Cards
- Verify: Each card shows name, description, trigger badge, status badge
- Verify: Visual step flow — horizontal sequence of step icons connected by arrows
- Verify: Step types color-coded (condition=purple, action=blue, notification=amber, enrichment=green)
- Verify: Toggle, "Run Now", "Edit" buttons

### L3. Filtering
- Click "Active" → only active workflows
- Click "Draft" → only draft workflows

### L4. Recent Runs
- Verify: Recent runs table with workflow name, status badge, started, duration
- Verify: Steps progress bar (completed/total)

---

## SECTION M: API SECURITY (NEW — Datadog AAP)

### M1. API Security Overview
- Navigate to `/dashboard/api-security`
- Verify: "API Security" heading with description
- Verify: 4 stat cards (Total Endpoints, High-Risk, Attack Attempts, Auth Issues)

### M2. API Inventory Table
- Verify: Table with method badge (colored: GET=green, POST=blue, PUT=amber, DELETE=red)
- Verify: Path in monospace, risk score, auth type, last called
- Verify: "Investigate" button per endpoint

### M3. Endpoint Detail
- Click "Investigate" on an endpoint → detail panel appears
- Verify: Risk score, auth type, recent attacks listed
- Verify: Recommended fixes section
- Click close → panel disappears

### M4. Attack Timeline & Vulnerabilities
- Verify: Attack Timeline (24h) stacked bar chart with legend
- Verify: OWASP API Top 10 vulnerability cards with severity badges

---

## SECTION N: EXISTING SECURITY FEATURES

### N1. Security Dashboard
- Navigate to `/dashboard/security`
- Verify: Score (0-100), vulnerability counts, category breakdown, recommendations

### N2. Incidents
- Navigate to `/dashboard/security/incidents`
- Verify: Table or empty state
- Create incident → fill title, severity → verify appears in table
- Click incident → detail view with status dropdown, comments

### N3. Alerts & Alert Rules
- Navigate to `/dashboard/security/alerts`
- Verify: Triggered alerts and alert rules sections

### N4. Security Policies
- Navigate to `/dashboard/security/policies`
- Verify: Empty state or policy list

### N5. Playbooks
- Navigate to `/dashboard/security/playbooks`
- Verify: Playbook list or empty state
- Click "Create Playbook" → modal opens (Portal fix verified)
- Fill name, trigger, add steps → create

### N6. Other Security Pages
- `/dashboard/security/network` → Network activity renders
- `/dashboard/security/files` → File integrity renders
- `/dashboard/security/vulnerabilities` → CVE table renders
- `/dashboard/security/compliance` → Compliance frameworks render
- `/dashboard/security/threats` → Threat map renders
- `/dashboard/security/uptime` → Uptime metrics render

---

## SECTION O: AGENT ACTIVITY & MONITORING

### O1. Agent Activity
- Navigate to `/dashboard/agents`
- Verify: Risk score card, stats grid, risk trend chart

### O2. Agent Policies (Modal Fix Verified)
- Navigate to `/dashboard/agents/policies`
- Click "Create Policy" → **modal must open** (Portal fix)
- Verify: Form with name, rule type, pattern/threshold, severity
- Cancel → modal closes

### O3. Alert Channels (Modal Fix Verified)
- Navigate to `/dashboard/agents/alert-channels`
- Click "Add Channel" → **modal must open** (Portal fix)
- Verify: Step 1 type selection (Email, Slack, PagerDuty, etc.)
- Select type → Step 2 config form appears
- Cancel → modal closes

### O4. Other Agent Pages
- `/dashboard/agents/team` → Team agents list
- `/dashboard/agents/violations` → Violations with filters

---

## SECTION P: CLOUD SECURITY (CSPM)

### P1. Cloud Accounts (Modal Fix Verified)
- Navigate to `/dashboard/cloud`
- Click "Connect Account" → **modal must open** (Portal fix)
- Verify: Provider select (AWS/GCP/Azure), name input, role ARN field
- Cancel → modal closes

### P2. CSPM Findings
- Navigate to `/dashboard/cloud/findings`
- Verify: Severity cards, filter dropdowns, findings table

---

## SECTION Q: MARKETPLACE & SKILLS (Authenticated)

### Q1. Dashboard Marketplace
- Navigate to `/dashboard/marketplace`
- Verify: Featured skills section, all skills grid with install buttons

### Q2. Install/Rate Skill
- Click "Install" on a skill → verify success state
- Navigate to skill detail → rate with stars, submit rating

### Q3. My Published Skills
- Navigate to `/dashboard/skills/my-skills`
- Verify: Published skills table or empty state with "Submit New Skill" CTA

---

## SECTION R: AI INTELLIGENCE

### R1. AI Overview
- Navigate to `/dashboard/ai`
- Verify: Insight counts by severity, recent insights, recommendations

### R2. Security Query
- Navigate to `/dashboard/ai/query`
- Verify: Search input with example chips
- Click chip → fills input, click Query → loading + results

### R3. AI Insights
- Navigate to `/dashboard/ai/insights`
- Verify: "Generate Insights" button, insights table
- Review/Dismiss actions work

### R4. AI Recommendations
- Navigate to `/dashboard/ai/recommendations`
- Verify: Stats (Pending, Applied, Skipped), recommendation cards
- Apply/Skip actions work

### R5. AI-SPM (See Section J above)

---

## SECTION S: TEAM & RBAC

### S1. Team Members
- Navigate to `/dashboard/team`
- Verify: Member table with names, roles, plan badge

### S2. Invite Member (Modal Fix Verified)
- Click "Invite Member" → **modal must open** (Portal fix)
- Verify: Email input, role dropdown, Send Invite button
- Cancel → modal closes

### S3. Team Settings & SSO
- `/dashboard/team/settings` → Org name, plan details, danger zone
- `/dashboard/team/sso` → SAML/OIDC config forms
- `/dashboard/team/residency` → Region selector with 3 regions

---

## SECTION T: COMPLIANCE & REPORTING

### T1. OASF Compliance
- Navigate to `/dashboard/oasf`
- Verify: Grade, score, pass/fail/partial controls, "Run Assessment" button

### T2. SOC2 Readiness
- Navigate to `/dashboard/soc2`
- Verify: Readiness description and assessment status

### T3. SLA Monitor
- Navigate to `/dashboard/sla`
- Verify: Uptime, response times, MTTR metrics

---

## SECTION U: ADVANCED SECURITY (Previously Built)

### U1. Attack Paths
- Navigate to `/dashboard/attack-paths`
- Verify: Stat cards, graph visualization or empty state

### U2. Toxic Combinations
- Navigate to `/dashboard/toxic-combinations`
- Verify: Combinations display with severity and risk indicators

### U3. Compliance Heatmap
- Navigate to `/dashboard/compliance-heatmap`
- Verify: Framework heatmap grid with coverage indicators

### U4. Security Graph
- Navigate to `/dashboard/security-graph`
- Verify: Interactive graph visualization

### U5. Session Recordings
- Navigate to `/dashboard/session-recordings`
- Verify: Recording list or empty state

### U6. Entitlements (CIEM)
- Navigate to `/dashboard/entitlements`
- Verify: Identity/entitlements management page

### U7. Access Requests (ZSP)
- Navigate to `/dashboard/access-requests`
- Verify: Zero Standing Privileges request management

---

## SECTION V: SETTINGS & CONFIGURATION

### V1. Notification Channels
- Navigate to `/dashboard/settings/notifications`
- Create channel (Email) → verify appears → delete → confirm

### V2. Credential Vault
- Navigate to `/dashboard/settings` → Vault section
- Add secret → verify appears (masked) → delete → confirm

### V3. Audit Logs
- Navigate to `/dashboard/logs`
- Verify: Table with timestamps, actors, actions, export button

### V4. Achievements
- Navigate to `/dashboard/achievements`
- Verify: 10 achievement badges, progress counter

---

## SECTION W: PAYMENTS & BILLING

### W1. Plan Upgrade
- Navigate to `/pricing` (authenticated)
- Click "Upgrade" → verify LemonSqueezy redirect
- Return URL → `/dashboard?payment=success`

### W2. Plan Enforcement
- Verify: Instance limit enforced on free plan

### W3. Subscription Card
- `/dashboard/settings` → current plan name, price, features

---

## SECTION X: NAVIGATION & RESPONSIVENESS

### X1. Full Sidebar Test
Navigate to EVERY sidebar link and verify page loads without error:

**Main (8 items):** Security Inbox, Overview, Installed Skills, My Published, Audit Logs, Notifications, Marketplace, Settings

**Team (4 items):** Members, Team Settings, SSO, Residency

**Security (40 items):** Agent Activity, Cloud Security, CSPM Findings, Container Security, Team Agents, Agent Policies, Alert Channels, Violations, Attack Paths, Toxic Combinations, Storylines, Threat Level, Composite Alerts, Compliance Heatmap, Security Graph, Asset Inventory, OASF Compliance, SOC2 Readiness, SLA Monitor, Dashboard, Alerts, Incidents, Playbooks, Run History, Policies, Network, File Integrity, Vulnerabilities, Compliance, Threat Map, Uptime, Session Recordings, Entitlements, Access Requests, IaC Scanner, SOAR Workflows, API Security, MITRE ATT&CK, Achievements

**AI (5 items):** AI Intelligence, Security Query, Insights, Recommendations, AI-SPM

### X2. Responsive (375px Mobile)
- Landing page → stacks
- Dashboard → sidebar collapses
- Marketplace → cards stack
- Any new feature page → content readable

### X3. Responsive (768px Tablet)
- Verify: 2-column grids

### X4. Responsive (1440px Desktop)
- Verify: Full sidebar, 3-column grids

---

## SECTION Y: ERROR STATES & EDGE CASES

### Y1. Empty States
Verify empty states render on pages with no data:
- Dashboard (no instances), Incidents, Alerts, Playbooks, Cloud, Skills, AI Insights

### Y2. Form Validation
- Deploy instance with empty name → error
- Create incident with empty title → error
- Invite member with invalid email → error

### Y3. Console Errors
- Open DevTools → navigate all major pages → no JS errors

### Y4. Modal Fixes (Regression Check)
These 8 modals MUST open via Portal (previously broken):
1. Cloud → "Connect Account" (**must open**)
2. Agent Policies → "Create Policy" (**must open**)
3. Alert Channels → "Add Channel" (**must open**)
4. Playbooks → "Create Playbook" (**must open**)
5. Team → "Invite Member" (**must open**)
6. Security Policies → "New Policy" (**must open**)
7. Incidents → "Report Incident" (**must open**)
8. Alerts → "New Rule" (**must open**)

---

## Test Completion Checklist

| # | Section | Pages | Pass/Fail | Notes |
|---|---------|-------|-----------|-------|
| A | Public Pages | 9 | | |
| B | Authentication | 3 | | |
| C | Onboarding & Instance | 4 | | |
| D | Security Inbox (NEW) | 3 | | |
| E | Threat Level (NEW) | 3 | | |
| F | Container Security (NEW) | 4 | | |
| G | MITRE ATT&CK (NEW) | 4 | | |
| H | Composite Alerts (NEW) | 3 | | |
| I | Storylines (NEW) | 3 | | |
| J | AI-SPM (NEW) | 3 | | |
| K | IaC Scanner (NEW) | 4 | | |
| L | SOAR Workflows (NEW) | 4 | | |
| M | API Security (NEW) | 4 | | |
| N | Existing Security | 6 | | |
| O | Agent Activity | 4 | | |
| P | Cloud CSPM | 2 | | |
| Q | Marketplace & Skills | 3 | | |
| R | AI Intelligence | 5 | | |
| S | Team & RBAC | 3 | | |
| T | Compliance | 3 | | |
| U | Advanced Security | 7 | | |
| V | Settings | 4 | | |
| W | Payments | 3 | | |
| X | Navigation & Responsive | 4 | | |
| Y | Error States | 4 | | |

**Total: 25 sections, 100+ individual test cases, 57+ dashboard pages.**
