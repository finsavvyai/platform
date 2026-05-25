# amliq.finance — Click-to-deploy guide

> Full stack up in 20 minutes. Scale a plan tier in 30 seconds.
> Every operation has a single command.

---

## Repo structure

```
amliq/
├── .github/workflows/deploy.yml   ← auto-deploys on push to main
├── cmd/
│   ├── server/                    ← Go screening service (main entry)
│   └── ingest/                    ← nightly list refresh worker
├── internal/
│   ├── api/                       ← HTTP handlers
│   ├── cache/                     ← CF KV client (write-back after screen)
│   ├── normalize/                 ← name normalisation + token variants
│   ├── scorer/                    ← composite scoring on watchman results
│   └── watchman/                  ← watchman HTTP client wrapper
├── worker/
│   ├── src/index.ts               ← Cloudflare Worker (edge gate)
│   └── wrangler.toml              ← CF bindings config
├── migrations/001_init.sql        ← PostgreSQL schema (audit log only)
├── docker-compose.yml             ← local dev (watchman + postgres + go)
├── render.yaml                    ← Render blueprint (all production services)
├── Dockerfile                     ← Go service container
├── Makefile                       ← every operation as one command
└── .env.example                   ← env var template
```

---

## First-time setup — 20 minutes

### Prerequisites

```bash
brew install go node                  # or your OS equivalent
npm install -g wrangler               # Cloudflare CLI
# Render account at render.com
# Cloudflare account at cloudflare.com
```

### Run bootstrap

```bash
git clone git@github.com:your-org/amliq.git
cd amliq
make bootstrap
```

Bootstrap walks you through:
1. Cloudflare login (`wrangler login`)
2. Creates KV namespace, R2 bucket, and Queues
3. Sets Worker secrets (Go service URL, internal secret)
4. Guides you to paste KV IDs into `wrangler.toml`
5. Tells you exactly what to do on Render

That is it. No manual dashboard clicking for configuration.

---

## Daily workflow — what "a click" looks like

### Push to deploy (the normal path)

```bash
git push origin main
# GitHub Actions runs:
#   1. go test ./...
#   2. wrangler deploy --env production
#   3. Render deploy webhook
# Total time: ~2 minutes
```

### Local dev

```bash
make dev           # starts watchman + postgres + go with hot reload
make screen-ofac   # test against a known OFAC entity (Nicolas Maduro)
make screen-clean  # test a clean name
```

### Scale up when a customer signs

```bash
make scale-standard   # edits render.yaml: starter → standard ($25/month)
git add render.yaml && git commit -m "scale: standard tier" && git push
# Render applies the plan change live — zero downtime
```

---

## Architecture: how a request flows

```
Client
  │
  ▼
Cloudflare Worker (edge — free tier, ~100K req/day)
  ├── normalize name
  ├── KV: check negative cache (24h TTL) ──→ return clean (< 1ms)
  ├── KV: check exact match ──────────────→ return block (< 2ms)
  ├── KV: check phonetic code ──────────→ forward to Go for scoring
  └── miss ────────────────────────────→ forward to Go
          │
          ▼
    Go service on Render ($7/month starter)
      ├── watchman private service → Jaro-Winkler fuzzy match (< 10ms)
      ├── scorer: composite score (name + DOB + nationality)
      ├── fp_whitelist: check operator-confirmed false positives
      ├── write result to PostgreSQL audit log
      ├── if clean: write neg:key to CF KV (24h TTL)
      └── if high score: write exact:key to CF KV (no TTL)
```

---

## Scaling — the single command path

Every scale action is a one-line `render.yaml` change + push.
Cloudflare Workers scale automatically — no action needed.

| Signal | Command | Effect |
|---|---|---|
| First paying customer | `make scale-standard` | Go service: 512MB → 2GB |
| DB hitting limits | `make scale-db` | PG: starter → standard |
| > 50K screens/month | `make scale-pro` | Go service: 2GB → 4GB |
| > 300K screens/month | Add second Go service to render.yaml | Horizontal scale |

To scale the watchman private service, add `plan: standard` to the pserv
block in `render.yaml` and push. Render handles the rollover.

---

## Continuous monitoring — zero extra cost

The Cloudflare Worker fires a Cron Trigger at 3am UTC nightly.
It sends all active customers to the `sanctions-ingest` Queue.
The Queue consumer (Go service) re-screens each customer and fires alerts
on score delta above threshold.

Cloudflare Queues is included in the free tier up to 1M operations/month —
covering 333K customer monitors per night at no extra cost.

To change the monitoring schedule:

```toml
# worker/wrangler.toml
[triggers]
crons = ["0 3 * * *"]    # daily at 3am UTC
# crons = ["0 */6 * * *"]  # every 6 hours — uncomment for higher frequency
```

---

## CI/CD secrets to configure in GitHub

Go to `Settings → Secrets → Actions` in your GitHub repo and add:

| Secret | Where to get it |
|---|---|
| `CF_API_TOKEN` | cloudflare.com → My Profile → API Tokens |
| `CF_ACCOUNT_ID` | cloudflare.com → Account Home (right sidebar) |
| `RENDER_API_KEY` | render.com → Account Settings → API Keys |
| `RENDER_SERVICE_ID` | Render dashboard → your service → Settings |

After these are set, every push to `main` deploys both the CF Worker
and triggers a Render deploy automatically.

---

## Useful commands reference

```bash
# Development
make dev              # start local stack
make dev-reset        # wipe DB and restart clean
make migrate          # run SQL migrations locally

# Deploy
make deploy           # deploy Worker + Render manually
make worker           # deploy Worker only
make render           # trigger Render deploy only

# Test the live service
NAME="Vladimir Putin" make screen
make screen-ofac      # built-in OFAC positive test
make screen-clean     # built-in clean name test
FILE=names.json make batch   # batch screen from file

# Scale
make scale-standard   # Go service → standard plan
make scale-pro        # Go service → pro plan
make scale-db         # DB → standard plan

# Inspect KV
make kv-stats         # count keys by prefix
make kv-flush-neg     # clear negative cache (after list update)

# Logs
make logs             # stream Render service logs
make dev-logs         # stream local docker-compose logs
```

---

## Upgrading to Elasticsearch (when ready)

When you want to graduate from watchman to Elasticsearch:

1. Add `yente` as a Render private service in `render.yaml`:

```yaml
- type: pserv
  name: amliq-yente
  image:
    url: ghcr.io/opensanctions/yente:latest
  plan: pro              # needs ~4GB RAM
  envVars:
    - key: YENTE_ELASTICSEARCH_URL
      value: http://amliq-es:9200   # add ES as another pserv
```

2. Swap the client in `internal/watchman/client.go`:

```go
// Before: calls http://amliq-watchman:8084/search
// After:  calls http://amliq-yente:8000/match
// Interface unchanged — one URL swap
```

3. Push. Zero other changes.

---

*Last updated: April 2026 — amliq.finance*
