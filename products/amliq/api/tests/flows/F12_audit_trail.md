# F12: Audit Trail & Compliance Logging

**Objective:** Verify comprehensive audit trail with filtering, export, and integrity checking.
**Prerequisites:** Authenticated user with audit log access, navigate to `/audit`

## Test Steps

1. **Page Load:** Navigate to `/audit`, verify title "Audit Trail", loads in <2 seconds, no errors
2. **Audit Table:** Verify table columns: Timestamp, Action, Actor, Resource, Hash, Details. Verify ≥20 entries visible (with pagination). Verify sorted by timestamp (newest first), all readable
3. **Expand Entry:** Click "Details" or expand arrow on entry, verify full details appear: full timestamp with timezone, IP address, user agent, before/after values (if applicable), additional context. Click to collapse
4. **Date Range Filter:** Verify date range picker. Select "From: March 20, 2026", "To: March 26, 2026". Verify "Apply" or auto-apply. Verify table updates to show only entries in range. Verify count changes. Change to "Last 30 Days"—verify more entries appear
5. **Action Type Filter:** Verify dropdown with options: SCREENING_CREATED, ALERT_CONFIRMED, ALERT_FALSE_POSITIVE, ALERT_ESCALATED, CONFIG_CHANGED, PLAN_UPGRADED, SEAT_ADDED, All. Select "SCREENING_CREATED"—verify only screening entries. Select "ALERT_CONFIRMED"—verify list updates. Select "CONFIG_CHANGED"—verify configuration entries only
6. **User/Actor Filter:** Verify user dropdown. Click, verify list of actors. Select "admin@test.aegis"—verify only entries by that user. Select "user@test.aegis"—verify entries change. Select "All Users"—verify full list
7. **Resource Filter:** Verify resource type filter (if available). Filter "Entity Screening"—verify only screening entries. Filter "Alert"—verify alert-related entries only. Filter "Subscription"—verify billing/subscription entries
8. **Combined Filters:** Apply multiple: Date (Last 7 days), Action (ALERT_CONFIRMED), User (user@test.aegis). Verify table shows only entries matching all filters. Clear one filter—results expand. Clear all—full list returns
9. **Search:** Locate search field. Search "Putin"—verify results show only entries related to "Putin". Clear, search ticket ID or transaction ID (if applicable)—verify search executes
10. **Hash Chain Integrity:** Verify integrity indicator/badge visible. Click info icon, verify explanation: "Each entry is cryptographically linked to previous entry". Verify status "Chain Intact - No tampering detected" with last verified timestamp
11. **View Hash Details:** Click hash value, verify modal showing: full hash, algorithm (SHA-256), previous entry hash (chain link), calculation verification text. Verify copy hash button. Click copy—verify copied to clipboard
12. **Export CSV:** Locate "Export" button. Click "Export as CSV", verify file download: "audit_log_2026-03-26.csv". Verify CSV contains headers, filtered entries, timestamps in ISO format, hash values included
13. **Export PDF:** Click "Export as PDF" (if available), verify PDF download with formatted table and details
14. **Real-Time Updates:** Perform action in dashboard (screening, alert confirmation, config change). Navigate to audit log. Verify new entry appears immediately with correct: action, actor, resource, timestamp
15. **Retention Policy:** Verify statement about retention (e.g., "Audit logs retained for [duration]"). Verify ability to download archived logs (if applicable). Verify warning if old entries about to be deleted
16. **Immutability:** Verify audit log cannot be deleted by normal users (no "Delete" button). Verify only super-admin can export full log. Verify compliance statement: "All actions logged for regulatory compliance" with GDPR/SOC2 badge
17. **Mobile (375px):** Resize to mobile, verify table converts to card layout, each entry is full-width card, expand details work on mobile, filters accessible (menu/modal), export button accessible, no horizontal scroll

## Validation

- All audit entries display accurately
- Filters work correctly individually and combined
- Search executes properly
- Hash chain integrity verified
- Export produces valid CSV/PDF
- Entries update in real-time when actions occur
- User information captured correctly
- No entries missing

## Expected Result

Audit trail displays comprehensive activity logs with multiple filtering, hash chain integrity verification, and export functionality for compliance reporting.

---

*F12 | Audit Trail | 2026-03-26*
