# OpenSyber Full Browser Test Specification

**Target:** https://opensyber.cloud
**Auth:** Clerk (already signed in)
**Plan:** Team ($399/mo)
**Date:** 2026-03-14

---

## Instructions

Navigate to each page listed below. For each page:
1. Verify the page loads without crash (no error screens)
2. Check all data displays correctly (no "undefined", no blank where data expected)
3. Test all interactive elements (buttons, forms, modals, filters, toggles)
4. Report status as PASS / FAIL with details

---

## TEST 1: Dashboard Overview (`/dashboard`)

**Page Load:**
- [ ] Page loads without error
- [ ] Page title shows "Dashboard"
- [ ] Instance card visible with name, status badge, region, IP, creation date

**Interactive Elements:**
- [ ] "Restart" button visible in top-right — click it, confirm it shows loading state
- [ ] Instance name is displayed (click to see if editable)
- [ ] Security Score card shows a number (0-100) or "—"
- [ ] CPU, Memory, Disk cards show percentages or "—"
- [ ] Recent Security Events section visible
- [ ] "View all events →" link navigates to `/dashboard/security`

---

## TEST 2: Skills (`/dashboard/skills`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows installed skills list or empty state

---

## TEST 3: Audit Logs (`/dashboard/logs`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows table with Action, Skill, Details, Time columns OR empty state

**Interactive Elements:**
- [ ] "Export CSV" button visible — click to verify it downloads a CSV file
- [ ] Filter pills visible (All, Shell Execution, File Read, etc.) — click each, verify URL updates with `?action=` param
- [ ] Pagination (if >25 entries): "Previous" and "Next" links work
- [ ] Verify page count text ("Page X of Y")

---

## TEST 4: Notifications (`/dashboard/settings/notifications`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows existing notification channels or empty state with dashed border

**CRUD Test — Create Channel:**
- [ ] Scroll to "Add Notification Channel" form at bottom
- [ ] Select channel type "Email" from dropdown
- [ ] Enter name: "Test Email Channel"
- [ ] Enter email address in the config field
- [ ] Click "Create Channel" — verify page reloads and new channel appears
- [ ] New channel shows: name, type badge, "Active" badge, created date

**CRUD Test — Delete Channel:**
- [ ] Click the red trash icon on the channel just created
- [ ] Confirm deletion dialog appears with "Yes" / "No"
- [ ] Click "Yes" — verify channel disappears from the list

**Validation Test:**
- [ ] Try to create a channel with empty name — verify "Name is required" error appears
- [ ] Try different channel types: Webhook, Slack — verify config fields change dynamically

---

## TEST 5: Marketplace (`/dashboard/marketplace`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows skill cards in a grid layout

**Interactive Elements:**
- [ ] Search input visible — type a search term, verify cards filter in real-time
- [ ] Clear search — verify all cards reappear
- [ ] Each card shows: name, category, install count, tier badge (free/pro/premium)

---

## TEST 6: Settings (`/dashboard/settings`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows plan info: "Team" plan, "$399/month"
- [ ] Vault section visible with secrets list and "Add Secret" button
- [ ] Referral section visible
- [ ] Badge embed section visible
- [ ] Growth Kit section visible

**CRUD Test — Store Secret:**
- [ ] Click "Add Secret" button — verify form expands
- [ ] Leave both fields empty → verify "Store Secret" button is disabled (grayed out)
- [ ] Enter Key: "TEST_KEY", Value: "test123"
- [ ] Click "Store Secret" — verify page reloads and secret appears in list
- [ ] Verify key auto-formats to UPPERCASE_SNAKE_CASE (type "my-key" → "MY_KEY")

**Interactive Elements:**
- [ ] Badge embed code is visible and copyable
- [ ] Referral link is displayed

---

## TEST 7: Agent Activity (`/dashboard/agents`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows risk score (0-100) or empty state
- [ ] Shows severity distribution cards (Critical, High, Medium, Low)

**Interactive Elements:**
- [ ] "Install Extension" button links to VS Code marketplace (opens external)
- [ ] "Clear All" button (if activity exists) — click, verify confirmation dialog

---

## TEST 8: Cloud Security / CSPM (`/dashboard/cloud`)

**Page Load:**
- [ ] Page loads without error
- [ ] Heading shows "Cloud Security (CSPM)" with investor description
- [ ] Shows connected cloud accounts or empty state

**CRUD Test — Connect Account:**
- [ ] Click "Connect Account" — verify modal opens
- [ ] Select provider "AWS" — verify "Role ARN" field appears
- [ ] Select provider "GCP" — verify placeholder says "My GCP Project"
- [ ] Select provider "Azure" — verify placeholder says "Azure Subscription"
- [ ] Leave Account Name empty → verify "Connect" button is disabled
- [ ] Enter Account Name: "Test AWS" → click "Connect"
- [ ] Verify new account appears in list with provider badge and status

