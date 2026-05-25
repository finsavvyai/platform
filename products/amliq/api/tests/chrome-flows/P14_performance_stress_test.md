# P14: Performance and Stress Testing via Browser

**Objective:** Measure page load performance, memory usage, and stress test the application under load.

**Base URL:** https://2b690a17.aegis-97g.pages.dev | API: http://localhost:3001/api/v1

**Targets:** FCP < 1.5s, LCP < 2.5s, total bundle < 850KB, stress test: 20 concurrent screenings success rate ≥95%

---

## Test 1: Page Load Timing — Performance API

### 1.1 Landing Page (/)
- [ ] Navigate to https://2b690a17.aegis-97g.pages.dev
- [ ] Run: `window.addEventListener('load', () => { setTimeout(() => { const p = performance.getEntriesByType('navigation')[0]; const paints = performance.getEntriesByType('paint'); console.log('DNS:', (p.domainLookupEnd - p.domainLookupStart).toFixed(0) + 'ms', 'Load:', p.loadEventEnd.toFixed(0) + 'ms'); paints.forEach(pt => console.log(pt.name + ':', pt.startTime.toFixed(0) + 'ms')); }, 500); });`
- [ ] Record: FCP: ___ ms, LCP: ___ ms
- [ ] Expected: FCP ≤ 1500ms, LCP ≤ 2500ms
- [ ] Status: ✓ Pass / ✗ Fail

### 1.2 Dashboard (/dashboard)
- [ ] Navigate to /dashboard
- [ ] Run same script
- [ ] Record: FCP: ___ ms, LCP: ___ ms
- [ ] Status: ✓ Pass / ✗ Fail

### 1.3 Alerts (/alerts)
- [ ] Navigate to /alerts
- [ ] Run script
- [ ] Record: FCP: ___ ms, LCP: ___ ms
- [ ] Status: ✓ Pass / ✗ Fail

### 1.4 Screen, Config, Analytics, Audit, Billing
- [ ] Repeat for /screen, /config, /analytics, /audit, /billing
- [ ] Record all times
- [ ] All pages ≤ 2500ms LCP: ✓ Yes / ✗ No

---

## Test 2: Resource Bundle Analysis

### 2.1 Asset Sizes
- [ ] Open Network tab, hard refresh landing page
- [ ] Run: `const r = performance.getEntriesByType('resource'); let js=0, css=0, img=0; r.forEach(x => { if (x.name.endsWith('.js')) js += x.transferSize; else if (x.name.endsWith('.css')) css += x.transferSize; else if (x.name.match(/\.(png|jpg|gif|webp|svg)$/i)) img += x.transferSize; }); console.log('JS:', (js/1024).toFixed(0) + 'KB', 'CSS:', (css/1024).toFixed(0) + 'KB', 'IMG:', (img/1024).toFixed(0) + 'KB', 'Total:', ((js+css+img)/1024).toFixed(0) + 'KB');`
- [ ] Record: JS: ___ KB, CSS: ___ KB, Images: ___ KB, Total: ___ KB
- [ ] Expected: Total < 850KB, JS < 300KB
- [ ] Status: ✓ Pass / ✗ Fail

### 2.2 Code Splitting
- [ ] Run: `const js = performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js')).sort((a, b) => b.transferSize - a.transferSize); console.log('Top JS chunks:'); js.slice(0, 5).forEach((j, i) => console.log((i+1) + '.', j.name.split('/').pop(), ':', (j.transferSize/1024).toFixed(0) + 'KB'));`
- [ ] Check: Multiple chunks (not single giant bundle)
- [ ] Check: No chunk > 300KB
- [ ] Status: ✓ Good / ✗ Needs improvement

### 2.3 Cache Headers
- [ ] In Network tab, click on main JS bundle
- [ ] Check Response Headers:
  - [ ] Cache-Control: max-age=3600 or higher (for assets)
  - [ ] ETag or Last-Modified present
  - [ ] Content-Encoding: gzip
- [ ] Check: Images have max-age ≥ 86400
- [ ] Status: ✓ Correct / ✗ Needs fix

---

## Test 3: API Calls Per Page

### 3.1 Landing Page
- [ ] Network tab, filter XHR/Fetch
- [ ] Hard refresh on /
- [ ] Count API calls: ___ calls
- [ ] Expected: ≤ 3 initial API calls
- [ ] Status: ✓ Pass / ✗ Excessive

### 3.2 Dashboard
- [ ] Filter: Fetch
- [ ] Navigate to /dashboard
- [ ] Count calls: ___ calls
- [ ] Expected: ≤ 5 calls
- [ ] Status: ✓ Pass / ✗ Fail

