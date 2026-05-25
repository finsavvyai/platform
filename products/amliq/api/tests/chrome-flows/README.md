# AMLIQ AML Platform - Chrome Browser Extension Test Flows

## Overview
Comprehensive test flow documentation for the AMLIQ AML screening platform. Five detailed persona-based test scenarios covering compliance, development, analytics, security, and UX evaluation.

## Test Files

### P01_compliance_officer_sarah.md
**Persona:** Sarah Chen, Chief Compliance Officer (Midwest Regional Bank)
- **Steps:** 14 comprehensive test steps
- **Focus:** Full marketing page review → Sign up → Dashboard overview → First screening (Individual: Mohammad Al-Rahman, Syrian passport SYR-8847721) → Results analysis → Confidence scores → Alert Queue → Critical priority filtering → Alert detail → Investigation notes → True positive resolution → Audit trail verification → Analytics review → Report export
- **Duration:** 45-60 minutes
- **Key Validations:** Accuracy verification, compliance features, audit trail integrity, reporting capability
- **Test Data:** Mohammad Al-Rahman, DOB 1975-03-15, Syrian passport SYR-8847721

### P02_dev_integration_alex.md
**Persona:** Alex Rodriguez, Senior Backend Developer (PayFlow Fintech)
- **Steps:** 15 comprehensive test steps
- **Focus:** API documentation review → Pricing/API tab → API tier limits → Sign up for API Starter → API key generation → Direct curl POST /api/v1/screen testing → Batch screening → Rate limiting tests → 429 response verification → Invalid API key testing → Malformed JSON body validation → Webhook setup → Health endpoint testing → SDK documentation → iFrame widget embed code
- **Duration:** 60-75 minutes
- **Key Validations:** API reliability, rate limiting, authentication, webhook functionality, SDK completeness
- **Test Data:** Multiple entities including Alexei Petrov (RUS-55219938), Golden Dragon Trading Co., batch entities

### P03_analyst_maria.md
**Persona:** Maria Santos, AML Analyst
- **Steps:** 20 comprehensive test steps
- **Focus:** Login → Dashboard stats → Individual screening (Alexei Petrov, RUS-55219938) → Company screening (Golden Dragon Trading Co., BRG-2847) → Alert Queue → Date range filtering → Sort by confidence score → Bulk select 5 alerts → Bulk resolve as false positive → Open critical alert → Entity comparison → Evidence chips/scoring breakdown → Investigation notes → Supervisor escalation → Audit trail review → Configuration page → Fuzzy threshold adjustment (0.7 to 0.85) → Impact preview → Save configuration → Re-screen with new threshold
- **Duration:** 75-90 minutes
- **Key Validations:** Daily workflow efficiency, filtering/sorting, bulk operations, configuration impact, audit trail completeness
- **Test Data:** Alexei Petrov (RUS-55219938), Golden Dragon Trading Co. (BRG-2847, China)

