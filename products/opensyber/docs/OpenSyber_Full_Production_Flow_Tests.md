# OpenSyber — Full Production Flow Tests

**Environment:** Production (opensyber.cloud)
**API:** api.opensyber.cloud
**Version:** 2.0
**Date:** March 26, 2026
**Auth:** Clerk | **Payments:** LemonSqueezy | **Infra:** Hetzner + Cloudflare

---

## Instructions for Browser Testing

Test each section in order. Mark each checkbox when verified. Use Chrome DevTools (Network tab, Console, Application tab) for API and state verification. For API calls, use DevTools Network tab or `curl` from terminal.

**Test accounts needed:**
- Fresh account (never signed in before)
- Existing Free plan account
- Account with active paid subscription (Personal/Pro/Team)
- Admin account (for admin panel tests)

**Test payment card (LemonSqueezy test mode):**
- Card: `4242 4242 4242 4242`
- Expiry: any future date (e.g., `12/29`)
- CVC: `123`

**Free test coupon (pre-applied via env var):**
Set `NEXT_PUBLIC_LS_TEST_COUPON` in Cloudflare Pages environment to a 100% discount code created in LemonSqueezy dashboard. When set, all checkout URLs will auto-apply the coupon so testers pay $0.
- Create coupon in LemonSqueezy → Discounts → New Discount → 100% off, limited redemptions
- Set env var: `NEXT_PUBLIC_LS_TEST_COUPON=YOUR_COUPON_CODE`
- Remove the env var before going live to disable

---

## Flow 1: Landing Page & Marketing (Anonymous Visitor)

**URL:** https://opensyber.cloud

### 1.1 Homepage Content
- [ ] Page loads without console errors
- [ ] Hero section: headline, subheadline, CTA buttons visible
- [ ] "Get Started Free" button visible and links to /sign-up
- [ ] "Watch Demo" or secondary CTA visible
- [ ] Trust bar: logos or social proof indicators present
- [ ] Problem/solution section renders
- [ ] Demo embed or interactive preview loads
- [ ] Final CTA section at bottom
- [ ] Footer: links to /pricing, /security, /privacy, /terms, /enterprise
- [ ] Footer: copyright 2026 present

### 1.2 Navigation (Anonymous)
- [ ] Header shows "Sign In" and "Get Started" links
- [ ] Click "Sign In" → navigates to /sign-in
- [ ] Click "Get Started" → navigates to /sign-up
- [ ] Logo click → returns to homepage

### 1.3 Pricing Page (Anonymous)
**URL:** https://opensyber.cloud/pricing

- [ ] Page loads with all 5 tiers displayed
- [ ] Free tier: $0, "Get Started Free" button → /sign-up
- [ ] Personal tier: $49/mo, "Start Free Trial" button → /sign-up
- [ ] Pro tier: $149/mo, "Start Free Trial" button, "Most Popular" badge → /sign-up
- [ ] Team tier: $399/mo, "Start Free Trial" button → /sign-up
- [ ] Enterprise section: "Custom" pricing, "Contact Sales" → /enterprise
- [ ] Each tier lists feature bullet points with green checkmarks
- [ ] "Start free forever. Upgrade anytime. No credit card required." footer text

### 1.4 Enterprise Page
**URL:** https://opensyber.cloud/enterprise

- [ ] Page loads with enterprise feature cards
- [ ] Features shown: SSO, Unlimited Instances, SLA Monitoring, Data Residency
- [ ] Contact sales form present with name, email, company fields
- [ ] Form submission works (or shows confirmation)

### 1.5 Security Page
**URL:** https://opensyber.cloud/security

- [ ] Page loads without errors
- [ ] Security features and certifications listed
- [ ] Content describes encryption, compliance, audit logging

### 1.6 Legal Pages
- [ ] /privacy loads with Privacy Policy content
- [ ] /terms loads with Terms of Service content
- [ ] /compliance loads with compliance standards

### 1.7 Blog
- [ ] /blog loads with blog index
- [ ] /blog/introducing-opensyber loads article
- [ ] /blog/why-self-hosted-ai-agents-are-a-security-risk loads article
- [ ] /blog/secure-ai-coding-agents loads article
- [ ] /blog/ai-agent-kill-chain loads article
- [ ] /blog/slopsquatting-npm-attacks loads article

