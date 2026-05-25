# TenantIQ — Claude Browser Extension Comprehensive Test Suite

**Version:** 3.1 | **Total Tests:** 288 | **URL:** https://app.tenantiq.app | **API:** https://api.tenantiq.app

---

## How to Use This Test Suite

1. Open https://app.tenantiq.app in the browser
2. Sign in with Microsoft OAuth (admin account)
3. Work through each section in order
4. Mark each test PASS/FAIL/SKIP
5. Note any errors in the "Notes" column

---

## Section 1: Authentication & Session (10 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1.1 | Sign in | Click "Sign in with Microsoft" | Redirects to Microsoft login, returns to dashboard | |
| 1.2 | Session persists | Reload the page | User remains signed in, sidebar shows name | |
| 1.3 | Tenant loaded | Check sidebar | Shows tenant name (e.g., "Global Remit") | |
| 1.4 | Trial badge (active) | Check sidebar user name badge | Shows green "Trial" badge if trial active, amber "Xd left" during grace period, or blue "Free" after grace expires | |
| 1.5 | Trial status | Check sidebar trial section | Active: green "Trial ends [date]". Grace period: amber "X days of access left" with "Upgrade" link. Expired: blue "Ready to upgrade?" with "View plans" link | |
| 1.6 | User avatar | Check sidebar user section | Shows first letter of name in blue circle | |
| 1.7 | Sign out | Click "Sign Out" at bottom of sidebar | Redirects to sign-in screen, clears session | |
| 1.8 | Re-sign in | Sign in again | All data restored, same tenant selected | |
| 1.9 | Grace period banner | Check top banner (if trial expired <7 days) | Amber banner: "X days left — Your trial ended, but we've extended your access". Dismissible. "View plans" button | |
| 1.10 | Grace period overlay | Navigate any page (if trial expired >7 days) | Soft overlay: "We loved having you on the trial" with benefits cards and "Choose a plan" CTA. Settings page still accessible | |

---

## Section 2: Sidebar Navigation (31 tests)

Verify each sidebar link navigates to the correct page without errors.

| # | Group | Link | URL | Status |
|---|-------|------|-----|--------|
| 2.1 | Quick | Skills Hub | /skills | |
| 2.2 | Quick | Dashboard | / | |
| 2.3 | Quick | Health Check | /security | |
| 2.4 | Management | Alerts | /alerts | |
| 2.5 | Management | Licenses | /licenses | |
| 2.6 | Management | Audit & Compliance | /audit | |
| 2.7 | Management | Workflows | /workflows | |
| 2.8 | Security | Security Dashboard | /security/dashboard | |
| 2.9 | Security | CIS Benchmark | /security/cis | |
| 2.10 | Security | Compliance Frameworks | /security/compliance | |
| 2.11 | Security | Threats | /threats | |
| 2.12 | Security | Behavior | /behavior | |
| 2.13 | Security | Email Security | /security/email | |
| 2.14 | Security | Purview | /security/purview | |
| 2.15 | Security | Sign-in Logs | /security/signin-logs | |
| 2.16 | Security | AI Compliance | /sdlc | |
| 2.17 | Security | Copilot Readiness | /security/copilot | |
| 2.18 | Analytics | AI Agent | /ai | |
| 2.19 | Analytics | Executive Reports | /reports | |
| 2.20 | Analytics | Cloud Backups | /backups | |
| 2.21 | Analytics | Config Snapshots | /backups/config | |
| 2.22 | Analytics | Config History | /audit/history | |
| 2.23 | Governance | Workspaces | /governance | |
| 2.24 | Governance | Storage | /governance/storage | |
| 2.25 | Governance | User Lifecycle | /workflows/lifecycle | |
| 2.26 | Governance | Copilot Usage | /security/copilot-usage | |
| 2.27 | Enterprise | MSP | /msp | |
| 2.28 | Enterprise | Benchmark | /msp/benchmark | |
| 2.29 | Enterprise | Team | /team | |
| 2.30 | Enterprise | Settings | /settings | |
| 2.31 | Security | Zero Trust | /security/zero-trust | |

---

## Section 3: Data Sync (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 3.1 | Trigger sync | Go to /licenses, click "Sync from Microsoft 365" | Spinner shows, toast: "Synced X users, Y licenses, Z workspaces" | |
| 3.2 | Users populated | Go to / (Dashboard) | "Total Users" card shows non-zero count | |
| 3.3 | Licenses populated | Go to /licenses | Table shows real SKUs (SPB, EXCHANGESTANDARD, etc.) | |
| 3.4 | Workspaces populated | Go to /governance | Workspace table shows Teams/Groups | |
| 3.5 | Secure Score | Go to / (Dashboard) | Score ring shows percentage (not --) | |
| 3.6 | Sync error handling | (If no tokens) | Toast: "Please sign out and sign in again" | |

---

