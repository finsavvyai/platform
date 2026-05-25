# Claude Chrome Extension — Full Production Flow Tests

**Purpose:** Step-by-step browser test instructions for Claude to execute via Chrome extension.
**Products:** OpenSyber (opensyber.cloud) + TokenForge (tokenforge.opensyber.cloud)
**Date:** March 27, 2026
**Auth:** Auth.js (Google, GitHub, Microsoft, LinkedIn)
**Payments:** LemonSqueezy with test coupon

---

## Pre-Test Setup

Before starting, ensure:
- Chrome browser with DevTools accessible
- Test coupon code: `A3OTE0NW` (100% off, pre-applied in checkout URLs)
- Test card: `4242 4242 4242 4242`, exp `12/29`, CVC `123`
- All 4 apps deployed: opensyber.cloud, api.opensyber.cloud, tokenforge.opensyber.cloud, tokenforge-api.opensyber.cloud

---

# PART 1: OPENSYBER — AUTH & PROFILE

---

## Test 1: Sign-In Page (Auth.js)

**Navigate to:** `https://opensyber.cloud/sign-in`

- [ ] Page loads with branded left panel: "WELCOME BACK"
- [ ] Left panel: 3 feature bullets (Real-time security monitoring, Live threat intelligence, Verified skill marketplace)
- [ ] Right panel: "Sign in to OpenSyber" heading
- [ ] 4 OAuth buttons in order: Google (white), GitHub (dark), Microsoft (blue), LinkedIn (blue)
- [ ] "No account? Sign in above — we'll create one automatically."
- [ ] NO Clerk branding, NO Clerk components
- [ ] Console: no errors

**Screenshot:** Sign-in page with 4 OAuth buttons

---

## Test 2: Google Sign-In Flow

- [ ] Click "Continue with Google"
- [ ] Google OAuth consent screen appears
- [ ] After auth → redirects to `/dashboard`
- [ ] Dashboard loads without errors
- [ ] Sidebar shows user avatar (Google profile photo)
- [ ] Sidebar shows user name
- [ ] Sidebar shows user email
- [ ] Plan section shows current plan

**Screenshot:** Dashboard with Google avatar in sidebar

---

## Test 3: Profile Page

**Navigate to:** `https://opensyber.cloud/dashboard/profile`

- [ ] Profile card: avatar (from Google), name, email
- [ ] "Signed in via google" label
- [ ] Account Details section: Plan, Member Since, User ID, Referral Code
- [ ] Connected Accounts section:
  - [ ] Google: shows green "Connected" badge
  - [ ] GitHub: shows "Connect" button
  - [ ] Microsoft: shows "Connect" button
  - [ ] LinkedIn: shows "Connect" button
- [ ] Sign Out section: red "Sign Out" button at bottom

**Screenshot:** Full profile page

---

## Test 4: Account Linking

- [ ] On profile page, click "Connect" on GitHub
- [ ] GitHub OAuth flow completes
- [ ] Redirects back to `/dashboard/profile`
- [ ] GitHub now shows "Connected"
- [ ] Google still shows "Connected"

---

## Test 5: Sidebar Navigation (All Pages)

**Navigate to:** `https://opensyber.cloud/dashboard`

**Verify sidebar has these items and click each:**
- [ ] Dashboard (Overview)
- [ ] Profile (bottom rail — new)
- [ ] Settings (bottom rail)
- [ ] Integrations (bottom rail)

**Agent group:**
- [ ] Agents → `/dashboard/agents`
- [ ] Skills → `/dashboard/skills`
- [ ] Marketplace → `/dashboard/marketplace`
- [ ] Logs → `/dashboard/logs`
- [ ] MCP Monitoring → `/dashboard/mcp-monitoring`
- [ ] Getting Started → `/dashboard/getting-started`
- [ ] Achievements → `/dashboard/achievements`

**Security group:**
- [ ] Security → `/dashboard/security`
- [ ] Vulnerabilities → `/dashboard/security/vulnerabilities`
- [ ] Alerts → `/dashboard/security/alerts`
- [ ] Alert Rules → `/dashboard/security/alert-rules`
- [ ] Incidents → `/dashboard/security/incidents`
- [ ] Kill Chain → `/dashboard/kill-chain`
- [ ] Threat Feed → `/dashboard/threat-feed`
- [ ] Attack Paths → `/dashboard/attack-paths`

**Governance group:**
- [ ] OASF → `/dashboard/oasf`
- [ ] SOC2 → `/dashboard/soc2`
- [ ] Rule Engine → `/dashboard/rule-engine`
- [ ] Cloud → `/dashboard/cloud`
- [ ] Assets → `/dashboard/assets`
- [ ] SLO Dashboard → `/dashboard/slo-dashboard`

