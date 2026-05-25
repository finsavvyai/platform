---
phase: 04-e2e-ci-hardening
plan: "01"
subsystem: api-middleware-testing
tags: [tdd, security-headers, org-scope, red-stubs, wave-0]
dependency_graph:
  requires: []
  provides: [security-headers-test-contract, org-scope-assert-test-contract]
  affects: [04-02-PLAN.md]
tech_stack:
  added: []
  patterns: [tdd-red-stub, hono-test-app-pattern]
key_files:
  created:
    - apps/api/src/middleware/security-headers.test.ts
    - apps/api/src/lib/org-scope-assert.test.ts
  modified: []
decisions:
  - "security-headers.ts accesses c.env.ENVIRONMENT without optional chaining — tests pass minimal env object {ENVIRONMENT: 'production'} to avoid crash; production behavior (HSTS) is exercised by default"
  - "security-headers tests are GREEN not RED — implementation already exists and is wired; test file is still the required contract artifact for Wave 1 greenfield changes"
  - "org-scope-assert.test.ts is confirmed RED — module-not-found error at import; implementation deferred to Wave 1 plan 04-02"
  - "post-next() override behavior documented in test: middleware wins (DENY) over route-set SAMEORIGIN"
metrics:
  duration_minutes: 1
  completed_date: "2026-04-22"
  tasks_completed: 2
  files_changed: 2
requirements: [HARD-01, HARD-05]
---

# Phase 04 Plan 01: Wave 0 TDD RED Stubs — Security Headers + Org Scope Summary

**One-liner:** TDD contract test stubs for security-headers middleware (HARD-01) and assertOrgId guard (HARD-05), establishing Wave 1 implementation targets.

## What Was Built

Two test files establishing behavioral contracts for Wave 1 plans:

1. **`apps/api/src/middleware/security-headers.test.ts`** (70 lines, GREEN) — 6 tests asserting all 5 required security headers on 200 and 4xx responses, plus middleware override behavior.

2. **`apps/api/src/lib/org-scope-assert.test.ts`** (37 lines, RED) — 6 tests for `assertOrgId` function covering null, undefined, empty string, valid id, and error message format. RED state confirmed — module-not-found at import.

## Task Outcomes

| Task | Name | Commit | Status | Files |
|------|------|--------|--------|-------|
| 1 | security-headers.test.ts | c21621f | GREEN (impl exists) | apps/api/src/middleware/security-headers.test.ts |
| 2 | org-scope-assert.test.ts | db6243b | RED (module missing) | apps/api/src/lib/org-scope-assert.test.ts |

## Test Cases

### security-headers.test.ts
1. sets Content-Security-Policy with `default-src 'self'`
2. sets X-Frame-Options: DENY
3. sets X-Content-Type-Options: nosniff
4. sets Strict-Transport-Security with `max-age=31536000` in production
5. sets all security headers on 4xx responses (404)
6. middleware overwrites X-Frame-Options set by route handler (post-next() wins)

### org-scope-assert.test.ts
1. throws on null — message contains `[TestCron]`
2. throws on undefined — message contains `[TestRoute]`
3. throws on empty string — message contains `[TestHandler]`
4. does not throw for a valid org id
5. thrown error message includes `org_id scope required`
6. thrown error message includes context name in brackets

## RED Confirmation

```
FAIL  src/lib/org-scope-assert.test.ts
Error: Cannot find module './org-scope-assert' imported from .../org-scope-assert.test.ts
Test Files  1 failed | 1 passed (2)
```

## Decisions Made

1. **Minimal env object for security-headers tests:** `security-headers.ts` calls `c.env.ENVIRONMENT` without optional chaining. Tests supply `{ ENVIRONMENT: 'production' }` as the third argument to `app.request()` to prevent runtime crash. Production behavior (HSTS included) is the default test mode.

2. **security-headers tests are GREEN, not RED:** The implementation file already exists and is correctly wired. The plan's intent was to create the test file as a contract artifact — this is fulfilled. Wave 1 (04-02) greenfield changes will be validated against this contract.

3. **Post-next() override documented:** The middleware calls `c.header()` after `await next()`, which means it overwrites any headers set by route handlers. Test #6 documents this explicitly.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- The plan described security-headers tests as potentially RED (import or assertion failure). Since the implementation already exists, tests are GREEN. This is acceptable — the contract is established.

## Self-Check: PASSED

- FOUND: apps/api/src/middleware/security-headers.test.ts
- FOUND: apps/api/src/lib/org-scope-assert.test.ts
- FOUND commit c21621f: test(04-01): add security-headers middleware TDD contract tests
- FOUND commit db6243b: test(04-01): add assertOrgId TDD RED stub for HARD-05
