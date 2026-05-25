---
name: context-compress
displayName: Context Compress (shortcut)
description: "Shortcut: Deterministic LLM prompt compressor — 30-60% token cut with zero ML -> /ll-context-compress"
version: 1.0.0
category: performance
shortcut_for: ll-context-compress
---

# /context-compress — Deterministic Prompt Compressor

Shortcut for `/ll-context-compress`. Slot-based compression, stacks with `/cache-tune` for compounded savings.

```
/context-compress                       # audit
/context-compress . --mode apply        # install compressor
/context-compress . --mode benchmark    # measure
```
