# Sprint 42: Case Management v2

**Duration**: 2 weeks
**Priority**: HIGH
**Closes Gaps**: G10
**Depends On**: None
**Status**: Not Started

---

## Objective

Upgrade the basic alert-resolve workflow to a full case management system that compliance teams can live in daily. Add SLA timers, four-eyes review, bulk disposition, priority queues, and assignment routing.

## Tasks

### T1: SLA timers
- [ ] Define SLA per alert priority:
  - Critical: 4 hours
  - High: 24 hours
  - Medium: 72 hours
  - Low: 7 days
- [ ] Store SLA deadline on case creation (`due_at` column)
- [ ] Cron job checks for overdue cases, auto-escalates to next tier
- [ ] Dashboard shows: time remaining, overdue count, SLA compliance rate
- [ ] **Migration**: `033_add_case_sla.up.sql` — add `due_at`, `escalated_at`, `sla_breached` columns to cases
- [ ] **File**: `cmd/worker/sla_enforcer.go` (new, <80 lines)

### T2: Four-eyes review (dual approval)
- [ ] For cases with confidence > configurable threshold (default 0.8):
  - First reviewer submits disposition
  - Case moves to "pending_review" status
  - Second reviewer must confirm or override
  - Only after both agree does the case resolve
- [ ] New case statuses: `pending_review`, `disputed` (reviewers disagree)
- [ ] **File**: `api/handler_cases_review.go` (new, <100 lines)
- [ ] **File**: `internal/domain/case_status.go` (add new statuses)

### T3: Bulk disposition
- [ ] `POST /api/v1/cases/bulk-resolve` — resolve multiple cases at once
  ```json
  {
      "case_ids": ["uuid1", "uuid2", "uuid3"],
      "disposition": "FALSE_POSITIVE",
      "justification": "Batch review: all share same false positive pattern (common name match)"
  }
  ```
- [ ] Audit trail records bulk action with all affected case IDs
- [ ] **File**: `api/handler_cases_bulk.go` (new, <80 lines)
- [ ] **Test**: `api/handler_cases_bulk_test.go`

### T4: Priority queues and auto-assignment
- [ ] Assignment strategies:
  - Round-robin: distribute evenly across team
  - Skill-based: route high-risk to senior analysts, low-risk to junior
  - Load-balanced: assign to analyst with fewest open cases
- [ ] Configurable per tenant via `PUT /api/v1/config`
- [ ] Auto-assign on case creation based on strategy
- [ ] Reassign endpoint: `PUT /api/v1/cases/{id}/reassign`
- [ ] **File**: `internal/screening/case_assigner.go` (new, <100 lines)
- [ ] **File**: `internal/screening/case_assigner_test.go`

### T5: Case comments and activity log
- [ ] `POST /api/v1/cases/{id}/comments` — add comment to case
- [ ] `GET /api/v1/cases/{id}/activity` — full activity timeline: status changes, assignments, comments, SLA events
- [ ] Activity stored in `case_comments` table (already exists) + `case_events` table (new)
- [ ] **Migration**: `034_create_case_events.up.sql`
- [ ] **File**: `api/handler_cases_activity.go` (new, <80 lines)

### T6: Dashboard enhancements
- [ ] Case management dashboard: open cases by priority, SLA compliance %, analyst workload, resolution rate
- [ ] My Cases view: cases assigned to current user
- [ ] Filter: by status, priority, assignee, SLA status (on-time, at-risk, breached)
- [ ] **File**: `web/src/pages/compliance/CaseManagement.tsx` (enhance)

## Acceptance Criteria

- [ ] SLA timers enforce resolution deadlines with auto-escalation
- [ ] Four-eyes review requires dual approval for high-confidence cases
- [ ] Bulk disposition resolves multiple cases in one action
- [ ] Auto-assignment distributes cases based on configured strategy
- [ ] Full activity timeline on each case
- [ ] Dashboard shows SLA compliance rate and analyst workload