### 1.8 Documentation (Public)
- [ ] /docs loads docs index
- [ ] /docs/getting-started loads quick start guide
- [ ] /docs/api loads API documentation
- [ ] /docs/security loads security docs
- [ ] /docs/agent loads agent deployment docs
- [ ] /docs/faq loads FAQ page
- [ ] /docs/oasf loads OASF compliance docs
- [ ] /docs/skills loads skill building docs
- [ ] /docs/skills/audit-methodology loads audit methodology

---

## Flow 2: Sign Up & Authentication

### 2.1 New User Registration
**URL:** https://opensyber.cloud/sign-up

- [ ] Clerk sign-up form renders correctly
- [ ] Email/password registration works
- [ ] Google OAuth button present and functional
- [ ] GitHub OAuth button present and functional
- [ ] After sign-up, redirects to /dashboard
- [ ] DevTools Network: verify POST to api.opensyber.cloud is NOT visible (SSR calls)
- [ ] Console: no errors on initial dashboard load

### 2.2 Clerk Webhook → User Sync
**Verify via API or Cloudflare logs:**
- [ ] Clerk fires `user.created` webhook to api.opensyber.cloud/api/webhooks/clerk
- [ ] User record created in D1 with plan='free'
- [ ] referralCode generated (format: REF-xxxxxx)
- [ ] trialStartedAt timestamp set
- [ ] Welcome email sent via Resend

### 2.3 Sign In (Existing User)
**URL:** https://opensyber.cloud/sign-in

- [ ] Clerk sign-in form renders
- [ ] Email/password login works
- [ ] OAuth login works
- [ ] Redirects to /dashboard after sign-in
- [ ] Session persists across page refreshes

### 2.4 Sign Out
- [ ] Click user profile menu → Sign Out
- [ ] Redirected to homepage or sign-in
- [ ] Visiting /dashboard redirects to /sign-in
- [ ] API calls from browser return 401 after sign-out

### 2.5 Referral Code Handling
- [ ] Sign up via /sign-up?ref=REF-abc123
- [ ] User record has referredBy='REF-abc123' in D1
- [ ] Referral credit applied to referrer account

---

## Flow 3: Dashboard (Free Plan, No Instance)

### 3.1 Dashboard Overview
**URL:** https://opensyber.cloud/dashboard

- [ ] Dashboard loads without errors
- [ ] Shows "No instances yet" empty state or onboarding prompt
- [ ] "Deploy Instance" button visible
- [ ] Onboarding checklist widget visible (0/5 or 0/6 steps)
- [ ] Plan indicator shows "Free" in sidebar or header

### 3.2 Sidebar Navigation
- [ ] **Home Group:** Dashboard (Overview) link works
- [ ] **Agent Group:** Activity, Skills, Marketplace, Logs, MCP Monitoring, Getting Started, Achievements — all navigate correctly
- [ ] **Security Group:** Dashboard, Vulnerabilities, Alerts, Alert Rules, Incidents, Kill Chain, Threats, Threat Feed, Attack Paths, Network, Files, Supply Chain, Compliance, Uptime — all navigate
- [ ] **Governance Group:** Policies, Rule Engine, Policy Builder, OASF, SOC2, Cloud, Cloud Findings, Assets, SLO Dashboard, SLA, Uptime — all navigate
- [ ] **Team Group (locked):** Members, Settings, SSO, Residency — shows plan-gated lock icon for free plan
- [ ] **Bottom Rail:** Integrations, Settings — both navigate
- [ ] Plan label shows "Unbound" or "Free" at bottom of sidebar
- [ ] Mobile responsive: hamburger menu works on narrow viewport

### 3.3 Getting Started / Onboarding
**URL:** https://opensyber.cloud/dashboard/getting-started

- [ ] Page loads with onboarding checklist
- [ ] Steps listed (deploy agent, install skill, set up alerts, store secret, review security)
- [ ] Integration client guides present
- [ ] CTA links to deploy instance
- [ ] Dismiss checklist option works (PATCH /api/user/onboarding)

