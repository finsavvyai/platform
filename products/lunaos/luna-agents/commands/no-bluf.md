---
name: no-bluf
displayName: No-Bluff Audit (shortcut)
description: "Shortcut: Detect AI bluffing in commits and docs, fix in closed loop -> /ll-no-bluf"
version: 1.0.0
category: quality
shortcut_for: ll-no-bluf
---

# /no-bluf — AI Honesty Auditor

Shortcut for `/ll-no-bluf`. Scans commits and docs, finds bluffs, fixes them in a loop.

```
/no-bluf                          # latest commits, interactive
/no-bluf 50 --mode auto-fix       # last 50, fix without prompts
```
