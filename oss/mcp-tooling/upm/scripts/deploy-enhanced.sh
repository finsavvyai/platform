#!/bin/bash
# Deploy enhanced website to Cloudflare Pages

set -e

cd "$(dirname "$0")/.."

echo "🚀 Deploying Enhanced UPM Website"
echo "=================================="
echo ""

# Prepare files
echo "📦 Preparing files..."
bash scripts/prepare-cloudflare-pages.sh

# Deploy
echo ""
echo "🌐 Deploying to Cloudflare Pages..."
cd cloudflare-pages
wrangler pages deploy public --project-name=upm-website

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your enhanced website is live at:"
echo "   https://upm-website.pages.dev"
echo ""
echo "💡 If you see the old version:"
echo "   1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
echo "   2. Clear browser cache"
echo "   3. Try incognito/private mode"
echo ""
