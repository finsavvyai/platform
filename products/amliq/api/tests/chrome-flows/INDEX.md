# AMLIQ AML Screening Platform - Chrome Browser Extension Test Flows

**Test Suite:** Comprehensive user persona-based test flows
**Platform:** AMLIQ v2.0.1
**Deployment:** https://2b690a17.aegis-97g.pages.dev
**API:** http://localhost:3001/api/v1
**Created:** March 26, 2026

---

## Test Flow Index (10 Total Files)

### Existing Test Files (P01-P05)

| File | Persona | Role | Focus Area | Steps |
|------|---------|------|-----------|-------|
| P01_compliance_officer_sarah.md | Sarah Mitchell | Compliance Officer | Screening workflows, regulatory reporting | TBD |
| P02_dev_integration_alex.md | Alex Rodriguez | Developer/Integration | API integration, SDK implementation | TBD |
| P03_analyst_maria.md | Maria Chen | AML Analyst | Alert queue, resolution workflows | TBD |
| P04_cto_david.md | David Thompson | CTO/Technical Lead | System architecture, performance, security | TBD |
| P05_product_manager_lisa.md | Lisa Anderson | Product Manager | Feature validation, UX/UI testing | TBD |

### New Test Files (P06-P10) ✨

| File | Persona | Role | Focus Area | Steps |
|------|---------|------|-----------|-------|
| **P06_billing_admin_rachel.md** | Rachel Foster | Finance/Billing Administrator | Billing management, seat licensing, cost optimization | **22** |
| **P07_israeli_regulator_yael.md** | Yael Goldstein | Compliance Regulator | Regulatory compliance, Israeli MoD screening, audit trails | **20** |
| **P08_qa_engineer_james.md** | James Wilson | QA Engineer | Edge cases, error handling, robustness testing | **22** |
| **P09_enterprise_admin_michael.md** | Michael Chang | Enterprise IT Administrator | Enterprise deployment, multi-tenancy, API security | **24** |
| **P10_new_user_onboarding_emma.md** | Emma Davis | Compliance Officer (First Time User) | Onboarding experience, accessibility, intuitive UI | **30** |

---

## Test Flow Details

### P06: Billing Administrator - Rachel Foster
**Filename:** `P06_billing_admin_rachel.md`
**Lines:** 199 | **Size:** 12K | **Steps:** 22

**Persona Summary:**
- Role: Finance/Billing Administrator at ComplyTech Solutions
- Experience: 2 years with AMLIQ
- Skill Level: Intermediate
- Key Goals: Manage billing, control costs, optimize seat licensing

**Test Coverage:**
- ✓ Login and dashboard navigation
- ✓ Billing page overview (current plan, subscriptions, usage meters)
- ✓ All 5 product subscriptions (Dashboard, API, SDK, iFrame, Datasets)
- ✓ 5 usage meters with real-time tracking
- ✓ Promo code validation (invalid + valid codes)
- ✓ Add product subscription (SDK Professional)
- ✓ Upgrade plan with prorated charge calculation
- ✓ Invoice list and PDF download
- ✓ Dashboard seat management (add/remove users)
- ✓ Usage history charts (30-day trends)
- ✓ Payment alerts (past due status)
- ✓ Customer portal integration
- ✓ Subscription cancellation and reactivation

**Pass Criteria:**
- Billing calculations accurate (prorating, totals, overage costs)
- Promo code validation works (invalid rejected, valid applied)
- Seat management updates reflected in real-time
- All invoices downloadable as valid PDFs
- Payment alerts display when appropriate
- Cancellation/reactivation workflow completes successfully

---

### P07: Israeli Compliance Regulator - Yael Goldstein
**Filename:** `P07_israeli_regulator_yael.md`
**Lines:** 194 | **Size:** 12K | **Steps:** 20

**Persona Summary:**
- Role: Compliance Regulator at Israeli Ministry of Defense (MoD)
- Experience: 5+ years AML/CFT compliance
- Skill Level: Advanced
- Key Goals: Verify regulatory compliance, validate high-confidence screening, ensure audit integrity

**Test Coverage:**
- ✓ Login as regulatory analyst
- ✓ Configuration page and preset management
- ✓ Israeli Regulation preset selection (strictest thresholds: 0.95+)
- ✓ Individual screening (Ahmed Hassan Ibrahim vs. Israeli MoD list)
- ✓ Company screening (Levant Maritime Services Ltd vs. Israeli MoD list)
- ✓ High-confidence match results (confidence > 0.95)
- ✓ All 6 screening layers (Exact, Fuzzy, Phonetic, Token Set, Embedding, Graph)
- ✓ Evidence details and match confidence contributions
- ✓ Sanctions lists management (Israeli MoD list details)
- ✓ Manual sync triggers on multiple lists
- ✓ Audit trail review with full action history
- ✓ Hash chain integrity verification (SHA-256)
- ✓ Compliance report export (PDF with certifications)

