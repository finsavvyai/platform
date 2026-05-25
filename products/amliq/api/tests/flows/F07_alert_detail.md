# F07: Alert Detail Investigation

**Objective:** Verify comprehensive alert detail view with matching evidence and investigation tools.
**Prerequisites:** Authenticated user, navigate to alert detail from `/alerts`

## Test Steps

1. **Open Detail:** Navigate to `/alerts`, click any alert, verify detail view opens (modal/side panel/page) showing "[Entity Name] - Alert Details"
2. **Entity Comparison:** Verify side-by-side layout—left: screened entity (name, type, DOB, nationality), right: matched sanctioned entity (name, type, list source, ID). Both labeled clearly
3. **Confidence Score:** Verify large, prominent badge with percentage (e.g., "87%"), color-coded (red high, yellow medium, green low), explanation text (e.g., "[87%] Strong Match"), component breakdown (Name 92%, DOB 85%, Nationality 100%)
4. **Matching Evidence:** Verify evidence section showing: Jaro-Winkler Score (0.92), Levenshtein Distance (2), Phonetic Match (Yes), Embedding Similarity (0.88), Token Set Overlap (90%). Click/expand item—verify tooltip/popup explains algorithm
5. **Transaction Context:** Verify section shows: type (Incoming/Outgoing), amount/currency, originating party, destination party, purpose code (if available), timestamp. Info relevant to alert
6. **Prior Screening History:** Verify section listing previous screenings: date, lists screened, result (Match/No Match), confidence score if matched. Click entry—verify details appear. Verify pattern/trend visible
7. **AI Justification:** Verify "Justification" section with AI-generated text explaining reasoning. Verify text editable. Edit and verify changes persist. Verify "Revert to AI Generated" option
8. **Action Buttons:** Verify buttons: "Confirm Match" (green), "Mark as False Positive", "Escalate to L3". Verify buttons clearly labeled and accessible
9. **Confirm Match:** Click "Confirm Match", verify modal "Confirm this is a true match?" appears with optional notes field. Enter note "Matches government ID records", click "Confirm", verify status updates to "Confirmed", timestamp recorded
10. **False Positive Flow:** Select different alert, click "Mark as False Positive", verify modal with optional reason dropdown (Homonym, Data Quality, Duplicate, Other), notes field. Select "Homonym", enter note, click "Confirm", verify status updates to "False Positive"
11. **Escalate Flow:** Select alert, click "Escalate", verify modal with reason dropdown (Complex Financial Network, Legal Review, International Coordination, High Risk, Other). Select "Complex Financial Network", enter context notes, click "Escalate", verify status updates to "Escalated"
12. **Audit Trail:** Verify "Action History" section at bottom showing: timestamp, action, analyst, notes for each investigation step
13. **Desktop 3-Column Layout:** On wide screen, verify 3-column layout: list (left/narrow), entity comparison (center/left-right split), details panel (right). Verify columns resize. Click another alert in list—verify details update in columns 2-3
14. **Mobile (375px):** Resize to mobile, verify full-screen detail (list hidden), "Back" button at top, entity comparison stacks vertically (top/bottom), evidence scrollable, action buttons full-width at bottom, no horizontal scroll
15. **Print/Export:** Click menu/options, verify "Print Alert" option. Click—verify print preview shows all details. Click "Export as PDF" (if available)—verify download triggered

## Validation

- Entity comparison is clear and accurate
- All evidence displays with correct scores
- Confidence score calculated correctly
- All actions (Confirm, FP, Escalate) work and persist
- Mobile layout responsive
- No console errors

## Expected Result

Alert detail provides comprehensive investigation interface with entity comparison, evidence breakdown, transaction context, editable justification, and action buttons with audit trails.

---

*F07 | Alert Detail | 2026-03-26*
