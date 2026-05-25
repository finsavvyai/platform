# TenantIQ Browser Test Report

**Date**: 2026-03-30
**Target**: http://localhost:5173
**Browser**: Chromium (Playwright)
**Viewports tested**: 1440px (desktop), 1024px (laptop), 768px (tablet), 375px (mobile)

---

## Executive Summary

**Overall Health Score: 72/100**

- Public pages: Excellent -- all render correctly across all viewports
- Auth error handling: Good -- clear error messages with recovery actions
- Protected route gating: CRITICAL FAILURE -- 8 protected routes render full UI without authentication
- Responsive layout: Pass -- no horizontal overflow detected at any viewport
- Performance: Pass -- all pages load under 3 seconds
- Keyboard navigation: Pass -- tab navigation works on landing page
- Visual contrast: Pass -- text readable on all backgrounds

---

## Test Suites Executed

### 1. Existing E2E Tests (all Chromium)

| Suite | Tests | Passed | Failed | Time |
|-------|-------|--------|--------|------|
| public-pages.spec.ts | 4 | 4 | 0 | 2.6s |
| auth-flow.spec.ts | 9 | 9 | 0 | 2.5s |
| authenticated-nav.spec.ts | 11 | 11 | 0 | 23.0s |
| **Total existing** | **24** | **24** | **0** | **28.1s** |

### 2. Visual Audit Tests (new)

| Suite | Tests | Passed | Failed | Time |
|-------|-------|--------|--------|------|
| Landing Page (/) -- SignInHero | 4 | 4 | 0 | - |
| Landing Page Links | 2 | 2 | 0 | - |
| /home Landing Page | 4 | 4 | 0 | - |
| /platform Dashboard | 4 | 4 | 0 | - |
| Auth Error Pages | 2 | 2 | 0 | - |
| 404 Page | 1 | 1 | 0 | - |
| Unauthenticated Route Behavior | 8 | 0 | 8 | - |
| Keyboard Navigation | 2 | 2 | 0 | - |
| Performance | 3 | 3 | 0 | - |
| Visual Contrast | 2 | 2 | 0 | - |
| **Total visual audit** | **32** | **24** | **8** | **6.3s** |

### 3. Screenshot Tests (existing)

| Suite | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| Public Pages - Screenshots | 16 | 16 | 0 | All viewports, light+dark |
| Authenticated Pages - Screenshots | 104 | 0 | 104* | Auth mock setup times out |
| Responsive Layout | 1 | - | - | Not reached |
| **Total** | **125** | **16** | **104** | *Mock auth incompatible with current app routing |

---

## Issues Found

### CRITICAL

#### C1: Protected Routes Accessible Without Authentication
**Severity**: Critical
**Affected Routes**: `/alerts`, `/licenses`, `/security`, `/security/cis`, `/ai`, `/settings`, `/workflows`, `/team`
**Description**: All 8 tested protected routes render their full page UI (headings, buttons, skeleton cards, form elements) to unauthenticated users. While no actual data is exposed (API calls would fail), the UI structure, feature names, pricing tiers, and admin controls are fully visible.

**Evidence from screenshots**:
- `/settings` -- Exposes full pricing page (Starter $29, Professional $79, Enterprise $149), SSO configuration button, and billing section
- `/alerts` -- Shows Alerts page with filter dropdowns (statuses, severities) and Analytics section
- `/ai` -- Shows full AI Engine interface with chat input, tab navigation (Security Scan, License Optimize, Analysis Chain), and sample questions
- `/team` -- Shows Team Management page with member table headers (Member, Role, Status, Joined)
- `/workflows` -- Shows Workflows page with "Create Workflow" button
- `/licenses` -- Shows License Management page with skeleton cards
- `/security` -- Shows Security Overview heading
- `/security/cis` -- Shows CIS benchmark page structure

**Impact**: Information disclosure (pricing, feature set, internal tool names). Potential for unauthenticated users to attempt actions (e.g., "Create Workflow" button visible). Violates security best practice of hiding protected UI from unauthenticated users.

**Recommendation**: Add client-side route guards in SvelteKit layout/page load functions that redirect unauthenticated users to `/` or show the SignInHero component (as the dashboard `/` page already does correctly).

---

### HIGH

#### H1: Screenshot Test Suite Auth Mocking Is Broken
**Severity**: High
**Affected File**: `tests/e2e/browser-test/screenshot-all-pages.spec.ts`
**Description**: All 104 authenticated page screenshot tests time out (60s each) because the `setupAuth()` function that sets `localStorage` tokens and intercepts API routes does not successfully authenticate the user. The app likely validates tokens server-side or through Clerk middleware, making client-side localStorage injection insufficient.

