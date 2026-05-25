# TokenForge Audit Report

**Grade: B-**
**Auditor:** Automated code + product audit
**Date:** April 5, 2026
**Scope:** TokenForge SDK, API, web product, pricing, infrastructure

---

## Executive Summary

TokenForge is a solid device-bound session security product with strong cryptographic foundations (ECDSA P-256, Web Crypto API). The SDK architecture is well-designed with framework adapters and multi-language support. However, two critical infrastructure issues and several product gaps bring the overall grade down.

**What's working well:**
- Cryptographic design (non-extractable keys, device binding)
- Multi-framework adapter pattern (Express, Fastify, Hono, Next.js)
- 6-language SDK coverage (TS, Go, Python, Kotlin, Swift, React Native)
- Trust scoring concept and implementation
- Clean separation between client/server/adapter layers

**What needs immediate attention:**
- Hardcoded Worker subdomain in customer-facing docs
- Free tier too restrictive for real adoption
- Brand leakage (finsavvy URLs in checkout flow)

---

## Priority 1 — Critical (Fix This Week)

### 1.1 Hardcoded `broad-dew-49ad.workers.dev` CNAME

**Severity:** CRITICAL
**Impact:** Every customer using custom hostname proxy

**Problem:** The custom hostname proxy instructs customers to create a DNS CNAME record pointing to `tokenforge-proxy.broad-dew-49ad.workers.dev`. This is the raw Cloudflare Worker subdomain. If the Worker is ever redeployed to a new subdomain (intentionally or via CF account changes), every customer's proxy breaks simultaneously with no recourse.

**Locations:**
- `apps/tokenforge-web/src/app/dashboard/proxy/AddDomainForm.tsx` (lines 46, 100)
- `apps/tokenforge-api/src/services/custom-hostname.ts` (line 106)

**Fix:** Create a stable CNAME: `proxy.tokenforge.opensyber.cloud` → points to the current Worker. Customers CNAME to the stable alias. When the Worker changes, you update one DNS record instead of breaking every customer.

**Effort:** 30 minutes (DNS record + 3 code changes)

### 1.2 Free Tier: 1,000 Verifications/Month is Too Low

**Severity:** CRITICAL
**Impact:** Developer adoption, conversion funnel

**Problem:** 1,000 verifications/month means ~33 verifications/day. A single-page app with 100 daily active users making 1 API call each exhausts the free tier in 3 days. No developer will evaluate TokenForge seriously at this limit — they'll hit the wall during the integration test phase, before they've even deployed to staging.

**Locations (all references to update):**
- `apps/tokenforge-web/src/components/landing/PricingSection.tsx` — shows "10K verifications/mo" (already updated on landing, but...)
- `apps/tokenforge-web/src/components/dashboard/OnboardingSteps.tsx` — still says "1,000 verifications/month"
- `apps/tokenforge-web/src/app/blog/session-hijacking-after-mfa/page.tsx` — "1,000 verifications/month"
- `apps/tokenforge-web/src/app/blog/microsoft-365-session-security/page.tsx` — "1,000 verifications/month"
- `apps/tokenforge-web/src/components/ApiKeyGenerator.tsx` — "1,000 verifications/month"
- `packages/tokenforge/README.md` — "1,000 verifications/month"
- `packages/tokenforge-sdks/mcp/README.md` — "1,000 verifications/month"
- `docs/sprints/sprint-7-tokenforge-product.md` — "1,000 verifications/month"
- `docs/skills/skill-catalog.md` — "1K verifications/mo"

**Fix:** Raise free tier to 10K verifications/month (landing page already shows this). Update all references above to match. Adjust rate limiting in the API accordingly.

**Effort:** 1-2 hours (text changes + API rate limit config)

---

## Priority 2 — High (Fix This Sprint)

### 2.1 Brand Leakage: `finsavvy.lemonsqueezy.com`

**Severity:** HIGH
**Impact:** Customer trust, brand confusion

