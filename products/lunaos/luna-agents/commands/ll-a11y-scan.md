---
name: ll-a11y-scan
displayName: Luna Accessibility Scan
description: Full WCAG 2.1 compliance scan using accessibility-scanner MCP — axe-core powered, all pages, all viewports
version: 1.0.0
category: testing
agent: luna-a11y-scan
parameters:
  - name: url
    type: string
    description: App URL to scan (e.g., http://localhost:3000)
    required: true
    prompt: true
  - name: level
    type: string
    description: "WCAG level: A, AA (default), AAA"
    required: false
    default: AA
  - name: scope
    type: string
    description: "Scope: all (every route), public (no auth), single (one URL only)"
    required: false
    default: all
workflow:
  - detect_routes
  - scan_each_route
  - aggregate_violations
  - cross_reference_with_vision
  - generate_a11y_report
output:
  - .luna/{current-project}/a11y/
  - .luna/{current-project}/a11y/report.md
prerequisites: []
mcp_servers:
  - accessibility-scanner
  - zai-mcp-server
---

# Luna Accessibility Scan — WCAG Compliance Pipeline

Full accessibility audit combining **axe-core rule engine** (accessibility-scanner MCP) with **Vision AI** (zai-mcp-server) for issues that rule engines miss.

## Two-Layer Architecture

```
        ┌───────────────────────────────────┐
        │   /a11y-scan <url> [level] [scope] │
        └──────────────────┬────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌──────────────────┐     ┌──────────────────┐
    │  Layer 1: RULES   │     │  Layer 2: VISION  │
    │  accessibility-   │     │  zai-mcp-server   │
    │  scanner MCP      │     │  analyze_image    │
    │  (axe-core)       │     │  (AI perception)  │
    │                   │     │                   │
    │  Catches:         │     │  Catches:         │
    │  - Missing ARIA   │     │  - Visual clutter │
    │  - Bad contrast   │     │  - Tiny touch     │
    │    ratios         │     │    targets        │
    │  - Missing labels │     │  - Unclear focus  │
    │  - Heading order  │     │    indicators     │
    │  - Role issues    │     │  - Poor hierarchy │
    │  - Form errors    │     │  - Color-only     │
    │                   │     │    info conveyed   │
    └────────┬─────────┘     └────────┬──────────┘
             │                        │
             └───────────┬────────────┘
                         ▼
              ┌──────────────────────┐
              │  Merged A11y Report   │
              │  Rule violations +    │
              │  Visual perception    │
              │  findings             │
              └──────────────────────┘
```

## What Gets Checked

### Rule-Based (axe-core via accessibility-scanner MCP)
| Category | Checks |
|----------|--------|
| Perceivable | Color contrast (4.5:1 AA, 3:1 large), alt text, captions |
| Operable | Keyboard nav, focus order, no keyboard traps, skip links |
| Understandable | Form labels, error identification, consistent nav |
| Robust | Valid HTML, ARIA roles/properties/states, name-role-value |

### AI-Powered (zai-mcp-server Vision)
| Category | Checks |
|----------|--------|
| Visual hierarchy | Heading sizes match importance, clear sections |
| Touch targets | Buttons/links large enough (44x44px minimum) |
| Focus indicators | Visible focus rings on interactive elements |
| Color independence | Information not conveyed by color alone |
| Cognitive load | Not too many actions per screen, clear flow |
| Motion | No auto-playing animations, reduced motion respect |

## Usage

```bash
/a11y-scan http://localhost:3000                  # Scan all routes, WCAG AA
/a11y-scan http://localhost:3000 AAA              # Strict AAA level
/a11y-scan http://localhost:3000 AA public        # Public pages only
/a11y-scan http://localhost:3000/pricing AA single # Single page
```

## In Pipes

```bash
# A11y gate before PR
/pipe a11y-scan http://localhost:3000 >> assert "0 critical a11y" >> pr

# Fix loop: scan → fix → rescan
/pipe a11y-scan http://localhost:3000 !>> (fix >> a11y-scan http://localhost:3000) *3?

# Full HIG + A11y workflow
/pipe hig >> a11y-scan http://localhost:3000 >> visual-qa http://localhost:3000 >> pr

# Pre-launch compliance
/pipe a11y-scan http://localhost:3000 AAA >> browser-test http://localhost:3000 >> visual-diff save >> ship
```

## Output

```
.luna/{project}/a11y/
  report.md              # Human-readable a11y report
  violations/            # Per-page violation details
    {page}-violations.json
  summary.json           # Aggregate stats (total violations by severity)
  fixes/                 # Suggested code fixes
    {component}-fix.md
```

## Severity Mapping

| axe-core Impact | WCAG Level | Luna Severity | Action |
|----------------|------------|---------------|--------|
| critical | A | CRITICAL | Auto-fix, blocks release |
| serious | AA | HIGH | Auto-fix, blocks PR |
| moderate | AA | MEDIUM | Suggest fix |
| minor | AAA | LOW | Log for improvement |