**Impact**: No automated visual regression testing for authenticated pages. The 26 authenticated page states across 4 viewports are completely untested in the screenshot suite.

**Recommendation**: Either (a) implement a proper test auth bypass using a Clerk test token or environment variable, or (b) mock the auth at the SvelteKit hooks level via a `PLAYWRIGHT_TEST` flag.

---

### MEDIUM

#### M1: Cookie Consent Banner Overlaps Chat Widget on Mobile
**Severity**: Medium
**Affected Viewports**: 375px (mobile)
**Description**: The cookie consent banner at the bottom of the page and the floating chat widget (blue circle, bottom-right) visually overlap on mobile viewports. The chat widget sits directly on top of or adjacent to the "Got it" button.

**Evidence**: Visible in mobile screenshots for `/home`, `/platform`, and landing page.

#### M2: /platform Dashboard Accessible Without Admin Auth
**Severity**: Medium
**Affected Route**: `/platform`
**Description**: The Platform Dashboard (admin CRM overview) renders to any visitor without authentication. It shows admin tools (Admin Dashboard, Users, Organizations, Subscriptions) and stats cards (Organizations: 0, MRR: $0). While data is empty, the admin interface structure should not be publicly accessible.

#### M3: Landing Page Has Two Different Versions at `/` and `/home`
**Severity**: Medium (Informational)
**Description**: The app serves two distinct landing pages:
- `/` -- SignInHero component (dark, minimal, sign-in focused)
- `/home` -- Full marketing landing page with nav bar (Features, Pricing, Security, AI Agent), hero, CTA buttons, and more stats

These represent different design languages. The `/` page shows "M365 security, fully in control." while `/home` shows "Control Every Microsoft 365 Tenant -- with AI". This could confuse users depending on which URL they land on.

---

### LOW

#### L1: Empty Skeleton Cards Without Loading Indicators on Unauth Pages
**Severity**: Low
**Description**: On pages like `/licenses` and `/workflows`, empty rounded cards are rendered with no text, spinner, or "no data" message. This creates a confusing blank-card experience rather than a clear empty state.

#### L2: No Focus Ring Visible on Default Tab Navigation
**Severity**: Low
**Description**: While keyboard tab navigation works (test passes), the focus ring/outline may not be sufficiently visible on all interactive elements against the dark landing page background. Accessibility users may have difficulty tracking focus position.

#### L3: "Powered by OpenHands Luna Agents + Anthropic" Subtitle on AI Page
**Severity**: Low
**Description**: The `/ai` page subtitle exposes internal technology stack details ("Powered by OpenHands Luna Agents + Anthropic"). This may not be appropriate for a customer-facing SaaS product.

---

## Pages Tested

### Public Pages (No Auth Required)

| Page | URL | Status | Notes |
|------|-----|--------|-------|
| Landing (SignInHero) | `/` | PASS | All viewports, all elements visible |
| Marketing Landing | `/home` | PASS | All viewports, responsive |
| Platform Dashboard | `/platform` | PASS* | Renders but should require admin auth (M2) |
| Auth Callback Error | `/auth/callback` | PASS | Shows "Sign-in Failed" with clear error |
| Auth Callback Denied | `/auth/callback?error=access_denied` | PASS | Shows appropriate error |
| 404 Page | `/any-invalid-route` | PASS | Clean 404 with navigation links |

### Protected Pages (Should Require Auth)

| Page | URL | Shows Sign-In? | Status |
|------|-----|---------------|--------|
| Dashboard | `/` | YES | PASS (only page with auth gating) |
| Alerts | `/alerts` | NO | FAIL (C1) |
| Licenses | `/licenses` | NO | FAIL (C1) |
| Security Overview | `/security` | NO | FAIL (C1) |
| CIS Benchmark | `/security/cis` | NO | FAIL (C1) |
| AI Engine | `/ai` | NO | FAIL (C1) |
| Settings | `/settings` | NO | FAIL (C1) |
| Workflows | `/workflows` | NO | FAIL (C1) |
| Team | `/team` | NO | FAIL (C1) |

---

## Screenshots Captured

All screenshots saved to `.luna/tenantiq/browser-test/screenshots/`

### Landing Page (`/`)
- `landing/desktop.png` (1440px)
- `landing/laptop.png` (1024px)
- `landing/tablet.png` (768px)
- `landing/mobile.png` (375px)

