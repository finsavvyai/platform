---
name: ll-fix
displayName: Luna Bug Fix
description: Systematic bug fix — reproduce, failing test, bisect, fix, verify, regression test
version: 1.0.0
category: debugging
agent: luna-code-review
parameters:
  - name: bug
    type: string
    description: Bug description or error message
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - reproduce_bug
  - write_failing_test
  - bisect_root_cause
  - implement_fix
  - verify_fix_passes
  - write_regression_test
  - run_full_suite
  - generate_fix_report
output:
  - .luna/{current-project}/fix-report.md
prerequisites: []
---

# Luna Bug Fix

Systematic bug fix workflow — no guessing, just science.

## What This Command Does

1. **Reproduce** — understand the bug, find the exact trigger
2. **Failing Test** — write a test that fails with the current bug
3. **Bisect** — trace the root cause through code flow
4. **Fix** — implement the minimal fix
5. **Verify** — confirm the failing test now passes
6. **Regression Test** — add edge case tests to prevent recurrence
7. **Full Suite** — run all tests to ensure no side effects
8. **Report** — document what broke, why, and how it was fixed

## Fix Protocol

```
Bug report → Reproduce → Write failing test
    ↓
Bisect root cause (read code, add logging, trace flow)
    ↓
Implement minimal fix (smallest change that fixes the bug)
    ↓
Verify: failing test now passes
    ↓
Add regression tests (edge cases, related scenarios)
    ↓
Run full test suite → All green → Done
```

## Usage

```
/fix "users can't log in after password reset — returns 401"
/fix "dashboard crashes when org has no team members"
```

## Rules

- Never fix without a failing test first
- Minimal fix — don't refactor while fixing
- Every fix gets a regression test
- Document the root cause in the fix report
