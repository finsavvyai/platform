# AMLIQ AML Platform - Comprehensive Test Suite (P11-P14)

## Overview

Four new comprehensive test flow markdown files created for the AMLIQ AML screening platform, providing complete coverage of API integration, responsive design, accessibility, and performance testing.

**Total Coverage:** 1,023 lines of detailed, executable test steps

---

## Files Created

### P11: Comprehensive API Integration Test Suite (6.4 KB)
**40+ test cases covering all API endpoints**

Coverage:
- Authentication: valid key, missing header, invalid key, wrong product prefix
- Screening: POST (valid/invalid/empty), GET by ID (valid/invalid/non-existent)
- Alerts: List with filters, get by ID, update resolution
- Billing: Products, checkout, usage, seats
- Rate limiting: 50 concurrent requests
- Content-type validation: JSON, plain text, multipart
- CORS testing

Key Features:
- Copy-paste ready JavaScript console snippets
- Exact expected response codes documented
- Curl/fetch examples for all endpoints

---

### P12: Cross-Browser and Responsive Design Test Suite (5.6 KB)
**70+ test cases across 9 viewport sizes**

Viewport Coverage:
- Mobile: 320x568, 375x812, 390x844, 428x926
- Tablet: 768x1024, 1024x768
- Desktop: 1280x800, 1440x900, 1920x1080

Pages Tested:
- Landing page (/): hero, features, pricing, footer
- Dashboard (/dashboard): stats cards, charts, sidebar
- Alerts (/alerts): alert cards, filters, pagination
- Screening (/screen): form, results
- Config (/config): settings cards, sliders
- Analytics (/analytics): charts
- Audit (/audit): table/card views
- Billing (/billing): subscription cards, usage

Key Checks:
- No horizontal scroll on any viewport
- Touch targets ≥44px on mobile
- Text readable at all sizes
- Navigation adaptation (tabs <640px, sidebar >1024px)
- Element overlap detection

---

### P13: Full WCAG 2.1 AA Accessibility Audit (11 KB)
**50+ test cases for comprehensive accessibility compliance**

Coverage:
- axe-core automated testing (script included)
- Color contrast validation (4.5:1 normal, 3:1 large)
- Heading hierarchy (no skipped levels)
- Image alt text verification
- Form label association
- Link accessibility (no "click here" links)
- Keyboard navigation (Tab, Shift+Tab, Escape)
- Focus indicators (≥2px, ≥3:1 contrast)
- Text zoom to 200%
- High contrast mode
- Screen reader compatibility
- Aria-live regions
- Modal/dialog accessibility

Key Features:
- axe-core injection script ready to paste
- Step-by-step keyboard navigation guide
- Screen reader testing instructions
- Testing for all 8 pages

---

### P14: Performance and Stress Testing via Browser (11 KB)
**60+ test cases for performance metrics and load testing**

Performance Measurements:
- Page load timing: FCP < 1.5s, LCP < 2.5s (all pages)
- Bundle sizes: JS < 300KB, CSS < 50KB, Images < 500KB
- Code splitting verification
- Cache header validation
- Memory profiling and leak detection
- API call counting per page

Stress Testing:
- 20 rapid concurrent screening submissions (≥95% success)
- 5 concurrent dashboard loads
- No duplicate submission detection
- UI responsiveness under load
- Animation performance (60fps target)
- Network throttling (Slow 3G, Fast 3G)
- Lighthouse audit (Performance ≥80, Accessibility ≥90)

Key Features:
- Performance API measurement scripts
- Memory profiling instructions
- Stress test automation
- Network analysis
- Scroll/animation performance checks
- Comprehensive summary report template

---

## Test Statistics

| File | Size | Lines | Test Cases | Pages | Automated |
|------|------|-------|-----------|-------|-----------|
| P11 | 6.4K | 199 | 40+ | All (via API) | Partial |
| P12 | 5.6K | 239 | 70+ | 8 pages × 9 viewports | Manual |
| P13 | 11K | 324 | 50+ | 8 pages | Partial (axe-core) |
| P14 | 11K | 261 | 60+ | All pages | Partial (scripts) |
| **Total** | **34K** | **1,023** | **220+** | **8 pages** | **Mixed** |

