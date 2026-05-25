# PipeWarden

[![CI](https://github.com/finsavvyai/pipewarden/actions/workflows/ci.yml/badge.svg)](https://github.com/finsavvyai/pipewarden/actions/workflows/ci.yml)
[![Go Reference](https://pkg.go.dev/badge/github.com/finsavvyai/pipewarden.svg)](https://pkg.go.dev/github.com/finsavvyai/pipewarden)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Go Version](https://img.shields.io/badge/go-1.24+-blue.svg)](go.mod)
[![Powered by PipeWarden](https://pipewarden.com/api/v1/badge/global.svg)](https://pipewarden.com)

> Drop the badge in your own README: `[![Powered by PipeWarden](https://pipewarden.com/api/v1/badge/global.svg)](https://pipewarden.com)`

**For AI agents:** [llms.txt](https://pipewarden.com/llms.txt) · [OpenAPI](https://pipewarden.com/api/v1/openapi.json) · [ChatGPT plugin manifest](https://pipewarden.com/.well-known/ai-plugin.json)

## Cost mode

PipeWarden defaults to Claude Sonnet for AI analysis. Set `PIPEWARDEN_CHEAP_MODE=1` to route to cheaper providers via the ClawPipe gateway:

| Severity / type | Premium (default) | Cheap mode | Saving |
|-----------------|-------------------|------------|--------|
| critical / deep analysis | claude-opus | claude-opus (unchanged) | 0 |
| high | claude-sonnet | deepseek-chat | ~10× |
| medium / low / quick | claude-haiku-or-sonnet | gemini-2.0-flash | ~25× |
| heuristic | (no AI call) | (no AI call) | — |

Verify the spend live:

```
curl http://localhost:8080/api/v1/cost-summary
# {"mode":"cheap","total_calls":12,"cheap_calls":12,"spend_usd":0.04,"savings_usd":0.71,...}

curl http://localhost:8080/metrics | grep pipewarden_model_savings_usd_total
```

Grafana dashboard: [`monitoring/grafana-cost-dashboard.json`](monitoring/grafana-cost-dashboard.json) (import via Grafana → Dashboards → Import → upload JSON).

PipeWarden is a single-binary CI/CD security control plane. The current GA launch surface is:

- GitHub, GitLab, and Bitbucket connection management
- GitHub App install, callback, and webhook flows
- Heuristic analysis with optional Claude-backed enrichment
- DLP scanning and SARIF export
- Outbound webhook delivery
- LemonSqueezy billing in trial or subscribed mode
- Embedded dashboard, REST API, and health/status endpoints

Experimental providers remain in the codebase behind feature flags and are not part of GA.

## Supported Modes

| Mode | Database | Intended Use |
|------|----------|--------------|
| Self-hosted Docker | SQLite | Single-node customer deployment |
| Local development | SQLite | Build, test, and product validation |
| Hosted SaaS operator deployment | Postgres | Managed production environment |

## Prerequisites

- Go 1.24.1+
- GCC or Clang with SQLite development headers for local CGO builds
- Docker and Docker Compose for the self-hosted path
- A non-empty `PIPEWARDEN_VAULT_KEY` before persisting provider credentials

## Quick Start

### Local binary

```bash
make build
export PIPEWARDEN_VAULT_KEY='replace-with-a-long-random-secret'
./bin/pipewarden
```

Open [http://localhost:8080](http://localhost:8080).

Optional analysis and billing configuration:

```bash
export CLAUDE_API_KEY='...'
export LEMONSQUEEZY_API_KEY='...'
export LEMONSQUEEZY_STORE_ID='...'
export LEMONSQUEEZY_WEBHOOK_SECRET='...'
```

### Self-hosted Docker

```bash
cp .env.example .env
$EDITOR .env
docker compose up --build
```

Set at minimum `PIPEWARDEN_VAULT_KEY` in `.env` before adding provider connections.

## Hosted Operator Profile

Hosted mode uses the same binary with Postgres and secret-backed configuration.

Required settings:

```bash
export PIPEWARDEN_HOSTED_MODE=true
export DATABASE_URL='postgres://user:pass@host:5432/pipewarden?sslmode=require'
export PIPEWARDEN_VAULT_KEY='replace-with-a-long-random-secret'
export GITHUB_APP_SLUG='your-app-slug'
export GITHUB_APP_ID='123456'
export GITHUB_PRIVATE_KEY_PATH='/path/to/github-app.pem'
export GITHUB_CLIENT_ID='...'
export GITHUB_CLIENT_SECRET='...'
export GITHUB_WEBHOOK_SECRET='...'
```

Optional:

```bash
export GITHUB_API_BASE_URL='https://api.github.com'
export CLAUDE_API_KEY='...'
export LEMONSQUEEZY_API_KEY='...'
export LEMONSQUEEZY_STORE_ID='...'
export LEMONSQUEEZY_WEBHOOK_SECRET='...'
```

## Configuration

Primary config areas:

- `database`: `sqlite` by default, `postgres` required when `PIPEWARDEN_HOSTED_MODE=true`
- `vault`: AES-256-GCM credential encryption via `PIPEWARDEN_VAULT_KEY`
- `auth.githubApp`: GitHub App slug, app ID, key, client credentials, and webhook secret
- `billing`: LemonSqueezy API key, store ID, and webhook secret
- `features`: hosted mode and experimental provider flags

Example development config lives at [`configs/development/config.yml`](/Users/shaharsolomon/dev/projects/portfolio/pipewarden/configs/development/config.yml). Secret values should come from environment variables, not checked-in placeholder strings.

## GA Providers

| Provider | Auth |
|----------|------|
| GitHub | GitHub App or token |
| GitLab | Token |
| Bitbucket | Username + app password |

Experimental providers such as Azure DevOps, Jenkins, and CircleCI are excluded from launch acceptance unless `PIPEWARDEN_EXPERIMENTAL_PROVIDERS=true`.

## API Surface

Key endpoints:

- `GET /health`
- `GET /readiness`
- `GET /api/v1/status`
- `GET|POST /api/v1/connections`
- `POST /api/v1/connections/{name}/test`
- `GET /api/v1/analysis/findings`
- `GET /api/v1/analysis/findings/export?format=sarif`
- `POST /api/v1/dlp/scan`
- `GET /api/v1/oauth/github/install`
- `GET /api/v1/oauth/github/callback`
- `POST /api/v1/oauth/github/webhook`

`/api/v1/status` reports database, vault, billing, and provider subsystem health independently.

## Development

```bash
make build
make test
docker build -t pipewarden .
```

CI uses the same `make build` and `make test` gates as local development.

## Release Notes

- The root repository is the canonical product tree.
- Docker is the supported self-hosted delivery path.
- Billing never blocks boot: the app runs in trial mode until LemonSqueezy is configured.
