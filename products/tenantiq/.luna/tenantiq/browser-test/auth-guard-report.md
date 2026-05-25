# Auth Guard Test Report

**Date**: 2026-03-30
**Browser**: Chromium (Playwright)
**Base URL**: http://localhost:5173
**Result**: 25/25 PASSED

---

## Test 1: Protected Routes Show SignInHero (17/17 PASSED)

All protected routes correctly display SignInHero when unauthenticated. No protected content is leaked.

| Route | Status | SignInHero Visible | "M365 security" | Sign-in Card | Login Link |
|-------|--------|-------------------|-----------------|--------------|------------|
| /alerts | PASS | Yes | Yes | Yes | Yes |
| /licenses | PASS | Yes | Yes | Yes | Yes |
| /security | PASS | Yes | Yes | Yes | Yes |
| /security/cis | PASS | Yes | Yes | Yes | Yes |
| /ai | PASS | Yes | Yes | Yes | Yes |
| /settings | PASS | Yes | Yes | Yes | Yes |
| /workflows | PASS | Yes | Yes | Yes | Yes |
| /team | PASS | Yes | Yes | Yes | Yes |
| /governance | PASS | Yes | Yes | Yes | Yes |
| /backups | PASS | Yes | Yes | Yes | Yes |
| /threats | PASS | Yes | Yes | Yes | Yes |
| /behavior | PASS | Yes | Yes | Yes | Yes |
| /msp | PASS | Yes | Yes | Yes | Yes |
| /skills | PASS | Yes | Yes | Yes | Yes |
| /sdlc | PASS | Yes | Yes | Yes | Yes |
| /reports | PASS | Yes | Yes | Yes | Yes |
| /audit | PASS | Yes | Yes | Yes | Yes |

**CRITICAL issues**: None. Auth guard is working correctly on all protected routes.

---

## Test 2: Public Routes Render Own Content (4/4 PASSED)

| Route | Status | Notes |
|-------|--------|-------|
| / | PASS | Landing page shows SignInHero as intended (it IS the landing content) |
| /terms | PASS | Renders terms page content |
| /privacy | PASS | Renders privacy page content |
| /support | PASS | Renders support page content |

---

## Test 3: Landing Page Responsive Quality (4/4 PASSED)

| Viewport | Logo | Headline | Sign-in Card | No Overflow | Badges (4+) |
|----------|------|----------|-------------|-------------|-------------|
| 1440px | PASS | PASS | PASS | PASS | PASS |
| 1024px | PASS | PASS | PASS | PASS | PASS |
| 768px | PASS | PASS | PASS | PASS | PASS |
| 375px | PASS | PASS | PASS | PASS | PASS |

---

## Screenshots

All screenshots saved to: `.luna/tenantiq/browser-test/screenshots/auth-guard/`

- 17 protected route screenshots (`protected-*.png`)
- 3 public route screenshots (`public-*.png`)
- 4 responsive viewport screenshots (`landing-*px.png`)

---

## Auth Guard Implementation

The guard is implemented in `apps/web/src/routes/+layout.svelte`:

- **Public routes whitelist**: `/, /terms, /privacy, /support, /home, /auth/callback, /marketplace, /changelog`
- **Guard logic**: `needsAuth = !isPublicRoute && !$auth.user && !$auth.loading`
- **Behavior**: When `needsAuth` is true, renders `<SignInHero />` instead of the page children
- **No sidebar** is shown for unauthenticated users (sidebar only renders when `$auth.user` exists)

## Conclusion

The auth guard is fully functional. All 17 protected routes correctly block unauthenticated access and display the SignInHero component. All 4 public routes render their intended content. The landing page is responsive across all tested viewports with no layout issues.
