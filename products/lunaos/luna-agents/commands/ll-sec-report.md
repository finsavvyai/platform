---
name: ll-sec-report
displayName: Luna Security — Aggregate Report
description: Aggregate all per-tool SARIF/JSON outputs into one human + machine readable summary. Trend over time.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: format
    type: enum
    values: [md, html, json, sarif]
    default: md
  - name: history_window_days
    type: number
    default: 30
workflow:
  - collect_raw_outputs
  - normalize_to_sarif
  - dedupe_findings
  - compute_severity_histogram
  - compute_trend_vs_history
  - render_format
output:
  - .luna/{current-project}/security/SUMMARY.md
  - .luna/{current-project}/security/SUMMARY.html
  - .luna/{current-project}/security/aggregate.sarif
  - .luna/{current-project}/security/trend.json
---

# Luna Security — Aggregate Report

Roll up every per-tool output (`raw/*.sarif`, `raw/*.json`) into a single source of truth. Track findings over time.

## Inputs

Reads everything in `.luna/{project}/security/raw/`:
- secrets-gitleaks.sarif · secrets-trufflehog.json
- sast-semgrep.sarif
- deps-osv.sarif · deps-licenses.json
- iac-checkov.sarif · iac-tfsec.sarif
- container-trivy.sarif · container-hadolint.json · container-dockle.json
- dast-nuclei.json · dast-zap.html

## Outputs

### Markdown (`SUMMARY.md`)

```
# Security Report — 2026-04-27

## Severity
| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| 0        | 2    | 5      | 18  | 4    |

## Trend (30 days)
- Critical:  ▁▁▁▁▁▁  (steady at 0)
- High:      ▂▂▃▂▂▂  (down from 4 → 2)
- Medium:    ▅▆▆▅▅▅  (steady ~5)

## Top findings
1. [HIGH] dep · CVE-2024-XXXX · pkg@1.2.3 → 1.2.4
2. [HIGH] sast · semgrep · jwt-no-verify · src/auth.ts:42
...
```

### SARIF aggregate
For GitHub Code Scanning + IDE plugins.

### JSON trend
For dashboards (Grafana, Datadog).

## Usage

```bash
/ll-sec-report                            # md
/ll-sec-report --format html              # standalone HTML report
/ll-sec-report --format sarif             # for GH upload
```

## Pipe

```
/pipe ll-sec-push >> ll-sec-report --format html
```

## Notes

- Normalizes severity scales: Trivy CVSS, Semgrep severity, Checkov severity → unified Critical/High/Medium/Low/Info.
- Deduplicates findings reported by multiple tools (e.g., gitleaks + trufflehog + semgrep secrets).
- Stores anonymized trend in `trend.json` (no source paths) for safe sharing.
