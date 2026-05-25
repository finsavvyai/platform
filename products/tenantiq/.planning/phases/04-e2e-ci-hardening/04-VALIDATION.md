---
phase: 4
slug: e2e-ci-hardening
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit/integration) + Playwright 1.x (E2E) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run --reporter=dot` |
| **Full suite command** | `npm run test` (root — runs both workspaces) |
| **E2E command** | `npx playwright test` |
| **Estimated runtime** | ~15 seconds (unit) / ~60 seconds (E2E) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run --reporter=dot`
- **After every plan wave:** Run `npm run test`
- **After E2E changes:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite green + E2E green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| HARD-01-headers | 04-01 | 0 | HARD-01 | unit (middleware) | `cd apps/api && npx vitest run src/middleware/security-headers.test.ts` | ❌ Wave 0 | ⬜ pending |
| HARD-05-orgscope | 04-01 | 0 | HARD-05 | unit (cron guard) | `cd apps/api && npx vitest run src/lib/org-scope-assert.test.ts` | ❌ Wave 0 | ⬜ pending |
| HARD-06-indexes | 04-01 | 0 | HARD-06 | unit (migration) | `cd apps/api && npx vitest run src/lib/db-indexes.test.ts` | ❌ Wave 0 | ⬜ pending |
| E2E-01-login | 04-02 | 0 | E2E-01 | E2E stub | `npx playwright test tests/e2e/flows/msp-login.spec.ts` | ❌ Wave 0 | ⬜ pending |
| E2E-02-cis | 04-02 | 0 | E2E-02 | E2E stub | `npx playwright test tests/e2e/flows/cis-scan.spec.ts` | ❌ Wave 0 | ⬜ pending |
| E2E-03-sso | 04-02 | 0 | E2E-03 | E2E stub | already exists (tests/e2e/sso/) | ✅ exists | ⬜ pending |
| E2E-04-copilot | 04-02 | 0 | E2E-04 | E2E stub | `npx playwright test tests/e2e/flows/copilot-readiness.spec.ts` | ❌ Wave 0 | ⬜ pending |
| HARD-01-impl | 04-03 | 1 | HARD-01 | unit (GREEN) | `cd apps/api && npx vitest run src/middleware/security-headers.test.ts` | ✅ Wave 0 | ⬜ pending |
| HARD-02-ci | 04-05 | 1 | HARD-02 | CI lint | `grep -E 'semgrep\|sast' .github/workflows/ci.yml` | ✅ ci.yml | ⬜ pending |
| HARD-03-depaudit | 04-05 | 1 | HARD-03 | CI lint | `grep -E 'dependency-audit\|audit-ci' .github/workflows/ci.yml` | ✅ ci.yml | ⬜ pending |
| HARD-04-secrets | 04-05 | 1 | HARD-04 | CI lint | `grep gitleaks .github/workflows/ci.yml` | ✅ ci.yml | ⬜ pending |
| HARD-05-impl | 04-03 | 1 | HARD-05 | unit (GREEN) | `cd apps/api && npx vitest run src/lib/org-scope-assert.test.ts` | ✅ Wave 0 | ⬜ pending |
| HARD-06-impl | 04-03 | 1 | HARD-06 | unit (GREEN) | `cd apps/api && npx vitest run src/lib/db-indexes.test.ts` | ✅ Wave 0 | ⬜ pending |
| E2E-01-impl | 04-06 | 2 | E2E-01 | E2E (GREEN) | `npx playwright test tests/e2e/flows/msp-login.spec.ts` | ✅ Wave 0 | ⬜ pending |
| E2E-02-impl | 04-06 | 2 | E2E-02 | E2E (GREEN) | `npx playwright test tests/e2e/flows/cis-scan.spec.ts` | ✅ Wave 0 | ⬜ pending |
| E2E-04-impl | 04-06 | 2 | E2E-04 | E2E (GREEN) | `npx playwright test tests/e2e/flows/copilot-readiness.spec.ts` | ✅ Wave 0 | ⬜ pending |
| E2E-05-ci | 04-05 | 1 | E2E-05 | CI lint | `grep playwright .github/workflows/ci.yml` | ✅ ci.yml | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/middleware/security-headers.test.ts` — RED stubs: CSP header present, X-Frame-Options, XCTO, HSTS (HARD-01)
- [ ] `apps/api/src/lib/org-scope-assert.test.ts` — RED stubs: throws on null orgId, passes with valid orgId (HARD-05)
- [ ] `tests/e2e/flows/msp-login.spec.ts` — E2E stub: MSP login flow skeleton (E2E-01)
- [ ] `tests/e2e/flows/cis-scan.spec.ts` — E2E stub: CIS scan trigger + results skeleton (E2E-02)
- [ ] `tests/e2e/flows/copilot-readiness.spec.ts` — E2E stub: Copilot Readiness assessment skeleton (E2E-04)

*Note: D1 index verification done via migration file inspection, not unit test stubs*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI security gate blocks PR merge on real critical finding | HARD-02 | Requires live GitHub Actions run with injected vulnerability | Create test branch with a known-bad dep or hardcoded secret, open PR, verify CI fails and merge is blocked |
| CI dependency audit fails on high-severity dep | HARD-03 | Requires live GitHub Actions run with a known-vulnerable dep | Verify `pnpm audit --audit-level=high` exits non-zero on a branch with a vulnerable package |
| Playwright E2E green in GitHub Actions CI | E2E-05 | Requires full CI run with wrangler pages dev build | Push branch with E2E changes, verify `playwright` CI job passes in GitHub Actions |
| Security headers present in production response | HARD-01 | Requires deployed Worker | `curl -I https://api.tenantiq.com/health` and verify CSP/HSTS headers in response |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
