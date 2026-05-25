# PushCI vs GitLab CI

## Quick Comparison

| Feature | PushCI | GitLab CI |
|---------|--------|-----------|
| Setup time | 10 seconds | 20-40 minutes |
| Config | Auto-generated | .gitlab-ci.yml |
| Compute cost | $0 (your machine) | 400 free min/mo |
| Queue time | 0s | 30s-10min |
| Languages | 12 auto-detected | Manual per-job |
| Deploy targets | 16 built-in | Manual scripts |
| Git platforms | GitHub, GitLab, BB | GitLab only |
| Self-hosted runners | Not needed | Complex setup |
| Offline | Yes | No |

## Config: PushCI (auto-generated)

```bash
npx pushci init    # scans and generates pushci.yml
pushci run         # done
```

## Config: GitLab CI (.gitlab-ci.yml)

```yaml
stages:
  - build
  - test

build-go:
  stage: build
  image: golang:1.22
  script:
    - go build ./...

test-go:
  stage: test
  image: golang:1.22
  script:
    - go test ./...

test-node:
  stage: test
  image: node:20
  script:
    - cd web && npm ci && npm test
```

## Cost Comparison

| Team size | PushCI | GitLab CI (Premium) |
|-----------|--------|---------------------|
| Solo | $0 | $0 (400 min) |
| 5 devs | $9/mo | $145/mo ($29/user) |
| 20 devs | $29/mo | $580/mo + compute |

## Migration Guide

### Step 1: Install PushCI

```bash
npx pushci init
```

### Step 2: Map your stages

PushCI auto-detects build, test, and lint steps. Review the
generated `pushci.yml` and add any custom steps.

### Step 3: Move secrets

```bash
pushci secret set DATABASE_URL=postgres://...
pushci secret set DEPLOY_KEY=...
```

### Step 4: Disable GitLab CI

Rename `.gitlab-ci.yml` to `.gitlab-ci.yml.bak`. PushCI git
hooks handle pre-push checks automatically.

## Feature Mapping

| GitLab CI | PushCI Equivalent |
|-----------|-------------------|
| `stages:` | Auto-ordered steps |
| `image: golang:1.22` | Auto-detected (local) |
| `artifacts:` | Local filesystem |
| `cache:` | Native OS cache |
| `variables:` | `pushci secret set` |
| `rules: / only:` | `pushci.yml` triggers |
| `environment:` | `pushci.yml` deploy |
| `include:` | Not needed (auto-config) |
| Merge request pipelines | Git hook on push |