**Problem:** Checkout URLs point to `finsavvy.lemonsqueezy.com`. A customer clicking "Subscribe to Pro" sees a completely different brand name in the LemonSqueezy checkout. This is documented and the LemonSqueezy overlay solution exists (see `docs/imp/tokenforge-lemonsqueezy-overlay.md`), but it must be verified as actually deployed.

**Fix:** Verify the LemonSqueezy overlay is active in production. If not, implement per the existing implementation doc. Long-term: request LemonSqueezy store rename or use a custom checkout domain.

### 2.2 E2E Test Hardcoded API URLs

**Severity:** HIGH
**Impact:** Test reliability

**Problem:** E2E tests hardcode `opensyber-api.broad-dew-49ad.workers.dev` as the fallback API URL.

**Locations:**
- `apps/web/e2e/api-health.spec.ts` (line 3)
- `apps/web/e2e/enterprise-api.spec.ts` (line 3)

**Fix:** Use environment variable only (no hardcoded fallback), or use a stable domain alias like `api.opensyber.cloud`.

---

## Priority 3 — Medium (Fix Next Sprint)

### 3.1 Landing Page Pricing Inconsistency

The `PricingSection.tsx` shows 4 tiers (Free, Pro $49, Team $199, Enterprise) while some documentation references different structures. Ensure pricing is consistent across:
- Landing page
- Dashboard billing page
- Blog posts
- SDK README files
- API documentation

### 3.2 FAQ Section Issues

The TokenForge FAQ section (`FaqSection.tsx` at 9.3KB) is noted as having "issues" in the codebase exploration. Review for:
- Accuracy of technical claims
- Consistency with current pricing
- Links that may be broken

### 3.3 Missing Error Boundaries in Dashboard

The TokenForge dashboard (`apps/tokenforge-web/src/app/dashboard/`) should have error boundaries for the proxy configuration flow. A failed DNS lookup shouldn't crash the entire dashboard.

---

## Priority 4 — Low (Backlog)

### 4.1 SDK README Consistency

Each SDK README (`packages/tokenforge-sdks/*/README.md`) should reference the same pricing, the same free tier limit, and the same support channels. Audit each for drift.

### 4.2 Blog Post Technical Accuracy

Two blog posts reference "1,000 verifications/month" for the free tier. When the limit changes, these become stale. Consider making pricing references dynamic or at minimum adding a "pricing current as of" date.

### 4.3 Changelog Maintenance

`packages/tokenforge/CHANGELOG.md` references "1,000 verifications/month" in historical entries. These are fine as historical records but should not be the only place a developer finds pricing info.

---

## Scoring Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| Cryptographic Design | A | ECDSA P-256, non-extractable keys, proper key lifecycle |
| SDK Architecture | A- | Clean adapter pattern, good DX, 6 language coverage |
| API Design | B+ | Well-structured Hono routes, Zod validation, proper auth |
| Infrastructure | C+ | Workers.dev CNAME is a single point of failure |
| Pricing Strategy | C | Free tier kills adoption; inconsistent across docs |
| Brand Consistency | C- | finsavvy leakage in checkout, workers.dev in DNS docs |
| Documentation | B | Good coverage but references are stale in places |
| Testing | A- | 96% coverage, Playwright E2E, but hardcoded URLs in tests |
| Security Posture | A- | Strong crypto, proper auth, rate limiting present |
| Production Readiness | B | Solid core, but infrastructure risks need resolution |

**Overall: B-**

---

## Recommended Fix Order

1. **Today:** Create `proxy.tokenforge.opensyber.cloud` DNS alias, update 3 code references
2. **Today:** Update free tier to 10K across all 9+ reference locations
3. **This week:** Verify LemonSqueezy overlay is deployed in production
4. **This week:** Replace hardcoded workers.dev URLs in E2E tests
5. **Next sprint:** Audit all SDK READMEs for pricing/URL consistency
6. **Next sprint:** Review FAQ section accuracy
7. **Ongoing:** Establish a process for keeping pricing references in sync

---

*Report generated as part of TokenForge audit deliverables. See also: `roadmap.html` for the fix timeline.*
