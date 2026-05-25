---
name: luna-sec-orchestrator
displayName: Luna Security Orchestrator
description: Orchestrates open-source security tools across the full DevSecOps lifecycle — secrets, SAST, deps, IaC, container, SBOM, signing, DAST, fuzz, threat model. Wires hooks + CI + cron.
version: 1.0.0
category: security
tools_invoked:
  secrets: [gitleaks, trufflehog]
  sast: [semgrep]
  deps: [osv-scanner, license-checker, grype]
  iac: [checkov, tfsec]
  container: [trivy, hadolint, dockle]
  sbom: [syft]
  sign: [cosign]
  dast: [nuclei, zap]
  fuzz: [jazzer.js, atheris, go-fuzz, AFL++]
  threat_model: [threagile]
commands:
  atomic:
    - ll-sec-secrets
    - ll-sec-sast
    - ll-sec-deps
    - ll-sec-iac
    - ll-sec-container
    - ll-sec-sbom
    - ll-sec-sign
    - ll-sec-dast
    - ll-sec-fuzz
    - ll-sec-threat-model
  lifecycle:
    - ll-sec-precommit
    - ll-sec-pr
    - ll-sec-build
    - ll-sec-deploy
    - ll-sec-runtime
    - ll-sec-watch
  meta:
    - ll-sec-lifecycle
    - ll-sec-report
    - ll-sec-push
---

# Luna Security Orchestrator

The single agent that coordinates every Luna security command. Doesn't run AI inference — it shells out to deterministic OSS tools and aggregates their output into a unified SARIF/Markdown report.

## Responsibilities

1. **Lazy install** — checks for each tool on first invocation; installs via `brew` / `go install` / `pipx` / `npm i -g` if missing.
2. **Normalize** — converts vendor outputs (Checkov JSON, Trivy SARIF, Semgrep SARIF, Hadolint JSON, Dockle JSON, Nuclei JSON, ZAP HTML) to a unified internal schema, then re-emits SARIF.
3. **Severity unify** — maps each tool's scale to Critical / High / Medium / Low / Info.
4. **Dedupe** — collapses overlapping findings (e.g., gitleaks + trufflehog detecting the same secret).
5. **Severity gate** — exits non-zero based on `.luna/{project}/security/config.yaml` and `--strict` flag.
6. **Notify** — Slack / email / webhook on findings (configured per command).
7. **Report** — writes `.luna/{project}/security/{phase}-summary.md` and updates `SUMMARY.md` aggregate.

## State

Per-repo config:
- `.luna/{project}/security/config.yaml` — strict mode, severity gates, allowlists, notify targets.
- `.luna/{project}/security/raw/` — verbatim tool outputs (kept 30 days).
- `.luna/{project}/security/SUMMARY.md` — aggregate.
- `.luna/{project}/security/trend.json` — historical severity counts.
- `.luna/{project}/security/bypass.log` — audit trail of `--strict false` and `LUNA_SEC_BYPASS=1` uses.

## Tool Install Matrix

| Tool | Install command | Disk |
|------|-----------------|------|
| gitleaks | `brew install gitleaks` / `go install github.com/gitleaks/gitleaks/v8@latest` | ~15MB |
| trufflehog | `brew install trufflehog` / `go install github.com/trufflesecurity/trufflehog/v3@latest` | ~25MB |
| semgrep | `pipx install semgrep` / `brew install semgrep` | ~120MB |
| osv-scanner | `brew install osv-scanner` / `go install github.com/google/osv-scanner/cmd/osv-scanner@latest` | ~40MB |
| license-checker | `npm i -g license-checker-rseidelsohn` | ~5MB |
| checkov | `pipx install checkov` | ~80MB |
| tfsec | `brew install tfsec` | ~20MB |
| trivy | `brew install trivy` | ~80MB |
| hadolint | `brew install hadolint` | ~5MB |
| dockle | `brew install goodwithtech/r/dockle` | ~10MB |
| syft | `brew install syft` | ~50MB |
| grype | `brew install grype` | ~50MB |
| cosign | `brew install cosign` | ~30MB |
| nuclei | `brew install nuclei` | ~80MB |
| zap | `brew install zaproxy` | ~250MB |
| threagile | `docker pull threagile/threagile` | image |

## Failure Policy

- Tool install fails: hard error, message tells the user the manual install command.
- Tool run fails (non-finding): hard error.
- Findings exist + `--strict true`: exit 1, do not block aggregator from writing report.
- Network unavailable for OSV/Rekor/Sigstore: fail-closed for `ll-sec-deps`, `ll-sec-sign`; fail-soft for `ll-sec-watch`.

## Why an agent, not just a script

Single source of truth for severity normalization, install policy, allowlists, notification routing, and trend persistence — all 19 commands share these without duplication.
