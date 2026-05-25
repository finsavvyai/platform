---
name: ll-feature
displayName: Luna Feature Autopilot
description: Full feature lifecycle — plan, implement, test, review, fix in a loop until complete
version: 1.0.0
category: workflow
agent: luna-task-executor
parameters:
  - name: feature
    type: string
    description: Feature description in natural language
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - analyze_feature_request
  - break_into_tasks
  - implement_tasks_parallel
  - write_unit_tests
  - write_playwright_e2e
  - run_all_tests
  - code_review
  - security_scan
  - fix_issues_loop
  - generate_pr
output:
  - .luna/{current-project}/{feature}/feature-report.md
prerequisites: []
---

# Luna Feature Autopilot

End-to-end feature implementation that loops until everything passes.

## What This Command Does

1. **Plan** — breaks your feature description into ordered tasks
2. **Implement** — writes code for each task (max 100 lines/file)
3. **Unit Test** — writes tests for every function (100% coverage)
4. **Playwright E2E** — writes browser flow test for the feature
5. **Review** — runs code review, lint, type-check
6. **Security Scan** — checks for vulnerabilities
7. **Fix Loop** — if anything fails, fixes and re-runs until green
8. **PR Ready** — generates PR with summary and test plan

## Loop Logic

```
implement → test → review → scan
    ↑                        ↓
    └──── fix if failed ─────┘

Exit when: all tests pass + review clean + scan clean
Max iterations: 5 (then report blockers)
```

## Usage

```
/feature "add team billing page with Stripe integration"
```

## Parallel Execution

Where possible, tasks run in parallel:
- Independent components implemented simultaneously
- Unit tests written alongside implementation
- Lint + type-check + security scan run concurrently
- Only sequential when tasks have dependencies

## Output

- All source files (max 100 lines each)
- Unit test files (100% coverage)
- Playwright e2e test file
- `.luna/{project}/{feature}/feature-report.md`
