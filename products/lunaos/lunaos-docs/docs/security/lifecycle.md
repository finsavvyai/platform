# Cybersecurity Lifecycle

LunaOS ships a complete DevSecOps pipeline as Luna Agents commands. Each command wraps best-in-class open-source tools and integrates into git hooks, CI workflows, and cron jobs.

## Install in 30 seconds

```bash
cd your-project
luna-agents ll-sec-lifecycle install
```

Wires every hook + workflow + cron. Idempotent — safe to re-run.

## The 6 Lifecycle Phases

| Phase | When | Command | Time |
|-------|------|---------|------|
| Pre-commit | local commit | `/ll-sec-precommit` | <5s |
| PR / push | CI on PR | `/ll-sec-pr` | ~30s |
| Build | tag push | `/ll-sec-build` | ~20s |
| Pre-deploy | release gate | `/ll-sec-deploy` | ~2m |
| Runtime / DAST | post-deploy | `/ll-sec-runtime` | ~5m |
| Continuous | daily cron | `/ll-sec-watch` | ~10m |

## The 10 Atomic Commands

Composable building blocks, runnable individually or chained via `ll-pipe`.

| Command | Tools | What it catches |
|---------|-------|-----------------|
| `/ll-sec-secrets` | gitleaks, trufflehog | Leaked API keys, credentials |
| `/ll-sec-sast` | semgrep | Injection, auth, crypto, race conditions |
| `/ll-sec-deps` | osv-scanner, license-checker | CVEs, license violations |
| `/ll-sec-iac` | checkov, tfsec | Cloud misconfig (S3 public, IAM `*`, k8s privileged) |
| `/ll-sec-container` | trivy, hadolint, dockle | Image CVEs, Dockerfile lint, hardening |
| `/ll-sec-sbom` | syft | Software Bill of Materials (CycloneDX, SPDX) |
| `/ll-sec-sign` | cosign | Keyless signing, Rekor transparency log |
| `/ll-sec-dast` | nuclei, zap | Live HTTP vulns, exposed paths, default creds |
| `/ll-sec-fuzz` | jazzer.js, atheris, go-fuzz | Parser/deserialization crashes |
| `/ll-sec-threat-model` | threagile | STRIDE risk register, data-flow diagrams |

## The 3 Meta Commands

| Command | Role |
|---------|------|
| `/ll-sec-lifecycle` | Installer / status / uninstall |
| `/ll-sec-report` | Aggregate every per-tool output into one report + trend |
| `/ll-sec-push` | Umbrella — runs the whole lifecycle in one command |

## Pipe Recipes

```
# Local dev — run before push
/pipe ll-sec-push --fast >> commit

# PR pipeline
/pipe feature "x" >> ll-sec-pr >> rev >> pr

# Release pipeline
/pipe build >> ll-sec-build --artifact $IMAGE >> ll-sec-deploy --image $IMAGE >> ll-deploy >> ll-sec-runtime --target_url $URL

# Scheduled
/schedule "0 6 * * *" ll-sec-watch --notify slack://#sec
```

## Severity Gates

All commands honor `.luna/{project}/security/config.yaml`:
- Critical: block by default
- High: block by default
- Medium: report
- Low: report

Override per-command with `--strict false`. Bypass entire run via `LUNA_SEC_BYPASS=1` (logged for audit).

## Outputs

Every command writes to `.luna/{project}/security/`:

```
security/
├── config.yaml                    # per-repo policy
├── SUMMARY.md                     # latest aggregate
├── trend.json                     # 90-day severity history
├── bypass.log                     # audit of overrides
├── raw/                           # verbatim tool outputs
│   ├── secrets-gitleaks.sarif
│   ├── sast-semgrep.sarif
│   ├── deps-osv.sarif
│   ├── iac-checkov.sarif
│   ├── container-trivy.sarif
│   └── ...
├── sbom/                          # CycloneDX + SPDX
├── signatures/                    # cosign + Rekor refs
├── provenance/                    # SLSA in-toto attestations
├── fuzz/                          # corpus + crash repros
└── threat-model.yaml              # threagile source
```

## Open-Source Tool Index

All MIT/Apache/BSD/AGPL/LGPL/GPL — no SaaS keys, no paid tiers.

| Tool | Repo | License |
|------|------|---------|
| gitleaks | github.com/gitleaks/gitleaks | MIT |
| trufflehog | github.com/trufflesecurity/trufflehog | AGPL-3.0 |
| semgrep | github.com/semgrep/semgrep | LGPL-2.1 |
| osv-scanner | github.com/google/osv-scanner | Apache-2.0 |
| checkov | github.com/bridgecrewio/checkov | Apache-2.0 |
| tfsec | github.com/aquasecurity/tfsec | MIT |
| trivy | github.com/aquasecurity/trivy | Apache-2.0 |
| hadolint | github.com/hadolint/hadolint | GPL-3.0 |
| dockle | github.com/goodwithtech/dockle | Apache-2.0 |
| syft | github.com/anchore/syft | Apache-2.0 |
| grype | github.com/anchore/grype | Apache-2.0 |
| cosign | github.com/sigstore/cosign | Apache-2.0 |
| nuclei | github.com/projectdiscovery/nuclei | MIT |
| OWASP ZAP | github.com/zaproxy/zaproxy | Apache-2.0 |
| jazzer.js | github.com/CodeIntelligenceTesting/jazzer.js | Apache-2.0 |
| atheris | github.com/google/atheris | Apache-2.0 |
| AFL++ | github.com/AFLplusplus/AFLplusplus | Apache-2.0 |
| threagile | github.com/threagile/threagile | MIT |

## Compliance Mapping

| Framework | Covered by |
|-----------|------------|
| OWASP Top 10 | sast (semgrep `p/owasp-top-ten`) + dast (nuclei + zap) |
| CWE Top 25 | sast (semgrep `p/cwe-top-25`) |
| EU CRA | sbom + sign + watch |
| US EO 14028 | sbom + slsa (build) + sign |
| NIST SSDF | full lifecycle |
| SLSA Level 3 | build + sign + provenance |
| CIS Docker | container (dockle) |
| ISO 27001 A.14 | full lifecycle |

## CI/CD Targets

`/ll-sec-lifecycle install` auto-detects platform and writes:
- GitHub Actions (default)
- GitLab CI (`.gitlab-ci.yml`)
- Cloudflare Pages build hooks
- Self-hosted (`.luna/sec-*.cron`)
