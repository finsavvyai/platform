---
name: ll-perf
displayName: Luna Performance Profiler
description: Performance audit — bundle analysis, Core Web Vitals, query optimization, memory leaks
version: 1.0.0
category: quality
agent: luna-monitoring-observability
parameters:
  - name: target
    type: string
    description: What to profile (bundle, queries, api, frontend, all)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - analyze_bundle_size
  - profile_api_response_times
  - analyze_database_queries
  - check_core_web_vitals
  - detect_memory_leaks
  - identify_render_bottlenecks
  - generate_optimization_plan
  - generate_perf_report
output:
  - .luna/{current-project}/perf-report.md
prerequisites: []
---

# Luna Performance Profiler

Find and fix performance bottlenecks across your entire stack.

## What This Command Does

1. **Bundle** — analyzes JS bundle size, tree-shaking, code splitting
2. **API** — profiles response times, identifies slow endpoints
3. **Database** — finds N+1 queries, missing indexes, slow queries
4. **Web Vitals** — checks LCP, FID, CLS, TTFB, INP
5. **Memory** — detects leaks in components, event listeners, closures
6. **Rendering** — identifies unnecessary re-renders, large component trees
7. **Optimize** — generates specific code changes to fix each issue
8. **Report** — performance scorecard with before/after metrics

## Profiles

| Profile | What It Checks |
|---------|---------------|
| `bundle` | JS/CSS size, chunks, tree-shaking, dynamic imports |
| `queries` | SQL execution plans, N+1, missing indexes |
| `api` | Response times, payload sizes, caching headers |
| `frontend` | Re-renders, hydration, lazy loading, images |
| `all` | Everything above |

## Usage

```
/perf                    # Full audit
/perf bundle             # Bundle size only
/perf queries            # Database queries only
/perf api                # API response times
```
