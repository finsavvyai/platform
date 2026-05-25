---
name: ll-sec-threat-model
displayName: Luna Security — Threat Model
description: STRIDE-based threat model from a YAML system description via Threagile. Generates risk register + data-flow diagrams + mitigation tracking.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: model
    type: string
    description: Path to threagile YAML model (created on first run if absent)
    default: .luna/{current-project}/security/threat-model.yaml
  - name: skip_risk_rules
    type: string
    default: ""
workflow:
  - scaffold_model_if_missing
  - validate_model_yaml
  - run_threagile_analyze
  - render_diagrams
  - render_risk_register
output:
  - .luna/{current-project}/security/threat-model.yaml
  - .luna/{current-project}/security/threat-model-report/risks.json
  - .luna/{current-project}/security/threat-model-report/diagrams/
  - .luna/{current-project}/security/threat-model-report/report.pdf
  - .luna/{current-project}/security/threat-model-summary.md
---

# Luna Security — Threat Model

STRIDE-style threat model as code. The system description lives in YAML, results regenerate on every change.

## Tool

| Tool | Repo | License |
|------|------|---------|
| **threagile** | github.com/threagile/threagile | MIT |

40+ built-in risk rules. Generates Graphviz data-flow diagrams + PDF risk report.

## Usage

```bash
/ll-sec-threat-model                                     # uses default path; scaffolds if missing
/ll-sec-threat-model --model infra/threats.yaml
/ll-sec-threat-model --skip_risk_rules "ldap-injection,xml-external-entity"
```

## Pipe

```
/pipe ll-sec-threat-model >> ll-sec-iac >> ll-sec-deploy
/schedule monthly ll-sec-threat-model
```

## Output

- `threat-model.yaml` — the source of truth (commit it).
- `report.pdf` — for stakeholders.
- `risks.json` — per-risk severity, mitigation, owner.
- Diagrams (data flow, trust boundary, risk).

## Scaffold (first run)

Creates a starter `threat-model.yaml` populated with detected technical assets (Cloudflare Workers, D1, KV, R2, Hono, React, etc. — inferred from the codebase).

## Severity Gate

Default report-only. Set `--strict true` to block on High/Critical risks lacking a `mitigation_status: mitigated` flag.

## Notes

- Model lives in version control. Diff highlights newly introduced threats.
- Pair with `ll-sec-iac` — IaC findings should reflect mitigation decisions in the threat model.
