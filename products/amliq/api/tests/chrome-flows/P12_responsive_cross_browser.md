# P12: Cross-Browser and Responsive Design Test Suite

**Objective:** Validate responsive layout across 9 viewport sizes on all pages.

**Base URL:** https://2b690a17.aegis-97g.pages.dev

**Viewport Sizes:** 320x568 (iPhone SE), 375x812 (iPhone 13), 390x844 (iPhone 14), 428x926 (iPhone 14 Pro Max), 768x1024 (iPad), 1024x768 (Landscape), 1280x800 (Laptop), 1440x900 (Desktop), 1920x1080 (Full HD)

---

## Setup: Test Methodology

For each viewport, use: `window.resizeTo(WIDTH, HEIGHT); console.log('Resized to ' + window.innerWidth + 'x' + window.innerHeight);`

---

## Test 1: Landing Page (/)

### Landing @ 320x568 (iPhone SE)
- [ ] Navigate to /
- [ ] Run: `window.resizeTo(320, 568);`
- [ ] Hero text readable (font ≥14px)
- [ ] CTAs visible and ≥44px height
- [ ] No horizontal scroll
- [ ] Features stack vertically (1 column)
- [ ] Pricing cards stack
- [ ] Footer links ≥44px touch targets

### Landing @ 375x812 (iPhone 13)
- [ ] Run: `window.resizeTo(375, 812);`
- [ ] All sections readable
- [ ] CTAs accessible
- [ ] No overflow

### Landing @ 390x844 through 1920x1080
- [ ] Run each resize for 390x844, 428x926, 768x1024, 1024x768, 1280x800, 1440x900, 1920x1080
- [ ] Verify content adapts correctly at each size
- [ ] No layout breaks

---

## Test 2: Dashboard (/dashboard)

### Dashboard @ 320x568
- [ ] Navigate to /dashboard, resize to 320x568
- [ ] Stats cards stack vertically
- [ ] No horizontal scroll
- [ ] Sidebar hidden or collapsed
- [ ] Bottom tab navigation visible (if mobile nav)

### Dashboard @ 768x1024
- [ ] Resize: `window.resizeTo(768, 1024);`
- [ ] Stats cards 2 per row
- [ ] Charts display correctly
- [ ] Sidebar collapsed or side-drawer

### Dashboard @ 1280x800 and up
- [ ] Resize: `window.resizeTo(1280, 800);`
- [ ] Sidebar visible on left
- [ ] Content properly spaced
- [ ] All stats visible

---

## Test 3: Alerts Page (/alerts)

### Alerts @ 320x568
- [ ] Navigate to /alerts, resize to 320x568
- [ ] Alert cards stack vertically
- [ ] Filter controls collapse to dropdown
- [ ] Touch targets ≥44px
- [ ] No horizontal scroll

### Alerts @ 768x1024
- [ ] Resize: `window.resizeTo(768, 1024);`
- [ ] Alert cards 1-2 per row
- [ ] Filter sidebar visible or collapsible
- [ ] Pagination accessible

### Alerts @ 1280x800+
- [ ] Resize: `window.resizeTo(1280, 800);`
- [ ] Sidebar with filters visible
- [ ] Content spacious
- [ ] All alert details visible

---

## Test 4: Screening Form (/screen)

### Form @ 320x568
- [ ] Navigate to /screen, resize to 320x568
- [ ] Form fields full width
- [ ] Labels above inputs
- [ ] Input height ≥44px
- [ ] Submit button ≥44px
- [ ] No horizontal scroll

### Form @ 768x1024
- [ ] Resize: `window.resizeTo(768, 1024);`
- [ ] Form centered or constrained width
- [ ] Results display below form

### Form @ 1280x800+
- [ ] Resize: `window.resizeTo(1280, 800);`
- [ ] Form and results well-positioned
- [ ] All content visible

---

## Test 5: Configuration (/config)

### Config @ 320x568
- [ ] Navigate to /config, resize to 320x568
- [ ] Settings cards stack vertically
- [ ] Sliders usable on touch (≥44px)
- [ ] Toggles accessible
- [ ] No horizontal scroll

### Config @ 768x1024
- [ ] Resize: `window.resizeTo(768, 1024);`
- [ ] Settings 2 per row
- [ ] Controls responsive

---

## Test 6: Analytics (/analytics)

### Analytics @ 320x568
- [ ] Navigate to /analytics, resize to 320x568
- [ ] Charts stack vertically
- [ ] Chart height readable (≥200px)
- [ ] Axis labels readable
- [ ] Legend doesn't overlap
- [ ] No horizontal scroll

### Analytics @ 768x1024
- [ ] Resize: `window.resizeTo(768, 1024);`
- [ ] Charts 2 per row (if designed)
- [ ] Interactive features work

---

## Test 7: Audit Log (/audit)

### Audit @ 320x568
- [ ] Navigate to /audit, resize to 320x568
- [ ] Table converts to card view
- [ ] One entry per card
- [ ] Cards stack vertically
- [ ] No horizontal scroll

### Audit @ 768x1024 and up
- [ ] Resize to 768x1024
- [ ] Transition to table view (if designed)
- [ ] Full table visible at 1280x800+

---

## Test 8: Billing (/billing)

### Billing @ 320x568
- [ ] Navigate to /billing, resize to 320x568
- [ ] Subscription cards stack vertically
- [ ] Plan names and prices readable
- [ ] CTA button ≥44px height, full width
- [ ] Usage meters full width
- [ ] No horizontal scroll

### Billing @ 768x1024
- [ ] Resize: `window.resizeTo(768, 1024);`
- [ ] Subscription cards 2 per row
- [ ] Usage section full width below

---

## Test 9: Navigation & Common Elements

### Bottom Tab Navigation (Mobile <640px)
- [ ] Resize to 320x568
- [ ] Visit any page
- [ ] Bottom navigation visible
- [ ] Each tab icon ≥44px, tappable
- [ ] Active tab indicated
- [ ] Tab switching works

### Sidebar Visibility (Desktop >1024px)
- [ ] Resize to 1280x800
- [ ] Sidebar visible on left
- [ ] Navigation links clear
- [ ] Sidebar width ≤250px

---

## Overflow Check Script

Run at each viewport:
```javascript
console.log('Viewport:', window.innerWidth, 'x', window.innerHeight);
let overflows = [];
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > el.clientWidth) overflows.push(el.className);
});
console.log('Elements with overflow:', overflows.length);
```

---

## Summary Checklist
- [ ] All 9 viewports tested
- [ ] Landing page responsive
- [ ] Dashboard adapts correctly
- [ ] Alerts page responsive
- [ ] Screening form works
- [ ] Config page responsive
- [ ] Analytics responsive
- [ ] Audit log converts properly
- [ ] Billing page responsive
- [ ] Navigation (tabs/sidebar) working
- [ ] No horizontal scroll on any viewport
- [ ] No overlapping elements
- [ ] Touch targets ≥44px on mobile
- [ ] Text readable on all sizes
