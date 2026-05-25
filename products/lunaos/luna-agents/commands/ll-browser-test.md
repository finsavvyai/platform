---
name: ll-browser-test
displayName: Luna Browser Test
description: Full browser integration testing — launch app, navigate flows, screenshot, auto-fix failures
version: 1.0.0
category: testing
agent: luna-full-test
parameters:
  - name: url
    type: string
    description: App URL to test (e.g., http://localhost:3000 or https://app.example.com)
    required: true
    prompt: true
  - name: flow
    type: string
    description: Flow to test (full, auth, dashboard, billing, settings, custom, all)
    required: false
    prompt: true
workflow:
  - detect_app_and_routes
  - launch_browser
  - execute_test_flows
  - capture_screenshots
  - analyze_failures
  - auto_fix_code
  - retest_fixes
  - generate_browser_report
output:
  - .luna/{current-project}/browser-test/
  - .luna/{current-project}/browser-test/report.md
prerequisites: []
---

# Luna Browser Test

Launch your app in a real browser, test every flow, screenshot every page, and auto-fix failures.

## What This Command Does

1. **Detect** — scans your codebase for routes, pages, components
2. **Launch** — starts Playwright browser (chromium, firefox, webkit)
3. **Navigate** — walks through every user flow (with and without auth)
4. **Screenshot** — captures every page state (desktop + mobile)
5. **Analyze** — uses Vision AI to detect UI issues in screenshots
6. **Auto-Fix** — fixes broken code, reruns the test
7. **Loop** — keeps fixing and retesting until all flows pass
8. **Report** — full visual report with before/after screenshots

## Test Flows

### Without Login (Public)
| Flow | What It Tests |
|------|--------------|
| Landing Page | Hero loads, CTAs visible, responsive layout |
| Marketing Pages | Features, pricing, about, contact |
| Documentation | Docs pages render, navigation works, code blocks display |
| Auth Pages | Sign-in form renders, OAuth buttons visible, validation works |
| 404/Error Pages | Error pages render correctly |
| SEO | Meta tags, OG images, canonical URLs, robots.txt |
| Performance | LCP < 2.5s, CLS < 0.1, no layout shifts |

### With Login (Authenticated)
| Flow | What It Tests |
|------|--------------|
| Sign Up | Register with email, verify email, complete onboarding |
| Sign In | Email/password, OAuth (Google, GitHub, Microsoft, LinkedIn) |
| Dashboard | Data loads, widgets render, navigation works |
| CRUD Operations | Create, read, update, delete entities |
| Team Management | Invite member, accept invite, change role, remove member |
| Billing | View plan, upgrade, manage payment, view invoices |
| Settings | Update profile, change password, manage notifications |
| Workflows | Create workflow, add steps, test run, view logs |
| API Keys | Generate key, copy, revoke, test permissions |
| Search | Search queries return results, filters work |

### Cross-Cutting
| Flow | What It Tests |
|------|--------------|
| Responsive | Every page at 375px, 768px, 1024px, 1440px |
| Dark Mode | Toggle dark mode, all components render correctly |
| Keyboard Navigation | Tab through all interactive elements, focus visible |
| Error States | Empty states, loading states, error boundaries |
| Network Errors | Offline mode, slow connection, API failures |
| Session Expiry | Token expiry, refresh flow, redirect to login |

## Usage

```
/browser-test http://localhost:3000                    # Test everything
/browser-test http://localhost:3000 auth               # Auth flows only
/browser-test http://localhost:3000 dashboard           # Dashboard only
/browser-test http://localhost:3000 billing             # Billing only
/browser-test https://staging.myapp.com all             # Test staging
/browser-test http://localhost:3000 full                # All flows + auto-fix
```

## Auto-Fix Loop

When a test fails:

```
Test fails → Screenshot failure state
  → Vision AI analyzes screenshot
  → Identifies the UI issue (broken layout, missing element, wrong text)
  → Reads the source code for that component
  → Generates fix (max 100 lines per file)
  → Applies fix
  → Retests the same flow
  → If pass → move to next flow
  → If fail → try again (max 3 attempts)
  → If still fails → log as blocker, continue to next flow
```

## Screenshot Strategy

Every page gets captured at 4 viewports:

| Viewport | Width | Device |
|----------|-------|--------|
| Mobile | 375px | iPhone 15 |
| Tablet | 768px | iPad |
| Laptop | 1024px | MacBook Air |
| Desktop | 1440px | External display |

Screenshots saved to:
```
.luna/{project}/browser-test/screenshots/
  landing/
    desktop.png
    laptop.png
    tablet.png
    mobile.png
    dark-desktop.png
    dark-mobile.png
  dashboard/
    desktop.png
    mobile.png
  auth/
    signin-desktop.png
    signin-mobile.png
    signup-desktop.png
  ...
```

## Test Credentials

Provide test credentials in `.luna/rules.yaml`:
```yaml
browser_test:
  url: http://localhost:3000
  credentials:
    email: test@example.com
    password: TestPassword123!
  oauth_mock: true                 # Mock OAuth providers in test
  seed_data: true                  # Seed test data before running
```

Or pass inline:
```
/browser-test http://localhost:3000 --email test@example.com --password Test123!
```

## Vision AI Analysis

Each screenshot is analyzed for:
- **Layout issues** — overlapping elements, broken grids, overflow
- **Missing content** — empty containers, broken images, missing text
- **Style problems** — wrong colors, inconsistent spacing, font issues
- **Accessibility** — contrast ratio, missing focus indicators, touch targets
- **Apple HIG compliance** — spacing, typography, visual hierarchy
- **Brand consistency** — colors match brand guide, fonts correct
- **Responsive issues** — content cut off, horizontal scroll, tiny text
- **Dark mode issues** — unreadable text, wrong backgrounds, missing styles

## In Pipes

```
# Test then ship
/pipe browser-test http://localhost:3000 ?>> ship !>> fix

# Full flow: implement, test in browser, fix, ship
/pipe go *5 >> browser-test http://localhost:3000 full ?>> pr !>> (fix >> browser-test) *3?

# Test all viewports after UI changes
/pipe hig >> browser-test http://localhost:3000 >> a11y >> pr

# Brand check: generate brand, apply HIG, verify in browser
/pipe brand >> hig >> browser-test http://localhost:3000 >> approve "Looks good?" >> ship
```

## Output

```
.luna/{project}/browser-test/
  report.md                  # Full test report with pass/fail per flow
  screenshots/               # All captured screenshots
    {page}/{viewport}.png
  fixes/                     # Auto-fix diffs
    {component}-fix.diff
  failures/                  # Failed test screenshots
    {flow}-failure.png
  coverage.json              # Route coverage (which pages were tested)
```