### 3.4 Deploy Instance Form
- [ ] Click "Deploy Instance" on dashboard
- [ ] Form opens with fields: Instance Name, Region
- [ ] Name field default: "My Agent", editable
- [ ] Region dropdown: EU Central (Falkenstein), US East (Ashburn), US West (Hillsboro), Asia Pacific (Singapore)
- [ ] Submit form → POST /api/instances (via proxy or SSR)
- [ ] **Plan limit check:** Free plan allows 1 instance

### 3.5 Dashboard Pages (Empty State)
- [ ] /dashboard/agents → empty state
- [ ] /dashboard/skills → empty state ("No skills installed")
- [ ] /dashboard/marketplace → skill cards load from marketplace
- [ ] /dashboard/logs → empty state ("No audit logs")
- [ ] /dashboard/mcp-monitoring → empty state or monitoring UI
- [ ] /dashboard/achievements → empty state or starter achievements

---

## Flow 4: Pricing & Subscription Purchase

### 4.1 Pricing Page (Authenticated)
**URL:** https://opensyber.cloud/pricing (signed in)

- [ ] Page loads with user context
- [ ] Free tier button: shows "Get Started Free" → /dashboard
- [ ] Personal tier button: shows LemonSqueezy checkout URL (NOT "Go to Dashboard")
- [ ] Pro tier button: shows LemonSqueezy checkout URL (NOT "Go to Dashboard")
- [ ] Team tier button: shows LemonSqueezy checkout URL (NOT "Go to Dashboard")
- [ ] Enterprise: "Contact Sales" → /enterprise
- [ ] Inspect checkout URLs in DevTools: verify `checkout[email]` param contains user email
- [ ] Inspect checkout URLs: verify `checkout[custom][user_id]` param contains Clerk user ID
- [ ] Inspect checkout URLs: verify `checkout[redirect_url]` points to /dashboard?payment=success

**If buttons show "Go to Dashboard" instead of checkout URLs:**
- [ ] BLOCKER: LemonSqueezy env vars not set. Verify in Cloudflare Pages:
  - `NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID`
  - `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PERSONAL`
  - `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PRO`
  - `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM`

### 4.2 LemonSqueezy Checkout (Personal Plan — $49/mo)
- [ ] Click Personal plan CTA → redirects to LemonSqueezy hosted checkout
- [ ] Checkout page shows "Personal" plan at $49.00/month
- [ ] If test coupon env var set: discount auto-applied, total shows $0.00
- [ ] If no coupon: enter manually or pay full price with test card
- [ ] Email pre-filled from Clerk session
- [ ] Enter test card: 4242 4242 4242 4242, exp 12/29, CVC 123
- [ ] Submit payment → processing spinner → confirmation screen
- [ ] Redirect back to opensyber.cloud/dashboard?payment=success

### 4.3 Payment Success Handling
- [ ] Dashboard shows PaymentSuccessBanner component ("Welcome to Personal!")
- [ ] Banner auto-dismisses or has close button
- [ ] URL parameter `?payment=success` present

### 4.4 Webhook Processing (subscription_created)
**Verify via Cloudflare Worker logs or API:**
- [ ] LemonSqueezy fires subscription_created webhook
- [ ] Webhook signature (X-Signature) validated with HMAC-SHA256
- [ ] User record updated: plan='personal'
- [ ] lemonSqueezyCustomerId populated
- [ ] lemonSqueezySubscriptionId populated
- [ ] Welcome/upgrade email sent via Resend

### 4.5 Settings Page — Subscription Card
**URL:** https://opensyber.cloud/dashboard/settings

- [ ] Subscription card shows "Personal" plan name
- [ ] Shows $49/mo price
- [ ] Instance Limit: correct for Personal plan
- [ ] Audit Retention: correct days for Personal plan
- [ ] Support level displayed
- [ ] "Upgrade plan →" link visible (links to /pricing)

