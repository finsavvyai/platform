---
name: dock
displayName: Dockerize (shortcut)
description: "Shortcut: Containerize your app → /luna-dockerize"
version: 1.0.0
category: deployment
agent: luna-docker
parameters:
  - name: scope
    type: string
    description: Project or service to dockerize
    required: true
    prompt: true
---

# /dock — Dockerize

Shortcut for `/luna-dockerize`.

Generate Dockerfile, docker-compose, and container configs for your project.

## Usage

```
/dock
```
