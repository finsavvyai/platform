# OpenSyber — Subscription Purchase & Agent Deployment Test Plan

**Environment:** Production (opensyber.cloud)
**Version:** 1.0
**Date:** March 2026
**Auth Provider:** Clerk
**Payment Provider:** LemonSqueezy
**Infra Provider:** Hetzner Cloud + Cloudflare

---

## 1. Prerequisites & Environment Setup

Before beginning testing, ensure the following are in place:

- Production environment is live at opensyber.cloud
- Clerk authentication is configured with test and production keys
- LemonSqueezy store is active with correct variant IDs configured
- LemonSqueezy webhook endpoint (`api.opensyber.cloud/api/webhooks/lemonsqueezy`) is registered and verified
- Clerk `user.created` webhook is pointing to `api.opensyber.cloud` and syncing users to D1
- Hetzner Cloud API token is set in Cloudflare Worker secrets
- Environment variables configured:
  - `NEXT_PUBLIC_LEMONSQUEEZY_STORE_ID`
  - `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PERSONAL`
  - `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_PRO`
  - `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_TEAM`
- Test payment card available (LemonSqueezy test mode or sandbox)

---

## 2. Subscription Purchase Flow

Tests the complete journey from pricing page through LemonSqueezy checkout to plan activation.

### 2.1 Pricing Page Display

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Navigate to /pricing as anonymous visitor | Pricing page loads with all 5 tiers: Free, Personal ($49), Pro ($149), Team ($399), Enterprise (Contact) | | |
| 2 | Verify Free tier CTA button text | Shows "Get Started Free" linking to /signup | | |
| 3 | Verify Personal tier CTA for logged-out user | Shows "Get Started" linking to signup URL | | |
| 4 | Verify Pro tier CTA for logged-out user | Shows "Get Started" linking to signup URL | | |
| 5 | Verify Team tier CTA for logged-out user | Shows "Get Started" linking to signup URL | | |
| 6 | Verify Enterprise tier CTA | Shows "Contact Sales" linking to mailto or contact form | | |
| 7 | Sign in with Clerk, revisit /pricing | Paid plan buttons now show LemonSqueezy checkout URLs (not /dashboard fallback) | | |
| 8 | Verify checkout URL contains correct variant IDs | Personal: LS_VARIANT_PERSONAL, Pro: LS_VARIANT_PRO, Team: LS_VARIANT_TEAM | | |
| 9 | Verify checkout URL passes user email as prefill | URL includes checkout[email] parameter with Clerk user email | | |

### 2.2 LemonSqueezy Checkout

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Click "Subscribe" on Personal plan ($49/mo) | Redirects to LemonSqueezy hosted checkout page | | |
| 2 | Verify checkout page shows correct plan name and price | Displays "Personal" plan at $49.00/month | | |
| 3 | Verify email is pre-filled from Clerk session | Email field contains the signed-in user's email | | |
| 4 | Enter test payment card details | Card form accepts input without errors | | |
| 5 | Submit payment | Payment processes successfully, shows confirmation screen | | |
| 6 | Verify redirect back to OpenSyber after payment | Redirects to /dashboard or success page on opensyber.cloud | | |

### 2.3 Webhook Processing & Plan Activation

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Check API logs for subscription_created webhook | Webhook received from LemonSqueezy with HMAC-SHA256 signature verified | | |
| 2 | Verify user record updated in D1 database | User plan field changed from "free" to "personal" | | |
| 3 | Verify subscription ID stored on user record | lemonSqueezySubscriptionId and lemonSqueezyCustomerId populated | | |
| 4 | Navigate to /dashboard/settings | Subscription card shows "Personal" plan at $49/mo | | |
| 5 | Verify plan feature display | Shows correct limits: 1 instance, 30-day audit retention, email support | | |
| 6 | Verify "Upgrade plan" link still visible | Link to /pricing shown for plans below Team tier | | |

---

## 3. Agent/Instance Deployment Flow

Tests the complete journey from deploy form through Hetzner provisioning to running agent.

