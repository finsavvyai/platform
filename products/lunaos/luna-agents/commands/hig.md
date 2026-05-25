---
name: hig
displayName: Apple HIG Audit (shortcut)
description: "Shortcut: Apple Human Interface Guidelines compliance check → /luna-hig"
version: 1.0.0
category: design
agent: luna-hig
parameters:
  - name: scope
    type: string
    description: Component or page to audit
    required: true
    prompt: true
---

# /hig — Apple HIG Audit

Shortcut for `/luna-hig`.

Check your UI against Apple Human Interface Guidelines.

## What it does

1. Audits spacing, typography, color, layout
2. Checks accessibility (WCAG 2.1 AA)
3. Validates dark mode, motion, touch targets
4. Generates compliance report with fixes

## Usage

```
/hig
```
