---
phase: 02-frontend-completions
plan: "02"
subsystem: api-data-layer
tags: [copilot-readiness, drift-detection, alerts, types]
dependency_graph:
  requires: [02-01]
  provides: [license-summary-endpoint, drift-alert-metadata, alert-metadata-type]
  affects: [02-03, 02-04]
tech_stack:
  added: []
  patterns: [kv-cached-assessment-parse, json-metadata-in-d1, drizzle-select-mapping]
key_files:
  created: []
  modified:
    - apps/api/src/routes/copilot-readiness.ts
    - apps/api/src/lib/snapshots/drift-detector.ts
    - packages/shared/src/types.ts
    - apps/api/src/routes/alerts.ts
decisions:
  - "v1 license-summary parses numeric counts from human-readable detail strings; structured numeric fields deferred to v2"
  - "overshareRiskCount uses public group count as proxy for oversharing risk (OVER-01 tracks per-user report)"
  - "labelGapCount uses published label count as label coverage signal (Purview unlabeled file count is v2)"
  - "alerts.ts JSON.parse applied at response mapping layer, not in Drizzle schema layer"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 02: API Data Layer Gaps Summary

**One-liner:** Added GET /copilot-readiness/license-summary endpoint with KV-parse logic, patched drift alert metadata with snapshotId/baselineId, and exposed metadata field in shared Alert type + alerts query.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add GET /api/copilot-readiness/license-summary | 984b97f | apps/api/src/routes/copilot-readiness.ts |
| 2 | Patch drift-detector metadata + Alert type + alerts query | 3a4a30b | drift-detector.ts, shared/types.ts, alerts.ts |

## Decisions Made

1. **v1 license-summary uses string-parse approach** — `copilotLicensed`, `totalLicensed`, `overshareRiskCount`, `labelGapCount` are parsed from human-readable `detail` strings in KV-cached assessment. Structured numeric fields from Graph API are v2. Code comments document each limitation inline.

2. **overshareRiskCount proxy** — Public group count used as oversharing risk proxy for v1. Per-user oversharing report tracked as OVER-01 for v2.

3. **labelGapCount proxy** — Published sensitivity label count used as label coverage signal for v1. Purview unlabeled file count is v2.

4. **JSON.parse at response layer** — alerts.ts maps `metadata` through `JSON.parse` at the response mapping step rather than using a Drizzle custom type. Consistent with existing pattern in the codebase (recommendations column also stored as JSON text).

## Test Results

| Test File | Before | After |
|-----------|--------|-------|
| copilot-readiness.test.ts | 10 pass, 2 fail | 12 pass, 0 fail |
| drift-detector.test.ts | 6 pass, 1 fail | 7 pass, 0 fail |
| Full API suite | — | 1197 pass, 0 fail (137 files) |

## Deviations from Plan

**1. [Rule 2 - Missing functionality] Added metadata parse to single-alert GET endpoint**
- **Found during:** Task 2 — while updating the list endpoint
- **Issue:** `GET /alerts/:alertId` also returns raw JSON string metadata, which would be inconsistent
- **Fix:** Added the same JSON.parse mapping to the single-alert response alongside the list endpoint
- **Files modified:** apps/api/src/routes/alerts.ts
- **Commit:** 3a4a30b

Otherwise: plan executed exactly as written.

## Self-Check

### Files Modified Exist
- [x] apps/api/src/routes/copilot-readiness.ts — 181 lines (under 200 limit)
- [x] apps/api/src/lib/snapshots/drift-detector.ts
- [x] packages/shared/src/types.ts
- [x] apps/api/src/routes/alerts.ts

### Commits Exist
- [x] 984b97f — feat(02-02): add GET /api/copilot-readiness/license-summary endpoint
- [x] 3a4a30b — feat(02-02): patch drift metadata + Alert type + alerts query (SNAP-03)

## Self-Check: PASSED
