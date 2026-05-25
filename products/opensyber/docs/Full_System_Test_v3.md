# OpenSyber + TokenForge — Full System Test v3

**Date:** March 27, 2026
**Auth:** Auth.js (Google, GitHub, Microsoft, LinkedIn)
**Payments:** LemonSqueezy (coupon A3OTE0NW)
**Infra:** Cloudflare Workers + D1 + Hetzner

---

## FLOW 1: Authentication (Auth.js)

### 1.1 Sign-In Page
- [ ] Navigate to opensyber.cloud/sign-in
- [ ] Left panel: "WELCOME BACK" branding
- [ ] 4 OAuth buttons: Google, GitHub, Microsoft, LinkedIn
- [ ] No Clerk branding anywhere
- [ ] Mobile: buttons stack vertically

### 1.2 Google Sign-In
- [ ] Click "Continue with Google" → OAuth consent
- [ ] Redirect to /dashboard after auth
- [ ] Avatar from Google shown in sidebar
- [ ] Name + email visible in sidebar

### 1.3 GitHub Sign-In (same email = same account)
- [ ] Sign out first
- [ ] Sign in with GitHub (same email)
- [ ] Same user data (plan, instances, skills) preserved
- [ ] Profile shows "Signed in via github"

### 1.4 Profile Page
- [ ] Navigate to /dashboard/profile
- [ ] Avatar, name, email displayed
- [ ] Provider label (google/github/etc)
- [ ] Account details: Plan, Member Since, User ID, Referral Code
- [ ] Connected Accounts: current provider = "Connected", others = "Connect" button
- [ ] Sign Out button at bottom (red)

### 1.5 Sign Out
- [ ] Click Sign Out on profile page → redirected to homepage
- [ ] OR click LogOut icon in sidebar → redirected to homepage
- [ ] Visit /dashboard → redirected to /sign-in
- [ ] Visit /admin → redirected to /sign-in

### 1.6 Auth Enforcement (API)
- [ ] curl api.opensyber.cloud/api/user → 401
- [ ] curl api.opensyber.cloud/api/instances → 401
- [ ] POST api.opensyber.cloud/api/instances → 401

---

## FLOW 2: Pricing & Payments

### 2.1 Pricing Page (Anonymous)
- [ ] Navigate to opensyber.cloud/pricing (incognito)
- [ ] 5 tiers: Free $0, Personal $49, Pro $149, Team $399, Enterprise Custom
- [ ] Free: "Get Started Free" → /sign-up
- [ ] Paid plans: "Start Free Trial" → /sign-up
- [ ] Enterprise: "Contact Sales" → /enterprise
- [ ] "Most Popular" badge on Pro
- [ ] Bottom: "Start free forever. Upgrade anytime."

### 2.2 Pricing Page (Authenticated)
- [ ] Sign in, navigate to /pricing
- [ ] Free: "Get Started Free" → /dashboard
- [ ] Personal/Pro/Team: links to finsavvy.lemonsqueezy.com
- [ ] Checkout URLs contain: user_id, email, redirect_url, discount_code=A3OTE0NW

### 2.3 LemonSqueezy Checkout
- [ ] Click Personal plan → LemonSqueezy checkout loads
- [ ] Coupon A3OTE0NW pre-applied → total $0.00
- [ ] Enter test card: 4242 4242 4242 4242, exp 12/29, CVC 123
- [ ] Submit → success → redirect to /dashboard?payment=success

### 2.4 Post-Payment Verification
- [ ] Navigate to /dashboard/settings
- [ ] Subscription card: "Personal" plan, $49/mo
- [ ] Instance limit, audit retention displayed
- [ ] "Upgrade plan →" link visible

### 2.5 Webhook Verification
- [ ] POST api.opensyber.cloud/webhooks/lemonsqueezy without signature → 401
- [ ] POST api.opensyber.cloud/webhooks/lemonsqueezy with bad signature → 401

---

## FLOW 3: Agent Deployment

### 3.1 Deploy Instance
- [ ] Navigate to /dashboard
- [ ] Click "Deploy Instance"
- [ ] Form: name field (default "My Agent"), region dropdown (4 options)
- [ ] Enter name, select region
- [ ] Submit → "Provisioning..." status
- [ ] Status transitions to "Running" (30-60 seconds)