### 3.3 Each Page
- [ ] Repeat for /alerts, /screen, /config, /analytics, /audit, /billing
- [ ] Record API calls per page
- [ ] All ≤ 5 calls: ✓ Yes / ✗ No

---

## Test 4: Memory Profiling

### 4.1 Initial Heap
- [ ] DevTools → Memory tab
- [ ] Take heap snapshot on /
- [ ] Heap size: ___ MB
- [ ] Record: Initial___ MB

### 4.2 Post-Navigation Heap
- [ ] Navigate through pages: /dashboard → /alerts → /screen → /config → /analytics → /audit → /billing (5 seconds each)
- [ ] After visiting all, take heap snapshot
- [ ] Final size: ___ MB
- [ ] Difference: ___ MB
- [ ] Expected: Difference < initial (memory freed)
- [ ] Status: ✓ Good / ✗ Potential leak

### 4.3 Detached DOM Nodes
- [ ] Run: `let orphans = 0; const all = document.querySelectorAll('*'); all.forEach(el => { if (!document.body.contains(el)) orphans++; }); console.log('DOM nodes:', all.length, 'Orphaned:', orphans);`
- [ ] Expected: Orphaned < 50
- [ ] Status: ✓ Pass / ✗ Too many

---

## Test 5: Stress Test — 20 Rapid Screening Submissions

### 5.1 Rapid Submission
- [ ] Navigate to /screen
- [ ] Run: `let success = 0; for (let i = 1; i <= 20; i++) { setTimeout(() => { fetch('http://localhost:3001/api/v1/screen', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': 'test-key-12345' }, body: JSON.stringify({ entityName: 'Stress ' + i, entityType: 'individual' }) }).then(r => r.status === 201 ? success++ : 0); }, i * 500); } setTimeout(() => console.log('Success:', success + '/20'), 11000);`
- [ ] Wait 12 seconds for completion
- [ ] Record: Success rate: ___ / 20 (___%)
- [ ] Expected: ≥ 19/20 (95% success)
- [ ] Status: ✓ Pass / ✗ Fail

### 5.2 UI Responsiveness
- [ ] While stress test running, click buttons on page
- [ ] Expected: UI responds within 100ms
- [ ] Check: Form is usable during load
- [ ] Status: ✓ Responsive / ✗ Laggy

### 5.3 No Duplicates
- [ ] After stress test, navigate to /alerts or /dashboard
- [ ] Verify: 20 unique screenings created (not duplicates)
- [ ] Status: ✓ No duplicates / ✗ Found duplicates

---

## Test 6: Concurrent Loads (5 Tabs)

### 6.1 Open 5 Tabs
- [ ] Open 5 new tabs
- [ ] In each, run: `const start = Date.now(); window.addEventListener('load', () => { console.log('Load time:', Date.now() - start + 'ms'); });`
- [ ] Hard refresh all 5 tabs simultaneously (Cmd+R in rapid succession)

### 6.2 Load Times
- [ ] Record load time from each tab:
  - [ ] Tab 1: ___ ms
  - [ ] Tab 2: ___ ms
  - [ ] Tab 3: ___ ms
  - [ ] Tab 4: ___ ms
  - [ ] Tab 5: ___ ms
- [ ] Expected: All < 5000ms
- [ ] Status: ✓ Pass / ✗ Slow

### 6.3 No Errors
- [ ] Check console: no 429 rate limit errors
- [ ] Check: All 5 pages loaded successfully
- [ ] Status: ✓ All loaded / ✗ Some failed

---

## Test 7: Animation Performance

### 7.1 Sidebar Animation
- [ ] Resize to 320px width (mobile)
- [ ] DevTools → Performance tab, start recording
- [ ] Click hamburger to open sidebar
- [ ] Toggle open/close 3 times
- [ ] Stop recording
- [ ] Check: FPS ≥ 55 (target 60fps)
- [ ] Check: No long tasks (< 50ms ideally)
- [ ] Record: Avg FPS: ___ fps
- [ ] Status: ✓ Smooth / ✗ Janky

### 7.2 Modal Animation
- [ ] Open a modal (if present)
- [ ] Record animation
- [ ] Check: Modal fade smooth (60fps)
- [ ] Status: ✓ Smooth / ✗ Janky

### 7.3 Chart Animation
- [ ] Navigate to /analytics
- [ ] Start recording
- [ ] Reload page
- [ ] Stop after charts appear
- [ ] Check: Chart animation 60fps
- [ ] Status: ✓ Smooth / ✗ Jerky

