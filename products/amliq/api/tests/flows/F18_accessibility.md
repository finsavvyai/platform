# F18: Accessibility Compliance (WCAG AA)

**Objective:** Verify WCAG 2.1 Level AA accessibility compliance.
**Prerequisites:** Browser, accessibility tools (axe, screen reader optional)

## Test Steps

1. **Screen Reader—Dashboard:** Use NVDA/JAWS/browser built-in. Navigate `/dashboard`. Verify page title announced. Verify nav announced clearly. Verify stat cards announced with: label (e.g., "Today's Alerts"), value (e.g., "8"), trend (e.g., "up 5%"). Verify charts announced: title, type (area chart), description/alternative. Verify no content completely invisible to screen readers
2. **Keyboard Tab Order:** Navigate any page with Tab key repeatedly. Verify elements focusable in logical order: top nav, content, buttons, form inputs, footer. Verify order matches visual left-to-right, top-to-bottom. Verify focus doesn't get trapped
3. **Focus Indicators:** Tab through page. Verify visible focus indicator on each element: outline color contrasts with background (≥3:1), ≥2px wide or 2px space. Verify visible on different background colors. Verify not removed by CSS
4. **Skip Navigation:** Press Tab once at page load. Verify "Skip to main content" link appears (visible, not hidden off-screen). Press Enter—focus moves to main content. Verify header/nav skipped. Verify other items still accessible via Tab
5. **Form Labels:** Navigate screening form. Verify each input has associated label: `<label for="entity-name">`. Click label text—input focused. Verify label visible next to input. Verify required fields marked: asterisk (*) AND text "required" (not color only)
6. **Keyboard Form Submission:** Navigate form with Tab. Verify checkboxes toggleable with Space. Verify radio buttons selectable with Space. Verify dropdowns openable with Space/Enter. Navigate to submit button. Press Enter—form submits (or validation errors shown)
7. **Escape Key Closes Modals:** Open modal (alert detail, confirmation). Verify Escape closes modal. Verify focus returns to button that opened modal. Verify modal doesn't reopen unintentionally. Open nested modals—Escape closes only topmost
8. **Color Contrast—Text:** Use contrast checker (WebAIM, axe). Check all text: normal (body), labels, links, button text, headings. Verify ratios: ≥4.5:1 normal text (WCAG AA), ≥3:1 large text (18pt+ or 14pt+ bold). Check on different backgrounds. Verify links have underline (not just color)
9. **Color Contrast—UI:** Check buttons (text vs button, border vs background): ≥4.5:1 text. Check confidence badges (red/yellow/green text): ≥4.5:1. Check form input borders vs background: ≥3:1. Verify color not only indicator of status
10. **Confidence Scores—Not Color Only:** Navigate alert detail. Verify confidence score uses: color badge (red/yellow/green), percentage number (87%), text label ("High Confidence"). Verify all three present. Verify readable for color-blind users
11. **Status Indicators—Not Color Only:** Verify status labels use: icon (checkmark/X/question), color, text ("Confirmed"/"False Positive"/"Pending"). Verify icons meaningful (not just decorative). Verify status understandable without color
12. **Progress Indicators:** Verify usage progress bar has: filled portion visible, percentage text ("89%"), aria-valuenow, aria-valuemin, aria-valuemax attributes. Verify color changes (80%, 95%, 100%) accompanied by text warning
13. **Heading Structure:** Use browser outline or accessibility tools. Verify hierarchy: H1 (page title), H2 (main sections), H3 (subsections). Verify no skipped levels (H1→H3). Navigate using H key (screen reader)—verify all sections accessible
14. **Image Alt Text:** Check all images: feature icons, logos, screenshots, badges. Verify meaningful alt text. Verify decorative images have empty alt: `alt=""`. Verify no `alt="image"` or `alt="photo"` (too generic)
15. **Link Text Clarity:** Verify links have descriptive text (not "Click here", "More", "Read more" alone). Verify context clear: `<a href="/details">View details about Mohammed Al-Rashidi</a>` OR `<a href="/details">View <span class="sr-only">alert for Mohammed Al-Rashidi</span></a>`
16. **ARIA Labels:** Verify icon buttons have aria-labels: "Download invoice", "Delete subscription". Verify alerts/notifications: `role="alert"` for urgent, `role="status"` for updates. Verify custom components: Sliders have role="slider", aria-valuenow, aria-valuemin, aria-valuemax. Tabs have role="tab", aria-selected
17. **Form Validation:** Submit form with empty field. Verify error message appears and is announced (in `<div role="alert">`). Verify message associated with field (via aria-describedby). Verify includes: field name, what was wrong, how to fix
18. **Autocomplete & Datepickers:** Verify form inputs have autocomplete attributes: email field `autocomplete="email"`, name field `autocomplete="name"`, date field `autocomplete="bday"`. Verify datepicker (if present) openable via keyboard, navigable with arrow keys, selectable with Enter, closeable with Escape
19. **Resize Text to 200%:** Increase browser zoom to 200%. Verify content readable and layout doesn't break. Verify no horizontal scroll. Verify buttons still clickable. Zoom to 400%—content reflows to single column (no data loss)
20. **Language Declaration:** Verify HTML has language attribute: `<html lang="en">`. If multiple languages, verify language switches: `<span lang="es">Español</span>`. Verify screen reader announces correct language
21. **Animated Content:** Verify no auto-play animations or infinite loops. If animations exist, verify pausable via keyboard, stop after 5 seconds, respect `prefers-reduced-motion` setting. Set OS accessibility: "Reduce Motion"—verify animations reduced/disabled
22. **Automated Scan:** Install axe DevTools. Run scan on each major page: Dashboard, Alert detail, Screening form, Configuration, Billing. Review violations: Critical/Serious (fix immediately), Moderate (fix if possible), Minor (document). Verify no critical/serious violations
23. **Mobile Accessibility:** Test screen reader on mobile. Verify touch targets 44x44px minimum. Verify focus indicators visible. Verify keyboard navigation works. Verify no duplicate IDs (common on SPAs)
24. **Documentation:** Verify accessibility statement available (footer/nav). Verify explains accessibility features, contact info for issues, WCAG conformance level claimed ("WCAG 2.1 AA")

## Validation

- All text ≥4.5:1 contrast ratio (WCAG AA)
- All interactive elements have focus indicators
- All form inputs have associated labels
- Keyboard navigation works throughout
- Images have appropriate alt text
- Heading structure logical
- Links have descriptive text
- ARIA labels used correctly
- Error messages clear and associated
- No horizontal scroll at 200% zoom
- Prefers-reduced-motion respected
- Automated tools find no critical violations

## Expected Result

AMLIQ platform meets WCAG 2.1 Level AA accessibility standards with proper semantic HTML, ARIA labels, keyboard navigation, color contrast, and focus indicators throughout.

---

*F18 | Accessibility | 2026-03-26*