### 4.6 Plan Upgrade (Personal → Pro)
- [ ] Navigate to /pricing
- [ ] Click Pro plan CTA ($149/mo)
- [ ] LemonSqueezy handles plan change (upgrade checkout or portal)
- [ ] subscription_updated webhook fires
- [ ] User plan updated to 'pro' in D1
- [ ] Settings page shows Pro plan details
- [ ] New limits enforced (more skills, longer audit retention)

### 4.7 Plan Upgrade (Pro → Team)
- [ ] Same flow as 4.6 for Team plan ($399/mo)
- [ ] Team features unlocked: RBAC, team management, 5 instances
- [ ] Sidebar Team group becomes accessible (no more lock icon)

### 4.8 Subscription Cancellation
- [ ] Cancel via LemonSqueezy customer portal
- [ ] subscription_cancelled webhook fires
- [ ] User retains access until billing period ends
- [ ] After expiry: subscription_expired webhook fires
- [ ] Plan reverts to 'free'
- [ ] Extra instances suspended (not deleted)
- [ ] Settings shows "Free" plan with "View plans →" link

### 4.9 Payment Failure
- [ ] Simulate payment failure (expired card in LS portal)
- [ ] subscription_payment_failed webhook fires
- [ ] paymentGraceUntil set to 3 days from now
- [ ] Payment failure email sent via Resend
- [ ] User retains access during grace period
- [ ] After grace period expires without payment: plan downgrades

---

## Flow 5: Instance Deployment & Management

### 5.1 Deploy Instance (Subscribed User)
- [ ] Navigate to /dashboard
- [ ] Click "Deploy Instance"
- [ ] Enter name: "Production Agent"
- [ ] Select region: "US East (Ashburn)"
- [ ] Submit form
- [ ] API validates plan limit (free=1, personal=1, pro=1, team=5)
- [ ] Instance record created in D1 with status='provisioning'
- [ ] Gateway token generated and stored in KV vault
- [ ] UI shows "Provisioning..." status on instance card

### 5.2 Hetzner Provisioning
- [ ] Hetzner API called: POST /v1/servers
- [ ] Server name: opensyber-{instanceId}
- [ ] Server type: plan-appropriate (cx11 for personal, etc.)
- [ ] Location: maps to selected region
- [ ] Server reaches "running" state
- [ ] Instance status updates: provisioning → installing → ready → running
- [ ] Hostname assigned and visible in Settings

### 5.3 Instance Dashboard (Running)
- [ ] Dashboard shows instance card with green "Running" badge
- [ ] Instance name, region, uptime visible
- [ ] Health metrics displayed (CPU, Memory, Disk if available)
- [ ] "Restart" button visible and functional

### 5.4 Instance Settings
**URL:** https://opensyber.cloud/dashboard/settings

- [ ] Instance card shows: Name, Region (human-readable label), Hostname, Gateway Token status, Instance ID
- [ ] Gateway Token: shows "Configured" if hasGatewayToken=true

### 5.5 Credential Vault
- [ ] Vault section visible (only when instance exists)
- [ ] "Add Secret" form: key name + value inputs
- [ ] Submit → secret stored encrypted
- [ ] Secret appears in list with masked value
- [ ] Secrets injected as env vars into agent container

### 5.6 Growth Kit
- [ ] ScorecardShareCard renders with instance ID
- [ ] BadgeEmbed shows embeddable code snippet
- [ ] Copy button works for embed code

### 5.7 Instance Deletion
- [ ] Scroll to Danger Zone (red-bordered section)
- [ ] Click "Delete Instance" button
- [ ] Confirmation dialog appears
- [ ] Confirm → DELETE /api/instances/{id}
- [ ] Hetzner server destroyed
- [ ] Gateway token removed from KV
- [ ] Dashboard returns to "No instances" state
- [ ] Secrets removed from vault

### 5.8 Plan Limit Enforcement
- [ ] On free/personal/pro plan (1 instance limit): after deploying 1, try deploy another
- [ ] API returns error: instance limit reached
- [ ] UI shows "Upgrade to deploy more instances" message
- [ ] Upgrade to Team plan → 5 instance limit → can deploy more

---

## Flow 6: Skill Marketplace

### 6.1 Public Marketplace
**URL:** https://opensyber.cloud/marketplace