---

## Test Coverage by Page

### Landing Page (/)
- ✓ P12: 9 viewport sizes
- ✓ P13: Accessibility audit, color contrast, alt text
- ✓ P14: Page load timing, bundle analysis

### Dashboard (/dashboard)
- ✓ P12: 9 viewport sizes, stats cards, sidebar
- ✓ P13: Accessibility, aria-live regions
- ✓ P14: Load timing, memory profiling, chart animations
- ✓ API: Config endpoint testing

### Alerts (/alerts)
- ✓ P11: All alert endpoints (GET, PUT, filters, pagination)
- ✓ P12: 9 viewport sizes, card/table views
- ✓ P13: Accessibility, alert semantics, filters
- ✓ P14: Load timing, scroll performance

### Screening Form (/screen)
- ✓ P11: POST /api/v1/screen (valid, invalid, validation)
- ✓ P12: 9 viewport sizes, form layout
- ✓ P13: Accessibility, form labels, validation errors
- ✓ P14: Load timing, stress test 20 submissions

### Configuration (/config)
- ✓ P12: 9 viewport sizes, sliders, toggles
- ✓ P13: Accessibility, toggle controls, sliders
- ✓ P14: Load timing

### Analytics (/analytics)
- ✓ P12: 9 viewport sizes, charts
- ✓ P13: Accessibility, chart descriptions
- ✓ P14: Load timing, chart animation performance

### Audit Log (/audit)
- ✓ P12: 9 viewport sizes, table/card conversion
- ✓ P13: Accessibility, table structure
- ✓ P14: Load timing

### Billing (/billing)
- ✓ P11: Billing endpoints (products, checkout, usage, seats)
- ✓ P12: 9 viewport sizes, subscription cards
- ✓ P13: Accessibility, plan selection, pricing
- ✓ P14: Load timing

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| FCP (all pages) | < 1.5s | To be measured |
| LCP (all pages) | < 2.5s | To be measured |
| Total bundle | < 850 KB | To be measured |
| JS bundle | < 300 KB | To be measured |
| Stress test (20 submissions) | ≥95% success | To be measured |
| Concurrent loads (5 tabs) | All succeed | To be measured |
| Lighthouse Performance | ≥80 | To be measured |
| Lighthouse Accessibility | ≥90 | To be measured |
| Animation FPS | ≥60 fps | To be measured |
| Scroll FPS | ≥55 fps | To be measured |
| Touch targets (mobile) | ≥44px | To be verified |
| Color contrast | 4.5:1 (normal), 3:1 (large) | To be measured |

---

## How to Use These Tests

### 1. Quick Start (30 minutes)
- Run P14 performance audit (Lighthouse + bundle analysis)
- Run P13 accessibility audit (axe-core)
- Test P12 responsive on 3 viewports (320x568, 768x1024, 1440x900)

### 2. Standard Test Run (2-3 hours)
1. **API Testing** (P11): Run all auth, screening, alert tests
2. **Responsive Testing** (P12): Test all 8 pages × 9 viewports
3. **Accessibility** (P13): Full axe-core audit + keyboard navigation
4. **Performance** (P14): Page load timing + stress test

### 3. Comprehensive Test Run (Full day)
- Follow Standard Test Run above
- Complete memory profiling (P14)
- Network throttling tests (P14)
- Full screen reader testing (P13)
- Load testing (P14 concurrent users)

---

## Test Prerequisites

**Environment:**
- Chrome/Chromium browser with DevTools
- Site: https://2b690a17.aegis-97g.pages.dev
- API: http://localhost:3001/api/v1
- Network access to both endpoints

**Tools Required:**
- Browser DevTools (built-in)
- axe-core library (CDN-loaded in P13)
- Performance API (built-in)
- No external tools needed

---

## Test Execution Workflow

### Phase 1: API Integration (P11)
1. Run authentication tests
2. Test screening endpoints
3. Test alert endpoints
4. Test billing endpoints
5. Verify rate limiting

