# Executive Reports & Report Builder Tests

> 13 tests | Priority: P1

## Prerequisites
- Signed in as admin user
- Data synced from Microsoft 365

## Tests

### Executive Reports (from main suite section 23)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Empty state | Go to /reports (first visit, no report) | "No Report Generated" message with "Generate First Report" CTA | |
| 2 | Config panel | Check configuration bar | Period dropdown (Weekly/Monthly/Quarterly) + 4 section checkboxes (Security, Financials, Compliance, Recommendations) | |
| 3 | Generate report | Click "Generate Report" | Spinner, then metric cards (Security Score ring, Total Users, Licensed Users, Compliance %, Monthly Cost) | |
| 4 | Executive summary | After generation | "Executive Summary" section with narrative text | |
| 5 | Recommendations | After generation | Recommendation cards with priority dots (red/yellow/green) and impact descriptions | |
| 6 | Export JSON | Click Export > JSON | Downloads executive-report-[period].json | |
| 7 | Export CSV | Click Export > CSV | Downloads executive-report-[period].csv with metrics table | |

### Report Builder (from main suite section 36)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 8 | Builder page | Navigate to /reports/builder | Report builder interface loads with metric picker | |
| 9 | Metric categories | Check metric picker sidebar | Categories loaded from API with checkbox per metric; grouped by category heading | |
| 10 | Period selector | Check period bar | 4 period buttons (7 Days, 30 Days, 90 Days, 1 Year) with active state highlight and title input | |
| 11 | Generate report | Select metrics, click "Generate Report" | Spinner, then MetricCard grid renders with label, formatted value, and category subtitle | |
| 12 | Save template | Click "Save Template" with metrics selected | Toast: "Template saved" | |
| 13 | Export | Click Export menu (visible after report generated) | JSON download and PDF (browser print dialog) options available | |
