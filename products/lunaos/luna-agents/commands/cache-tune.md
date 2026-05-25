---
name: cache-tune
displayName: Cache Tune (shortcut)
description: "Shortcut: Anthropic prompt cache optimizer — TTL tuning, keepalive, savings report -> /ll-cache-tune"
version: 1.0.0
category: performance
shortcut_for: ll-cache-tune
---

# /cache-tune — Anthropic Prompt Cache Optimizer

Shortcut for `/ll-cache-tune`. Tunes TTL (5m/1h), places breakpoints, installs keepalive, reports savings.

```
/cache-tune                  # audit
/cache-tune tune --ttl 1h    # apply
/cache-tune report           # see $ saved
```
