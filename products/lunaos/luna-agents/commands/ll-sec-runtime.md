---
name: ll-sec-runtime
displayName: Luna Security — Post-Deploy DAST
description: Post-deploy live scan. Runs Nuclei + ZAP baseline against deployed URL. Auto-rolls back on critical findings.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target_url
    type: string
    required: true
    prompt: true
  - name: rollback_on_critical
    type: boolean
    default: true
  - name: profile
    type: enum
    values: [baseline, full, api]
    default: baseline
workflow:
  - confirm_authorization_if_prod
  - run_ll_sec_dast --target_url {target_url} --profile {profile}
  - check_security_headers
  - check_tls_config
  - if_critical_then_rollback
output:
  - .luna/{current-project}/security/runtime-summary.md
---

# Luna Security — Post-Deploy DAST

Runs after a successful deploy. Validates the live system actually behaves as the threat model expected. Optional auto-rollback if Critical found.

## What Runs

1. **`ll-sec-dast`** — Nuclei + ZAP baseline scan.
2. **Security header check** — CSP, HSTS, X-Frame-Options, COOP/COEP/CORP, Referrer-Policy.
3. **TLS audit** — minimum TLS 1.2, modern cipher suite, valid cert chain (mozilla/observatory rules).
4. **Optional rollback** — if Critical finding, calls platform-specific rollback (`wrangler rollback`, `kubectl rollout undo`, etc.).

## Install

```bash
/ll-sec-lifecycle install --runtime-workflow
```

Adds post-deploy job to the deploy workflow.

## Usage

```bash
/ll-sec-runtime --target_url https://staging.lunaos.ai
/ll-sec-runtime --target_url https://api.lunaos.ai --rollback_on_critical false
```

## Pipe

```
/pipe ll-deploy >> ll-sec-runtime --target_url $DEPLOY_URL
/schedule daily ll-sec-runtime --target_url https://api.lunaos.ai
```

## Severity Gate

Critical → rollback (default) or alert (with `--rollback_on_critical false`).
High → page on-call, do not rollback.

## Output

- DAST summary (from `ll-sec-dast`).
- Header + TLS audit table.
- Rollback log (if triggered).

## Notes

- Production target requires `--prod-confirmed` (inherited from `ll-sec-dast`).
- Default 5-min scan; deeper `--profile full` runs nightly via `ll-sec-watch`.
