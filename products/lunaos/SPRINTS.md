# Luna-OS — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 1 · **Readiness:** 92% · **Stack:** TypeScript (Hono, React, Next.js, Three.js, Expo, Prisma, D1, LemonSqueezy)
> **Timeline:** 5 days · **Ship by:** Week 3

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Integrate @finsavvyai/test-config across 8 packages [PARALLEL]

**Prompt:**
Luna-OS has 8 repositories (lunaos-engine, lunaos-mobile, lunaos-web, lunaos-ai, etc.). Each needs standardized test configuration. Install `@finsavvyai/test-config` in each `package.json`, create `vitest.config.ts` in each repo extending the shared config, migrate existing Jest/Vitest setup to use the shared config. Export test fixture factories from each package's `tests/fixtures/` directory. Verify `vitest run --coverage` achieves 95%+ in each repo. Acceptance: All 8 repos pass `vitest --coverage --fail-under=95`.

### Agent B: Activate LemonSqueezy payment with @finsavvyai/pay [PARALLEL]

**Prompt:**
Luna-OS has custom LemonSqueezy integration in `/lunaos-web/`. Replace with `@finsavvyai/pay` npm package. Install the package, extract LemonSqueezy API key to `.env`, create a payment factory using `createPaymentProvider('lemonsqueezy', { apiKey, storeId })`, wire webhook verification into `/api/webhooks/payment`. Test checkout flow end-to-end. Acceptance: Webhook signatures validate, checkout redirects to LemonSqueezy, receipt email sends on webhook success.

---

## Sprint Tasks

### Agent C: Final QA pass + production domain setup [SEQUENTIAL]

**Prompt:**
Run complete QA across all 8 Luna-OS packages: (1) Unit test coverage ≥95% via `vitest --coverage --fail-under=95`, (2) Max 200 lines per source file check, (3) Security scan: `npm audit` zero high/critical, (4) Apple HIG review — verify SF Pro typography, 8pt grid, dark mode, ARIA labels on all buttons/inputs, focus states 2px outline, keyboard navigation works (Tab, Enter/Space). (5) Production domain: Configure DNS CNAME for luna-os.com, enable HTTPS, add CSP headers. Acceptance: All checks pass, production domain resolves.

### Agent D: App Store submission prep [SEQUENTIAL]

**Prompt:**
Luna-OS mobile (Expo/React Native) targets iOS App Store. Prepare submission: (1) Update `app.json` with correct bundle ID, version number (e.g., 1.0.0), icon 1024×1024 in `/assets/icon.png`. (2) Generate provisioning profile via Xcode/Apple Developer. (3) Build signed IPA with Expo: `eas build --platform=ios --auto-submit`. (4) Acceptance: Build succeeds, TestFlight beta installs and authenticates. (5) Draft App Store listing with screenshots, description, keywords. Acceptance: Build artifact ready for TestFlight submission.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL — after all above]

**Prompt:**
Verify Luna-OS passes all quality gates: (1) `vitest --coverage --fail-under=95` across all 8 packages (show coverage reports). (2) Line count: `find src/ -name '*.ts' -o -name '*.tsx' | xargs awk 'END{if(NR>200) print FILENAME": "NR" lines"}'`. (3) Security: `npm audit` shows zero high/critical. (4) Apple HIG: SF Pro typography, 8pt grid spacing, system colors, dark mode adaptive, ARIA labels 100%, focus states visible, keyboard navigation works. (5) Browser personas: Test as unauthenticated guest, free-tier user, pro subscriber, admin, expired user. All auth flows work. Acceptance: All checks pass, no blockers.

---

## Quality Gate Checklist

□ 95%+ test coverage (`vitest --coverage --fail-under=95`)
□ ≤200 lines per source file
□ SOLID principles (interfaces, DI)
□ Security scan clean (`npm audit` zero high/critical)
□ No secrets in code (`.env` only)
□ Input validation (Zod schemas on all API inputs)
□ Apple HIG (SF Pro, 8pt grid, system colors, dark mode, ARIA, keyboard nav)
□ AI features: structured output, fallback chains ([if applicable])
□ Payment activation: LemonSqueezy webhooks validated
□ Browser test personas: guest, free, pro, admin, expired — all pass
