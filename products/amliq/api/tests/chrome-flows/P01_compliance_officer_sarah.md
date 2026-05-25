# AMLIQ AML Platform - Test Flow P01
## Persona: Sarah Chen - Chief Compliance Officer

### Persona Profile
- **Name:** Sarah Chen
- **Role:** Chief Compliance Officer (CCO)
- **Company:** Midwest Regional Bank (250+ employees, $1.2B AUM)
- **Experience Level:** 12 years in compliance, moderate technical proficiency
- **Goals:** Evaluate AMLIQ for bank-wide adoption; verify accuracy, compliance features, audit trail integrity
- **Success Criteria:** Complete full screening workflow with detailed alert investigation and reporting

---

## Prerequisites
- [ ] Chrome browser open and clear cache
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] Confirm page loads within 3 seconds
- [ ] Test account ready (or will create during flow)
- [ ] API endpoint http://localhost:3001/api/v1 is accessible

---

## Test Flow Steps

### Step 1: Marketing Page Review
**Action:** Load landing page and review key sections
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] **Verify:** Page loads with hero section visible
- [ ] **Screenshot:** Full page hero with "AMLIQ AML Screening" headline
- [ ] Scroll to "Features" section
- [ ] **Verify:** See Real-time Screening, Risk Assessment, Compliance Reporting cards
- [ ] **Screenshot:** Features section
- [ ] Scroll to "How It Works" section
- [ ] **Verify:** Four-step process visible (Upload → Screen → Review → Export)
- [ ] **Screenshot:** How It Works section
- [ ] Look for security badges/certifications at bottom
- [ ] **Verify:** See SOC 2, ISO 27001, GDPR compliance indicators
- [ ] **Screenshot:** Security/compliance footer
- [ ] **Pass/Fail:** ☐ All sections loaded and visible as expected

---

### Step 2: Sign Up Flow
**Action:** Create test account for screening workflow
- [ ] Locate "Get Started" button on hero section
- [ ] **Selector:** `button:contains("Get Started")` or main CTA button
- [ ] Click "Get Started" button
- [ ] **Verify:** Redirected to sign-up form
- [ ] **Screenshot:** Sign-up form page
- [ ] Enter email: `sarah.chen.test@midwestbank.com`
- [ ] **Selector:** `input[type="email"]`
- [ ] Enter password: `TestPassword123!@#`
- [ ] **Selector:** `input[type="password"]`
- [ ] Enter company name: `Midwest Regional Bank`
- [ ] **Selector:** `input[placeholder*="Company"]`
- [ ] Check "I agree to Terms of Service"
- [ ] **Selector:** `input[type="checkbox"]`
- [ ] Click "Create Account" button
- [ ] **Verify:** Account created, redirected to dashboard
- [ ] **Screenshot:** Dashboard post-signup
- [ ] **Pass/Fail:** ☐ Account created successfully with email confirmation

---

### Step 3: Dashboard Overview
**Action:** Review main dashboard interface and metrics
- [ ] **Verify:** Dashboard loads with main navigation visible (left sidebar)
- [ ] **Selector:** `.sidebar` or `nav[role="navigation"]`
- [ ] **Screenshot:** Full dashboard view
- [ ] Check key metrics cards at top of dashboard
- [ ] **Verify:** See "Total Screenings", "Alerts Generated", "True Positives" cards with values
- [ ] **Screenshot:** Metrics/stats cards
- [ ] Locate "Quick Start: Run First Screening" section
- [ ] **Verify:** CTA button visible to start screening
- [ ] **Pass/Fail:** ☐ Dashboard loads with all expected sections

---

