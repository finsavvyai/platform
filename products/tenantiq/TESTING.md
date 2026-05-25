# TenantIQ Testing Guide — Real Tenant Verification

## Prerequisites
- Active Microsoft 365 tenant with admin access
- TenantIQ account at https://app.tenantiq.app
- Signed in via Microsoft OAuth with admin consent granted

## Required Azure AD Permissions (Delegated)
Verify these are granted in Azure Portal > App Registrations > TenantIQ:
- `User.Read.All` — Read all user profiles and sign-in activity
- `Directory.Read.All` — Read directory roles and members
- `Organization.Read.All` — Read subscribed license SKUs
- `SecurityEvents.Read.All` — Read security alerts
- `Group.Read.All` — Read M365 groups, teams, members
- `Policy.Read.All` — Read Conditional Access and auth policies
- `InformationProtection.Read.All` — Read sensitivity labels
- `offline_access` — Persistent refresh token

## Step 1: Sign In & Verify Tokens
1. Go to https://app.tenantiq.app
2. Click "Sign in with Microsoft"
3. Grant all requested permissions when prompted
4. Verify sidebar shows your tenant name and "Trial" badge

## Step 2: Sync Tenant Data
1. Go to **Dashboard** (/)
2. If empty, click "Sync from Microsoft 365" on any page
3. Expected: toast shows "Synced X users, Y licenses"
4. If error about tokens: sign out (bottom of sidebar) and sign in again

## Step 3: Verify Each Page Has Real Data

### Dashboard (/)
- [ ] Secure Score shows a computed value (not hardcoded 72)
- [ ] Active Alerts shows count from real DB
- [ ] License Waste shows calculated value
- [ ] Total Users shows real count from Graph API sync
- [ ] Score ring matches the secure score value

### Licenses (/licenses)
- [ ] License table shows real SKUs (e.g., SPB, EXCHANGESTANDARD, FLOW_FREE)
- [ ] Total/Assigned/Available columns have real numbers
- [ ] Total Spend and Waste metrics are computed from real data
- [ ] Export CSV downloads file with real license data

### Security (/security)
- [ ] Secure Score from KV or computed from user/alert data
- [ ] Certificate table shows data or proper empty state
- [ ] Policy table shows data or proper empty state
- [ ] "Sync from Microsoft 365" button works with spinner

### CIS Benchmark (/security/cis)
- [ ] Click "Run CIS Scan" — fetches real Graph API data
- [ ] Score ring shows compliance percentage
- [ ] Section breakdown (Identity, Application, Data, Email, Audit)
- [ ] Control table shows pass/fail/partial for each CIS control
- [ ] Click a control row to see remediation hint
- [ ] Results persist (reload page shows cached scan)

### Config Snapshots (/backups/config)
- [ ] Click "Capture Snapshot" — reads 10 config categories from Graph
- [ ] Snapshot card shows category count and object count
- [ ] Click a snapshot to browse categories
- [ ] Take a second snapshot and use "Compare" to see diff

### Workspace Governance (/governance)
- [ ] Click "Sync Workspaces" — fetches M365 Groups from Graph
- [ ] Table shows real Teams/Groups with member and guest counts
- [ ] Filter by type (Teams/Groups) works
- [ ] Filter by risk (external/no-owner) works
- [ ] Summary cards show real totals

### Copilot Readiness (/security/copilot)
- [ ] Click "Run Assessment" — checks labels, groups, CA, MFA
- [ ] Score ring shows overall readiness
- [ ] 4 dimension cards with individual scores
- [ ] Recommendations list actionable next steps

### Alerts (/alerts)
- [ ] Shows alerts from real DB (may be empty if no scan has run)
- [ ] Filters (status, severity) work
- [ ] Empty state shows "Run AI Scan" CTA

### Sign-in Logs (/security/signin-logs)
- [ ] Shows real user sign-in data from users_cache
- [ ] Summary cards show totals
- [ ] Pagination works

### Threats (/threats) & Behavior (/behavior)
- [ ] Show empty state (no mock data) until real detection is connected
- [ ] Empty states have proper CTAs

### Email Security (/security/email)
- [ ] Shows tenant's real domain
- [ ] Score, scanned, blocked metrics (may be 0 until Exchange integration)

### AI Agent (/ai)
- [ ] Chat tab — ask a question, get AI response based on real tenant data
- [ ] Security Scan tab — run scan, see risk score from real data
- [ ] License Optimize tab — see real optimization recommendations
- [ ] Chain tab — run multi-agent analysis

## Step 4: Verify No Mock Data
- [ ] No "Contoso", "Fabrikam", "Northwind", "Adventure Works" anywhere
- [ ] No "globalremit.com" domain references
- [ ] No hardcoded IDs like "t1", "t2", "demo-1"
- [ ] All email addresses match your real tenant domain
- [ ] Secure score is not always 72

## Step 5: Export Verification
- [ ] Every page with data has an Export button
- [ ] CSV export contains real data
- [ ] JSON export wraps data with metadata
- [ ] Copy Link works (clipboard toast)

## Step 6: Trial & Subscription
- [ ] Sidebar shows "Trial" badge under user name
- [ ] Trial countdown shows days remaining
- [ ] Clicking trial banner goes to /platform/subscriptions
