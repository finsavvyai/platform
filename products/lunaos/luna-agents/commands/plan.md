---
name: plan
displayName: Plan (shortcut)
description: "Shortcut: Break design into ordered implementation tasks → /luna-plan"
version: 1.0.0
category: planning
agent: luna-task-planner
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /plan — Implementation Plan

Shortcut for `/luna-plan`.

Break the technical design into ordered, actionable implementation tasks.

## What it does

1. Reads design from `.luna/{project}/design.md`
2. Creates task breakdown with dependencies
3. Generates `.luna/{project}/implementation-plan.md`

## Usage

```
/plan
```

## Next

```
/go → /rev → /test → /ship
```
