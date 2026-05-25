---
name: retro
displayName: Post-Launch Review (shortcut)
description: "Shortcut: Analyze launch metrics and recommend improvements → /luna-postlaunch"
version: 1.0.0
category: analysis
agent: luna-post-launch-review
parameters:
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
---

# /retro — Post-Launch Review

Shortcut for `/luna-postlaunch`.

Analyze launch metrics and provide recommendations for improvement.

## What it does

1. Reviews launch metrics and KPIs
2. Analyzes user feedback and errors
3. Identifies optimization opportunities
4. Generates improvement recommendations

## Usage

```
/retro
```
