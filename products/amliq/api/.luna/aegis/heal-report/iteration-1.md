# Heal Report - Iteration 1

**Date:** 2026-03-29
**Target:** https://amliq.finance
**Pages Tested:** Landing, Login, Signup (desktop + mobile viewports)

## Issues Found & Fixed

### 1. Missing "Forgot Password?" link (Major) - FIXED
- **Page:** Login
- **File:** `web/src/pages/Login.tsx`
- **Fix:** Added "Forgot password?" link below the password field, linking to `/forgot-password`

### 2. Input placeholder low contrast (Major) - FIXED
- **Page:** Login, Signup
- **File:** `web/src/index.css`
- **Fix:** Changed placeholder from `text-apple-label-tertiary` (25% opacity) to `text-apple-label-secondary` (55% opacity). Added `focus:border-apple-blue` for stronger focus indication.

### 3. "Trusted by" text low contrast (Major) - FIXED
- **Page:** Landing
- **File:** `web/src/pages/marketing/LogoCloud.tsx`
- **Fix:** Changed text color from `text-neutral-500` to `text-neutral-400` for better readability

### 4. Password requirements only in placeholder (Medium) - FIXED
- **Page:** Signup
- **File:** `web/src/pages/Signup.tsx`
- **Fix:** Moved "Minimum 8 characters" to persistent helper text below the password field. Placeholder now just says "Password".

### 5. Social login button inconsistency (Minor) - FIXED
- **Page:** Login, Signup
- **File:** `web/src/components/auth/SignInButtons.tsx`
- **Fix:** Normalized Microsoft and LinkedIn buttons to use dark neutral backgrounds (`#2D2D30`) with colored brand icons, matching the Google/GitHub pattern of neutral bg + brand icon.

## Positive Findings (No Fix Needed)
- Landing page mobile layout is well-adapted (single column, no overflow)
- CTA buttons properly sized on all viewports
- Navigation hamburger menu present on mobile
- Content priority correct on mobile (hero + CTAs first)
- Touch targets adequate for primary buttons
- No broken images or rendering glitches
- Form fields full-width on mobile

## Pending Verification
- Changes need deployment to production (amliq.finance)
- Re-screenshot after deploy to confirm all fixes render correctly
- Note: `/forgot-password` route needs to be implemented (page doesn't exist yet)

## Screenshots
- Pre-fix screenshots saved to `/tmp/heal-screenshots/`
