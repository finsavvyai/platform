# AMLIQ Chrome Extension Test Flows - New Files Created

**Date Created:** March 26, 2026
**Location:** `/sessions/loving-cool-einstein/mnt/outputs/aegis-v2/tests/chrome-flows/`
**Platform:** AMLIQ AML Screening Platform
**API Endpoint:** http://localhost:3001/api/v1
**Deployment URL:** https://2b690a17.aegis-97g.pages.dev

## New Test Files Created (5 files)

### 1. P06: Billing Administrator - Rachel Foster
**File:** `P06_billing_admin_rachel.md`
- **Persona:** Finance/Billing Administrator at ComplyTech Solutions
- **Experience Level:** Intermediate (2 years with AMLIQ)
- **Focus Area:** Billing management, seat licensing, cost optimization, usage tracking
- **Test Steps:** 22 comprehensive steps
- **Key Tests:**
  - Login and navigate to Billing page
  - Review current plan details (Professional tier, $299/month)
  - Check all 5 product subscriptions (Dashboard, API, SDK, iFrame, Datasets)
  - Verify 5 usage meters (API Screenings, Seats, SDK Calls, iFrame Lookups, Dataset Fetches)
  - Test invalid promo code validation ("FAKE123" → error)
  - Apply valid 100% discount promo code ("AMLIQ_FREE")
  - Add new product subscription (SDK Professional, $149/month)
  - Upgrade API plan (Professional → Enterprise, calculate prorated charges)
  - Review invoice list and download PDF invoices
  - Manage dashboard seats (add/remove users, track count)
  - Review 30-day usage history charts
  - Test payment alerts for past-due status
  - Navigate to customer billing portal
  - Cancel and reactivate subscription with confirmation workflow
- **Pass Criteria:** All billing calculations accurate, seat management updates real-time, invoices downloadable as valid PDFs, promo codes work correctly

### 2. P07: Israeli Compliance Regulator - Yael Goldstein
**File:** `P07_israeli_regulator_yael.md`
- **Persona:** Compliance Regulator at Israeli Ministry of Defense (MoD)
- **Experience Level:** Advanced (5+ years AML/CFT compliance)
- **Focus Area:** Regulatory compliance verification, Israeli AML standard validation, high-confidence entity screening
- **Test Steps:** 20 comprehensive steps
- **Key Tests:**
  - Login with regulatory analyst account
  - Navigate to Configuration page
  - Select and verify Israeli Regulation preset (strictest thresholds: 0.95+ confidence)
  - Screen individual entity (Ahmed Hassan Ibrahim, DOB 1968-07-22, Jordanian) against Israeli MoD list
  - Screen company entity (Levant Maritime Services Ltd, Lebanon registry)
  - Review screening results with HIGH RISK flags (confidence > 0.95)
  - Examine all 6 screening layers: Exact, Fuzzy, Phonetic, Token Set, Embedding, Graph
  - Review evidence details and confidence contributions for each layer
  - Navigate to Sanctions Lists page
  - Find Israeli MoD list (847 entries, last sync within 24 hours)
  - Trigger manual sync on Israeli MoD and EU lists
  - Review audit trail for all actions (immutable, timestamped)
  - Export compliance report (PDF format)
  - Verify audit hash chain integrity with SHA-256 cryptographic validation
  - Confirm all regulatory fields present in exported report
- **Pass Criteria:** Israeli preset applies strictest thresholds, both high-confidence screenings flagged correctly, all 6 layers operational, audit trail immutable with valid hash chain, compliance report exports with certifications

