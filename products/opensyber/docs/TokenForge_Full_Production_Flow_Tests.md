# TokenForge — Full Production Flow Tests

**Environment:** Production
**Site:** https://tokenforge.opensyber.cloud
**API:** https://tokenforge-api.opensyber.cloud
**Version:** 2.0
**Date:** March 26, 2026
**Auth:** NextAuth.js (Google + GitHub OAuth)
**Payments:** LemonSqueezy

---

## Instructions for Browser Testing

Test each section in order. Mark each checkbox when verified. Use Chrome DevTools (Network, Console, Application tabs) throughout. For API tests, use `curl` or DevTools.

**Test accounts needed:**
- Fresh Google account (never signed in)
- Fresh GitHub account (never signed in)
- Existing TokenForge account (free plan)
- Account with Pro subscription
- Account with Team subscription

**Test payment card (LemonSqueezy test mode):**
- Card: `4242 4242 4242 4242`
- Expiry: any future date (e.g., `12/29`)
- CVC: `123`

**Free test coupon (pre-applied via env var):**
Set `NEXT_PUBLIC_LS_TEST_COUPON` in Cloudflare Pages environment to a 100% discount code. When set, all checkout URLs auto-apply the coupon so testers pay $0.
- Create coupon in LemonSqueezy → Discounts → New Discount → 100% off, limited redemptions
- Set env var: `NEXT_PUBLIC_LS_TEST_COUPON=YOUR_COUPON_CODE`
- Legacy manual code: `A3OTE0NW` (if still active — apply manually at checkout if env var not set)
- Remove the env var before going live to disable

---

## Flow 1: Landing Page (Anonymous Visitor)

**URL:** https://tokenforge.opensyber.cloud

### 1.1 Hero Section
- [ ] Page loads without console errors
- [ ] Hero headline: "Your auth stops at login. We protect everything after."
- [ ] Hero code preview shows obfuscated script tag (not readable source)
- [ ] "Get Started Free" button → navigates to /sign-in
- [ ] "Read the Docs" button → navigates to /docs

### 1.2 Problem Section
- [ ] 3 threat cards visible: AiTM (Adversary-in-the-Middle), XSS Token Theft, Session Hijacking
- [ ] Each card has icon, title, description

### 1.3 How It Works
- [ ] 3 steps displayed: Add Script Tag → Add Server Middleware → Monitor
- [ ] Each step has numbered indicator and description

### 1.4 Trust Score Section
- [ ] 7 trust signals listed with weights
- [ ] Trust score thresholds: 80-100 (Allow), 40-79 (Step-Up), 0-39 (Block)
- [ ] Visual indicator or gauge for thresholds

### 1.5 Code Examples
- [ ] Title: "Two Lines. That's It."
- [ ] Client-side script tag example shown
- [ ] Server-side middleware example shown
- [ ] Copy buttons work on code blocks

### 1.6 Framework Support
- [ ] 4 categories: Web Frameworks, Mobile, AI Agents, Zero Code
- [ ] Frameworks listed per category (React, Angular, Vue, Swift, Kotlin, Python, Go, etc.)

### 1.7 Comparison Table
- [ ] TokenForge vs Google DBSC vs Cookie-based vs Fingerprinting
- [ ] Feature rows comparing capabilities
- [ ] TokenForge column highlighted as winner

### 1.8 Pricing Section
- [ ] Free: $0/month — 1K verifications/mo, 100 sessions
- [ ] Pro: $49/month — 50K verifications/mo, 5K sessions, step-up auth
- [ ] Team: $199/month — 250K verifications/mo, 25K sessions, SSO, proxy
- [ ] Enterprise: Custom — unlimited, SOC2 reports, dedicated support
- [ ] Free → "Get Started Free" button → /sign-in
- [ ] Pro → LemonSqueezy checkout link (verify URL has variant ID)
- [ ] Team → LemonSqueezy checkout link
- [ ] Enterprise → mailto:sales@opensyber.cloud

