# Remediation Dry-Run & Scheduling Tests

> 9 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Alerts with remediation actions available

## Tests

### Dry-Run (from main suite section 33)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Find remediable alert | Go to /alerts, locate an alert with a remediation action | Alert row shows remediation action button | |
| 2 | Preview changes | Click "Preview Changes" button on the alert | Dry-run modal opens with a list of proposed changes | |
| 3 | Changes detail | Check dry-run changes list | Each change shows resource name, field, current value, and proposed value | |
| 4 | Duration and reversibility | Check dry-run modal metadata | Estimated duration displayed; reversibility indicator (reversible/irreversible) shown | |
| 5 | Action buttons | Check bottom of dry-run modal | "Execute" (primary) and "Cancel" (secondary) buttons present and clickable | |

### Scheduling (from main suite section 34)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6 | Schedule remediation | On remediation confirmation modal, set a future date and time | Date/time picker accepts future value, "Schedule" button becomes active | |
| 7 | Scheduled status | After scheduling | Alert remediation status shows "Scheduled" with scheduled date/time | |
| 8 | Scheduled list | Navigate to scheduled remediations list | Scheduled remediation appears with target date, alert name, and status | |
| 9 | Cancel or reschedule | Click options on a scheduled remediation | "Cancel" and "Reschedule" options available and functional | |