**Team group (may show lock for free plan):**
- [ ] Team → `/dashboard/team`

---

# PART 2: OPENSYBER — PRICING & PAYMENTS

---

## Test 6: Landing Page

**Navigate to:** `https://opensyber.cloud`

- [ ] Hero section with headline and CTAs
- [ ] "Get Started Free" or "Go to Dashboard" button (depends on auth state)
- [ ] Scroll: trust bar, problem/solution, demo embed, social proof
- [ ] Footer: /pricing, /security, /privacy, /terms links
- [ ] Copyright 2026

**Screenshot:** Homepage

---

## Test 7: Pricing Page (Authenticated)

**Navigate to:** `https://opensyber.cloud/pricing`

- [ ] 5 tiers: Free ($0), Personal ($49), Pro ($149), Team ($399), Enterprise (Custom)
- [ ] Free button: "Get Started Free" → `/dashboard`
- [ ] Personal button: links to `finsavvy.lemonsqueezy.com` checkout
- [ ] Pro button: links to `finsavvy.lemonsqueezy.com` checkout (Most Popular badge)
- [ ] Team button: links to `finsavvy.lemonsqueezy.com` checkout
- [ ] Enterprise: "Contact Sales" → `/enterprise`

**Inspect any paid plan button href:**
- [ ] Contains `checkout[custom][user_id]` (your user ID)
- [ ] Contains `checkout[email]` (your email)
- [ ] Contains `checkout[redirect_url]` → `/dashboard?payment=success`
- [ ] Contains `checkout[discount_code]=A3OTE0NW` (test coupon)

**Screenshot:** Pricing page with inspected checkout URL

---

## Test 8: LemonSqueezy Checkout

- [ ] Click Personal plan ($49/mo) button
- [ ] LemonSqueezy checkout page loads
- [ ] Shows "OpenSyber" product
- [ ] Coupon A3OTE0NW pre-applied → total $0.00
- [ ] Email pre-filled
- [ ] Enter test card: `4242 4242 4242 4242`, exp `12/29`, CVC `123`
- [ ] Submit → success screen
- [ ] Redirects to `opensyber.cloud/dashboard?payment=success`

**Screenshot:** Checkout with $0.00 total

---

## Test 9: Post-Payment Verification

**Navigate to:** `https://opensyber.cloud/dashboard/settings`

- [ ] Subscription card shows "Personal" plan
- [ ] Shows $49/mo price
- [ ] Instance Limit displayed
- [ ] Audit Retention days displayed
- [ ] "Upgrade plan →" link visible

---

# PART 3: OPENSYBER — AGENT DEPLOYMENT

---

## Test 10: Deploy Instance

**Navigate to:** `https://opensyber.cloud/dashboard`

- [ ] "Deploy Instance" button visible
- [ ] Click it → form opens
- [ ] Name field: default "My Agent", editable
- [ ] Region dropdown: EU Central, US East, US West, Asia Pacific (4 options)
- [ ] Enter name: "Test Agent"
- [ ] Select region: "US East (Ashburn)"
- [ ] Submit form

**After submission:**
- [ ] Instance card appears with "Provisioning..." status
- [ ] Status transitions to "Running" (wait 30-60 seconds)
- [ ] Green "Running" badge visible

**Screenshot:** Instance running

---

## Test 11: Instance Settings

**Navigate to:** `https://opensyber.cloud/dashboard/settings`

- [ ] Instance card: Name, Region (human label), Hostname, Gateway Token status, Instance ID
- [ ] Gateway Token: "Configured"

---

## Test 12: Credential Vault

- [ ] Vault section visible (only with instance)
- [ ] Add secret: key `TEST_KEY`, value `test-value-123`
- [ ] Secret appears in list (masked)

---

## Test 13: Growth Kit

- [ ] ScorecardShareCard renders with instance data
- [ ] BadgeEmbed shows embeddable code
- [ ] Copy button works

---

## Test 14: Install Skill

**Navigate to:** `https://opensyber.cloud/dashboard/marketplace`

- [ ] Skill cards load
- [ ] Click a skill → detail page
- [ ] "Install" button visible
- [ ] Click Install → select instance → confirm
- [ ] Navigate to `/dashboard/skills` → installed skill visible

---

## Test 15: Security Dashboard

**Navigate to:** `https://opensyber.cloud/dashboard/security`

- [ ] Dashboard loads (metrics or empty state)
- [ ] `/dashboard/security/vulnerabilities` → loads
- [ ] `/dashboard/security/alerts` → loads
- [ ] `/dashboard/security/incidents` → loads

---

## Test 16: Getting Started Checklist

