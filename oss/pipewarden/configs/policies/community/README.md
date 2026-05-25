# PipeWarden Community OPA Policy Library

22 Rego policies covering the most-requested CI/CD security patterns. Drop these
into `POST /api/v1/policies` (or load at boot via `PIPEWARDEN_POLICY_DIR`) and
adapt to your repos.

## Index

| File | Category | Severity | Summary |
|------|----------|----------|---------|
| `require_tests.rego` | Quality | high | Fail if no test step runs |
| `require_sast.rego` | Security | high | Require SAST scan step |
| `require_secret_scan.rego` | Security | critical | Require a secret-scan step |
| `require_dependency_scan.rego` | Security | high | Require SBOM or dep-audit |
| `no_plaintext_secrets.rego` | Security | critical | Block plaintext `api_key=` values |
| `no_curl_pipe_bash.rego` | Security | high | Block `curl \| bash` anti-pattern |
| `require_branch_protection.rego` | Security | high | Require protected main branch |
| `require_signed_commits.rego` | Supply chain | medium | Require GPG/SSH-signed commits |
| `require_signed_artifacts.rego` | Supply chain | high | Require cosign / sigstore sign |
| `require_sbom.rego` | Supply chain | high | Require SBOM attached to release |
| `pin_action_shas.rego` | Supply chain | high | GitHub Actions must pin to SHA |
| `no_third_party_unpinned.rego` | Supply chain | critical | Block `@main` / `@master` refs |
| `require_approval_gate.rego` | Process | high | Require manual approval before prod |
| `require_review_count.rego` | Process | medium | N reviewer approvals |
| `block_force_push_main.rego` | Process | critical | Force-push to main forbidden |
| `require_audit_log.rego` | Compliance | medium | Pipeline must emit audit events |
| `require_pii_scan.rego` | Compliance | high | PII/DLP scan on data repos |
| `restrict_runner_labels.rego` | Infra | medium | Only approved runner labels |
| `no_prod_scripts_in_dev.rego` | Infra | high | `deploy-prod.sh` only in prod workflows |
| `require_tls_env.rego` | Infra | high | All env vars that match `*_URL` must be https |
| `max_runtime_minutes.rego` | Infra | low | Fail jobs running > 60 min |
| `require_concurrency_group.rego` | Infra | low | Workflows must define concurrency group |

## Usage

```bash
# Load one policy
curl -X POST http://localhost:8080/api/v1/policies \
  -H 'Content-Type: application/json' \
  -d @<(jq -Rsc '{name:"require-tests",rego:.}' < require_tests.rego)

# Or point PipeWarden at the directory on boot
export PIPEWARDEN_POLICY_DIR=./configs/policies/community
./bin/pipewarden
```

## Adapting

Every policy exposes a `deny[msg]` rule. Input document shape:

```json
{
  "pipeline": { "name": "...", "platform": "github" },
  "run":      { "id": "...", "branch": "main", "actor": "..." },
  "steps":    [ { "name": "...", "uses": "...", "run": "..." } ],
  "findings": [ { "severity": "...", "category": "...", "message": "..." } ]
}
```

Edit thresholds and adapter matchers; keep `deny[msg]` as the entry point so the
evaluator in `internal/policy/evaluator.go` can pick them up without extra
wiring.
