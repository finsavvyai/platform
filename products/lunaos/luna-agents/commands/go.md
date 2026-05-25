---
name: go
displayName: Execute (shortcut)
description: "Shortcut: Implement next task from the plan → /luna-execute"
version: 1.0.0
category: implementation
agent: luna-task-executor
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /go — Execute Next Task

Shortcut for `/luna-execute`.

Picks up the next uncompleted task from your implementation plan and builds it.

## What it does

1. Finds next `[ ]` task in implementation plan
2. Implements code following design specs
3. Writes tests, marks task `[x]`, commits

## Usage

```
/go        # implement next task
/go        # repeat until all done
/go        # keep going
```

Run it repeatedly — each call completes one task.

## Next

```
/rev → /test → /ship
```
