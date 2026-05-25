---
name: ll-sec-pr
displayName: Luna Security — PR Bundle
description: PR/push CI bundle (~30s). Runs SAST + secret-history + dep audit + license check. Posts findings to PR comment.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: post_pr_comment
    type: boolean
    default: true
  - name: upload_sarif
    type: boolean
    default: true
workflow:
  - run_ll_sec_secrets
  - run_ll_sec_sast
  - run_ll_sec_deps
  - aggregate_sarif
  - upload_to_github_code_scanning
  - post_pr_summary_comment
  - severity_gate
output:
  - .luna/{current-project}/security/pr-summary.md
  - .luna/{current-project}/security/pr-aggregate.sarif
---

# Luna Security — PR Bundle

The CI gate that runs on every PR. ~30 seconds total. Blocks merge on Critical/High.

## What Runs

| Step | Command | Tool | Why |
|------|---------|------|-----|
| 1 | `ll-sec-secrets` | gitleaks + trufflehog | History scan (catches secrets a pre-commit miss) |
| 2 | `ll-sec-sast` | semgrep | OWASP/CWE rules on changed code |
| 3 | `ll-sec-deps` | osv-scanner + license-checker | New CVEs + license compliance |

## Install

```bash
/ll-sec-lifecycle install --pr-workflow
```

Generates `.github/workflows/luna-sec-pr.yml`.

## Usage (manual)

```bash
/ll-sec-pr
/ll-sec-pr --post_pr_comment false       # for local runs
```

## Pipe

```
/pipe feature "x" >> ll-sec-pr >> rev >> pr
```

## Output

- Aggregate SARIF → uploaded to GitHub Code Scanning (Security tab).
- PR comment with severity histogram + top 5 findings + remediation links.
- Markdown summary in `.luna/{project}/security/`.

## Severity Gate

Critical/High → CI fails → merge blocked. Override only via emergency `--strict false` and PR comment justification.

## Notes

- Designed for ~30s budget; full repo SAST scan tuned to changed paths via `--baseline-ref origin/main`.
- Honors GitHub `CODEOWNERS` to auto-request security team review on findings.
