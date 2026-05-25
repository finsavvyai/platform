# F05: Manual Entity Screening

**Objective:** Verify manual screening form and end-to-end workflow for all entity types.
**Prerequisites:** Authenticated user, navigate to `/screen`

## Test Steps

1. **Page Load:** Navigate to `/screen`, verify title "Screen Entity", entity type selector, form visible, no console errors
2. **Entity Type Selector:** Click dropdown, verify options: Individual, Company, Vessel, Aircraft. Verify "Individual" selected by default
3. **Individual Form:** Verify fields: Full Name (required), DOB (optional), Nationality (optional), Passport (optional). All labeled and editable
4. **Perform Screening:** Enter name "Mohammed Al-Rashidi", DOB "01/01/1975", Nationality "Saudi Arabia". Verify list selector shows OFAC/OpenSanctions checkboxes. Click "Screen Now"
5. **Results Display:** Verify results appear in <3 seconds—matched entity name, confidence score badge (color-coded: red 80%+, yellow 50-79%, green <50%), match status
6. **Evidence Section:** Verify evidence items showing: Jaro-Winkler score, Levenshtein distance, Phonetic match, Embedding similarity, Token set overlap. Hover over item—verify tooltip explains algorithm
7. **Transaction Context:** If applicable, verify transaction section shows: type (incoming/outgoing), amount/currency, origin, destination, timestamp
8. **Action Buttons:** Verify "Register for Ongoing Monitoring" button, "View Full Details", "Mark False Positive". Click monitoring button—verify confirmation "Registered"
9. **Company Screening:** Select "Company" from dropdown, verify fields change: Company Name (required), Registration Number (optional), Country of Registration, Industry. Enter "ACME Corporation", click "Screen Now", verify results
10. **Vessel/Aircraft:** Test "Vessel" (Vessel Name, IMO, Flag State, Type) and "Aircraft" (Aircraft Registration, Type, Owner, Flag State). Perform screenings, verify results
11. **Validation—Empty Submit:** Clear required field, click "Screen Now", verify validation error "Full Name is required", form doesn't submit
12. **No Match Result:** Enter "ZZZ Random Test Entity No Match", screen, verify "No Match Found", monitoring button still available
13. **Mobile (375px):** Resize to mobile, verify form fields stack vertically, full-width inputs/buttons, results readable, no horizontal scroll

## Validation

- All entity types work correctly; form validates properly
- Screening returns results in <3 seconds
- Confidence scores calculated correctly
- Evidence clearly displayed
- No console errors during screening

## Expected Result

Manual screening accepts all entity types, validates input, returns comprehensive results with confidence scores and evidence.

---

*F05 | Manual Screening | 2026-03-26*
