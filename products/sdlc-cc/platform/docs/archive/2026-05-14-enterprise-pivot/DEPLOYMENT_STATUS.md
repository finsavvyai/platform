# Deployment Status & Readiness

**Last updated:** 2026-03-16

## Current deployment path (Cloudflare)

Production deploy for **Proxy Worker** and **Landing Page** is via:

```bash
./scripts/deploy-production-cloudflare.sh
```

- **Proxy Worker:** `services/proxy-worker` → Cloudflare Worker `sdlc-proxy` (route: `api.sdlc.cc/*`)
- **Landing Page:** `landing-page` → Cloudflare Pages (build: `@cloudflare/next-on-pages`, output: `.vercel/output/static`)

## Pre-deployment checklist

- [ ] **Wrangler auth:** Run `wrangler auth login`; then `wrangler whoami` succeeds (or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in CI)
- [ ] **Proxy Worker:** In `services/proxy-worker`, secrets set if required: `BACKEND_URL`, `OPENAI_API_KEY`, `API_KEY_SECRET` (see `wrangler.toml` comments)
- [ ] **Landing Page:** Dependencies installed (`cd landing-page && npm ci`), build succeeds: `npm run pages:build`
- [ ] **Optional – health checks:** After deploy, run with URLs that match your deployment:
  - Cloudflare-only (no Go gateway):  
    `GATEWAY_REQUIRED=false LANDING_URL=https://sdlc.cc node run-health-checks.js`  
    (from `deployments/production/`)
  - With Go gateway:  
    `GATEWAY_URL=https://api.sdlc.cc LANDING_URL=https://sdlc.cc node run-health-checks.js`

## Health check note

- **Proxy Worker** exposes `/health` (not `/api/health`). The script in `deployments/production/run-health-checks.js` expects a **Gateway** at `GATEWAY_URL/api/health`. For Cloudflare-only deploys, use `GATEWAY_REQUIRED=false` so only the Landing (and optional RAG) checks run.

## Other deployment paths

- **Full production (Kubernetes + Cloudflare):** See `.github/workflows/production-deploy.yml` and `docs/runbooks/production-runbook.md`. Requires infra (Terraform, EKS, secrets) and is not required for the Cloudflare-only path above.
- **Infra Cloudflare script:** `infra/cloudflare/scripts/deploy.sh` targets `infra/cloudflare/workers` (separate from `services/proxy-worker`).

## Custom domain for Pages (sdlc.cc)

To serve the landing page at **sdlc.cc** (or your domain):

1. **Cloudflare Dashboard:** Workers & Pages → **Pages** → **sdlc-landing-page** → **Custom domains**.
2. Click **Set up a custom domain**, enter `sdlc.cc` (or e.g. `www.sdlc.cc`).
3. If the domain is already on Cloudflare (same account), DNS is updated automatically. Otherwise add the CNAME record shown.
4. Wait for SSL to provision; the deployment will then be live at the custom domain.

The proxy worker is already on **api.sdlc.cc** via `services/proxy-worker/wrangler.toml` (route `api.sdlc.cc/*`, zone `sdlc.cc`).

## Quick verify after deploy

```bash
# Proxy (if deployed)
curl -s https://api.sdlc.cc/health

# Landing
curl -sI https://sdlc.cc
```

## Notes

- **Multiple lockfiles warning:** Next.js may warn about `landing-page/package-lock.json` and the root `package-lock.json`. This is expected: the landing app is not in the root workspace and keeps its own lockfile for reproducible installs. The warning is safe to ignore.

## Troubleshooting

- **Landing `pages:build` fails at `@cloudflare/next-on-pages`:** The Next.js build often succeeds; the failure can be in the Vercel CLI step (esbuild binary 0.14.47 vs 0.15.18). Landing is not in the root npm workspace so it has its own `node_modules` and `overrides.esbuild`; deploy uses `--no-bundle` to avoid wrangler’s es2024 target error. If issues persist, try from a clean clone or run `npm run pages:build` from `landing-page/` with only that directory’s dependencies (`rm -rf node_modules .next .vercel && npm ci && npm run pages:build`). If using a monorepo root install, ensure no conflicting lockfiles or hoisted deps (see warning about multiple lockfiles).
- **Proxy deploy:** Ensure you are in `services/proxy-worker` when running `npx wrangler deploy` (the script does this); secrets must be set in the Cloudflare dashboard or via `wrangler secret put`.
