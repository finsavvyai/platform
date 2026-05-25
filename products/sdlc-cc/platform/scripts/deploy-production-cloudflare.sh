#!/usr/bin/env bash
# Deploy SDLC Platform to production (Cloudflare: Proxy Worker + Landing Page).
# Usage: [PROXY_ONLY=1] [LANDING_ONLY=1] ./scripts/deploy-production-cloudflare.sh
# Requires: wrangler auth, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for CI.
# See: docs/runbooks/production-runbook.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DEPLOY_PROXY=${PROXY_ONLY:-0}
DEPLOY_LANDING=${LANDING_ONLY:-0}
if [[ "${DEPLOY_PROXY}" == "1" ]]; then DEPLOY_LANDING=0; fi
if [[ "${DEPLOY_LANDING}" == "1" ]]; then DEPLOY_PROXY=0; fi
if [[ "${DEPLOY_PROXY}" != "1" && "${DEPLOY_LANDING}" != "1" ]]; then
  DEPLOY_PROXY=1
  DEPLOY_LANDING=1
fi

echo "[deploy] Checking wrangler..."
if ! command -v wrangler &>/dev/null; then
  echo "[deploy] Install wrangler: npm i -g wrangler" >&2
  exit 1
fi
if ! wrangler whoami &>/dev/null; then
  echo "[deploy] Run: wrangler auth login (or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)" >&2
  exit 1
fi

if [[ "${DEPLOY_PROXY}" == "1" ]]; then
  echo "[deploy] Deploying Proxy Worker..."
  (cd services/proxy-worker && npx wrangler deploy)
fi

if [[ "${DEPLOY_LANDING}" == "1" ]]; then
  echo "[deploy] Building and deploying Landing Page to Cloudflare Pages..."
  (cd landing-page && npm install && npm run pages:deploy)
fi

echo "[deploy] Production deploy (Cloudflare) complete."
echo "[deploy] Optional health checks:"
echo "  cd deployments/production"
echo "  GATEWAY_REQUIRED=false LANDING_URL=https://sdlc.cc node run-health-checks.js"
echo "  (Or with Gateway: GATEWAY_URL=https://api.sdlc.cc LANDING_URL=https://sdlc.cc node run-health-checks.js)"
