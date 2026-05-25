---
name: mythos
displayName: Mythos Security (shortcut)
description: "Shortcut: AI security layer — prompt injection / jailbreak / exfil / lethal-trifecta defense -> /ll-mythos"
version: 1.0.0
category: security
shortcut_for: ll-mythos
---

# /mythos — AI Security Layer

Shortcut for `/ll-mythos`. Detects prompt injection, jailbreak patterns, exfiltration vectors, and the lethal trifecta. Installs immutable mythos principles into CLAUDE.md + runtime sanitizer.

```
/mythos                              # audit
/mythos --action install             # mythos + sanitizer
/mythos --action drill               # attack corpus
/mythos --strictness quarantine      # max paranoia
```
