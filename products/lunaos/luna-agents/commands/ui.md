---
name: ui
displayName: UI Convert (shortcut)
description: "Shortcut: Convert UI to Apple HIG + modern design → /luna-ui-convert"
version: 1.0.0
category: design
agent: luna-ui-fix
parameters:
  - name: scope
    type: string
    description: Component or page to convert
    required: true
    prompt: true
---

# /ui — UI Convert

Shortcut for `/luna-ui-convert`.

Convert your UI to Apple HIG-compliant modern design.

## What it does

1. Analyzes current component/page
2. Applies Apple HIG spacing, typography, colors
3. Adds dark mode, accessibility, animations
4. Implements responsive layout

## Usage

```
/ui
```