- [ ] Marketplace loads with skill cards
- [ ] Category filter buttons: Productivity, Developer, Finance, Communication, Home, Security, Utilities
- [ ] Clicking category filters skill list
- [ ] Search/filter functionality works
- [ ] Each skill card shows: name, description, author, rating, install count

### 6.2 Skill Detail Page
**URL:** https://opensyber.cloud/marketplace/{slug}

- [ ] Skill detail page loads with full description
- [ ] Shows version, author, category, install count
- [ ] "Install" button visible (requires auth + instance)
- [ ] If not authenticated: button prompts sign-in
- [ ] If no instance: shows message to deploy first

### 6.3 Install Skill (Dashboard)
- [ ] Navigate to /dashboard/marketplace
- [ ] Click "Install" on a skill
- [ ] Select target instance from dropdown
- [ ] POST /api/marketplace/install
- [ ] Skill appears in /dashboard/skills with "Active" status
- [ ] Agent receives skill manifest

### 6.4 Submit Skill
**URL:** https://opensyber.cloud/dashboard/skills/submit

- [ ] Skill submission form loads
- [ ] Fields: name, description, category, repository URL
- [ ] Submit → skill enters "Pending Review" state
- [ ] Appears in admin panel at /admin/skills for approval

---

## Flow 7: Security Dashboard

### 7.1 Security Overview
**URL:** https://opensyber.cloud/dashboard/security

- [ ] Security dashboard loads with metrics
- [ ] Trust score, vulnerability count, alert count displayed
- [ ] Threat severity breakdown (critical, high, medium, low)
- [ ] Recent security events listed

### 7.2 Vulnerability Scanner
**URL:** https://opensyber.cloud/dashboard/security/vulnerabilities

- [ ] Vulnerability list loads
- [ ] Each vulnerability: CVE ID, severity, description, affected component
- [ ] Filter by severity works
- [ ] Remediation guidance shown per vulnerability

### 7.3 Alert Rules
**URL:** https://opensyber.cloud/dashboard/security/alert-rules

- [ ] Create alert rule form
- [ ] Condition types available
- [ ] Channel options: email, Slack, webhook, PagerDuty
- [ ] Save rule → appears in list
- [ ] Delete rule works
- [ ] Edit rule works

### 7.4 Security Incidents
**URL:** https://opensyber.cloud/dashboard/security/incidents

- [ ] Incident list loads
- [ ] Each incident: severity, title, status, timestamp
- [ ] Click incident → detail page at /dashboard/security/incidents/{id}
- [ ] Detail page shows full incident timeline, affected resources, remediation steps

### 7.5 Kill Chain Visualization
**URL:** https://opensyber.cloud/dashboard/kill-chain

- [ ] Kill chain page loads
- [ ] Visualization or timeline renders
- [ ] Incident phases mapped to kill chain stages

### 7.6 Attack Paths
**URL:** https://opensyber.cloud/dashboard/attack-paths

- [ ] Attack path analysis loads
- [ ] Graph or list view of attack surfaces
- [ ] Risk scoring per path

### 7.7 Network Monitoring
**URL:** https://opensyber.cloud/dashboard/security/network

- [ ] Network topology or traffic view loads
- [ ] Connection map or flow diagram

### 7.8 File Integrity
**URL:** https://opensyber.cloud/dashboard/security/files

- [ ] File integrity monitoring page loads
- [ ] Changed files listed with timestamps

### 7.9 Supply Chain
**URL:** https://opensyber.cloud/dashboard/security/supply-chain

- [ ] Supply chain analysis page loads
- [ ] Dependency tree or SBOM view

### 7.10 Threat Feed
**URL:** https://opensyber.cloud/dashboard/threat-feed

- [ ] Threat intelligence feed loads
- [ ] Recent threats listed with severity
- [ ] Public threat page at /threats accessible without auth

---

## Flow 8: Governance & Compliance

### 8.1 OASF Compliance
**URL:** https://opensyber.cloud/dashboard/oasf

- [ ] OASF framework compliance dashboard loads
- [ ] Compliance score/percentage displayed
- [ ] Control checklist with pass/fail status