## Section 4: Dashboard (9 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 4.1 | Metric cards | Go to / | 4 cards: Secure Score, Users, License Cost, Open Alerts | |
| 4.2 | Score ring | Check Security Posture section | Animated ring matching secure score value | |
| 4.3 | Score label | Check posture text | "Good" (>=70), "Needs Attention" (40-69), or "At Risk" (<40) | |
| 4.4 | License waste realistic | Check License Cost card | Not $60M+ (free SKUs should be $0) | |
| 4.5 | Quick actions | Check Quick Actions panel | 4 clickable cards (Sync Now, Run CIS Scan, AI Analysis, Create Backup) | |
| 4.6 | Quick actions clickable | Click any quick action | Navigates to correct page or triggers action | |
| 4.7 | Export button | Click Export dropdown | Shows JSON + Copy Link options | |
| 4.8 | Sync Now | Click "Sync Now" quick action | Triggers data sync from Microsoft 365 | |
| 4.9 | Tenant name | Check subtitle | Shows "[TenantName] · Last sync [time]" without double dashes | |

---

## Section 5: Licenses (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 5.1 | SKU table | Go to /licenses | Real SKUs with Total/Assigned/Available columns | |
| 5.2 | Free SKUs no cost | Check WINDOWS_STORE, FLOW_FREE | Cost/Unit shows "--" (no pricing) | |
| 5.3 | Paid SKUs priced | Check SPB, EXCHANGESTANDARD | Shows $22, $4 respectively | |
| 5.4 | Utilization color | Check Utilization column | Green for >50%, red for <50% | |
| 5.5 | Waste analysis | Check Waste Analysis section | Shows only paid SKU waste | |
| 5.6 | Export CSV | Click Export > CSV | Downloads .csv file with real data | |
| 5.7 | Export JSON | Click Export > JSON | Downloads .json with metadata wrapper | |

---

## Section 6: CIS Benchmark (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6.1 | Empty state | Go to /security/cis (first visit) | "Run CIS Scan" CTA with 5 section previews | |
| 6.2 | Run scan | Click "Run CIS Scan" | Spinner, then score ring + results | |
| 6.3 | Score ring | After scan | Shows compliance percentage with color | |
| 6.4 | Section cards | After scan | 5 cards: Identity, Application, Data, Email, Audit | |
| 6.5 | Control table | After scan | 17 controls with pass/fail/partial badges | |
| 6.6 | Expand control | Click any control row | Shows Expected + Remediation details | |
| 6.7 | Filter section | Select a section from dropdown | Table filters to that section only | |
| 6.8 | Cache persistence | Reload /security/cis | Previous scan results still visible | |

---

## Section 7: Config Snapshots (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 7.1 | Empty state | Go to /backups/config | "Capture Snapshot" CTA with category previews | |
| 7.2 | Capture | Click "Capture Snapshot" | Spinner, toast with category + object count | |
| 7.3 | Snapshot card | After capture | Card shows label, category count, object count, timestamp | |
| 7.4 | View snapshot | Click snapshot card | Shows category list (CA policies, auth methods, etc.) | |
| 7.5 | Second capture | Click "Capture Snapshot" again | Second card appears in list | |
| 7.6 | Compare | Click "Compare" on first, then click second | Diff viewer shows changes or "No differences" | |
| 7.7 | Diff colors | In diff viewer | Green for added, red for removed, amber for changed | |

---

## Section 8: Workspace Governance (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8.1 | Empty state | Go to /governance | "Sync Workspaces" CTA | |
| 8.2 | Sync | Click "Sync Workspaces" | Toast: "Synced X workspaces" | |
| 8.3 | Workspace table | After sync | Teams (T badge) and Groups (G badge) with member counts | |
| 8.4 | Guest indicator | Check guest column | Amber color for workspaces with guests | |
| 8.5 | Filter by type | Select "Teams" | Only Teams shown | |
| 8.6 | Filter by risk | Select "No owner" | Only orphaned workspaces shown | |

---

## Section 9: Copilot Readiness (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 9.1 | Empty state | Go to /security/copilot | 4 dimension previews + "Run Assessment" CTA | |
| 9.2 | Run assessment | Click "Run Assessment" | Spinner, then score ring + 4 dimension cards | |
| 9.3 | Dimensions | After assessment | Data Governance, Permissions, Oversharing, Identity scores | |
| 9.4 | Check details | In dimension cards | Per-check results: Pass/Fail/Warn with detail text | |
| 9.5 | Recommendations | After assessment | Numbered recommendation list | |

---

## Section 10: Storage Analytics (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 10.1 | Empty state | Go to /governance/storage | "Scan Storage" CTA | |
| 10.2 | Scan | Click "Scan Storage" | Toast with site count | |
| 10.3 | Summary cards | After scan | Total GB, Used GB, Site count | |
| 10.4 | Site table | After scan | Sites sorted by usage, with GB and utilization bar | |
| 10.5 | Utilization color | Check bars | Red >80%, amber >50%, green <50% | |

---

## Section 11: Copilot Usage (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 11.1 | Empty state | Go to /security/copilot-usage | "Scan Usage" CTA | |
| 11.2 | Scan | Click "Scan Usage" | Adoption ring + metric cards | |
| 11.3 | License info | After scan | Shows Copilot SKUs with seat counts (or "0 licensed") | |
| 11.4 | App breakdown | After scan (if available) | Usage bars for Word, Excel, PowerPoint, Teams, Outlook | |

---