### Marketing Landing (`/home`)
- `home/desktop.png` (1440px)
- `home/laptop.png` (1024px)
- `home/tablet.png` (768px)
- `home/mobile.png` (375px)

### Platform Dashboard (`/platform`)
- `platform/desktop.png` (1440px)
- `platform/laptop.png` (1024px)
- `platform/tablet.png` (768px)
- `platform/mobile.png` (375px)

### Auth Error Pages
- `auth/callback-error.png`
- `auth/callback-denied.png`

### Error Pages
- `errors/404.png`

### Unauthenticated Access to Protected Pages
- `unauth/alerts.png`
- `unauth/licenses.png`
- `unauth/security.png`
- `unauth/security_cis.png`
- `unauth/ai.png`
- `unauth/settings.png`
- `unauth/workflows.png`
- `unauth/team.png`

---

## Visual Quality Assessment

### Landing Page (`/`) -- SignInHero
- Layout: Clean two-column grid on desktop, stacks vertically on mobile
- Typography: Clear hierarchy (logo > h1 > subtitle > stats > badges)
- Colors: Dark background (#060b0f) with green accent (#10b981), good contrast
- Sign-in card: Visible with clear CTA, Microsoft button has color logo
- Badges: SOC 2, HIPAA, GDPR, Zero Trust all visible
- Status bar: Green dot with "Security scan running across tenants" visible
- Responsive: Stacks cleanly at all breakpoints, no overflow

### Marketing Landing (`/home`)
- Layout: Full marketing page with nav bar, hero, stats, compliance badges
- Typography: Large bold headline, good hierarchy
- Navigation: Features, Pricing, Security, AI Agent links in header
- CTAs: "Start Free Trial" (green) and "Watch Demo" (outlined) buttons
- Stats: 100+ CIS Controls, 5 Frameworks, 13+ AI Tools, 10x Scale
- Responsive: Good stacking on mobile, nav collapses appropriately

### Platform Dashboard (`/platform`)
- Layout: Clean card-based layout with admin tools and stat cards
- Cards: Admin Dashboard, Users, Organizations, Subscriptions
- Stats: Organizations (0), Active Subscriptions (0), MRR ($0), Total Users (0)
- Responsive: Cards stack on mobile, maintain readability

### 404 Page
- Layout: Centered, clean error page
- Elements: Warning icon, "404" heading, descriptive text, "Return Home" and "Go Back" buttons
- Navigation links: Dashboard, Security, Alerts, Settings, AI Agent
- Quality: Professional, helpful recovery options

### Auth Error Page
- Layout: Centered error state
- Elements: Warning icon, "Sign-in Failed" heading, error details box, "Try Again" and "Go to Homepage" buttons
- Help text: "contact your IT admin or reach out to support@tenantiq.app"
- Quality: Clear, actionable, professional

---

## Responsive Layout Results

| Page | 1440px | 1024px | 768px | 375px | Horizontal Overflow |
|------|--------|--------|-------|-------|-------------------|
| `/` (SignInHero) | OK | OK | OK | OK | None |
| `/home` | OK | OK | OK | OK | None |
| `/platform` | OK | OK | OK | OK | None |

---

## Performance Results

| Page | Load Time | Threshold | Status |
|------|-----------|-----------|--------|
| `/` | < 300ms | < 3000ms | PASS |
| `/home` | < 350ms | < 3000ms | PASS |
| `/platform` | < 350ms | < 3000ms | PASS |

---

## Recommendations (Priority Order)

1. **[Critical] Add auth guards to all protected routes** -- Every route except `/`, `/home`, `/platform`, `/auth/*` should check for authentication and redirect to `/` or show SignInHero when unauthenticated.

2. **[High] Fix or replace screenshot test auth mocking** -- The current `setupAuth()` approach using localStorage injection does not work. Consider using Clerk test tokens or a SvelteKit-level test bypass.

3. **[Medium] Gate `/platform` behind admin authentication** -- The admin dashboard should not be publicly accessible.

4. **[Medium] Fix cookie consent / chat widget overlap on mobile** -- Add bottom padding or z-index adjustment to prevent overlap.

5. **[Low] Add proper empty states** -- Replace blank skeleton cards on unauth pages with meaningful "Sign in to view" or "No data available" messages.

6. **[Low] Remove internal tech stack references** -- Update the AI Engine subtitle from "Powered by OpenHands Luna Agents + Anthropic" to something customer-facing.