### 8.2 SOC2 Readiness
**URL:** https://opensyber.cloud/dashboard/soc2

- [ ] SOC2 readiness checklist loads
- [ ] Evidence collection status per control
- [ ] Upload evidence functionality

### 8.3 Policy Management
**URL:** https://opensyber.cloud/dashboard/agents/policies

- [ ] Agent security policies page loads
- [ ] Create/edit/delete policies

### 8.4 Rule Engine
**URL:** https://opensyber.cloud/dashboard/rule-engine

- [ ] Rule engine builder loads
- [ ] OASF rule packs available for installation
- [ ] Custom rule creation works

### 8.5 Policy Builder
**URL:** https://opensyber.cloud/dashboard/policies/builder

- [ ] Visual policy composer loads
- [ ] Rule pack installation: load packs from API
- [ ] Save custom rules works
- [ ] Error handling: API failures logged (not silent)

### 8.6 Cloud Security (CSPM)
**URL:** https://opensyber.cloud/dashboard/cloud

- [ ] Cloud security setup page loads
- [ ] Cloud provider options: AWS, Azure, GCP

**URL:** https://opensyber.cloud/dashboard/cloud/setup
- [ ] Credential setup wizard for cloud providers
- [ ] Region and account configuration

**URL:** https://opensyber.cloud/dashboard/cloud/findings
- [ ] Cloud infrastructure findings listed
- [ ] Severity-based filtering

### 8.7 Asset Inventory
**URL:** https://opensyber.cloud/dashboard/assets

- [ ] Asset inventory loads
- [ ] Assets listed with type, status, risk level

### 8.8 SLO Dashboard
**URL:** https://opensyber.cloud/dashboard/slo-dashboard

- [ ] Service Level Objective metrics displayed
- [ ] SLO targets vs actual performance

### 8.9 SLA Monitoring
**URL:** https://opensyber.cloud/dashboard/sla

- [ ] SLA configuration and monitoring page loads

---

## Flow 9: Team Management (Team/Enterprise Plan)

### 9.1 Team Members
**URL:** https://opensyber.cloud/dashboard/team

- [ ] Requires Team or Enterprise plan (free/personal/pro shows lock)
- [ ] Member list with roles (admin, member, viewer)
- [ ] "Invite Member" button

### 9.2 Send Invitation
- [ ] Click "Invite Member"
- [ ] Enter email address
- [ ] Select role
- [ ] Submit → invitation sent via Resend email
- [ ] Invitation appears in pending list

### 9.3 Accept Invitation
**URL:** https://opensyber.cloud/invitations/{token}/accept

- [ ] Invitation acceptance page loads
- [ ] If new user: creates account + joins org
- [ ] If existing user: adds to org
- [ ] Redirect to dashboard with org context

### 9.4 RBAC Enforcement
- [ ] Admin can create/delete instances, manage team
- [ ] Member can view instances, install skills
- [ ] Viewer can only view dashboard (read-only)
- [ ] Unauthorized actions return appropriate error

### 9.5 Team Settings
**URL:** https://opensyber.cloud/dashboard/team/settings

- [ ] Team name, logo, description editable

### 9.6 SSO Configuration
**URL:** https://opensyber.cloud/dashboard/team/sso

- [ ] SAML and OIDC configuration options
- [ ] Provider URL, certificate, client ID/secret fields
- [ ] Test connection button

### 9.7 Data Residency
**URL:** https://opensyber.cloud/dashboard/team/residency

- [ ] Data residency region selection
- [ ] Instance creation restricted to selected regions

---

## Flow 10: Integrations

### 10.1 Integration Catalog
**URL:** https://opensyber.cloud/dashboard/integrations

- [ ] Integration catalog loads with available services
- [ ] Categories or search functionality
- [ ] Each integration shows: name, description, status (connected/not connected)

### 10.2 Connect Integration
**URL:** https://opensyber.cloud/dashboard/integrations/{slug}

- [ ] Integration setup form loads
- [ ] Credential input fields (API key, webhook URL, etc.)
- [ ] Test connection button
- [ ] Save → integration appears as "Connected"

### 10.3 Integration Health
**URL:** https://opensyber.cloud/dashboard/integrations/health

