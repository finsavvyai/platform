---
name: ll-sec-dast
displayName: Luna Security — DAST
description: Dynamic application security testing — runs Nuclei + ZAP baseline against a live URL to find runtime vulns
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target_url
    type: string
    description: Live URL to scan (staging only — never prod without explicit consent)
    required: true
    prompt: true
  - name: profile
    type: enum
    values: [baseline, full, api]
    default: baseline
  - name: nuclei_templates
    type: string
    default: "cves,exposures,misconfiguration,default-logins,vulnerabilities"
  - name: zap_minutes
    type: number
    default: 5
  - name: strict
    type: boolean
    default: true
workflow:
  - confirm_authorization
  - install_nuclei_lazy
  - install_zap_lazy
  - run_nuclei_against_target
  - run_zap_baseline
  - merge_findings
  - severity_gate
output:
  - .luna/{current-project}/security/raw/dast-nuclei.json
  - .luna/{current-project}/security/raw/dast-zap.html
  - .luna/{current-project}/security/dast-summary.md
---

# Luna Security — DAST

Live HTTP scan. Detects vulns that only appear when the app is running: misconfigured headers, exposed admin paths, default creds, known CVEs in deployed components, IDOR patterns, broken auth.

## Tools

| Tool | Repo | License |
|------|------|---------|
| **nuclei** | github.com/projectdiscovery/nuclei | MIT |
| **OWASP ZAP** | github.com/zaproxy/zaproxy | Apache-2.0 |

Nuclei = community-templated CVE/exposure scanner (~10k templates, fast).
ZAP = full proxy-based scanner (slower, deeper, OWASP-backed).

## Authorization Required

This command **only runs against staging or pre-prod URLs you control**. The first step prompts for explicit confirmation. Production scans require `--prod-confirmed` flag and written authorization recorded in `.luna/{project}/security/dast-authorization.md`.

## Usage

```bash
/ll-sec-dast --target_url https://staging.lunaos.ai
/ll-sec-dast --target_url https://staging.lunaos.ai --profile full
/ll-sec-dast --target_url https://api-staging.lunaos.ai --profile api
```

## Pipe

```
/pipe ll-deploy --env staging >> ll-sec-dast --target_url $STAGING_URL
/schedule weekly ll-sec-dast --target_url https://staging.lunaos.ai
```

## Output

- Nuclei JSON (per-template findings).
- ZAP HTML report.
- `dast-summary.md`: severity histogram + top 10 findings + reproduction steps + CVSS.

## Severity Gate

Critical/High → block release. Medium reported, not blocked.

## Failure Modes

- Target unreachable (DNS/connect): hard error.
- Rate-limit during scan: throttles automatically (`--rate-limit 100`).
- Production target without `--prod-confirmed`: refuses to run.
