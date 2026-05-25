# OpenSyber — Chrome Extension Full Test Plan v3

**Target:** `https://opensyber.cloud`
**Tool:** Claude in Chrome Extension
**Total URLs:** 123 | **Test Cases:** 200+
**Updated:** 2026-03-19

---

## HOW TO RUN THIS TEST

Paste this to Claude in Chrome:

> "Test the OpenSyber app at opensyber.cloud following this plan. Navigate to each URL, take a screenshot, verify the checklist items. Report pass/fail for each section. Stop and report if you find critical errors."

---

## SECTION 1: PUBLIC PAGES (21 URLs)

### 1.1 Landing Page `/`
- [ ] Page loads with hero section
- [ ] Nav bar: OpenSyber logo, Pricing, Skills, Docs, Blog, Demo, Threats
- [ ] "Get Started" and "See Live Demo" CTAs visible
- [ ] Footer with links renders
- [ ] Resize to 375px — content stacks vertically

### 1.2 Pricing `/pricing`
- [ ] 4 plan cards: Personal ($0), Pro ($149), Team ($399), Enterprise
- [ ] Pro has "Most Popular" badge
- [ ] Feature comparison visible per plan
- [ ] CTA buttons link to sign-up or checkout

### 1.3 Marketplace `/marketplace`
- [ ] Category filter pills render (All, Productivity, Developer, Finance, etc.)
- [ ] Skill cards with name, description, rating, install count
- [ ] Click category filter → cards filter correctly
- [ ] Click skill card → navigates to `/marketplace/[slug]`

### 1.4 Skill Detail `/marketplace/secret-scanner`
- [ ] Skill name, description, stats render
- [ ] Install count, rating stars, version visible
- [ ] "Sign in" prompt for unauthenticated users

### 1.5 Documentation Pages
- [ ] `/docs` — landing with section links
- [ ] `/docs/getting-started` — guide content loads
- [ ] `/docs/api` — API reference loads
- [ ] `/docs/security` — security docs load
- [ ] `/docs/skills` — skills docs load
- [ ] `/docs/agent` — agent docs load
- [ ] `/docs/faq` — FAQ loads

### 1.6 Blog
- [ ] `/blog` — post list with titles, dates, excerpts
- [ ] `/blog/introducing-opensyber` — full post loads
- [ ] `/blog/why-self-hosted-ai-agents-are-a-security-risk` — full post loads

### 1.7 Other Public Pages
- [ ] `/demo` — interactive demo shell loads, tabs clickable
- [ ] `/enterprise` — features + contact form render
- [ ] `/threats` — threat intelligence page loads
- [ ] `/openagent` — OpenAgent extension page loads
- [ ] `/openagent/install` — install instructions load
- [ ] `/terms` — Terms of Service renders
- [ ] `/privacy` — Privacy Policy renders
- [ ] `/nonexistent-page` — Custom 404 page (not blank/error)

---

## SECTION 2: AUTHENTICATION (3 URLs)

