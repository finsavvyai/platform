---
phase: 04-e2e-ci-hardening
plan: "03"
subsystem: security-hardening
tags: [security-headers, org-scope, d1-indexes, csp, middleware, performance]
dependency_graph:
  requires: [04-01]
  provides: [HARD-01, HARD-05, HARD-06]
  affects: [create-app, security-headers, org-scope-assert, schema-d1]
tech_stack:
  added: []
  patterns: [post-next security headers, TypeScript assertion predicates, compound D1 indexes]
key_files:
  created:
    - apps/api/src/lib/org-scope-assert.ts
    - packages/db/migrations/0010_add_compound_indexes.sql
  modified:
    - apps/api/src/app/create-app.ts
    - packages/db/src/schema-d1.ts
decisions:
  - "Migration numbered 0010 (not 0007 as planned) — existing D1 migrations already reach 0009; sequential numbering preserved"
  - "Both hono/secure-headers and custom securityHeaders coexist — no conflict; hono handles preflight, custom sets CSP post-next"
  - "D1 drizzle.config.ts targets PostgreSQL schema.ts; migration SQL written manually for D1 (correct approach)"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_modified: 4
  files_created: 2
---

# Phase 04 Plan 03: Security Hardening Wave 1 Summary

**One-liner:** CSP middleware wired into Hono app, assertOrgId TypeScript assertion guard created, and 7 compound D1 indexes added with migration SQL for multi-tenant query performance.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Wire securityHeaders in create-app.ts (HARD-01) | ba7d999 | DONE |
| 2 | Create org-scope-assert.ts + HARD-05 tests GREEN | fbf43ea | DONE |
| 3 | Add compound D1 indexes + migration SQL (HARD-06) | 2e02832 | DONE |

## Test Results

**Before:** org-scope-assert.test.ts was RED (module not found). security-headers.test.ts was already GREEN (middleware existed but wasn't wired into app).

**After:**
- `security-headers.test.ts`: 6/6 tests PASSING
- `org-scope-assert.test.ts`: 6/6 tests PASSING
- Total: 12/12 tests GREEN

## Changes Made

### Task 1: create-app.ts — securityHeaders wired (HARD-01)

Added import and middleware registration:
```typescript
import { securityHeaders } from '../middleware/security-headers';
// ...
app.use('*', securityHeaders); // after existing secureHeaders block
```

The `security-headers.ts` import path `'../index'` was already valid — `index.ts` re-exports `AppEnv` from `./app/types`.

### Task 2: org-scope-assert.ts — assertOrgId guard (HARD-05)

New file (~15 lines). TypeScript assertion predicate enforcing org-scope at runtime:
```typescript
export function assertOrgId(
  orgId: string | null | undefined,
  context: string
): asserts orgId is string {
  if (!orgId) {
    throw new Error(`[${context}] org_id scope required — no query may run without tenant context`);
  }
}
```

### Task 3: schema-d1.ts + migration — compound indexes (HARD-06)

7 new compound indexes added to schema-d1.ts:

| Index Name | Table | Columns |
|------------|-------|---------|
| `idx_alerts_tenant_detected` | security_alerts | tenant_id, detected_at |
| `idx_audit_logs_org_created` | audit_logs | org_id, created_at |
| `idx_config_drifts_tenant_detected` | config_drifts | tenant_id, detected_at |
| `idx_config_snapshots_tenant_created` | config_snapshots | tenant_id, created_at |
| `idx_copilot_tenant_created` | copilot_assessments | tenant_id, created_at |
| `idx_storage_tenant_created` | storage_analytics | tenant_id, created_at |
| `idx_sync_jobs_tenant_created` | sync_jobs | tenant_id, created_at |

Migration file: `packages/db/migrations/0010_add_compound_indexes.sql`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deviation] Migration file numbered 0010, not 0007**
- **Found during:** Task 3
- **Issue:** Plan specified `0007_add_compound_indexes.sql` but existing D1 migrations already have files numbered through 0009 (`0009_sso_cert_expires_at.sql`). Creating 0007 would break sequential ordering.
- **Fix:** Created `0010_add_compound_indexes.sql` to maintain correct sequence.
- **Files modified:** packages/db/migrations/0010_add_compound_indexes.sql
- **Commit:** 2e02832

**2. [Note] `npm run db:generate` uses PostgreSQL schema**
- **Found during:** Task 3
- **Issue:** `packages/db/drizzle.config.ts` targets `schema.ts` (PostgreSQL dialect), not `schema-d1.ts`. Running `npm run generate` generates a PostgreSQL migration (not D1).
- **Fix:** Migration SQL written manually — correct approach for D1 (SQLite) which has its own sequential migration files in `packages/db/migrations/`.

## Self-Check: PASSED

All files confirmed present and all commits verified:
- apps/api/src/lib/org-scope-assert.ts: FOUND
- packages/db/migrations/0010_add_compound_indexes.sql: FOUND
- securityHeaders wired in create-app.ts: FOUND
- 7 compound indexes in schema-d1.ts: FOUND
- Commits ba7d999, fbf43ea, 2e02832: all FOUND
