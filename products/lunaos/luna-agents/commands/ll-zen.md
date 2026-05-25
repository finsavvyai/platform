---
name: ll-zen
displayName: Luna Zen
description: One-command project health restoration — fix ALL issues across code, tests, security, a11y, performance, and deploy
version: 1.0.0
category: maintenance
agent: luna-task-executor
parameters:
  - name: scope
    type: string
    description: "Scope: all (default), code, tests, security, a11y, perf, deps"
    required: false
    default: all
  - name: aggressive
    type: boolean
    description: "Aggressive mode: auto-fix everything without asking (default: false)"
    required: false
    default: false
mcp_servers:
  - git
  - accessibility-scanner
  - zai-mcp-server
  - playwright
  - image-compare
  - fetch
  - sequential-thinking
  - memory
  - ruflo
---

# /zen — Restore Perfect Project Health

Your project accumulated tech debt, failing tests, security warnings, and accessibility issues? One command to fix everything.

## What /zen Does

```
/zen
  │
  ├── SCAN everything (parallel)
  │   ├── Linter violations
  │   ├── TypeScript errors
  │   ├── Failing tests
  │   ├── Security vulnerabilities
  │   ├── Accessibility violations
  │   ├── Performance regressions
  │   ├── Outdated dependencies
  │   ├── Dead code
  │   ├── Files over 200 lines
  │   └── Missing documentation
  │
  ├── PRIORITIZE by impact
  │   ├── Critical: security vulns, broken tests
  │   ├── High: a11y violations, type errors
  │   ├── Medium: lint warnings, perf issues
  │   └── Low: style inconsistencies, dead code
  │
  ├── FIX (ruflo swarm — parallel agents)
  │   ├── Agent 1: Fix security issues
  │   ├── Agent 2: Fix failing tests
  │   ├── Agent 3: Fix a11y violations
  │   ├── Agent 4: Update dependencies
  │   ├── Agent 5: Refactor oversized files
  │   ├── Agent 6: Remove dead code
  │   └── Agent 7: Fix TypeScript errors
  │
  ├── VERIFY all fixes
  │   ├── Full test suite passes
  │   ├── No new TypeScript errors
  │   ├── Security scan clean
  │   ├── A11y scan clean
  │   └── Visual regression check
  │
  └── REPORT
      ├── Issues found: N
      ├── Issues fixed: M
      ├── Issues remaining: N-M (with reasons)
      ├── Before/after health score
      └── Commit per fix category
```

## Usage

```bash
/zen                          # Fix everything
/zen --scope tests            # Fix all failing tests only
/zen --scope security         # Fix all security issues only
/zen --scope deps             # Update all dependencies safely
/zen --aggressive             # Fix everything without asking
```

## In Pipes

```bash
/pipe zen >> test >> browser-test >> launch production
/pipe zen --aggressive >> pulse >> assert $pulse.score >= 90
/pipe @before:zen go *10 >> ship    # Zen before every coding session
```
