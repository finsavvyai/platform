#!/bin/bash
# Deploy UPM Website to Cloudflare Pages - Simple & Direct

set -e

echo "🚀 Deploying UPM Website to Cloudflare Pages"
echo "============================================="
echo ""

# Check prerequisites
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g wrangler"
    exit 1
fi

# Check authentication
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not authenticated with Cloudflare"
    echo "Running: wrangler login"
    wrangler login
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Create deployment directory
DEPLOY_DIR="cloudflare-pages/public"
echo "📦 Preparing deployment files..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy website HTML files
echo "📋 Copying website templates..."
if [ -d "templates/website" ]; then
    cp templates/website/*.html "$DEPLOY_DIR/" 2>/dev/null || true
    
    # Verify files were copied
    if [ -f "$DEPLOY_DIR/index.html" ]; then
        echo "✅ Website files copied successfully"
        echo "   - index.html"
        ls -1 "$DEPLOY_DIR"/*.html 2>/dev/null | wc -l | xargs echo "   - Total HTML files:"
    else
        echo "❌ index.html not found in templates/website/"
        exit 1
    fi
else
    echo "❌ templates/website directory not found"
    exit 1
fi

# Create _redirects for SPA routing
echo "/*    /index.html   200" > "$DEPLOY_DIR/_redirects"

# Create _headers for security
cat > "$DEPLOY_DIR/_headers" << EOF
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
EOF

echo "✅ Security headers configured"
echo ""

# Deploy to Cloudflare Pages
echo "🌐 Deploying to Cloudflare Pages..."
cd cloudflare-pages

# Deploy
wrangler pages deploy public --project-name=upm-website

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your website is now live at:"
echo "   https://upm-website.pages.dev"
echo ""
echo "📝 Next steps to connect custom domain (upmplus.dev):"
echo "1. Go to: https://dash.cloudflare.com"
echo "2. Navigate to: Pages > upm-website"
echo "3. Go to: Custom Domains"
echo "4. Add: upmplus.dev"
echo "5. Follow DNS setup instructions"
echo ""
echo "💡 The website will automatically proxy API requests to your backend"
echo ""
