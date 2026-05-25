# How to Deploy UPM.Plus Now

Use this guide to deploy **right now**. For full production checklist see [PRODUCTION_STATUS.md](PRODUCTION_STATUS.md).

---

## Option A: Cloudflare Worker (gateway / edge)

Deploys the gateway worker (`src/upm-plus-gateway-worker.js`) to your Cloudflare zones (e.g. upm.plus, upmplus.dev).

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and logged in
- Cloudflare account with zones for your domains

### Steps

```bash
# 1. From repo root
cd /path/to/automationhub

# 2. Login to Cloudflare (if not already)
npx wrangler login

# 3. Deploy to production (upm.plus)
./scripts/wrangler-deploy.sh --production

# Or deploy to one environment
./scripts/wrangler-deploy.sh --env production    # upm.plus
./scripts/wrangler-deploy.sh --env development  # upmplus.dev
./scripts/wrangler-deploy.sh --env staging       # upmplus.io
./scripts/wrangler-deploy.sh --env ai-production # upmplus.ai

# Or deploy to all environments
./scripts/wrangler-deploy.sh --all

# 4. Skip post-deploy smoke test (optional)
./scripts/wrangler-deploy.sh --production --skip-test
```

### Verify

```bash
curl -s -o /dev/null -w "%{http_code}" https://upm.plus/health
curl -s -o /dev/null -w "%{http_code}" https://upm.plus/api/health
# Expect 200

# Or run the smoke script
./scripts/test-cloudflare-production.sh https://upm.plus https://upmplus.dev
```

### Config

- Worker entry: `wrangler.toml` → `main = "src/upm-plus-gateway-worker.js"`
- Routes and KV/D1 bindings are in `wrangler.toml` per env (production, development, staging, ai-production).

---

## Option B: Backend (Docker Compose)

Runs API + Postgres + Redis (and optional services) on one machine.

### Prerequisites

- Docker and Docker Compose
- `.env` or `.env.production` with production values (see below)

### Steps

```bash
# 1. From repo root
cd /path/to/automationhub

# 2. Set production env (create .env.production or export)
export ENVIRONMENT=production
export PRODUCTION=true
export DEBUG=false
export SECRET_KEY="your-32-char-minimum-random-secret-key"
export DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/dbname"
export REDIS_URL="redis://localhost:6379/0"

# 3. Optional: pre-deploy check
./scripts/verify-production-ready.sh

# 4. Run migrations (first time or after schema changes)
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# 5. Start all services
docker-compose -f docker-compose.prod.yml up -d

# 6. Check status
docker-compose -f docker-compose.prod.yml ps
curl -s http://localhost:8000/health
```

### Using an env file

```bash
# Copy and edit, then:
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Stop / logs

```bash
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml down
```

---

## Option C: Backend (manual / single process)

For a quick run without Docker (e.g. dev or a single server).

### Prerequisites

- Python 3.10+, Redis, PostgreSQL
- `backend/.env` with `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, etc.

### Steps

```bash
cd backend
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Option D: Kubernetes

If you use K8s and have manifests in this repo:

```bash
kubectl apply -f deployments/production/
# Health check (script expects namespace upm-plus-prod)
./deployments/production/scripts/health_check.sh --namespace upm-plus-prod
```

See `deployments/production/deploy.sh` and [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) for full K8s flow.

---

## Summary

| Target              | Command / action |
|---------------------|------------------|
| **Edge (Cloudflare)** | `./scripts/wrangler-deploy.sh --production` |
| **Backend (Docker)** | `docker-compose -f docker-compose.prod.yml up -d` (after env + migrations) |
| **Backend (manual)** | `cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4` |
| **K8s**             | `kubectl apply -f deployments/production/` |

After deploy, run `./scripts/verify-production-ready.sh --health-url https://your-api/health` to confirm.

---

## Troubleshooting: "UPM.Plus not found" or site unreachable

### DNS_PROBE_FINISHED_NXDOMAIN ("This site can't be reached" / "Check if there is a typo in upm.plus")

**NXDOMAIN means the domain has no DNS records** — the name doesn't exist in DNS yet.

- **Don't own upm.plus?** Use **https://upmplus.dev** instead — your worker is already live there. Or register upm.plus (e.g. Cloudflare Registrar, Namecheap) or use a domain you already have; add it in Cloudflare, then add an env in `wrangler.toml` (see "Use a different domain" below).
- **Own upm.plus?** (1) At your **registrar**, set **nameservers** to Cloudflare's. (2) In [Cloudflare Dashboard](https://dash.cloudflare.com) → **Websites** → **Add a site** → enter `upm.plus` until it shows "Active". (3) In **DNS** → **Records**, add an **A** record (name `@`, Proxy on). (4) Run `./scripts/wrangler-deploy.sh --production`, wait 2–5 min, try https://upm.plus again.

### Other: If **https://upm.plus** (or your domain) shows "not found", "site can't be reached", or doesn’t load:

1. **DNS** — In Cloudflare Dashboard → **Websites** → your domain → **DNS**: add or check an **A** or **AAAA** record for the hostname you use (e.g. `@` for upm.plus, `api` for api.upm.plus). Proxy status should be **Proxied** (orange cloud) so traffic goes through Cloudflare to the Worker.
2. **Zone** — The domain must be **added** to the same Cloudflare account you use for `wrangler deploy`. Add the site in Cloudflare if it isn’t there yet.
3. **Routes** — In **Workers & Pages** → your worker (e.g. `upm-plus-production`) → **Settings** → **Triggers** → **Routes**: confirm a route like `upm.plus/*` (or `*upm.plus/*`) is listed and the zone is correct.
4. **Redeploy** — After changing `wrangler.toml` or the worker code, run `./scripts/wrangler-deploy.sh --production` (or `--env production`).

After fixing DNS/zone/routes, wait a few minutes and try again. To test without DNS, use `./scripts/test-cloudflare-wrangler.sh production` (hits the worker on localhost).

### Use a different domain (you don't have upm.plus)

The gateway is live at **https://upmplus.dev** — use that in the browser or set `UPM_PLUS_BASE_URL=https://upmplus.dev` in your apps. To serve the same worker on your own domain: add the domain in Cloudflare, add an env in `wrangler.toml` (e.g. `[env.mycompany]` with `routes = [{ pattern = "app.mycompany.com/*", zone_name = "mycompany.com" }]` and same bindings), then `./scripts/wrangler-deploy.sh --env mycompany`.

---

## Use across your projects

To use the **same gateway and APIs** from other repos or apps:

1. **Call the deployed gateway** — In each project set `UPM_PLUS_BASE_URL` (e.g. `https://upmplus.dev` or `https://upm.plus`) and call `/health` or `/api/health`. No need to deploy from that project.
2. **Reuse the deploy pattern** — Copy `scripts/wrangler-deploy.sh` and `scripts/test-cloudflare-production.sh` into another Worker repo, or add more envs in `wrangler.toml` and deploy with `--env <name>`.
3. **Full guide** — See [USE_ACROSS_PROJECTS.md](USE_ACROSS_PROJECTS.md) for env vars, code examples (Node, Python, curl), and options (copy scripts, submodule, multi-env).
