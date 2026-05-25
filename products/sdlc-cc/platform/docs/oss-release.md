# Releasing sdlc-gateway-oss

The OSS gateway lives in `sdlc-gateway-oss/` inside this monorepo so refactors stay coherent with the hosted enterprise stack. Public consumers (go get, ghcr.io image, Helm) expect a standalone repo at **github.com/finsavvyai/sdlc-gateway**. Two mirrors keep both worlds in sync.

## One-time setup

1. Create the public repo `github.com/finsavvyai/sdlc-gateway` (empty, no README — we force-push on first mirror).
2. Generate a fine-grained PAT with:
   - Repo: `finsavvyai/sdlc-gateway`
   - Permission: Contents → Read and Write
3. Add the token as `OSS_MIRROR_PAT` secret on `finsavvyai/sdlc-platform`.

## Routine flow (automatic)

Every push to `main` that touches `sdlc-gateway-oss/**` triggers `.github/workflows/oss-mirror.yml`. It:

- runs `git subtree split --prefix sdlc-gateway-oss`
- force-pushes the split to the mirror's `main`

No action needed. The mirror stays caught up.

## Cutting a release

Releases are driven by tags pushed to the mirror repo. Two paths:

### A) GitHub UI — `workflow_dispatch`

Run `Mirror OSS subtree` with input `tag: v0.1.0`. The workflow pushes both the code and the tag; the mirror's `release.yml` then builds multi-arch images and pushes to `ghcr.io/finsavvyai/sdlc-gateway:v0.1.0`.

### B) Local — `scripts/publish-oss.sh`

```bash
# Mirror current main, tag v0.1.0, push tag.
./scripts/publish-oss.sh v0.1.0

# Mirror only (no release fired).
./scripts/publish-oss.sh
```

Requires an SSH key with write access to the mirror. Override the remote with `OSS_REMOTE=...` if the location changes.

## Release checklist

- [ ] `sdlc-gateway-oss/CHANGELOG.md` updated
- [ ] `sdlc-gateway-oss/deployments/helm/sdlc-gateway/Chart.yaml` version bumped
- [ ] Tests green: `(cd sdlc-gateway-oss && go test ./...)`
- [ ] Mirror workflow green on the last commit
- [ ] Tag pushed, `release.yml` image build succeeded on the mirror