### 3.2 Instance Settings
- [ ] Navigate to /dashboard/settings
- [ ] Instance card: name, region, hostname, gateway token, instance ID
- [ ] Gateway Token: "Configured"

### 3.3 Credential Vault
- [ ] Vault section visible (only with instance)
- [ ] Add secret: key + value
- [ ] Secret appears in list (masked)

### 3.4 Growth Kit
- [ ] ScorecardShareCard renders
- [ ] BadgeEmbed with copy button

### 3.5 Instance Deletion
- [ ] Danger Zone: Delete Instance button
- [ ] Confirm → instance removed
- [ ] Dashboard returns to empty state

---

## FLOW 4: Skill Marketplace

### 4.1 Public Marketplace
- [ ] Navigate to opensyber.cloud/marketplace
- [ ] 15 skill cards displayed
- [ ] Category filters: All, Productivity, Developer, Finance, Communication, Home, Security, Utilities
- [ ] Click category → filters without full page reload (Next.js Link)
- [ ] Each card: name, description, rating, install count, verified badge

### 4.2 Dashboard Marketplace
- [ ] Navigate to /dashboard/marketplace
- [ ] Featured section with skill cards
- [ ] Recommendations section ("Based on your agent configuration")
- [ ] Already-installed skills show green "Installed" badge
- [ ] Installed skills hidden from recommendations

### 4.3 Install Skill
- [ ] Click "Install" on a skill
- [ ] Redirects to /dashboard/skills/{id}/configure

### 4.4 Skill Configuration Wizard
- [ ] Step 1 (Review): shows permissions (network, filesystem, env vars)
- [ ] Step 2 (Configure): env var input fields for required variables
- [ ] Step 3 (Connect): connection status, log output, network permissions
- [ ] Step 4 (Activate): success state, links to skills + marketplace

### 4.5 Installed Skills Page
- [ ] Navigate to /dashboard/skills
- [ ] Installed skills listed with status

### 4.6 Skill Detail Page
- [ ] Navigate to /marketplace/{slug}
- [ ] Full description, version, author, rating
- [ ] Install button (or "Installed" if already installed)

---

## FLOW 5: Security Dashboard

### 5.1 Security Overview
- [ ] Navigate to /dashboard/security
- [ ] Metrics or empty state
- [ ] No console errors

### 5.2 Alert Rules
- [ ] Navigate to /dashboard/security/alert-rules
- [ ] "Create Alert Rule" button visible
- [ ] Click → form expands: name, event type, severity, threshold, window
- [ ] Create a rule → appears in table
- [ ] Rule shows Active badge

### 5.3 Vulnerabilities
- [ ] /dashboard/security/vulnerabilities loads

### 5.4 Alerts
- [ ] /dashboard/security/alerts loads

### 5.5 Incidents
- [ ] /dashboard/security/incidents loads

### 5.6 Kill Chain
- [ ] /dashboard/kill-chain loads

### 5.7 Threat Feed
- [ ] /dashboard/threat-feed loads

### 5.8 Attack Paths
- [ ] /dashboard/attack-paths loads

### 5.9 Network
- [ ] /dashboard/security/network loads

### 5.10 Files
- [ ] /dashboard/security/files loads

### 5.11 Supply Chain
- [ ] /dashboard/security/supply-chain loads

### 5.12 Compliance
- [ ] /dashboard/security/compliance loads

### 5.13 Uptime
- [ ] /dashboard/security/uptime loads

---

## FLOW 6: Governance & Compliance

### 6.1 OASF
- [ ] /dashboard/oasf loads

### 6.2 SOC2
- [ ] /dashboard/soc2 loads

### 6.3 Rule Engine
- [ ] /dashboard/rule-engine loads

### 6.4 Policy Builder
- [ ] /dashboard/policies/builder loads

### 6.5 Cloud Security
- [ ] /dashboard/cloud loads
- [ ] /dashboard/cloud/setup loads
- [ ] /dashboard/cloud/findings loads

### 6.6 Assets
- [ ] /dashboard/assets loads

### 6.7 SLO Dashboard
- [ ] /dashboard/slo-dashboard loads

### 6.8 SLA
- [ ] /dashboard/sla loads

---

## FLOW 7: Onboarding & Getting Started

### 7.1 Getting Started (Dynamic)
- [ ] Navigate to /dashboard/getting-started
- [ ] Progress bar: X/5 completed
- [ ] 5 steps with real status from API:
  - Deploy agent → checked if instance exists
  - Install skill → checked if skill installed
  - Setup alert rule → checked if rule created
  - Store credential → checked if secret in vault
  - Review security → checked if marked complete
