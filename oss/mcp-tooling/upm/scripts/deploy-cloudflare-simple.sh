#!/bin/bash
# Simple Cloudflare Pages deployment for UPM Website

set -e

echo "🚀 Deploying UPM Website to Cloudflare Pages"
echo "============================================="
echo ""

# Check prerequisites
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found"
    echo "Install: npm install -g wrangler"
    exit 1
fi

# Authenticate if needed
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Please authenticate:"
    wrangler login
fi

# Create deployment directory
echo "📦 Preparing files..."
DEPLOY_DIR="cloudflare-pages/public"
mkdir -p "$DEPLOY_DIR"

# Copy website files
echo "📋 Copying website templates..."
cp templates/website/*.html "$DEPLOY_DIR/" 2>/dev/null || {
    echo "❌ Website templates not found"
    exit 1
}

# Create _redirects file for SPA routing
echo "/*    /index.html   200" > "$DEPLOY_DIR/_redirects"

# Deploy
echo ""
echo "🌐 Deploying to Cloudflare Pages..."
cd cloudflare-pages

wrangler pages deploy public --project-name=upm-website

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Website URL: https://upm-website.pages.dev"
echo ""
echo "📝 To connect custom domain:"
echo "1. Go to Cloudflare Dashboard > Pages"
echo "2. Select 'upm-website' project"
echo "3. Go to Custom Domains"
echo "4. Add: upmplus.dev"
echo ""
