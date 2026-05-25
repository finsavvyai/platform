# PushCI Commercial Layer — Actual Status (May 2026)

> Written after a code audit, May 25 2026. Supersedes verbal "needs polish" assumption — the gap between current state and first paying customer is **smaller than expected**.

## TL;DR

The commercial layer **is built**. LemonSqueezy is fully integrated end-to-end. What stands between today and first revenue is **account setup + production activation**, not engineering.

Realistic effort to first paying customer: **1-2 days of founder admin work**, not "a few days of agent session." Implementing more code now risks regressions on a working system.

## What's already shipped (verified by code audit)

### Backend / API (Cloudflare Worker)

- `api/src/billing.ts` — full LemonSqueezy integration: `/billing/checkout`, `/billing/portal`, `/billing/webhook`. Six webhook events handled: subscription_created, updated, cancelled, expired, payment_failed, paused, resumed. HMAC SHA-256 signature verification with timing-safe equality check. JWT auth gate.
- `api/src/billing-types.ts` — `PLANS` map for free / pro / team / enterprise with full feature definitions.
- `api/src/entitlements.ts` — `/me/entitlements` and `/me/entitlements/:feature` endpoints. Feature gating with monthly usage counters. Returns upgrade_to + upgrade_url on denial.
- `api/src/usage.ts` — user model + helpers.
- `api/migrations/2026-04-06_lemonsqueezy.sql` — schema adds `ls_customer_id`, `ls_subscription_id` columns + index.
- `api/migrations/2026-04-06_user_plans.sql` + `2026-04-22_feature_usage.sql` — plan storage and usage tracking tables.

### Dashboard (web/dashboard)

- `CheckoutModal.tsx` — 180-line polished modal: promo code support, focus trap, accessibility, 14-day money-back signal, secure-payment shield, animated states.
- `BillingPlanCard.tsx`, `PlanInfoCard.tsx`, `PlanBadge.tsx`, `PlanIcon.tsx`, `ProBadge.tsx` — full billing UI surface.
- `LockedFeature.tsx`, `FreeUserWelcome.tsx`, `SkillUsageCounter.tsx` — upgrade-pressure components.
- `SSOSettings.tsx`, `AuditLogSection.tsx` — gated Team-tier features.

### Landing site (web/landing)

- `Pricing.tsx` + `pricingData.ts` — 4-tier pricing section with AMISRAEL2026 promo code, links to cost calculator.
- Comparison pages: `VsGitHubActions`, `VsCircleCI`, `VsBitbucketPipelines` + `EnterprisePage`.
- Full marketing surface: Hero, Features, HowItWorks, Comparison, FAQ, Footer, social proof, newsletter capture.

### CLI

- `cmd/pushci/cmd_login.go` — browser-based login flow, token paste, saves to `~/.pushci/config.json` at 0600 permissions.
- `cmd_logout.go` — clean logout path.

## What's actually missing (the real blocker list)

These are the gaps. None are coding work.

### 1. LemonSqueezy account setup (founder action, ~1-2 hours)

- Create LS Store for PushCI
- Create two Products: "PushCI Pro" and "PushCI Team"
- For each, create monthly + annual Variants
- Capture variant IDs as integers (LS uses numeric IDs internally)
- Set up Customer Portal branding
- Configure email templates (LS handles, but review the defaults)

### 2. Worker secrets configuration (founder action, ~30 min)

In Cloudflare Worker dashboard or `wrangler secret put`:
- `LEMONSQUEEZY_API_KEY` — from LS account settings
- `LEMONSQUEEZY_WEBHOOK_SECRET` — generated in LS webhook setup
- `LEMONSQUEEZY_STORE_ID` — the store you just created
- `PUSHCI_LS_VARIANT_PRO` — numeric variant ID for Pro monthly
- `PUSHCI_LS_VARIANT_TEAM` — numeric variant ID for Team monthly
- `APP_URL` — should be `https://app.pushci.dev` already

### 3. Register webhook URL with LS (~10 min)

Point LS webhook at `https://api.pushci.dev/billing/webhook`. Subscribe to subscription_* events. Test using LS webhook tester before going live.

### 4. End-to-end activation test (~1 hour)

- Test mode purchase via LS test mode
- Verify webhook fires and updates D1
- Verify `/me/entitlements` reflects the plan change
- Verify CheckoutModal flow from dashboard works end-to-end
- Verify portal redirect from "Manage subscription" button works

### 5. Pricing decision lock (founder, 10 min)

Current code has **Pro $9/mo · Team $29/seat/mo · Enterprise from $25/user**. Session discussion landed on Pro $19 / Team $49. Recommend keeping the existing prices — they're founder-set, more adoption-friendly, and easy to raise later. Confirm before any change.

## Cleanup work (optional, low priority)

- Remove `api/src/billing-paddle.ts` (legacy, not used by active billing routes)
- Remove `api/migrations/2026-04-22_paddle.sql` (or leave as harmless no-op)
- Document the LS-vs-Paddle history in CHANGELOG so future contributors don't get confused

## What we should NOT do right now

These are the agent-session moves I was about to make and **shouldn't**, because they'd waste time or risk regressing working code:

- ❌ Write new LS integration code (already exists, tested)
- ❌ Rebuild CheckoutModal (already polished)
- ❌ Rewrite pricing page from scratch (already has 4-tier layout)
- ❌ Add local-build cap to free tier (changes positioning; current "unlimited local, paid cloud" is a stronger story for adoption)
- ❌ Split dashboard to its own Cloudflare Pages deploy (real work, but not blocking revenue — defer to post-revenue polish)
- ❌ Migrate from Paddle to LS (already migrated, Paddle is legacy)

## Recommended path forward

**This week (founder, ~3-4 hours total):**
1. Set up LS account, products, variants (2h)
2. Configure Worker secrets, webhook URL (30m)
3. Run end-to-end activation test (1h)
4. Soft-announce to 5-10 friendly devs as private beta

**Next 2 weeks (background, no eng acceleration):**
- Monitor first checkout flows for friction
- Adjust copy in pricing page / checkout modal based on real user reactions
- Decide whether to launch publicly or stay private through Brain ramp

**This restores the original decisive plan:** PushCI stays in BACKGROUND, but with the commercial path *activated* rather than dormant. Free CLI continues as the adoption wedge. Paid plans available for anyone who self-selects. Founder attention stays on Brain.

## Honest correction to earlier session conversation

Earlier in this session I proposed a multi-day agent build for "polish + commercial layer." That recommendation was wrong — based on incomplete knowledge of what was already in the codebase. The actual gap is operational (LS account, secrets, webhook config) not engineering.

The "you can easily implement leftovers in a few days agent session" intuition was directionally right that the work is small. It was wrong about *what kind* of work. Founder admin time, not agent time, gets you to the first paying customer.
