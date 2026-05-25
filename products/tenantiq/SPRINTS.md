# TenantIQ — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 2 · **Readiness:** 76% · **Stack:** TypeScript (SvelteKit, Svelte 5, CF Workers, Hono, Neon PostgreSQL, Drizzle ORM)
> **Timeline:** 7 days · **Ship by:** Week 5

---

## Pre-Sprint: Boost Test Coverage and Auth

### Agent A: Boost tests from 20 to 200+ (95% coverage) [PARALLEL]

**Prompt:**
TenantIQ currently has only 20 tests. Target 200+ tests with ≥95% coverage. (1) Audit `/tests/` directory, identify untested modules: identify auth routes, tenant CRUD, health scoring logic, API endpoints. (2) Write unit tests: `@unit` for each service function (create tenant, update health score, validate input). Use mocks/stubs for DB. (3) Write integration tests: `@integration` using test Neon PostgreSQL instance (spin up with `@testcontainers`). Test full flow: create user → create tenant → update metrics → health score calculated. (4) Write E2E tests: `@e2e` with Playwright — 5 browser personas: guest sees login, free-tier user creates tenant, pro-tier sees analytics, admin manages settings, expired user sees upgrade prompt. (5) Run `vitest --coverage --fail-under=95`. Acceptance: ≥200 tests, 95%+ coverage, all test types present.

### Agent B: Add payment with @finsavvyai/pay [PARALLEL]

**Prompt:**
TenantIQ needs SaaS billing. Install `@finsavvyai/pay` (npm), create payment provider: `createPaymentProvider('stripe', { apiKey })` (or Lemonsqueezy if preferred). Wire POST `/api/checkout` endpoint to create checkout session. Implement webhook handler at `/api/webhooks/payment` to handle subscription events. Update Neon PostgreSQL schema: add `users.subscription_plan` (free/pro/enterprise), `users.subscription_status` (active/expired), `users.expires_at`. On webhook `subscription.created`, insert into DB. On `subscription.expired`, mark user as expired. Create `/api/billing` endpoint to fetch user subscription. Test: checkout → redirect → webhook → subscription state persists. Run `vitest --coverage --fail-under=95`. Acceptance: Payment flow end-to-end, subscription state syncs, coverage maintained.

---

## Sprint Tasks

### Agent C: MSP onboarding wizard [PARALLEL]

**Prompt:**
TenantIQ targets Managed Service Providers (MSPs). Create onboarding wizard for multi-tenant management: (1) Step 1: "Connect your tenants" form — MSP provides tenant list (CSV import or manual entry: tenant name, domain, contact email). (2) Step 2: "Select metrics" — choose which metrics to monitor (uptime, CPU, memory, disk, custom). (3) Step 3: "Set thresholds" — define alert thresholds (CPU >80%, memory >85%, custom). (4) Step 4: "Configure integrations" — connect to Azure AD (app registration) or other directory services. (5) Step 5: "Review & activate" — summary, confirm, activate monitoring. Store wizard state in Neon PostgreSQL. Test: complete full wizard flow, metrics stored, alerts trigger on threshold breach. Acceptance: Wizard completes, tenants onboarded, monitoring active.

### Agent D: Azure AD guide + load testing + QA [SEQUENTIAL]

**Prompt:**
TenantIQ integrates with Azure AD. Create `/docs/AZURE_AD_SETUP.md` guide: (1) Prerequisites (Azure subscription, admin access). (2) App registration steps: create new app in Azure Portal, copy Client ID + Tenant ID, generate client secret. (3) Configure redirect URI: `https://tenantiq.yourdomain/auth/callback`. (4) Configure API permissions: read directory, read groups. (5) Code snippet: integrate Azure AD OAuth2 into TenantIQ. (6) Test app registration with provided test credentials. Load test TenantIQ: simulate 100 MSPs each managing 10 tenants = 1000 tenants querying health metrics. Use Apache JMeter: run 100 concurrent users, measure response time (target <500ms), CPU/memory usage. Document results in `/docs/LOAD_TESTING.md`. Run full QA: `vitest --coverage --fail-under=95`, `npm audit` zero high/critical, Apple HIG validation, browser personas. Acceptance: Azure AD guide complete, load testing shows acceptable performance, all QA passes.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL — after all above]

**Prompt:**
TenantIQ final QA: (1) `vitest --coverage --fail-under=95` across all packages — show coverage reports, minimum 95% required. (2) Max 200 lines: `find src -name '*.ts' -o -name '*.svelte' | xargs awk 'END{if(NR>200) print FILENAME": "NR" lines"}'`. (3) SOLID: service layer (TenantService, HealthScoringService), DI via constructors, no hardcoded DB clients. (4) Security: `npm audit` zero high/critical, no secrets in code, input validation via Zod. (5) Apple HIG: SF Pro fonts, 8pt grid, system colors, dark mode adaptive, ARIA labels on wizard steps, focus states, keyboard nav (Tab through form fields). (6) Browser personas: guest sees MSP login, free-tier user creates 1 tenant, pro-tier unlimited tenants + analytics, admin manages users/settings, expired user sees upgrade prompt. All workflows tested. (7) Load testing: 1000 tenants concurrent queries respond <500ms. (8) Azure AD: app registration guide complete, OAuth2 flow tested. Acceptance: All gates pass.

---

## Quality Gate Checklist

□ 95%+ test coverage (`vitest --coverage --fail-under=95`) — minimum 200 tests
□ ≤200 lines per source file
□ SOLID principles (TenantService, HealthScoringService, DI)
□ Security scan clean (`npm audit` zero high/critical)
□ No secrets in code (env vars only)
□ Input validation (Zod on all API inputs)
□ Apple HIG (SF Pro, 8pt grid, system colors, dark mode, ARIA, keyboard nav)
□ Payment integration (finsavvyai-pay with webhook validation)
□ MSP onboarding wizard complete (5-step flow)
□ Azure AD integration guide complete and tested
□ Load testing results (1000 tenants, <500ms response time)
□ Browser test personas: guest, free, pro, admin, expired — all pass
