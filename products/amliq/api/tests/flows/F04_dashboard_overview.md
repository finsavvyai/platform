# F04: Dashboard Overview

**Objective:** Verify dashboard home displays all KPI cards, charts, and alerts correctly.
**Prerequisites:** Authenticated user, navigate to `/dashboard`

## Test Steps

1. **Page Load:** Navigate to `/dashboard`, verify page loads in <2 seconds, no console errors, sidebar visible (desktop)
2. **Sidebar Navigation:** Verify menu items: Dashboard (active), Screening, Alerts, Configuration, Analytics, Billing, Audit Log. Click each—verify navigation.
3. **Toolbar:** Verify top toolbar with user name, company/tenant name, avatar, settings/help menu, logout button
4. **Stat Cards:** Verify 4 KPI cards—Today's Alerts (e.g., "8"), Avg Resolution Time (e.g., "2.5h"), Screening Volume (e.g., "1,247"), False Positive Rate (e.g., "3.2%"). Verify trend arrows (green/red)
5. **Volume Chart:** Verify area chart "Screening Volume (30-Day Trend)" with dates on X-axis, volume on Y-axis. Hover over point—verify tooltip with date/volume
6. **Alert Disposition Donut:** Verify donut chart with segments: Confirmed Match, False Positive, Pending, Auto-Cleared. Verify legend with count/percentage. Center shows total count
7. **Recent Alerts Table:** Verify table columns: Entity Name, Matched Entity, Score, Status, Action. Verify ≥5 rows. Verify score badges color-coded. Click row—verify detail opens. Verify quick actions (Confirm, FP, Escalate)
8. **System Health:** Verify API status "Operational" (green), last sync timestamp, uptime % (e.g., "99.98%")
9. **Quick Actions:** Verify "Screen Entity", "View All Alerts", "Go to Configuration" buttons. Click—verify navigation.
10. **Tablet Layout (1024px):** Resize to tablet, verify sidebar collapses to icon-only, main content full-width, charts readable
11. **Mobile Layout (375px):** Resize to mobile, verify sidebar hidden (hamburger menu), bottom tab nav appears (Dashboard, Alerts, Screen, Config, More), stat cards stack vertically, no horizontal scroll

## Validation

- All charts render with correct data; stat cards display current/recent data
- No console errors; responsive layout works across breakpoints
- Data loads within acceptable time

## Expected Result

Dashboard displays all KPI cards, charts, and recent alerts with proper data and responsive behavior.

---

*F04 | Dashboard Overview | 2026-03-26*
