---
name: ll-perf-trace
displayName: Luna Perf Trace
description: Performance tracing with Perfetto — capture Chrome traces, analyze Core Web Vitals, SQL-based trace querying
version: 1.0.0
category: performance
agent: luna-task-executor
parameters:
  - name: url
    type: string
    description: URL to trace (e.g. http://localhost:3000)
    required: true
    prompt: true
  - name: duration
    type: string
    description: "Trace duration (default: 10s)"
    required: false
    default: "10s"
  - name: metrics
    type: string
    description: "Metrics to capture: all, lcp, fid, cls, layout, paint, scripting (default: all)"
    required: false
    default: all
mcp_servers:
  - memory
  - git
  - sequential-thinking
prerequisites:
  - name: playwright
    check: "npx playwright --version"
    install: "npm install -D @playwright/test && npx playwright install chromium"
    optional: false
---

# /perf-trace — Chrome Performance Tracing with Perfetto

Capture Chrome DevTools Protocol traces during browser sessions and Playwright tests. Analyze with Perfetto UI for deep performance insights. SQL-based trace querying for automated performance gates.

## What It Does

```
/perf-trace http://localhost:3000
    │
    ├── LAUNCH: Headless Chromium with tracing enabled
    │   ├── Enable Chrome DevTools Protocol
    │   ├── Start trace categories (rendering, scripting, painting)
    │   └── Navigate to target URL
    │
    ├── CAPTURE (duration: 10s default)
    │   ├── Page load timeline
    │   ├── JavaScript execution profiling
    │   ├── Layout shifts (CLS)
    │   ├── Largest Contentful Paint (LCP)
    │   ├── First Input Delay (FID)
    │   ├── Long tasks (>50ms)
    │   ├── Network waterfall
    │   └── Memory allocations
    │
    ├── ANALYZE
    │   ├── Parse trace into Perfetto format
    │   ├── Run SQL queries against trace data
    │   ├── Extract Core Web Vitals scores
    │   ├── Identify performance bottlenecks
    │   └── Generate recommendations
    │
    └── OUTPUT
        ├── .perfetto-trace file (open in ui.perfetto.dev)
        ├── Performance report (markdown)
        └── Pass/fail against thresholds
```

## How It Works

1. **CDP Tracing**: Uses Chrome DevTools Protocol to capture granular traces
2. **Perfetto format**: Outputs standard `.perfetto-trace` files
3. **SQL queries**: Query trace data with SQL for automated checks
4. **Web Vitals**: Extracts LCP, FID, CLS, TTFB, INP metrics
5. **Thresholds**: Configurable pass/fail gates for CI integration

## Core Web Vitals Thresholds

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| LCP | < 2.5s | 2.5-4.0s | > 4.0s |
| FID | < 100ms | 100-300ms | > 300ms |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |
| TTFB | < 800ms | 800-1800ms | > 1800ms |
| INP | < 200ms | 200-500ms | > 500ms |

## Usage

```bash
/perf-trace http://localhost:3000                            # Full trace, 10s
/perf-trace http://localhost:3000 --duration 30s             # Longer capture
/perf-trace http://localhost:3000 --metrics lcp,cls          # Specific metrics
/perf-trace http://localhost:3000/dashboard --metrics all    # Dashboard page
```

## Use Cases

| Use Case | Command |
|----------|---------|
| Find slow pages | `/perf-trace http://localhost:3000` |
| Detect layout shifts | `/perf-trace $url --metrics cls` |
| Measure LCP | `/perf-trace $url --metrics lcp` |
| Profile agent execution | `/perf-trace $url --duration 60s` |
| CI performance gate | `/perf-trace $url >> assert perf` |

## Output Structure

```
perf-traces/
├── trace-2026-04-07.perfetto-trace   # Open in ui.perfetto.dev
├── report.md                          # Performance summary
├── vitals.json                        # Core Web Vitals data
└── screenshots/                       # Key frames
    ├── lcp-element.png
    └── layout-shift.png
```

## SQL Trace Queries

```sql
-- Find long tasks
SELECT name, dur/1e6 as ms FROM slice WHERE dur > 50000000;

-- Layout shifts
SELECT ts, value FROM counter WHERE name = 'LayoutShift';

-- JavaScript execution time
SELECT SUM(dur)/1e6 as total_ms FROM slice WHERE cat = 'v8';
```

## In Pipes

```bash
/pipe perf-trace $url >> assert "lcp < 2500" >> ship              # Gate deploy
/pipe flow-record "user flow" >> perf-trace >> fix >> perf-trace   # Fix loop
/pipe perf-trace $url >> ghost blog "Performance Report"           # Blog post
/pipe heal >> perf-trace $url >> assert perf >> ship               # Full check
```

## Reference

- Perfetto: https://github.com/google/perfetto
- Perfetto UI: https://ui.perfetto.dev
- Web Vitals: https://web.dev/vitals/