**Navigate to:** `https://opensyber.cloud/dashboard/getting-started`

- [ ] Onboarding checklist renders
- [ ] "Deploy agent" step checked (if deployed)
- [ ] Integration guides visible

---

# PART 4: OPENSYBER — PUBLIC PAGES

---

## Test 17: Public Pages Load

- [ ] `https://opensyber.cloud/pricing` → 5 tiers
- [ ] `https://opensyber.cloud/enterprise` → feature cards + contact form
- [ ] `https://opensyber.cloud/security` → security page
- [ ] `https://opensyber.cloud/privacy` → privacy policy
- [ ] `https://opensyber.cloud/terms` → terms of service
- [ ] `https://opensyber.cloud/compliance` → compliance
- [ ] `https://opensyber.cloud/docs` → docs index
- [ ] `https://opensyber.cloud/docs/getting-started` → quick start
- [ ] `https://opensyber.cloud/docs/api` → API docs
- [ ] `https://opensyber.cloud/blog` → blog index
- [ ] `https://opensyber.cloud/marketplace` → skill marketplace
- [ ] `https://opensyber.cloud/demo` → interactive demo

---

## Test 18: Marketplace

- [ ] Category filter tabs: All, Productivity, Developer, Finance, etc.
- [ ] Clicking category filters the skill list
- [ ] Click skill → detail page with name, description, install button

---

# PART 5: OPENSYBER — API HEALTH

---

## Test 19: API Endpoints

```bash
curl https://api.opensyber.cloud/
```
- [ ] Returns `{"name":"OpenSyber API","version":"0.3.0"}`

```bash
curl https://api.opensyber.cloud/api/user
```
- [ ] Returns 401 `{"error":"Unauthorized"}`

```bash
curl -X POST https://api.opensyber.cloud/webhooks/lemonsqueezy -H "Content-Type: application/json" -d '{}'
```
- [ ] Returns 401 "Missing signature"

```bash
curl -X POST https://api.opensyber.cloud/webhooks/clerk -H "Content-Type: application/json" -d '{}'
```
- [ ] Returns error (webhook removed — should be 404 or route not found)

---

# PART 6: TOKENFORGE

---

## Test 20: TokenForge Landing

**Navigate to:** `https://tokenforge.opensyber.cloud`

- [ ] Hero: "Your auth stops at login. We protect everything after."
- [ ] "Get Started Free" → `/sign-in`
- [ ] Problem section: 3 threat cards
- [ ] How It Works: 3 steps
- [ ] Trust Score: 7 signals
- [ ] Code Examples: "Two Lines. That's It."
- [ ] Frameworks: 4 categories
- [ ] Comparison table
- [ ] Pricing: Free $0, Pro $49, Team $199, Enterprise Custom
- [ ] FAQ: 16 questions, expand/collapse
- [ ] Footer: copyright 2026

**Screenshot:** TokenForge landing hero

---

## Test 21: TokenForge Pricing with Checkout

- [ ] Pro button → LemonSqueezy checkout URL with `discount_code=A3OTE0NW`
- [ ] Team button → LemonSqueezy checkout URL
- [ ] Enterprise → `mailto:sales@opensyber.cloud`

---

## Test 22: TokenForge Sign-In

**Navigate to:** `https://tokenforge.opensyber.cloud/sign-in`

- [ ] Google + GitHub buttons
- [ ] Branded panel
- [ ] Sign in → redirects to dashboard

---

## Test 23: TokenForge Dashboard

**Navigate to:** `https://tokenforge.opensyber.cloud/dashboard`

- [ ] Dashboard loads (stats or empty state)
- [ ] Sidebar: Overview, Sessions, Events, Alerts, Zero-Code Proxy, Compliance, Settings, Quick Start
- [ ] All nav items work

---

## Test 24: TokenForge Sessions & Events

- [ ] `/dashboard/sessions` → table or empty state
- [ ] `/dashboard/events` → event feed or empty state
- [ ] `/dashboard/alerts` → alert rule form with 5 conditions

---

## Test 25: TokenForge Settings

**Navigate to:** `https://tokenforge.opensyber.cloud/dashboard/settings`

- [ ] API Keys listed with eye toggle, copy, delete
- [ ] "Generate New Key" button
- [ ] Webhooks section
- [ ] Trust Badge section

---

## Test 26: TokenForge API

```bash
curl https://tokenforge-api.opensyber.cloud/health
```
- [ ] `{"status":"healthy"}`

```bash
curl https://tokenforge-api.opensyber.cloud/
```
- [ ] API info with name + version

```bash
curl https://tokenforge-api.opensyber.cloud/sdk.js
```
- [ ] JavaScript loads (>1KB)

