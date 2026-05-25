#!/bin/bash

# Deploy Luna Agents Testing Dashboard to Cloudflare Pages

echo "🚀 Deploying Luna Agents Testing Dashboard..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create clean deployment directory
DEPLOY_DIR="/tmp/dashboard-deploy-$(date +%s)"
mkdir -p "$DEPLOY_DIR"

# Copy dashboard files
echo "📦 Preparing files..."
cp testing-dashboard.html "$DEPLOY_DIR/"
cp TESTING_COMPLETION_SUMMARY.md "$DEPLOY_DIR/" 2>/dev/null
cp TESTING_AUTOMATION_GUIDE.md "$DEPLOY_DIR/" 2>/dev/null
cp QUICK_START_GUIDE.md "$DEPLOY_DIR/" 2>/dev/null
cp PRODUCTION_DEPLOYMENT_GUIDE.md "$DEPLOY_DIR/" 2>/dev/null
cp GO_TO_MARKET_STRATEGY.md "$DEPLOY_DIR/" 2>/dev/null

echo "✅ Files prepared"
echo ""

# Deploy to Cloudflare Pages
echo "🌍 Deploying to Cloudflare Pages..."
cd "$DEPLOY_DIR"
wrangler pages deploy . --project-name=luna-agents-testing

# Cleanup
rm -rf "$DEPLOY_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Deployment complete!"
echo "🌐 Production URL: https://luna-agents-testing.pages.dev"
echo "📱 Preview URL: Check output above"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
