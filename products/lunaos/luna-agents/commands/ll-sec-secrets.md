---
name: ll-sec-secrets
displayName: Luna Security — Secret Scan
description: Detect leaked secrets in source, history, and staged changes using gitleaks + trufflehog (verified)
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target
    type: string
    description: Path or git ref to scan (default = repo root + full history)
    required: false
    default: .
  - name: scope
    type: enum
    values: [staged, working, history, all]
    default: all
  - name: strict
    type: boolean
    default: true
    description: Exit non-zero on any finding
workflow:
  - install_tools_lazy
  - run_gitleaks
  - run_trufflehog_verified
  - dedupe_findings
  - emit_sarif
  - severity_gate
output:
  - .luna/{current-project}/security/raw/secrets-gitleaks.sarif
  - .luna/{current-project}/security/raw/secrets-trufflehog.json
  - .luna/{current-project}/security/secrets-summary.md
---

# Luna Security — Secret Scan

Hunts API keys, credentials, tokens, private keys leaked in code or git history.

## Tools (open source)

| Tool | Repo | License | Why |
|------|------|---------|-----|
| **gitleaks** | github.com/gitleaks/gitleaks | MIT | Fast regex + entropy, scans history |
| **trufflehog** | github.com/trufflesecurity/trufflehog | AGPL-3.0 | Verifies live secrets vs prod APIs |

## What It Does

1. Lazy-install tools via `brew` / `go install` if missing.
2. `gitleaks detect --report-format sarif` — covers history.
3. `trufflehog filesystem --only-verified` — eliminates dead-key noise.
4. Merge + dedupe by `(file, line, ruleId)`.
5. Emit SARIF for IDE + Markdown summary for humans.
6. If `--strict`: exit 1 on any finding.

## Usage

```bash
/ll-sec-secrets                        # full repo + history
/ll-sec-secrets --scope staged         # only `git diff --cached` (pre-commit)
/ll-sec-secrets --scope history        # only git log
/ll-sec-secrets src/services           # path scope
/ll-sec-secrets --strict false         # report-only
```

## Pipe

```
/pipe ll-sec-secrets --scope staged >> ll-sec-sast >> commit
/pipe ll-sec-secrets >> ll-sec-push
```

## Output

- `secrets-summary.md` — table: severity · ruleId · file:line · verified?
- SARIF + JSON in `raw/` for SARIF-aware tools (VS Code Sarif Viewer, GitHub Code Scanning).

## Severity Gate

`Verified secret = Critical → exit 1`. Unverified = High. Both block by default; override with `--strict false`.

## Failure Modes

- No tools installed and `--no-install`: hard error.
- Repo not a git repo: skip history scope, scan filesystem only.
- Massive false-positive surface (e.g., test fixtures): use `.gitleaks.toml` allowlist; never disable globally.
