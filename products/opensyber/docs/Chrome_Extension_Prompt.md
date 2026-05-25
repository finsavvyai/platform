# OpenSyber — Persona-Based Journey Tests

**Purpose:** Test complete user journeys from a real customer perspective.
**Date:** March 27, 2026

Each persona represents a real user type with specific goals, pain points, and expectations. Tests follow their complete journey — not just clicking buttons, but evaluating whether the product delivers value at each step.

---

# PERSONA 1: Alex — Solo Developer (Free → Personal)

**Who:** Full-stack developer, runs AI coding agents (Cursor, Claude Code) on personal projects.
**Goal:** Secure my AI agent so it doesn't leak API keys or make unauthorized network calls.
**Budget:** $0 initially, willing to pay $49/mo if it works.
**Technical level:** High. Expects things to just work.

## Journey: Discovery → Setup → First Value → Upgrade

### Step 1: Discovery
Alex Googles "AI agent security monitoring" and lands on opensyber.cloud.

- [ ] Homepage clearly explains what OpenSyber does in the first 3 seconds
- [ ] Hero headline answers "what is this?" without scrolling
- [ ] CTA "Get Started Free" is prominent and clear
- [ ] Scrolling reveals: problem/solution, how it works, pricing
- [ ] No signup required to understand the product
- [ ] Pricing is visible: $0 free tier exists with real features

**Alex's question:** "Is this worth my time?"
**Test:** Does the homepage answer this in under 10 seconds?

### Step 2: Sign Up
Alex clicks "Get Started Free" → sign-up page.

- [ ] Sign-up redirects to sign-in (auto-creates account)
- [ ] Google OAuth is the first button (most developers have Google)
- [ ] One click → Google consent → redirected to dashboard
- [ ] No email verification step (OAuth handles this)
- [ ] Total time from landing to dashboard: under 30 seconds

**Alex's question:** "How fast can I get started?"
**Test:** Time from first click to seeing the dashboard.

### Step 3: First Dashboard Experience
Alex sees the dashboard for the first time.

- [ ] Dashboard doesn't show a blank page — there's guidance
- [ ] Getting Started checklist is visible (not buried)
- [ ] "Deploy Instance" is the clear next action
- [ ] Alex understands what an "instance" is (tooltip or description)
- [ ] The 0/5 progress creates motivation to continue
- [ ] Sidebar navigation makes sense without reading docs

**Alex's question:** "What do I do first?"
**Test:** Is the first action obvious within 5 seconds?

### Step 4: Deploy First Agent
Alex clicks Deploy Instance.

- [ ] Form is simple: name + region (2 fields, not 10)
- [ ] Region options have human-readable labels with city names
- [ ] Deploy button shows loading state during provisioning
- [ ] Status transitions are visible: Provisioning → Running
- [ ] After deploy: dashboard shows the running instance with green badge
- [ ] Getting Started checklist: "Deploy agent" is now checked

**Alex's question:** "Did it work?"
**Test:** Does Alex know the agent is running without checking docs?

### Step 5: Install First Skill
Alex goes to the marketplace to add security scanning.

- [ ] Marketplace is discoverable from sidebar or getting started
- [ ] Skills are organized by category (Security is prominent)
- [ ] "Secret Scanner" is featured and free — Alex clicks Install
- [ ] Installation redirects to configuration wizard
- [ ] Wizard Step 1 (Review): shows permissions — Alex can see what access the skill needs
- [ ] Wizard Step 2 (Configure): no env vars needed for Secret Scanner — "works out of the box"
- [ ] Wizard Step 3 (Connect): shows skill is connected and ready
- [ ] Wizard Step 4 (Activate): success! Skill is running
- [ ] Returning to marketplace: Secret Scanner shows "Installed" badge
- [ ] Getting Started: "Install skill" is now checked

**Alex's question:** "Is my agent actually scanning for secrets now?"
**Test:** Does the configuration wizard give confidence that it's working?

### Step 6: Set Up Alerts
Alex wants to be notified if secrets are found.

- [ ] Navigate to Alert Rules (from sidebar or getting started)
- [ ] "Create Alert Rule" button is visible
- [ ] Form: name the rule, pick event type (credential_access), severity (high), threshold
- [ ] Create → rule appears in table with "Active" badge
- [ ] Getting Started: "Setup alert rule" is now checked

**Alex's question:** "Will I actually get notified?"
**Test:** Is there confirmation that the alert is active and will trigger?

### Step 7: Store a Credential
Alex stores an API key in the vault.

- [ ] Navigate to Settings → Credential Vault section
- [ ] Add secret: key name (OPENAI_API_KEY), value (sk-...)
- [ ] Secret appears in list with masked value
- [ ] Getting Started: "Store credential" is now checked

### Step 8: Review Security Dashboard
Alex checks the security overview.

