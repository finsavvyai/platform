#!/usr/bin/env bash
# Deploy agents.lunaos.ai to Cloudflare Pages via wrangler.
# Usage: bash site/scripts/deploy.sh [--preview]
# Run from repo root.

set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CF_PROJECT="agents-lunaos-ai"
BRANCH="main"

if [[ "${1:-}" == "--preview" ]]; then
  BRANCH="preview-$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
fi

cd "$SITE_DIR"

# Prefer CI tokens if exported; else fall back to interactive wrangler login.
# CI convention: secrets are `cf-write-token` and `cf-account-id`. PushCI maps them
# to CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID before running this script.
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if ! npx wrangler whoami >/dev/null 2>&1; then
    echo "no CLOUDFLARE_API_TOKEN and wrangler not authed."
    echo "either:  export CLOUDFLARE_API_TOKEN=\$cf_write_token  CLOUDFLARE_ACCOUNT_ID=\$cf_account_id"
    echo "or:      wrangler login"
    exit 2
  fi
fi

echo "[1/3] install"
npm ci --silent

echo "[2/3] build"
npm run build

echo "[3/3] deploy to Cloudflare Pages (project=$CF_PROJECT branch=$BRANCH)"
COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
MSG="$(git log -1 --pretty=%s 2>/dev/null || echo manual)"

npx wrangler pages deploy dist \
  --project-name "$CF_PROJECT" \
  --branch "$BRANCH" \
  --commit-hash "$COMMIT" \
  --commit-message "$MSG"

echo
echo "done. https://$CF_PROJECT.pages.dev  (custom domain: agents.lunaos.ai)"