## Section 12: AI Engine (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 12.1 | Chat tab | Go to /ai | Chat interface with suggested prompts | |
| 12.2 | Send message | Type "What are my top security risks?", press Send | AI response referencing real tenant data | |
| 12.3 | Security Scan tab | Switch to Security Scan, click "Run Scan" | Risk score, findings, recommendations | |
| 12.4 | License Optimize tab | Switch to License Optimize, click "Optimize" | Wasted licenses, savings, action items | |
| 12.5 | Analysis Chain tab | Switch to Analysis Chain | Preset dropdown + "Run Chain" button | |
| 12.6 | Run chain | Select "Full Assessment", click "Run Chain" | Analysis output (or error if no API key) | |
| 12.7 | Export | Click Export > JSON | Downloads AI analysis results | |
| 12.8 | Status badge | Check header | Shows "Anthropic fallback" or "OpenClaw connected" | |

---

## Section 13: Alerts (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 13.1 | Default view | Go to /alerts | Shows "No active alerts" with "Run AI Scan" CTA | |
| 13.2 | Filter dropdown | Change status filter | Options: All, Active, Acknowledged, Resolved, Dismissed | |
| 13.3 | Severity filter | Change severity filter | Options: All, Critical, High, Medium, Low | |
| 13.4 | Run AI Scan CTA | Click "Run AI Scan" link | Navigates to /ai | |
| 13.5 | Export | Click Export > CSV | Downloads alerts CSV (may be empty) | |

---

## Section 14: Team Management (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 14.1 | Team page | Go to /team | Member table with current user | |
| 14.2 | Current user | Check table | Shows "You" tag next to your entry | |
| 14.3 | Invite form | Check invite section | Email input + role dropdown + Send button | |
| 14.4 | Send invite | Enter email, select Viewer, click "Send Invite" | Toast: "Invitation sent", invite URL shown | |
| 14.5 | Copy invite | Click "Copy" on invite URL | Toast: "Invite link copied" | |
| 14.6 | Pending section | After invite | Shows pending invitation with email, role, revoke button | |
| 14.7 | Revoke invite | Click "Revoke" | Toast: "Invitation revoked", invite disappears | |

---

## Section 15: User Lifecycle (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 15.1 | Empty state | Go to /workflows/lifecycle | "No templates yet" message | |
| 15.2 | New Template | Click "New Template" | Builder with name, type, step toggles | |
| 15.3 | Select steps | Name "Test Offboard", select Disable + Revoke | Steps highlighted in blue | |
| 15.4 | Create | Click "Create Template" | Template appears in list | |
| 15.5 | Delete | Click "Delete" on template | Template removed | |

---

## Section 16: MSP Benchmark (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 16.1 | Benchmark page | Go to /msp/benchmark | Cross-tenant comparison table | |
| 16.2 | Metrics | Check table columns | Users, Active %, License %, CIS Score, Alerts | |
| 16.3 | Sort | Change sort dropdown | Table reorders | |
| 16.4 | Export | Click Export > CSV | Downloads benchmark data | |

---

## Section 17: SDLC.cc AI Compliance (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 17.1 | Setup page | Go to /sdlc | PII class toggles + compliance framework toggles | |
| 17.2 | Select PII | Toggle SSN, Credit Card, Email | Selected items highlighted blue | |
| 17.3 | Enable | Click "Enable AI Compliance" | Toast: "SDLC.cc AI Compliance enabled" | |
| 17.4 | Dashboard | After enable | Score ring, requests, PII redacted, integration guide | |

---

## Section 18: Settings & Webhooks (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 18.1 | Settings page | Go to /settings | User info, tenant list, AI provider, webhook sections | |
| 18.2 | Webhook URL | Enter a Slack/Teams webhook URL | Auto-detects type (shows "Slack" or "Teams" badge) | |
| 18.3 | Save webhook | Click "Save" | Toast: "Webhook saved" | |
| 18.4 | Test webhook | Click "Test" | Toast: "Test notification sent" (if URL valid) | |
| 18.5 | Enable toggle | Toggle "Enabled" checkbox | Saves enabled state | |
| 18.6 | Theme toggle | Toggle dark/light mode | Theme changes | |

---

## Section 19: Export Across All Pages (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 19.1 | Dashboard JSON | / > Export > JSON | Downloads dashboard.json | |
| 19.2 | Licenses CSV | /licenses > Export > CSV | Downloads licenses.csv with SKU data | |
| 19.3 | Alerts JSON | /alerts > Export > JSON | Downloads alerts.json | |
| 19.4 | Security JSON | /security > Export > JSON | Downloads security.json | |
| 19.5 | CIS JSON | /security/cis > Export > JSON | Downloads CIS results | |
| 19.6 | Copy Link | Any page > Export > Copy Link | Toast: "Link copied to clipboard" | |
| 19.7 | Export dropdown closes | Click Export, then click elsewhere | Dropdown closes cleanly | |

---

## Section 20: No Mock Data Verification (10 tests)

