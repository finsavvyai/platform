---
name: ll-sec-container
displayName: Luna Security — Container Scan
description: Container image vulnerability + best-practice scan via Trivy + Hadolint + Dockle
version: 1.0.0
category: security
agent: luna-sec-orchestrator
parameters:
  - name: image
    type: string
    description: Image ref (registry/name:tag) OR Dockerfile path OR tarball
    required: true
    prompt: true
  - name: dockerfile
    type: string
    default: ./Dockerfile
  - name: severity
    type: string
    default: "CRITICAL,HIGH"
  - name: strict
    type: boolean
    default: true
workflow:
  - install_trivy_lazy
  - install_hadolint_lazy
  - install_dockle_lazy
  - run_hadolint_dockerfile
  - run_trivy_image
  - run_dockle_image
  - merge_findings
  - severity_gate
output:
  - .luna/{current-project}/security/raw/container-trivy.sarif
  - .luna/{current-project}/security/raw/container-hadolint.json
  - .luna/{current-project}/security/raw/container-dockle.json
  - .luna/{current-project}/security/container-summary.md
---

# Luna Security — Container Scan

Triple-layer container audit: Dockerfile linting → image CVEs → runtime hardening.

## Tools

| Tool | Repo | License | Layer |
|------|------|---------|-------|
| **trivy** | github.com/aquasecurity/trivy | Apache-2.0 | Image CVE + secrets + misconfig |
| **hadolint** | github.com/hadolint/hadolint | GPL-3.0 | Dockerfile linter (best practices) |
| **dockle** | github.com/goodwithtech/dockle | Apache-2.0 | CIS Docker Benchmark + image hardening |

## Usage

```bash
/ll-sec-container --image lunaos-engine:latest
/ll-sec-container --image registry.example.com/api:v1.2.3
/ll-sec-container --image ./image.tar             # tarball
/ll-sec-container --dockerfile ./services/api/Dockerfile
```

## Pipe

```
/pipe build >> ll-sec-container --image lunaos-engine:latest >> ll-sec-sign >> ll-deploy
```

## Output

- SARIF (trivy) + JSON (hadolint, dockle).
- `container-summary.md`:
  - **Dockerfile issues**: e.g., `DL3008 pin apt versions`
  - **Image CVEs**: package · CVE · severity · fix-in-version
  - **Hardening**: running as root, exposed sensitive ports, missing HEALTHCHECK
  - **Recommended base**: smaller/safer base image alternatives (distroless, alpine, chainguard)

## Severity Gate

CVE Critical/High → block. Hadolint ERROR → block. Dockle FATAL → block.

## Notes

- Auto-fetches Trivy DB once per 24h.
- For multi-arch images, scans amd64 + arm64.
- Honors `.trivyignore`, `.hadolint.yaml`, `.dockleignore` for triaged exceptions.
