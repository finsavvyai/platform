# PushCI vs CircleCI

## Quick Comparison

| Feature | PushCI | CircleCI |
|---------|--------|----------|
| Setup time | 10 seconds | 20-30 minutes |
| Config | Auto-generated | .circleci/config.yml |
| Compute cost | $0 (your machine) | 6,000 free credits/mo |
| Queue time | 0s | 15s-3min |
| Languages | 12 auto-detected | Orbs / manual |
| Deploy targets | 16 built-in | Orbs / scripts |
| Git platforms | GitHub, GitLab, BB | GitHub, Bitbucket |
| Config language | YAML (minimal) | YAML (verbose) |
| Offline | Yes | No |

## Config: PushCI

```bash
npx pushci init
pushci run
```

## Config: CircleCI (.circleci/config.yml)

```yaml
version: 2.1
orbs:
  go: circleci/go@1.11
  node: circleci/node@5.2
jobs:
  build-and-test:
    docker:
      - image: cimg/go:1.22
    steps:
      - checkout
      - go/load-cache
      - run: go build ./...
      - run: go test ./...
      - go/save-cache
  test-frontend:
    docker:
      - image: cimg/node:20.11
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: npm
          app-dir: web
      - run: cd web && npm test
workflows:
  main:
    jobs:
      - build-and-test
      - test-frontend
```

## Cost Comparison

| Monthly usage | PushCI | CircleCI |
|--------------|--------|----------|
| Light (solo) | $0 | $0 (free tier) |
| Medium (team) | $9/mo | $29/mo (Performance) |
| Heavy (org) | $29/mo | $200+/mo (Scale) |

## Migration Guide

### Step 1: Install

```bash
npx pushci init
```

### Step 2: Verify pipeline

```bash
pushci run       # builds + tests locally
pushci doctor    # checks all tools present
```

### Step 3: Move secrets and disable CircleCI

```bash
pushci secret set AWS_ACCESS_KEY_ID=...
pushci secret set DEPLOY_TOKEN=...
```

Then remove `.circleci/` directory or rename `config.yml`.

## Feature Mapping

| CircleCI | PushCI Equivalent |
|----------|-------------------|
| Orbs | Auto-detection (built-in) |
| `docker:` executor | Local machine (no containers) |
| `workflows:` | Auto-ordered pipeline |
| `cache` / `save-cache` | Native OS cache |
| Contexts (secrets) | `pushci secret set` |
| `store_artifacts` | Local filesystem |
| Parallelism | Parallel step execution |
| SSH debug | Local debugging (native) |