- [ ] Navigate to /dashboard/security
- [ ] Dashboard shows agent status, skill activity
- [ ] Even without incidents: the "healthy" state is clearly communicated
- [ ] Getting Started: "Review security" can be marked complete

### Step 9: Evaluate Free Tier Limits
After a week, Alex hits the free tier limit (3 skills).

- [ ] Clear message when trying to install 4th skill: "Free plan allows 3 skills. Upgrade to Personal for 10."
- [ ] Link to /pricing from the limit message
- [ ] Pricing page shows what Personal includes vs Free

**Alex's question:** "Is $49/mo worth it for what I'm getting?"
**Test:** Does the upgrade path feel natural, not forced?

### Step 10: Upgrade to Personal
Alex decides to upgrade.

- [ ] Click "Upgrade plan" in Settings or Pricing
- [ ] LemonSqueezy checkout: price clear, email pre-filled
- [ ] Test coupon works (for our testing)
- [ ] After payment: Settings shows "Personal" plan immediately
- [ ] Instance limits updated
- [ ] Alex can now install more skills

---

# PERSONA 2: Jordan — Security Lead at a Startup (Team Plan)

**Who:** Security engineer at a 15-person startup. 3 developers use AI coding agents daily.
**Goal:** Centralized visibility into what AI agents are doing across the team.
**Budget:** Company pays. Needs to justify ROI to CTO.
**Technical level:** High security expertise, moderate frontend skills.

## Journey: Evaluation → Team Setup → Compliance

### Step 1: Evaluation
Jordan was referred by a colleague. Lands on opensyber.cloud.

- [ ] Security-focused messaging resonates (not just "AI hosting")
- [ ] /security page explains threat model (supply chain, credential theft, lateral movement)
- [ ] Enterprise page shows SSO, audit logs, compliance features
- [ ] Blog posts demonstrate domain expertise (kill chain, slopsquatting)
- [ ] Jordan can test free before asking for budget

### Step 2: Team Plan Purchase
After testing free tier, Jordan gets budget approval for Team ($399/mo).

- [ ] Pricing page clearly differentiates Team vs Pro:
  - 5 instances (one per developer)
  - RBAC
  - 1-year audit retention
  - Priority support
- [ ] Checkout works, plan activates
- [ ] Team features unlock in sidebar (lock icons gone)

### Step 3: Invite Team Members
Jordan invites 3 developers.

- [ ] /dashboard/team shows invite form
- [ ] Enter email → invitation sent
- [ ] Invited developer receives email, clicks link
- [ ] New developer signs up via OAuth → joins the org
- [ ] Jordan can see all team members with roles

### Step 4: Deploy Instances for Team
Jordan deploys an instance per developer.

- [ ] Can create 5 instances (Team limit)
- [ ] Each instance has a unique name and region
- [ ] All instances visible in dashboard

### Step 5: Install Skills Across Instances
Jordan installs security skills on all instances.

- [ ] Secret Scanner, Dependency Auditor, Supply Chain Guard on all 5
- [ ] Each installation goes through config wizard
- [ ] Marketplace shows installed status per skill

### Step 6: Configure Alert Channels
Jordan sets up Slack alerts for the security team.

- [ ] /dashboard/agents/alert-channels
- [ ] Add Slack webhook URL
- [ ] Test notification works
- [ ] Alerts route to the right channel

### Step 7: Review Compliance
CTO asks: "Are we SOC 2 ready?"

- [ ] /dashboard/soc2 shows readiness checklist
- [ ] /dashboard/oasf shows framework compliance
- [ ] Evidence collection visible
- [ ] Reports exportable (PDF)

### Step 8: Audit Logs Review
Jordan needs to review last month's activity for a vendor audit.

- [ ] /dashboard/logs with date picker
- [ ] Filter to last 30 days
- [ ] Log entries show: who, what, when, which instance
- [ ] Export or screenshot for audit evidence

### Step 9: Data Residency
Company has EU data requirements.

- [ ] /dashboard/team/residency shows region controls
- [ ] Instances restricted to EU regions

---

# PERSONA 3: Dana — Enterprise Security Architect (Enterprise)

**Who:** CISO at a 500-person company. Evaluating OpenSyber for company-wide deployment.
**Goal:** Centralized AI agent governance with compliance reporting.
**Budget:** Enterprise ($custom). Needs to justify to the board.
**Decision criteria:** SSO, SOC 2, SLA, data residency, audit logs.

## Journey: Evaluation → Contact Sales → POC

### Step 1: Enterprise Evaluation
Dana explores opensyber.cloud/enterprise.

- [ ] Enterprise features clearly listed: SSO, unlimited instances, SLA, data residency
- [ ] Contact Sales form works
- [ ] /security page addresses enterprise concerns
- [ ] /compliance shows standards coverage

### Step 2: Technical Evaluation
Dana's team does a POC with the Pro plan.

- [ ] Sign up, deploy instance, install skills
- [ ] Security dashboard shows real data
- [ ] API docs are comprehensive (/docs/api)
- [ ] Integration with existing tools documented (/docs)

