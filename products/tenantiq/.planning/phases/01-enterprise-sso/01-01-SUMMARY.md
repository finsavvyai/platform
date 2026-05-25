---
phase: 01-enterprise-sso
plan: 01
subsystem: testing
tags: [vitest, tdd, sso, oidc, saml, jwt, workos, jit-provisioning, cert-monitoring]

requires: []
provides:
  - "4 RED test stubs locking in function signatures for Wave 1+2 SSO implementation"
  - "sso-login.test.ts: 5 tests for SSO-03 (login initiation) and SSO-06 (nonce TTL)"
  - "sso-callback.test.ts: 6 tests for SSO-03 (OIDC+SAML callbacks) and SSO-06 (state replay protection)"
  - "sso-jit.test.ts: 6 tests for SSO-04 (JIT upsert, INSERT OR IGNORE, concurrent race, auth_provider=sso)"
  - "sso-cert-monitor.test.ts: 6 tests for SSO-05 (cert expiry alerts at 60/30/7 days, metadata_url re-fetch)"
affects: [01-02, 01-03, enterprise-sso]

tech-stack:
  added: []
  patterns:
    - "TDD RED stubs: test files import from not-yet-created implementation paths to lock in function signatures"
    - "mockEnv pattern from sso.test.ts reused consistently across all 4 stubs (DB.prepare chain + KV.get/put/delete)"
    - "vi.stubGlobal('fetch', vi.fn()) for cron jobs that call fetch"
    - "WorkOS SDK mocked via vi.mock('@workos-inc/node-sdk') for callback tests"

key-files:
  created:
    - apps/api/src/routes/sso-login.test.ts
    - apps/api/src/routes/sso-callback.test.ts
    - apps/api/src/routes/sso-jit.test.ts
    - apps/api/src/cron/sso-cert-monitor.test.ts
  modified: []

key-decisions:
  - "Function signatures locked in by test stubs: handleSsoLogin, handleOidcCallback, handleSamlCallback, jitProvision, runSsoCertMonitor"
  - "KV nonce key format standardized as sso:state:{nonce} with expirationTtl=300"
  - "JIT provisioning uses INSERT OR IGNORE + re-fetch pattern for race-safe concurrent upserts"
  - "Cert expiry thresholds: 60, 30, 7 days only — 45 days is explicitly NOT a threshold"

patterns-established:
  - "Wave 0 TDD: test stubs created before any implementation, imports intentionally broken"
  - "Nonce lifecycle: KV.put on login initiation, KV.delete exactly once on callback success"
  - "Concurrent JIT: Promise.all of 5 calls must all return same ID via INSERT OR IGNORE"

requirements-completed: [SSO-01, SSO-02, SSO-03, SSO-04, SSO-05, SSO-06]

duration: 10min
completed: 2026-04-22
---

# Phase 01 Plan 01: Enterprise SSO — Wave 0 Test Stubs Summary

**Four Vitest RED stubs locking in OIDC/SAML login, JIT provisioning, and cert-monitor function signatures before any Wave 1 implementation begins**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-22T21:40:45Z
- **Completed:** 2026-04-22T21:50:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created 4 failing test stub files covering all 6 SSO requirements (SSO-01 through SSO-06)
- Locked in function signatures that Wave 1 and Wave 2 executors must implement exactly
- Established KV nonce lifecycle pattern: `sso:state:{nonce}` key, TTL=300, deleted on first use
- Established JIT upsert pattern: INSERT OR IGNORE + re-fetch for concurrent safety

## Task Commits

Each task was committed atomically:

1. **Task 1: sso-login.test.ts and sso-callback.test.ts stubs** - `75b6e33` (test)
2. **Task 2: sso-jit.test.ts and sso-cert-monitor.test.ts stubs** - `595b92c` (test)

## Files Created/Modified
- `apps/api/src/routes/sso-login.test.ts` - 5 tests: OIDC/SAML redirect (SSO-03), nonce TTL=300 (SSO-06)
- `apps/api/src/routes/sso-callback.test.ts` - 6 tests: missing/expired/replayed state (SSO-06), OIDC+SAML success + KV.delete once (SSO-03)
- `apps/api/src/routes/sso-jit.test.ts` - 6 tests: existing user, new user, INSERT OR IGNORE, re-fetch, concurrent race, auth_provider=sso (SSO-04)
- `apps/api/src/cron/sso-cert-monitor.test.ts` - 6 tests: alerts at 60/30/7 days, no alert at 45, skip no-cert, metadata_url fetch (SSO-05)

## Decisions Made
- Reused the `mockPrepare → mockBind → mockFirst/mockAll/mockRun` chain from existing `sso.test.ts` exactly — no new patterns invented
- All 4 stubs confirmed RED via vitest producing "Cannot find module" errors before any implementation
- WorkOS SDK mocked via `vi.mock('@workos-inc/node-sdk')` to isolate callback tests from external dependencies
- `vi.stubGlobal('fetch', vi.fn())` used in cert-monitor stub for metadata URL re-fetch test

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 test stubs exist and fail with "Cannot find module" — Wave 1 implementation can now begin
- Wave 1 must create: `sso-login.ts`, `sso-callback.ts`, `sso-jit.ts`, `sso-cert-monitor.ts`
- Each implementation file must export exactly the function signatures locked in by these stubs

---
*Phase: 01-enterprise-sso*
*Completed: 2026-04-22*