### P04_cto_david.md
**Persona:** David Kim, CTO Security Evaluator (TechSecure Enterprise)
- **Steps:** 16 comprehensive security test steps
- **Focus:** Security badges verification (SOC 2, ISO 27001, PCI DSS) → Pricing security features → API security documentation → CORS header testing → CSP header verification → XSS injection attempts (<script>alert('xss')</script>) → SQL injection testing ('; DROP TABLE--) → HTTPS enforcement → Rate limiting security testing → Audit trail tamper-evidence → Hash chain integrity → API key rotation → Webhook signature verification → Infrastructure monitoring → API response time SLA verification → Error response sanitization
- **Duration:** 60-75 minutes
- **Key Validations:** Security certifications, attack prevention (XSS/SQL injection), HTTPS enforcement, audit immutability, error handling, performance SLA
- **Security Testing:** XSS/SQL injection payload testing, CORS/CSP header validation, rate limit enforcement

### P05_product_manager_lisa.md
**Persona:** Lisa Thompson, Product Manager - UX Evaluator (TechPro Analytics)
- **Steps:** 25 comprehensive UX test steps
- **Focus:** Full marketing page scroll review (hero, features, how it works, pricing, testimonials, FAQ, footer) → Mobile responsive 375px → Tablet responsive 768px → Desktop responsive 1440px → Mobile navigation testing → Pricing page all 5 product tabs → Monthly/annual toggle → 20% discount calculation verification → Sign up flow → Dashboard UX evaluation → All sidebar navigation items → Screening form UX → Alert Queue filtering UX → Configuration sliders → Billing page layout → Seat management → Invoice list display → Analytics charts interaction → Audit trail pagination → Keyboard navigation (Tab through all elements) → Empty states → Loading states → Apple HIG compliance (SF Pro font, vibrancy, segmented controls) → Final responsive breakpoint testing (320px to 1920px)
- **Duration:** 90-120 minutes
- **Key Validations:** Responsive design, navigation functionality, form usability, accessibility (keyboard), empty/loading states, Apple design compliance
- **Responsive Breakpoints:** 375px (mobile), 480px, 768px (tablet), 1024px, 1440px (desktop), 1920px (large desktop)

## Test Environment

### Prerequisites
- Chrome browser with Developer Tools
- Site: https://2b690a17.aegis-97g.pages.dev
- API: http://localhost:3001/api/v1
- Terminal/command line access (for API and security testing)
- Ability to resize browser window

### Test Data Required
- Individual: Mohammad Al-Rahman, DOB 1975-03-15, Syrian passport SYR-8847721
- Individual: Alexei Petrov, Russian passport RUS-55219938
- Company: Golden Dragon Trading Co., Business Registry BRG-2847, China
- Test email domains: @midwestbank.com, @compliance.co, @payflow.io, @techpro.io

## Test Execution Standards

### Each Step Includes
- **Action:** What the tester should do
- **Verify:** Expected result or behavior
- **Screenshot:** Visual capture points for documentation
- **Selector:** Exact element locators (CSS/XPath hints)
- **Pass/Fail Checkbox:** ☐ PASS / ☐ FAIL tracking

### Reporting
- All steps include checkbox tracking (☐)
- Screenshot requirements clearly marked
- Expected results explicitly stated
- Pass/Fail decision points at each step
- Summary section for overall test result

## Execution Timeline

| Persona | Duration | Total Steps |
|---------|----------|------------|
| Sarah Chen (P01) | 45-60 min | 14 |
| Alex Rodriguez (P02) | 60-75 min | 15 |
| Maria Santos (P03) | 75-90 min | 20 |
| David Kim (P04) | 60-75 min | 16 |
| Lisa Thompson (P05) | 90-120 min | 25 |
| **TOTAL** | **330-420 min (5.5-7 hours)** | **90 steps** |

## Test Coverage Matrix

| Feature | P01 | P02 | P03 | P04 | P05 |
|---------|-----|-----|-----|-----|-----|
| Marketing/Landing Page | ✓ | - | - | ✓ | ✓ |
| User Registration | ✓ | ✓ | ✓ | - | ✓ |
| Dashboard | ✓ | - | ✓ | - | ✓ |
| Screening (Individual) | ✓ | ✓ | ✓ | - | - |
| Screening (Company) | - | ✓ | ✓ | - | - |
| Alert Management | ✓ | - | ✓ | - | ✓ |
| Filtering/Sorting | ✓ | - | ✓ | - | ✓ |
| Bulk Operations | - | - | ✓ | - | - |
| Configuration | - | - | ✓ | - | ✓ |
| API Testing | - | ✓ | - | ✓ | - |
| Security Testing | - | ✓ | - | ✓ | - |
| UX/Responsive | ✓ | - | - | - | ✓ |
| Audit Trail | ✓ | - | ✓ | ✓ | ✓ |
| Analytics | ✓ | - | - | - | ✓ |
| Billing/Invoices | - | - | - | - | ✓ |

## Notes for Testers

1. **Screenshot Documentation:** Each file specifies where screenshots should be captured. Document all major flows and results.

2. **Test Data:** Test data (entity names, passport numbers, DOBs) should be entered exactly as specified to ensure consistency across test runs.

3. **API Testing (P02, P04):** Requires terminal/command-line access for curl commands. Run all curl tests as specified with exact syntax.

4. **Security Testing (P04):** XSS and SQL injection tests are intentional security validations. No actual harm should result—these test if the system properly prevents/sanitizes malicious input.

5. **Responsive Testing (P05):** Use DevTools responsive mode to resize viewport to exact specified dimensions. Test on actual devices if possible for additional validation.

6. **Keyboard Navigation (P05, Step 21):** Tab through entire interface. All interactive elements should be reachable and clearly focused.

7. **Audit Trail:** Verify immutability and hash chains function as designed. This is critical for compliance.

8. **Performance:** Note response times, especially for API tests. Document any timeouts or performance issues.

9. **Pass/Fail Criteria:** Each step has explicit validation criteria. If any validation point fails, mark step as FAIL and document the issue.

10. **Screenshots:** Include both successful results AND any error states encountered.

## Version History

- **Created:** 2026-03-26
- **Platform Version Tested:** AMLIQ AML v2.0
- **Test Environment:** Production staging (https://2b690a17.aegis-97g.pages.dev)
- **Browser:** Chrome (latest)
- **API:** http://localhost:3001/api/v1

---

**Total Lines of Test Content:** 2,570 lines across 5 files
