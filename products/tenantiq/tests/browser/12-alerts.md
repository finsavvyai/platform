# Alerts & Alert Analytics Tests

> 10 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Some alerts generated (or run AI scan to create alerts)

## Tests

### Alerts (from main suite section 13)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Default view | Go to /alerts | Shows "No active alerts" with "Run AI Scan" CTA | |
| 2 | Filter dropdown | Change status filter | Options: All, Active, Acknowledged, Resolved, Dismissed | |
| 3 | Severity filter | Change severity filter | Options: All, Critical, High, Medium, Low | |
| 4 | Run AI Scan CTA | Click "Run AI Scan" link | Navigates to /ai | |
| 5 | Export | Click Export > CSV | Downloads alerts CSV (may be empty) | |

### Alert Analytics (from main suite section 37)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 6 | Analytics section | Navigate to /alerts, scroll to analytics section | Alert analytics dashboard visible below alert list | |
| 7 | Trend chart | Check trend chart | Line/bar chart with date range selector (7d, 30d, 90d) | |
| 8 | Resolution metrics | Check MTTR and resolution rate | MTTR value displayed (e.g., "2.4 hours"); resolution rate as percentage | |
| 9 | Severity breakdown | Check severity distribution | Breakdown showing count per severity (Critical, High, Medium, Low) with color coding | |
| 10 | Recurring alerts | Check recurring alerts section | List of alerts that have recurred, with recurrence count and last occurrence | |