- [ ] Health status for all connected integrations
- [ ] Green/red indicators
- [ ] Last check timestamp
- [ ] Error details for failing integrations

---

## Flow 11: Settings & API Keys

### 11.1 Settings Page
**URL:** https://opensyber.cloud/dashboard/settings

- [ ] Subscription card (covered in Flow 4.5)
- [ ] Instance card (covered in Flow 5.4)
- [ ] Growth Kit (covered in Flow 5.6)
- [ ] Credential Vault (covered in Flow 5.5)
- [ ] Referral section with referral code and share link
- [ ] Danger Zone with delete instance (covered in Flow 5.7)

### 11.2 API Keys
**URL:** https://opensyber.cloud/dashboard/settings/api-keys

- [ ] API key list loads
- [ ] "Generate New Key" button
- [ ] Generate → key shown once, copy to clipboard
- [ ] Key appears in list with masked value
- [ ] Revoke key → confirms → key deactivated

### 11.3 Notification Preferences
**URL:** https://opensyber.cloud/dashboard/settings/notifications

- [ ] Notification channel preferences
- [ ] Email, Slack, webhook toggle options
- [ ] Save preferences

---

## Flow 12: Admin Panel (Admin Users Only)

### 12.1 Admin Dashboard
**URL:** https://opensyber.cloud/admin

- [ ] Admin dashboard loads (requires admin role)
- [ ] Platform-wide metrics: total users, instances, revenue

### 12.2 User Management
**URL:** https://opensyber.cloud/admin/users

- [ ] User list with search/filter
- [ ] Click user → /admin/users/{id} detail page
- [ ] Can view user plan, instances, activity

### 12.3 Organization Management
**URL:** https://opensyber.cloud/admin/organizations

- [ ] Organization list
- [ ] Member counts, plan details per org

### 12.4 Instance Management
**URL:** https://opensyber.cloud/admin/instances

- [ ] All instances across all users
- [ ] Status, region, uptime visible
- [ ] Admin actions available

### 12.5 Skill Approval
**URL:** https://opensyber.cloud/admin/skills

- [ ] Pending skill submissions listed
- [ ] Approve/reject actions
- [ ] Approved skills appear in marketplace

### 12.6 Event Logs
**URL:** https://opensyber.cloud/admin/events

- [ ] System-wide event log
- [ ] Filterable by type, user, date

### 12.7 Billing Analytics
**URL:** https://opensyber.cloud/admin/billing

- [ ] MRR calculation displayed
- [ ] Subscriber counts per plan
- [ ] Recent subscriptions list

### 12.8 Platform Metrics
**URL:** https://opensyber.cloud/admin/metrics

- [ ] Dataroom metrics
- [ ] Usage analytics, growth trends

---

## Flow 13: Public Pages & Trust

### 13.1 Trust Page
**URL:** https://opensyber.cloud/trust/{id}

- [ ] No auth required
- [ ] Trust attribution tracking (trust_* query params preserved)
- [ ] Instance security posture displayed

### 13.2 Score Page
**URL:** https://opensyber.cloud/score/{id}

- [ ] No auth required
- [ ] Security score visualization

### 13.3 Achievement Badges
**URL:** https://opensyber.cloud/achievements/{instanceId}/{slug}

- [ ] No auth required
- [ ] Badge details and criteria displayed
- [ ] Social sharing meta tags (og:image, og:title)

### 13.4 Demo Page
**URL:** https://opensyber.cloud/demo

- [ ] Interactive demo loads
- [ ] EventsTab, NetworkTab, OverviewTab functional
- [ ] No auth required

---

## Flow 14: API Health & Security Verification

### 14.1 API Health Check
```
curl https://api.opensyber.cloud/
```
- [ ] Returns 200 with `{"name":"OpenSyber API","version":"0.3.0","docs":"..."}`

### 14.2 Auth Enforcement
```
curl https://api.opensyber.cloud/api/user
```
- [ ] Returns 401: `{"error":"Unauthorized","message":"Missing or invalid authorization header"}`

