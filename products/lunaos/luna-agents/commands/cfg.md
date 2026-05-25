---
name: cfg
displayName: Config (shortcut)
description: "Shortcut: Configure Luna plugin settings → /luna-config"
version: 1.0.0
category: config
agent: luna-config
parameters:
  - name: scope
    type: string
    description: Config scope or setting to change
    required: true
    prompt: true
---

# /cfg — Configuration

Shortcut for `/luna-config`.

Configure Luna plugin to connect with Claude Agent Platform.

## What it does

1. Set up LLM provider and model
2. Configure cloud connection
3. Manage project settings
4. Set output preferences

## Usage

```
/cfg
```
