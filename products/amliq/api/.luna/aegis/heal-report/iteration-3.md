# Heal Report - Iteration 3

**Date:** 2026-03-30
**Target:** https://amliq.finance
**Pages Tested:** Full landing page (features, pricing, demo, comparison, FAQ, footer), /forgot-password

## Issues Found & Fixed

### 1. Missing Forgot Password page (Major) - FIXED
- **Page:** /forgot-password (blank screen)
- **File:** `web/src/pages/ForgotPassword.tsx` (new), `web/src/App.tsx`
- **Fix:** Created full Forgot Password page with back-to-login link, email input, submit button, and success confirmation state. Added route in App.tsx.

### 2. Demo input placeholder low contrast (Medium) - FIXED
- **Page:** Landing / "See It In Action" section
- **File:** `web/src/pages/marketing/MatchingDemo.tsx`
- **Fix:** Changed `placeholder-neutral-500` to `placeholder-neutral-400` for better readability

### 3. Pricing subtitle low contrast (Medium) - FIXED
- **Page:** Landing / "Five Powerful Products" section
- **File:** `web/src/pages/marketing/PricingSection.tsx`
- **Fix:** Changed `text-apple-label-secondary` (55% opacity white) to `text-neutral-400` (solid gray) for better readability

## Positive Findings (No Fix Needed)
- Features section layout clean and well-structured
- Pricing section loads correctly (handles API errors gracefully)
- Demo section interactive and responsive
- Comparison table, testimonials, FAQ all render correctly
- Footer links to /terms and /privacy working
- Mobile layouts verified — no overflow or clipping
- Forgot Password page responsive on mobile (375px)

## Remaining Non-Critical Items
- Nav links "Docs" and "Blog" point to `#` (pages not yet built)
- Footer links "About", "Blog", "Careers", "Contact", "DPA", "SOC 2" point to `#`

## Deployment
- Built and deployed via `wrangler pages deploy dist --project-name amliq`
- Deploy URL: https://8bac441c.amliq-p0u.pages.dev
