---
phase: 01-enterprise-sso
plan: 05
subsystem: database
tags: [drizzle, d1, sqlite, sso, migrations, schema]

# Dependency graph
requires:
  - phase: 01-enterprise-sso
    provides: sso_connections table created in 0004_sso_connections.sql, sso-cert-monitor.ts querying cert_expires_at
provides:
  - D1 migration 0009_sso_cert_expires_at.sql adding cert_expires_at TEXT column to sso_connections
  - certExpiresAt field in ssoConnections Drizzle table definition (schema-d1.ts)
affects: [sso-cert-monitor, sso-settings, 01-enterprise-sso]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gap-closure migration: single-statement ALTER TABLE ADD COLUMN with NULL default for backward-safe D1 schema additions"

key-files:
  created:
    - packages/db/migrations/0009_sso_cert_expires_at.sql
  modified:
    - packages/db/src/schema-d1.ts

key-decisions:
  - "Migration named 0009_ to avoid collision with existing 0005_integrations.sql and other files up to 0008_partners.sql"
  - "certExpiresAt inserted between certificate and status fields to preserve logical column ordering"

patterns-established:
  - "Single-statement D1 migrations: one SQL statement per file for atomic, reviewable schema changes"

requirements-completed: [SSO-05]

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 01 Plan 05: SSO-05 Schema Gap Closure Summary

**cert_expires_at TEXT column added to sso_connections via D1 migration 0009 and Drizzle schema — unblocks stored-expiry fast path in runSsoCertMonitor**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-21T22:01:00Z
- **Completed:** 2026-04-21T22:05:58Z
- **Tasks:** 3 (2 code + 1 verification)
- **Files modified:** 2

## Accomplishments
- Created migration `0009_sso_cert_expires_at.sql` with single `ALTER TABLE sso_connections ADD COLUMN cert_expires_at TEXT` statement
- Added `certExpiresAt: text('cert_expires_at')` to the ssoConnections Drizzle table definition in schema-d1.ts
- Confirmed all 6 existing sso-cert-monitor.test.ts tests remain green after schema change

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cert_expires_at migration** - `66dcd3c` (chore)
2. **Task 2: Add certExpiresAt to Drizzle schema** - `71173db` (feat)
3. **Task 3: Confirm cert monitor tests still pass** - no commit (verification only, no code changes)

## Files Created/Modified
- `packages/db/migrations/0009_sso_cert_expires_at.sql` - Single-statement D1 migration adding cert_expires_at TEXT column to sso_connections
- `packages/db/src/schema-d1.ts` - Added certExpiresAt field to ssoConnections table definition

## Decisions Made
- Migration file named `0009_sso_cert_expires_at.sql` to sort after all existing migrations (highest existing was `0008_partners.sql`), avoiding any collision
- certExpiresAt placed after `certificate` and before `status` to maintain logical column grouping

## Deviations from Plan

None - plan executed exactly as written.

Note: schema-d1.ts is 617 lines (exceeds the 200-line file size target from CLAUDE.md). This is a pre-existing condition that predates this plan — only 1 line was added. A full refactor would require an architectural split of the schema file. Logged to deferred items.

## Issues Encountered

**Vitest include path mismatch:** Running `npx vitest run apps/api/src/cron/sso-cert-monitor.test.ts` from the repo root failed because the root vitest config's include pattern (`tests/**/*.test.ts`, `packages/*/src/**/*.test.ts`) does not cover `apps/api/src/`. Resolved by running from `apps/api/` where the local vitest config (`include: ['src/**/*.test.ts']`) covers the file correctly. All 6 tests passed.

## User Setup Required

None - no external service configuration required.

Apply migration to production D1 when ready:
```bash
cd apps/api && npx wrangler d1 migrations apply tenantiq-production --remote
```

## Next Phase Readiness
- SSO-05 requirement is now SATISFIED: `runSsoCertMonitor` can read a stored expiry date from D1 and the stored-expiry fast path is reachable in production
- cert_expires_at column defaults to NULL for all existing rows — `sso-cert-monitor.ts` handles NULL by falling back to certificate PEM parsing, which is correct behavior
- No further schema work needed for SSO cert monitoring

---
*Phase: 01-enterprise-sso*
*Completed: 2026-04-21*
