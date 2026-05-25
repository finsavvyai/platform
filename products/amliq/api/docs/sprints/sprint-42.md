# Sprint 42: Case Management v2

**Duration**: 2 weeks
**Priority**: HIGH
**Closes Gaps**: G10
**Depends On**: None
**Status**: Complete

---

## Objective

Upgrade the basic alert-resolve workflow to a full case management system that compliance teams can live in daily. Add SLA timers, four-eyes review, bulk disposition, priority queues, and assignment routing.

## Tasks

### T1: SLA timers
- [x] Define SLA per alert priority:
  - Critical: 4 hours
  - High: 24 hours
  - Medium: 72 hours
  - Low: 7 days
- [x] Store SLA deadline on case creation (`due_at` column)
- [x] Cron job checks for overdue cases, auto-escalates to next tier
- [x] Dashboard shows: time remaining, overdue count, SLA compliance rate
- [x] **Migration**: `033_add_case_sla.up.sql` — add `due_at`, `escalated_at`, `sla_breached` columns to cases
- [x] **File**: `cmd/worker/sla_enforcer.go` (new, <80 lines)

### T2: Four-eyes review (dual approval)
- [x] For cases with confidence > configurable threshold (default 0.8):
  - First reviewer submits disposition
  - Case moves to "pending_review" status
  - Second reviewer must confirm or override
  - Only after both agree does the case resolve
- [x] New case statuses: `pending_review`, `disputed` (reviewers disagree)
- [x] **File**: `api/handler_cases_review.go` (new, <100 lines)
- [x] **File**: `internal/domain/case_status.go` (add new statuses)

### T3: Bulk disposition
- [x] `POST /api/v1/cases/bulk-resolve` — resolve multiple cases at once
  ```json
  {
      "case_ids": ["uuid1", "uuid2", "uuid3"],
      "disposition": "FALSE_POSITIVE",
      "justification": "Batch review: all share same false positive pattern (common name match)"
  }
  ```
- [x] Audit trail records bulk action with all affected case IDs
- [x] **File**: `api/handler_cases_bulk.go` (new, <80 lines)
- [x] **Test**: `api/handler_cases_bulk_test.go`

### T4: Priority queues and auto-assignment
- [x] Assignment strategies:
  - Round-robin: distribute evenly across team
  - Skill-based: route high-risk to senior analysts, low-risk to junior
  - Load-balanced: assign to analyst with fewest open cases
- [x] Configurable per tenant via `PUT /api/v1/config`
- [x] Auto-assign on case creation based on strategy
- [x] Reassign endpoint: `PUT /api/v1/cases/{id}/reassign`
- [x] **File**: `internal/screening/case_assigner.go` (new, <100 lines)
- [x] **File**: `internal/screening/case_assigner_test.go`

### T5: Case comments and activity log
- [x] `POST /api/v1/cases/{id}/comments` — add comment to case
- [x] `GET /api/v1/cases/{id}/activity` — full activity timeline: status changes, assignments, comments, SLA events
- [x] Activity stored in `case_comments` table (already exists) + `case_events` table (new)
- [x] **Migration**: `034_create_case_events.up.sql`
- [x] **File**: `api/handler_cases_activity.go` (new, <80 lines)

### T6: Dashboard enhancements
- [x] Case management dashboard: open cases by priority, SLA compliance %, analyst workload, resolution rate
- [x] My Cases view: cases assigned to current user
- [x] Filter: by status, priority, assignee, SLA status (on-time, at-risk, breached)
- [x] **File**: `web/src/pages/compliance/CaseManagement.tsx` (enhance)

## Acceptance Criteria

- [x] SLA timers enforce resolution deadlines with auto-escalation
- [x] Four-eyes review requires dual approval for high-confidence cases
- [x] Bulk disposition resolves multiple cases in one action
- [x] Auto-assignment distributes cases based on configured strategy
- [x] Full activity timeline on each case
- [x] Dashboard shows SLA compliance rate and analyst workload
