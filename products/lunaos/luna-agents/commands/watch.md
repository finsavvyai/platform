---
name: watch
displayName: Monitor (shortcut)
description: "Shortcut: Set up monitoring and alerts → /luna-monitor"
version: 1.0.0
category: operations
agent: luna-monitoring-observability
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /watch — Monitor

Shortcut for `/luna-monitor`.

Set up comprehensive monitoring, dashboards, and alerts.

## What it does

1. Configures health checks and uptime monitoring
2. Sets up error tracking and alerting
3. Creates performance dashboards
4. Generates monitoring runbook

## Usage

```
/watch
```

## Next

```
/retro
```