### 1.9 FAQ Section
- [ ] 16 FAQ questions listed
- [ ] All expand/collapse on click
- [ ] "Does TokenForge block attacks or just alert?" → answer says BOTH
- [ ] "Can I forward to SIEM?" → mentions CEF + 6 platforms (Splunk, Sentinel, Elastic, Datadog, Trellix, Cyrebro)
- [ ] "Does it work with mobile?" → iOS/Android/React Native SDKs mentioned
- [ ] "Can AI agents use it?" → Python/Go/MCP mentioned
- [ ] "Works behind VPN?" → yes

### 1.10 Footer
- [ ] Copyright 2026
- [ ] Links: Pricing, Quick Start, SDKs, Blog
- [ ] All links navigate correctly

---

## Flow 2: Authentication & Onboarding

### 2.1 Sign In Page
**URL:** https://tokenforge.opensyber.cloud/sign-in

- [ ] Page loads without errors
- [ ] "Continue with Google" button with Google logo
- [ ] "Continue with GitHub" button with GitHub logo
- [ ] Branded left panel with TokenForge messaging
- [ ] "No account? Sign in above — we'll create one automatically."

### 2.2 Google OAuth Sign-Up (New User)
- [ ] Click "Continue with Google"
- [ ] Redirects to Google OAuth consent screen
- [ ] Authorize → redirects back to TokenForge
- [ ] Calls POST /public/provision (idempotent)
- [ ] Creates tenant + first API key in D1
- [ ] Redirects to /dashboard/onboarding

### 2.3 GitHub OAuth Sign-Up (New User)
- [ ] Click "Continue with GitHub"
- [ ] Redirects to GitHub OAuth screen
- [ ] Authorize → redirects back to TokenForge
- [ ] Same provision flow as Google
- [ ] Redirects to /dashboard/onboarding

### 2.4 Returning User Sign-In
- [ ] Sign in with existing account
- [ ] POST /public/provision returns `existing: true`
- [ ] Redirects to /dashboard (not onboarding)
- [ ] All previous data intact

### 2.5 Onboarding Wizard
**URL:** https://tokenforge.opensyber.cloud/dashboard/onboarding

- [ ] Progress bar: 3 steps (Get Key → Copy Key → Add Script)
- [ ] Step labels visible under each circle
- [ ] Step 1: "Create your API key — One click. Free."
- [ ] Click "Generate API Key" → calls /public/provision
- [ ] Step 2: Shows API key with eye toggle (hidden by default)
- [ ] Click eye icon → reveals key (starts with `tf_`)
- [ ] Click copy → copies full key to clipboard
- [ ] "Where will you use this key?" domain input field
- [ ] Auto-suggests current hostname
- [ ] Click "Next" → Step 3
- [ ] Step 3: Shows pre-filled script tag with the generated API key embedded
- [ ] Copy button for script tag works
- [ ] "Done — Go to Dashboard" button → loads main dashboard

### 2.6 Sign Out
- [ ] Click user menu at bottom of sidebar
- [ ] Click "Sign out"
- [ ] Redirected to landing page
- [ ] Visit /dashboard → redirected to /sign-in

### 2.7 Re-Sign In
- [ ] Sign in again → dashboard loads (not onboarding, if key exists)
- [ ] All previous data and settings preserved
- [ ] Session cookie set correctly

---

## Flow 3: Dashboard (Data Present)

### 3.1 Dashboard Overview
**URL:** https://tokenforge.opensyber.cloud/dashboard

**With data (after SDK integration):**
- [ ] 4 stat cards: Active Sessions, Verifications Today, Threats Blocked, Trust Score Avg
- [ ] Usage chart (7-day trend line)
- [ ] Plan usage progress bar with percentage (e.g., "450/1,000 verifications")
- [ ] Recent sessions list with device IDs
- [ ] "View all" link → /dashboard/sessions
- [ ] Upgrade banner visible for free plan: "You're on the Free plan — Upgrade"

