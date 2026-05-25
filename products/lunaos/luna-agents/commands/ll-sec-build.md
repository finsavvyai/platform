---
name: ll-sec-build
displayName: Luna Security — Build Bundle
description: Build-stage supply-chain bundle. Generates SBOM, signs artifacts, produces SLSA provenance.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: artifact
    type: string
    description: Built image, binary, or directory to seal
    required: true
    prompt: true
  - name: slsa_level
    type: enum
    values: [1, 2, 3]
    default: 3
workflow:
  - run_ll_sec_sbom --target {artifact}
  - run_grype_against_sbom
  - run_ll_sec_sign --artifact {artifact} --kind image
  - run_ll_sec_sign --artifact sbom.cdx.json --kind attestation --predicate_type cyclonedx
  - emit_slsa_provenance
output:
  - .luna/{current-project}/security/sbom/sbom.cdx.json
  - .luna/{current-project}/security/signatures/
  - .luna/{current-project}/security/provenance/slsa.intoto.jsonl
  - .luna/{current-project}/security/build-summary.md
---

# Luna Security — Build Bundle

Runs at build/release time. Produces every artifact a downstream consumer needs to verify what shipped.

## What Runs

1. **`ll-sec-sbom`** — CycloneDX + SPDX of the built image/binary.
2. **grype** — vuln-scan the SBOM (last chance to catch CVEs).
3. **`ll-sec-sign --kind image`** — keyless cosign signature.
4. **`ll-sec-sign --kind attestation`** — sign the SBOM.
5. **SLSA provenance** — in-toto attestation describing how the build happened.

## Install

```bash
/ll-sec-lifecycle install --build-workflow
```

Generates `.github/workflows/luna-sec-build.yml`.

## Usage

```bash
/ll-sec-build --artifact registry/lunaos-engine:v1.2.3
/ll-sec-build --artifact ./dist/luna-agents.tgz --slsa_level 2
```

## Pipe

```
/pipe build >> ll-sec-build --artifact $IMAGE >> ll-deploy
```

## Output

Single sealed bundle that includes:
- SBOM (CycloneDX + SPDX)
- Cosign signature + Rekor entry
- SLSA provenance attestation
- All signed and verifiable

## SLSA Levels

| Level | Adds | Cost |
|-------|------|------|
| 1 | provenance only | low |
| 2 | hosted CI build | medium |
| 3 | hardened build, isolated, non-falsifiable | higher |

LunaOS targets **SLSA 3** in CI; downgrade for local builds.

## Failure Modes

- SBOM gen fails → block sign + provenance.
- Signing without OIDC token → block (no anonymous releases).
- Grype finds new Critical → block release; require triage commit.
