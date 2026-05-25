# AMLIQ AML Platform - Test Flow P03
## Persona: Maria Santos - AML Analyst

### Persona Profile
- **Name:** Maria Santos
- **Role:** AML Analyst (Senior)
- **Company:** Compliance Department (Regional Financial Services)
- **Experience Level:** 6 years AML/KYC compliance, high AML domain expertise
- **Goals:** Daily screening workflow optimization; efficient alert management and resolution
- **Success Criteria:** Complete full screening workflow, test configuration changes, verify fuzzy matching threshold impacts

---

## Prerequisites
- [ ] Chrome browser with Developer Tools available
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] Test account credentials ready or create during flow
- [ ] API endpoint http://localhost:3001/api/v1 operational
- [ ] Multiple test entities prepared for screening

---

## Test Flow Steps

### Step 1: Login to Dashboard
**Action:** Authenticate and access main dashboard
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] **Verify:** Login page appears (or dashboard if already logged in)
- [ ] **Screenshot:** Login page
- [ ] If not logged in, enter credentials:
  - [ ] Email: `maria.santos@compliance.co` (use existing or create account)
  - [ ] **Selector:** `input[type="email"]`
  - [ ] Password: `SecurePass456!@#`
  - [ ] **Selector:** `input[type="password"]`
- [ ] Click "Sign In" button
- [ ] **Selector:** `button[type="submit"]` or `button:contains("Sign")`
- [ ] **Verify:** Redirected to main dashboard
- [ ] **Screenshot:** Dashboard after login
- [ ] Confirm user name/email displayed (top right or profile menu)
- [ ] **Verify:** Shows "Maria Santos" or similar
- [ ] **Pass/Fail:** ☐ Successfully logged in

---

### Step 2: Dashboard Stats Review
**Action:** Examine key metrics and statistics
- [ ] **Verify:** Main dashboard with metrics cards visible
- [ ] **Screenshot:** Full dashboard view with metrics
- [ ] Check "Today's Screenings" card
- [ ] **Verify:** Displays numerical count of screenings performed today
- [ ] **Selector:** `.metric-card` or `div[class*="stats"]`
- [ ] **Screenshot:** Today's screenings metric
- [ ] Check "Active Alerts" card
- [ ] **Verify:** Shows count of unresolved alerts
- [ ] **Screenshot:** Active alerts metric
- [ ] Check "True Positive Rate" card
- [ ] **Verify:** Shows percentage (e.g., "12.5%")
- [ ] **Screenshot:** True positive rate metric
- [ ] Check "Processing Time" card
- [ ] **Verify:** Shows average screening time (e.g., "2.3 seconds")
- [ ] **Selector:** Metrics display cards
- [ ] **Screenshot:** All metrics visible
- [ ] **Pass/Fail:** ☐ All dashboard metrics loaded and visible

---

### Step 3: Screen Individual Entity
**Action:** Perform first screening for individual "Alexei Petrov"
- [ ] Click "Screen Entity" or "New Screening" button on dashboard
- [ ] **Selector:** `button:contains("Screen")` or `.screen-button`
- [ ] **Verify:** Screening form opens
- [ ] **Screenshot:** Empty screening form
- [ ] Select entity type: `Individual`
- [ ] **Selector:** `radio[value="individual"]` or dropdown selection
- [ ] Enter Full Name: `Alexei Petrov`
- [ ] **Selector:** `input[name="fullName"]` or `input[placeholder*="Name"]`
- [ ] Enter Passport Number: `RUS-55219938`
- [ ] **Selector:** `input[name="passportNumber"]` or `input[placeholder*="Passport"]`
- [ ] Select Country: `Russia`
- [ ] **Selector:** `select[name="country"]` or country dropdown
- [ ] Leave other fields optional for this test
- [ ] Click "Submit for Screening" button
- [ ] **Verify:** Form submitted, loading indicator appears
- [ ] **Selector:** `.loading-spinner` or similar
- [ ] **Screenshot:** Screening submitted with loading state
- [ ] Wait for results to load (2-5 seconds)
- [ ] **Verify:** Results page appears with risk assessment
- [ ] **Screenshot:** Screening results page
- [ ] **Pass/Fail:** ☐ Individual screening completed

