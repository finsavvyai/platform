# Workflows: Lifecycle, Guest Review, Group Cleanup, Approvals & Bulk Ops Tests

> 22 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Microsoft 365 tenant connected

## Tests

### User Lifecycle (from main suite section 15)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /workflows/lifecycle | "No templates yet" message | |
| 2 | New Template | Click "New Template" | Builder with name, type, step toggles | |
| 3 | Select steps | Name "Test Offboard", select Disable + Revoke | Steps highlighted in blue | |
| 4 | Create | Click "Create Template" | Template appears in list | |
| 5 | Delete | Click "Delete" on template | Template removed | |

### Guest User Review (from main suite section 38)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6 | Review page | Navigate to /workflows/guest-review | Guest user review page loads with review results | |
| 7 | Stale guests | Check review results | Lists stale and orphaned guest accounts with last activity date and status | |
| 8 | Approve/deny | Click approve or deny button on a guest entry | Guest status updates; toast confirms action taken | |
| 9 | Review history | Check review history section | Previous review actions listed with date, guest name, action taken, and reviewer | |

### Group Cleanup (from main suite section 39)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 10 | Cleanup page | Navigate to /workflows/group-cleanup | Group cleanup page loads with cleanup results | |
| 11 | Cleanup results | Check results list | Shows empty, orphaned, and inactive groups with member count and last activity | |
| 12 | Archive groups | Select groups via checkboxes, click "Archive" | Selected groups archived; toast confirms count archived | |
| 13 | Cleanup history | Check cleanup history section | Previous cleanup actions listed with date, group name, action, and operator | |

### Approval Queue (from main suite section 40)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 14 | Queue page | Navigate to /workflows/approvals | Approval queue page loads with pending approvals list | |
| 15 | Pending list | Check pending approvals | Each approval shows requester, type, description, and submitted date | |
| 16 | Approval detail | Click an approval item | Expands to show individual items requiring approval with details | |
| 17 | Approve/deny items | Click Approve or Deny on individual items | Item status updates; toast confirms action; item moves to resolved | |
| 18 | Approval history | Check approval history tab | Resolved approvals listed with decision, reviewer, and timestamp | |

### Bulk Operations (from main suite section 47)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 19 | User list | Navigate to user list page | User table with selectable checkboxes per row | |
| 20 | Multi-select | Select multiple users via checkboxes | Selection count shown; bulk action toolbar appears | |
| 21 | Bulk action | Choose "Assign License" from bulk action dropdown | Confirmation modal shows selected user count and license to assign | |
| 22 | Batch progress | Confirm bulk action | Progress tracker shows batch status (processing/completed/failed per user) | |
