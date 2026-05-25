---
name: heal
displayName: Self-Heal (shortcut)
description: "Shortcut: Test, screenshot, auto-fix in a loop until healthy -> /ll-heal"
version: 1.0.0
category: automation
shortcut_for: ll-heal
---

# /heal — Self-Healing App

Shortcut for `/ll-heal`. Continuously test, screenshot, fix, retest until app is healthy.

```
/heal http://localhost:3000
/pipe go *5 >> heal http://localhost:3000 ?>> ship
```