---

### Step 4: Screen Company Entity
**Action:** Perform second screening for company entity
- [ ] Return to dashboard or click "Screen Another Entity"
- [ ] **Selector:** Navigation back or screen button
- [ ] Click "Screen Entity" button again
- [ ] **Verify:** Fresh screening form appears
- [ ] **Screenshot:** Blank screening form
- [ ] Select entity type: `Company`
- [ ] **Selector:** `radio[value="company"]` or type selector
- [ ] Enter Company Name: `Golden Dragon Trading Co.`
- [ ] **Selector:** `input[name="companyName"]` or similar
- [ ] Enter Business Registry: `BRG-2847`
- [ ] **Selector:** `input[name="businessRegistry"]`
- [ ] Select Country: `China`
- [ ] **Selector:** `select[name="country"]` or dropdown
- [ ] Click "Submit for Screening"
- [ ] **Verify:** Form submitted successfully
- [ ] **Screenshot:** Company screening submitted
- [ ] Wait for results (2-5 seconds)
- [ ] **Verify:** Results show company screening details
- [ ] **Screenshot:** Company screening results
- [ ] **Pass/Fail:** ☐ Company screening completed

---

### Step 5: Navigate to Alert Queue
**Action:** Access alert management queue
- [ ] Click "Alert Queue" in left sidebar navigation
- [ ] **Selector:** `a[href*="alerts"]` or `li:contains("Alert")`
- [ ] **Verify:** Alert Queue page loads with list of alerts
- [ ] **Screenshot:** Full alert queue page
- [ ] Confirm both screening alerts appear in list
- [ ] **Verify:** "Alexei Petrov" alert visible
- [ ] **Verify:** "Golden Dragon Trading Co." alert visible
- [ ] **Selector:** Alert list items/rows
- [ ] **Screenshot:** Alert list showing both screenings
- [ ] **Pass/Fail:** ☐ Alert Queue loaded with screening alerts

---

### Step 6: Filter by Date Range
**Action:** Filter alerts using date range selector
- [ ] Locate filter controls at top of Alert Queue
- [ ] **Selector:** `.filter-section` or filter controls area
- [ ] Click "Date Range" filter
- [ ] **Verify:** Date range picker appears (or dropdown)
- [ ] **Selector:** Date input fields or date picker
- [ ] **Screenshot:** Date range filter open
- [ ] Select start date: Today or last 7 days
- [ ] **Selector:** `input[name="startDate"]` or calendar picker
- [ ] Select end date: Today
- [ ] **Selector:** `input[name="endDate"]`
- [ ] Click "Apply Filter" or auto-applies
- [ ] **Verify:** Alert list updates to show only alerts in date range
- [ ] **Verify:** Both recent screenings still visible
- [ ] **Screenshot:** Filtered alert list by date
- [ ] **Pass/Fail:** ☐ Date range filter working

---

### Step 7: Sort by Confidence Score
**Action:** Sort alerts by matching confidence score
- [ ] Locate sort controls in Alert Queue
- [ ] **Selector:** `.sort-dropdown` or column header for sorting
- [ ] Click on "Confidence Score" column header or sort dropdown
- [ ] **Verify:** Sorting options appear
- [ ] **Selector:** Dropdown menu or sort direction buttons
- [ ] **Screenshot:** Sort options visible
- [ ] Select "Highest to Lowest" or descending option
- [ ] **Verify:** Alert list re-orders by confidence score
- [ ] **Verify:** Highest confidence alerts appear at top
- [ ] **Selector:** Alert rows showing scores
- [ ] **Screenshot:** Alerts sorted by confidence score descending
- [ ] Verify confidence scores visible in list
- [ ] **Verify:** Each alert row shows % score (e.g., "89.2%")
- [ ] **Pass/Fail:** ☐ Sorting by confidence score working

---

