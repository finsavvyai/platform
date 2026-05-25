---
name: sec
displayName: Security Review (shortcut)
description: "Shortcut: OWASP security audit → /luna-365-secure"
version: 1.0.0
category: security
agent: luna-auth
parameters:
  - name: scope
    type: string
    description: Project or feature to audit
    required: true
    prompt: true
---

# /sec — Security Audit

Shortcut for `/luna-365-secure`.

Run OWASP Top 10 security analysis on your codebase.

## What it does

1. Input validation and injection checks
2. Auth and session security
3. Dependency vulnerability scan
4. Secret detection
5. Generates security report

## Usage

```
/sec
```
