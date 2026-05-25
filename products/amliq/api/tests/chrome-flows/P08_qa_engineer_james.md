# Test Flow P08: QA Engineer - James Wilson

## Persona Profile
- **Name:** James Wilson
- **Role:** QA Engineer / Test Automation Specialist
- **Company:** AMLIQ Development Team
- **Experience Level:** Advanced (7+ years QA/testing, 3+ years AML systems)
- **Key Goals:** Break the application, find edge cases, discover bugs, test robustness under extreme conditions
- **Technical Proficiency:** Very High (can read console errors, analyze API responses, understand network traffic)
- **Testing Focus:** Boundary conditions, error handling, UI responsiveness, memory leaks, XSS/injection, race conditions

## Prerequisites
- AMLIQ deployed at https://2b690a17.aegis-97g.pages.dev
- API available at http://localhost:3001/api/v1
- QA test account with full permissions
- Chrome browser with DevTools open (F12)
- Console and Network tabs ready
- Test data for edge cases prepared

## Test Flow: Edge Cases, Boundaries, and Robustness Testing

### Step 1: Rapid Sidebar Navigation
- **Action:** Click sidebar links rapidly (200ms between clicks): Dashboard → Screen → Alerts → Configuration → Analytics → Audit → Monitoring → Batch → Lists → Billing
- **Expected Result:** Application handles rapid navigation without crashing. All pages load completely. UI responsive. No "Cannot read property" errors.
- **Verify:** All pages load, no stuck spinners, back button works
- **Screenshot:** Take console after navigation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 2: Back/Forward Button Navigation
- **Action:** Navigate Dashboard → Screen → Alerts → Configuration → Click back 4 times → forward 4 times → Repeat 3 times total
- **Expected Result:** Back/forward work seamlessly. URL and content sync. No data loss. No console errors.
- **Verify:** URLs correct, content matches, no errors
- **Screenshot:** Take after sequence
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 3: Direct URL Navigation
- **Action:** Manually navigate to each route: /dashboard → /alerts → /screen → /config → /analytics → /audit → /monitoring → /batch → /lists → /billing
- **Expected Result:** All routes load correctly with appropriate content. No 404 pages. Auth passes silently. Page titles update.
- **Verify:** All routes accessible, correct pages load, no 403 errors
- **Screenshot:** Take one example
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 4: Test 404 Page
- **Action:** Navigate to https://2b690a17.aegis-97g.pages.dev/nonexistent
- **Expected Result:** 404 page loads with message "Page Not Found" or "404". Clear error message, "Return to Dashboard" button, no console errors.
- **Verify:** User can navigate back, page styled/branded correctly
- **Screenshot:** Take 404 page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 5: Empty Form Submission
- **Action:** Navigate to Screen Entity → Click "Screen" without entering any data
- **Expected Result:** Form validation triggers before API call. Error messages: "Entity Type is required", "Name is required". Fields highlighted red. No API POST request.
- **Verify:** Client-side validation works, no empty requests
- **Screenshot:** Take validation errors
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 6: Single Character Name
- **Action:** Enter Name: "X" → Click "Screen"
- **Expected Result:** Either accepted with results shown, or rejected with error "Name must be at least 2 characters". No crash.
- **Verify:** Clear handling either way, valid API response
- **Screenshot:** Take result or error
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 7: 500+ Character Name
- **Action:** Enter 600-character string (repeat "ABCDEFGHIJ" 60 times) → Click "Screen"
- **Expected Result:** Either rejects with "Name must not exceed 255 characters", or accepts and screens successfully. No silent truncation.
- **Verify:** Clear handling, results valid
- **Screenshot:** Take validation or result
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 8: Unicode Arabic Characters
- **Action:** Enter Name: "محمد علي" (Arabic) → Click "Screen"
- **Expected Result:** Arabic text accepted, processed correctly, displayed without corruption. Results show proper characters.
- **Verify:** No mojibake, UTF-8 handled correctly
- **Screenshot:** Take form and results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 9: Unicode Chinese Characters
- **Action:** Enter Name: "王小明" (Chinese) → Click "Screen"
- **Expected Result:** Chinese characters processed correctly, no encoding issues, results display properly.
- **Verify:** CJK handled correctly, no corruption
- **Screenshot:** Take form and results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 10: Unicode Cyrillic Characters
- **Action:** Enter Name: "Иванов Петр" (Russian) → Click "Screen"
- **Expected Result:** Cyrillic text accepted, processed, displayed without corruption.
- **Verify:** Cyrillic renders properly
- **Screenshot:** Take form with Cyrillic
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 11: Special Characters
- **Action:** Enter Name: "John O'Connor-Smith/Jr." or "!@#$%^&*()" → Click "Screen"
- **Expected Result:** Either accepted/searched as-is, sanitized with notice, or rejected with clear message. Consistent handling. No crash or SQL injection.
- **Verify:** Graceful handling, results valid
- **Screenshot:** Take result or validation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 12: All Entity Types
- **Action:** Test all 4 types: Individual "John Smith", Company "Acme Corporation", Vessel "Pacific Dawn", Aircraft "N12345"
- **Expected Result:** All 4 types process successfully. Results show correct entity type. No errors.
- **Verify:** All 4 work, correct labeling
- **Screenshot:** Take one example of each
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 13: Alert Queue - No Results Search
- **Action:** Navigate to Alerts → Search: "ZZZZZZZZZZZZZZ" → Click "Search"
- **Expected Result:** Search completes, message: "No alerts found matching 'ZZZZZZZZZZZZZZ'." Empty state shown. No error.
- **Verify:** Helpful message, can clear search
- **Screenshot:** Take empty alerts
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 14: Alert Queue - Conflicting Filters
- **Action:** Apply filters: Risk Level = HIGH, Status = RESOLVED, Date Range = Future (start date = today + 30 days)
- **Expected Result:** Filters apply without error. Result: empty (no future alerts). Message: "No alerts match applied filters." Filters visible for adjustment.
- **Verify:** No crash, clear message, filters logical
- **Screenshot:** Take filtered empty results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 15: Configuration - Threshold 0.0
- **Action:** Set Confidence Score Minimum to 0.0 → Save Configuration
- **Expected Result:** Threshold 0.0 accepted. Subsequent screenings show all potential matches (even very low confidence). Warning may appear about permissiveness.
- **Verify:** Value saves, screening behavior changes
- **Screenshot:** Take configuration and results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 16: Configuration - Threshold 1.0
- **Action:** Set Confidence Score Minimum to 1.0 → Save Configuration
- **Expected Result:** Threshold 1.0 accepted. Subsequent screenings show only perfect matches. Warning about strictness may appear.
- **Verify:** Value saves, results very sparse
- **Screenshot:** Take configuration and results
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 17: Billing - Add 100 Seats
- **Action:** Navigate to Billing → Seat Management → Add 100 seats
- **Expected Result:** Either accepts all 100, shows warning with confirmation, or rejects with limit explanation. Any is acceptable IF clear and non-crashing.
- **Verify:** No crash, clear feedback
- **Screenshot:** Take result
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 18: Double-Click All Buttons
- **Action:** Go through application and double-click major buttons (100ms between clicks)
- **Expected Result:** Buttons debounced/throttled. Second click ignored. No duplicate actions. Single API call per action.
- **Verify:** No duplicates, debouncing works
- **Screenshot:** Take console showing single API call
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 19: Form Re-submission After Reload
- **Action:** Fill screening form → Click "Screen" → Reload page immediately (Ctrl+R) while API call in flight
- **Expected Result:** Page reloads clean. Previous screening state lost (or cached). No orphaned API calls. No phantom results appear.
- **Verify:** Form clean after reload, no previous results shown
- **Screenshot:** Take reloaded page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 20: Concurrent Screenings
- **Action:** Fill form 1 → Click "Screen" → Immediately fill form 2 → Click "Screen" → Wait for both
- **Expected Result:** Both screenings complete independently. No interference. Correct results for each. No data mixing.
- **Verify:** Each tracked separately, no mixing
- **Screenshot:** Take both results pages
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 21: Browser Console Audit - Full Site
- **Action:** Open DevTools (F12) → Console tab → Navigate through ALL pages (10 pages) → Note any red error messages
- **Expected Result:** Zero JavaScript errors across all pages. Only informational logs/warnings acceptable. No "TypeError", "ReferenceError", "Cannot read property".
- **Verify:** Console clean, no red X errors
- **Screenshot:** Take console showing clean state
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 22: Memory Leak Check - 50 Navigation Iterations
- **Action:** Open DevTools Memory tab → Take heap snapshot (baseline) → Script navigation loop 50 times → Take second heap snapshot → Compare
- **Expected Result:** Memory returns to near-baseline. No progressive growth indicating leak. Detached DOM elements cleaned up.
- **Verify:** Memory released, no detached DOM trees
- **Screenshot:** Take memory snapshots
- **Checkbox:** ☐ PASS / ☐ FAIL

## Test Summary

**Total Steps:** 22

**Critical Pass Criteria:**
- ☐ No JavaScript errors on any page
- ☐ Empty form validation works
- ☐ Unicode (Arabic, Chinese, Cyrillic) handled without corruption
- ☐ All 4 entity types work
- ☐ Navigation (back/forward/direct URL) seamless
- ☐ Thresholds 0.0 and 1.0 accepted without crashes
- ☐ Button debouncing prevents duplicates
- ☐ No memory leaks in 50-iteration loop

**Important Pass Criteria:**
- ☐ 500+ character name handled gracefully
- ☐ Special characters processed safely
- ☐ Empty search shows helpful message
- ☐ Conflicting filters don't crash
- ☐ Form reload doesn't resurrect previous results
- ☐ Concurrent screenings don't interfere

**Performance Thresholds:**
- Page load: < 3 seconds
- API response: < 5 seconds
- Navigation: < 1 second
- Form validation: < 500ms

**Notes:**
- Test designed to break the application and find bugs
- Every step that doesn't result in clear pass is potential bug
- Edge cases are critical
- Performance and memory stability essential