### Step 8: Bulk Select 5 Alerts
**Action:** Select multiple alerts for bulk action
- [ ] Click select-all checkbox at top of alert table (if >5 alerts available)
- [ ] **Selector:** `input[type="checkbox"][class*="select-all"]`
- [ ] **Verify:** All visible alerts get selected
- [ ] **Screenshot:** All alerts selected
- [ ] If fewer than 5 alerts exist, manually select 5 alerts:
  - [ ] Click checkbox for first alert
  - [ ] **Selector:** `input[type="checkbox"]` for row 1
  - [ ] Click checkbox for second alert
  - [ ] **Selector:** `input[type="checkbox"]` for row 2
  - [ ] Continue for rows 3, 4, 5
- [ ] **Verify:** Checkmarks visible for selected alerts
- [ ] **Selector:** Checked checkboxes
- [ ] **Screenshot:** 5 alerts selected
- [ ] Check for bulk action toolbar
- [ ] **Verify:** Toolbar appears with action buttons
- [ ] **Verify:** See "Bulk Resolve", "Bulk Tag", "Bulk Export" or similar buttons
- [ ] **Selector:** `.bulk-actions` or `.toolbar` section
- [ ] **Screenshot:** Bulk action toolbar visible
- [ ] **Pass/Fail:** ☐ Bulk selection working

---

### Step 9: Bulk Resolve as False Positive
**Action:** Resolve multiple alerts as false positives in one action
- [ ] With 5 alerts selected, click "Bulk Resolve" button
- [ ] **Selector:** `button:contains("Bulk")` or `.bulk-resolve`
- [ ] **Verify:** Bulk resolution dialog appears
- [ ] **Screenshot:** Bulk resolution dialog
- [ ] Check resolution options in dialog
- [ ] **Verify:** See "False Positive", "True Positive", "Requires Info" options
- [ ] **Selector:** `radio` buttons or option buttons
- [ ] **Screenshot:** Resolution options
- [ ] Select "False Positive" option
- [ ] **Verify:** Option selected (radio button checked)
- [ ] Optional: Add bulk notes
- [ ] **Selector:** `textarea[name="bulkNotes"]` if available
- [ ] Type note: `Batch review - All entities cleared via secondary verification`
- [ ] Click "Confirm Resolution" button
- [ ] **Verify:** Bulk resolution processed
- [ ] **Screenshot:** Confirmation message
- [ ] Check alert queue updates
- [ ] **Verify:** Bulk-resolved alerts disappear or mark as "Resolved"
- [ ] **Verify:** Alert count decreases
- [ ] **Screenshot:** Alert queue after bulk resolution
- [ ] **Pass/Fail:** ☐ Bulk resolution completed

---

### Step 10: Open Remaining Critical Alert
**Action:** Open detail view of single critical alert
- [ ] Look for remaining unresolved critical alert in queue
- [ ] **Verify:** At least one critical alert remains (or create one for this step)
- [ ] Click on alert row to open detail panel
- [ ] **Selector:** Alert row or alert item (clickable area)
- [ ] **Verify:** Alert detail panel/modal opens
- [ ] **Screenshot:** Alert detail view
- [ ] Check alert header showing:
  - [ ] Entity name (Alexei Petrov or similar)
  - [ ] Alert severity badge (RED/CRITICAL)
  - [ ] Risk score percentage
  - [ ] Created date/time
- [ ] **Selector:** Header section with entity info
- [ ] **Screenshot:** Alert header details
- [ ] **Pass/Fail:** ☐ Alert detail panel opened

---

### Step 11: Compare Entity Details Side-by-Side
**Action:** Review and compare entity information with matched records
- [ ] In alert detail, locate "Entity Information" section
- [ ] **Verify:** Submitted entity details visible
- [ ] **Selector:** Section with entity name, DOB, passport, country
- [ ] **Screenshot:** Submitted entity information block
- [ ] Locate "Matched Records" section below
- [ ] **Verify:** Table/list of matched entities appears
- [ ] **Selector:** Matched records table or list
- [ ] **Screenshot:** Matched records from databases
- [ ] Look for comparison view or details expansion
- [ ] Click on first matched record to expand/compare
- [ ] **Verify:** Detailed comparison appears side-by-side or in expanded view
- [ ] **Selector:** Match detail row expansion or comparison panel
- [ ] **Screenshot:** Expanded match detail with fields highlighted
- [ ] Check comparison shows field-by-field matching:
  - [ ] Name comparison (matching portions highlighted)
  - [ ] DOB comparison
  - [ ] Passport/ID comparison
  - [ ] Country match