- [ ] Incomplete steps link to relevant pages
- [ ] Completed steps show green check + strikethrough
- [ ] "Before You Start" auto-detects: instance deployed, token configured, agent running

### 7.2 Integration Guides
- [ ] Collapsible accordion sections
- [ ] VS Code / Cursor / Windsurf guide
- [ ] JetBrains guide
- [ ] Other integration guides

---

## FLOW 8: Audit Logs

### 8.1 Logs Page
- [ ] Navigate to /dashboard/logs
- [ ] Date range picker at top (From / To)
- [ ] Default: last 7 days
- [ ] Change dates → logs filter
- [ ] Log entries with timestamps, actions, details

---

## FLOW 9: MCP Monitoring

### 9.1 MCP Page
- [ ] Navigate to /dashboard/mcp-monitoring
- [ ] Clean empty state: "No MCP Servers Connected"
- [ ] Explanation of MCP
- [ ] Links to docs and getting started
- [ ] NO mock/placeholder data

---

## FLOW 10: Team Management

### 10.1 Team Page (Plan-gated)
- [ ] /dashboard/team — shows plan gate for free/personal
- [ ] With Team plan: member list, invite form

### 10.2 Team Settings
- [ ] /dashboard/team/settings loads

### 10.3 SSO
- [ ] /dashboard/team/sso loads

### 10.4 Data Residency
- [ ] /dashboard/team/residency loads

---

## FLOW 11: Integrations

### 11.1 Integration Catalog
- [ ] /dashboard/integrations loads
- [ ] Integration cards visible

### 11.2 Integration Health
- [ ] /dashboard/integrations/health loads

---

## FLOW 12: Settings

### 12.1 Settings Page
- [ ] /dashboard/settings loads
- [ ] Subscription card (plan, price, features)
- [ ] Instance card (name, region, hostname, ID)
- [ ] Credential Vault (add/view secrets)
- [ ] Growth Kit (scorecard, badge embed)
- [ ] Referral Program (code, share links, progress)
- [ ] Danger Zone (delete instance)

### 12.2 API Keys
- [ ] /dashboard/settings/api-keys loads
- [ ] Key list, generate button

### 12.3 Notifications
- [ ] /dashboard/settings/notifications loads

---

## FLOW 13: AI Chat Widget

### 13.1 Chat Widget
- [ ] Teal chat bubble in bottom-right corner
- [ ] Click → chat opens
- [ ] Language picker (9 languages)
- [ ] Type message → get response
- [ ] Response: "AI assistant coming soon" (no env var exposed)
- [ ] Close button works

---

## FLOW 14: Sidebar Navigation

### 14.1 All Nav Items
- [ ] Dashboard (Overview)
- [ ] Agent group: Activity, Skills, Marketplace, Logs, MCP Monitoring, Getting Started, Achievements
- [ ] Security group: Dashboard, Vulnerabilities, Alerts, Alert Rules, Incidents, Kill Chain, Threat Map, Threat Feed, Attack Paths, Network, Files, Supply Chain, Compliance, Uptime
- [ ] Governance group: OASF, SOC2, Rule Engine, Cloud, Assets, SLO, SLA
- [ ] Team group (plan-gated): Members, Settings, SSO, Residency
- [ ] Bottom rail: Integrations, Settings, Profile

### 14.2 Sign-Out Icon
- [ ] LogOut icon visible next to avatar
- [ ] Click → signs out → redirects to homepage

### 14.3 User Section
- [ ] Avatar (from OAuth provider photo)
- [ ] Name + email
- [ ] Plan label with upgrade link

---

## FLOW 15: Public Pages

### 15.1 Marketing Pages
- [ ] opensyber.cloud — hero, CTAs, sections
- [ ] /pricing — 5 tiers
- [ ] /enterprise — feature cards, contact form
- [ ] /security — security page
- [ ] /privacy — privacy policy
- [ ] /terms — terms of service
- [ ] /compliance — compliance standards
- [ ] /demo — interactive demo
- [ ] /openagent — OpenAgent page

