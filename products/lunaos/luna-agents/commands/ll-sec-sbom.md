---
name: ll-sec-sbom
displayName: Luna Security — SBOM
description: Generate Software Bill of Materials (CycloneDX + SPDX) via Syft. Pre-req for signing, supply-chain audit, EU CRA / US EO 14028 compliance.
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: target
    type: string
    description: Path, image, or tarball
    required: true
    prompt: true
    default: .
  - name: formats
    type: string
    default: "cyclonedx-json,spdx-json"
workflow:
  - install_syft_lazy
  - run_syft_cyclonedx
  - run_syft_spdx
  - hash_sbom_artifacts
output:
  - .luna/{current-project}/security/sbom/sbom.cdx.json
  - .luna/{current-project}/security/sbom/sbom.spdx.json
  - .luna/{current-project}/security/sbom/sbom.sha256
  - .luna/{current-project}/security/sbom-summary.md
---

# Luna Security — SBOM

Inventory every package shipped: name, version, license, hash, source. Required for compliance (EU CRA, US EO 14028, NIST SSDF) and as input to `ll-sec-sign` and `ll-sec-deps`.

## Tool

| Tool | Repo | License |
|------|------|---------|
| **syft** | github.com/anchore/syft | Apache-2.0 |

Supports 30+ ecosystems (npm, pypi, gem, maven, go, cargo, deb, rpm, apk, dotnet, ...) and image/dir/tarball sources.

## Usage

```bash
/ll-sec-sbom --target .                          # source repo
/ll-sec-sbom --target lunaos-engine:latest       # docker image
/ll-sec-sbom --target ./image.tar
/ll-sec-sbom --formats cyclonedx-json,spdx-tag
```

## Pipe

```
/pipe build >> ll-sec-sbom --target lunaos-engine:latest >> ll-sec-sign
/pipe ll-sec-sbom >> ll-sec-deps   # SBOM → vuln cross-ref via grype
```

## Output

- `sbom.cdx.json` — CycloneDX (industry standard, snyk/dependency-track compatible).
- `sbom.spdx.json` — SPDX (Linux Foundation, used by GitHub).
- `sbom.sha256` — file hash for attestation.
- `sbom-summary.md`: package count by ecosystem, license distribution histogram, top 20 deepest transitive chains.

## Compliance

The SBOM file is the canonical artifact for:
- US Executive Order 14028 (federal procurement)
- EU Cyber Resilience Act (CRA)
- NTIA minimum elements
- NIST SSDF practice PS.3.2

Attach to releases. Sign with `ll-sec-sign`.

## Notes

- Run on every build → store with release artifacts.
- Combine with `grype` (also Anchore) to vuln-scan the SBOM directly.
