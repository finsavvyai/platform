#!/bin/bash
set -e

echo "=== AMLIQ Deployment Script ==="
echo ""

# Step 1: Push to GitHub
echo "📦 Step 1: Pushing to GitHub..."
cd "$(dirname "$0")"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin https://github.com/finsavvyai/aegis.git
fi
git push -u origin main
echo "✅ Pushed to GitHub"
echo ""

# Step 2: Build React frontend
echo "🔨 Step 2: Building React frontend..."
cd web
npm install
npx vite build
echo "✅ Frontend built"
echo ""

# Step 3: Deploy to Cloudflare Pages
echo "🚀 Step 3: Deploying to Cloudflare Pages..."
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN env var not set. Export it before running deploy."
  exit 1
fi
npx wrangler pages project create aegis --production-branch main 2>/dev/null || true
npx wrangler pages deploy dist --project-name aegis
echo ""
echo "✅ Deployed to Cloudflare Pages!"
echo ""
echo "🌐 Your site is live at: https://aegis.pages.dev"
echo "📂 GitHub repo: https://github.com/finsavvyai/aegis"