- [ ] **Selector:** Field-by-field comparison cells
- [ ] **Screenshot:** Detailed field comparison
- [ ] **Pass/Fail:** ☐ Entity comparison view working

---

### Step 12: Review Evidence Chips (Scoring Components)
**Action:** Examine matching algorithm score components
- [ ] Scroll down in alert detail to "Scoring Breakdown" or "Match Confidence"
- [ ] **Verify:** Evidence chips/badges appear
- [ ] **Selector:** `.score-chip`, `.evidence-tag`, or badge elements
- [ ] **Screenshot:** Evidence chips/scoring components displayed
- [ ] Verify chips show individual matching scores:
  - [ ] Jaro-Winkler Score: (percentage)
  - [ ] Phonetic Match: (percentage)
  - [ ] Token Set Ratio: (percentage)
  - [ ] Fuzzy String Match: (percentage)
  - [ ] Other algorithm scores if applicable
- [ ] **Selector:** Individual chip elements with labels
- [ ] **Screenshot:** Each evidence chip detail
- [ ] Click or hover on one chip for tooltip/explanation
- [ ] **Verify:** Tooltip shows what the score measures
- [ ] **Selector:** Hover tooltip or info icon
- [ ] **Screenshot:** Tooltip explanation for chip
- [ ] Verify overall confidence is weighted average or sum
- [ ] **Verify:** Total score shown (e.g., "89.2%")
- [ ] **Pass/Fail:** ☐ Evidence chips and scoring visible

---

### Step 13: Add Detailed Investigation Notes
**Action:** Document thorough investigation findings
- [ ] Scroll to "Investigation Notes" or "Notes" section
- [ ] **Verify:** Text area for notes visible
- [ ] **Selector:** `textarea[name="notes"]` or `.notes-field`
- [ ] Click in notes field
- [ ] Type comprehensive notes:
```
Investigation Summary - Alexei Petrov (RUS-55219938)

FINDINGS:
- Cross-referenced 3 international sanctions databases (OFAC, EU, UN)
- Found 2 potential matches with varying confidence scores
- Primary match: 89.2% confidence (Jaro-Winkler: 92%, Phonetic: 85%)
- Secondary match: 62.1% confidence (likely false positive - different DOB)

VERIFICATION STEPS TAKEN:
1. Contacted issuing authority for passport verification
2. Reviewed travel history records (available documents)
3. Cross-matched with news reports and media mentions
4. Checked business registration and ownership records

RECOMMENDATION:
Escalate to Sanctions Compliance Team for final determination given moderate-to-high confidence match. Recommend blocking transaction pending verification completion.

Investigation Date: 2026-03-26
Investigator: Maria Santos, AML Analyst
```
- [ ] **Verify:** Text entered in notes field
- [ ] **Screenshot:** Notes field populated with investigation details
- [ ] Check character count or word count if available
- [ ] **Selector:** Character counter if present
- [ ] Click "Save Notes" button
- [ ] **Verify:** Notes saved (confirmation or auto-save indicator)
- [ ] **Selector:** Save button or confirmation message
- [ ] **Screenshot:** Notes saved confirmation
- [ ] **Pass/Fail:** ☐ Investigation notes added and saved

---