**CRUD Test — Actions on Account:**
- [ ] Click "Scan" button on an account → verify spinner appears
- [ ] Click "Remove" on an account → verify confirmation dialog → confirm → account removed

---

## TEST 9: CSPM Findings (`/dashboard/cloud/findings`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows severity summary cards (Critical, High, Medium, Low counts)
- [ ] Shows findings table or empty state

**Interactive Elements:**
- [ ] Severity filter dropdown — select "Critical" → verify table filters
- [ ] Status filter dropdown — select "Open" → verify table filters
- [ ] "Mute" button on a finding → verify finding gets muted
- [ ] "Resolve" button on a finding → verify finding marked as resolved

---

## TEST 10: Team Agents (`/dashboard/agents/team`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows team agent activity or empty state

---

## TEST 11: Agent Policies (`/dashboard/agents/policies`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows policies table or empty state with "Create First Policy" button

**CRUD Test — Create Policy:**
- [ ] Click "Create Policy" → verify modal opens
- [ ] Enter name: "Block .env access"
- [ ] Select rule type: "File Pattern"
- [ ] Enter pattern: "**/.env*"
- [ ] Select severity: "Critical"
- [ ] Click "Create Policy" → verify modal closes and policy appears in table
- [ ] **Verify NO "Org context required" error** (this was a fixed bug)

**CRUD Test — Toggle & Delete:**
- [ ] Click the toggle switch on a policy → verify it switches on/off
- [ ] Click "Delete" on a policy → verify confirmation dialog → confirm → policy removed

---

## TEST 12: Alert Channels (`/dashboard/agents/alert-channels`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows channels list or empty state with "Add First Channel"
- [ ] **Verify NO 404 error** (this was a fixed bug)

**CRUD Test — Create Channel:**
- [ ] Click "Add Channel" → verify modal opens with channel type selection
- [ ] Select "Email" → verify config step shows "Recipient Emails" and "From Email" fields
- [ ] Enter name: "Test Email Alert"
- [ ] Enter recipient email: "test@example.com"
- [ ] Select min severity: "High"
- [ ] Click "Create Channel" → verify modal closes and channel appears

**CRUD Test — Actions on Channel:**
- [ ] Click "Test" button → verify spinner, then success/error message appears
- [ ] Click toggle switch → verify channel activates/deactivates
- [ ] Click trash icon → verify confirmation dialog → confirm → channel removed

**Validation Test:**
- [ ] Try creating a channel without filling required fields → verify error message appears

---

## TEST 13: Violations (`/dashboard/agents/violations`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows violations table with filters or empty state

---

## TEST 14: Attack Paths (`/dashboard/attack-paths`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows 3 stat cards: Agent Sessions, Crown Jewels, Blast Radius
- [ ] Investor description visible explaining blast radius analysis

**Interactive Elements:**
- [ ] Session selector cards visible — click one → verify "Computing blast radius..." loading
- [ ] After computation: blast radius summary, graph visualization, and crown jewel paths appear
- [ ] If no sessions: "No agent sessions discovered yet" message

---

## TEST 15: Asset Inventory (`/dashboard/assets`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows assets table or empty state

**Interactive Elements:**
- [ ] Search input → type a term → verify table filters by name/identifier
- [ ] Type filter dropdown → select "File" → verify only file assets shown
- [ ] Sensitivity filter dropdown → select a level → verify filtering
- [ ] Clear all filters → verify all assets reappear
- [ ] Crown jewel icon visible on critical assets

---

## TEST 16: OASF Compliance (`/dashboard/oasf`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows OASF description mentioning "15 security controls" and "SOC2 for AI agents"
- [ ] Shows assessment results or empty state "No assessments yet"

**Interactive Elements:**
- [ ] Click "Run Assessment" button → verify spinner animation on the icon
- [ ] **Verify NO "Plan config not loaded" error** (this was a fixed bug)
- [ ] If successful: page reloads with grade (A+ to F), score, and control breakdown
- [ ] Assessment history table shows date, grade, score, pass/fail counts

---

## TEST 17: SOC2 Readiness (`/dashboard/soc2`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows SOC2 description mentioning "gold-standard audit" and "Trust Services Criteria"
- [ ] Shows readiness score, passing controls, TSC coverage or empty state

**Data Display:**
- [ ] Control mapping table with OASF Control, SOC2 Mapping, Status columns
- [ ] Status badges: Pass (green), Fail (red), Partial (amber)

---

## TEST 18: SLA Monitor (`/dashboard/sla`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows description mentioning "uptime, response times, and MTTR"
- [ ] Shows 4 metric cards: Current Uptime, Target, Avg Response, MTTR — or empty state

**Data Display:**
- [ ] Daily uptime chart (if data): 30 bars with green/amber/red coloring
- [ ] Legend: "Green = 99.9%+ | Amber = 99%+ | Red = <99%"

---

## TEST 19: Security Dashboard (`/dashboard/security`)