| # | Check | How to verify | Status |
|---|-------|---------------|--------|
| 20.1 | No "Contoso" | Ctrl+F on Dashboard, MSP, Benchmark pages | |
| 20.2 | No "Fabrikam" | Ctrl+F on Dashboard, MSP pages | |
| 20.3 | No "Northwind" | Ctrl+F on Dashboard, MSP pages | |
| 20.4 | No "Adventure Works" | Ctrl+F on Dashboard, MSP pages | |
| 20.5 | No "globalremit.com" | Ctrl+F on Threats, Behavior pages | |
| 20.6 | No "t1", "t2" IDs | Open DevTools Network tab, check API responses | |
| 20.7 | Real email domain | All emails use real tenant domain | |
| 20.8 | Score not 72 | Dashboard secure score varies by actual data | |
| 20.9 | License costs vary | /licenses shows $0 for free SKUs, real prices for paid | |
| 20.10 | No "Acme Corporation" | Check /platform/subscriptions | |

---

## Section 21: Error Handling & Edge Cases (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 21.1 | No token sync | (With expired token) Click any sync button | Toast: "Please sign out and sign in again" | |
| 21.2 | Empty tenant | Switch to a tenant with no data | Empty states with sync CTAs on all pages | |
| 21.3 | Page reload | Reload any page mid-load | Page recovers and loads correctly | |
| 21.4 | 404 handling | Navigate to /nonexistent | Shows error page (not blank screen) | |
| 21.5 | Console errors | Open DevTools console, navigate all pages | No red JavaScript errors (ignore SES/lockdown) | |

---

## Section 22: Onboarding Wizard (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 22.1 | Wizard shows | Sign in with a new account or tenant with no data | OnboardingWizard renders with 3-step indicator (Welcome, Sync, Ready) | |
| 22.2 | Step indicator | Check top of wizard | Three numbered circles with step labels, step 1 active (blue) | |
| 22.3 | Welcome step | Read welcome screen | Shows tenant name, description text, and "Continue" button | |
| 22.4 | Advance to sync | Click "Continue" on Welcome step | Step 2 active, Welcome step shows green checkmark, "Start Sync" button visible | |
| 22.5 | Start sync | Click "Start Sync" | Progress bar animates, status text updates (e.g., "Syncing users...") | |
| 22.6 | Sync error | (If sync fails) | Error message displayed with option to retry | |
| 22.7 | Results step | After sync completes | Step 3 active, shows dashboard metrics summary (users, licenses, score) | |
| 22.8 | Go to dashboard | Click "Go to Dashboard" on results step | Wizard closes, navigates to main dashboard | |

---

## Section 23: Executive Reports (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 23.1 | Empty state | Go to /reports (first visit, no report) | "No Report Generated" message with "Generate First Report" CTA | |
| 23.2 | Config panel | Check configuration bar | Period dropdown (Weekly/Monthly/Quarterly) + 4 section checkboxes (Security, Financials, Compliance, Recommendations) | |
| 23.3 | Generate report | Click "Generate Report" | Spinner, then metric cards (Security Score ring, Total Users, Licensed Users, Compliance %, Monthly Cost) | |
| 23.4 | Executive summary | After generation | "Executive Summary" section with narrative text | |
| 23.5 | Recommendations | After generation | Recommendation cards with priority dots (red/yellow/green) and impact descriptions | |
| 23.6 | Export JSON | Click Export > JSON | Downloads executive-report-[period].json | |
| 23.7 | Export CSV | Click Export > CSV | Downloads executive-report-[period].csv with metrics table | |

---

## Section 24: Security Dashboard (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 24.1 | Empty state | Go to /security/dashboard (no tenant connected) | "Connect your tenant" CTA linking to /settings | |
| 24.2 | Score + metrics | After tenant connected | Security Score ring + Risk Level, MFA Coverage, Active Alerts metric cards | |
| 24.3 | Security posture | Check posture section | MFA Enrollment (x/y), Conditional Access count, Admin Accounts count, Expiring Credentials count | |
| 24.4 | MFA progress | Check MFA cards | Progress bar with percentage, green color | |
| 24.5 | Compliance frameworks | Check compliance section | Framework cards with score, pass/fail/partial control counts, color-coded progress bars | |
| 24.6 | Active risks | Check risks section | Risk cards with severity badges (critical/high/medium/low), title, description, recommendation | |
| 24.7 | Severity colors | Check risk badges | Critical = red bg, High = amber bg, Medium = amber/20, Low = green/20 | |

---

## Section 25: Compliance Frameworks (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 25.1 | Empty state | Go to /security/compliance (no data) | "No compliance data yet" with "Go to Dashboard" link | |
| 25.2 | Framework cards | After data loads | Grid of framework cards, each with ScoreRing, name, pass/fail/partial counts | |
| 25.3 | Score colors | Check score rings | Green >=80%, amber >=50%, red <50% | |
| 25.4 | Expand framework | Click a framework card | Card gets ring highlight, controls table appears below with ID, Name, Status, Details columns | |
| 25.5 | Control status | Check control table status column | Pass (green), Fail (red), Partial (amber) badges | |
| 25.6 | Export JSON | Click Export > JSON | Downloads compliance-frameworks.json | |

---

## Section 26: Sign-in Logs (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 26.1 | Summary cards | Go to /security/signin-logs | 5 metric cards: Total Sign-ins, Successful, Failed, Risky, Unique Users | |
| 26.2 | Status filter | Change status dropdown | Options: All statuses, Success, Failure, Interrupted | |
| 26.3 | Risk filter | Change risk level dropdown | Options: All risk levels, High, Medium, Low, None | |
| 26.4 | User search | Type a username in filter input | Suggestions dropdown appears, table filters by user | |
| 26.5 | Logs table | After data loads | SignInLogsTable with user, app, IP, location, status, risk columns | |
| 26.6 | Pagination | Click "Next" button | Page increments, new logs load; "Previous" goes back | |
| 26.7 | Export CSV | Click "Export CSV" button | Opens export download in new tab | |

