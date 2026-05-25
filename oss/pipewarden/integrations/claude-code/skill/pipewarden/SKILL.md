---
name: pipewarden
description: |
  Security scanning for the code you (or Claude) are about to commit.
  Invoke before pushing, before opening a PR, or any time the user asks
  "is this safe?". Wraps the locally-installed `pipewarden` CLI.

  Trigger when the user says any of:
    - "scan this", "scan the diff", "/pw-scan"
    - "review for security", "/pw-review"
    - "fix the security findings", "/pw-fix"
    - "is this prompt-injection safe", "is this SQL safe"
    - asks about hard-coded secrets, leaked tokens, or unsafe code
allowed-tools: [Bash, Read, Write, Edit]
---

# PipeWarden — Claude Code skill

## What this skill does

You are using the **pipewarden** skill. PipeWarden is a local AppSec scanner that
detects secret leaks (13 patterns), heuristic security smells (5 categories),
OPA policy violations (22 default policies), hallucinated dependencies, and AI-
authored commit risk.

Your job in this skill is to run the right `pipewarden` subcommand for the
user's intent, parse the JSON output, and present the findings as inline
review comments — never silent.

## Pre-flight check

Before running anything, verify the CLI is installed:

```bash
command -v pipewarden >/dev/null 2>&1 || {
  echo "pipewarden not installed."
  echo "Install with:  curl -fsSL https://pipewarden.io/install | bash"
  echo "Or:           brew install finsavvyai/pipewarden/pipewarden"
  exit 1
}
```

If absent, surface those exact install commands and ask the user which path
they prefer. Do not silently `brew install` without explicit confirmation.

## Commands

### `/pw-scan` — Scan current working tree or a path

Default scan, JSON output for parsing:

```bash
pipewarden scan . --format=json
```

For a specific path:

```bash
pipewarden scan path/to/file.go --format=json
```

For only the staged diff:

```bash
pipewarden scan --staged --format=json
```

### `/pw-review` — Review the working diff for security

Equivalent to `git diff | pipewarden scan --stdin --format=json` but uses the
CLI's built-in diff mode so language detection works:

```bash
pipewarden review --base=main --format=json
```

### `/pw-fix` — Apply automated fixes for safe findings

Only acts on findings tagged `auto_fixable=true` (secret rotation
placeholders, dependency-version bumps with no breaking changes, OPA
rewrites). Always shows the diff first:

```bash
pipewarden fix --dry-run --format=json   # preview first
pipewarden fix --apply                   # apply after user OK
```

## Output handling

PipeWarden returns one JSON object per scan with a `findings` array. For each
finding render:

- `severity` (critical / high / medium / low / info) — colour-code in your
  reply (🔴 / 🟠 / 🟡 / 🔵 / ⚪).
- `category` — e.g. `secret_leak`, `dependency_cve`, `prompt_injection`.
- `title` + `description` — show both verbatim.
- `file:line` — clickable in the editor.
- `remediation` — the fix; this is what the user actually wants.
- `confidence` — when < 0.6, prefix with "Low confidence:".
- `ai_authored` — when true, prefix with "⚠ AI-authored commit".

## What to NEVER do

- Do not skip a finding because it looks like a false positive — surface
  every one with its confidence score, let the user decide.
- Do not run `pipewarden fix --apply` without showing the diff and getting
  explicit confirmation.
- Do not pipe `pipewarden scan` output into another tool that exfiltrates
  it. The default mode is local-only by design.
- Do not invoke this skill on every Claude turn — only when the user asks
  for a scan or when about to commit/push.

## Failure mode

If `pipewarden` exits non-zero with `exit code 64`, the CLI is misconfigured
(missing connection, expired token). Show the user how to fix:

```bash
pipewarden config show
pipewarden config set claude.api_key <key>
```
