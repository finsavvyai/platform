---
name: vr
displayName: Visual Regression (shortcut)
description: "Shortcut: Compare screenshots before/after changes -> /ll-visual-regression"
version: 1.0.0
category: testing
shortcut_for: ll-visual-regression
---

# /vr — Visual Regression

Shortcut for `/ll-visual-regression`. Detect visual regressions with screenshot diffs.

```
/vr http://localhost:3000
/vr http://localhost:3000 branch:main
/pipe refactor >> vr http://localhost:3000 ?>> ship
```