### 2.1 Sign Up `/sign-up`
- [ ] Clerk sign-up form renders
- [ ] Email field + social login options visible
- [ ] Form is functional (don't submit unless creating test account)

### 2.2 Sign In `/sign-in`
- [ ] Clerk sign-in form renders
- [ ] Sign in with test credentials → redirects to `/dashboard`

### 2.3 Protected Route Guard
- [ ] Sign out → navigate to `/dashboard` → redirects to `/sign-in`
- [ ] Navigate to `/dashboard/security` while signed out → redirects

---

## SECTION 3: DASHBOARD OVERVIEW `/dashboard`

### 3.1 Layout & Navigation
- [ ] Sidebar renders with collapsible groups
- [ ] "Overview" is highlighted (blue active state)
- [ ] Collapsible sections: Agent Monitoring, Cloud & Infrastructure, Threat Intelligence, Security Operations, Posture & Compliance, Identity & Access, Assets & Monitoring
- [ ] Click group header → expands/collapses with chevron rotation
- [ ] User avatar + name + email in sidebar footer
- [ ] Plan badge (Free/Pro/Team) visible
- [ ] AI Bot button (blue circle, bottom-right) visible
- [ ] Help Panel button ("?", bottom-right) visible
- [ ] Mobile: hamburger menu visible at <768px

### 3.2 Dashboard Content
- [ ] Greeting: "Good morning/afternoon/evening, [Name]" with date
- [ ] If no instance: Onboarding Wizard renders (4-step stepper)
- [ ] If instance exists: Quick Actions cards (Deploy, Skills, Security, AI Query)
- [ ] If instance exists: Instance status card with name, region, status
- [ ] Stats grid: Security Score, CPU, Memory, Disk
- [ ] Recent Security Events section

### 3.3 Welcome Modal (first visit only)
- [ ] On first visit: Welcome Modal with "Welcome to OpenSyber, [Name]!"
- [ ] 3 benefit cards: Deploy in 60s, Real-time Security, AI-Powered Insights
- [ ] "Let's Get Started" button dismisses modal
- [ ] Refresh page → modal does NOT reappear (localStorage)

### 3.4 Onboarding Wizard (no instance)
- [ ] Step 1: "Deploy Your First Agent" — name input + region select + Deploy button
- [ ] "Skip this step" link visible
- [ ] Click Skip → Step 2: "Install a Security Skill" — 3 skill cards
- [ ] Click Skip → Step 3: "Set Up Alerts" — email + severity dropdown
- [ ] Click Skip → Step 4: "You're All Set!" — celebration + security score preview
- [ ] "Go to Dashboard" button visible

---

## SECTION 4: AI BOT & HELP PANEL

### 4.1 AI Bot Assistant
- [ ] Click blue bot button (bottom-right) → chat panel slides up
- [ ] Header: "OpenSyber AI" with close button
- [ ] Welcome message from bot visible
- [ ] Context-aware suggestion chips (vary by current page)
- [ ] Input bar: "Ask anything..." with send button
- [ ] Type question + send → loading state → response appears
- [ ] Close button dismisses panel

### 4.2 Help Panel
- [ ] Click "?" button → help panel slides in from right
- [ ] "Help & Support" header with close (×) button
- [ ] GETTING STARTED section: Quick Start Guide, API Reference, Security Best Practices
- [ ] THIS PAGE section: context-aware description (changes per page)
- [ ] SUPPORT section: support email + documentation link
- [ ] Close button dismisses panel

---

## SECTION 5: SECURITY INBOX `/dashboard/security-inbox`
- [ ] "Security Inbox" heading + subtitle
- [ ] Summary bar: "X items need attention" with category count chips
- [ ] Category filter pills: All, Vulnerability, Misconfiguration, Incident, Identity, Compliance, Agent
- [ ] Severity dropdown filter
- [ ] Status dropdown filter (New, In Progress, Snoozed)
- [ ] Inbox cards with priority score badge, title, category chip, severity badge
- [ ] Click "Vulnerability" filter → only vulnerability items
- [ ] Click "Snooze" on item → status changes
- [ ] Click "Dismiss" on item → item removed

---

## SECTION 6: AGENT MONITORING (5 URLs)

### 6.1 Agent Activity `/dashboard/agents`
- [ ] Risk score card (0-100) with risk level
- [ ] Stats grid: total events, critical, high, medium, low, secrets
- [ ] Risk trend chart (30-day line)
- [ ] "Install Extension" button if no activity

### 6.2 Team Agents `/dashboard/agents/team`
- [ ] Team agent list or empty state

### 6.3 Agent Policies `/dashboard/agents/policies`
- [ ] Policy list or empty state
- [ ] "Create Policy" button → **modal opens** (Portal fix verified)
- [ ] Modal: name, rule type, pattern/threshold, severity fields
- [ ] Cancel → modal closes

### 6.4 Alert Channels `/dashboard/agents/alert-channels`
- [ ] Channel list or empty state
- [ ] "Add Channel" button → **modal opens** (Portal fix verified)
- [ ] Step 1: type selection (Email, Slack, PagerDuty, etc.)
- [ ] Select type → Step 2: config form
- [ ] Cancel → modal closes

### 6.5 Violations `/dashboard/agents/violations`
- [ ] Violations table with severity filters or empty state

---

## SECTION 7: CLOUD & INFRASTRUCTURE (5 URLs)

### 7.1 Cloud Security `/dashboard/cloud`
- [ ] "Connect Account" button → **modal opens** (Portal fix)
- [ ] Provider select (AWS/GCP/Azure), name input
- [ ] Cancel → modal closes

### 7.2 CSPM Findings `/dashboard/cloud/findings`
- [ ] Severity cards, filter dropdowns, findings table or empty state

### 7.3 Container Security `/dashboard/container-security`
- [ ] 4 stat cards: Total Images, Vulnerable, Running Containers, Critical CVEs
- [ ] Image registry grid with cards (name, tag, registry badge, severity breakdown)
- [ ] Filter by registry, severity, search
- [ ] CVE timeline chart (SVG)
- [ ] Top vulnerable images table
- [ ] Runtime container list with status dots, CPU/mem bars

### 7.4 IaC Scanner `/dashboard/iac-scanner`
- [ ] 4 stat cards: Total Scans, Pass Rate %, Critical Findings, Files Scanned
- [ ] Framework filter pills (Terraform, CloudFormation, Kubernetes, Dockerfile)
- [ ] Scan results table with expandable rows
- [ ] Click row → findings detail with severity + remediation

### 7.5 API Security `/dashboard/api-security`
- [ ] 4 stat cards: Total Endpoints, High-Risk, Attack Attempts, Auth Issues
- [ ] API inventory table with method badges (GET=green, POST=blue, etc.)
- [ ] Click "Investigate" → endpoint detail panel with risk score
- [ ] Attack Timeline (24h) stacked bar chart
- [ ] OWASP API Top 10 vulnerability cards

---

## SECTION 8: THREAT INTELLIGENCE (8 URLs)

### 8.1 Threat Level `/dashboard/threat-level`
- [ ] Large SVG gauge showing score 0-100 with level label
- [ ] Delta badge (change vs yesterday)
- [ ] 30-Day Score Trend chart
- [ ] Contributing Factors grid (6 cards with score bars)
- [ ] Recent threat events table

### 8.2 Attack Paths `/dashboard/attack-paths`
- [ ] Stat cards + graph visualization or empty state

### 8.3 Toxic Combinations `/dashboard/toxic-combinations`
- [ ] Toxic combination cards with severity, risk indicators
- [ ] Filter by severity, category

### 8.4 Storylines `/dashboard/storylines`
- [ ] Stat cards: Active Investigations, Critical Storylines, Avg Events
- [ ] Status + severity filters
- [ ] Storyline cards with MITRE tactic badges, severity, verdict
- [ ] Click expand (chevron) → event timeline with numbered events
- [ ] Kill chain progress bar

### 8.5 Composite Alerts `/dashboard/composite-alerts`
- [ ] Stats row: Active Alerts, Events Correlated, Noise Reduction
- [ ] Alert cards with severity, confidence %, MITRE tactics
- [ ] Click expand → correlated event timeline

### 8.6 MITRE ATT&CK `/dashboard/mitre-attack`
- [ ] 4 stat cards: Total Techniques, Full Coverage, Partial, None
- [ ] Technique Matrix heatmap (columns = tactics, cells = techniques)
- [ ] Cells color-coded: green=full, amber=partial, gray=none
- [ ] Legend: Full / Partial / None
- [ ] Click cell → detail panel with technique info

### 8.7 Security Graph `/dashboard/security-graph`
- [ ] Interactive graph visualization or empty state

### 8.8 Threat Map `/dashboard/security/threats`
- [ ] Geographic visualization or empty state

---

## SECTION 9: SECURITY OPERATIONS (6 URLs)

### 9.1 Security Dashboard `/dashboard/security`
- [ ] Security score (0-100) prominently displayed
- [ ] Vulnerability counts, category breakdown
- [ ] Score history chart, threat map, recommendations

### 9.2 Alerts `/dashboard/security/alerts`
- [ ] Triggered alerts + alert rules sections or empty state
- [ ] "New Rule" button → **modal opens** (Portal fix)

### 9.3 Incidents `/dashboard/security/incidents`
- [ ] Incident table or empty state
- [ ] "Report Incident" button → **modal opens** (Portal fix)
- [ ] Modal: title, description, severity dropdown

### 9.4 Playbooks `/dashboard/security/playbooks`
- [ ] Playbook list or empty state
- [ ] "Create Playbook" button → **modal opens** (Portal fix)
- [ ] Modal: name, description, trigger type, add steps

### 9.5 Policies `/dashboard/security/policies`
- [ ] Policy list or empty state
- [ ] "New Policy" button → **modal opens** (Portal fix)

### 9.6 SOAR Workflows `/dashboard/workflows`
- [ ] 4 stat cards: Active Workflows, Total Runs, Avg Duration, Success Rate
- [ ] Status filter pills (All, Active, Inactive, Draft)
- [ ] Workflow cards with step flow visualization
- [ ] Recent runs table with status badges

---

## SECTION 10: POSTURE & COMPLIANCE (5 URLs)

### 10.1 OASF Compliance `/dashboard/oasf`
- [ ] Grade (A+ through F), score, pass/fail/partial controls
- [ ] "Run Assessment" button visible

### 10.2 SOC2 Readiness `/dashboard/soc2`
- [ ] Readiness description + assessment status

### 10.3 Compliance Reports `/dashboard/security/compliance`
- [ ] Framework cards (SOC 2, ISO 27001, CIS, etc.) or empty state

### 10.4 Compliance Heatmap `/dashboard/compliance-heatmap`
- [ ] Framework heatmap grid with coverage indicators

### 10.5 SLA Monitor `/dashboard/sla`
- [ ] Uptime, response times, MTTR metrics or empty state

---

## SECTION 11: IDENTITY & ACCESS (3 URLs)

### 11.1 Entitlements (CIEM) `/dashboard/entitlements`
- [ ] Identity/entitlements management page renders

### 11.2 Access Requests (ZSP) `/dashboard/access-requests`
- [ ] Zero Standing Privileges page renders
- [ ] Request form, pending requests, active sessions

### 11.3 Session Recordings `/dashboard/session-recordings`
- [ ] Recording list with stats or empty state

---

## SECTION 12: ASSETS & MONITORING (5 URLs)

### 12.1 Asset Inventory `/dashboard/assets`
- [ ] Asset table with name, type, region, risk score
- [ ] Search and filter functionality

### 12.2 Network `/dashboard/security/network`
- [ ] Network monitoring table or empty state

### 12.3 File Integrity `/dashboard/security/files`
- [ ] File baselines + change log or empty state

### 12.4 Vulnerabilities `/dashboard/security/vulnerabilities`
- [ ] CVE table with severity badges or empty state

### 12.5 Uptime `/dashboard/security/uptime`
- [ ] Uptime percentage + chart or empty state

---

## SECTION 13: MANAGE (6 URLs)

### 13.1 Installed Skills `/dashboard/skills`
- [ ] Installed skills table or empty state

### 13.2 My Published Skills `/dashboard/skills/my-skills`
- [ ] Published skills table or empty state
- [ ] "Submit New Skill" CTA

### 13.3 Audit Logs `/dashboard/logs`
- [ ] Log table with timestamp, actor, action columns
- [ ] Export CSV button visible

### 13.4 Notifications `/dashboard/settings/notifications`
- [ ] Channel list or empty state
- [ ] Create Email channel → verify appears → delete

### 13.5 Alert Preferences `/dashboard/settings/alerts`
- [ ] Email/SMS/Push toggles
- [ ] Phone number input with validation
- [ ] Severity threshold dropdown
- [ ] Quiet hours time pickers

### 13.6 Achievements `/dashboard/achievements`
- [ ] 10 achievement badges in grid
- [ ] Progress counter (X/10 unlocked)

---

## SECTION 14: AI INTELLIGENCE (5 URLs)

### 14.1 AI Overview `/dashboard/ai`
- [ ] Insight counts by severity (critical/high/medium/low cards)
- [ ] Recent insights table
- [ ] "Ask a Question" CTA

### 14.2 Security Query `/dashboard/ai/query`
- [ ] Search input with example chips
- [ ] Click chip → fills input
- [ ] Click Query → loading → results

### 14.3 AI Insights `/dashboard/ai/insights`
- [ ] "Generate Insights" button
- [ ] Insights table with category, severity badges
- [ ] Review/Dismiss actions

### 14.4 AI Recommendations `/dashboard/ai/recommendations`
- [ ] Stats: Pending, Applied, Skipped counts
- [ ] Recommendation cards with priority badges
- [ ] Apply/Skip actions

### 14.5 AI-SPM `/dashboard/ai-spm`
- [ ] 4 stat cards: Total AI Models, Active Agents, High Risk, Sensitive Data
- [ ] Type filter pills (All, LLM, Agent, Embedding, Fine-tuned)
- [ ] Model cards with risk score bars, data access tags, permission tags
- [ ] Prompt injection test results (passed/failed)
- [ ] Sensitive data exposure warning (red banner)
- [ ] Filter by type → only matching models shown

---

## SECTION 15: TEAM & RBAC (4 URLs)

### 15.1 Team Members `/dashboard/team`
- [ ] Member table with names, roles, plan badge
- [ ] "Invite Member" button → **modal opens** (Portal fix)
- [ ] Modal: email, role dropdown

### 15.2 Team Settings `/dashboard/team/settings`
- [ ] Org name, slug, plan details, danger zone

### 15.3 SSO `/dashboard/team/sso`
- [ ] SAML 2.0 + OIDC config forms

### 15.4 Data Residency `/dashboard/team/residency`
- [ ] Region selector (EU, US, APAC)
- [ ] Strict enforcement toggle

---

## SECTION 16: SETTINGS `/dashboard/settings`

- [ ] Subscription card: plan name, price, features
- [ ] Instance card: name, region, IP, gateway token status
- [ ] Growth Kit: referral link, badge embed, scorecard share
- [ ] Vault section: add secret form, secret list
- [ ] Danger Zone: Delete Instance button (red)

---

## SECTION 17: ENTERPRISE FEATURES (4 URLs)

### 17.1 Executive Dashboard `/dashboard/executive`
- [ ] KPI cards with security metrics
- [ ] Charts/visualizations render

### 17.2 SaaS Discovery `/dashboard/saas-discovery`
- [ ] SaaS app inventory with risk indicators

### 17.3 Behavior Analytics `/dashboard/behavior-analytics`
- [ ] Risky users list + anomaly events

### 17.4 Data Exposure `/dashboard/data-exposure`
- [ ] Data exposure dashboard renders

---

## SECTION 18: MARKETPLACE (Authenticated)

### 18.1 Dashboard Marketplace `/dashboard/marketplace`
- [ ] Featured skills + all skills grid
- [ ] Install buttons visible (authenticated)

### 18.2 Skill Submission `/dashboard/skills/submit`
- [ ] Submission form or page renders

---

## SECTION 19: ADMIN PANEL (8 URLs, admin only)

### 19.1 Admin Dashboard `/admin`
- [ ] Stats cards: Total Users, Instances, Orgs, Events

### 19.2-19.8 Admin Pages
- [ ] `/admin/users` — user management table
- [ ] `/admin/users/[id]` — user detail
- [ ] `/admin/instances` — instance management
- [ ] `/admin/organizations` — org management
- [ ] `/admin/skills` — skill moderation
- [ ] `/admin/events` — system events
- [ ] `/admin/billing` — billing/MRR stats

---

## SECTION 20: MODAL REGRESSION CHECK (8 modals)

All 8 Portal-wrapped modals MUST open when button is clicked:

| # | Page | Button Text | Must Open |
|---|------|-------------|-----------|
| 1 | `/dashboard/cloud` | "Connect Account" | ✅ |
| 2 | `/dashboard/agents/policies` | "Create Policy" | ✅ |
| 3 | `/dashboard/agents/alert-channels` | "Add Channel" | ✅ |
| 4 | `/dashboard/security/playbooks` | "Create Playbook" | ✅ |
| 5 | `/dashboard/team` | "Invite Member" | ✅ |
| 6 | `/dashboard/security/policies` | "New Policy" | ✅ |
| 7 | `/dashboard/security/incidents` | "Report Incident" | ✅ |
| 8 | `/dashboard/security/alerts` | "New Rule" | ✅ |

---

## SECTION 21: RESPONSIVE DESIGN

### 21.1 Mobile (375px)
- [ ] Landing page stacks vertically
- [ ] Dashboard: hamburger menu visible, sidebar hidden
- [ ] Marketplace: cards stack single column
- [ ] Any new feature page: content readable

### 21.2 Tablet (768px)
- [ ] 2-column grids where applicable

### 21.3 Desktop (1440px)
- [ ] Full sidebar visible
- [ ] 3-column grids, charts at full width

---

## SECTION 22: ERROR STATES & EDGE CASES

### 22.1 Empty States
- [ ] Dashboard (no instance) → wizard or deploy CTA
- [ ] Incidents (empty) → "No incidents" message
- [ ] Alerts (empty) → empty state
- [ ] Cloud (empty) → "Connect Account" CTA
- [ ] Skills (empty) → empty state

### 22.2 Form Validation
- [ ] Deploy instance with empty name → error
- [ ] Invite member with invalid email → error

### 22.3 Console Errors
- [ ] Open DevTools → navigate 10+ pages → no JS errors

### 22.4 Navigation
- [ ] Every sidebar link loads a page (no 404/500)
- [ ] Back/forward browser navigation works
- [ ] Active page highlighting updates on navigation

---

## COMPLETION CHECKLIST

| # | Section | URLs | Pass | Fail | Notes |
|---|---------|------|------|------|-------|
| 1 | Public Pages | 21 | | | |
| 2 | Authentication | 3 | | | |
| 3 | Dashboard Overview | 1 | | | |
| 4 | AI Bot & Help | 2 | | | |
| 5 | Security Inbox | 1 | | | |
| 6 | Agent Monitoring | 5 | | | |
| 7 | Cloud & Infra | 5 | | | |
| 8 | Threat Intelligence | 8 | | | |
| 9 | Security Ops | 6 | | | |
| 10 | Posture & Compliance | 5 | | | |
| 11 | Identity & Access | 3 | | | |
| 12 | Assets & Monitoring | 5 | | | |
| 13 | Manage | 6 | | | |
| 14 | AI Intelligence | 5 | | | |
| 15 | Team & RBAC | 4 | | | |
| 16 | Settings | 1 | | | |
| 17 | Enterprise | 4 | | | |
| 18 | Marketplace Auth | 2 | | | |
| 19 | Admin Panel | 8 | | | |
| 20 | Modal Regression | 8 | | | |
| 21 | Responsive | 3 | | | |
| 22 | Error States | 4 | | | |
| **TOTAL** | | **108** | | | |

**200+ individual checklist items across 22 sections.**