### 3.1 Deploy Instance Form

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Navigate to /dashboard as subscribed user | Dashboard loads with deploy CTA visible | | |
| 2 | Click "Deploy Instance" button | Deploy form/modal opens | | |
| 3 | Verify instance name field with default value | Name input shows "My Agent" as default, editable | | |
| 4 | Verify region dropdown options | Shows 4 regions: EU Central (Falkenstein), US East (Ashburn), US West (Hillsboro), Asia Pacific (Singapore) | | |
| 5 | Enter custom instance name "Production Agent" | Name field accepts input | | |
| 6 | Select "US East (Ashburn)" region | Region selected, form ready to submit | | |

### 3.2 Instance Creation API

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Submit deploy form | POST /api/proxy/instances called with name + region | | |
| 2 | Verify API authentication | Clerk token passed via Authorization header, API validates user exists in D1 | | |
| 3 | Verify plan limit enforcement | API checks PLAN_INSTANCE_LIMITS[user.plan] before creating | | |
| 4 | Verify instance record created in D1 | New instance with status "provisioning", correct name and region | | |
| 5 | Verify gateway token generated | Instance has hasGatewayToken: true after creation | | |
| 6 | Verify UI updates to show provisioning state | Dashboard shows instance card with "Provisioning..." status | | |

### 3.3 Hetzner Server Provisioning

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Verify Hetzner API called with correct parameters | POST to api.hetzner.cloud/v1/servers with opensyber-{instanceId} naming | | |
| 2 | Verify server type matches plan tier | Personal plan: cx11 (1 vCPU, 2GB RAM) | | |
| 3 | Verify location matches selected region | US East maps to Hetzner "ash" location | | |
| 4 | Verify server labels applied | Labels include instanceId and environment tags | | |
| 5 | Wait for server to reach "running" state | Hetzner server status transitions to "running" within 60 seconds | | |
| 6 | Verify instance status updated in D1 | Instance status changes: provisioning → installing → ready | | |

### 3.4 Agent Container Startup

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Verify Durable Object receives start command | AGENT_DO namespace creates instance, POST /start called | | |
| 2 | Verify container spec matches plan tier | Personal: 512Mi memory, 2 vCPU per PLAN_CONTAINER_SPECS | | |
| 3 | Verify environment variables injected | Gateway token and vault secrets available as env vars | | |
| 4 | Verify agent health check passes | Agent responds to health endpoint within 120 seconds | | |
| 5 | Verify instance status reaches "running" | Dashboard shows green "Running" badge on instance card | | |
| 6 | Verify hostname assigned | Settings page shows hostname (e.g., {name}.opensyber.cloud) | | |

---

## 4. Plan Management & Lifecycle

Tests plan changes, cancellation, and billing edge cases.

### 4.1 Plan Upgrade

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | From Personal plan, click "Upgrade plan" in Settings | Navigates to /pricing page | | |
| 2 | Click "Upgrade" on Pro plan ($149/mo) | Redirects to LemonSqueezy checkout or plan change flow | | |
| 3 | Complete upgrade payment | subscription_updated webhook fires | | |
| 4 | Verify plan updated in D1 | User plan changed from "personal" to "pro" | | |
| 5 | Verify updated limits in Settings | Shows Pro limits: 1 instance, 90-day audit, priority support | | |
| 6 | Verify container spec upgrade applied | Instance container upgraded to Pro specs (1Gi memory, 2 vCPU) | | |

### 4.2 Subscription Cancellation

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Cancel subscription via LemonSqueezy portal | subscription_cancelled webhook fires | | |
| 2 | Verify grace period handling | User retains plan access until billing period ends | | |
| 3 | Verify plan downgrade after expiry | subscription_expired webhook fires, plan reverts to "free" | | |
| 4 | Verify instance suspension | Running instances suspended (not deleted) after plan expires | | |
| 5 | Verify Settings page reflects cancellation | Shows "Free" plan with re-subscribe option | | |
| 6 | Re-subscribe to restore access | New subscription_created webhook, instances restored | | |

### 4.3 Payment Failure Handling

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Simulate payment failure (expired card) | payment_failed webhook fires | | |
| 2 | Verify user notified of payment issue | Email sent via Resend with payment retry link | | |
| 3 | Verify grace period before suspension | User retains access for grace period (e.g., 7 days) | | |
| 4 | Verify retry payment resolves issue | Successful payment restores normal subscription status | | |

---

