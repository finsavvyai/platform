# P13: Full WCAG 2.1 AA Accessibility Audit

**Objective:** Comprehensive accessibility testing across all pages for WCAG 2.1 AA compliance.

**Base URL:** https://2b690a17.aegis-97g.pages.dev

---

## Setup: axe-core Injection Script

Paste into console on any page:
```javascript
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
script.onload = () => {
  axe.run((error, results) => {
    if (error) throw error;
    console.log('=== AXE AUDIT ===');
    console.log('Violations:', results.violations.length);
    console.log('Critical:', results.violations.filter(v => v.impact === 'critical').length);
    results.violations.forEach(v => console.error(`${v.id}: ${v.description} (${v.nodes.length} nodes)`));
  });
};
document.head.appendChild(script);
```

---

## Test 1: Landing Page (/)

### 1.1 axe-core Audit
- [ ] Navigate to /
- [ ] Run axe-core script above
- [ ] Expected: ≤ 5 non-critical violations
- [ ] Check: No critical violations

### 1.2 Heading Hierarchy
- [ ] Run: `document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => console.log(h.tagName, ':', h.textContent.substring(0,50)))`
- [ ] Expected: Single h1, no skipped levels (h1→h3 bad)
- [ ] Check: Logical structure

### 1.3 Image Alt Text
- [ ] Run: `document.querySelectorAll('img').forEach(i => { if (!i.alt) console.error('Missing alt:', i.src); })`
- [ ] Expected: All images have alt text
- [ ] Check: Alt text meaningful (not "image" or "pic")

### 1.4 Form Labels
- [ ] Run: `document.querySelectorAll('input,textarea,select').forEach(inp => { const label = document.querySelector('label[for="' + inp.id + '"]'); if (!label && !inp.getAttribute('aria-label')) console.warn('No label:', inp.type); })`
- [ ] Expected: All inputs have labels
- [ ] Check: Labels associated via for attribute

### 1.5 Color Contrast
- [ ] Visually inspect hero text, buttons, links
- [ ] Check: Text readable on background (≥4.5:1 normal, ≥3:1 large)
- [ ] Example: Black text on white ✓, light gray on white ✗

### 1.6 Link Text
- [ ] Run: `document.querySelectorAll('a').forEach(a => { if (['click here', 'read more', 'more'].includes(a.textContent.toLowerCase())) console.warn('Vague link:', a.href); })`
- [ ] Expected: All links descriptive (not "click here")
- [ ] Check: Link purpose clear from text

---

## Test 2: Dashboard (/dashboard)

### 2.1 axe-core Audit
- [ ] Navigate to /dashboard
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 2.2 Aria-live Regions
- [ ] Run: `document.querySelectorAll('[aria-live],[role="alert"],[role="status"]').forEach(lr => console.log(lr.tagName, 'aria-live=' + lr.getAttribute('aria-live'), ':', lr.textContent.substring(0,30)))`
- [ ] Expected: Dynamic updates have aria-live="polite"
- [ ] Check: Stats updates announced

### 2.3 Tab Navigation
- [ ] Press Tab through entire dashboard
- [ ] Expected: All interactive elements reachable
- [ ] Check: Logical tab order (left→right, top→bottom)

### 2.4 Focus Indicators
- [ ] Tab through page again
- [ ] Expected: Clear focus outline on each element (≥2px)
- [ ] Check: Focus ring ≥3:1 contrast with background

---

## Test 3: Alerts Page (/alerts)

### 3.1 axe-core Audit
- [ ] Navigate to /alerts
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 3.2 Alert Semantics
- [ ] Run: `document.querySelectorAll('[role="article"],li,[class*="alert"]').forEach((a, i) => { const h = a.querySelector('h2,h3,[role="heading"]'); console.log('Alert ' + i + ':', h ? h.textContent.substring(0,30) : 'NO HEADING'); })`
- [ ] Expected: Each alert has heading
- [ ] Check: Proper semantic structure

