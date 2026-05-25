#!/bin/bash
# Configure Cloudflare Pages project with wrangler

set -e

echo "⚙️  Configuring Cloudflare Pages for UPM"
echo "======================================="
echo ""

cd "$(dirname "$0")/../cloudflare-pages"

# Set environment variables
echo "📝 Setting environment variables..."
echo ""

# Set BACKEND_URL
echo "Setting BACKEND_URL..."
echo "http://34.29.39.106:8040" | wrangler pages secret put BACKEND_URL --project-name=upm-website 2>&1 || {
    echo "⚠️  Note: Secrets must be set via Cloudflare Dashboard"
    echo "   Go to: Pages > upm-website > Settings > Environment Variables"
    echo "   Add: BACKEND_URL = http://34.29.39.106:8040"
}

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Current Status:"
echo "   Project: upm-website"
echo "   URL: https://upm-website.pages.dev"
echo ""
echo "🌐 To connect custom domain (upmplus.dev):"
echo "   1. Go to: https://dash.cloudflare.com"
echo "   2. Navigate to: Pages > upm-website"
echo "   3. Click: Custom Domains"
echo "   4. Add: upmplus.dev"
echo "   5. Follow DNS setup instructions"
echo ""
echo "💡 Note: Custom domains must be configured via Cloudflare Dashboard"
echo "   Wrangler CLI doesn't support domain management for Pages"
echo ""