**Without data (fresh account):**
- [ ] Shows "You're set up! Waiting for data..." empty state
- [ ] "View Integration Guide" link → /dashboard/docs
- [ ] Code block showing script tag setup

### 3.2 Sidebar Navigation
- [ ] TokenForge logo + brand name at top
- [ ] Nav items: Overview, Sessions, Events, Alerts, Zero-Code Proxy, Compliance, Settings, Quick Start
- [ ] All nav items navigate to correct pages
- [ ] Active page highlighted in sidebar
- [ ] User profile at bottom: picture, name, email
- [ ] Click user → "Sign out" option

---

## Flow 4: Sessions Management

### 4.1 Sessions List
**URL:** https://tokenforge.opensyber.cloud/dashboard/sessions

- [ ] Table columns: Device ID, User ID, Trust Score, Status, Bound At, Actions
- [ ] Trust scores color-coded: green (>=80), amber (>=50), red (<50)
- [ ] Status badges: active (green), revoked (red), expired (amber)
- [ ] Cursor-based pagination if >10 sessions
- [ ] Empty state: "No sessions yet" message

### 4.2 Session Details
- [ ] Click session row → expanded details
- [ ] Shows: IP address, country code, user agent hash, last verified time
- [ ] Expiration time displayed

### 4.3 Revoke Session
- [ ] Click "Revoke" button on active session
- [ ] Confirmation dialog
- [ ] Session status changes to "revoked" (red badge)
- [ ] Revoked session can no longer verify requests (tested in Flow 10)

---

## Flow 5: Security Events

### 5.1 Events Feed
**URL:** https://tokenforge.opensyber.cloud/dashboard/events

- [ ] Event feed loads with security events
- [ ] Severity badges: info (blue), warning (amber), critical (red)
- [ ] Country code badges visible (US, DE, JP, etc.)
- [ ] Event count displayed

### 5.2 Event Filtering
- [ ] Type filter dropdown works (hijack_attempt, trust_drop, ip_change, geo_anomaly, session_revoked)
- [ ] Severity filter dropdown works
- [ ] Filters combine correctly

### 5.3 Event Details
- [ ] Click expand on event → shows details
- [ ] IP address, country, device ID, trust score visible
- [ ] Metadata JSON displayed if present
- [ ] Cursor-based pagination works

---

## Flow 6: Alert Rules

### 6.1 Create Alert Rule
**URL:** https://tokenforge.opensyber.cloud/dashboard/alerts

- [ ] Create alert rule form visible
- [ ] Name field: accepts text input
- [ ] Condition dropdown: hijack_attempt, trust_drop, ip_change, geo_anomaly, session_revoked
- [ ] Select "trust_drop" → threshold field appears
- [ ] Channel: Email radio + Webhook radio
- [ ] Select Email → destination field for email address
- [ ] Select Webhook → destination field for HTTPS URL
- [ ] Click "Create Rule" → rule appears in list

### 6.2 Alert Rule Limits
- [ ] Max 20 rules per tenant
- [ ] Attempt to create rule #21 → error message
- [ ] Webhook URL must be HTTPS (HTTP rejected)
- [ ] Webhook URL must be public IP (private IPs blocked — SSRF prevention)

### 6.3 Delete Alert Rule
- [ ] Click delete button on existing rule
- [ ] Rule removed from list
- [ ] Rule count decremented

---

## Flow 7: Zero-Code Proxy (Team+ Plan Only)

### 7.1 Plan Gate Check
**URL:** https://tokenforge.opensyber.cloud/dashboard/proxy

**Free/Pro user:**
- [ ] Shows "Available on Team and Enterprise plans" label
- [ ] Form inputs may be visible but disabled or show upgrade prompt
- [ ] Upgrade link visible

**Team/Enterprise user:**
- [ ] Full form accessible

