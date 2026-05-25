---
name: ll-deps
displayName: Luna Dependency Audit
description: Audit dependencies — outdated packages, vulnerabilities, unused deps, license check, upgrade plan
version: 1.0.0
category: quality
agent: luna-code-review
parameters:
  - name: action
    type: string
    description: Action (audit, update, cleanup, licenses, all)
    required: false
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - scan_dependencies
  - check_vulnerabilities
  - find_unused_deps
  - check_outdated
  - audit_licenses
  - generate_upgrade_plan
  - generate_deps_report
output:
  - .luna/{current-project}/deps-report.md
prerequisites: []
---

# Luna Dependency Audit

Keep dependencies secure, current, and minimal.

## What This Command Does

1. **Scan** — reads package.json, lock files, and import statements
2. **Vulnerabilities** — checks for known CVEs (npm audit + Snyk DB)
3. **Unused** — finds installed packages not imported anywhere
4. **Outdated** — lists packages with available updates
5. **Licenses** — checks for incompatible licenses (GPL in MIT project)
6. **Upgrade Plan** — prioritized list of safe upgrades with breaking change notes
7. **Report** — full dependency health scorecard

## Actions

| Action | What It Does |
|--------|-------------|
| `audit` | Vulnerability scan |
| `update` | Show available updates with risk level |
| `cleanup` | Find and remove unused dependencies |
| `licenses` | License compatibility check |
| `all` | Everything above |

## Usage

```
/deps                   # Full audit
/deps audit             # Vulnerabilities only
/deps cleanup           # Remove unused
/deps licenses          # License check
```

## Risk Levels

- **Safe** — patch update, no breaking changes
- **Low** — minor update, new features only
- **Medium** — major update, has migration guide
- **High** — major update, significant breaking changes