---

## Section 27: Behavior Analysis (7 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 27.1 | Empty state | Go to /behavior (no data) | "No users monitored" with connect prompt | |
| 27.2 | Summary cards | After data loads | 4 metric cards: Users Monitored, Anomalies (24h), Avg Risk Score, High Risk Users | |
| 27.3 | Risk filter | Change risk level dropdown | Options: All risk levels, Critical, High, Medium, Low | |
| 27.4 | Sort options | Change sort dropdown | Options: Sort by Risk Score, Sort by Anomaly Count | |
| 27.5 | User search | Type in search input | Table filters by user name or email | |
| 27.6 | User risk rows | Check user list | UserRiskRow components with name, email, risk score, anomaly details | |
| 27.7 | Export | Click Export > CSV or JSON | Downloads user-behavior data with risk scores and anomalies | |

---

## Section 28: Phishing Analysis (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 28.1 | Overview cards | Go to /phishing | 4 overview cards: Threat Level, Phishing Score, Active Threats, Protection Gaps | |
| 28.2 | Threat level badge | Check Threat Level card | Shows level (LOW/MEDIUM/HIGH/CRITICAL) with color-coded badge | |
| 28.3 | Threat cards | Check Active Threats section | Threat cards with type, subject, sender, confidence %, and indicator tags | |
| 28.4 | Threat detail modal | Click a threat card | Modal with full details: type, subject, sender, received time, confidence, all indicators, Quarantine/Report buttons | |
| 28.5 | Protection gaps | Check Protection Gaps section | Gap cards with severity badge and description | |
| 28.6 | Scan now | Click "Scan Now" | Spinner during scan, then refreshed results | |

---

## Section 29: OpenClaw Integration (8 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 29.1 | Page loads | Go to /integrations/openclaw | Header with "OpenClaw Integration" title and install status badge (green or red) | |
| 29.2 | Tab navigation | Click each tab | 5 tabs: Overview, Skills & Commands, Channels, Webhooks, Installation Guide | |
| 29.3 | Overview tab | View Overview tab | Stats (command count, connected channels, webhook status), setup checklist | |
| 29.4 | Skills tab | Click "Skills & Commands" | Command categories listed with counts (Security, License Optimization, etc.) | |
| 29.5 | Channels tab | Click "Channels" | 6 platform cards (Slack, Teams, Discord, WhatsApp, Telegram, iMessage) with Connect/Disconnect buttons | |
| 29.6 | Connect platform | Click "Connect" on a platform card | Platform status changes to connected | |
| 29.7 | Webhooks tab | Click "Webhooks" | Webhook URL input, secret, notification mode, severity filter, category toggles, quiet hours | |
| 29.8 | Install guide | Click "Installation Guide" | Step-by-step installation instructions with copy command button | |

---

## Section 30: Platform Subscriptions (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 30.1 | Stats grid | Go to /platform/subscriptions | 6 stat cards: Active, Trials, Past Due, Total MRR, ARPA, Churn | |
| 30.2 | Status filter | Click status filter buttons | Filter by: All Status, Active, Trial, Past Due | |
| 30.3 | Tier filter | Click tier filter buttons | Filter by: All Tiers, Starter, Professional, Enterprise | |
| 30.4 | Subscription cards | Check subscription list | Cards with org name, tier badge, status badge, price, usage bars (Users, Scans) | |
| 30.5 | Usage indicators | Check usage bars | Green <70%, amber 70-90%, red >90% | |
| 30.6 | Empty state | Filter to show no results | "No subscriptions found" with "Clear Filters" button | |

---

## Section 31: Auth Callback (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 31.1 | Successful callback | Navigate to /auth/callback?token=...&user=... | Shows spinner "Signing you in...", then redirects to / | |
| 31.2 | Error display | Navigate to /auth/callback?error=some_error | Shows "Sign-in Failed" with error details | |
| 31.3 | Permission error | Callback with AADSTS permission error | Shows "Permission Issue" help box with Azure Portal instructions | |
| 31.4 | Token error | Callback with expired token error | Shows "Session Expired" help box with "Try Again" button | |

---

## Section 32: Home / Landing Page (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 32.1 | Page loads | Go to /home (unauthenticated) | Full landing page with dark gradient background | |
| 32.2 | Hero section | Check top of page | HeroSection with product headline and CTA | |
| 32.3 | Features section | Scroll down | FeaturesSection with product capabilities | |
| 32.4 | Footer | Scroll to bottom | LandingFooter with links and branding | |

---

## Section 33: Remediation Dry-Run (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 33.1 | Find remediable alert | Go to /alerts, locate an alert with a remediation action | Alert row shows remediation action button | |
| 33.2 | Preview changes | Click "Preview Changes" button on the alert | Dry-run modal opens with a list of proposed changes | |
| 33.3 | Changes detail | Check dry-run changes list | Each change shows resource name, field, current value, and proposed value | |
| 33.4 | Duration and reversibility | Check dry-run modal metadata | Estimated duration displayed; reversibility indicator (reversible/irreversible) shown | |
| 33.5 | Action buttons | Check bottom of dry-run modal | "Execute" (primary) and "Cancel" (secondary) buttons present and clickable | |

