---
name: test
displayName: Test (shortcut)
description: "Shortcut: Create test suites and validate → /luna-test"
version: 1.0.0
category: quality
agent: luna-testing-validation
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /test — Test & Validate

Shortcut for `/luna-test`.

Create comprehensive test suites and validate against requirements.

## What it does

1. Generates unit, integration, and E2E tests
2. Runs test suites with coverage
3. Validates against requirements
4. Generates test report

## Usage

```
/test
```

## Next

```
/ship → /watch → /retro
```
