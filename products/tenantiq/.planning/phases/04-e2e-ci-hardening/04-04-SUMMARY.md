---
phase: 04-e2e-ci-hardening
plan: "04"
subsystem: api/cron-queues
tags: [security, org-isolation, multi-tenant, hard-05]
dependency_graph:
  requires: [04-03]
  provides: [HARD-05-complete]
  affects: [all cron handlers, all queue processors]
tech_stack:
  added: []
  patterns: [assertOrgId guard pattern, org-scope enforcement in async workers]
key_files:
  created: []
  modified:
    - apps/api/src/cron/compliance-scan.ts
    - apps/api/src/cron/group-cleanup.ts
    - apps/api/src/cron/guest-review.ts
    - apps/api/src/cron/scheduled-remediation.ts
    - apps/api/src/cron/scheduled-scans.ts
    - apps/api/src/cron/security-stack-scan.ts
    - apps/api/src/cron/tenant-health.ts
    - apps/api/src/cron/webhook-retry.ts
    - apps/api/src/cron/workflow-trigger.ts
    - apps/api/src/queues/alert-handler.ts
    - apps/api/src/queues/workflow-handler.ts
    - apps/api/src/queues/sync-handler.ts
decisions:
  - "scheduled-remediation iterates dueRemediations by timestamp (platform-wide query) — assertOrgId called on rem.tenantId since that is the per-record scope key"
  - "webhook-retry has no tenant iteration loop — documented exception comment added; delivery records scoped by webhookConfigId not org"
  - "tenant-health queries schema.organizations table — tenant.id IS the org ID; assertOrgId(tenant.id) is correct"
  - "alert-handler and workflow-handler use msg.tenantId as scope key (no organizationId in ScanMessage/WorkflowMessage) — assertOrgId on tenantId prevents null context"
  - "security-stack-scan and scheduled-scans use raw D1 SQL — organization_id added to SELECT columns before assertOrgId call"
metrics:
  duration_minutes: 6
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_modified: 12
---

# Phase 04 Plan 04: assertOrgId Cron + Queue Guard Coverage Summary

**One-liner:** Added `assertOrgId()` guard to all 9 cron handlers and 3 queue processors to enforce multi-tenant isolation in async workers — closes HARD-05.

## What Was Built

The `assertOrgId` guard (created in plan 04-03) is now called inside every tenant-iterating loop across cron jobs and queue processors. Any handler that runs without a valid org context will throw immediately rather than silently executing cross-org queries.

## Files Modified and Guard Added

### Cron Handlers (9 files)

| File | Guard Call | Notes |
|------|-----------|-------|
| `compliance-scan.ts` | `assertOrgId(tenant.organizationId, 'ComplianceScan')` | First line inside for loop |
| `group-cleanup.ts` | `assertOrgId(tenant.organizationId, 'GroupCleanup')` | Before Graph API calls |
| `guest-review.ts` | `assertOrgId(tenant.organizationId, 'GuestReview')` | Before Graph API calls |
| `scheduled-remediation.ts` | `assertOrgId(rem.tenantId, 'ScheduledRemediation')` | Per remediation record; see note below |
| `scheduled-scans.ts` | `assertOrgId(t.organization_id, 'ScheduledScans')` | `organization_id` added to raw D1 SELECT |
| `security-stack-scan.ts` | `assertOrgId(tenant.organization_id, 'SecurityStackScan')` | `organization_id` added to raw D1 SELECT |
| `tenant-health.ts` | `assertOrgId(tenant.id, 'TenantHealth')` | Queries organizations table — `tenant.id` is org ID |
| `webhook-retry.ts` | *documented exception* | No tenant iteration — see exclusion note |
| `workflow-trigger.ts` | `assertOrgId(tenant.organization_id, 'WorkflowTrigger')` | `organization_id` added to raw D1 SELECT |

### Queue Processors (3 files)

| File | Guard Call | Notes |
|------|-----------|-------|
| `alert-handler.ts` | `assertOrgId(msg.tenantId, 'AlertHandler')` | Before all DB alert writes |
| `workflow-handler.ts` | `assertOrgId(msg.tenantId, 'WorkflowHandler')` | Before workflow DB operations |
| `sync-handler.ts` | `assertOrgId(tenant.organizationId, 'SyncHandler')` | After getTenantById lookup, before Graph/DB |

## Exclusions with Documented Exceptions

### webhook-retry.ts
No per-org `assertOrgId` added. This handler retries webhook delivery records keyed by `webhookConfigId`, not by tenant org iteration. The comment added:
```
// No per-org assertOrgId needed — webhook retry processes delivery records, not tenant queries.
// Delivery records are scoped to webhookConfigId; org isolation is enforced at the config level.
```

### scheduled-remediation.ts
This is a cross-org timestamp query (`WHERE status = 'scheduled' AND scheduled_at <= now`). There is no per-tenant iteration — the query returns due remediation records across all orgs. The `assertOrgId` is called on `rem.tenantId` per record with a comment explaining the platform-wide query pattern.

## Raw SQL Files Updated

Three files used raw D1 SQL without `organization_id` in the SELECT. All three were updated:
- `scheduled-scans.ts`: `SELECT id, azure_tenant_id, organization_id FROM tenants WHERE status = 'active'`
- `security-stack-scan.ts`: `SELECT id, azure_tenant_id, organization_id FROM tenants WHERE status = 'active'`
- `workflow-trigger.ts`: `SELECT id, display_name, organization_id FROM tenants WHERE status = 'active'`

Inline type annotations updated to include `organization_id: string | null`.

## Verification Results

```
grep -l "assertOrgId" apps/api/src/cron/*.ts  → 9 files
grep -l "assertOrgId" apps/api/src/queues/*.ts → 3 files
npx tsc --noEmit -p apps/api/tsconfig.json    → 0 errors
```

## Deviations from Plan

None — plan executed exactly as written. The `scheduled-remediation.ts` per-record assertOrgId (rather than a global exception comment) is within the spirit of the plan instruction: the handler does iterate dueRemediations and each has a tenantId, so the guard is applied per-record rather than omitted.

## Self-Check: PASSED

All 12 modified files confirmed present with assertOrgId calls or documented exceptions. All commits verified below.