---

## Section 34: Remediation Scheduling (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 34.1 | Schedule remediation | On remediation confirmation modal, set a future date and time | Date/time picker accepts future value, "Schedule" button becomes active | |
| 34.2 | Scheduled status | After scheduling | Alert remediation status shows "Scheduled" with scheduled date/time | |
| 34.3 | Scheduled list | Navigate to scheduled remediations list | Scheduled remediation appears with target date, alert name, and status | |
| 34.4 | Cancel or reschedule | Click options on a scheduled remediation | "Cancel" and "Reschedule" options available and functional | |

---

## Section 35: Compliance Frameworks (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 35.1 | Frameworks page | Navigate to /security/compliance | Page loads with compliance framework cards | |
| 35.2 | Framework cards | Check card grid | 3 framework cards (SOC 2, HIPAA, GDPR) each showing score ring and name | |
| 35.3 | Expand controls | Click a framework card | Card expands to reveal controls list with ID, name, and status columns | |
| 35.4 | Control evidence | Check control rows | Each control shows pass/fail/partial status badge and evidence summary | |
| 35.5 | Remediation guidance | Click a failing control | Remediation guidance text displayed with actionable steps | |
| 35.6 | Export compliance | Click Export button | Downloads compliance data (JSON or CSV) with framework scores and control details | |

---

## Section 36: Report Builder (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 36.1 | Builder page | Navigate to /reports/builder | Report builder interface loads with metric picker | |
| 36.2 | Metric categories | Check metric picker sidebar | Categories loaded from API with checkbox per metric; grouped by category heading | |
| 36.3 | Period selector | Check period bar | 4 period buttons (7 Days, 30 Days, 90 Days, 1 Year) with active state highlight and title input | |
| 36.4 | Generate report | Select metrics, click "Generate Report" | Spinner, then MetricCard grid renders with label, formatted value, and category subtitle | |
| 36.5 | Save template | Click "Save Template" with metrics selected | Toast: "Template saved" | |
| 36.6 | Export | Click Export menu (visible after report generated) | JSON download and PDF (browser print dialog) options available | |

---

## Section 37: Alert Analytics (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 37.1 | Analytics section | Navigate to /alerts, scroll to analytics section | Alert analytics dashboard visible below alert list | |
| 37.2 | Trend chart | Check trend chart | Line/bar chart with date range selector (7d, 30d, 90d) | |
| 37.3 | Resolution metrics | Check MTTR and resolution rate | MTTR value displayed (e.g., "2.4 hours"); resolution rate as percentage | |
| 37.4 | Severity breakdown | Check severity distribution | Breakdown showing count per severity (Critical, High, Medium, Low) with color coding | |
| 37.5 | Recurring alerts | Check recurring alerts section | List of alerts that have recurred, with recurrence count and last occurrence | |

---

## Section 38: Guest User Review (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 38.1 | Review page | Navigate to /workflows/guest-review | Guest user review page loads with review results | |
| 38.2 | Stale guests | Check review results | Lists stale and orphaned guest accounts with last activity date and status | |
| 38.3 | Approve/deny | Click approve or deny button on a guest entry | Guest status updates; toast confirms action taken | |
| 38.4 | Review history | Check review history section | Previous review actions listed with date, guest name, action taken, and reviewer | |

---

## Section 39: Group Cleanup (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 39.1 | Cleanup page | Navigate to /workflows/group-cleanup | Group cleanup page loads with cleanup results | |
| 39.2 | Cleanup results | Check results list | Shows empty, orphaned, and inactive groups with member count and last activity | |
| 39.3 | Archive groups | Select groups via checkboxes, click "Archive" | Selected groups archived; toast confirms count archived | |
| 39.4 | Cleanup history | Check cleanup history section | Previous cleanup actions listed with date, group name, action, and operator | |

---

## Section 40: Approval Queue (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 40.1 | Queue page | Navigate to /workflows/approvals | Approval queue page loads with pending approvals list | |
| 40.2 | Pending list | Check pending approvals | Each approval shows requester, type, description, and submitted date | |
| 40.3 | Approval detail | Click an approval item | Expands to show individual items requiring approval with details | |
| 40.4 | Approve/deny items | Click Approve or Deny on individual items | Item status updates; toast confirms action; item moves to resolved | |
| 40.5 | Approval history | Check approval history tab | Resolved approvals listed with decision, reviewer, and timestamp | |

---

## Section 41: Backup Health (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 41.1 | Backup page | Navigate to /backups | Backup health section visible with status indicator | |
| 41.2 | Health status | Check health indicator | Shows healthy (green), warning (amber), or critical (red) status badge | |
| 41.3 | Last backup | Check last backup info | Displays last successful backup timestamp and duration since | |
| 41.4 | Drift alerts | Check drift section | Shows drift alerts if configuration changed since last backup; empty state if no drift | |

---

