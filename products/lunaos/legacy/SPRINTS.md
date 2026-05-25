# LunaForge — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 5 · **Readiness:** 72% · **Stack:** TypeScript (Cloudflare Workers, Hono)
> **Timeline:** 7 days · **Ship by:** Week 11

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: CF Worker deployment pipeline [PARALLEL]
**Prompt:**
Build Cloudflare Worker deployment pipeline for LunaForge. Create GitHub Actions workflow (or similar CI/CD) that: (1) runs tests on push, (2) builds TypeScript, (3) validates Wrangler config, (4) deploys to CF Workers. Implement staging environment (separate Worker for testing). Create rollback mechanism (deploy previous version if health checks fail). Implement health checks (ping endpoint, database connectivity). Set up environment variables for prod/staging. Create deployment notifications (Slack/email on success/failure). Document deployment process and troubleshooting. Test full deployment flow (code push → staging → production). Ensure Wrangler config valid (wrangler.toml). All deployment scripts ≤200 lines.

### Agent B: Payment with @finsavvyai/pay [PARALLEL]
**Prompt:**
Integrate payment processing using `@finsavvyai/pay` (Stripe/LemonSqueezy) into LunaForge. Implement checkout endpoint creating payment session. Handle webhook for payment.success → provision Worker. Implement subscription management (create, update, cancel). Support tier-based features (free: 1 Worker, pro: 10 Workers, enterprise: unlimited). Implement usage tracking (invocations/month per Worker). Add rate limiting per tier. Implement refund flow. Store payment/subscription state in Cloudflare KV store. Ensure no hardcoded secrets (env vars only). Run `npm audit` + `eslint-plugin-security` for zero high/critical findings.

---

## Sprint Tasks

### Agent C: Docs + testing [SEQUENTIAL]
**Prompt:**
Create comprehensive documentation for LunaForge. Write quickstart guide (5 minutes to first Worker). Document API reference (all endpoints). Create tutorial: deploy a simple service. Write troubleshooting guide. Add architecture documentation (how Workers are deployed, how data is stored). Create video tutorial (or GIF demo). Set up documentation site (using Docusaurus or similar). Write deployment guide for different environments. Create FAQ. Document payment tiers and limits. Write contributing guide for future developers. Create video tutorials for common workflows. Run `npm run test:coverage --fail_under=95` to verify 95%+ coverage before documenting.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL]
**Prompt:**
Execute comprehensive quality verification:

1. Coverage: `npm run test -- --coverage --fail_under=95` — must show ≥95%
2. Security: `npm audit` + `eslint-plugin-security` — zero high/critical findings
3. File size: All `.ts` files ≤200 lines
4. Deployment: CI/CD pipeline functional (test → build → deploy)
5. Staging: Staging environment separate and accessible
6. Health checks: Worker health checks working, rollback triggered on failure
7. Payment: Checkout flow tested end-to-end
8. Subscriptions: Tier-based features enforced (free, pro, enterprise)
9. Usage tracking: Accurate per-Worker invocation counts
10. Rate limiting: Enforced per tier
11. Wrangler: Config valid for staging and production
12. Documentation: Complete and accessible (docs site live)
13. Tutorials: Video/GIF demos working, quickstart accurate

Report any blockers. All checks must pass.

---

## Quality Gate Checklist
□ 95%+ test coverage (vitest/jest)
□ ≤200 lines per source file (.ts)
□ Security scan clean (npm audit, eslint-plugin-security — zero high/critical)
□ No secrets in code (env vars only)
□ CI/CD pipeline working (test, build, deploy)
□ Staging environment functional and separate
□ Health checks implemented and working
□ Automatic rollback functional
□ Deployment notifications working
□ @finsavvyai/pay integrated
□ Checkout flow end-to-end tested
□ Subscription tiers enforced
□ Usage tracking accurate
□ Rate limiting working per tier
□ Cloudflare KV store for state persistence
□ Wrangler config valid
□ Documentation complete (site live)
□ Quickstart guide accurate and tested
□ API reference complete
□ Tutorials/demos working
□ Troubleshooting guide helpful
