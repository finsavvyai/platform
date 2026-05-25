# Production Site Test Report

**Target**: https://app.tenantiq.app
**Date**: 2026-03-31
**Browser**: Chromium (Playwright)
**Result**: 35/35 PASSED
**Duration**: 6.3s

---

## 1. Public Pages — Content Verification (7/7 PASSED)

| Page | Status | Notes |
|------|--------|-------|
| `/` (Landing) | PASS | SignInHero visible with "M365 security" text, "Sign in" button present |
| `/home` (Marketing) | PASS | TenantIQ logo, Features/Demo/Pricing nav links, full marketing page |
| `/terms` | PASS | "Terms" heading visible |
| `/privacy` | PASS | "Privacy" heading visible |
| `/support` | PASS | "Support" heading visible |
| `/demo` | PASS | "See TenantIQ in Action" heading, 4+ video cards detected |

Screenshots saved at 1440px and 375px for landing and home pages.

## 2. Protected Pages — Auth Guard (12/12 PASSED)

All 12 protected routes correctly show the SignInHero instead of the page content when accessed without authentication:

| Route | Status |
|-------|--------|
| `/alerts` | PASS |
| `/licenses` | PASS |
| `/security` | PASS |
| `/security/cis` | PASS |
| `/ai` | PASS |
| `/settings` | PASS |
| `/workflows` | PASS |
| `/team` | PASS |
| `/governance` | PASS |
| `/backups` | PASS |
| `/threats` | PASS |
| `/skills` | PASS |

## 3. Video Assets (4/4 PASSED)

| Video | Status | Response |
|-------|--------|----------|
| `video-trailer.htm` | PASS | 200, content > 100 bytes |
| `video-explainer.htm` | PASS | 200, content > 100 bytes |
| `video-social.htm` | PASS | 200, content > 100 bytes |
| `video-ad.htm` | PASS | 200, content > 100 bytes |

## 4. Navigation & Links (4/4 PASSED)

| Test | Status | Notes |
|------|--------|-------|
| Start Free Trial CTA | PASS | Links to `https://app.tenantiq.app` (root sign-in page) |
| Demo nav link | PASS | Scrolls to `#demo` section |
| Features nav link | PASS | Scrolls to `#features` section |
| Footer links | PASS | `/terms`, `/privacy`, `/demo` all return 200 |

## 5. Responsive Design (4/4 PASSED)

| Viewport | Status | Overflow |
|----------|--------|----------|
| 1440px (Desktop XL) | PASS | No horizontal overflow |
| 1024px (Desktop) | PASS | No horizontal overflow |
| 768px (Tablet) | PASS | No horizontal overflow |
| 375px (Mobile) | PASS | No horizontal overflow |

Screenshots saved for all 4 viewports.

## 6. Performance (4/4 PASSED)

All pages loaded under 3 seconds (DOM content loaded):

| Page | Status |
|------|--------|
| `/` | PASS |
| `/home` | PASS |
| `/terms` | PASS |
| `/privacy` | PASS |
| `/demo` | PASS |

---

## Screenshots

24 screenshots saved to `.luna/tenantiq/browser-test/screenshots/production/`:

- `landing-1440.png`, `landing-375.png`
- `home-1440.png`, `home-375.png`
- `terms.png`, `privacy.png`, `support.png`, `demo.png`
- `auth-guard-*.png` (12 protected route screenshots)
- `responsive-home-*.png` (4 viewport screenshots)

## Test File

`tests/e2e/production/prod-pages.spec.ts`

Run command:
```bash
npx playwright test tests/e2e/production/prod-pages.spec.ts --project=chromium --reporter=list
```
