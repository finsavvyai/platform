---
name: ll-sec-deploy
displayName: Luna Security — Pre-Deploy Bundle
description: Pre-deploy gate (~2m). Container scan + IaC scan + signature verification. Last barrier before production.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: image
    type: string
    description: Image about to be deployed
    required: true
    prompt: true
  - name: iac_path
    type: string
    default: ./infra
  - name: verify_signature
    type: boolean
    default: true
workflow:
  - run_ll_sec_container --image {image}
  - run_ll_sec_iac --target {iac_path}
  - verify_cosign_signature
  - check_sbom_attestation_present
  - severity_gate
output:
  - .luna/{current-project}/security/deploy-summary.md
---

# Luna Security — Pre-Deploy Bundle

The release gate. Runs immediately before `wrangler deploy` / `kubectl apply` / `terraform apply`. Blocks on any unsigned image, IaC misconfig, or container CVE.

## What Runs

1. **`ll-sec-container`** — Trivy + Hadolint + Dockle on the deploy image.
2. **`ll-sec-iac`** — Checkov + tfsec on the deployment manifests.
3. **Cosign verify** — image must be signed by the trusted issuer (`ll-sec-build`).
4. **SBOM presence** — image must have an attached attested SBOM.

## Install

```bash
/ll-sec-lifecycle install --deploy-gate
```

Wires this command as a required step in deploy workflows.

## Usage

```bash
/ll-sec-deploy --image registry/lunaos-engine:v1.2.3
/ll-sec-deploy --image $IMAGE --iac_path infra/cloudflare
```

## Pipe

```
/pipe ll-sec-build --artifact $IMAGE >> ll-sec-deploy --image $IMAGE >> ll-deploy
```

## Severity Gate (release-blocking)

Critical/High image CVEs · Critical IaC misconfigs · missing/invalid signature · missing SBOM attestation.

## Notes

- For Cloudflare Workers, IaC scope = `wrangler.toml` + custom rules (Luna ships these at `~/.luna/checkov-rules/cloudflare/`).
- For containerless deploys (Workers, Pages, Lambda), skip container step automatically — runs IaC + signature only.
- Pair with `ll-sec-runtime` post-deploy.
