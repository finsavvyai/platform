#!/usr/bin/env bash
#
# Manual landing page deploy — fallback for when PushCI isn't available.
#
# This does exactly what the `landing` stage in pushci.yml does:
# 1. Validates landing-page/deploy/ exists
# 2. Deploys to Cloudflare Pages (tenantiq-landing project)
# 3. Verifies https://tenantiq.app returns 200
#
# Requirements:
#   - wrangler CLI installed (npm i -g wrangler or uses pnpm dlx)
#   - CLOUDFLARE_API_TOKEN set in env
#   - CLOUDFLARE_ACCOUNT_ID set in env
#
# Usage:
#   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy bash scripts/deploy-landing.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/landing-page/deploy"
PROJECT_NAME="tenantiq-landing"
VERIFY_URL="https://tenantiq.app"

echo "─────────────────────────────────────────"
echo "  TenantIQ Landing Page Deploy"
echo "─────────────────────────────────────────"

# 1. Validate deploy directory
if [[ ! -d "$DEPLOY_DIR" ]]; then
  echo "Error: $DEPLOY_DIR not found"
  exit 1
fi

if [[ ! -f "$DEPLOY_DIR/index.html" ]]; then
  echo "Error: $DEPLOY_DIR/index.html not found"
  exit 1
fi

echo "Deploy directory: $DEPLOY_DIR"
echo "Files:"
ls -la "$DEPLOY_DIR" | tail -n +2 | awk '{print "  " $NF}' | grep -v '^\s*$'
echo ""

# 2. Check credentials
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN not set"
  echo "Get one at: https://dash.cloudflare.com/profile/api-tokens"
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "Error: CLOUDFLARE_ACCOUNT_ID not set"
  echo "Find it at: https://dash.cloudflare.com → right sidebar"
  exit 1
fi

# 3. Deploy
echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy "$DEPLOY_DIR" \
  --project-name="$PROJECT_NAME" \
  --branch=main \
  --commit-dirty=true

echo ""
echo "Deploy submitted. Verifying..."

# 4. Verify (6 retries × 10s = 60s max wait)
for i in 1 2 3 4 5 6; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$VERIFY_URL" || echo "000")
  if [[ "$status" == "200" ]]; then
    echo "OK — $VERIFY_URL returned 200 (attempt $i)"
    echo ""
    echo "Done. Hard-refresh your browser (Cmd+Shift+R) to see changes."
    exit 0
  fi
  echo "Attempt $i/6: got $status, retrying in 10s..."
  sleep 10
done

echo ""
echo "Verification failed — $VERIFY_URL didn't return 200 after 60s"
echo "Check Cloudflare Pages dashboard: https://dash.cloudflare.com"
exit 1