## 5. Instance Management

Tests instance lifecycle operations beyond initial deployment.

### 5.1 Instance Settings & Monitoring

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Navigate to /dashboard/settings with running instance | Instance card shows name, region, hostname, gateway token status, instance ID | | |
| 2 | Verify region label displays correctly | Shows human-readable label (e.g., "US East (Ashburn)") not code ("us-east") | | |
| 3 | Verify Credential Vault section visible | VaultCard renders with SecretsList and AddSecretForm | | |
| 4 | Add a secret to the vault | Secret stored encrypted, appears in list with masked value | | |
| 5 | Verify Growth Kit section visible | ScorecardShareCard and BadgeEmbed components render | | |

### 5.2 Instance Deletion (Danger Zone)

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Scroll to Danger Zone section | Red-bordered card with warning text and delete button visible | | |
| 2 | Click "Delete Instance" button | Confirmation dialog appears warning about permanent data loss | | |
| 3 | Confirm deletion | API call to delete instance, Hetzner server destroyed | | |
| 4 | Verify instance removed from dashboard | Dashboard shows no instances, deploy CTA reappears | | |
| 5 | Verify Hetzner server terminated | Server no longer exists in Hetzner Cloud console | | |

### 5.3 Plan Limit Enforcement

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | With 1 instance running on Personal plan, try to deploy another | API returns error: instance limit reached (1/1) | | |
| 2 | Verify UI displays limit message | User sees helpful message to upgrade plan for more instances | | |
| 3 | Upgrade to Team plan (5 instances) | Instance limit increases, deploy button re-enabled | | |
| 4 | Deploy second instance | Second instance created successfully (2/5 limit) | | |

---

## 6. Edge Cases & Error Handling

Tests boundary conditions and failure scenarios.

### 6.1 Authentication & User Sync

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Sign up with new Clerk account | user.created webhook syncs user to D1 within seconds | | |
| 2 | Immediately try to deploy an instance | API finds user in D1 (no "User not found" error) | | |
| 3 | Sign in from a different browser/device | Session valid, dashboard data loads correctly | | |
| 4 | Sign out and attempt API calls | All protected endpoints return 401 Unauthorized | | |

### 6.2 Network & Infrastructure Failures

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Submit deploy with Hetzner API temporarily down | Instance stays in "provisioning" status, user sees retry option | | |
| 2 | Webhook delivery fails (API unreachable) | LemonSqueezy retries webhook automatically | | |
| 3 | Deploy to unavailable region | Graceful error message, instance not created | | |
| 4 | Rapid successive deploy requests | Rate limiting prevents duplicate instances | | |

### 6.3 Concurrent & Race Conditions

| # | Test Step | Expected Result | Status | Notes |
|---|-----------|-----------------|--------|-------|
| 1 | Click deploy button multiple times rapidly | Only one instance created, UI prevents duplicate submissions | | |
| 2 | Two users deploy at same time | Both instances created independently without conflict | | |
| 3 | Cancel subscription while instance is provisioning | Instance completes provisioning, then suspended on plan expiry | | |

---

## 7. Known Issues (Pre-Test)

Issues identified during code review and initial browser testing that should be resolved before running this test plan:

| # | Issue | Root Cause | Severity | Status |
|---|-------|------------|----------|--------|
| 1 | LemonSqueezy checkout URLs not generated | `NEXT_PUBLIC_OPENSYBER_LS_VARIANT_*` env vars not set in production | **BLOCKER** | Config needed |
| 2 | Deploy returns 500 "User not found" | Clerk `user.created` webhook not syncing users to D1 database | **BLOCKER** | Config needed |
| 3 | Settings shows fallback for subscription data | API `/api/user` call fails when user record missing in D1 | MEDIUM | Fix deployed (pending redeploy) |
| 4 | Pricing buttons fallback to /dashboard | `buildCheckoutUrl()` returns null when env vars missing | HIGH | Blocked by #1 |

---

## 8. Test Execution Sign-Off

| Field | Value |
|-------|-------|
| Total Test Steps | 68 |
| Passed | |
| Failed | |
| Blocked | |
| Skipped | |
| Tester Name | |
| Test Date | |
| Sign-Off | |

**Notes and additional observations:**

---
---
---
