---
name: ll-sec-precommit
displayName: Luna Security — Pre-Commit Bundle
description: Fast (<5s) staged-changes scan run by git pre-commit hook. Catches secrets + obvious lint-level security issues before commit.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: staged_only
    type: boolean
    default: true
workflow:
  - run_ll_sec_secrets --scope staged
  - run_eslint_security_on_staged
  - run_hadolint_on_changed_dockerfiles
  - severity_gate
output:
  - .luna/{current-project}/security/precommit-summary.md
---

# Luna Security — Pre-Commit Bundle

The first line of defense. Runs in <5s on staged changes, blocks commit if it finds Critical/High issues.

## What Runs

1. **`ll-sec-secrets --scope staged`** — gitleaks on `git diff --cached`.
2. **eslint-plugin-security** — on staged JS/TS files only.
3. **hadolint** — on staged `Dockerfile*`.

DAST/SAST/deps deferred to `ll-sec-pr` (slower).

## Install

```bash
/ll-sec-lifecycle install --pre-commit
```

This wires `.husky/pre-commit` to invoke this command.

## Usage (manual)

```bash
/ll-sec-precommit
git commit -m "..."   # or rely on hook
```

## Pipe

Rare standalone — used inside hook. But:
```
/pipe ll-sec-precommit >> commit
```

## Severity Gate

Hard fail on:
- any verified secret
- eslint security/* ERROR
- hadolint DL-level ERROR

## Bypass (use sparingly)

`git commit --no-verify` skips the hook. Logged to `.luna/{project}/security/bypass.log` for audit.

## Notes

- Designed to never block legit work — runs only on staged hunks, not full repo.
- Total time budget: 5 seconds. If exceeded, switch to `ll-sec-pr` (CI) instead.