### Step 3: SSO Configuration
After purchase, Dana configures SSO.

- [ ] /dashboard/team/sso shows SAML/OIDC options
- [ ] Configuration fields: provider URL, certificate, client ID
- [ ] Test connection button

---

# PERSONA 4: Morgan — Skill Developer (Marketplace Creator)

**Who:** Independent developer who builds security tools. Wants to publish on the OpenSyber marketplace.
**Goal:** Publish a skill, earn revenue (70/30 split).
**Technical level:** Expert. Expects good developer docs.

## Journey: Discover → Build → Publish → Earn

### Step 1: Discover the Marketplace
Morgan sees the marketplace and thinks "I could build a skill for this."

- [ ] /docs/skills explains how to build a skill
- [ ] Manifest format is documented
- [ ] Permissions model makes sense
- [ ] Revenue share (70/30) is mentioned

### Step 2: Build a Skill
Morgan reads the SDK docs.

- [ ] /docs/skills/audit-methodology explains the review process
- [ ] Manifest schema is documented with examples
- [ ] Permissions are well-defined (network, filesystem, env)

### Step 3: Submit for Review
Morgan submits their skill.

- [ ] /dashboard/skills/submit has a submission form
- [ ] Fields: name, description, category, repository URL
- [ ] Submit → "Pending Review" status

### Step 4: Skill Approved
Admin reviews and approves.

- [ ] /admin/skills shows pending submissions
- [ ] Approve → skill appears in marketplace
- [ ] Morgan's skill shows "Verified" badge

---

# PERSONA 5: Riley — TokenForge Developer (Session Security)

**Who:** Backend developer building a SaaS app. Needs to prevent session hijacking after login.
**Goal:** Add device-bound session security to their Express app.
**Budget:** Free tier initially, Pro ($49/mo) for production.

## Journey: Discover → Integrate → Monitor

### Step 1: Discovery
Riley searches for "session hijacking prevention" and finds TokenForge.

- [ ] tokenforge.opensyber.cloud — hero explains the value prop
- [ ] "Your auth stops at login. We protect everything after."
- [ ] Problem section resonates: AiTM, XSS, session hijacking
- [ ] How it works: script tag + middleware (simple)
- [ ] Trust score concept makes sense (7 signals)

### Step 2: Sign Up & Get API Key
Riley signs up via GitHub.

- [ ] GitHub OAuth → onboarding wizard
- [ ] API key generated and shown (copy once)
- [ ] Script tag pre-filled with key
- [ ] Quick Start shows Express middleware example

### Step 3: Integrate
Riley adds the script tag and server middleware.

- [ ] /dashboard/docs shows code examples
- [ ] Express integration: 3 lines of code
- [ ] First request after integration shows in dashboard
- [ ] Sessions page shows bound device

### Step 4: Monitor
Riley checks the trust scoring.

- [ ] /dashboard shows: sessions, verifications, trust scores
- [ ] Events page shows security events
- [ ] Compliance report available at /dashboard/compliance

### Step 5: Create Alerts
Riley sets up alerts for hijack attempts.

- [ ] /dashboard/alerts — create rule for hijack_attempt
- [ ] Email notification configured
- [ ] Rule active

### Step 6: Upgrade for Production
Riley needs 50K verifications for production.

- [ ] Pricing shows Pro at $49/mo with 50K verifications
- [ ] Checkout with coupon works
- [ ] Plan limits updated

---

# CROSS-CUTTING CONCERNS

## Accessibility
- [ ] All pages keyboard-navigable (Tab through, Enter to activate)
- [ ] Skip-to-content link on homepage
- [ ] Form labels present on all inputs
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader labels on icon buttons (aria-label)

## Performance
- [ ] Homepage loads in under 3 seconds (LCP)
- [ ] Dashboard loads in under 2 seconds
- [ ] No layout shift on page load (CLS < 0.1)
- [ ] Images lazy-loaded

## Error Recovery
- [ ] Network error during deploy → retry option shown
- [ ] API timeout → graceful degradation (data loads partially)
- [ ] Invalid form input → clear error messages
- [ ] 404 pages → helpful navigation back to valid routes

## Data Consistency
- [ ] Same email across providers = same account (Google → GitHub → LinkedIn)
- [ ] Plan changes reflect immediately in UI
- [ ] Skill installations persist across sessions
- [ ] Vault secrets survive page refreshes

---

# RESULTS

| Persona | Journey Steps | Passed | Failed | Notes |
|---------|--------------|--------|--------|-------|
| Alex (Solo Dev) | 10 | | | |
| Jordan (Security Lead) | 9 | | | |
| Dana (Enterprise) | 3 | | | |
| Morgan (Skill Dev) | 4 | | | |
| Riley (TokenForge) | 6 | | | |
| Cross-Cutting | 4 categories | | | |
| **Total** | **~36 journeys** | | | |
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
