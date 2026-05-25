---
name: ship
displayName: Deploy (shortcut)
description: "Shortcut: Deploy to staging and production → /luna-deploy"
version: 1.0.0
category: deployment
agent: luna-deployment
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /ship — Deploy

Shortcut for `/luna-deploy`.

Deploy your application to staging and production environments.

## What it does

1. Validates build and tests pass
2. Deploys to staging
3. Runs smoke tests
4. Promotes to production

## Usage

```
/ship
```

## Next

```
/watch → /retro
```
