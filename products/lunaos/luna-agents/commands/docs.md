---
name: docs
displayName: Documentation (shortcut)
description: "Shortcut: Generate user, developer, and API docs → /luna-docs"
version: 1.0.0
category: documentation
agent: luna-documentation
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /docs — Generate Documentation

Shortcut for `/luna-docs`.

Create comprehensive user, developer, and API documentation.

## What it does

1. Scans codebase and existing docs
2. Generates API reference docs
3. Creates user guides and tutorials
4. Outputs developer setup instructions

## Usage

```
/docs
```
