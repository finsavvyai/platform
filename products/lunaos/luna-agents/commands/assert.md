---
name: assert
displayName: Assert (shortcut)
description: "Shortcut: Validate project constraints -> /ll-assert"
version: 1.0.0
category: quality
shortcut_for: ll-assert
---

# /assert — Project Assertions

Shortcut for `/ll-assert`. Validate file size, coverage, security, accessibility thresholds.

```
/assert all
/pipe go >> assert files.max_lines <= 100 >> assert test.coverage >= 90 >> ship
```
