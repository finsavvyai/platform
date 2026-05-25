# PipeWarden GitLab CI Component

Drop-in security scan job for any GitLab pipeline. Equivalent to the
GitHub Action under `action/`.

## Usage

```yaml
include:
  - component: gitlab.com/finsavvyai/pipewarden/security-scan@~latest
    inputs:
      connection: my-gitlab          # required
      server: https://pw.example.com # default: https://app.pipewarden.com
      severity: high                 # critical | high | medium | low | all
```

Set `PIPEWARDEN_TOKEN` as a masked CI/CD variable on the project (or
group) before running.

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `connection` | Yes | — | Connection name configured in PipeWarden |
| `server` | No | `https://app.pipewarden.com` | PipeWarden server URL |
| `severity` | No | `high` | Threshold that fails the job |
| `stage` | No | `test` | Pipeline stage |
| `image` | No | `alpine:3.20` | Container image |

## What it does

1. Downloads the PipeWarden CLI matching the runner OS / arch.
2. Runs `pipewarden scan` against the configured connection and writes
   SARIF to `pipewarden-results.sarif`.
3. Uploads the SARIF artifact and registers it as a `sast` report so
   the GitLab Security Dashboard ingests findings alongside the
   built-in scanners.

## Self-hosted PipeWarden

Override `server` with your deployment URL. The CLI download URL is
hard-coded to GitHub Releases; if you also self-host the CLI binary,
fork the component and replace the `before_script` block.

## Catalog publish

This project lays out the component at
`templates/security-scan/template.yml` per GitLab's CI Catalog spec
(<https://docs.gitlab.com/ci/components/>). To publish:

```bash
git tag v1.0.0
git push origin v1.0.0
# Then in the GitLab project: Operate → CI/CD Catalog → Publish project
```
