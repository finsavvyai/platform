# Qestro — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 2 · **Readiness:** 78% · **Stack:** TypeScript (React, Vite, CF Workers, Drizzle ORM, D1, Playwright, Maestro, LemonSqueezy)
> **Timeline:** 7 days · **Ship by:** Week 5

---

## Pre-Sprint: Architecture Decision and AI Integration

### Agent A: Resolve architecture — commit to CF Workers + @finsavvyai/cf-stack [PARALLEL]

**Prompt:**
Qestro backend architecture is undecided (Workers vs Node.js). Commit to Cloudflare Workers + `@finsavvyai/cf-stack` (npm module extracted from CoderailFlow). Install `@finsavvyai/cf-stack`, create Hono app in `/apps/api/src/index.ts`, export handler: `export default app`. Set up `/apps/api/wrangler.toml` with D1 binding. Migrate existing backend logic to Workers: auth routes, test execution routes, results storage. Use shared middleware from cf-stack. Deploy locally: `wrangler dev`, verify endpoints respond. Run `vitest --coverage --fail-under=95`. Acceptance: Architecture committed to Workers, cf-stack integrated, endpoints functional, coverage ≥95%.

### Agent B: Implement AI test generation with @finsavvyai/llm [PARALLEL]

**Prompt:**
Qestro needs AI-powered test generation. Install `@finsavvyai/llm` (npm), create test generator service at `/apps/api/src/services/testGenerator.ts`. Feature: user uploads app screenshot or description → LLM generates test steps (JSON format with actions, assertions, expected results). (1) Create prompt template: `"Generate mobile test steps for [platform] app that [description]. Output as JSON array of test steps."`. (2) Use `@finsavvyai/llm` with structured output (JSON schema). (3) Support multi-provider: Anthropic → OpenAI → fallback. (4) Cache identical prompts (dedupe). (5) Add cost tracking (log model, tokens, cost per request). Test generation: upload screenshot → 5 test steps generated in <10s. Write unit tests. Run `vitest --coverage --fail-under=95`. Acceptance: Test generation works, output is valid JSON, cost tracking enabled, tests pass.

---

## Sprint Tasks

### Agent C: Frontend restoration [PARALLEL]

**Prompt:**
Qestro React frontend needs restoration. Audit `/apps/web/`: identify broken imports, missing components, outdated dependencies. Update `package.json` dependencies to latest stable versions. Fix component structure: ensure all pages (Dashboard, Test Editor, Results) import correctly. Restore dark mode support via `prefers-color-scheme`. Follow Apple HIG: SF Pro typography, 8pt grid, system colors (#007AFF primary), ARIA labels on buttons/forms, focus states 2px outline, keyboard Tab navigation. Test 5 browser personas: guest sees login, free-tier user creates test, pro-tier user runs tests, admin views analytics, expired user sees upgrade CTA. Run `vitest --coverage --fail-under=95`. Acceptance: Frontend builds without errors, all pages render, dark mode works, Apple HIG compliant, coverage ≥95%.

### Agent D: Payment activation + QA [SEQUENTIAL]

**Prompt:**
Qestro needs LemonSqueezy payment activation. Install `@finsavvyai/pay` (npm), configure for LemonSqueezy (extract API key from `.env`). Create POST `/api/checkout` endpoint to create checkout session with plan selection. Implement webhook handler at `/api/webhooks/payment` to handle subscription events. Update D1 schema: add `users.subscription_plan` (free/pro/enterprise), `users.subscription_status`, `users.expires_at`. On webhook `subscription.created`, insert into DB. On `subscription.expired`, mark expired. Test: checkout flow → webhook triggers → subscription state updates correctly. Run full QA: `vitest --coverage --fail-under=95` across API + frontend, `npm audit` zero high/critical, Apple HIG final pass, max 200 lines per file. Acceptance: Payment flow complete, QA gates pass, zero blockers.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL — after all above]

**Prompt:**
Qestro final QA: (1) `vitest --coverage --fail-under=95` across `/apps/api` + `/apps/web` — show coverage reports. (2) Max 200 lines: `find src -name '*.ts' -o -name '*.tsx' | xargs awk 'END{if(NR>200) print FILENAME": "NR" lines"}'`. (3) SOLID: test generator service, payment service, auth service all interface-driven, DI via constructors. (4) Security: `npm audit` zero high/critical, no secrets in code, CORS configured. (5) Zod validation on: POST `/tests` (test definition), POST `/execute` (execution params), POST `/checkout` (plan selection). (6) Apple HIG: SF Pro fonts, 8pt grid, system colors, dark mode adaptive, ARIA labels 100%, focus states visible, keyboard Tab/Enter/Space work. (7) Browser personas: guest, free, pro, admin, expired — all test workflows functional. (8) AI features: structured output (JSON schema validated), fallback chains (multi-provider), cost tracking logged, caching works. Acceptance: All gates pass.

---

## Quality Gate Checklist

□ 95%+ test coverage (`vitest --coverage --fail-under=95`)
□ ≤200 lines per source file
□ SOLID principles (TestGenerator service, Payment service, DI)
□ Security scan clean (`npm audit` zero high/critical)
□ No secrets in code (env vars only)
□ Input validation (Zod on test definition, execution, checkout)
□ Apple HIG (SF Pro, 8pt grid, system colors, dark mode, ARIA, keyboard nav)
□ Architecture committed: CF Workers + @finsavvyai/cf-stack
□ AI test generation (finsavvyai-llm with structured output, fallback, caching)
□ Frontend restored (all pages render, dark mode works, dependencies updated)
□ Payment activation (LemonSqueezy + webhook validation)
□ Browser test personas: guest, free, pro, admin, expired — all pass