**Pass Criteria:**
- Israeli preset applies strictest thresholds (0.95+)
- Both screenings trigger HIGH RISK flags
- All 6 screening layers operational with evidence
- Israeli MoD list synced within 24 hours
- Audit trail immutable with valid cryptographic hash chain
- Compliance report includes all regulatory fields and certifications

---

### P08: QA Engineer - James Wilson
**Filename:** `P08_qa_engineer_james.md`
**Lines:** 208 | **Size:** 11K | **Steps:** 22

**Persona Summary:**
- Role: QA Engineer / Test Automation Specialist at AMLIQ development
- Experience: 7+ years QA/testing, 3+ years AML systems
- Skill Level: Very High (reads console errors, analyzes API responses)
- Key Goals: Break the application, find bugs, test extreme edge cases

**Test Coverage:**
- ✓ Rapid sidebar navigation stress test (200ms between clicks)
- ✓ Back/forward button navigation (4 back, 4 forward, 3 iterations)
- ✓ Direct URL navigation to all 10 routes
- ✓ 404 page handling (nonexistent routes)
- ✓ Empty form validation (no data submission)
- ✓ Boundary testing: Single character ("X") and 500+ character names
- ✓ Unicode character handling: Arabic (محمد علي), Chinese (王小明), Cyrillic (Иванов Петр)
- ✓ Special character handling (!@#$%^&*), apostrophes, hyphens
- ✓ All 4 entity types (Individual, Company, Vessel, Aircraft)
- ✓ Alert queue edge cases (no results, conflicting filters)
- ✓ Configuration extreme thresholds (0.0 and 1.0)
- ✓ Billing stress test (add 100 seats)
- ✓ Button debouncing (double-click test)
- ✓ Form re-submission after page reload
- ✓ Concurrent operations (simultaneous screenings)
- ✓ Full site JavaScript console audit (zero errors)
- ✓ Memory leak detection (50-iteration navigation loop)

**Pass Criteria:**
- Zero JavaScript errors on any page
- Empty form validation works correctly
- Unicode (Arabic, Chinese, Cyrillic) handled without corruption
- All 4 entity types process successfully
- Navigation (back/forward/direct URL) seamless
- Extreme threshold values (0.0, 1.0) accepted without crashes
- Button debouncing prevents duplicate operations
- No memory leaks detected in stress test

---

### P09: Enterprise IT Administrator - Michael Chang
**Filename:** `P09_enterprise_admin_michael.md`
**Lines:** 230 | **Size:** 14K | **Steps:** 24

**Persona Summary:**
- Role: Enterprise IT Administrator at GlobalBank International
- Experience: 10+ years IT ops, 4+ years SaaS admin
- Skill Level: Very High (APIs, webhooks, infrastructure monitoring)
- Key Goals: Deploy enterprise-wide, secure API access, monitor infrastructure

**Test Coverage:**
- ✓ Enterprise admin login and dashboard metrics review
- ✓ Sanctions lists management (all 9 integrated sources)
- ✓ OFAC, EU, UN, UK OFSI, SECO, Israeli MoD, SDFM, OpenSanctions, Custom lists
- ✓ Entry count and sync date verification
- ✓ Manual sync triggers (OFAC, EU lists)
- ✓ Custom sanctions list import (CSV upload)
- ✓ Multi-tenant configuration (3 tenants: US, EU, APAC)
- ✓ Tenant data isolation verification
- ✓ API key generation (aegis_api_sk_ prefix, 64 random chars)
- ✓ API key rotation (deactivation with 48-hour grace period)
- ✓ API key revocation
- ✓ Webhook configuration with HMAC-SHA256 security
- ✓ LemonSqueezy billing webhook setup
- ✓ HMAC signature validation
- ✓ Health endpoint verification (API, database, cache status)
- ✓ Batch job queue management
- ✓ Batch screening job creation (1,000 entities)
- ✓ Batch progress monitoring (real-time percentage)
- ✓ Infrastructure metrics dashboard (CPU, memory, disk, network)
- ✓ Rate limiting configuration (Standard: 100 req/min, Enterprise: 1,000 req/min)
- ✓ Audit trail export (JSON, 30-day range)

**Pass Criteria:**
- All 9 sanctions lists synced within 48 hours
- API key generation/rotation/revocation functional
- Multi-tenancy with proper data isolation
- Webhook security with valid HMAC-SHA256 signatures
- Batch processing handles 1,000+ records
- Infrastructure metrics within healthy thresholds
- Audit trail immutable and exportable

---

### P10: First-Time User Onboarding - Emma Davis
**Filename:** `P10_new_user_onboarding_emma.md`
**Lines:** 279 | **Size:** 17K | **Steps:** 30

**Persona Summary:**
- Role: Compliance Officer (First Time User)
- Company: RetailBank Corp
- Experience: Beginner (0 AML knowledge, new to compliance systems)
- Skill Level: Moderate (comfortable with web apps)
- Key Goals: Learn platform, understand screening results, build confidence

**Test Coverage:**
- ✓ Marketing landing page review (hero section, features, demo video, FAQ)
- ✓ Signup workflow with promo code ("AMLIQ_FREE" for 100% discount)
- ✓ First login and onboarding checklist
- ✓ Dashboard exploration (labels, tooltips, metrics)
- ✓ First screening workflow (Individual: John Smith, US)
- ✓ Confidence score explanation and interpretation
- ✓ Alert queue navigation and alert opening
- ✓ Alert resolution workflow
- ✓ Configuration page and preset descriptions
- ✓ Balanced preset selection (recommended for beginners)
- ✓ Company screening (Acme Corporation, US)
- ✓ Analytics page and chart interpretation
- ✓ Billing page (Free Trial status, $0.00 cost)
- ✓ Complete sidebar navigation
- ✓ Help and documentation access
- ✓ Accessibility testing: font scaling (Ctrl+Plus)
- ✓ Keyboard-only navigation (Tab/Enter/Space)
- ✓ Mobile responsive view (375px width)
- ✓ Return to desktop view

**Pass Criteria:**
- Signup and first login successful
- Dashboard intuitive with clear labels
- First screening completes with understandable results
- Confidence score well explained for beginners
- All navigation functional
- Preset selection applies correctly
- Accessibility features work (font scaling, keyboard nav, mobile responsive)
- User feels confident and supported

---

## Test Execution Strategy

### Recommended Order of Execution

1. **P10 First** - Onboarding test (ensures fresh user can get started)
2. **P06** - Billing administrator workflows
3. **P07** - Regulatory compliance and audit trails
4. **P08** - QA edge cases and stress tests (may disrupt other sessions)
5. **P09** - Enterprise admin workflows

### Parallel Execution Option

- P06, P07, P09 can run in parallel (independent workflows)
- P10 should run on fresh instance first
- P08 (stress testing) best run last or on isolated environment

### Test Environment Requirements

- **Deployment:** AMLIQ at https://2b690a17.aegis-97g.pages.dev (production-like instance)
- **API:** Available at http://localhost:3001/api/v1
- **Sanctions Lists:** All 9 lists synced (within 48 hours, except Custom)
- **Browser:** Chrome with DevTools enabled (F12 access)
- **Network:** Stable connection with <100ms latency
- **Test Data:** Pre-loaded with sample screening entities

---

## Test Metrics & Reporting

### Key Metrics Tracked

- **Step Pass Rate:** % of steps marked PASS
- **Total Test Duration:** Time to complete all steps
- **Errors Found:** Count and severity
- **Performance:** Page load times, API response times
- **Accessibility:** WCAG compliance, keyboard navigation, screen reader support

### Report Format

For each test flow:
1. Overall PASS/FAIL status
2. Step-by-step results (22-30 checkboxes)
3. Critical failures (if any)
4. Performance metrics (load times, response times)
5. Screenshots (one per step recommended)
6. Notes on bugs or issues found
7. Recommendations for improvement

---

## Pass/Fail Criteria

### Critical Pass Criteria (Must Pass)
- All blocking issues resolved
- Core functionality operational
- No JavaScript errors on critical pages
- Security validations working (promo codes, auth, etc.)

### Important Pass Criteria (Should Pass)
- User experience smooth and intuitive
- Calculations accurate (billing, prorating, percentages)
- Real-time updates working
- Audit trails immutable and verifiable

### Nice-to-Have Pass Criteria (Optional)
- Performance within thresholds
- Accessibility features fully functional
- Mobile responsiveness working perfectly
- Help documentation comprehensive

---

## Integration with CI/CD Pipeline

These test flows can be:
- **Manually executed** by QA team (using checklist format)
- **Automated** using Selenium/Cypress (with step instructions as reference)
- **Integrated** into CI/CD pipeline for each release
- **Scheduled** as recurring regression tests (weekly/monthly)

---

## Support & Maintenance

- **Questions:** Refer to each test flow's "Prerequisites" and "Test Summary" sections
- **Issues:** Document with step #, action, expected vs. actual result, screenshots
- **Updates:** Add new test flows or steps as features are added
- **Archiving:** Keep completed test results for 12+ months for compliance

---

**Test Suite Version:** 1.0
**Last Updated:** March 26, 2026
**Status:** Ready for Execution
**Files:** 10 total (5 existing + 5 new)
**Total Steps:** 118+ comprehensive test steps
**Estimated Duration:** 15-20 hours (full suite execution)
