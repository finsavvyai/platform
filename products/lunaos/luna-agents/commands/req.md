---
name: req
displayName: Requirements (shortcut)
description: "Shortcut: Analyze codebase and generate requirements → /luna-requirements"
version: 1.0.0
category: analysis
agent: luna-requirements-analyzer
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /req — Requirements Analysis

Shortcut for `/luna-requirements`.

Analyze the project codebase and generate a comprehensive requirements document.

## What it does

1. Scans codebase structure, dependencies, and patterns
2. Identifies functional and non-functional requirements
3. Generates `.luna/{project}/requirements.md`

## Usage

```
/req
```

Then enter scope when prompted (press ENTER for full project).

## Next

```
/des → /plan → /go → /rev
```