### Phase 2: Responsive Design (P12)
1. Test landing page on 9 viewports
2. Test each app page on 3 key sizes (mobile, tablet, desktop)
3. Verify navigation switching (tabs/sidebar)
4. Check for overflow issues

### Phase 3: Accessibility (P13)
1. Run axe-core on each page
2. Verify keyboard navigation
3. Check color contrast
4. Test form accessibility
5. Verify heading hierarchy

### Phase 4: Performance (P14)
1. Measure page load times
2. Analyze bundle sizes
3. Run stress test (20 concurrent submissions)
4. Profile memory usage
5. Test animations and scroll

---

## Success Criteria

### API Integration (P11)
- ✓ All auth scenarios pass
- ✓ All endpoints respond correctly
- ✓ Rate limiting enforced
- ✓ Content-type validation working

### Responsive Design (P12)
- ✓ All pages render at 9 viewport sizes
- ✓ No horizontal scroll on any size
- ✓ Touch targets ≥44px on mobile
- ✓ Text readable on all sizes
- ✓ Navigation adapts (tabs/sidebar)

### Accessibility (P13)
- ✓ axe-core: ≤5 non-critical violations per page
- ✓ No critical violations
- ✓ All images have alt text
- ✓ All forms labeled
- ✓ Keyboard navigation functional
- ✓ Color contrast ≥4.5:1
- ✓ Focus indicators visible
- ✓ Text zoom 200% works

### Performance (P14)
- ✓ FCP < 1.5s on all pages
- ✓ LCP < 2.5s on all pages
- ✓ Total bundle < 850 KB
- ✓ JS bundle < 300 KB
- ✓ 20 concurrent submissions: ≥95% success
- ✓ 5 concurrent loads: all succeed
- ✓ Animations: 60fps
- ✓ Scroll: ≥55fps
- ✓ Lighthouse Performance ≥80
- ✓ Lighthouse Accessibility ≥90

---

## Key Test Features

✓ **Copy-Paste Ready:** All code snippets ready to paste in browser console
✓ **Checkbox Tracking:** Every test has [ ] checkbox for documentation
✓ **Expected Results:** Clear pass/fail criteria for each test
✓ **Automated Detection:** axe-core, Performance API, built-in browser tools
✓ **No External Dependencies:** Uses only browser built-ins and CDN libraries
✓ **Step-by-Step Instructions:** Detailed guidance for each test
✓ **Multi-Page Coverage:** 8 application pages fully tested
✓ **Comprehensive Metrics:** Performance, accessibility, responsiveness, stress testing
✓ **Summary Templates:** Ready-to-fill performance and issue reports

---

## Documentation Format

Each test file includes:
- Clear objective statement
- Setup instructions
- Step-by-step test procedures
- Exact console commands (copy-paste ready)
- Expected results and pass/fail criteria
- Checkbox tracking for progress
- Summary checklist
- Related measurements/records

---

## Integration with CI/CD

These tests can be partially automated:
- **P11 (API):** Run as API test suite in CI
- **P13 (Accessibility):** Run axe-core in headless Chrome
- **P14 (Performance):** Run Lighthouse in CI
- **P12 (Responsive):** Manual testing or screenshot comparison

---

## File Locations

All files saved to:
`/sessions/loving-cool-einstein/mnt/outputs/aegis-v2/tests/chrome-flows/`

Individual files:
- `P11_api_integration_tests.md` — API testing
- `P12_responsive_cross_browser.md` — Responsive design
- `P13_accessibility_wcag_audit.md` — Accessibility audit
- `P14_performance_stress_test.md` — Performance testing

---

## Next Steps

1. **Review files** and familiarize with test structure
2. **Run P14 Lighthouse audit** to establish performance baseline
3. **Execute P11 API tests** to validate backend
4. **Test P12 responsive** on key viewports
5. **Run P13 accessibility** audit with axe-core
6. **Document findings** in summary templates
7. **Create remediation plan** for any failures
8. **Retest** after fixes applied

---

## Support & Questions

Each test includes:
- Expected response codes/values
- Pass/fail criteria
- Links to standards (WCAG 2.1 AA, WCAG 2.1 AAA)
- Example outputs
- Common issues and solutions

For details, refer to individual test file sections.