### 14.3 Webhook Endpoints
```
curl https://api.opensyber.cloud/api/webhooks/lemonsqueezy
```
- [ ] Returns 401 for GET (webhooks are POST with HMAC)

```
curl https://api.opensyber.cloud/api/webhooks/clerk
```
- [ ] Returns error for GET (webhooks are POST with Svix signature)

### 14.4 Security Headers
```
curl -I https://api.opensyber.cloud/
```
- [ ] x-content-type-options: nosniff
- [ ] strict-transport-security present
- [ ] CORS headers restrict to opensyber.cloud origins

### 14.5 Rate Limiting
- [ ] Rapid requests to protected endpoints trigger rate limiter
- [ ] Rate limit headers present (ratelimit-limit, ratelimit-remaining)

### 14.6 CORS Validation
- [ ] Requests from https://opensyber.cloud → allowed
- [ ] Requests from https://www.opensyber.cloud → allowed
- [ ] Requests from https://evil.com → blocked (no access-control-allow-origin)

---

## Flow 15: Mobile Responsiveness

### 15.1 Mobile Navigation
- [ ] Homepage renders on mobile viewport (375px width)
- [ ] Hamburger menu opens/closes
- [ ] All nav links accessible
- [ ] Pricing cards stack vertically

### 15.2 Dashboard Mobile
- [ ] Dashboard accessible on mobile
- [ ] Sidebar collapses to bottom tab bar
- [ ] Instance cards readable on small screens
- [ ] Forms (deploy, settings) usable on mobile

---

## Flow 16: Error Handling & Edge Cases

### 16.1 Network Failures
- [ ] API timeout: graceful error message (not blank page)
- [ ] 500 errors: user-friendly message displayed
- [ ] Settings page: "Unable to load subscription details" fallback works

### 16.2 Plan Boundaries
- [ ] Free user tries accessing Team features → plan gate shown
- [ ] Expired subscription → graceful downgrade
- [ ] Instance limit exceeded → clear error message

### 16.3 Concurrent Actions
- [ ] Double-click deploy button → only one instance created
- [ ] Multiple tab sessions → consistent state

### 16.4 Browser Compatibility
- [ ] Chrome: full functionality
- [ ] Safari: full functionality
- [ ] Firefox: full functionality
- [ ] Edge: full functionality

---

## Test Summary

| Flow | Section | Total Checks |
|------|---------|-------------|
| 1 | Landing & Marketing | ~30 |
| 2 | Sign Up & Auth | ~15 |
| 3 | Dashboard (Free) | ~35 |
| 4 | Pricing & Payments | ~35 |
| 5 | Instance Management | ~30 |
| 6 | Skill Marketplace | ~15 |
| 7 | Security Dashboard | ~25 |
| 8 | Governance & Compliance | ~25 |
| 9 | Team Management | ~15 |
| 10 | Integrations | ~10 |
| 11 | Settings & API Keys | ~10 |
| 12 | Admin Panel | ~20 |
| 13 | Public Pages | ~10 |
| 14 | API Security | ~15 |
| 15 | Mobile | ~10 |
| 16 | Edge Cases | ~10 |
| **TOTAL** | | **~310** |

---

## Known Issues (as of March 26, 2026)

| # | Issue | Severity | Root Cause | Fix Status |
|---|-------|----------|-----------|------------|
| 1 | Paid plan buttons → /dashboard instead of checkout | BLOCKER | LS env vars not set in Cloudflare Pages | Needs deploy config |
| 2 | User not found on deploy (500) | BLOCKER | Clerk webhook not syncing users to D1 | Needs webhook config |
| 3 | "Unable to load subscription details" in Settings | HIGH | API call fails silently on SSR | Fixed: Promise.allSettled + error logging |
| 4 | Free tier CTA showed "Start Free" | LOW | plans.ts had wrong text | Fixed: now "Get Started Free" |
| 5 | Silent API failures across 16 pages | MEDIUM | catch {} swallowed errors | Fixed: console.error with page labels |

---

## Execution Sign-Off

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Total Passed | /310 |
| Total Failed | |
| Total Blocked | |
| Total Skipped | |
| Blockers Remaining | |
| Sign-Off | |

**Notes:**
