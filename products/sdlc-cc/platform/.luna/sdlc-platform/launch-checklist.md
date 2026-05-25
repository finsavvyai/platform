# SDLC Platform — Launch Checklist

**Use this for:** first production or staging cutover, or a new environment (e.g. private beta).

**Launch tier:** Start with **staging or private beta** (invite-only, synthetic or low-risk data) until you have 7+ days of measured SLOs and no open critical security items for your scope.

---

## 1) Gateway (required)

| Step | Action |
|------|--------|
| Build | `cd services/gateway && go test ./...` (must pass) |
| Langfuse compat | **Do not** set `SDLC_LANGFUSE_ENABLED=true` in production until BasicAuth/Bearer resolvers validate against `api_keys` (hashed lookup + tenant binding). Default (unset/false) does not mount the surface. |
| Secrets | Set strong `JWT_SECRET` (or equivalent in your config file). Never commit secrets. |
| Database | Run migrations; confirm PostgreSQL reachable with TLS as configured (`DATABASE_SSL_MODE` / `database.ssl_mode`). |
| Redis | Optional for dev; **recommended** for production rate limiting. If Redis is down, the gateway may disable tier rate limiting (see startup logs). |
| CORS | Set `CORS_ALLOWED_ORIGINS` to your real web origins (avoid `*` in production for credentialed flows). |
| OPA | Ensure `OPA_ENABLED`, `OPA_SERVER_URL` (or bundle) match your policy deployment; review `OPA_DENY_BY_DEFAULT` for your risk tolerance. |
| Environment | Set `ENVIRONMENT=production` (or `staging`) so production validation paths apply. |

Reference: `services/gateway/cmd/server/router.go` (Langfuse gating), `internal/interfaces/http/middleware/chain.go` (middleware order).

---

## 2) Smoke tests (day-of)

Run against the deployed base URL (replace `BASE`):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/health"
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/health/ready"
```

Expect `200` if dependencies are healthy. Add one authenticated call your product actually uses (e.g. login + one API) and confirm `401` without a valid token on a protected path.

---

## 3) Ops & safety

| Item | Notes |
|------|--------|
| `/metrics` | Exposed on the same handler as the app in current setup. Restrict at the load balancer or network (allow only scraper IPs / VPC) if the listener is public. |
| Rollback | Keep previous image/tag and a DB migration down plan only if you use reversible migrations. |
| Incidents | Define on-call and a single channel for launch window. |

---

## 4) After launch (first 7 days)

- Capture **real** latency, error rate, and auth failure metrics in your APM or Prometheus stack.
- Fill out or update:
  - `.luna/sdlc-platform/deployment-report.md` (how/where you deployed, version, config highlights)
  - `.luna/sdlc-platform/monitoring-observability-report.md` (dashboards, alerts, SLOs)
  - `.luna/sdlc-platform/test-validation-report.md` (CI + smoke + any manual QA)
- Re-run `/ll-postlaunch` (or refresh `post-launch-review.md`) with those numbers.

---

## 5) Honest “GA” bar

Full public **GA** with enterprise claims should wait until: global auth + policy behavior is verified end-to-end for your routes, critical integration tests are green in CI, and you have evidence for availability and security controls. Until then, label the release **alpha** or **private beta** in customer-facing copy.

---

## 6) Quick command reference (config)

Environment variables follow Viper’s pattern: nested keys use underscores (e.g. `database.host` → `DATABASE_HOST`). See `services/gateway/internal/infrastructure/config/config.go` for defaults and structure.
