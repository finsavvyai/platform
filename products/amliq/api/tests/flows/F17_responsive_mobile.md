# F17: Mobile Responsiveness (Full Coverage)

**Objective:** Verify complete responsive design across all screen sizes and touch interactions.
**Prerequisites:** Browser responsive design mode, test account logged in

## Test Steps

1. **iPhone 14 (390x844):** Open DevTools, toggle Device Toolbar, set 390x844, pixel ratio 3.0. Verify mobile UI loads
2. **Navigation—Mobile:** Verify sidebar hidden (no left sidebar). Verify bottom tab navigation with 5 icons: Dashboard, Alerts, Screen, Config, More. Verify icons touchable (≥44px). Verify current tab highlighted
3. **Hamburger Menu:** If sidebar exists, verify hamburger icon in top-left. Click—sidebar slides in from left as overlay. Click close (X) or outside—sidebar closes
4. **Dashboard—Mobile:** Click Dashboard tab. Verify stat cards stack vertically (not grid). Verify each card readable: large number, label, trend. Verify no horizontal scroll. Scroll smoothly through page
5. **Charts—Mobile:** Scroll to charts. Verify area chart resizes to 100% width, readable (not cramped). Hover/tap chart—tooltip appears. Verify donut chart resizes, legend visible. Verify charts don't cause horizontal scroll
6. **Table to Cards:** Scroll to recent alerts table. Verify converts to full-width cards. Each row becomes card with entity name (bold), matched entity, score badge, status, action buttons (stacked vertically). Verify action buttons clearly visible and full-width
7. **Alerts—Mobile:** Click Alerts tab. Verify alerts display as full-width cards (not table). Each shows: entity name, confidence badge, status, timestamp. Scroll through alerts—verify smooth performance. Click alert—detail opens full-screen
8. **Alert Detail—Mobile:** Verify full-screen detail. Verify "Back" button at top. Verify entity comparison stacks vertically: screened entity (top), matched entity (below, separated clearly). Scroll down—verify all info accessible. Verify evidence section below comparison. Verify action buttons at bottom (full-width, stacked): Confirm, FP, Escalate. Buttons touchable (44px+)
9. **Screening—Mobile:** Click Screen tab. Verify form loads. Verify entity type dropdown accessible. Verify all form fields stack vertically, full-width. Verify input fields have padding for touch. Verify keyboard appears on input focus. Verify "Screen Now" button full-width and touchable. Perform screening—verify results appear below form, readable
10. **Configuration—Mobile:** Click Config tab. Verify sliders display and are draggable with touch. Drag slider—value updates. Verify value label visible. Verify preset buttons full-width. Verify all controls visible without horizontal scroll
11. **Bottom Nav Interaction:** Click each tab sequentially. Verify page changes smoothly. Verify page loads in nav (no delay). Verify tab highlight follows current page
12. **More Menu:** Click "More" tab (three dots). Verify menu appears with: Analytics, Audit Log, Billing, Settings, Help, Logout. Click each—verify navigation works. Verify menu closes after selection
13. **Touch Interactions:** Verify all functionality via tap (no hover required). Verify buttons have visible focus state (outline/color). Tap button—focus visible. Tap away—focus removed. Verify all interactive elements have focus ring
14. **Touch Targets:** Verify all buttons ≥44x44 pixels (Apple standard). Verify spacing between buttons ≥8px (not accidentally hittable). Verify form inputs ≥44px tall
15. **Keyboard Navigation:** Focus on input, verify virtual keyboard appears. Type—verify keyboard works. Tap elsewhere—keyboard dismisses. Verify Tab key navigates between form elements in logical order
16. **Scrolling Performance:** Scroll through long lists (alerts, audit log). Verify smooth scrolling, no jank. Verify momentum scroll continues after release. Verify no performance degradation with many items
17. **Modal Behavior:** Trigger modal (e.g., confirm alert action). Verify modal appears as bottom sheet (slides up from bottom). Verify modal ≈90% screen width. Verify close button (X) at top-right. Tap outside—modal closes (or shows warning if form dirty). Verify Escape key closes. Verify content inside scrollable if tall
18. **Images/Media:** Verify product images load on mobile. Verify images scale with container (responsive). Verify images don't cause horizontal scroll. Verify images have alt text
19. **Form Errors—Mobile:** Submit empty required field. Verify error message appears clearly with: red color, warning icon, text (not color only). Verify error associated with field (inline/summary). Verify error easy to locate
20. **Landscape Mode (844x390):** Rotate device to landscape. Verify layout adapts to wider format. Verify no horizontal overflow. Verify navigation still accessible. Verify charts readable in landscape. Rotate back to portrait—layout reverts
21. **iPad (768x1024):** Set viewport to 768x1024. Verify optimized tablet layout. Verify sidebar may be visible or collapsible (intermediate size). Verify 2-column layout if applicable (list on left, detail on right, not full-screen). Verify content not too spread out
22. **Small Phone (320x568):** Set to 320x568 (iPhone SE). Verify no horizontal scroll. Verify text readable (may be small but legible). Verify buttons still touchable. Verify no content hidden (all accessible via scroll)
23. **Large Phone (480x853):** Set to 480x853 (Pixel 4a XL). Verify layout takes advantage of space (if applicable). Verify content not cramped
24. **Print View:** Open print dialog (Ctrl+P). Verify print view optimized for paper. Verify important content included. Verify footer/header info present. Verify print preview reasonable output

## Validation

- No horizontal scroll at any breakpoint
- Bottom navigation appears on mobile
- All tap targets ≥44px
- All content accessible via scroll
- Charts and images scale responsively
- Forms usable with virtual keyboard
- Modals appear as bottom sheets
- Landscape orientation supported
- Tablet layout optimized
- Scrolling performance smooth
- All interactions work via touch

## Expected Result

All pages fully responsive across all device sizes (320px-1400px) with mobile layout using bottom navigation, full-width cards, proper touch target sizing, and smooth scrolling performance.

---

*F17 | Mobile Responsive | 2026-03-26*
