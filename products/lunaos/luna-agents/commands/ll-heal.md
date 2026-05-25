---
name: ll-heal
displayName: Luna Self-Heal
description: Continuously test, screenshot, detect issues, and auto-fix your app in a loop until healthy
version: 1.0.0
category: automation
agent: luna-full-test
parameters:
  - name: url
    type: string
    description: App URL to monitor and heal
    required: true
    prompt: true
  - name: max_iterations
    type: number
    description: Max fix iterations (default 5)
    required: false
    prompt: false
workflow:
  - launch_app_in_browser
  - run_all_test_flows
  - screenshot_every_page
  - analyze_with_vision_ai
  - identify_issues
  - auto_fix_code
  - retest_and_screenshot
  - loop_until_healthy
  - generate_heal_report
output:
  - .luna/{current-project}/heal-report.md
prerequisites: []
---

# Luna Self-Heal

Continuously test, screenshot, detect, and fix your app until everything works.

## What This Command Does

```
Launch browser
  → Navigate every page
  → Screenshot everything
  → Vision AI: find issues
  → Fix code automatically
  → Retest
  → Still broken? Fix again
  → Repeat until healthy (max 5 iterations)
  → Report everything
```

## The Heal Loop

```
Iteration 1:
  ├── Browse all routes
  ├── Screenshot 4 viewports per page
  ├── Vision AI detects: "Button overflows on mobile"
  ├── Reads src/components/Button.tsx
  ├── Fixes: adds responsive styles
  └── Retests → Button fixed ✓

Iteration 2:
  ├── Browse all routes
  ├── Screenshot 4 viewports per page
  ├── Vision AI detects: "Dashboard chart not loading"
  ├── Reads src/components/Chart.tsx + API route
  ├── Fixes: corrects API endpoint URL
  └── Retests → Chart loads ✓

Iteration 3:
  ├── Browse all routes
  ├── All screenshots pass
  └── App is healthy ✓ → Generate report
```

## What Gets Fixed

| Category | Issue Types |
|----------|------------|
| **Layout** | Overflow, broken grid, overlapping elements, misalignment |
| **Responsive** | Content cut off on mobile, horizontal scroll, tiny text |
| **Functionality** | Buttons not working, forms not submitting, broken links |
| **Data** | API errors, missing data, loading forever, empty states |
| **Styles** | Wrong colors, missing dark mode, inconsistent spacing |
| **Accessibility** | Missing focus, low contrast, no keyboard nav |
| **Performance** | Slow load, layout shifts, large images |

## Usage

```
/heal http://localhost:3000                    # Full heal
/heal http://localhost:3000 --max 3            # Max 3 fix iterations
/heal https://staging.myapp.com                # Heal staging
```

## In Pipes

```
# Implement then heal
/pipe go *5 >> heal http://localhost:3000 >> pr

# Full autopilot: build, heal, ship
/pipe feature "add dashboard" >> heal http://localhost:3000 ?>> ship

# Heal after every deploy
/pipe ship >> heal https://staging.myapp.com ?>> approve "Promote to prod?"

# Continuous healing
/pipe watch src/ >> heal http://localhost:3000
```

## Heal vs Other Test Commands

| Command | What It Does |
|---------|-------------|
| `/test` | Runs existing unit/integration tests |
| `/browser-test` | Tests flows + screenshots, reports failures |
| `/e2e-flow` | Generates Playwright test files |
| `/visual-regression` | Compares before/after screenshots |
| `/heal` | **Tests + screenshots + auto-fixes + retests in a loop until healthy** |

## Output

```
.luna/{project}/heal-report.md
.luna/{project}/browser-test/
  screenshots/                 # Final healthy screenshots
  iterations/
    1/                         # Iteration 1 screenshots + fixes
      screenshots/
      fixes/
    2/                         # Iteration 2 screenshots + fixes
    3/                         # Final iteration (all healthy)
```
