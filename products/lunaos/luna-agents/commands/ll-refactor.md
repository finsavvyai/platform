---
name: ll-refactor
displayName: Luna Refactor
description: Smart refactoring — split files, extract shared logic, rename across codebase, enforce size limits
version: 1.0.0
category: quality
agent: luna-code-review
parameters:
  - name: target
    type: string
    description: File path, directory, or refactoring goal
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - scan_for_violations
  - identify_refactoring_targets
  - plan_refactoring_steps
  - execute_splits_and_extractions
  - update_imports_across_codebase
  - verify_no_regressions
  - generate_refactor_report
output:
  - .luna/{current-project}/refactor-report.md
prerequisites: []
---

# Luna Refactor

Intelligent refactoring that enforces code quality rules.

## What This Command Does

1. **Scan** — finds files exceeding 100 lines, duplicated logic, god components
2. **Identify** — ranks refactoring targets by impact
3. **Plan** — creates step-by-step refactoring plan
4. **Execute** — splits files, extracts shared logic, renames consistently
5. **Update** — fixes all imports and references across codebase
6. **Verify** — runs tests to ensure no regressions
7. **Report** — documents what changed and why

## Refactoring Operations

| Operation | Trigger |
|-----------|---------|
| **File Split** | File exceeds 100 lines |
| **Extract Hook** | Duplicated stateful logic in components |
| **Extract Util** | Same helper function in 3+ files |
| **Extract Component** | JSX block repeated or too complex |
| **Extract Type** | Inline types used in multiple files |
| **Rename** | Inconsistent naming across codebase |
| **Dead Code Removal** | Unused exports, unreachable branches |

## Usage

```
/refactor src/components/Dashboard.tsx     # Split specific file
/refactor src/                             # Scan entire directory
/refactor "extract shared auth logic"      # Goal-based refactoring
```

## Rules

- All tests must pass before and after refactoring
- No behavior changes — refactoring is structure-only
- Every split file stays under 100 lines
- Imports updated automatically across the entire codebase