### Step 14: Escalate to Supervisor
**Action:** Route alert to supervisor for review and approval
- [ ] Locate "Escalation" or "Assign to" section in alert detail
- [ ] **Verify:** Dropdown or button for escalation/assignment
- [ ] **Selector:** `.escalation-control` or assign dropdown
- [ ] Click escalation control
- [ ] **Verify:** Supervisor list or escalation options appear
- [ ] **Screenshot:** Escalation options dialog
- [ ] Select supervisor: `John Mitchell (Compliance Manager)`
- [ ] **Selector:** `select[name="supervisor"]` or supervisor option
- [ ] Optional: Add escalation message
- [ ] **Selector:** `textarea[name="escalationMessage"]`
- [ ] Type message: `High confidence match requiring sanctions team review. See investigation notes for full analysis. Awaiting your direction on transaction block decision.`
- [ ] Click "Escalate" or "Assign" button
- [ ] **Verify:** Alert escalated successfully
- [ ] **Screenshot:** Escalation confirmation message
- [ ] Check alert status updates
- [ ] **Verify:** Status shows "ESCALATED" or "ASSIGNED TO SUPERVISOR"
- [ ] **Selector:** Status badge update
- [ ] **Screenshot:** Updated alert status
- [ ] **Pass/Fail:** ☐ Alert escalated to supervisor

---

### Step 15: Check Audit Trail
**Action:** Review complete audit trail of all alert actions
- [ ] Scroll to "Audit Trail" or "Activity Log" section
- [ ] **Verify:** Chronological list of all alert activities visible
- [ ] **Selector:** `.audit-trail`, `.activity-log`, or similar
- [ ] **Screenshot:** Full audit trail section
- [ ] Verify entries in order (most recent first):
  - [ ] Latest: "Alert Escalated" - timestamp, "Escalated to: John Mitchell"
  - [ ] Previous: "Investigation Notes Added" - timestamp, preview of notes
  - [ ] Previous: "Alert Created" - timestamp, original screening details
- [ ] **Selector:** Audit log entries
- [ ] **Screenshot:** Multiple audit trail entries
- [ ] Click on one audit entry to expand details
- [ ] **Verify:** Full details appear (change summary, user, timestamp)
- [ ] **Selector:** Expandable audit log entry
- [ ] **Screenshot:** Expanded audit entry detail
- [ ] Check for immutability indicators
- [ ] **Verify:** No edit/delete buttons on audit entries
- [ ] **Verify:** Hash or checksum visible (if tamper-evidence feature)
- [ ] **Selector:** Hash value if present
- [ ] **Screenshot:** Audit entry with hash/checksum
- [ ] **Pass/Fail:** ☐ Audit trail complete and immutable

---

### Step 16: Configuration Page - Fuzzy Threshold
**Action:** Access configuration and adjust fuzzy matching threshold
- [ ] Click "Configuration" or "Settings" in left sidebar
- [ ] **Selector:** `a[href*="config"]` or `.settings-link`
- [ ] **Verify:** Configuration page loads
- [ ] **Screenshot:** Configuration page overview
- [ ] Locate "Fuzzy Matching Threshold" slider or input
- [ ] **Selector:** `input[type="range"]` or `.fuzzy-threshold`
- [ ] **Verify:** Current value shows: `0.7` (70%)
- [ ] **Screenshot:** Current fuzzy threshold setting
- [ ] Check threshold range
- [ ] **Verify:** Slider shows range 0.5 to 0.95 (or similar)
- [ ] **Verify:** Description explains threshold impact
- [ ] **Selector:** Label or help text for threshold
- [ ] **Screenshot:** Threshold range and description
- [ ] **Pass/Fail:** ☐ Configuration page and threshold control found

---

### Step 17: Adjust Threshold to 0.85
**Action:** Change fuzzy matching threshold and preview impact
- [ ] Click and drag fuzzy threshold slider to right
- [ ] **Selector:** `input[type="range"][name="fuzzyThreshold"]`
- [ ] Drag to value: `0.85` (85%)
- [ ] **Verify:** Slider position updates to ~0.85
- [ ] **Verify:** Input field shows "0.85" or similar
- [ ] **Screenshot:** Slider adjusted to 0.85
- [ ] Verify real-time impact preview appears
- [ ] **Verify:** Section shows "Preview: Estimated Impact"
- [ ] **Selector:** `.preview-section` or impact preview
- [ ] **Screenshot:** Impact preview section
- [ ] Check preview shows:
  - [ ] Estimated alerts affected: X fewer alerts above 0.85
  - [ ] False positive reduction: Estimated percentage
  - [ ] Processing impact: (if any)