## Section 42: AI Chat Streaming (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 42.1 | Chat interface | Navigate to /ai | Chat interface loads with input field and suggested prompts | |
| 42.2 | Send message | Type a security question and press Send | Message appears in chat, loading indicator shown | |
| 42.3 | Streaming response | Watch AI response | Text appears incrementally (character or chunk at a time), not all at once | |
| 42.4 | Tool execution | Observe tool calls during response | Tool execution cards appear showing tool name, status, and result summary | |
| 42.5 | Suggested actions | After response completes | Suggested action buttons appear below the AI response (e.g., "Run Scan", "View Details") | |

---

## Section 43: Conversation Export (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 43.1 | Open conversation | In /ai, have or start a conversation with at least one exchange | Conversation visible with user and AI messages | |
| 43.2 | Export Markdown | Click Export > Markdown | Downloads conversation as .md file with formatted messages | |
| 43.3 | Export JSON | Click Export > JSON | Downloads conversation as .json file with structured message data | |
| 43.4 | Share link | Click "Share" button | Shareable link generated and copied to clipboard; toast confirms | |

---

## Section 44: Zero Trust Assessment (5 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 44.1 | Assessment page | Navigate to /security/zero-trust | Zero Trust assessment page loads with "Run Assessment" CTA | |
| 44.2 | Run assessment | Click "Run Assessment" | Spinner during evaluation, then results render | |
| 44.3 | Overall score | Check score section | PurviewScoreRing with percentage and maturity level label (Initial/Advanced/Optimal) | |
| 44.4 | Pillar cards | Check pillar section | 6 pillar cards: Identity, Devices, Network, Applications, Data, Infrastructure — each with score and per-check pass/partial/fail badges | |
| 44.5 | Recommendations | Check recommendations section | Numbered recommendation list with pillar attribution for each item | |

---

## Section 45: Purview DLP (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 45.1 | Purview page | Navigate to /security/purview | Purview compliance page loads with DLP and labels sections | |
| 45.2 | DLP policies | Check DLP section | Policies listed with name and enforcement status (Enforce/Test/Off) badges | |
| 45.3 | Sensitivity labels | Check labels section | Labels displayed with adoption percentage and usage metrics | |
| 45.4 | Compliance score | Check overall score | Purview compliance score displayed as percentage with color indicator | |

---

## Section 46: Self-Service Portal (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 46.1 | Portal page | Navigate to /portal/me | Self-service portal loads with user profile section | |
| 46.2 | User profile | Check profile section | Displays user name, email, role, and organization | |
| 46.3 | License assignments | Check licenses section | Shows assigned licenses with SKU names and status | |
| 46.4 | Sign-in activity | Check activity section | Recent sign-in history with dates, locations, and status | |

---

## Section 47: Bulk Operations (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 47.1 | User list | Navigate to user list page | User table with selectable checkboxes per row | |
| 47.2 | Multi-select | Select multiple users via checkboxes | Selection count shown; bulk action toolbar appears | |
| 47.3 | Bulk action | Choose "Assign License" from bulk action dropdown | Confirmation modal shows selected user count and license to assign | |
| 47.4 | Batch progress | Confirm bulk action | Progress tracker shows batch status (processing/completed/failed per user) | |

---

## Section 48: Migration (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 48.1 | Migration page | Navigate to /settings/migration | Migration planning interface loads | |
| 48.2 | Create plan | Select source tenant and target tenant, click "Create Plan" | Migration plan created showing items to migrate (users, groups, policies) | |
| 48.3 | Plan details | Check migration plan | Lists items with type, name, status, and estimated duration | |
| 48.4 | Execute migration | Click "Execute" and confirm | Status tracking shows per-item progress (pending/in-progress/completed/failed) | |

---

## Section 49: Event Triggers (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 49.1 | Triggers page | Navigate to /settings or events section | Event triggers configuration interface loads | |
| 49.2 | Create trigger | Click "New Trigger", configure event type and action | Trigger creation form with event type dropdown and action configuration | |
| 49.3 | Trigger list | After creating | New trigger appears in list with event type, action, and enabled status | |
| 49.4 | Test trigger | Click "Test" on a trigger | Test result shown (matched/not matched) against sample event data | |

---

## Section 50: Notification Preferences (4 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 50.1 | Preferences page | Navigate to /settings, find notification preferences | Notification preferences section loads with category list | |
| 50.2 | Push toggles | Check push notification toggles | Per-category toggle switches (Security, Compliance, Licensing, System) | |
| 50.3 | Email preferences | Check email notification settings | Email notification toggles per category with frequency options (instant/daily digest) | |
| 50.4 | Quiet hours | Check quiet hours configuration | Start time, end time, and timezone selector for suppressing notifications | |

---

## Section 51: Trial & Grace Period UX (6 tests)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 51.1 | Active trial sidebar | Check sidebar (active trial) | Green trial section showing "Trial ends [date]" | |
| 51.2 | Grace period sidebar | Check sidebar (expired trial, <7 days) | Amber "X days of access left" with "Upgrade to keep access" link | |
| 51.3 | Grace period banner | Check top of page (expired trial, <7 days) | Amber banner with countdown, "View plans" button, dismissible X | |
| 51.4 | Banner dismissible | Click X on grace period banner | Banner disappears for this session | |
| 51.5 | Expired overlay | Navigate to any page (expired >7 days) | Soft overlay with heart icon, "We loved having you on the trial", 3 benefit cards, "Choose a plan" button | |
| 51.6 | Settings accessible | Navigate to /settings (expired >7 days) | Settings page loads WITHOUT overlay — user can access billing to upgrade | |

