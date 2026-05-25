---
name: ll-visual-qa
displayName: Luna Visual QA
description: Multi-layer visual quality assurance — combines vision AI, pixel diff, accessibility scanning, and OCR across all MCP servers
version: 1.0.0
category: testing
agent: luna-visual-qa
parameters:
  - name: url
    type: string
    description: App URL to test (e.g., http://localhost:3000)
    required: true
    prompt: true
  - name: mode
    type: string
    description: "Mode: full (all layers), vision (AI analysis), diff (pixel compare), a11y (accessibility), ocr (text extraction)"
    required: false
    prompt: true
    default: full
  - name: baseline
    type: string
    description: Path to baseline screenshots for regression diff (optional)
    required: false
workflow:
  - capture_screenshots
  - run_vision_analysis
  - run_pixel_diff
  - run_accessibility_scan
  - run_ocr_extraction
  - correlate_findings
  - generate_visual_qa_report
output:
  - .luna/{current-project}/visual-qa/
  - .luna/{current-project}/visual-qa/report.md
prerequisites: []
mcp_servers:
  - zai-mcp-server
  - image-compare
  - accessibility-scanner
  - image-extractor
---

# Luna Visual QA — Multi-Layer MCP Pipeline

The most powerful visual quality assurance command in Luna. Orchestrates **5 MCP servers** in a layered pipeline where each server handles one specialized job, and findings are correlated across layers for maximum coverage.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │     /visual-qa <url> [mode]      │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │   Layer 0: CAPTURE               │
                    │   Playwright screenshots          │
                    │   4 viewports × all routes        │
                    └──────────────┬──────────────────┘
                                   │
           ┌───────────┬───────────┼───────────┬───────────┐
           ▼           ▼           ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ Layer 1 │ │ Layer 2 │ │ Layer 3 │ │ Layer 4 │ │ Layer 5 │
    │ VISION  │ │  DIFF   │ │  A11Y   │ │   OCR   │ │  PERF   │
    │ zai-mcp │ │ img-cmp │ │ axe-core│ │ extract │ │ Playwrt │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
         │           │           │           │           │
         └───────────┴───────────┼───────────┴───────────┘
                                 ▼
                    ┌──────────────────────────────────┐
                    │   Layer 6: CORRELATE              │
                    │   Cross-reference all findings    │
                    │   Deduplicate & prioritize        │
                    │   Generate unified report         │
                    └──────────────────────────────────┘
```

## What Each Layer Does

### Layer 0: Capture (Playwright)
- Navigate every route in the app
- Screenshot at 4 viewports: mobile (375px), tablet (768px), laptop (1024px), desktop (1440px)
- Capture both light and dark mode (if supported)
- Record page load times, network requests, console errors

### Layer 1: Vision AI Analysis (zai-mcp-server)
**MCP tools used**: `analyze_image`, `ui_diff_check`, `diagnose_error_screenshot`, `ui_to_artifact`
- AI-powered layout analysis (overlapping, broken grids, overflow)
- Missing content detection (empty containers, broken images)
- Style consistency check (colors, spacing, fonts, brand)
- Apple HIG compliance scoring
- Dark mode correctness
- Responsive behavior assessment
- Generates fix suggestions with code snippets

### Layer 2: Pixel Diff Regression (image-compare MCP)
**MCP tools used**: `compare_images`, `capture_and_compare`
- Compare current screenshots against baseline (previous release)
- Pixel-level diff using Pixelmatch algorithm
- Anti-aliasing aware comparison
- Generates visual diff overlay images (red = changed pixels)
- Reports diff percentage per page per viewport
- Flags pages that changed more than threshold (default: 5%)

### Layer 3: Accessibility Scan (accessibility-scanner MCP)
**MCP tools used**: `run_accessibility_scan`, `get_scan_results`
- Full WCAG 2.1 AA compliance check
- Color contrast ratio validation
- Missing alt text, ARIA labels, roles
- Keyboard navigation issues
- Focus indicator visibility
- Touch target sizes (mobile)
- Form label associations
- Heading hierarchy validation

### Layer 4: OCR Text Extraction (image-extractor MCP → Claude Vision)
**MCP tools used**: `extract_image_from_file`
- Extract all visible text from screenshots
- Detect typos, wrong brand names, placeholder text
- Verify text content matches expected copy
- Check for truncated text at mobile viewports
- Validate that no debug/dev text appears in production

### Layer 5: Performance Metrics (Playwright)
- Page load time (domcontentloaded, networkidle)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)
- Console errors/warnings count
- Failed network requests

## Cross-Layer Correlation

The correlation engine combines findings from all layers:

| Signal from Layer 1 (Vision) | + Signal from Layer 3 (A11y) | = Combined Finding |
|------|------|------|
| "Low contrast text detected" | "Color contrast ratio 2.1:1 (needs 4.5:1)" | **CRITICAL**: Contrast failure with exact ratio and fix |
| "Text appears truncated" | — | + Layer 4 (OCR) confirms missing characters → **HIGH** |
| "Layout looks broken at mobile" | — | + Layer 2 (Diff) shows 42% pixel change → **CRITICAL** regression |
| — | "Missing form labels" | + Layer 4 (OCR) extracts actual label text → auto-fix with correct text |

## Usage

```bash
/visual-qa http://localhost:3000                    # Full pipeline (all 5 layers)
/visual-qa http://localhost:3000 vision             # Vision AI only (fast)
/visual-qa http://localhost:3000 diff               # Pixel regression only
/visual-qa http://localhost:3000 a11y               # Accessibility only
/visual-qa http://localhost:3000 ocr                # OCR text check only
/visual-qa http://localhost:3000 full --baseline ./baselines  # Full with regression diff
```

## In Pipes

```bash
# Visual QA then ship
/pipe visual-qa http://localhost:3000 ?>> ship !>> fix

# Full dev flow: implement → visual QA → fix issues → ship
/pipe go *5 >> visual-qa http://localhost:3000 full ?>> pr !>> (fix >> visual-qa) *3?

# Compare staging vs production
/pipe visual-qa https://staging.app.com diff --baseline ./prod-screenshots >> approve >> deploy

# Accessibility-first workflow
/pipe hig >> visual-qa http://localhost:3000 a11y >> fix >> visual-qa a11y >> assert "0 a11y violations"

# Full pre-release visual QA
/pipe browser-test http://localhost:3000 >> visual-qa http://localhost:3000 full >> changelog >> pr
```

## Output

```
.luna/{project}/visual-qa/
  report.md                    # Unified report with all layers
  screenshots/                 # Captured screenshots (Layer 0)
    {page}/{viewport}.png
  vision/                      # Vision AI findings (Layer 1)
    {page}-analysis.json
  diffs/                       # Pixel diff overlays (Layer 2)
    {page}-diff.png
    {page}-diff-stats.json
  accessibility/               # WCAG scan results (Layer 3)
    {page}-a11y.json
    summary.json
  ocr/                         # Extracted text (Layer 4)
    {page}-text.json
  performance/                 # Perf metrics (Layer 5)
    {page}-metrics.json
  correlation/                 # Cross-layer findings (Layer 6)
    unified-findings.json
    priority-fixes.md
```

## Severity Classification

| Severity | Definition | Auto-fix? |
|----------|-----------|-----------|
| CRITICAL | Broken layout, missing content, a11y violation blocking users | Yes (3 attempts) |
| HIGH | Wrong brand, placeholder text, contrast failure, large regression | Yes (2 attempts) |
| MEDIUM | Minor layout shift, small diff, missing ARIA label | Suggest fix |
| LOW | Style inconsistency, minor spacing, non-blocking a11y info | Log only |