### Step 4: Run First Screening - Individual
**Action:** Screen individual "Mohammad Al-Rahman" with Syrian passport
- [ ] Click "Screen Entity" or "New Screening" button on dashboard
- [ ] **Selector:** `button:contains("Screen")` or similar
- [ ] **Verify:** Screening form appears
- [ ] **Screenshot:** Empty screening form
- [ ] Select "Individual" entity type
- [ ] **Selector:** `select[name="entityType"]` or radio `input[value="individual"]`
- [ ] Enter Full Name: `Mohammad Al-Rahman`
- [ ] **Selector:** `input[name="fullName"]` or `input[placeholder*="Name"]`
- [ ] Select Date of Birth: `1975-03-15`
- [ ] **Selector:** `input[type="date"]` or date picker
- [ ] Select Country: `Syria`
- [ ] **Selector:** `select[name="country"]` or `input[name="country"]`
- [ ] Enter Passport Number: `SYR-8847721`
- [ ] **Selector:** `input[name="passportNumber"]` or `input[placeholder*="Passport"]`
- [ ] Click "Submit for Screening" button
- [ ] **Verify:** Request sent to API, loading indicator appears
- [ ] **Screenshot:** Form submission with loading state
- [ ] **Pass/Fail:** ☐ Form submitted successfully

---

### Step 5: Review Screening Results
**Action:** Analyze results for Mohammad Al-Rahman screening
- [ ] **Verify:** Results page loads after 2-5 seconds
- [ ] **Screenshot:** Full results page
- [ ] Check "Screening Status" field
- [ ] **Verify:** Status shows "MATCH FOUND" or "HIGH RISK" alert
- [ ] **Selector:** `span[class*="status"]` or `.alert-badge`
- [ ] **Screenshot:** Status indicator
- [ ] Review "Risk Score" display
- [ ] **Verify:** Risk score shows numerical value (0-100 scale)
- [ ] **Selector:** `.risk-score` or `span[class*="score"]`
- [ ] **Screenshot:** Risk score display
- [ ] Check "Matched Records" section for number of matches
- [ ] **Verify:** Shows "1 match found" or similar
- [ ] **Screenshot:** Matched records count
- [ ] **Pass/Fail:** ☐ Results displayed with match found

---

### Step 6: Check Confidence Scores
**Action:** Review matching algorithm confidence scores
- [ ] Scroll down to "Match Details" section
- [ ] **Verify:** Table with matched entity details visible
- [ ] **Screenshot:** Match details table
- [ ] Check confidence score column
- [ ] **Verify:** See percentage value (e.g., "92.5%")
- [ ] **Selector:** `td[class*="confidence"]` or `span[class*="score"]`
- [ ] **Screenshot:** Confidence score cell
- [ ] Expand first match record (click row or expand button)
- [ ] **Verify:** Detailed scoring breakdown appears
- [ ] **Screenshot:** Expanded match details
- [ ] Look for individual score components (Jaro-Winkler, Phonetic, Token Set, etc.)
- [ ] **Verify:** See at least 3 scoring method results with values
- [ ] **Selector:** `.score-component` or `li[class*="score"]`
- [ ] **Screenshot:** Score components breakdown
- [ ] **Pass/Fail:** ☐ Confidence scores and components visible

---

### Step 7: Navigate to Alert Queue
**Action:** Access and review alert management queue
- [ ] Click "Alert Queue" in left navigation sidebar
- [ ] **Selector:** `a[href*="alerts"]` or `button:contains("Alert")`
- [ ] **Verify:** Alert Queue page loads with list of alerts
- [ ] **Screenshot:** Alert Queue default view
- [ ] Confirm recent screening alert appears in list
- [ ] **Verify:** "Mohammad Al-Rahman" alert visible in queue
- [ ] **Selector:** `tr` or `li` containing entity name
- [ ] **Screenshot:** Alert list with recent alert
- [ ] **Pass/Fail:** ☐ Alert Queue loads and recent alert visible

---

