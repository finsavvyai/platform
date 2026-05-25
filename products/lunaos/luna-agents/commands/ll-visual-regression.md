---
name: ll-visual-regression
displayName: Luna Visual Regression
description: Compare screenshots before/after code changes — detect visual regressions across all pages
version: 1.0.0
category: testing
agent: luna-ui-test
parameters:
  - name: url
    type: string
    description: App URL to test
    required: true
    prompt: true
  - name: baseline
    type: string
    description: Baseline source (previous, branch:main, commit:abc123, url:staging.app.com)
    required: false
    prompt: true
workflow:
  - load_baseline_screenshots
  - capture_current_screenshots
  - pixel_diff_comparison
  - vision_ai_analysis
  - generate_regression_report
output:
  - .luna/{current-project}/visual-regression/
  - .luna/{current-project}/visual-regression/report.md
prerequisites: []
---

# Luna Visual Regression

Detect visual regressions by comparing screenshots before and after code changes.

## What This Command Does

1. **Baseline** — loads previous screenshots (or captures from another branch/URL)
2. **Current** — captures fresh screenshots of every page
3. **Pixel Diff** — compares pixel-by-pixel, highlights differences
4. **Vision AI** — analyzes diffs to determine if change is intentional or regression
5. **Report** — visual report with side-by-side comparisons and diff overlays

## Usage

```
# Compare against last test run
/visual-regression http://localhost:3000

# Compare against main branch
/visual-regression http://localhost:3000 branch:main

# Compare against staging
/visual-regression http://localhost:3000 url:https://staging.myapp.com

# Compare against specific commit
/visual-regression http://localhost:3000 commit:abc123
```

## Output

```
.luna/{project}/visual-regression/
  report.md                    # Regression report
  comparisons/
    landing/
      baseline.png             # Before
      current.png              # After
      diff.png                 # Pixel diff overlay (red = changed)
      analysis.md              # Vision AI verdict: regression or intentional
    dashboard/
      baseline.png
      current.png
      diff.png
      analysis.md
```

## Diff Thresholds

```yaml
# In .luna/rules.yaml
visual_regression:
  threshold: 0.1               # Max 0.1% pixel difference allowed
  ignore_antialiasing: true    # Ignore sub-pixel rendering differences
  ignore_colors: false         # Detect color changes
  viewports: [375, 768, 1440] # Viewports to compare
```

## In Pipes

```
# Visual regression gate before ship
/pipe refactor >> visual-regression http://localhost:3000 ?>> ship

# Full UI quality pipeline
/pipe hig >> browser-test >> visual-regression >> a11y >> approve "Ship?" >> ship
```