### 7.2 Add Proxy Domain (Team+)
- [ ] "Your domain" input: enter hostname (e.g., app.example.com)
- [ ] "Your server URL" input: enter origin (e.g., https://api.example.com)
- [ ] Click "Add Domain"
- [ ] API returns CNAME target + DNS provider instructions
- [ ] Domain appears in active domains list
- [ ] DNS instructions shown (provider-specific: Cloudflare, Route53, GoDaddy, etc.)

### 7.3 Delete Proxy Domain
- [ ] Click delete on active domain
- [ ] Domain removed from list
- [ ] Cloudflare Custom Hostname deregistered

### 7.4 Proxy Limits
- [ ] Max 10 domains per tenant
- [ ] Attempt to add #11 → error message

---

## Flow 8: Compliance Reports

### 8.1 Monthly Report
**URL:** https://tokenforge.opensyber.cloud/dashboard/compliance

- [ ] Report loads with current month data
- [ ] Stats: total verifications, threats blocked, avg trust score, active sessions
- [ ] Threat breakdown by type (hijack_attempt, trust_drop, ip_change, etc.)
- [ ] Compliance status section: device binding coverage, uptime
- [ ] Plan name and report generation date displayed

### 8.2 Export
- [ ] "Download PDF" button works (triggers window.print() for PDF export)
- [ ] Print preview shows formatted report

---

## Flow 9: Settings & API Key Management

### 9.1 API Keys List
**URL:** https://tokenforge.opensyber.cloud/dashboard/settings

- [ ] API keys section visible
- [ ] Keys listed: name, hidden prefix (dots), creation date, last used
- [ ] Eye toggle → reveals key prefix (tf_xxx...)
- [ ] Copy button → copies prefix to clipboard

### 9.2 Generate New API Key
- [ ] Click "Generate New Key"
- [ ] Modal/form: name field, optional expiration (days), optional allowed domains
- [ ] Submit → new key generated
- [ ] Full key shown once (never shown again after modal close)
- [ ] Copy button works for full key
- [ ] Key appears in list

### 9.3 Domain Allowlisting
- [ ] During key creation: enter allowed domains (e.g., *.example.com)
- [ ] Domain badges shown under key in list
- [ ] Pencil icon to edit domains
- [ ] Update domains → PUT /v1/tenant/api-keys/:id/domains

### 9.4 Revoke API Key
- [ ] Click delete button on key
- [ ] Browser confirm dialog appears
- [ ] Confirm → key deactivated (isActive=false)
- [ ] Key removed from list
- [ ] Immediately: requests with revoked key return 401

### 9.5 API Key Plan Limits
| Plan | Max Keys | Max Domains/Key |
|------|----------|----------------|
| Free | 2 | 1 |
| Pro | 10 | 5 |
| Team | 50 | 20 |
| Enterprise | Unlimited | Unlimited |

- [ ] Attempt to exceed key limit → error message
- [ ] Attempt to exceed domain limit → error message

### 9.6 Key Expiration
- [ ] Create key with expiresInDays=1
- [ ] After 24 hours: requests with expired key return 401
- [ ] Expired key shows visual indicator in settings

### 9.7 Webhooks Configuration
- [ ] Webhook URL field
- [ ] Event checkboxes (subscription events)
- [ ] Save webhook URL

### 9.8 Trust Badge
- [ ] Trust badge section with auto-filled embed code
- [ ] Code includes tenant-specific badge URL
- [ ] Copy button works
- [ ] Preview of badge appearance

---

## Flow 10: Subscription & Payments

### 10.1 Pricing Page
**URL:** https://tokenforge.opensyber.cloud/pricing

- [ ] 4 plans displayed with correct pricing
- [ ] Free: $0/mo — "Get Started Free" → /sign-in
- [ ] Pro: $49/mo — checkout link to LemonSqueezy
- [ ] Team: $199/mo — checkout link to LemonSqueezy
- [ ] Enterprise: Custom — mailto:sales@opensyber.cloud

### 10.2 Pro Plan Checkout ($49/mo)
- [ ] Click Pro CTA → redirects to LemonSqueezy hosted checkout
- [ ] Plan name and $49/month price displayed
- [ ] If test coupon env var set: discount auto-applied, total shows $0.00
- [ ] If no coupon: enter code manually (A3OTE0NW) or pay with test card
- [ ] Enter test card: 4242 4242 4242 4242, exp 12/29, CVC 123
- [ ] Submit payment → confirmation screen
- [ ] Redirect back to TokenForge dashboard

### 10.3 Team Plan Checkout ($199/mo)
- [ ] Click Team CTA → LemonSqueezy checkout
- [ ] Shows $199/month
- [ ] Complete payment → redirect to dashboard
- [ ] Zero-Code Proxy now accessible
- [ ] Plan limits increased (250K verifications, 50 keys, 20 domains/key)

### 10.4 Webhook Processing (subscription_created)
**Verify via API logs:**
- [ ] LemonSqueezy fires webhook to /webhooks/lemonsqueezy
- [ ] Webhook X-Signature header validated (HMAC-SHA256)
- [ ] Tenant plan updated in D1 database
- [ ] Usage limits updated per new plan

### 10.5 Webhook Security
```
curl -X POST https://tokenforge-api.opensyber.cloud/webhooks/lemonsqueezy
```
- [ ] Returns "missing_signature" error (no X-Signature header)
- [ ] Forged signature → rejected

### 10.6 Plan Upgrade (Pro → Team)
- [ ] Navigate to pricing page
- [ ] Click Team plan → LemonSqueezy upgrade flow
- [ ] subscription_updated webhook fires
- [ ] Plan changes from 'pro' to 'team'
- [ ] New limits immediately enforced
- [ ] Zero-Code Proxy unlocked

### 10.7 Subscription Cancellation
- [ ] Cancel via LemonSqueezy customer portal
- [ ] subscription_cancelled webhook fires
- [ ] User retains access until billing period ends
- [ ] After expiry: subscription_expired → plan reverts to 'free'
- [ ] Usage limits reduced
- [ ] Proxy domains may become inaccessible

### 10.8 Payment Failure
- [ ] subscription_payment_failed webhook fires
- [ ] Warning email sent via Resend
- [ ] User retains access temporarily
- [ ] Successful retry → subscription_payment_success → normal state restored

### 10.9 Dashboard Plan Display
- [ ] Dashboard shows upgrade banner for Free plan
- [ ] Plan usage bar shows correct limit (1K/50K/250K)
- [ ] GET /v1/tenant → plan and usage fields reflect current plan

---

## Flow 11: Device Binding & SDK Integration

### 11.1 Script Tag Loading
**On any page with TokenForge script tag:**
- [ ] DevTools → Network → check for sdk.js request to tokenforge-api.opensyber.cloud
- [ ] sdk.js loads successfully (200 status)
- [ ] Response is obfuscated JavaScript (charCode arrays, not readable source)

### 11.2 Device Binding
- [ ] DevTools → Application → IndexedDB → tokenforge_keys
- [ ] Device entry created with P-256 ECDSA keypair
- [ ] POST /v1/bind called automatically
- [ ] Response: deviceId, sessionId, userId, expiresAt, trustScore (100 for first bind)

### 11.3 Request Signing (Auto-Intercept)
- [ ] Subsequent fetch() calls include headers:
  - `X-TF-Signature`: ECDSA signature (base64)
  - `X-TF-Nonce`: random nonce
  - `X-TF-Timestamp`: Unix timestamp
  - `X-TF-Device-ID`: device identifier
- [ ] Signature payload format: `sessionId:nonce:timestamp`

### 11.4 Verification
- [ ] Server middleware calls POST /v1/edge/verify
- [ ] Returns decision: `allow` (trust > 80), `step_up` (40-80), or `block` (<40)
- [ ] Trust score computed from 7 signals:
  - Signature valid (40 pts)
  - IP consistency (15 pts)
  - Geo consistency (15 pts)
  - Device fingerprint (10 pts)
  - Session velocity (10 pts)
  - Time of day (5 pts)
  - Nonce freshness (5 pts)

### 11.5 Session Expiry
- [ ] Default session: 24 hours
- [ ] After expiry: verification returns session expired
- [ ] SDK auto-rebinds if configured

### 11.6 Revoked Session Rejection
- [ ] Revoke a session via dashboard
- [ ] Subsequent requests from that device → trust score 0, block decision
- [ ] Security event created: session_revoked

---

## Flow 12: API Endpoint Verification

### 12.1 Public Endpoints (No Auth)
```bash
# Health check
curl https://tokenforge-api.opensyber.cloud/health
```
- [ ] Returns `{"status":"healthy"}`

```bash
# API info
curl https://tokenforge-api.opensyber.cloud/
```
- [ ] Returns API name, version, documentation link

```bash
# SDK script
curl https://tokenforge-api.opensyber.cloud/sdk.js
```
- [ ] Returns obfuscated JavaScript (~several KB)
- [ ] Contains charCode arrays, not readable function names

```bash
# Badge script
curl https://tokenforge-api.opensyber.cloud/badge.js
```
- [ ] Returns ~1.4KB JavaScript with "Protected by TokenForge" text

```bash
# Public trust page data
curl https://tokenforge-api.opensyber.cloud/public/trust/test_user_123
```
- [ ] Returns trust stats JSON (or 404 if no data)

### 12.2 Auth-Required Endpoints
```bash
# Without auth
curl https://tokenforge-api.opensyber.cloud/v1/sessions
```
- [ ] Returns `{"error":"unauthorized"}` or similar 401

```bash
# With valid API key
curl -H "Authorization: Bearer tf_xxx" https://tokenforge-api.opensyber.cloud/v1/sessions
```
- [ ] Returns session list (or empty array)

### 12.3 Tenant Info
```bash
curl -H "Authorization: Bearer tf_xxx" https://tokenforge-api.opensyber.cloud/v1/tenant
```
- [ ] Returns: name, slug, plan, subscription, usage (total/limit/remaining), createdAt

### 12.4 Usage & Analytics
```bash
# Current month usage
curl -H "Authorization: Bearer tf_xxx" https://tokenforge-api.opensyber.cloud/v1/usage
```
- [ ] Returns: plan, verifications, binds, stepUps, total, limit, remaining

```bash
# Daily usage (30 days)
curl -H "Authorization: Bearer tf_xxx" https://tokenforge-api.opensyber.cloud/v1/usage/daily
```
- [ ] Returns array of { date, verifications, binds, stepUps }

```bash
# Analytics overview
curl -H "Authorization: Bearer tf_xxx" https://tokenforge-api.opensyber.cloud/v1/analytics/overview
```
- [ ] Returns usage comparison (current vs previous month), session stats, trust score avg

---

## Flow 13: Security Headers & CORS

### 13.1 Security Headers
```bash
curl -I https://tokenforge-api.opensyber.cloud/
```
- [ ] x-content-type-options: nosniff
- [ ] x-frame-options: DENY
- [ ] strict-transport-security: max-age=31536000
- [ ] vary: Origin

### 13.2 Rate Limiting
- [ ] ratelimit-limit header present
- [ ] ratelimit-remaining header present
- [ ] ratelimit-reset header present
- [ ] Public endpoints: more restrictive limits
- [ ] API endpoints: standard limits

### 13.3 CORS
- [ ] Origin: https://tokenforge.opensyber.cloud → access-control-allow-origin set
- [ ] Origin: https://opensyber.cloud → access-control-allow-origin set
- [ ] Origin: https://evil.com → NO access-control-allow-origin
- [ ] NO access-control-allow-credentials (disabled for security)
- [ ] X-TF-* headers in access-control-allow-headers

### 13.4 Error Messages (No Schema Leaks)
- [ ] Invalid API key → "Invalid API key" (no internal details)
- [ ] Invalid request body → generic message (no Zod schema leak)
- [ ] 404 route → "Not found" (no path leak)
- [ ] Missing required field → user-friendly message (no stack trace)

---

## Flow 14: Public Documentation

### 14.1 Docs Index
**URL:** https://tokenforge.opensyber.cloud/docs

- [ ] 3 integration paths: DNS Proxy, Script Tag, npm Package
- [ ] DNS Proxy shows CNAME example + "Team plan" badge
- [ ] Script Tag shows one-liner HTML code
- [ ] Server middleware shows Express/Next.js/Fastify examples
- [ ] Mobile & AI Agents section with SDK links
- [ ] "Sign Up Free" CTA

### 14.2 Integration Guides
**URL:** https://tokenforge.opensyber.cloud/docs/integrations

- [ ] 7 web frameworks: React, Angular, Vue, Clerk, Microsoft 365, Auth0, Firebase
- [ ] Jump navigation links work
- [ ] Each framework has code example
- [ ] Banner linking to Native SDKs page

### 14.3 Native SDKs
**URL:** https://tokenforge.opensyber.cloud/docs/integrations/native

- [ ] 6 SDKs: Swift (iOS), Kotlin (Android), React Native, Python, Go, MCP Server
- [ ] Each with install command + code example
- [ ] MCP shows Claude Desktop, Cursor, Claude Code configurations

### 14.4 SIEM Guide
**URL:** https://tokenforge.opensyber.cloud/docs/siem

- [ ] Event payload format with CEF string example
- [ ] Platform guides: Splunk, Sentinel, Elastic, Datadog, Trellix, Cyrebro
- [ ] "Any other SIEM" catch-all section

### 14.5 Quick Start (Authenticated)
**URL:** https://tokenforge.opensyber.cloud/dashboard/docs

- [ ] Step 1: Script tag with user's actual API key pre-filled
- [ ] Step 2: Server middleware code examples
- [ ] Step 3: Verification instructions

---

## Flow 15: Blog

### 15.1 Blog Index
**URL:** https://tokenforge.opensyber.cloud/blog

- [ ] Blog index loads with post list
- [ ] Posts have titles, dates, previews

### 15.2 Blog Posts
- [ ] /blog/session-hijacking-after-mfa loads article with CTA
- [ ] /blog/microsoft-365-session-security loads with code examples + comparison table

---

## Flow 16: Public Trust Page

### 16.1 Trust Page
**URL:** https://tokenforge.opensyber.cloud/trust/{tenant_id}

- [ ] No auth required
- [ ] "Protected by TokenForge" banner displayed
- [ ] Stat cards: verifications, threats blocked, trust score, sessions
- [ ] "Powered by TokenForge" footer
- [ ] Social sharing meta tags present

---

## Flow 17: Signup Rate Limiting

### 17.1 Provision Rate Limit
```bash
# POST /public/provision is limited to 3/hour per IP
curl -X POST https://tokenforge-api.opensyber.cloud/public/provision \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test1@example.com"}'
```
- [ ] First 3 calls succeed (or return existing tenant)
- [ ] 4th call within same hour → rate limit error (429)

### 17.2 Idempotent Provision
- [ ] Call /public/provision with same email twice
- [ ] Second call returns `existing: true` with same tenant
- [ ] New API key generated (not duplicate)

---

## Flow 18: Trust Score Scenarios

### 18.1 Perfect Trust (100)
All signals match: same device, same IP, same country, valid signature, fresh nonce.
- [ ] Trust score: 100
- [ ] Decision: allow

### 18.2 IP Change (85)
Same device, different IP address.
- [ ] Trust score drops ~15 points
- [ ] Decision: allow (still >80)
- [ ] ip_change event created

### 18.3 Country Change (85)
Same device, different country code.
- [ ] Trust score drops ~15 points
- [ ] Decision: allow (still >80)
- [ ] geo_anomaly event created

### 18.4 IP + Country Change (70)
Same device, different IP AND country.
- [ ] Trust score: ~70
- [ ] Decision: step_up (40-80 range)
- [ ] Multiple events created

### 18.5 Invalid Signature (0)
Forged or tampered signature.
- [ ] Trust score: 0
- [ ] Decision: block
- [ ] hijack_attempt event created

### 18.6 Replay Attack
Same nonce used twice.
- [ ] First request: normal trust score
- [ ] Second request with same nonce: block (nonce replay detected)

### 18.7 Timestamp Out of Window
Timestamp >60 seconds old.
- [ ] Decision: block
- [ ] Trust score: 0

### 18.8 Degraded Mode
Request with no TokenForge headers (no binding).
- [ ] Trust score: 0
- [ ] Decision: degraded (may allow through depending on config)

---

## Flow 19: Plan Limit Enforcement

### 19.1 Verification Limit
- [ ] Free plan: 1,000 verifications/month
- [ ] After hitting limit → API returns 429 or limit exceeded error
- [ ] Dashboard shows 100% usage bar
- [ ] Upgrade prompt displayed

### 19.2 API Key Limit
- [ ] Free: max 2 keys
- [ ] Attempt to create 3rd key → error
- [ ] Pro: max 10 keys
- [ ] Team: max 50 keys

### 19.3 Domain Limit
- [ ] Free: max 1 domain per key
- [ ] Pro: max 5 domains per key
- [ ] Attempt to exceed → error message

### 19.4 Proxy Domain Limit
- [ ] Team: max 10 proxy domains
- [ ] Free/Pro: proxy feature locked

### 19.5 Alert Rule Limit
- [ ] All plans: max 20 rules
- [ ] Attempt to create 21st → error

---

## Flow 20: Cross-Browser & Mobile

### 20.1 Landing Page
- [ ] Chrome: renders correctly
- [ ] Safari: renders correctly
- [ ] Firefox: renders correctly
- [ ] Edge: renders correctly

### 20.2 Dashboard
- [ ] Chrome: full functionality
- [ ] Safari: sidebar, navigation, data loads
- [ ] Firefox: forms, modals, copy buttons work

### 20.3 Mobile Responsive
- [ ] Landing page: hero stacks, pricing cards vertical
- [ ] Dashboard: sidebar collapses, content readable
- [ ] Sign-in: OAuth buttons accessible on mobile
- [ ] FAQ accordion: touch-friendly

### 20.4 Incognito Mode
- [ ] Sign-in works in incognito
- [ ] IndexedDB available for device binding
- [ ] Session persists within incognito window

---

## Test Summary

| Flow | Section | Total Checks |
|------|---------|-------------|
| 1 | Landing Page | ~30 |
| 2 | Auth & Onboarding | ~25 |
| 3 | Dashboard | ~15 |
| 4 | Sessions | ~10 |
| 5 | Events | ~10 |
| 6 | Alert Rules | ~10 |
| 7 | Zero-Code Proxy | ~10 |
| 8 | Compliance | ~5 |
| 9 | Settings & API Keys | ~25 |
| 10 | Payments | ~25 |
| 11 | SDK & Device Binding | ~15 |
| 12 | API Endpoints | ~15 |
| 13 | Security & CORS | ~15 |
| 14 | Documentation | ~15 |
| 15 | Blog | ~5 |
| 16 | Trust Page | ~5 |
| 17 | Rate Limiting | ~5 |
| 18 | Trust Scores | ~10 |
| 19 | Plan Limits | ~10 |
| 20 | Cross-Browser | ~10 |
| **TOTAL** | | **~275** |

---

## Known Issues (as of March 26, 2026)

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | LemonSqueezy checkout links on landing page pricing require env vars | BLOCKER if not set | Verify in Cloudflare Pages env |
| 2 | sdk.js obfuscation may break in some browsers | LOW | Test in Safari/Firefox |
| 3 | Zero-Code Proxy requires Cloudflare Custom Hostname API access | MEDIUM | Verify API token has permissions |

---

## Execution Sign-Off

| Field | Value |
|-------|-------|
| Tester | |
| Date | |
| Total Passed | /275 |
| Total Failed | |
| Total Blocked | |
| Total Skipped | |
| Blockers Remaining | |
| Sign-Off | |

**Notes:**
