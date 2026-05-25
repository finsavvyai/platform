# F02: Pricing Page - 5 Products

**Objective:** Verify all 5 product pricing tiers, toggles, and plan details.
**Prerequisites:** Navigate to `/pricing`

## Test Steps

1. **Page Load:** Navigate to `/pricing`, verify title, 5 tabs (API, Dashboard, SDK, iFrame, Dataset), first tab active
2. **API Pricing:** Verify API cards—Starter $499, Professional $1,499 (Most Popular), Enterprise (Custom), with feature lists
3. **Dashboard Pricing:** Click Dashboard tab, verify $299 + $49/seat (Base), $699 + $69/seat (Professional), Enterprise (Custom)
4. **SDK Pricing:** Verify $699 (Starter), $1,999 (Professional, Most Popular), Custom (Enterprise)
5. **iFrame Pricing:** Verify $199 (Basic), $599 (Professional, Most Popular), Custom (Enterprise)
6. **Dataset Pricing:** Verify $999 (Standard), $2,499 (Premium, Most Popular), Custom (Enterprise)
7. **Monthly/Annual Toggle:** Toggle to Annual, verify 20% discount applied, verify "Save 20% with annual billing" label, prices update
8. **Plan Features:** Verify detailed feature lists and checkmarks/X marks for included/excluded features
9. **"Bundle & Save":** Verify callout section about bundle discounts
10. **CTA Buttons:** Click "Start Free Trial"—verify checkout redirect; verify "Contact Sales" on Enterprise plans
11. **Mobile (375px):** Resize to mobile, verify cards stack vertically, product tabs scroll horizontally, pricing text readable, CTA buttons full-width

## Validation

- All prices match expected values; discounts calculate correctly (20% annual)
- All tabs switch correctly; feature comparisons accurate
- Mobile layout responsive without horizontal scroll

## Expected Result

All 5 products display correct pricing with toggles working and responsive layout.

---

*F02 | Pricing Page | 2026-03-26*
