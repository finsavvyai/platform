---
name: ll-sec-lifecycle
displayName: Luna Security — Lifecycle Installer
description: One-shot installer that wires every Luna security command into git hooks, GitHub Actions, and cron. Idempotent.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: action
    type: enum
    values: [install, status, uninstall]
    default: install
  - name: hooks
    type: string
    description: Comma-separated subset to enable
    default: "pre-commit,pre-push,pr-workflow,build-workflow,deploy-gate,runtime-workflow,watch-cron,dependabot,renovate"
workflow:
  - detect_repo_kind
  - write_husky_pre_commit
  - write_husky_pre_push
  - write_github_workflow_sec_pr
  - write_github_workflow_sec_build
  - write_github_workflow_sec_runtime
  - write_github_workflow_sec_watch
  - write_dependabot_config
  - write_renovate_config
  - write_luna_sec_config
  - print_status_table
output:
  - .husky/pre-commit
  - .husky/pre-push
  - .github/workflows/luna-sec-pr.yml
  - .github/workflows/luna-sec-build.yml
  - .github/workflows/luna-sec-runtime.yml
  - .github/workflows/luna-sec-watch.yml
  - .github/dependabot.yml
  - renovate.json
  - .luna/{current-project}/security/config.yaml
---

# Luna Security — Lifecycle Installer

Wires the full security lifecycle into your repo in one command. Idempotent: re-runs only update changed files.

## What Gets Installed

| File | Calls | Trigger |
|------|-------|---------|
| `.husky/pre-commit` | `/ll-sec-precommit` | local commit |
| `.husky/pre-push` | `/ll-sec-push --fast` | local push |
| `.github/workflows/luna-sec-pr.yml` | `/ll-sec-pr` | PR opened/updated |
| `.github/workflows/luna-sec-build.yml` | `/ll-sec-build` | tag push |
| `.github/workflows/luna-sec-runtime.yml` | `/ll-sec-runtime` | post-deploy |
| `.github/workflows/luna-sec-watch.yml` | `/ll-sec-watch` | daily 06:00 UTC |
| `.github/dependabot.yml` | (built-in) | weekly dep PRs |
| `renovate.json` | (built-in) | dep PRs (alternative) |
| `.luna/{project}/security/config.yaml` | (Luna config) | per-repo overrides |

## Usage

```bash
/ll-sec-lifecycle install                              # everything
/ll-sec-lifecycle install --hooks pre-commit,pr-workflow
/ll-sec-lifecycle status                               # show what's wired
/ll-sec-lifecycle uninstall                            # remove all
```

## Pipe

Rare. Usually one-shot per repo.

## Status Output

```
✓ pre-commit         /ll-sec-precommit
✓ pre-push           /ll-sec-push --fast
✓ pr-workflow        .github/workflows/luna-sec-pr.yml
✗ build-workflow     missing — run `/ll-sec-lifecycle install --hooks build-workflow`
✓ deploy-gate        already in .github/workflows/luna-deploy.yml
✓ runtime-workflow   .github/workflows/luna-sec-runtime.yml
✓ watch-cron         .github/workflows/luna-sec-watch.yml
✓ dependabot         .github/dependabot.yml
○ renovate           skipped (Dependabot active)
```

## Config

`.luna/{project}/security/config.yaml`:
```yaml
strict: true
severity_gates:
  critical: block
  high: block
  medium: report
notify:
  slack: ""
  email: ""
allow_overrides:
  - path: tests/fixtures/**
    rules: [secrets.gitleaks.test-fixture]
```

## Notes

- Doesn't overwrite existing hooks — appends.
- For non-GitHub repos, generates `.gitlab-ci.yml` jobs instead.
- For Cloudflare Pages projects, adds deploy-gate as Pages build hook.
