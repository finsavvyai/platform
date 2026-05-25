# Deployment Guide — LunaOS Studio

## Environments

| Env | URL | Trigger |
|-----|-----|---------|
| Preview | Auto-generated Netlify URL | Pull Request |
| Staging | `staging.studio.lunaos.ai` | Merge to `develop` |
| Production | `studio.lunaos.ai` | Merge to `main` |

## Prerequisites

- Netlify site configured with environment variables (see below)
- GitHub Actions secrets set (see `.github/workflows/deploy.yml`)
- DataDog and Sentry accounts for monitoring

## Required Environment Variables (Netlify)

```
VITE_API_URL=https://api.lunaos.ai
VITE_SENTRY_DSN=<your-sentry-dsn>
VITE_DATADOG_APP_ID=<your-dd-app-id>
VITE_DATADOG_CLIENT_TOKEN=<your-dd-client-token>
VITE_ENABLE_ANALYTICS=true
VITE_LOG_LEVEL=warn
VITE_NODE_ENV=production
```

## Manual Deployment

```bash
npm run build          # output → dist/
# Deploy dist/ to Netlify, Cloudflare Pages, or any static host
```

## CI/CD Pipeline

All merges to `main` trigger:
1. **Lint** — `npm run lint`
2. **Type-check** — `npm run typecheck`
3. **Unit tests** — `npm test`
4. **Build** — `npm run build`
5. **Deploy to staging** — Netlify preview
6. **Health check** — `scripts/health-check.sh`
7. **Deploy to production** — Netlify production

## Health Check

After every deploy the pipeline runs:
```bash
./scripts/health-check.sh https://studio.lunaos.ai
```

Checks performed:
- HTTP 200 response
- Response time < 5 s
- Expected content present
- Security headers present
- HTTPS enforced
- Asset directory accessible

## Rollback

```bash
./scripts/rollback.sh <previous-deploy-id>
```

Or via Netlify dashboard: Deploys → select previous build → "Publish deploy".

See `docs/ROLLBACK_PROCEDURES.md` for detailed steps.

## Post-Deployment Checklist

- [ ] Health check passes
- [ ] DataDog Operations dashboard shows healthy status
- [ ] Sentry shows no new critical errors
- [ ] Lighthouse scores: Performance ≥ 90, A11y ≥ 95, Best Practices = 100
- [ ] Smoke test: create workflow, add nodes, execute
