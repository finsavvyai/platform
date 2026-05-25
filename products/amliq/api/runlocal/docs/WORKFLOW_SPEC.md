# PushCI Workflow YAML Specification

Workflows live in `.pushci/workflows/*.yml` in the repository root.

## Minimal Example

```yaml
name: CI
on: [push]
jobs:
  test:
    steps:
      - run: npm test
```

Top-level fields: `name` (required), `on` (required), `env` (optional), `jobs` (required).

## Triggers (`on`)

```yaml
on: [push, pull_request]           # simple list
on:
  push: { branches: [main, release/*] }
  pull_request: { types: [opened, synchronize] }
  schedule: { cron: "0 2 * * 1" }  # weekly Monday 2am
  workflow_dispatch:                # manual trigger
```

## Jobs and Steps

```yaml
jobs:
  build:
    runs-on: [linux, node]         # runner label requirements
    timeout: 30m                   # max duration (default 60m)
    env: { NODE_ENV: production }
    steps:
      - name: Install
        run: npm ci
        env: { CI: "true" }
      - run: npm test
        if: status == passed       # conditional execution
```

## Job Dependencies (`needs`)

```yaml
jobs:
  test:
    steps: [...]
  deploy:
    needs: [test]                  # waits for test to pass
```

Circular dependencies are a validation error. Independent jobs run in parallel.

## Conditionals (`if`)

Expressions: `branch == main`, `event == pull_request`, `status == passed`,
`env.DEPLOY_ENABLED == "true"`. Operators: `==`, `!=`, `&&`, `||`.

## Matrix Builds

```yaml
matrix:
  node: [16, 18, 20]
  os: [linux, macos]
runs-on: [${{ matrix.os }}]
steps:
  - run: nvm use ${{ matrix.node }} && npm test
```

Generates one job per combination (6 in this example).

## Secrets

```yaml
- run: docker login -u $USER -p $PASS
  secrets: [USER, PASS]
```

Configured in dashboard, injected at runtime, masked in logs.

## Cache

```yaml
- cache: { key: node-${{ hashFiles('package-lock.json') }}, paths: [node_modules] }
- run: npm ci
```

Scoped per-repo, per-branch. Max 5GB per entry.

## Artifacts

`- artifacts: { upload: dist/, name: build-output, retention: 30d }`

## Environments and Approvals

`environment: { name: production, approvers: [team-leads] }`

Approval requests appear in the dashboard. Timeout after 72h.