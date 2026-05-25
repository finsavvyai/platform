#!/usr/bin/env bash
# One-shot deploy via Cloudflare wrangler — gateway + landing + dashboard.
# Credentials from pushci secret store, or env.
#
# Setup:
#   pushci secret set CLOUDFLARE_API_TOKEN <token>
#   pushci secret set CLOUDFLARE_ACCOUNT_ID <id>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

secret() {
  if [[ -n "${!1:-}" ]]; then echo "${!1}"; return; fi
  if [[ -f "$ROOT/.env" ]]; then
    local v
    v=$(grep -E "^${1}=" "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"'"'" || true)
    if [[ -n "$v" ]]; then echo "$v"; return; fi
  fi
  if command -v pushci >/dev/null 2>&1; then
    pushci secret get "$1" 2>/dev/null || true
  fi
}

export CLOUDFLARE_API_TOKEN="$(secret CLOUDFLARE_API_TOKEN)"
export CLOUDFLARE_ACCOUNT_ID="$(secret CLOUDFLARE_ACCOUNT_ID)"

if [[ -z "$CLOUDFLARE_API_TOKEN" || -z "$CLOUDFLARE_ACCOUNT_ID" ]]; then
  echo "❌ Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID."
  echo "   Run: pushci secret set CLOUDFLARE_API_TOKEN <token>"
  echo "   Run: pushci secret set CLOUDFLARE_ACCOUNT_ID <id>"
  exit 1
fi

echo "==> Gateway (Workers)"
cd "$ROOT/gateway"
npm ci
npx wrangler deploy

echo "==> Landing (Pages)"
cd "$ROOT"
npx wrangler pages deploy landing-page --project-name=clawpipe --commit-dirty=true

echo "==> Dashboard (Pages)"
cd "$ROOT"
npx wrangler pages deploy dashboard --project-name=clawpipe-dashboard --commit-dirty=true

echo
echo "✅ Deployed."