### 3. P08: QA Engineer - James Wilson
**File:** `P08_qa_engineer_james.md`
- **Persona:** QA Engineer / Test Automation Specialist at AMLIQ development team
- **Experience Level:** Advanced (7+ years QA/testing, 3+ years AML systems)
- **Focus Area:** Edge case testing, boundary conditions, error handling, robustness, security
- **Test Steps:** 22 edge case and stress tests
- **Key Tests:**
  - Rapid sidebar navigation (200ms between clicks, all 10 pages)
  - Back/forward button navigation stress test (4 times back, 4 times forward, 3 iterations)
  - Direct URL navigation to all 10 routes
  - Test 404 page for nonexistent routes
  - Empty form submission validation (no data → error messages)
  - Single character name screening ("X")
  - 500+ character name screening (boundary test)
  - Unicode character handling: Arabic (محمد علي), Chinese (王小明), Cyrillic (Иванов Петр)
  - Special character handling (!@#$%^&*), apostrophes, hyphens
  - All 4 entity types (Individual, Company, Vessel, Aircraft)
  - Alert queue search with no results
  - Conflicting filter criteria on alerts
  - Confidence threshold extreme values: 0.0 (most permissive) and 1.0 (strictest)
  - Billing edge case: Add 100 seats
  - Button double-click debouncing test (prevent duplicates)
  - Form re-submission after page reload
  - Concurrent operations (two simultaneous screenings)
  - Full site JavaScript console audit (all 10 pages)
  - Memory leak detection (50-iteration navigation loop with heap snapshots)
- **Pass Criteria:** Zero JavaScript errors, proper validation/error handling, Unicode handled without corruption, buttons debounced, no memory leaks, extreme threshold values accepted

### 4. P09: Enterprise IT Administrator - Michael Chang
**File:** `P09_enterprise_admin_michael.md`
- **Persona:** Enterprise IT Administrator at GlobalBank International
- **Experience Level:** Advanced (10+ years IT ops, 4+ years SaaS admin)
- **Focus Area:** Enterprise deployment, multi-tenancy, API security, infrastructure monitoring, webhook configuration
- **Test Steps:** 24 enterprise administration tests
- **Key Tests:**
  - Login as enterprise admin with full system access
  - Review dashboard system health metrics (API response time, DB connections, cache hit rate, last sync)
  - Navigate to Sanctions Lists management
  - Verify all 9 integrated sanctions lists: OFAC, EU, UN, UK OFSI, SECO, Israeli MoD, SDFM, OpenSanctions, Custom
  - Check entry counts and sync dates for each list
  - Trigger manual syncs on OFAC and EU lists (verify new/removed entry counts)
  - Import custom sanctions list (CSV upload with 10 test entries)
  - Configure multi-tenant setup (3 tenants: GlobalBank-US, GlobalBank-EU, GlobalBank-APAC)
  - Test tenant data isolation (screenings in Tenant 1 not visible in Tenant 2)
  - Generate new API key with "aegis_api_sk_" prefix and 64-character random string
  - Rotate API key (old key deactivated with 48-hour grace period)
  - Revoke API key immediately
  - Configure webhooks with HMAC-SHA256 security
  - Set up LemonSqueezy billing webhook endpoint
  - Verify HMAC-SHA256 signature validation on webhooks
  - Check /api/v1/health endpoint (status: healthy, all subsystems ok)
  - Review batch job queue and monitor processing
  - Create new batch screening job (1,000 entities, "High Throughput" mode)
  - Monitor batch job progress (real-time percentage updates)
  - Check infrastructure metrics (API requests/sec, DB connections, memory, disk, network I/O)
  - Review rate limiting configuration (Standard: 100 req/min, Enterprise: 1,000 req/min)
  - Export full audit trail (JSON format, 30-day range)
- **Pass Criteria:** All 9 sanctions lists synced within 48 hours, API key generation/rotation/revocation functional, multi-tenancy with proper isolation, webhooks with valid HMAC signatures, batch processing handles 1,000+ records, infrastructure metrics within healthy thresholds, audit trail exportable

### 5. P10: First-Time User Onboarding - Emma Davis
**File:** `P10_new_user_onboarding_emma.md`
- **Persona:** Compliance Officer, first-time user with zero AML experience
- **Company:** RetailBank Corp
- **Experience Level:** Beginner (0 AML knowledge, new to compliance systems)
- **Focus Area:** User onboarding experience, intuitive UI, clear documentation, accessibility
- **Test Steps:** 30 comprehensive onboarding steps
- **Key Tests:**
  - Land on marketing page and review hero section
  - Read features section (6 key features with icons)
  - Watch screening demo video (2-minute tutorial)
  - Read FAQ section (4-5 beginner questions answered)
  - Click "Start Free Trial" and navigate to signup form
  - Apply "AMLIQ_FREE" promo code for 100% discount
  - Complete signup with test data (Emma Davis, RetailBank Corp)
  - First login and view onboarding checklist (5 items)
  - Explore dashboard labels and tooltips (all metrics explained)
  - Perform first screening with simple name (John Smith, US)
  - Understand confidence score (0.12 = low match, what it means)
  - Navigate to Alert Queue (empty state message helpful)
  - Open and review sample alert with evidence explanation
  - Resolve alert by selecting reason (False Positive/Approved/etc.)
  - Navigate to Configuration and read preset descriptions
  - Select Balanced preset (recommended for most organizations)
  - Perform company screening (Acme Corporation, United States)
  - Navigate to Analytics and understand charts
  - Review billing page (Free Trial, $0.00/month with promo code)
  - Explore all sidebar menu items
  - Test Help/Documentation section
  - Test accessibility: font scaling (Ctrl+Plus)
  - Test keyboard-only navigation (Tab/Enter/Space keys)
  - Test mobile responsive view (375px width)
  - Return to desktop view verification
- **Pass Criteria:** Signup and first login successful, dashboard intuitive with clear labels, first screening completes with understandable results, confidence score well explained, all navigation functional, preset selection applies, accessibility features work (font scaling, keyboard nav, mobile responsive)

---

## File Statistics

| File | Lines | Size | Steps | Key Persona Focus |
|------|-------|------|-------|-------------------|
| P06_billing_admin_rachel.md | 199 | 12K | 22 | Billing management, seat licensing, cost optimization |
| P07_israeli_regulator_yael.md | 194 | 12K | 20 | Regulatory compliance, high-confidence screening, audit trails |
| P08_qa_engineer_james.md | 208 | 11K | 22 | Edge cases, boundary conditions, error handling, security |
| P09_enterprise_admin_michael.md | 230 | 14K | 24 | Enterprise deployment, multi-tenancy, API security, infrastructure |
| P10_new_user_onboarding_emma.md | 279 | 17K | 30 | Onboarding experience, intuitive UI, accessibility, documentation |
| **TOTAL** | **1,110** | **66K** | **118** | **5 distinct personas** |

---

## Format & Structure

Each test flow markdown file follows this consistent format:

1. **Title with Persona Name and Role**
   - Clear identification of who is being tested

2. **Persona Profile**
   - Name, role, company, experience level
   - Key goals and technical proficiency
   - Regulatory or functional focus areas

3. **Prerequisites**
   - AMLIQ deployment URL and API endpoint
   - Required accounts, credentials, test data
   - Browser and environment requirements

4. **Test Flow with Step-by-Step Instructions**
   - Each step formatted as:
     - **Action:** Exact user actions to perform
     - **Expected Result:** What should happen
     - **Verify:** Confirmation checks
     - **Screenshot:** What to capture
     - **Checkbox:** ☐ PASS / ☐ FAIL

5. **Test Summary**
   - Total steps count
   - Pass criteria (critical, important, nice-to-have)
   - Checklist items
   - Notes and special considerations

---

## Test Data Used

### Personas & Accounts
- **P06:** Rachel Foster (rachel.foster@complytech.com, BillingAdmin#2024)
- **P07:** Yael Goldstein (yael.goldstein@imod-compliance.gov.il, MoDCompliance#2026)
- **P08:** James Wilson (QA test account with full permissions)
- **P09:** Michael Chang (michael.chang@globalbank.com, EntAdmin#Secure2026)
- **P10:** Emma Davis (emma.davis@retailbank.com, SecurePass#2026, new signup)

### Screening Entities
- **Individual:** Ahmed Hassan Ibrahim, DOB: 1968-07-22, Jordanian passport JOR-44829173
- **Company:** Levant Maritime Services Ltd, Lebanon registry LBN-99281
- **Generic:** John Smith (US), Acme Corporation (US), Pacific Dawn (vessel), N12345 (aircraft)
- **Unicode:** محمد علي (Arabic), 王小明 (Chinese), Иванов Петр (Russian/Cyrillic)

### Configuration Values
- **Israeli Regulation Preset:** Thresholds 0.95, 0.90, 0.88, 0.92, 0.91, 0.94
- **Balanced Preset:** Threshold 0.72 (default for new users)
- **Confidence Range:** 0.0 (permissive) to 1.0 (strictest)

### API & Infrastructure
- **Sanctions Lists:** 9 integrated sources (OFAC, EU, UN, UK OFSI, SECO, Israeli MoD, SDFM, OpenSanctions, Custom)
- **Rate Limits:** Standard 100 req/min, Enterprise 1,000 req/min
- **Batch Processing:** 1,000+ entity screening capability
- **Health Thresholds:** API < 200ms, Cache > 90%, DB < 80% utilization

---

## Test Execution Guidelines

1. **Environment Setup**
   - Deploy AMLIQ at https://2b690a17.aegis-97g.pages.dev
   - Verify API at http://localhost:3001/api/v1
   - Ensure sanctions lists are synced (all within 48 hours except Custom)
   - Prepare Chrome browser with DevTools available

2. **Test Execution Order**
   - Can be run in any order (independent test flows)
   - P10 (Emma Davis onboarding) should run before P06-P09 if testing fresh instance
   - P07 (Israeli Regulator) requires specific sanctions list synced
   - P08 (QA Engineer) contains stress tests, run last to avoid affecting other users

3. **Documentation**
   - Take screenshots for each step as noted
   - Document any errors with: step #, action, actual result, console errors
   - Note performance metrics (load times, response times)
   - Verify all checkboxes (mark PASS or FAIL for each step)

4. **Pass/Fail Criteria**
   - All critical pass criteria must be met for overall PASS
   - Important criteria should be met for robust testing
   - Nice-to-have criteria are optional but improve user experience
   - Any console JavaScript errors are failures

---

## Integration with Existing Tests

These 5 new test flows (P06-P10) complement existing test files:
- P01: Compliance Officer (Sarah) - screening workflows
- P02: Developer/Integration (Alex) - API and SDK integration
- P03: AML Analyst (Maria) - alert queue and resolution
- P04: CTO (David) - system architecture and performance
- P05: Product Manager (Lisa) - feature validation and UX

Together, all 10 test flows provide comprehensive coverage of:
- User roles (billing, regulatory, QA, admin, beginner)
- Functional areas (screening, billing, configuration, audit, analytics)
- Technical aspects (API integration, performance, security, accessibility)
- Compliance requirements (Israeli MoD, FATF AML standards, audit trails)

---

**Created:** March 26, 2026
**Test Environment:** AMLIQ v2.0.1
**Status:** Ready for execution
