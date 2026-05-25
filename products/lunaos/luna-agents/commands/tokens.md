---
name: tokens
displayName: Design Tokens (shortcut)
description: "Shortcut: Multi-brand design token engine — Style Dictionary, CSS vars, Tailwind, Figma, iOS, Android -> /ll-tokens"
version: 1.0.0
category: design
shortcut_for: ll-tokens
---

# /tokens — Multi-Brand Token Engine

Shortcut for `/ll-tokens`. One source of truth, many platforms. Light/dark/contrast variants per brand. Figma two-way sync.

```
/tokens                                  # init default brand
/tokens --action add-brand dark
/tokens --action sync-figma              # push to Figma
/tokens --action export --targets all    # rebuild all platforms
```
