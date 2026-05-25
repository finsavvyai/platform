---
name: ll-visual-diff
displayName: Luna Visual Diff
description: Pixel-perfect visual regression testing — compare screenshots against baseline using MCP image-compare server
version: 1.0.0
category: testing
agent: luna-visual-diff
parameters:
  - name: url
    type: string
    description: App URL to capture current screenshots from
    required: true
    prompt: true
  - name: baseline
    type: string
    description: Path to baseline screenshots directory (or "save" to create new baseline)
    required: true
    prompt: true
  - name: threshold
    type: number
    description: "Pixel diff threshold percentage to flag as regression (default: 5)"
    required: false
    default: 5
workflow:
  - capture_current_screenshots
  - load_baseline_screenshots
  - run_pixel_diff_comparison
  - generate_diff_overlays
  - classify_regressions
  - generate_diff_report
output:
  - .luna/{current-project}/visual-diff/
  - .luna/{current-project}/visual-diff/report.md
prerequisites: []
mcp_servers:
  - image-compare
---

# Luna Visual Diff — Pixel-Perfect Regression Testing

Compare your app's current state against a known-good baseline. Uses the **image-compare MCP server** (Pixelmatch algorithm) for deterministic, AI-free pixel comparison.

## How It Works

```
Baseline screenshots          Current screenshots
(saved from last release)     (captured now from live app)
        │                              │
        └──────────┬───────────────────┘
                   ▼
        ┌─────────────────────┐
        │   image-compare MCP  │
        │   Pixelmatch engine  │
        │   Anti-alias aware   │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │   Diff overlay PNGs  │
        │   Changed pixels RED │
        │   Diff % per page    │
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐
        │  Regression Report   │
        │  Pass/Fail per page  │
        │  Visual diff gallery │
        └─────────────────────┘
```

## Usage

```bash
# Save current state as baseline
/visual-diff http://localhost:3000 save

# Compare against saved baseline
/visual-diff http://localhost:3000 .luna/baselines/

# Compare with custom threshold (10% = more lenient)
/visual-diff http://localhost:3000 .luna/baselines/ --threshold 10

# Compare staging vs production
/visual-diff https://staging.app.com ./prod-screenshots/
```

## In Pipes

```bash
# Save baseline → make changes → diff
/pipe visual-diff http://localhost:3000 save >> go *5 >> visual-diff http://localhost:3000 .luna/baselines/ >> assert "0 regressions"

# Pre-PR regression check
/pipe visual-diff http://localhost:3000 .luna/baselines/ ?>> pr !>> fix

# Full pipeline: test → diff → a11y → ship
/pipe browser-test http://localhost:3000 >> visual-diff http://localhost:3000 .luna/baselines/ >> visual-qa a11y >> pr
```

## Output

```
.luna/{project}/visual-diff/
  report.md              # Regression report with pass/fail
  baselines/             # Saved baseline screenshots (when using "save")
  current/               # Current captured screenshots
  diffs/                 # Diff overlay images
    {page}-{viewport}-diff.png
  stats.json             # Per-page diff percentages
```

## Threshold Guide

| Threshold | Use Case |
|-----------|----------|
| 1% | Strict — catch any rendering change |
| 5% | Default — catch layout regressions, ignore anti-aliasing |
| 10% | Lenient — catch major layout breaks only |
| 20% | Very lenient — only flag completely broken pages |
