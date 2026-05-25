# PushCI vs GitHub Actions

## Quick Comparison

| Feature | PushCI | GitHub Actions |
|---------|--------|----------------|
| Setup time | 10 seconds | 15-30 minutes |
| Config | Auto-generated | Hand-written YAML |
| Compute cost | $0 (your machine) | $0.008/min (Linux) |
| Queue time | 0s | 30s-5min |
| Languages | 12 auto-detected | Manual setup |
| Deploy targets | 16 built-in | Community actions |
| Git platforms | GitHub, GitLab, BB | GitHub only |
| Secrets | Local vault | Repository settings |
| Dashboard | Built-in | Built-in |
| Offline | Yes | No |

## Setup: PushCI (2 commands)

```bash
npx pushci init    # auto-detects stack
pushci run         # runs pipeline
```

## Setup: GitHub Actions (50+ lines YAML)

```yaml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - run: go build ./...
      - run: go test ./...
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd web && npm ci
      - run: cd web && npm test
```

## Cost at Scale

| Monthly runs | PushCI | GitHub Actions |
|-------------|--------|----------------|
| 1,000 | $0 | $48 |
| 10,000 | $9 (Pro) | $480 |
| 50,000 | $29 (Team) | $2,400 |

## Migration Guide

### Step 1: Install PushCI

```bash
npx pushci init
```

### Step 2: Verify

```bash
pushci run        # confirm all checks pass
pushci doctor     # verify tool versions
```

### Step 3: Disable GitHub Actions

Rename `.github/workflows/` to `.github/workflows-disabled/` or
delete the files. PushCI git hooks now handle pre-push checks.

## Common Workflows Mapped

| GitHub Actions | PushCI Equivalent |
|---------------|-------------------|
| `actions/checkout@v4` | Automatic (local repo) |
| `actions/setup-go@v5` | Auto-detected |
| `actions/setup-node@v4` | Auto-detected |
| `run: go test ./...` | Auto-generated step |
| `run: npm test` | Auto-generated step |
| Deploy to Cloudflare | `pushci.yml` deploy section |
| Secrets in settings | `pushci secret set KEY=val` |
| Matrix builds | `pushci.yml` matrix config |
