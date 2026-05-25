# F06: Alert Investigation Workbench

**Objective:** Verify alert queue display, filtering, and investigation actions.
**Prerequisites:** Authenticated user with alerts available, navigate to `/alerts`

## Test Steps

1. **Page Load:** Navigate to `/alerts`, verify title "Alert Queue", alerts display as list/cards, loads in <2 seconds, no errors
2. **Alert Badges:** Verify count badges: Critical (red, e.g., "3"), Review (yellow, e.g., "12"), Auto-Cleared (gray, e.g., "24"), total count
3. **Alert Sorting:** Verify alerts sorted by confidence score (highest first). Verify sort dropdown: "Confidence Score" (selected), "Newest", "Oldest". Select "Newest"—verify list reorders
4. **Alert Display:** Verify each alert shows: entity name, matched sanctioned entity, confidence score badge (color-coded), status label (Pending/Confirmed/False Positive), created timestamp. All readable
5. **Click Alert:** Click first alert, verify detail view opens showing entity comparison, evidence, score, status
6. **Confirm Match:** Click "Confirm Match", verify confirmation dialog, click "Confirm", verify status updates to "Confirmed", alert updates/disappears
7. **Mark False Positive:** Select alert, click "False Positive", verify dialog with optional reason dropdown, click "Confirm", verify status updates to "False Positive"
8. **Escalate to L3:** Select alert, click "Escalate", verify dialog with reason dropdown, optional notes field, click "Escalate", verify status updates to "Escalated"
9. **AI Justification:** Click "AI Draft Justification", verify text generates in <2 seconds explaining confidence and evidence, text is editable, changes persist
10. **Filters:** Locate filter controls. Filter by Status—verify "Pending", "Confirmed", "False Positive" options, list updates. Filter by Confidence—verify "High (80-100%)", "Medium (50-79%)", "Low (<50%)". Filter by Date Range—select "Last 7 Days", list updates
11. **Search:** Enter entity name "Putin", verify results filter to matching entities. Clear search, full list returns
12. **Bulk Actions (if available):** Check 3 alerts, click "Bulk Action", verify options (Confirm, FP, Escalate), select action, verify all 3 updated
13. **Mobile (375px):** Resize to mobile, verify alerts display as full-width cards (not table), info stacks vertically, action buttons full-width/touchable (44px+), no horizontal scroll

## Validation

- All alerts display correct confidence scores
- Actions (Confirm, FP, Escalate) work and persist
- Filters execute correctly
- Search is responsive
- Mobile layout fully responsive

## Expected Result

Alert queue displays all alerts sorted by confidence, supports comprehensive filtering/search, and allows investigators to take action with proper status tracking.

---

*F06 | Alert Queue | 2026-03-26*
