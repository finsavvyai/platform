---
name: ll-sec-sign
displayName: Luna Security — Sign Artifact
description: Keyless signing of binaries, images, and SBOMs via Cosign + Sigstore. Produces verifiable attestations.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: artifact
    type: string
    description: Image ref, file path, or SBOM path
    required: true
    prompt: true
  - name: kind
    type: enum
    values: [image, blob, sbom, attestation]
    default: image
  - name: predicate_type
    type: string
    description: For attestations (e.g., cyclonedx, spdx, slsaprovenance, vuln)
    default: cyclonedx
  - name: oidc_issuer
    type: string
    default: https://token.actions.githubusercontent.com
workflow:
  - install_cosign_lazy
  - keyless_sign_with_oidc
  - upload_to_rekor_transparency_log
  - emit_signature_artifact
  - verify_signature
output:
  - .luna/{current-project}/security/signatures/{artifact}.sig
  - .luna/{current-project}/security/signatures/{artifact}.pem
  - .luna/{current-project}/security/signatures/rekor-uuid.txt
---

# Luna Security — Sign Artifact

Keyless signing — no long-lived private keys. Identity proven via OIDC (GitHub Actions, GitLab CI, Buildkite) and recorded in the public Rekor transparency log.

## Tool

| Tool | Repo | License |
|------|------|---------|
| **cosign** | github.com/sigstore/cosign | Apache-2.0 |

Part of Sigstore project (Linux Foundation, OpenSSF).

## Usage

```bash
# Sign container image
/ll-sec-sign --artifact registry/lunaos-engine:v1.2.3 --kind image

# Sign a release binary
/ll-sec-sign --artifact ./dist/luna-agents.tgz --kind blob

# Sign an SBOM as attestation
/ll-sec-sign --artifact ./sbom.cdx.json --kind attestation --predicate_type cyclonedx
```

## Pipe

```
/pipe build >> ll-sec-sbom >> ll-sec-sign --kind attestation >> ll-deploy
```

## Verify (consumer side)

```bash
cosign verify --certificate-identity-regexp "https://github.com/.+" \
              --certificate-oidc-issuer https://token.actions.githubusercontent.com \
              registry/lunaos-engine:v1.2.3
```

## Output

- `.sig` — detached signature
- `.pem` — ephemeral cert from Fugio
- `rekor-uuid.txt` — transparency log entry (publicly auditable)

## Severity / Failure Modes

- No OIDC token available (running outside CI without `--key`): hard error.
- Rekor unreachable: fail-closed — refuse to sign without log entry.
- Cosign verify mismatch: hard error.

## Notes

- For local dev, use `--key cosign.key` (password-protected); never commit the key.
- Pair with `ll-sec-sbom` to produce SLSA Level 3 provenance.
