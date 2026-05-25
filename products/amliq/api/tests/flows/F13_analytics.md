# F13: Analytics Dashboard

**Objective:** Verify analytics metrics, charts, and reporting functionality.
**Prerequisites:** Authenticated user, navigate to `/analytics`

## Test Steps

1. **Page Load:** Navigate to `/analytics`, verify title "Analytics" or "Reports", loads in <3 seconds, no errors
2. **KPI Cards:** Verify 4 cards at top: Total Screenings (e.g., "12,847"), Match Rate (e.g., "4.3% (550 matches)"), Avg Processing Time (e.g., "245ms"), SLA Compliance (e.g., "99.8% vs 99.9% target"). Verify color-coded (green/red). Verify trend indicators (up/down with percentage)
3. **Screening Volume Chart:** Verify area chart "Screening Volume Trend" with X-axis (30 days), Y-axis (volume numbers), area fill with gradient. Hover over point—verify tooltip with date and count. Verify legend
4. **Match Rate Trend:** Verify line chart with X-axis (30 days), Y-axis (percentage 0-10%), data points connected. Hover—verify tooltip. Verify reference line at average match rate
5. **Alert Resolution Time:** Verify bar chart with X-axis buckets (<30 min, 30 min-1 hour, 1-4 hours, 4-24 hours, >24 hours), Y-axis (alert counts). Verify bars color-coded, average resolution time displayed
6. **False Positive Rate Trend:** Verify line chart showing FP% over 30 days. Verify reference lines: industry average and your target FP rate. Hover—verify tooltip with exact percentage. Verify trend visible (up/down)
7. **Top Matched Lists:** Verify horizontal bar chart "Top Matched Lists" showing: OFAC SDN (145), OpenSanctions (98), EU Consolidated (45), UN (32), etc. Verify longest to shortest, percentage labels, total matches
8. **Alert Status Breakdown:** Verify pie/donut chart with segments: Confirmed Match (32%), False Positive (43%), Pending Review (17%), Auto-Cleared (8%). Verify legend with counts and percentages. Verify distinct colors
9. **Daily Metrics:** Verify recent daily info: Today total (487), Yesterday total (523), Weekly average (512/day), trend vs last week (-5.3%)
10. **Date Range Picker:** Verify selector with presets: Today, Last 7 Days, Last 30 Days (selected), Last 90 Days, Last 12 Months, Custom Range. Select "Last 7 Days"—verify charts update, X-axis shows 7 days. Select "Last 90 Days"—verify longer timeline. Select "Custom Range"—verify date pickers appear, select start/end, verify charts update
11. **Comparison Mode:** Click "Compare with Previous Period" (if available). Verify second baseline appears on charts. Verify legend shows "Current Period" and "Previous Period" with different colors. Verify percentage change displayed. Click "Remove Comparison"—verify returns to single view
12. **Chart Interactions:** Hover over chart—verify tooltip appears. Click legend item—verify series toggles on/off. Verify chart updates. Verify zoom/pan available on time-series (if applicable)
13. **Export PDF:** Click "Export as PDF", verify PDF download with title "Analytics Report", date range, KPI cards, all charts with data, summary statistics, generated date/time. Verify readable format
14. **Export Excel:** Click "Export as Excel", verify Excel download with multiple sheets (one per chart), raw data available, charts embedded
15. **Schedule Report:** Click "Schedule Report" (if available), verify modal: recipient email, frequency (Daily/Weekly/Monthly), format (PDF/Excel), start date, time. Enter email "admin@test.aegis", select "Weekly", format "PDF", click "Schedule". Verify "Report scheduled" confirmation. Verify report appears in scheduled list
16. **View Data Table:** Click "View Data" on chart (if available). Verify underlying data table with dates/values, sortable columns, optional download. Close table, return to chart view
17. **Mobile (375px):** Resize to mobile, verify KPI cards stack vertically, charts resize to single-column width, readable (not cramped), legend accessible, date range picker usable, no horizontal scroll. Verify touch interactions work (tap instead of hover)

## Validation

- All KPI cards display correct values
- Charts render with accurate data
- Date range filtering updates all charts
- Tooltips show correct information
- Export produces valid PDF/Excel files
- Scheduled reports configured correctly
- Mobile layout responsive
- Charts load in <3 seconds

## Expected Result

Analytics dashboard displays comprehensive metrics with multiple chart types, real-time data, date range filtering, comparison modes, and export/scheduling capabilities.

---

*F13 | Analytics | 2026-03-26*
