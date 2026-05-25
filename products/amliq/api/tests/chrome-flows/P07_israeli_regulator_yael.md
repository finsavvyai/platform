# Test Flow P07: Israeli Compliance Regulator - Yael Goldstein

## Persona Profile
- **Name:** Yael Goldstein
- **Role:** Compliance Regulator / AML Analyst
- **Organization:** Israeli Ministry of Defense (MoD) - Financial Compliance Unit
- **Experience Level:** Advanced (5+ years AML/CFT compliance)
- **Key Goals:** Verify AMLIQ meets Israeli regulatory requirements, validate sanctions screening for MoD entities, ensure strictest AML thresholds
- **Technical Proficiency:** High (comfortable with compliance systems and regulatory frameworks)
- **Regulatory Focus:** FATF AML standards, Israeli Defense Regulations, UN sanctions, entity screening with high confidence thresholds

## Prerequisites
- AMLIQ deployed at https://2b690a17.aegis-97g.pages.dev
- API available at http://localhost:3001/api/v1
- Yael's regulatory analyst account created with full access
- Israeli Regulation preset configured in system
- Israeli MoD sanctions list synced and current
- Test entities: Individual (Ahmed Hassan Ibrahim), Company (Levant Maritime Services Ltd)
- Chrome browser with console access enabled
- Network connectivity confirmed

## Test Flow: Israeli Regulatory Compliance Screening

