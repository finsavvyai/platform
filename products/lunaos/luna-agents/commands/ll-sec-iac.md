---
name: ll-sec-iac
displayName: Luna Security — IaC Scan
description: Infrastructure-as-Code scanning for Terraform, CloudFormation, Kubernetes, Helm, ARM, Bicep, Dockerfile via Checkov + tfsec
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target
    type: string
    default: .
  - name: frameworks
    type: string
    default: "terraform,kubernetes,helm,cloudformation,arm,bicep,dockerfile,github_actions"
  - name: strict
    type: boolean
    default: true
workflow:
  - install_checkov_lazy
  - install_tfsec_lazy
  - run_checkov_sarif
  - run_tfsec_sarif
  - merge_findings
  - severity_gate
output:
  - .luna/{current-project}/security/raw/iac-checkov.sarif
  - .luna/{current-project}/security/raw/iac-tfsec.sarif
  - .luna/{current-project}/security/iac-summary.md
---

# Luna Security — IaC Scan

Catches misconfigured cloud infra before it ships: open security groups, public S3, weak encryption, missing logging, IAM wildcards, default secrets.

## Tools

| Tool | Repo | License | Coverage |
|------|------|---------|----------|
| **checkov** | github.com/bridgecrewio/checkov | Apache-2.0 | TF, K8s, Helm, CFN, ARM, Bicep, Dockerfile, GHA, OpenAPI |
| **tfsec** | github.com/aquasecurity/tfsec | MIT | Terraform-specific deep checks |

Run both — overlap is small, complement each other.

## Usage

```bash
/ll-sec-iac
/ll-sec-iac --target infra/terraform
/ll-sec-iac --frameworks "kubernetes,helm"
```

## Pipe

```
/pipe ll-sec-iac >> ll-sec-deploy
/pipe ll-sec-iac >> ll-sec-push
```

## Output

- 2 SARIFs (checkov, tfsec).
- `iac-summary.md`:
  - findings grouped by resource type (aws_s3_bucket, kubernetes_pod_security_policy, etc.)
  - severity histogram
  - one-line fix suggestion per finding

## Severity Gate

Critical/High = block. Includes:
- public-by-default storage (S3, GCS, blob)
- unencrypted at-rest
- IAM `*` actions
- privileged k8s containers
- missing pod security standards
- exposed cloud metadata endpoints

## Suppression

Per-finding via comment: `#checkov:skip=CKV_AWS_20:reason`. Never globally disable.

## Notes

- Cloudflare Workers `wrangler.toml` not yet covered by upstream rules — Luna ships custom rules at `~/.luna/checkov-rules/cloudflare/`.