```bash
curl https://tokenforge-api.opensyber.cloud/badge.js
```
- [ ] Contains "Protected by TokenForge"

```bash
curl https://tokenforge-api.opensyber.cloud/v1/sessions
```
- [ ] 401 unauthorized

```bash
curl -X POST https://tokenforge-api.opensyber.cloud/webhooks/lemonsqueezy -d '{}'
```
- [ ] 400 "missing_signature"

---

## Test 27: TokenForge Docs

- [ ] `/docs` → 3 integration paths
- [ ] `/docs/integrations` → 7 frameworks
- [ ] `/docs/integrations/native` → 6 SDKs (Swift, Kotlin, React Native, Python, Go, MCP)
- [ ] `/docs/siem` → SIEM platforms
- [ ] `/blog` → blog index
- [ ] `/dashboard/docs` → Quick Start with API key

---

## Test 28: TokenForge Security Headers

```bash
curl -I https://tokenforge-api.opensyber.cloud/
```
- [ ] `x-content-type-options: nosniff`
- [ ] `x-frame-options: DENY`
- [ ] `strict-transport-security` present
- [ ] `ratelimit-limit` present

---

# PART 7: CROSS-PRODUCT

---

## Test 29: Mobile Responsiveness

**Resize to 375px width:**
- [ ] opensyber.cloud → hamburger menu, stacked layout
- [ ] opensyber.cloud/pricing → cards stack vertically
- [ ] opensyber.cloud/dashboard → bottom tab bar
- [ ] tokenforge.opensyber.cloud → responsive hero

---

## Test 30: Error Handling

- [ ] `opensyber.cloud/nonexistent` → 404 page
- [ ] `tokenforge.opensyber.cloud/nonexistent` → 404 page
- [ ] `api.opensyber.cloud/nonexistent` → JSON 404

---

## Test 31: Sign Out & Auth Enforcement

- [ ] Sign out from `/dashboard/profile`
- [ ] Redirected to homepage
- [ ] `/dashboard` → redirected to `/sign-in`
- [ ] `/admin` → redirected to `/sign-in`
- [ ] `/dashboard/settings` → redirected to `/sign-in`

---

## Test 32: Instance Cleanup

**Only after all testing is complete:**
- [ ] Navigate to `/dashboard/settings`
- [ ] Danger Zone → Delete Instance → Confirm
- [ ] Instance removed
- [ ] Cancel test subscription in LemonSqueezy dashboard

---

# TEST RESULTS SUMMARY

| # | Test | Product | Result | Notes |
|---|------|---------|--------|-------|
| 1 | Sign-In Page (4 OAuth) | OpenSyber | | |
| 2 | Google Sign-In | OpenSyber | | |
| 3 | Profile Page | OpenSyber | | |
| 4 | Account Linking | OpenSyber | | |
| 5 | Sidebar Navigation | OpenSyber | | |
| 6 | Landing Page | OpenSyber | | |
| 7 | Pricing + Checkout URLs | OpenSyber | | |
| 8 | LemonSqueezy Checkout | OpenSyber | | |
| 9 | Post-Payment | OpenSyber | | |
| 10 | Deploy Instance | OpenSyber | | |
| 11 | Instance Settings | OpenSyber | | |
| 12 | Credential Vault | OpenSyber | | |
| 13 | Growth Kit | OpenSyber | | |
| 14 | Install Skill | OpenSyber | | |
| 15 | Security Dashboard | OpenSyber | | |
| 16 | Getting Started | OpenSyber | | |
| 17 | Public Pages (12) | OpenSyber | | |
| 18 | Marketplace | OpenSyber | | |
| 19 | API Health | OpenSyber | | |
| 20 | Landing Page | TokenForge | | |
| 21 | Pricing + Checkout | TokenForge | | |
| 22 | Sign-In | TokenForge | | |
| 23 | Dashboard | TokenForge | | |
| 24 | Sessions & Events | TokenForge | | |
| 25 | Settings & API Keys | TokenForge | | |
| 26 | API Endpoints | TokenForge | | |
| 27 | Docs (6 pages) | TokenForge | | |
| 28 | Security Headers | TokenForge | | |
| 29 | Mobile Responsiveness | Both | | |
| 30 | Error Handling | Both | | |
| 31 | Sign Out & Auth | Both | | |
| 32 | Cleanup | Both | | |

**Total:** 32 test sections, ~200+ individual checks

---

## Instructions for Claude Chrome Extension

1. Execute tests in order (auth first, then features)
2. Take screenshots at every marked point
3. Check DevTools Console on every page load — flag any errors
4. For payment test (8): user must enter card details manually
5. For deploy test (10): triggers real Hetzner server — delete after testing
6. Report PASS/FAIL/SKIP with notes for each test
