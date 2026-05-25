---
phase: 03-storage-scanner-fix
plan: "01"
subsystem: testing
tags: [vitest, storage, onedrive, sharepoint, tdd, graph-api]

requires:
  - phase: 02-frontend-completions
    provides: Storage Analytics UI components and storage-scanner.ts with hard-capped sequential implementation

provides:
  - Failing RED test (Test C) proving .slice(0,100) hard-cap blocks tenants >100 users
  - Three regression-guard GREEN tests (A, B, D) that Wave 1 must keep passing
  - Locked function signature contract: scanOneDriveUsage(graph) / scanSharePointUsage(graph)

affects:
  - 03-02 (Wave 1 — must turn Test C GREEN by removing .slice and adding batch parallelism)

tech-stack:
  added: []
  patterns:
    - "TDD RED stub: append new it() cases to existing describe blocks without modifying existing tests"
    - "Hard-cap regression: 150-user mock forces slice(0,100) failure at toHaveLength(150)"

key-files:
  created: []
  modified:
    - apps/api/src/lib/storage/storage-scanner.test.ts

key-decisions:
  - "Primary RED gate is Test C (150-user mock) — Tests A, B, D are GREEN regression guards, not RED gates"
  - "Test B uses u1 (not u2) as the rejected user — consistent with mock path match on /u1/drive"

patterns-established:
  - "Append-only TDD: new tests appended inside existing describe blocks, existing lines untouched"

requirements-completed:
  - STOR-05

duration: 2min
completed: 2026-04-22
---

# Phase 03 Plan 01: Storage Scanner Fix — TDD Stubs Summary

**Four test stubs appended to storage-scanner.test.ts establishing STOR-05 batch-parallelism contract, with Test C (150-user hard-cap) confirmed RED at toHaveLength(150) got 100**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-22T08:57:19Z
- **Completed:** 2026-04-22T08:59:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Appended four new test cases to `storage-scanner.test.ts` without touching existing 88 lines
- Confirmed RED state: Test C (`removes hard-cap`) fails with `expected 100 to equal 150` (`.slice(0,100)` truncates the 150-user mock)
- Tests A, B, D confirmed GREEN — regression guards for Wave 1 to maintain
- Total test count: 9 (was 5)

## Task Commits

1. **Task 1: Append four failing test cases to storage-scanner.test.ts** - `c0ccd80` (test)

**Plan metadata:** (final docs commit — see below)

## Files Created/Modified
- `apps/api/src/lib/storage/storage-scanner.test.ts` — 63 lines appended: Tests A (15-user chunk regression), B (sibling-skip regression), C (150-user hard-cap RED gate), D (15-site SharePoint regression)

## Decisions Made
- Test B rejects `u1/drive` (not `u2/drive`) — the mock's `path.includes('u1/drive')` catch is evaluated before the catch-all, so Bob (u1) is the skipped user and Alice (u0) + Carol (u2) are the two survivors
- Test C is the sole RED gate; Tests A, B, D are kept GREEN as documented regression guards for Wave 1

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- RED gate established: `removes hard-cap` test fails with `expected 100 to equal 150`
- Wave 1 (03-02) must: remove `.slice(0,100)` from `scanOneDriveUsage`, implement chunked `Promise.all` batching (chunk size 10), and keep all 8 regression-guard tests GREEN
- Concern (from STATE.md): D1 compound index audit on `(organization_id, created_at)` still pending before Storage Analytics queries add analytical load

---
*Phase: 03-storage-scanner-fix*
*Completed: 2026-04-22*