**Page Load:**
- [ ] Page loads without error
- [ ] **Verify NO crash** (this was a previously fixed bug)
- [ ] Shows description about "single score (0-100)"

**Data Display:**
- [ ] Overall Score card (large number with color)
- [ ] "Share Scorecard" link (opens new tab)
- [ ] Open Alerts card (clickable → navigates to alerts)
- [ ] Open Incidents card (clickable → navigates to incidents)
- [ ] Vulnerabilities card with severity breakdown
- [ ] Category Breakdown section with progress bars
- [ ] Score History chart (line chart)
- [ ] Threat Map visualization
- [ ] Recommendations section (if any)
- [ ] Recent Security Events table

---

## TEST 20: Security Alerts (`/dashboard/security/alerts`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows alerts table or empty state

---

## TEST 21: Incidents (`/dashboard/security/incidents`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows incidents table with Title, Severity, Status, Created columns
- [ ] Incident titles are clickable (link to detail page)

---

## TEST 22: Security Policies (`/dashboard/security/policies`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows policies table or empty state

---

## TEST 23: Network Activity (`/dashboard/security/network`)

**Page Load:**
- [ ] Page loads without error
- [ ] **Verify NO crash** (this was a fixed bug — API returns `activity` not `networkActivity`)
- [ ] Shows 2 summary cards: Total Requests, Blocked

**Data Display:**
- [ ] Table with Domain, Method, Path, Status, Action, Time columns
- [ ] Blocked rows highlighted in red background
- [ ] Action badges: "allowed" (green) or "blocked" (red)

---

## TEST 24: File Integrity (`/dashboard/security/files`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows file integrity events or empty state

---

## TEST 25: Vulnerabilities (`/dashboard/security/vulnerabilities`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows description mentioning "CVEs" and "Common Vulnerabilities and Exposures"
- [ ] Shows 4 severity summary cards: Critical, High, Medium, Low

**Data Display:**
- [ ] Table with CVE ID, Package, Version, Severity, Status, Detected columns
- [ ] Severity badges with colors (red/orange/yellow/blue)
- [ ] Status badges: Open, In Progress, Fixed, Ignored, False Positive

---

## TEST 26: Compliance Reports (`/dashboard/security/compliance`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows compliance reports or empty state

---

## TEST 27: Threat Map (`/dashboard/security/threats`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows description about "geographic origin of security events"
- [ ] Shows Total Threat Events card or empty state

**Data Display:**
- [ ] Events count with red/green color based on count
- [ ] Top Countries table with Country, Event Count, Severity columns
- [ ] Severity badges with colors

---

## TEST 28: Uptime (`/dashboard/security/uptime`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows uptime monitoring data or empty state

---

## TEST 29: Achievements (`/dashboard/achievements`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows achievements grid with progress indicators
- [ ] Verify 10 achievements displayed
- [ ] Progress counter (e.g., "0/10 unlocked")

---

## TEST 30: Team Members (`/dashboard/team`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows team members list with Name, Email, Role columns
- [ ] Verify member names show actual names (not "Unknown" — this was a fixed bug)
- [ ] Plan badge shows "Team" (not "Free" — this was a fixed bug)

---

## TEST 31: Team Settings (`/dashboard/team/settings`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows team configuration options

---

## TEST 32: SSO (`/dashboard/team/sso`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows SSO configuration or "SSO not configured" state

---

## TEST 33: Data Residency (`/dashboard/team/residency`)

**Page Load:**
- [ ] Page loads without error
- [ ] Shows data residency configuration

---

## Results Summary

| # | Page | Status | Notes |
|---|------|--------|-------|
| 1 | Dashboard Overview | | |
| 2 | Skills | | |
| 3 | Audit Logs | | |
| 4 | Notifications | | |
| 5 | Marketplace | | |
| 6 | Settings | | |
| 7 | Agent Activity | | |
| 8 | Cloud Security | | |
| 9 | CSPM Findings | | |
| 10 | Team Agents | | |
| 11 | Agent Policies | | |
| 12 | Alert Channels | | |
| 13 | Violations | | |
| 14 | Attack Paths | | |
| 15 | Asset Inventory | | |
| 16 | OASF Compliance | | |
| 17 | SOC2 Readiness | | |
| 18 | SLA Monitor | | |
| 19 | Security Dashboard | | |
| 20 | Security Alerts | | |
| 21 | Incidents | | |
| 22 | Security Policies | | |
| 23 | Network Activity | | |
| 24 | File Integrity | | |
| 25 | Vulnerabilities | | |
| 26 | Compliance Reports | | |
| 27 | Threat Map | | |
| 28 | Uptime | | |
| 29 | Achievements | | |
| 30 | Team Members | | |
| 31 | Team Settings | | |
| 32 | SSO | | |
| 33 | Data Residency | | |

**Total Pages:** 33
**Total Checks:** 150+
**Previously Fixed Bugs to Verify:** 7 (marked with "this was a fixed bug")
