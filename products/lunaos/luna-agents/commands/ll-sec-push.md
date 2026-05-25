---
name: ll-sec-push
displayName: Luna Security — Full Sweep
description: Run the entire security lifecycle in one shot. Pre-push umbrella. Fast / Full / CI modes.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: mode
    type: enum
    values: [fast, full, ci]
    default: fast
  - name: target_url
    type: string
    description: For DAST step (full mode only)
    default: ""
  - name: image
    type: string
    description: For container/sign/deploy steps (full mode only)
    default: ""
  - name: strict
    type: boolean
    default: true
workflow:
  - run_ll_sec_secrets
  - run_ll_sec_sast
  - run_ll_sec_deps
  - run_ll_sec_iac
  - if_image_run_ll_sec_container
  - if_image_run_ll_sec_sbom
  - if_image_run_ll_sec_sign
  - if_full_and_target_url_run_ll_sec_dast
  - if_full_run_ll_sec_fuzz --duration_seconds 60
  - if_full_run_ll_sec_threat_model
  - run_ll_sec_report --format md
  - severity_gate
output:
  - .luna/{current-project}/security/PUSH_REPORT.md
  - .luna/{current-project}/security/raw/                # per-tool outputs
---

# Luna Security — Full Sweep

The everything-at-once command. Run before pushing, before releasing, or as the umbrella in any pipe.

## Modes

| Mode | Steps | Time | Use case |
|------|-------|------|----------|
| **fast** | secrets, sast, deps, iac, report | ~45s | pre-push hook |
| **full** | fast + container, sbom, sign, dast, fuzz(60s), threat-model | ~5m | pre-release |
| **ci** | fast + JSON-only output, no PR comments | ~45s | machine-driven |

## Usage

```bash
/ll-sec-push                                                # fast
/ll-sec-push --mode full --image registry/lunaos:v1 --target_url https://staging.lunaos.ai
/ll-sec-push --mode ci                                      # CI machine output
/ll-sec-push --strict false                                 # report-only
```

## Pipe

```
/pipe feature "x" >> ll-sec-push --fast >> ship
/pipe ll-sec-push --full >> rev >> pr
/pipe ll-sec-push --mode full --image $IMAGE --target_url $URL >> ll-deploy
```

## Hook (pre-push)

```bash
/ll-sec-lifecycle install --pre-push
```

Wires `.husky/pre-push` to call `/ll-sec-push --fast`.

## Output

- `PUSH_REPORT.md` — single human-readable file with severity table, top findings, and pipe-step status.
- `raw/` — every individual SARIF/JSON for traceability.

## Severity Gate

Default `--strict true`: any unresolved Critical/High exits non-zero. Matches portfolio CLAUDE.md release-blocking rule.

## Skip / Suppress

`.luna/{project}/security/config.yaml` controls allowlists. Bypass entire run only via `LUNA_SEC_BYPASS=1` env (logged to `bypass.log` for audit).

## Notes

- `--fast` is the hook default. `--full` is for tagged releases.
- All steps run sequentially (severity gate check between each). For parallel, compose explicitly via `ll-pipe` with `&` operator.
- Subsumes legacy `/ll-guard` workflow; `/ll-guard` remains an alias.