### 15.2 Documentation
- [ ] /docs — index
- [ ] /docs/getting-started — quick start
- [ ] /docs/api — API docs
- [ ] /docs/security — security docs
- [ ] /docs/agent — agent docs
- [ ] /docs/faq — FAQ
- [ ] /docs/oasf — OASF docs
- [ ] /docs/skills — skill building
- [ ] /docs/skills/audit-methodology — audit methodology

### 15.3 Blog
- [ ] /blog — index
- [ ] /blog/introducing-opensyber
- [ ] /blog/why-self-hosted-ai-agents-are-a-security-risk
- [ ] /blog/secure-ai-coding-agents
- [ ] /blog/ai-agent-kill-chain
- [ ] /blog/slopsquatting-npm-attacks

---

## FLOW 16: API Health & Security

### 16.1 OpenSyber API
- [ ] GET api.opensyber.cloud/ → {"name":"OpenSyber API","version":"0.3.0"}
- [ ] GET api.opensyber.cloud/api/user → 401
- [ ] POST webhooks/lemonsqueezy → 401 "Missing signature"
- [ ] Security headers: nosniff, DENY, HSTS

### 16.2 TokenForge API
- [ ] GET tokenforge-api.opensyber.cloud/health → {"status":"healthy"}
- [ ] GET tokenforge-api.opensyber.cloud/ → API info
- [ ] GET sdk.js → JavaScript (>1KB)
- [ ] GET badge.js → "Protected by TokenForge"
- [ ] GET /v1/sessions → 401
- [ ] POST webhooks/lemonsqueezy → 400 "missing_signature"
- [ ] Security headers: nosniff, DENY, HSTS, rate-limit headers

---

## FLOW 17: TokenForge

### 17.1 Landing Page
- [ ] tokenforge.opensyber.cloud — hero, threat cards, trust score, code examples, comparison, pricing, FAQ
- [ ] "Get Started Free" → /sign-in
- [ ] FAQ: 16 questions expand/collapse

### 17.2 Pricing
- [ ] Free $0, Pro $49, Team $199, Enterprise Custom
- [ ] Pro/Team → LemonSqueezy checkout URLs with coupon

### 17.3 Sign-In
- [ ] Google + GitHub buttons
- [ ] Branded panel

### 17.4 Dashboard
- [ ] Overview with stats or empty state
- [ ] Sidebar: Overview, Sessions, Events, Alerts, Proxy, Compliance, Settings, Quick Start

### 17.5 Sessions
- [ ] Table or empty state

### 17.6 Events
- [ ] Event feed or empty state

### 17.7 Alerts
- [ ] Create rule form (5 conditions, email/webhook)

### 17.8 Zero-Code Proxy
- [ ] Plan gate (Team+)

### 17.9 Settings
- [ ] API keys: list, generate, delete
- [ ] Webhooks section
- [ ] Trust Badge embed code

### 17.10 Docs
- [ ] /docs — 3 integration paths
- [ ] /docs/integrations — 7 frameworks
- [ ] /docs/integrations/native — 6 SDKs
- [ ] /docs/siem — SIEM platforms

---

## FLOW 18: Mobile Responsiveness

- [ ] opensyber.cloud (375px) — hamburger menu, stacked layout
- [ ] /pricing — cards stack vertically
- [ ] /dashboard — bottom tab bar
- [ ] tokenforge.opensyber.cloud — responsive

---

## FLOW 19: Error Handling

- [ ] opensyber.cloud/nonexistent → 404
- [ ] tokenforge.opensyber.cloud/nonexistent → 404
- [ ] api.opensyber.cloud/nonexistent → JSON 404

---

## RESULTS SUMMARY

| Flow | Tests | Result |
|------|-------|--------|
| 1. Authentication | 15 | |
| 2. Pricing & Payments | 12 | |
| 3. Agent Deployment | 10 | |
| 4. Skill Marketplace | 15 | |
| 5. Security Dashboard | 13 | |
| 6. Governance | 8 | |
| 7. Onboarding | 6 | |
| 8. Audit Logs | 4 | |
| 9. MCP Monitoring | 4 | |
| 10. Team | 4 | |
| 11. Integrations | 2 | |
| 12. Settings | 3 | |
| 13. AI Chat | 5 | |
| 14. Sidebar | 5 | |
| 15. Public Pages | 20 | |
| 16. API Health | 12 | |
| 17. TokenForge | 18 | |
| 18. Mobile | 4 | |
| 19. Errors | 3 | |
| **TOTAL** | **~163** | |
