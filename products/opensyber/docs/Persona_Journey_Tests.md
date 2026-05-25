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