---

## Summary

| Section | Tests | Description |
|---------|-------|-------------|
| 1. Auth & Session | 10 | Sign in, trial badge, grace period, sign out |
| 2. Sidebar Navigation | 31 | All links work |
| 3. Data Sync | 6 | Graph API sync flow |
| 4. Dashboard | 9 | Metric cards, score, compliance |
| 5. Licenses | 7 | SKU table, pricing, export |
| 6. CIS Benchmark | 8 | Scan, controls, remediation |
| 7. Config Snapshots | 7 | Capture, view, diff |
| 8. Workspace Governance | 6 | Sync, table, filters |
| 9. Copilot Readiness | 5 | Assessment, dimensions |
| 10. Storage Analytics | 5 | Scan, usage table |
| 11. Copilot Usage | 4 | License + usage tracking |
| 12. AI Engine | 8 | Chat, scan, optimize, chain |
| 13. Alerts | 5 | Filters, empty state, CTA |
| 14. Team Management | 7 | Invite, roles, revoke |
| 15. User Lifecycle | 5 | Templates, steps, create |
| 16. MSP Benchmark | 4 | Cross-tenant comparison |
| 17. SDLC.cc | 4 | PII setup, enable |
| 18. Settings & Webhooks | 6 | Webhook config, test |
| 19. Export | 7 | CSV, JSON, copy link |
| 20. No Mock Data | 10 | Clean data verification |
| 21. Error Handling | 5 | Edge cases |
| 22. Onboarding Wizard | 8 | 3-step first-time user setup |
| 23. Executive Reports | 7 | Generate, configure, export |
| 24. Security Dashboard | 7 | Score, posture, risks |
| 25. Compliance Frameworks | 6 | Framework cards, controls |
| 26. Sign-in Logs | 7 | Table, filters, pagination |
| 27. Behavior Analysis | 7 | User risk, anomalies |
| 28. Phishing Analysis | 6 | Threats, gaps, scan |
| 29. OpenClaw Integration | 8 | Tabs, channels, webhooks |
| 30. Platform Subscriptions | 6 | Billing, tiers, usage |
| 31. Auth Callback | 4 | OAuth flow, error handling |
| 32. Home / Landing Page | 4 | Marketing landing page |
| 33. Remediation Dry-Run | 5 | Preview changes, duration, reversibility |
| 34. Remediation Scheduling | 4 | Schedule, cancel, reschedule remediations |
| 35. Compliance Frameworks | 6 | SOC 2, HIPAA, GDPR cards, controls, export |
| 36. Report Builder | 6 | Metric picker, period selector, generate, save template, export |
| 37. Alert Analytics | 5 | Trends, MTTR, severity breakdown, recurring |
| 38. Guest User Review | 4 | Stale guests, approve/deny, history |
| 39. Group Cleanup | 4 | Empty/orphaned groups, archive, history |
| 40. Approval Queue | 5 | Pending approvals, approve/deny, history |
| 41. Backup Health | 4 | Health status, last backup, drift alerts |
| 42. AI Chat Streaming | 5 | Streaming response, tool cards, actions |
| 43. Conversation Export | 4 | Markdown, JSON export, share link |
| 44. Zero Trust Assessment | 5 | Score, 6 pillars, recommendations |
| 45. Purview DLP | 4 | DLP policies, sensitivity labels, score |
| 46. Self-Service Portal | 4 | Profile, licenses, sign-in activity |
| 47. Bulk Operations | 4 | Multi-select, bulk action, batch progress |
| 48. Migration | 4 | Plan, items, execute, status tracking |
| 49. Event Triggers | 4 | Create, list, test triggers |
| 50. Notification Preferences | 4 | Push, email, quiet hours |
| 51. Trial & Grace Period UX | 6 | Active trial, grace period, expired overlay |
| **Total** | **288** | |

---

## Test Priority Guide

**P0 (Must pass):** Sections 1, 3, 4, 5, 20, 22, 31, 51 -- auth, sync, dashboard, licenses, no mock data, onboarding, OAuth callback, trial & grace period
**P1 (Should pass):** Sections 6, 7, 8, 9, 12, 14, 23, 24, 25, 33, 34, 35, 40, 42, 44 -- CIS, snapshots, governance, copilot, AI, team, executive reports, security dashboard, compliance, remediation dry-run, remediation scheduling, compliance frameworks, approval queue, AI streaming, zero trust
**P2 (Nice to pass):** Sections 2, 10, 11, 13, 15, 16, 17, 18, 19, 26, 27, 28, 29, 30, 32, 36, 37, 38, 39, 41, 43, 45, 46, 47, 48, 49, 50 -- sidebar, storage, usage, alerts, lifecycle, MSP, SDLC, settings, export, sign-in logs, behavior, phishing, OpenClaw, subscriptions, landing, report builder, alert analytics, guest review, group cleanup, backup health, conversation export, Purview DLP, self-service portal, bulk operations, migration, event triggers, notification preferences
**P3 (Edge cases):** Section 21
