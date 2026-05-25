---
name: ll-vision-pipeline
displayName: Luna Vision Pipeline
description: Master orchestrator — chains browser-test → visual-qa → visual-diff → a11y-scan → auto-fix loop across all vision MCP servers
version: 1.0.0
category: testing
agent: luna-vision-pipeline
parameters:
  - name: url
    type: string
    description: App URL to test (e.g., http://localhost:3000)
    required: true
    prompt: true
  - name: baseline
    type: string
    description: Path to baseline screenshots for regression diff (or "none" to skip diff layer)
    required: false
    default: none
  - name: fix
    type: boolean
    description: "Enable auto-fix loop (default: true)"
    required: false
    default: true
  - name: max_fix_rounds
    type: number
    description: "Max auto-fix retry rounds (default: 3)"
    required: false
    default: 3
workflow:
  - detect_and_launch
  - capture_all_screenshots
  - parallel_analysis
  - correlate_findings
  - auto_fix_loop
  - retest_and_verify
  - generate_master_report
output:
  - .luna/{current-project}/vision-pipeline/
  - .luna/{current-project}/vision-pipeline/report.md
prerequisites: []
mcp_servers:
  - zai-mcp-server
  - image-compare
  - accessibility-scanner
  - image-extractor
  - playwright
  - puppeteer
  - fetch
  - ruflo
---

# Luna Vision Pipeline — Master Orchestrator

The ultimate visual QA command. Chains **all vision MCP servers** in a single pipeline with auto-fix loop.

## Full Pipeline

```
/vision-pipeline http://localhost:3000
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: CAPTURE                                           │
│  Playwright: detect routes → screenshot all pages            │
│  Output: 4 viewports × N pages = screenshots/               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: PARALLEL ANALYSIS (all run simultaneously)         │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ zai-mcp      │ │ image-compare│ │ a11y-scanner │         │
│  │ Vision AI    │ │ Pixel Diff   │ │ WCAG axe-core│         │
│  │              │ │              │ │              │         │
│  │ • Layout     │ │ • vs baseline│ │ • Contrast   │         │
│  │ • Content    │ │ • Diff %     │ │ • ARIA       │         │
│  │ • Style      │ │ • Overlay    │ │ • Keyboard   │         │
│  │ • HIG        │ │ • Regression │ │ • Labels     │         │
│  │ • Brand      │ │   detection  │ │ • Headings   │         │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘         │
│         │                │                │                  │
│  ┌──────────────┐                                           │
│  │ image-extract│  (feeds screenshots into Claude Vision)    │
│  │ • OCR/text   │                                           │
│  │ • Typos      │                                           │
│  │ • Placeholders│                                          │
│  └──────┬───────┘                                           │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           ▼
���─────────────────────────────────────────────────────────────┐
│  PHASE 3: CORRELATE                                          │
│  Cross-reference findings from all 4 analysis layers         │
│  Deduplicate (same issue found by multiple layers)           │
│  Prioritize by combined severity score                       │
│  Map each finding to source file + component                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: AUTO-FIX LOOP (if enabled)                         │
│                                                              │
│  For each CRITICAL/HIGH finding:                             │
│    1. Read source component                                  │
│    2. Generate fix (max 100 lines)                           │
│    3. Apply fix                                              │
│    4. Re-capture screenshot                                  │
│    5. Re-analyze with same MCP layer                         │
│    6. If fixed → next issue                                  │
│    7. If not fixed → retry (max 3)                           │
│    8. If still broken → log as blocker                       │
│                                                              │
│  After all fixes:                                            │
│    Re-run FULL pipeline to verify no regressions             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 5: MASTER REPORT                                      │
│                                                              │
│  report.md — unified findings from all layers                │
│  ├── Executive summary (pass/fail, score /100)               │
│  ├── Per-page breakdown                                      │
│  │   ├── Vision AI findings                                  │
│  │   ├── Regression diff (if baseline provided)              │
│  │   ├── Accessibility violations                            │
│  │   └── OCR text issues                                     │
│  ├── Fixes applied (before/after)                            │
│  ├── Remaining blockers                                      │
│  └── Screenshot gallery                                      │
└─────────────────────────────────────────────────────────────┘
```

## Usage

```bash
# Full pipeline — all layers, auto-fix enabled
/vision-pipeline http://localhost:3000

# With regression baseline
/vision-pipeline http://localhost:3000 --baseline .luna/baselines/

# Analysis only, no auto-fix
/vision-pipeline http://localhost:3000 --fix false

# Limit fix rounds
/vision-pipeline http://localhost:3000 --max-fix-rounds 1
```

## In Pipes

```bash
# The ultimate pre-release check
/pipe vision-pipeline http://localhost:3000 --baseline .luna/baselines/ ?>> ship !>> "Visual QA failed"

# Dev loop: code → full visual QA → fix → ship
/pipe go *5 >> vision-pipeline http://localhost:3000 ?>> pr !>> (fix >> vision-pipeline) *2?

# Save baseline after successful QA
/pipe vision-pipeline http://localhost:3000 ?>> visual-diff save >> ship

# Compare environments
/pipe vision-pipeline https://staging.app.com --baseline ./prod-screenshots >> approve >> deploy
```

## Scoring

The pipeline produces a Visual QA Score (0-100):

| Component | Weight | What It Measures |
|-----------|--------|-----------------|
| Vision AI | 30% | Layout, content, style, HIG compliance |
| Regression | 20% | Pixel stability vs baseline |
| Accessibility | 30% | WCAG 2.1 AA compliance |
| Performance | 10% | Load times, Core Web Vitals |
| Text/OCR | 10% | Correct copy, no placeholders, no typos |

**Pass threshold**: >= 80/100 (configurable)

## Output

```
.luna/{project}/vision-pipeline/
  report.md                 # Master unified report
  score.json                # Visual QA score breakdown
  screenshots/              # All captured screenshots
  vision/                   # zai-mcp-server findings
  diffs/                    # image-compare overlays
  accessibility/            # axe-core results
  ocr/                      # Extracted text
  performance/              # Load time metrics
  correlation/              # Cross-layer unified findings
  fixes/                    # Applied fix diffs
    before/                 # Pre-fix screenshots
    after/                  # Post-fix screenshots
    {component}.diff
```

## MCP Server Orchestration

This command demonstrates Luna's multi-MCP architecture:

| Server | Role | Runs In |
|--------|------|---------|
| **playwright** (Anthropic) | Browser automation + screenshot capture | Phase 1 |
| **puppeteer** (MCP official) | Fallback browser automation + headless screenshots | Phase 1 |
| **zai-mcp-server** | AI vision analysis, UI-to-code, error diagnosis | Phase 2 (parallel) |
| **image-compare** | Pixel-perfect regression diff (Pixelmatch) | Phase 2 (parallel) |
| **accessibility-scanner** | WCAG 2.1 axe-core compliance | Phase 2 (parallel) |
| **image-extractor** | Feed screenshots to Claude Vision for OCR | Phase 2 (parallel) |
| **fetch** (MCP official) | Validate live URLs, fetch page content for text comparison | Phase 2 (parallel) |
| **ruflo** | Multi-agent swarm for parallel page analysis (313 tools) | Phase 2 (orchestration) |
| **git** (MCP official) | Diff analysis, identify changed components for targeted testing | Phase 0 (pre-capture) |
| **memory** (MCP official) | Persist findings across sessions, track regressions over time | Phase 5 (post-report) |
| **Claude** (orchestrator) | Correlate, auto-fix, report | Phase 3-5 |

**11 MCP servers** working as one. Each is a specialist. Together they see what no single tool can see alone.

## Ruflo Integration

When ruflo is enabled, Phase 2 upgrades from sequential analysis to **swarm coordination**:

```
ruflo swarm_init → spawn specialist agents
  ├── vision-agent (uses zai-mcp tools)
  ├── diff-agent (uses image-compare tools)
  ├── a11y-agent (uses accessibility-scanner tools)
  ├── content-agent (uses fetch + image-extractor tools)
  └── perf-agent (uses playwright metrics)

All agents analyze in parallel with consensus protocol
Results merged via ruflo's semantic routing
```

## Git-Aware Smart Testing

When git MCP is available, Phase 0 runs before capture:

```
git diff main...HEAD → identify changed files
  ├── Changed components → test those pages first
  ├── Changed styles → full visual regression
  ├── Changed routes → re-detect route map
  └── No changes → skip to baseline comparison
```
