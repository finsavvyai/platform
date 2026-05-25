# PipeWarden Launch Checklist

Production launch path for the public GitHub Action, GitLab CI
Component, and PushCI auto-fix bridge. Each step has a verification
command — never tick a box without observing the success signal.

## Pre-flight (verifiable today)

- [ ] `go test -count=1 ./...` is fully green on `prod-readiness`.
- [ ] `goreleaser check && goreleaser check --config .goreleaser.airgap.yml`
      passes (deprecation warnings tolerated).
- [ ] `bash scripts/onboard.sh --dry-run` shows audit-secrets gate.
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://api.pushci.dev/healthz`
      returns `200`. **As of 2026-05-02 this returns 404 — block on it.**

## Step 1 — Make the repo public

Required by both GitHub Marketplace and GitLab CI/CD Catalog.

```bash
gh repo edit finsavvyai/pipewarden --visibility public --accept-visibility-change-consequences
gh repo view finsavvyai/pipewarden --json visibility --jq .visibility   # expect "public"
```

Verify the GitHub Action subdir is reachable:

```bash
curl -fsSL https://raw.githubusercontent.com/finsavvyai/pipewarden/main/action/action.yml | head -3
```

## Step 2 — First release

```bash
git tag v1.0.0
git push origin v1.0.0
goreleaser release --clean
```

Verify:

```bash
gh release view v1.0.0 --repo finsavvyai/pipewarden --json assets --jq '.assets[].name'
# expect pipewarden_linux_amd64.tar.gz, pipewarden_linux_arm64.tar.gz, checksums.txt, sbom

curl -fsSL -o /tmp/pw.tgz https://github.com/finsavvyai/pipewarden/releases/latest/download/pipewarden_linux_amd64.tar.gz
test -s /tmp/pw.tgz && echo "release artifact reachable"
```

The `action/action.yml` `Download` step depends on this URL.

## Step 3 — GitHub Action Marketplace listing

GitHub auto-detects `action/action.yml` once the repo is public + a
release exists. Fill in the marketplace listing UI on the release page:

- Primary category: **Security**
- Secondary category: **Continuous Integration**
- Icon + brand colors come from `branding:` in `action.yml`.

Smoke from a throwaway repo:

```yaml
- uses: finsavvyai/pipewarden/action@v1
  with:
    connection: my-github
    token: ${{ secrets.PIPEWARDEN_TOKEN }}
```

## Step 4 — GitLab CI/CD Catalog publish

Repo layout already complies with the catalog spec
(`templates/security-scan/template.yml`).

```bash
# 1. Mirror or push to gitlab.com/finsavvyai/pipewarden
# 2. Tag + push:
git tag v1.0.0   # if not already
git push origin v1.0.0
# 3. In GitLab UI: Operate → CI/CD Catalog → "Publish project"
```

Smoke from a throwaway GitLab project:

```yaml
include:
  - component: gitlab.com/finsavvyai/pipewarden/security-scan@~latest
    inputs: { connection: my-gitlab }
```

## Step 5 — Deploy api.pushci.dev

Bridge in `internal/ai/pushci_bridge.go` calls
`POST https://api.pushci.dev/v1/fix`. **Today the upstream returns 404
on every path including `/healthz`.** PB2 added a healthz gate so
PipeWarden no longer issues the call against the dead surface.

Until the API is deployed:

- Operator must NOT set `PUSHCI_API_KEY` on production. With it unset,
  `PushCIBridge.Enabled()` returns false and the auto-fix path is dark.

After the API is deployed:

```bash
curl -fsS https://api.pushci.dev/healthz
# expect 200; PushCIBridge.Healthy() will then succeed
```

## Step 6 — Server-side webhook secrets

```bash
# GitHub
export GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"

# GitLab — gates fail-closed when unset (PB1)
export GITLAB_WEBHOOK_SECRET="$(openssl rand -hex 32)"

# Restart pipewarden, then register the secret in:
# - GitHub App settings → Webhook secret
# - GitLab project/group → Settings → Webhooks → Secret token
```

Verify both fail closed when secrets unset (regression guard, not
release-blocking):

```bash
go test ./internal/handlers/ -run 'TestGitLabWebhook_FailClosedWhenSecretUnset' -count=1
go test ./internal/handlers/ -run 'TestGitHubWebhookRejectsBadSig' -count=1
```

## Step 7 — Audit secrets onboarding

```bash
scripts/onboard/setup-audit-secrets.sh --repo finsavvyai/pipewarden
# Mints + sets PIPEWARDEN_INTERNAL_AUDIT_TOKEN secret + PIPEWARDEN_AUDIT_URL var
# Output also includes the token to copy to the server (never written to disk)
```

## Step 8 — Live smoke against real platforms

```bash
# Real GitLab token + URL:
GITLAB_URL=https://gitlab.com GITLAB_TOKEN=glpat-xxx make test-gitlab-live

# Real GitHub Enterprise:
GITHUB_ENTERPRISE_URL=https://ghe.example.com \
  GITHUB_ENTERPRISE_TOKEN=ghp-xxx \
  make test-github-enterprise
```

These tests live under `cmd/testconnections/...` and are gated by the
`integration` build tag, so they never run in the default `go test ./...`
sweep.

## Step 9 — Announce

After Steps 1–7 verify green:

- Open the GitHub Marketplace listing.
- Tag the release notes with `marketplace`, `actions`, `gitlab-ci`,
  `devsecops`.
- Update the README badges to point at the published tag (currently
  references `releases/latest`).

## Rollback path

- Marketplace: unpublishing requires deleting the release; do NOT just
  flip the repo back to private — that orphans every consumer's
  `uses: finsavvyai/pipewarden/action@v1`.
- GitLab CI Catalog: unpublishing in the Catalog UI removes future
  resolves; existing pipelines that pinned a tag keep working.
- PushCI: clear `PUSHCI_API_KEY`. Bridge auto-disables.

## What this checklist deliberately does NOT automate

| Step | Reason |
|------|--------|
| Visibility flip to public | One-way door; needs human sign-off |
| Tag v1.0.0 | Versioning policy is product-level |
| Marketplace listing fields | UI form; can't be set via API today |
| pushci.dev API deploy | Separate project with its own pipeline |

Anything else can be scripted; ping if a manual step shows up that
isn't on this list.
