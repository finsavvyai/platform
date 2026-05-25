---
name: ll-flaky
displayName: Luna Flaky Test Detector
description: Detect flaky tests by running them under stress — N iterations, failure pattern analysis, timing capture
version: 1.0.0
category: testing
agent: luna-task-executor
parameters:
  - name: command
    type: string
    description: "Test command to stress-run (e.g. \"npm test\", \"npx vitest\")"
    required: true
    prompt: true
  - name: runs
    type: number
    description: "Number of iterations to run (default: 20)"
    required: false
    default: 20
  - name: parallel
    type: number
    description: "Max parallel test runs (default: 4)"
    required: false
    default: 4
mcp_servers:
  - memory
  - git
  - sequential-thinking
prerequisites:
  - name: test-runner
    check: "npm test --help 2>/dev/null || npx vitest --help 2>/dev/null"
    install: "Ensure your test runner is configured (jest, vitest, playwright)"
    optional: false
---

# /flaky — Detect Flaky Tests Under Stress

Run your test suite N times (default 20) in parallel and report which tests fail intermittently. Captures failure patterns, timing distributions, and identifies the root causes of flakiness.

## What It Does

```
/flaky "npm test"
    │
    ├── CONFIGURE
    │   ├── Parse test command
    │   ├── Set iteration count (default: 20)
    │   ├── Set parallelism (default: 4)
    │   └── Isolate test environment per run
    │
    ├── EXECUTE (20 runs, 4 parallel)
    │   ├── Run 1:  PASS  (2.3s)
    │   ├── Run 2:  PASS  (2.1s)
    │   ├── Run 3:  FAIL  auth.test.ts:42  (2.8s)
    │   ├── Run 4:  PASS  (2.2s)
    │   ├── ...
    │   └── Run 20: PASS  (2.4s)
    │
    ├── ANALYZE
    │   ├── Group failures by test name
    │   ├── Calculate flakiness rate per test
    │   ├── Identify timing patterns (slow = flaky?)
    │   ├── Detect common root causes:
    │   │   ├── Race conditions
    │   │   ├── Timing-dependent assertions
    │   │   ├── Shared mutable state
    │   │   ├── Network dependency
    │   │   └── Port conflicts
    │   └── Rank by impact (frequency x suite size)
    │
    └── REPORT
        ├── Flaky test list with failure rates
        ├── Suggested fixes per test
        ├── Timing distribution graph
        └── Overall suite reliability score
```

## How It Works

1. **Parallel execution**: Runs your test command N times with M parallelism
2. **Isolation**: Each run gets a clean environment (temp dirs, ports)
3. **Pattern matching**: Groups failures by test name and error message
4. **Root cause analysis**: Classifies flakiness type based on failure patterns
5. **Scoring**: Calculates reliability score (passes / total runs per test)

## Usage

```bash
/flaky "npm test"                                    # Default: 20 runs, 4 parallel
/flaky "npm test" --runs 50                          # More iterations for confidence
/flaky "npx vitest run" --parallel 8                 # Higher parallelism
/flaky "npx playwright test" --runs 10 --parallel 2  # E2E tests (heavier)
```

## Use Cases

| Use Case | Command |
|----------|---------|
| CI reliability | `/flaky "npm test" --runs 50` |
| Pre-merge validation | `/flaky "npm test -- --changedSince main"` |
| Test suite health | `/flaky "npm test" --runs 100` |
| E2E stability | `/flaky "npx playwright test" --runs 10` |
| Specific file | `/flaky "npx vitest run src/auth.test.ts" --runs 30` |

## Output Structure

```
flaky-report/
├── report.md              # Full flaky test report
├── results.json           # Raw run data
├── summary.json           # Flakiness scores
│   {
│     "total_runs": 20,
│     "suite_pass_rate": "95%",
│     "flaky_tests": [
│       {
│         "name": "auth.test.ts > should refresh token",
│         "pass_rate": "85%",
│         "failures": 3,
│         "cause": "race_condition",
│         "fix": "Add await before token check"
│       }
│     ]
│   }
└── timing/
    └── distribution.json  # Per-test timing data
```

## Flakiness Classification

| Type | Pattern | Fix Strategy |
|------|---------|-------------|
| Race condition | Random failures, timing varies | Add proper awaits, locks |
| Shared state | Fails when run in parallel | Isolate test state |
| Timing | Fails on slow machines | Use retries, increase timeouts |
| Network | Fails intermittently | Mock external calls |
| Port conflict | Fails in parallel | Use random ports |

## In Pipes

```bash
/pipe flaky "npm test" >> fix >> flaky "npm test" >> assert "flaky == 0"
/pipe flaky "npm test" >> ghost blog "Fixing Flaky Tests"
/pipe test >> flaky "npm test" --runs 50 >> guard >> ship
/pipe flaky "npx playwright test" >> heal >> flaky >> ship
```

## Reference

- Inspired by: https://github.com/bradfitz/flakestress
- Jest: `--forceExit --detectOpenHandles` flags help identify leaks
- Vitest: `--reporter=json` for machine-readable output
