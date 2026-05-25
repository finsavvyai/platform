# OpenSyber — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 1 · **Readiness:** 82% · **Stack:** TypeScript (Next.js, Hono, CF Workers, D1, Clerk, LemonSqueezy)
> **Timeline:** 6 days · **Ship by:** Week 4

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Migrate tokenforge auth → @finsavvyai/auth [PARALLEL]

**Prompt:**
OpenSyber has `@opensyber/tokenforge` in `/packages/tokenforge/` — THIS IS THE SOURCE for the shared auth npm package. Extract `tokenforge` logic into `@finsavvyai/auth` (npm): JWT signing/verification, token refresh, OAuth2 flows. Move exports: `createToken()`, `verifyToken()`, `refreshToken()`, `parseJWT()` into `@finsavvyai/auth/jwt`. Move OAuth2 provider (Google, GitHub): `createOAuth2Provider()` into `@finsavvyai/auth/oauth`. Publish to npm. Update OpenSyber to import from new module. Run `vitest --coverage --fail-under=95`. Test: JWT lifecycle, OAuth2 redirect flow, token refresh. Acceptance: `@finsavvyai/auth` published to npm, OpenSyber uses it, auth flows work end-to-end.

### Agent B: Migrate DB schemas → @finsavvyai/db [PARALLEL]

**Prompt:**
OpenSyber uses Drizzle + D1 in `/packages/db/migrations/`. Extract schemas into `@finsavvyai/db` (npm): `users.ts`, `tokens.ts`, `subscriptions.ts`, `sessions.ts`. Move Drizzle setup to shared module: `export const createDB = (dbClient) => { return drizzle(dbClient) }`. Create migration templates in `@finsavvyai/db/migrations/`. Publish to npm. Update OpenSyber's D1 configuration to use shared schemas. Run migrations: `wrangler migrations apply`. Test: DB queries using shared schemas work, migrations apply cleanly. Run `vitest --coverage --fail-under=95`. Acceptance: `@finsavvyai/db` published, OpenSyber uses it, DB queries work.

---

## Sprint Tasks

### Agent C: Add payment with @finsavvyai/pay [PARALLEL]

**Prompt:**
OpenSyber needs subscription billing. Install `@finsavvyai/pay` (npm), create payment provider: `createPaymentProvider('lemonsqueezy', { apiKey, storeId })`. Wire endpoint `/api/checkout` to create session, webhook `/api/webhooks/payment` to handle events. Sync subscription state in D1: on `subscription.created`, insert into subscriptions table with plan (free/pro/enterprise), status, expires_at. On webhook `subscription.expired`, update status to 'expired'. Add `/api/billing` endpoint to fetch user's subscription state. Test checkout → webhook → subscription state update. Run `vitest --coverage --fail-under=95`. Acceptance: Payment flow works end-to-end, webhook validates, subscription state persists.

### Agent D: Production deploy + marketing site [SEQUENTIAL]

**Prompt:**
OpenSyber deploys to Cloudflare Pages + Workers. Prepare production: (1) Update `wrangler.toml` with production environment (env name, D1 binding name, KV namespace). (2) Configure DNS: OpenSyber.io custom domain, enable HTTPS (CF manages SSL). (3) Set production env vars: JWT_SECRET, LEMONSQUEEZY_API_KEY in CF Dashboard. (4) Create `/marketing/index.html` or Next.js page for opensyber.io landing page: hero (headline: "Zero-Trust Token Management"), features (3-4 cards), pricing, CTA. Follow Apple HIG: SF Pro fonts, 8pt grid, system colors, dark mode. (5) Deploy: `wrangler deploy --env production`. Test production URL works, landing page loads. Acceptance: opensyber.io resolves, HTTPS enabled, landing page renders, API endpoints respond.

### Agent E: Onboarding flow + beta recruitment [SEQUENTIAL]

**Prompt:**
OpenSyber targets early adopters. Create onboarding flow: (1) POST `/auth/signup` — create user account, send welcome email. (2) GET `/onboarding/step-1` — "Create your first token" form with docs link. (3) POST `/onboarding/verify-token` — user pastes token, validate format. (4) GET `/onboarding/complete` — success page with "Go to Dashboard" CTA. (5) Email templates: welcome, confirm email, token guide. Store in `/marketing/emails/`. Create beta waitlist form on landing page: `/api/waitlist` POST (email, company, use_case). Send confirmation email with onboarding link. Test: signup → email → verify token → dashboard access. Acceptance: Onboarding flow completes, confirmation emails send, users land in dashboard, beta recruitment form works.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL — after all above]

**Prompt:**
OpenSyber final QA: (1) `vitest --coverage --fail-under=95` across `/packages/` + `/apps/` — show all coverage. (2) Max 200 lines: `find src -name '*.ts' -o -name '*.tsx' | xargs awk 'END{if(NR>200) print FILENAME": "NR" lines"}'`. (3) SOLID: auth service, payment service, DB layer all interface-driven, DI via constructors. (4) Security: `npm audit` zero high/critical, no secrets in code, CORS whitelist configured. (5) Zod validation on all API inputs (signup, token creation, checkout). (6) Apple HIG: SF Pro fonts, 8pt grid, system colors, dark/light mode, ARIA labels, focus states, keyboard nav. (7) Browser personas: guest sees landing + signup, free-tier user creates tokens, pro subscriber sees advanced features, admin manages API keys, expired user sees re-subscribe prompt. (8) Production deploy: opensyber.io resolves, HTTPS works, APIs respond. Acceptance: All gates pass.

---

## Quality Gate Checklist

□ 95%+ test coverage (`vitest --coverage --fail-under=95`)
□ ≤200 lines per source file
□ SOLID principles (service layer, DI, factory pattern)
□ Security scan clean (`npm audit` zero high/critical)
□ No secrets in code (env vars only)
□ Input validation (Zod on signup, token, checkout)
□ Apple HIG (SF Pro, 8pt grid, system colors, dark mode, ARIA, keyboard nav)
□ tokenforge extracted → @finsavvyai/auth published
□ Drizzle schemas extracted → @finsavvyai/db published
□ Payment integration (finsavvyai-pay with webhook validation)
□ Production deploy to opensyber.io (CF Pages + Workers, custom domain, HTTPS)
□ Onboarding flow complete (signup → token verification → dashboard)
□ Beta recruitment form active
□ Browser test personas: guest, free, pro, admin, expired — all pass
