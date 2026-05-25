#!/bin/bash

###############################################################################
# Google Analytics Setup Script
# Adds Google Analytics tracking code to landing and investor pages
###############################################################################

set -e

echo "📊 Google Analytics Setup"
echo "========================="
echo ""

# Check if GA_MEASUREMENT_ID is provided
if [ -z "$1" ]; then
  echo "❌ Error: Google Analytics Measurement ID required"
  echo ""
  echo "Usage: ./setup-analytics.sh G-XXXXXXXXXX"
  echo ""
  echo "Steps to get your Measurement ID:"
  echo "1. Go to https://analytics.google.com"
  echo "2. Click 'Admin' (bottom left)"
  echo "3. Click 'Create Property'"
  echo "4. Property name: 'SDLC.ai Website'"
  echo "5. Select industry: Technology → Software"
  echo "6. Complete setup wizard"
  echo "7. Copy your Measurement ID (format: G-XXXXXXXXXX)"
  echo "8. Run: ./setup-analytics.sh G-XXXXXXXXXX"
  echo ""
  exit 1
fi

GA_ID="$1"
LANDING_PAGE="../../web-app/landing/index.html"
INVESTOR_PAGE="../../web-app/landing/investors.html"

echo "🔧 Configuration:"
echo "  Measurement ID: $GA_ID"
echo "  Landing page: $LANDING_PAGE"
echo "  Investor page: $INVESTOR_PAGE"
echo ""

# Google Analytics tracking code
read -r -d '' GA_CODE << EOM || true
    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}', {
        'anonymize_ip': true,
        'cookie_flags': 'SameSite=None;Secure'
      });
    </script>
EOM

# Function to add GA code before </head>
add_analytics() {
  local file=$1
  local temp_file="${file}.tmp"

  # Check if GA is already added
  if grep -q "gtag/js?id=${GA_ID}" "$file"; then
    echo "⏭️  Analytics already added to $(basename $file)"
    return 0
  fi

  # Add GA code before </head>
  awk -v ga_code="$GA_CODE" '
    /<\/head>/ {
      print ga_code
    }
    { print }
  ' "$file" > "$temp_file"

  mv "$temp_file" "$file"
  echo "✅ Added analytics to $(basename $file)"
}

# Add to landing page
if [ -f "$LANDING_PAGE" ]; then
  add_analytics "$LANDING_PAGE"
else
  echo "⚠️  Landing page not found: $LANDING_PAGE"
fi

# Add to investor page
if [ -f "$INVESTOR_PAGE" ]; then
  add_analytics "$INVESTOR_PAGE"
else
  echo "⚠️  Investor page not found: $INVESTOR_PAGE"
fi

echo ""
echo "✨ Google Analytics setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy changes: cd ../../web-app/landing && npx wrangler pages deploy ."
echo "2. Visit your site to generate first pageview"
echo "3. Check analytics: https://analytics.google.com"
echo "4. Data will appear within 24-48 hours"
echo ""
echo "📊 What you can track:"
echo "  • Organic traffic (from Google search)"
echo "  • Social traffic (LinkedIn, Twitter, Reddit, HN)"
echo "  • User demographics and interests"
echo "  • Bounce rate and time on page"
echo "  • Conversion tracking (sign-ups, demo requests)"
echo ""