### Step 8: Filter by Critical Priority
**Action:** Filter alerts to show only critical priority items
- [ ] Locate filter controls/dropdown at top of Alert Queue
- [ ] **Selector:** `select[name="priority"]` or `.filter-controls`
- [ ] Click Priority filter dropdown
- [ ] **Verify:** Priority options appear (Low, Medium, High, Critical)
- [ ] **Screenshot:** Filter dropdown menu
- [ ] Select "Critical" priority
- [ ] **Verify:** Alert list updates to show only critical alerts
- [ ] **Selector:** `option[value="critical"]` or checkbox
- [ ] **Screenshot:** Filtered alert list (critical only)
- [ ] Confirm Mohammad Al-Rahman alert still visible (should be critical)
- [ ] **Verify:** Alert row is highlighted or marked as critical
- [ ] **Pass/Fail:** ☐ Filters applied correctly showing critical alerts

---

### Step 9: Open Alert Detail View
**Action:** Open and inspect full alert details
- [ ] Click on Mohammad Al-Rahman alert row to open details
- [ ] **Selector:** `tr[data-alert-id*="*"]` or `.alert-item`
- [ ] **Verify:** Side panel or modal opens with full alert details
- [ ] **Screenshot:** Alert detail panel
- [ ] Check alert headers showing:
  - [ ] Entity Name: `Mohammad Al-Rahman`
  - [ ] Alert Created Date/Time
  - [ ] Current Status: `PENDING REVIEW`
  - [ ] Risk Score: (numerical value)
- [ ] **Screenshot:** Alert header information
- [ ] Review "Entity Information" section
- [ ] **Verify:** DOB (1975-03-15), Country (Syria), Passport (SYR-8847721) all present
- [ ] **Selector:** `div[class*="entity-info"]` or similar
- [ ] **Screenshot:** Entity information block
- [ ] **Pass/Fail:** ☐ Alert detail view opens with correct entity data

---

### Step 10: Add Investigation Notes
**Action:** Document investigation findings in alert notes
- [ ] Scroll to "Investigation Notes" or "Notes" section in alert detail
- [ ] **Verify:** Text area for notes visible
- [ ] **Selector:** `textarea[name="notes"]` or `div[contenteditable="true"]`
- [ ] Click in notes field
- [ ] Type investigation note: `Preliminary investigation: Cross-referenced with OFAC SDN list. Found 2 potential matches with varying confidence. Recommend escalation to sanctions team for final determination. Syrian national with concerning travel history.`
- [ ] **Screenshot:** Notes field populated
- [ ] Look for character count indicator
- [ ] **Verify:** Shows count of characters entered
- [ ] Click "Save Notes" or similar button
- [ ] **Verify:** Notes saved (confirmation message or auto-save indicator)
- [ ] **Screenshot:** Notes saved confirmation
- [ ] **Pass/Fail:** ☐ Investigation notes added and saved

---

### Step 11: Resolve as True Positive
**Action:** Mark alert as confirmed match requiring action
- [ ] Locate "Resolution" dropdown or status selector
- [ ] **Selector:** `select[name="resolution"]` or `.status-dropdown`
- [ ] **Verify:** Currently shows "PENDING REVIEW"
- [ ] Click to open resolution options
- [ ] **Verify:** Options appear: "Pending Review", "False Positive", "True Positive", "Requires More Info"
- [ ] **Screenshot:** Resolution dropdown options
- [ ] Select "True Positive"
- [ ] **Verify:** Dropdown updates to show selection
- [ ] **Screenshot:** "True Positive" selected
- [ ] Look for additional required fields after selection
- [ ] **Verify:** May show "Action Required" or "Escalation Level" field
- [ ] **Selector:** Additional form field if present
- [ ] Click "Save Resolution" or auto-saves
- [ ] **Verify:** Status updates to "TRUE POSITIVE" with visual indicator (red/orange badge)
- [ ] **Screenshot:** Alert marked as True Positive with badge
- [ ] **Pass/Fail:** ☐ Alert resolved as True Positive successfully

---