### 3.3 Filter Accessibility
- [ ] Check: Filter labels visible and associated
- [ ] Tab through filters: all keyboard operable
- [ ] Check: Selected filters announced

### 3.4 Pagination
- [ ] Check: Page numbers have aria-current="page" on active
- [ ] Check: Previous/Next have aria-label
- [ ] Check: Pagination purpose clear

---

## Test 4: Screening Form (/screen)

### 4.1 axe-core Audit
- [ ] Navigate to /screen
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 4.2 Form Structure
- [ ] Run: `const form = document.querySelector('form'); form.querySelectorAll('input,textarea,select').forEach(inp => { const label = document.querySelector('label[for="' + inp.id + '"]'); console.log(inp.name + ':', label ? 'labeled' : 'NO LABEL'); })`
- [ ] Expected: All inputs labeled

### 4.3 Required Field Indicators
- [ ] Check: Required fields marked with asterisk (*) AND "required" text
- [ ] Check: Asterisk not color-only
- [ ] Check: aria-required="true" on inputs

### 4.4 Form Validation
- [ ] Submit empty form
- [ ] Check: Errors announced (aria-live region)
- [ ] Check: Error text red AND has icon/text (not color-only)
- [ ] Check: Errors associated with inputs (aria-describedby)

---

## Test 5: Configuration (/config)

### 5.1 axe-core Audit
- [ ] Navigate to /config
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 5.2 Toggle Accessibility
- [ ] Check: All toggles/switches have labels
- [ ] Check: Switch state announced (aria-checked)
- [ ] Check: Sliders have aria-label and value display

### 5.3 Slider Controls
- [ ] Check: Labels visible
- [ ] Check: Min/max values accessible (aria-valuemin, aria-valuemax)
- [ ] Keyboard: Arrow keys adjust slider

### 5.4 Field Grouping
- [ ] Check: Related settings in `<fieldset><legend>` groups
- [ ] Check: Legend describes group

---

## Test 6: Analytics (/analytics)

### 6.1 axe-core Audit
- [ ] Navigate to /analytics
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 6.2 Chart Accessibility
- [ ] Run: `document.querySelectorAll('[role="img"],svg,[class*="chart"]').forEach(c => { const label = c.getAttribute('aria-label') || c.querySelector('title')?.textContent; console.log('Chart:', label ? 'LABELED' : 'NO LABEL'); })`
- [ ] Expected: Each chart has aria-label or title

### 6.3 Data Table Alternative
- [ ] Check: If chart is critical, data table provided
- [ ] Check: Table has `<thead>` with `<th scope="col">`
- [ ] Check: Table keyboard accessible

---

## Test 7: Audit Log (/audit)

### 7.1 axe-core Audit
- [ ] Navigate to /audit
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 7.2 Table Structure
- [ ] Check: `<thead>` and `<tbody>` present
- [ ] Check: Headers are `<th scope="col">`
- [ ] Check: Headers clearly labeled

### 7.3 Mobile Card View
- [ ] Resize to 320x568
- [ ] Check: Cards have proper headings
- [ ] Check: Each entry clearly labeled

---

## Test 8: Billing (/billing)

### 8.1 axe-core Audit
- [ ] Navigate to /billing
- [ ] Run axe-core script
- [ ] Expected: ≤ 5 violations

### 8.2 Pricing Presentation
- [ ] Check: Plans in table or structured list
- [ ] Check: Features listed logically (not layout-only)
- [ ] Check: Price clearly stated (not image-only)

### 8.3 Plan Selection
- [ ] Check: CTA buttons clearly labeled ("Subscribe to Basic")
- [ ] Check: Current plan indicated (aria-current)
- [ ] Check: Subscription button disabled state clear

---

## Test 9: Keyboard Navigation (All Pages)

### 9.1 Tab Order
- [ ] On each page, press Tab repeatedly from top
- [ ] Expected: Logical order (left→right, top→bottom)
- [ ] Check: All interactive elements reachable
- [ ] Check: No tabindex="positive number" (breaks order)

