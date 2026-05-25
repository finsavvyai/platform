# Local Release Guide

Build binaries, create GitHub Releases, push Homebrew formulae, and publish to npm — all from your machine. $0.

## Prerequisites

- **Go 1.22+** installed
- **GoReleaser** installed: `brew install goreleaser` or `go install github.com/goreleaser/goreleaser@latest`
- **GitHub CLI** authenticated: `gh auth login`
- A `.goreleaser.yml` in your repo root (PushCI generates one if missing)
- **npm** (only if publishing to npm)

## Quick Start

```bash
# 1. Tag your release
git tag v1.2.0

# 2. Run the release
pushci release

# 3. Done — GitHub Release + Homebrew + npm published
```

## Configuration

PushCI uses `.goreleaser.yml` in your repo root. Minimal example:

```yaml
builds:
  - env: [CGO_ENABLED=0]
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]

archives:
  - format: tar.gz
    format_overrides:
      - goos: windows
        format: zip

brews:
  - repository:
      owner: your-org
      name: homebrew-tap

release:
  github:
    owner: your-org
    name: your-repo
```

PushCI auto-detects Go projects and generates this config if `.goreleaser.yml` is missing.

## Homebrew Tap Setup

1. Create a GitHub repo named `homebrew-tap` under your org
2. Add the `brews` section to `.goreleaser.yml` (see above)
3. Run `pushci release` — the formula is pushed automatically
4. Users install with: `brew install your-org/tap/your-tool`

## npm Publish Setup

1. Ensure `package.json` exists with `name`, `version`, and `bin` fields
2. Authenticate: `npm login`
3. PushCI runs `npm publish` after binaries are built
4. Optionally add `--npm-tag next` for pre-releases

## Dry Run Mode

Test everything without publishing:

```bash
pushci release --dry-run
```

This builds all binaries and validates config without creating a GitHub Release or publishing.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `gh: not authenticated` | Run `gh auth login` |
| `goreleaser: not found` | `brew install goreleaser` |
| `tag already exists` | Delete with `git tag -d v1.2.0 && git push --delete origin v1.2.0` |
| `npm publish 403` | Check `npm whoami` and package name availability |
| Build fails on one OS | Check CGO_ENABLED=0 in .goreleaser.yml |

## Cost Savings Breakdown

| Scenario | GitHub Actions | PushCI |
|----------|---------------|--------|
| 1 release/week, 6 builds | $0.72-$0.96/release | $0 |
| 52 releases/year | $37-$50/year | $0 |
| 10-person team, 3 repos | $112-$150/year | $0 |
| Enterprise (20 repos) | $740-$1,000/year | $0 |

Your machine is already on. Use it.