### Step 12: Check Audit Trail Entry
**Action:** Verify audit trail records the resolution action
- [ ] Scroll to "Audit Trail" or "Activity Log" section
- [ ] **Verify:** Chronological list of all actions on this alert visible
- [ ] **Selector:** `.audit-trail` or `.activity-log`
- [ ] **Screenshot:** Full audit trail section
- [ ] Confirm most recent entry shows:
  - [ ] Action: "Alert Status Changed"
  - [ ] User: Current user (Sarah Chen)
  - [ ] Timestamp: Current date/time
  - [ ] Change: "PENDING REVIEW → TRUE POSITIVE"
  - [ ] Notes: Investigation notes from step 10
- [ ] **Screenshot:** Recent audit entry
- [ ] Check entry before that (creation)
- [ ] **Verify:** Shows "Alert Created" with original matching details
- [ ] **Screenshot:** Alert creation audit entry
- [ ] Verify audit entries are immutable (no edit/delete buttons)
- [ ] **Verify:** Hash or checksum visible if available
- [ ] **Selector:** `span[class*="hash"]` or `code[class*="checksum"]`
- [ ] **Screenshot:** Audit trail with hash/checksum if present
- [ ] **Pass/Fail:** ☐ Audit trail complete with all actions recorded

---

### Step 13: Review Analytics
**Action:** Access and review platform analytics and metrics
- [ ] Click "Analytics" in left navigation
- [ ] **Selector:** `a[href*="analytics"]` or nav item
- [ ] **Verify:** Analytics dashboard page loads
- [ ] **Screenshot:** Full analytics page
- [ ] Check "Screening Statistics" card
- [ ] **Verify:** Shows:
  - [ ] Total Screenings: At least 1
  - [ ] Total Alerts: At least 1
  - [ ] True Positive Rate: Percentage
  - [ ] False Positive Rate: Percentage
- [ ] **Screenshot:** Statistics card
- [ ] Review "Alerts Over Time" chart
- [ ] **Verify:** Line or bar chart showing trend (should show spike at current time)
- [ ] **Selector:** `canvas` or `svg[class*="chart"]`
- [ ] **Screenshot:** Alerts chart
- [ ] Check "Top Risk Countries" breakdown
- [ ] **Verify:** Syria appears in list with count
- [ ] **Screenshot:** Risk countries data
- [ ] Review "Confidence Score Distribution" histogram
- [ ] **Verify:** Distribution chart visible showing score ranges
- [ ] **Screenshot:** Confidence score histogram
- [ ] **Pass/Fail:** ☐ Analytics loaded with current screening data

---

### Step 14: Export Report
**Action:** Generate and export compliance report
- [ ] Click "Export Report" button on analytics page
- [ ] **Selector:** `button:contains("Export")` or `.export-button`
- [ ] **Verify:** Report options modal/dialog appears
- [ ] **Screenshot:** Export options dialog
- [ ] Check export format options
- [ ] **Verify:** See PDF, CSV, Excel options available
- [ ] **Selector:** `input[type="radio"]` with format options
- [ ] Select "PDF" format
- [ ] Check report date range
- [ ] **Verify:** Current date range selected (typically last 30 days)
- [ ] **Selector:** Date range inputs
- [ ] Optionally add report title: `AMLIQ Screening Report - March 2026`
- [ ] **Selector:** `input[name="title"]`
- [ ] Optionally select "Include Audit Trail" checkbox
- [ ] **Selector:** `input[type="checkbox"][name="includeAudit"]`
- [ ] Click "Generate Report" button
- [ ] **Verify:** Download starts or preview opens
- [ ] **Screenshot:** Report generation/download confirmation
- [ ] Check that PDF contains:
  - [ ] Company name (Midwest Regional Bank)
  - [ ] Date range
  - [ ] Screening statistics
  - [ ] Mohammad Al-Rahman screening results
  - [ ] Alert details and resolution
- [ ] **Pass/Fail:** ☐ Report generated and contains all required data

---

## Summary
- [ ] All 14 steps completed
- [ ] Screenshots captured for each major action
- [ ] No errors encountered during flow
- [ ] Dashboard responsive and performant
- [ ] Audit trail functioning correctly
- [ ] Export report completed successfully

**Overall Result:** ☐ PASS / ☐ FAIL

**Notes/Issues:**