### 9.2 Focus Visibility
- [ ] While tabbing, check each element has visible focus indicator
- [ ] Expected: ≥2px outline, ≥3:1 contrast
- [ ] Check: Focus ring color distinct

### 9.3 Escape Key
- [ ] On each page, check if modals/popovers present
- [ ] Press Escape: close modal
- [ ] Check: Focus returns to button that opened modal

### 9.4 Skip Link
- [ ] Check: Skip link present at top (links to main content)
- [ ] Press Tab once: skip link should be first focusable
- [ ] Click or press Enter: goes to main content
- [ ] Check: Actually skips navigation

---

## Test 10: Text Zoom to 200%

- [ ] Open DevTools → Settings → zoom to 200%
- [ ] Navigate to each page: /, /dashboard, /alerts, /screen, /config, /analytics, /audit, /billing
- [ ] Expected: All content readable and usable at 200% zoom
- [ ] Check: No text hidden or cut off
- [ ] Check: No horizontal scroll beyond normal content
- [ ] Check: Buttons/links still clickable
- [ ] Reset: Zoom back to 100%

---

## Test 11: High Contrast Mode

- [ ] (Windows) Settings → Ease of Access → High Contrast → Enable
- [ ] Reload page
- [ ] Expected: Page remains readable with high contrast colors
- [ ] Check: Text visible
- [ ] Check: Images and icons visible
- [ ] Check: Buttons distinguishable
- [ ] Reset: Disable high contrast

---

## Test 12: Screen Reader Simulation (Manual)

### 12.1 Page Structure Reading
- [ ] On landing page, close eyes, have someone read page aloud using screen reader
- [ ] Expected: Page structure clear
- [ ] Check: All headings heard correctly
- [ ] Check: All images alt text heard
- [ ] Check: Form labels heard with inputs
- [ ] Check: Links read properly

### 12.2 Heading Navigation
- [ ] Use heading jump (H key in NVDA, VO+U rotor in VoiceOver)
- [ ] Check: Can navigate page by headings
- [ ] Check: Heading hierarchy makes sense

---

## Test 13: Color Contrast Validation

Run for each page:
```javascript
console.log('=== CONTRAST CHECK ===');
document.querySelectorAll('*').forEach(el => {
  if (!el.textContent || el.offsetWidth === 0) return;
  const style = window.getComputedStyle(el);
  const color = style.color;
  const bg = style.backgroundColor;
  // Simple check - would need contrast library for exact ratio
  console.log(`${el.tagName}.${el.className}: color=${color} bg=${bg}`);
});
console.log('Manual review: Verify each text element meets 4.5:1 (normal) or 3:1 (large 18px+) ratio');
```

---

## Test 14: Aria-live Regions

Run on dashboard:
```javascript
document.querySelectorAll('[aria-live]').forEach(lr => {
  console.log('Live region:', lr.getAttribute('aria-live'), 'Content:', lr.textContent.substring(0,50));
});
```

Expected: Dynamic updates (stats, alerts) use `aria-live="polite"`

---

## Test 15: Link Purpose from Text

Run: `document.querySelectorAll('a').forEach(a => console.log('Link:', a.textContent || a.getAttribute('aria-label') || a.title || 'NO TEXT'));`

Expected: All links have clear purpose

---

## Summary Checklist
- [ ] All pages pass axe-core audit (≤5 violations)
- [ ] No critical violations on any page
- [ ] All images have alt text
- [ ] All form inputs have labels
- [ ] All buttons have accessible names
- [ ] Heading hierarchy correct (no skipped levels)
- [ ] Color contrast ≥4.5:1 (normal), ≥3:1 (large)
- [ ] Keyboard navigation working
- [ ] Focus indicators visible
- [ ] Tab order logical
- [ ] Skip link functional
- [ ] Form validation errors announced
- [ ] Dynamic content uses aria-live
- [ ] Charts accessible (alt text or data table)
- [ ] Text zoom to 200% works
- [ ] No required fields color-only
- [ ] Modal dialogs trap focus
- [ ] Aria-current used for active pages/items
- [ ] All tests passed on 8 pages
