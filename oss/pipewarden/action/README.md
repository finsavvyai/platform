# PipeWarden Scan Action

Scan your CI/CD pipeline configuration for security vulnerabilities using PipeWarden.

## Usage

```yaml
- uses: finsavvyai/pipewarden/action@v1
  with:
    server: https://app.pipewarden.com
    connection: my-github
    severity: high
    token: ${{ secrets.PIPEWARDEN_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `server` | No | `https://app.pipewarden.com` | PipeWarden server URL |
| `connection` | Yes | — | Connection name configured in PipeWarden |
| `severity` | No | `high` | Minimum severity to fail on (`critical`\|`high`\|`medium`\|`low`\|`all`) |
| `token` | No | — | PipeWarden API token (from Settings → API Tokens) |

## Outputs

| Output | Description |
|--------|-------------|
| `findings_count` | Total number of findings |
| `risk_score` | Overall risk score (0–100) |
| `sarif_file` | Path to SARIF output file |

## What it does

1. Downloads the PipeWarden CLI binary for the current OS/architecture.
2. Runs `pipewarden scan` against your configured connection.
3. Annotates PRs with `::error` / `::warning` workflow commands.
4. Uploads SARIF results to the GitHub Security tab.
5. Fails the workflow if findings meet or exceed the severity threshold.

## Full workflow example

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  pipewarden:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: finsavvyai/pipewarden/action@v1
        id: scan
        with:
          connection: my-github
          severity: high
          token: ${{ secrets.PIPEWARDEN_TOKEN }}

      - name: Print results
        run: |
          echo "Findings: ${{ steps.scan.outputs.findings_count }}"
          echo "Risk score: ${{ steps.scan.outputs.risk_score }}/100"
```

## Self-hosted server

```yaml
- uses: finsavvyai/pipewarden/action@v1
  with:
    server: https://pipewarden.mycompany.com
    connection: internal-github
    token: ${{ secrets.PIPEWARDEN_TOKEN }}
```
