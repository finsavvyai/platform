#!/bin/bash
# Prepare static files for Cloudflare Pages deployment

set -e

echo "📦 Preparing UPM Website for Cloudflare Pages"
echo "============================================="
echo ""

# Create public directory
PUBLIC_DIR="cloudflare-pages/public"
mkdir -p "$PUBLIC_DIR"

echo "📋 Copying website files..."

# Copy all HTML files
if [ -d "templates/website" ]; then
    cp templates/website/*.html "$PUBLIC_DIR/"
    echo "✅ HTML files copied"
else
    echo "❌ templates/website directory not found"
    exit 1
fi

# Create _redirects for routing (200 = rewrite, not redirect)
cat > "$PUBLIC_DIR/_redirects" << 'EOF'
# Map routes to HTML files
/pricing    /pricing.html    200
/docs       /docs.html       200
/about      /about.html      200
/blog       /blog.html       200
# SPA fallback - must be last
/*    /index.html   200
EOF
echo "✅ Redirects configured"

# Create _headers for security
cat > "$PUBLIC_DIR/_headers" << 'EOF'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
EOF
echo "✅ Security headers configured"

# Create .gitignore if deploying via git
cat > "$PUBLIC_DIR/.gitignore" << 'EOF'
# Cloudflare Pages
.wrangler/
node_modules/
EOF

echo ""
echo "✅ Files prepared in: $PUBLIC_DIR"
echo ""
echo "📊 Files ready for deployment:"
ls -lh "$PUBLIC_DIR"/*.html 2>/dev/null | awk '{print "   - " $9 " (" $5 ")"}'
echo ""
echo "🚀 Ready to deploy!"
echo "   Run: cd cloudflare-pages && wrangler pages deploy public --project-name=upm-website"
echo ""
