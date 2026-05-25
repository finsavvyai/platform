# MCPOverflow — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 4 · **Readiness:** 55% · **Stack:** TypeScript (React, Vite, Go/Gin, Supabase, Cloudflare Workers)
> **Timeline:** 8 days · **Ship by:** Week 10

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Reimplement deleted generator.ts [PARALLEL]
**Prompt:**
Reimplement the MCPOverflow generator.ts module that was deleted. This module generates MCP server templates and scaffolding. Create template engine supporting TypeScript, Python, Go stacks. Implement features: generate project structure, install dependencies, create example tools, setup testing, documentation templates. Support customization via CLI prompts (project name, language, tools). Ensure generated projects follow QUALITY_STANDARDS.md (95% coverage, ≤200 lines per file). Test generation with multiple configurations. Create examples for each stack. Ensure generator code ≤200 lines per file. Run `npm audit` for zero high/critical vulnerabilities.

### Agent B: Monorepo cleanup (remove 8 duplicates) [PARALLEL]
**Prompt:**
Clean up MCPOverflow monorepo by removing 8 duplicate applications. Audit current monorepo structure: identify duplicates (copy-pasted apps, redundant implementations). Document each duplicate: path, contents, which version to keep. Create migration plan: consolidate duplicates into shared libraries or single canonical version. Move shared logic to `packages/shared/`. Update root package.json and workspace configuration. Update import paths across remaining projects. Verify all tests still pass. Ensure no code is lost (archive duplicates to git history). Run build to verify no breakage. Document monorepo structure in README.

---

## Sprint Tasks

### Agent C: Unit tests for core + billing [PARALLEL]
**Prompt:**
Create comprehensive unit test suite for MCPOverflow core modules and billing system. Write @unit tests for generator (template generation, customization). Test billing integration using `@finsavvyai/pay`. Create tests for payment flow: create subscription, handle webhook, update billing status. Add @integration tests with test database (Supabase test project). Implement test fixtures for different user tiers (free, pro, enterprise). Test usage tracking and rate limiting. Target 95%+ coverage. Run `npm run test:coverage --fail_under=95`. Document test patterns and conventions. Create test data builders.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL]
**Prompt:**
Execute comprehensive quality verification:

1. Coverage: `vitest --coverage --fail_under=95` — must show ≥95%
2. Security: `npm audit` + `eslint-plugin-security` — zero high/critical findings
3. File size: All `.ts` files ≤200 lines
4. Generator: Template generation works for TS/Python/Go stacks
5. Generated projects: Follow QUALITY_STANDARDS.md (95% coverage, ≤200 lines)
6. Monorepo: No duplicates remain, shared code consolidated
7. Imports: All import paths updated, no broken references
8. Build: Full monorepo builds without errors
9. Billing: Payment flow tested, subscriptions enforce correctly
10. Usage tracking: Accurate per-user usage reported
11. Database: Supabase schema valid, migrations apply cleanly
12. API: Endpoints tested with contract tests

Report any blockers. All checks must pass.

---

## Quality Gate Checklist
□ 95%+ test coverage (vitest)
□ ≤200 lines per source file (.ts)
□ Security scan clean (npm audit, eslint-plugin-security — zero high/critical)
□ No secrets in code (env vars only)
□ Generator.ts reimplemented (TS, Python, Go templates)
□ Template generation tested (multiple configurations)
□ Monorepo cleanup complete (8 duplicates removed)
□ Shared libraries consolidated
□ Import paths updated throughout
□ Build passes without errors
□ Supabase auth working (@supabase/supabase-js)
□ @finsavvyai/pay integrated (billing tested)
□ Payment flow end-to-end tested
□ Subscription tiers enforced
□ Usage tracking accurate
□ Rate limiting working