---

## Test 8: Scroll Performance

### 8.1 Alert List Scroll
- [ ] Navigate to /alerts
- [ ] Open Performance tab, start recording
- [ ] Scroll from top to bottom and back
- [ ] Stop recording
- [ ] Check: Frame rate ≥ 55fps
- [ ] Check: Rendering < 16ms per frame
- [ ] Status: ✓ Good / ✗ Poor

---

## Test 9: Network Throttling

### 9.1 Slow 3G
- [ ] DevTools → Network → "Slow 3G"
- [ ] Navigate to /
- [ ] Record load time: ___ seconds
- [ ] Expected: Page usable within 10 seconds
- [ ] Status: ✓ Acceptable / ✗ Too slow

### 9.2 Fast 3G
- [ ] Set to "Fast 3G"
- [ ] Navigate to /dashboard
- [ ] Record: ___ seconds
- [ ] Expected: ≤ 5 seconds
- [ ] Status: ✓ Good / ✗ Slow

### 9.3 Reset to Normal
- [ ] Set back to normal throttling

---

## Test 10: Lighthouse Audit

### 10.1 Landing Page
- [ ] DevTools → Lighthouse
- [ ] Select Mobile device
- [ ] Run audit on /
- [ ] Record:
  - [ ] Performance: ___ (target ≥80)
  - [ ] Accessibility: ___ (target ≥90)
  - [ ] Best Practices: ___ (target ≥90)
  - [ ] SEO: ___ (target ≥90)

### 10.2 Dashboard
- [ ] Run audit on /dashboard
- [ ] Record:
  - [ ] Performance: ___
  - [ ] Accessibility: ___

### 10.3 Alerts & Screen
- [ ] Run on /alerts: Performance: ___, Accessibility: ___
- [ ] Run on /screen: Performance: ___, Accessibility: ___

---

## Test 11: Duplicate Request Detection

- [ ] Network tab
- [ ] Navigate to /dashboard
- [ ] Run: `const r = performance.getEntriesByType('resource'); const urls = {}; r.forEach(x => { if (urls[x.name]) console.warn('DUPLICATE:', x.name); urls[x.name] = true; });`
- [ ] Expected: No duplicates logged
- [ ] Status: ✓ No duplicates / ✗ Found duplicates

---

## Test 12: Long Task Monitoring

- [ ] DevTools → Performance
- [ ] Record while reloading /dashboard
- [ ] Check: No tasks > 200ms
- [ ] Check: During critical rendering, no tasks > 50ms
- [ ] Status: ✓ Good / ✗ Long tasks found

---

## Performance Summary Report

### Page Load Times
| Page | FCP | LCP | Load | Status |
|------|-----|-----|------|--------|
| / | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /dashboard | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /alerts | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /screen | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /config | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /analytics | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /audit | ___ ms | ___ ms | ___ ms | ✓/✗ |
| /billing | ___ ms | ___ ms | ___ ms | ✓/✗ |

### Bundle Sizes
- JS: ___ KB (target < 300)
- CSS: ___ KB (target < 50)
- Images: ___ KB (target < 500)
- Total: ___ KB (target < 850)

### Stress Test
- Rapid submissions (20): ___ / 20 passed (target ≥95%)
- Concurrent loads (5): All loaded? ✓ Yes / ✗ No
- UI responsive during load? ✓ Yes / ✗ No
- No duplicates? ✓ Yes / ✗ No

### Memory
- Initial heap: ___ MB
- Final heap: ___ MB
- Change: ___ MB

### Lighthouse
- Performance: ___ (target ≥80)
- Accessibility: ___ (target ≥90)
- Best Practices: ___ (target ≥90)

---

## Summary Checklist
- [ ] All pages FCP ≤ 1500ms
- [ ] All pages LCP ≤ 2500ms
- [ ] Total bundle < 850KB
- [ ] JS bundle < 300KB
- [ ] Code splitting implemented
- [ ] Cache headers correct
- [ ] ≤ 5 API calls per page
- [ ] Memory doesn't leak (returns to baseline)
- [ ] Stress test 20 submissions: ≥95% success
- [ ] 5 concurrent loads all succeed
- [ ] UI responsive during load
- [ ] Animations 60fps
- [ ] Scroll smooth (≥55fps)
- [ ] No duplicate requests
- [ ] No long tasks (>200ms)
- [ ] Lighthouse Performance ≥80
- [ ] Lighthouse Accessibility ≥90
- [ ] Slow 3G usable within 10s
