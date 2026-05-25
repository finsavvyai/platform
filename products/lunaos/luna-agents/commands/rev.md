---
name: rev
displayName: Code Review (shortcut)
description: "Shortcut: Comprehensive code review → /luna-review"
version: 1.0.0
category: quality
agent: luna-code-review
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /rev — Code Review

Shortcut for `/luna-review`.

Review completed code for quality, security, and requirement compliance.

## What it does

1. Reviews all completed tasks
2. Checks quality, security, performance
3. Validates against requirements
4. Generates `.luna/{project}/code-review-report.md`

## Usage

```
/rev
```

## Next

```
/test → /ship → /watch
```
