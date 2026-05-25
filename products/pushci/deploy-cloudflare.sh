#!/bin/bash
# Deploy PushCI to Cloudflare Pages (free)
# Usage: ./deploy-cloudflare.sh
set -e

echo "======================================="
echo "  PushCI → Cloudflare Pages Deploy"
echo "======================================="

# Landing page
echo "[1/2] Deploying landing page..."
cd web/landing
npm install --silent
npx vite build
npx wrangler pages deploy dist --project-name pushci 2>/dev/null \
  || npx wrangler pages project create pushci --production-branch main 2>/dev/null \
  && npx wrangler pages deploy dist --project-name pushci
echo "  Landing: https://pushci.pages.dev"
cd ../..

# Dashboard
echo "[2/2] Deploying dashboard..."
cd web/dashboard
npm install --silent
npx vite build
npx wrangler pages deploy dist --project-name pushci-app 2>/dev/null \
  || npx wrangler pages project create pushci-app --production-branch main 2>/dev/null \
  && npx wrangler pages deploy dist --project-name pushci-app
echo "  Dashboard: https://pushci-app.pages.dev"
cd ../..

echo ""
echo "======================================="
echo "  Deploy complete"
echo "  Landing:   https://pushci.pages.dev"
echo "  Dashboard: https://pushci-app.pages.dev"
echo "======================================="
