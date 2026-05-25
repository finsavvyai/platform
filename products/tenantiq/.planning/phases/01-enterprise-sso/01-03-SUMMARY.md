---
phase: 01-enterprise-sso
plan: 03
subsystem: auth
tags: [sso, jit-provisioning, d1, insert-or-ignore, race-condition, cloudflare-workers]

requires:
  - phase: 01-enterprise-sso/01-01
    provides: "sso-jit.test.ts RED stub with 6 tests locking in jitProvision() signature"

provides:
  - "jitProvision(db, orgId, email, name, role?) — race-safe upsert returning canonical platform_users.id"
  - "INSERT OR IGNORE + re-fetch pattern for concurrent SSO assertion safety"

affects: [01-04, sso-callback]

tech-stack:
  added: []
  patterns:
    - "INSERT OR IGNORE + re-fetch: inserts with a UUID but re-fetches canonical ID after insert to handle concurrent races"
    - "auth_provider bound as parameter (not SQL literal) so test mocks can assert 'sso' value"

key-files:
  created:
    - apps/api/src/routes/sso-jit.ts
  modified: []

key-decisions:
  - "Bind 'sso' as a parameter in INSERT statement (not SQL literal) — required for test mock assertions on bind calls"
  - "display_name defaults to email when name argument is null"

patterns-established:
  - "JIT upsert: SELECT → INSERT OR IGNORE → SELECT — three DB calls, last SELECT always wins"

requirements-completed: [SSO-04]

duration: 5min
completed: 2026-04-22
---

# Phase 01 Plan 03: Enterprise SSO — JIT Provisioning Summary

**Race-safe `jitProvision()` in sso-jit.ts using INSERT OR IGNORE + re-fetch — creates platform_users row on first SSO login, returns canonical ID for both new and returning users**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T00:44:00Z
- **Completed:** 2026-04-22T00:44:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Implemented `jitProvision()` with the three-step INSERT OR IGNORE + re-fetch pattern
- All 6 sso-jit.test.ts tests GREEN including concurrent race scenario (5x Promise.all returns same ID)
- `auth_provider` bound as SQL parameter (not literal) so test mocks can verify `'sso'` value
- File is 55 lines (well under 200-line limit), no external dependencies, no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement sso-jit.ts** - `0a835b0` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified
- `apps/api/src/routes/sso-jit.ts` - JIT provisioning: SELECT existing → INSERT OR IGNORE → re-fetch canonical ID

## Decisions Made
- Bound `'sso'` as a `?` parameter in the INSERT rather than embedding it as a SQL literal — test mock inspects `mockBind.mock.calls` for the value `'sso'`, so it must be in the bind args not the SQL string.
- `display_name` defaults to `email` when `name` is null, matching the plan interface specification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed 'sso' and 'org' from SQL literals to bound parameters**
- **Found during:** Task 1 (first test run)
- **Issue:** Initial implementation had `'sso'` and `'org'` hardcoded in the SQL string; the `auth_provider='sso'` test checks `mockBind.mock.calls` for the value `'sso'` — it was not found because it was in the SQL, not the bind args
- **Fix:** Changed VALUES from `(?, ?, ?, ?, ?, 'sso', 'org', ?)` to `(?, ?, ?, ?, ?, ?, ?, ?)` and added `'sso', 'org'` as bind parameters
- **Files modified:** apps/api/src/routes/sso-jit.ts
- **Verification:** All 6 tests pass after fix
- **Committed in:** 0a835b0 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — SQL literal vs bound parameter)
**Impact on plan:** Fix was necessary for test compliance; functionally equivalent behavior in production (D1 treats both identically).

## Issues Encountered
None beyond the SQL literal vs. parameter fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `sso-jit.ts` exports `jitProvision` — ready to be imported by `sso-callback.ts` (01-04) via `import { jitProvision } from './sso-jit'`
- Three remaining stubs (sso-login.test.ts, sso-callback.test.ts, sso-cert-monitor.test.ts) still need implementation

---
*Phase: 01-enterprise-sso*
*Completed: 2026-04-22*
