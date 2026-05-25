---
name: des
displayName: Design (shortcut)
description: "Shortcut: Transform requirements into technical design → /luna-design"
version: 1.0.0
category: design
agent: luna-design-architect
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /des — Technical Design

Shortcut for `/luna-design`.

Transform requirements into a comprehensive technical design specification.

## What it does

1. Reads requirements from `.luna/{project}/requirements.md`
2. Creates architecture, data models, API contracts
3. Generates `.luna/{project}/design.md`

## Usage

```
/des
```

## Next

```
/plan → /go → /rev → /test
```
