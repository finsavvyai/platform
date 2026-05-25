# Production Status — UPM.Plus / AutomationHub

**Last updated:** 2026-03-07  
**Single source of truth for production readiness.**

---

## Status: Ready for beta with verification

| Area | Status | Notes |
|------|--------|------|
| **Backend** | Ready | FastAPI, health, billing, usage, migrations |
| **Security** | Ready | JWT, rate limit, CORS, prod validation (no dev keys) |
| **Cloudflare** | Active | Worker gateway, smoke tests in CI (every 6h + on push) |
| **K8s / deploy** | Ready | Manifests under `deployments/production/`, health script |
| **Pre-launch checks** | Script | Run `./scripts/verify-production-ready.sh` before deploy |

---

## Definition of “ready”

- **Supported surfaces:** Backend (API), Cloudflare Worker (gateway), optional K8s.
- **Release control:** Use main branch + CI; Cloudflare smoke on push to main.
- **Gates:** No merge with red CI; run `verify-production-ready.sh` before production deploy.

---

## Quick pre-deploy verification

```bash
# 1. Env and migrations (from repo root)
./scripts/verify-production-ready.sh

# 2. Cloudflare production smoke (optional, needs network)
./scripts/test-cloudflare-production.sh https://upm.plus https://upmplus.dev

# 3. Backend tests (from backend dir)
cd backend && pytest -v --tb=short -x
```

---

## Required before first production deploy

- [ ] **SECRET_KEY** set in production env, ≥32 chars, no "dev"/"test".
- [ ] **DEBUG=false**, **ENVIRONMENT=production**, **PRODUCTION=true**.
- [ ] **DATABASE_URL** points to PostgreSQL (no SQLite in prod).
- [ ] Run migrations: `cd backend && alembic upgrade head`.
- [ ] Stripe: test mode verified; webhook URL and secret set for prod.
- [ ] SSL/TLS in front of the app (load balancer or ingress).

---

## Checklist quick path

See **PRODUCTION_CHECKLIST.md** for the full list. Minimum for go-live:

1. **Security** — All required env vars set; no default or dev secrets in prod.
2. **Database** — PostgreSQL, migrations applied, backups configured.
3. **Health** — `/health` and `/api/health` (or `/api/v1/health`) return 200.
4. **Monitoring** — Health checks and metrics endpoint; alerting on failure.
5. **Rollback** — Documented and tested (e.g. revert deploy, DB rollback if needed).

---

## Key files

| Purpose | Path |
|---------|------|
| **Deploy now (steps)** | **[DEPLOY_NOW.md](DEPLOY_NOW.md)** |
| Pre-deploy verification | `scripts/verify-production-ready.sh` |
| Cloudflare deploy | `scripts/wrangler-deploy.sh` |
| Cloudflare smoke | `scripts/test-cloudflare-production.sh` |
| K8s health check | `deployments/production/scripts/health_check.sh` |
| Backend config | `backend/app/core/config.py` |
| Production checklist | `PRODUCTION_CHECKLIST.md` |
| 10-day hardening plan | `WORKDAY_PLAN_PRODUCTION.md` |

---

## CI and deployment

- **Cloudflare production smoke:** `.github/workflows/cloudflare-production-smoke.yml` — runs on schedule (every 6h), on push to main (when gateway/wrangler paths change), and on `workflow_dispatch`.
- **Backend:** Deploy via Docker Compose prod or K8s; use `scripts/start-production.sh` or your pipeline.

---

## After launch

- Complete **WORKDAY_PLAN_PRODUCTION.md** (post-deploy health, rollback drills, observability, runbooks).
- Tick off remaining items in **PRODUCTION_CHECKLIST.md** per your environment.