### Step 1: Login as Israeli Regulator
- **Action:** Navigate to https://2b690a17.aegis-97g.pages.dev → Click "Login" → Email: yael.goldstein@imod-compliance.gov.il → Password: MoDCompliance#2026 → "Sign In"
- **Expected Result:** Dashboard loads with "Yael Goldstein", "Compliance Regulator" badge, organization "Israeli MoD"
- **Verify:** URL = /dashboard, role badge visible, no 403 errors
- **Screenshot:** Take after login
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 2: Navigate to Configuration Page
- **Action:** Click "Configuration" in left sidebar → Wait for page load
- **Expected Result:** Configuration page with sections: Regulatory Presets, Screening Thresholds, Sanctions List Selection, Evidence Layers, Export Settings
- **Verify:** All sections visible, no 404 errors
- **Screenshot:** Take full configuration page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 3: Select Israeli Regulation Preset
- **Action:** In "Regulatory Presets" section, find "Israeli Regulation" → Click "Select Preset" → Confirm selection
- **Expected Result:** Modal shows strictest thresholds: Confidence Score Minimum = 0.95, Fuzzy Threshold = 0.90, Phonetic Threshold = 0.88, Token Set = 0.92, Embedding = 0.91, Graph = 0.94
- **Verify:** Preset details visible, thresholds are strictest available
- **Screenshot:** Take preset selection modal
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 4: Verify Preset Values Applied
- **Action:** Verify thresholds update in Configuration page after confirmation
- **Expected Result:** Page shows all thresholds as configured: 0.95, 0.90, 0.88, 0.92, 0.91, 0.94. Badge: "Israeli Regulation (Applied)"
- **Verify:** All thresholds match, badge indicates active preset
- **Screenshot:** Take thresholds section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 5: Screen Individual Against Israeli MoD List
- **Action:** Navigate to "Screen Entity" → Select "Individual" → Enter: First Name: Ahmed, Last Name: Ibrahim, DOB: 1968-07-22, Nationality: Jordanian, Passport: JOR-44829173 → Click "Screen"
- **Expected Result:** Screening initiates, progress bar visible, API call to /api/v1/screen succeeds within 5 seconds
- **Verify:** Request successful, response received, no 400/500 errors
- **Screenshot:** Take form filled
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 6: Review Individual Screening Results
- **Action:** Wait for results → Review Ahmed Hassan Ibrahim screening results
- **Expected Result:** Overall Risk: RED / HIGH RISK, Confidence Score: 0.97 (> 0.95), Matches Found: 1, Primary Match: "Ahmed Hassan Ibrahim" from Israeli MoD (Entry ID: IL-MOD-2024-0847), Status: FLAGGED FOR REVIEW
- **Verify:** Confidence > 0.95, status is FLAGGED, source is Israeli MoD
- **Screenshot:** Take results summary
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 7: Screen Company Against Israeli MoD List
- **Action:** Navigate to Screen → Select "Company" → Enter: Company Name: "Levant Maritime Services Ltd", Country: Lebanon, Registry: LBN-99281 → "Screen"
- **Expected Result:** Screening initiates and completes successfully
- **Verify:** Request succeeds, no validation errors
- **Screenshot:** Take company form filled
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 8: Review Company Screening Results
- **Action:** Wait for company results to display
- **Expected Result:** Risk: RED / HIGH RISK, Confidence: 0.96 (> 0.95), Match: "Levant Maritime Services Ltd" from Israeli MoD (Entry ID: IL-MOD-2024-5532), Associated Entities: 3, Status: FLAGGED - BLOCKED TRANSACTION
- **Verify:** Company matched at 0.96, flagged as HIGH RISK, confidence > 0.95 threshold
- **Screenshot:** Take company results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 9: Review Match Details from Israeli MoD
- **Action:** Click on primary match result → Review match details panel
- **Expected Result:** Details show: Source: Israeli MoD Consolidated List, Entry ID: IL-MOD-2024-0847, Original Name (Hebrew), Transliteration: Ahmed Hassan Ibrahim, Aliases, Date Added: 2024-03-15, Designation Reason: Member of designated organization, Confidence: 0.97
- **Verify:** Source is Israeli MoD, format correct, confidence shown, evidence listed
- **Screenshot:** Take match details panel
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 10: Verify Confidence > 0.95 Threshold
- **Action:** Compare both screening confidence scores (0.97, 0.96) against 0.95 threshold shown in Configuration
- **Expected Result:** Both exceed threshold, both trigger HIGH RISK flags. Display shows "Confidence Score: X exceeds threshold of 0.95"
- **Verify:** Logic correct, both results flagged, threshold comparison accurate
- **Screenshot:** Take threshold comparison
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 11: Review All 6 Screening Layers
- **Action:** Scroll down in results → Locate "Screening Layers" section → Verify all 6 layers present
- **Expected Result:** All 6 layers visible: Exact, Fuzzy, Phonetic, Token Set, Embedding, Graph. Each shows score and confidence.
- **Verify:** 6 layers present, scores visible for each
- **Screenshot:** Take all 6 layers display
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 12: Check Evidence Details for Each Layer
- **Action:** Click on layers to expand details → Review evidence for each
- **Expected Result:** Each layer shows: Name, Confidence Score, Matching Fields, Evidence Details, Contributing Factors, Alternative Matches
- **Verify:** All details present, values consistent, expansion works
- **Screenshot:** Take expanded layer details
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 13: Navigate to Sanctions Lists Page
- **Action:** Click "Sanctions Lists" in left sidebar → Wait for page load
- **Expected Result:** Sanctions Lists management page with table showing all lists: List Name, Source, Entry Count, Last Sync, Status, Last Updated
- **Verify:** Page loads completely, 9+ lists visible
- **Screenshot:** Take full sanctions lists page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 14: Find Israeli MoD List
- **Action:** Scroll through lists → Locate "Israeli Ministry of Defense Consolidated List"
- **Expected Result:** Row shows: List Name, Source: Israeli MoD, Entry Count: 847, Status: ACTIVE, Last Sync: 2026-03-25 14:30 UTC, Confidence Weight: 0.98
- **Verify:** List marked ACTIVE, sync recent (< 24 hours), entry count reasonable
- **Screenshot:** Take Israeli MoD list row
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 15: Check Last Sync Date for Israeli MoD
- **Action:** View "Last Sync" column for Israeli MoD list → Verify recency
- **Expected Result:** Last Sync: "2026-03-25 14:30:00 UTC" (within 24 hours). Age indicator: "Synced 14 hours ago"
- **Verify:** Sync within 24 hours, timestamp format correct, no stale warning
- **Screenshot:** Already in Step 14
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 16: Trigger Manual Sync on Israeli MoD List
- **Action:** Click Israeli MoD list row → Click "Sync Now" → Confirm modal
- **Expected Result:** Sync begins with progress indicator "Syncing... 0%" → "100%". Message: "Israeli MoD list updated: +2 new entries, -0 removed. Total: 849. Updated: 2026-03-26 15:32:15 UTC"
- **Verify:** Sync completes < 30 seconds, entry count updates, timestamp current
- **Screenshot:** Take sync completion message
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 17: Review Audit Trail for All Actions
- **Action:** Click "Audit Trail" → Filter by Date: Today, Action Type: "Screening" → Wait for results
- **Expected Result:** Audit trail shows entries for both screenings: Ahmed Hassan Ibrahim (15:XX:XX), Levant Maritime Services Ltd (15:XX:XX), LIST_SYNC action, all with user, timestamp, IP, status
- **Verify:** All actions logged, timestamps accurate, user identified, immutable
- **Screenshot:** Take audit trail entries
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 18: Export Compliance Report
- **Action:** Click "Export" / "Reports" → Click "Export Compliance Report" → Format: PDF → Date Range: Last 7 days → Check all sections → Click "Export"
- **Expected Result:** File download initiated: "AMLIQ_Compliance_Report_2026-03-26.pdf". File size > 500KB.
- **Verify:** Download starts automatically, file arrives, correct filename
- **Screenshot:** Take export confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 19: Verify Audit Hash Chain Integrity
- **Action:** In Audit Trail, find Ahmed Hassan Ibrahim screening entry → Click "View Hash" / "Verify Integrity"
- **Expected Result:** Modal shows: Current Entry Hash (SHA-256), Previous Entry Hash, "Hash Chain Valid: ✓ YES", Verification: "Cryptographically verified and unaltered"
- **Verify:** Hash format valid (64 hex chars), chain validation passes
- **Screenshot:** Take hash verification modal
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 20: Check Regulatory Fields in Export
- **Action:** Open exported PDF → Verify all regulatory fields present
- **Expected Result:** Report contains: Compliance Header (organization, report date, period, regulations), Screening Summary (total screenings, high-risk matches), Entity Details (both screenings with confidence, list sources, reasons), Configuration Applied (Israeli Regulation preset, all thresholds), Sanctions List Status (Israeli MoD - 849 entries, sync time), Audit Trail (hashes, verification timestamps), Regulatory Certification
- **Verify:** All sections present, no redacted/missing fields, data matches on-screen values
- **Screenshot:** Take PDF first page and sections
- **Checkbox:** ☐ PASS / ☐ FAIL

## Test Summary

**Total Steps:** 20

**Pass Criteria:**
- All 20 steps complete without errors
- Israeli Regulation preset applies with strictest thresholds
- Both screenings trigger HIGH RISK flags at > 0.95 confidence
- All 6 screening layers operational
- Israeli MoD list identified and synced within 24 hours
- Audit trail complete with hash chain integrity
- Compliance report exports with all regulatory fields
- Threshold calculations accurate
- No permission violations

**Regulatory Verification Checklist:**
- ☐ Israeli MoD list integration confirmed
- ☐ Strictest thresholds enforced
- ☐ Confidence > 0.95 threshold enforced
- ☐ All 6 screening layers operational
- ☐ Audit trail immutable and hash-verified
- ☐ Compliance report certifications present
- ☐ No data loss in results
- ☐ User access controls enforce role

**Notes:**
- Test entities fictional for compliance testing
- Israeli MoD list updated daily
- All matches > 0.95 automatically flagged
- Audit logs retain full history indefinitely
- Reports exportable in multiple formats
