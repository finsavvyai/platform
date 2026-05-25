---
name: workflow
displayName: Workflow Manager (shortcut)
description: "Shortcut: Save, load, list named pipelines -> /ll-workflow"
version: 1.0.0
category: workflow
shortcut_for: ll-workflow
---

# /workflow — Workflow Manager

Shortcut for `/ll-workflow`. Save, load, and share reusable pipeline workflows.

```
/workflow save quality-gate "(rev ~~ test ~~ sec)"
/workflow list
/workflow templates
/pipe run quality-gate ?>> ship
```
