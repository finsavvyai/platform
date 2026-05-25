---
name: drill
displayName: No-Bluff Drill (shortcut)
description: "Shortcut: Adversarial AI/dev bluff drill — score honesty, harden CLAUDE.md, loop -> /ll-drill"
version: 1.0.0
category: quality
shortcut_for: ll-drill
---

# /drill — No-Bluff Drill

Shortcut for `/ll-drill`. Adversarial bluff-temptation cycle. Generates scenarios, scores honesty, injects guardrails into CLAUDE.md, loops until threshold.

```
/drill                          # both, 5 rounds, 95% threshold
/drill --target ai --rounds 10  # AI only, more rounds
/drill --threshold 99           # tighter
```