- [ ] **Verify:** Preview updates as slider changes
- [ ] **Screenshot:** Impact preview with new threshold
- [ ] **Pass/Fail:** ☐ Threshold adjusted with preview

---

### Step 18: Preview Impact on Recent Screenings
**Action:** See how threshold change affects past screening results
- [ ] In preview section, look for "Affected Screenings" or similar
- [ ] **Verify:** List shows which screenings would be affected by new threshold
- [ ] **Selector:** Affected screenings list in preview
- [ ] **Screenshot:** List of screenings affected by threshold change
- [ ] Check if "Alexei Petrov" screening still qualifies
- [ ] **Verify:** If score > 0.85, alert would remain
- [ ] **Verify:** If score < 0.85, alert would be dismissed/demoted
- [ ] **Selector:** Alert indicators for each screening
- [ ] **Screenshot:** Impact analysis for specific screenings
- [ ] **Pass/Fail:** ☐ Impact preview shows affected screenings

---

### Step 19: Save Configuration Changes
**Action:** Apply new fuzzy threshold setting
- [ ] Locate "Save Configuration" button
- [ ] **Selector:** `button:contains("Save")` or `.save-config`
- [ ] **Verify:** Button is enabled and clickable
- [ ] Click "Save Configuration" button
- [ ] **Verify:** Configuration saved successfully
- [ ] **Selector:** Success message or confirmation toast
- [ ] **Screenshot:** Configuration save confirmation
- [ ] Check for notification message
- [ ] **Verify:** Message confirms "Fuzzy Threshold updated to 0.85"
- [ ] **Screenshot:** Success notification
- [ ] Verify changes persist
- [ ] **Verify:** Threshold remains at 0.85 after page refresh
- [ ] **Pass/Fail:** ☐ Configuration saved successfully

---

### Step 20: Screen Same Entity with New Threshold
**Action:** Re-screen Alexei Petrov and compare results with new threshold
- [ ] Click "Screen Entity" button to return to screening form
- [ ] **Selector:** `.screen-button` or navigation link
- [ ] Enter same entity details as Step 3:
  - [ ] Entity Type: `Individual`
  - [ ] Full Name: `Alexei Petrov`
  - [ ] Passport: `RUS-55219938`
  - [ ] Country: `Russia`
- [ ] Click "Submit for Screening"
- [ ] **Verify:** Screening submits and processes
- [ ] **Screenshot:** New screening submitted
- [ ] Wait for results (2-5 seconds)
- [ ] **Verify:** Results page appears
- [ ] **Screenshot:** New screening results with 0.85 threshold
- [ ] Compare results to Step 3
- [ ] **Verify:** Results may differ based on new 0.85 threshold:
  - [ ] If previous score was 80-85%: May now be filtered out
  - [ ] If previous score was >85%: Should still appear
  - [ ] Confidence score itself doesn't change, but alert inclusion may
- [ ] **Selector:** Risk score display
- [ ] **Screenshot:** Updated risk score/results with new threshold
- [ ] Check alert queue
- [ ] **Verify:** New screening alert created if still above 0.85
- [ ] **Verify:** Alert status reflects new threshold logic
- [ ] **Screenshot:** Alert queue showing new screening alert
- [ ] **Pass/Fail:** ☐ New screening reflects configuration change

---

## Summary
- [ ] All 20 steps completed
- [ ] Both individual and company screenings performed
- [ ] Alert queue filtered and sorted correctly
- [ ] Bulk operations (5 alerts resolved) completed
- [ ] Detailed alert investigation with notes completed
- [ ] Alert escalated to supervisor
- [ ] Complete audit trail verified
- [ ] Configuration threshold adjusted
- [ ] Impact preview reviewed
- [ ] Same entity rescreened with new threshold
- [ ] Configuration changes persisted

**Overall Result:** ☐ PASS / ☐ FAIL

**Notes/Issues:**
