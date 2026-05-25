#!/bin/bash

# 🚀 LUNA AGENTS - ONE-CLICK DEPLOYMENT SCRIPT
# Run this tomorrow morning to deploy everything in 30 minutes

set -e  # Exit on error

echo "🚀 LUNA AGENTS DEPLOYMENT STARTING..."
echo ""
echo "This script will deploy:"
echo "1. Landing page to Cloudflare Pages"
echo "2. Set up analytics"
echo "3. Configure email forms"
echo ""
echo "Press CTRL+C to cancel, or ENTER to continue..."
read

# ============================================
# STEP 1: Deploy Landing Page
# ============================================

echo ""
echo "📦 STEP 1: Deploying Landing Page..."
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Login to Cloudflare (will open browser)
echo "Please log in to Cloudflare (browser will open)..."
wrangler login

# Deploy to Cloudflare Pages
echo "Deploying to Cloudflare Pages..."
cd frontend
wrangler pages deploy . --project-name=luna-agents --branch=main

# Get the deployment URL
DEPLOY_URL=$(wrangler pages deployment list --project-name=luna-agents | grep -o 'https://[^[:space:]]*' | head -1)

echo ""
echo "✅ Landing page deployed!"
echo "🌐 URL: $DEPLOY_URL"
echo ""

# Save URL for later use
echo "$DEPLOY_URL" > ../deployment_url.txt

# ============================================
# STEP 2: Set Up Analytics
# ============================================

echo ""
echo "📊 STEP 2: Setting up Analytics..."
echo ""

echo "Please create a Google Analytics property:"
echo "1. Go to: https://analytics.google.com"
echo "2. Create property: 'Luna Agents'"
echo "3. Copy your Measurement ID (starts with G-)"
echo ""
echo "Paste your Google Analytics Measurement ID here:"
read GA_ID

# Update landing page with GA ID
sed -i.bak "s/YOUR_GA_ID/$GA_ID/g" landing-page.html

# Re-deploy with analytics
wrangler pages deploy . --project-name=luna-agents --branch=main

echo ""
echo "✅ Analytics configured!"
echo ""

# ============================================
# STEP 3: Set Up Email Form
# ============================================

echo ""
echo "📧 STEP 3: Setting up Email Capture..."
echo ""

echo "Choose email service:"
echo "1. FormSpree (easiest, free for 50/month)"
echo "2. Google Sheets (100% free, requires Apps Script)"
echo "3. SendGrid (for automation)"
echo ""
echo "Enter choice (1/2/3):"
read EMAIL_CHOICE

if [ "$EMAIL_CHOICE" = "1" ]; then
    echo ""
    echo "Setting up FormSpree:"
    echo "1. Go to: https://formspree.io"
    echo "2. Sign up (free)"
    echo "3. Create new form"
    echo "4. Copy your form endpoint (looks like: https://formspree.io/f/xxxxx)"
    echo ""
    echo "Paste FormSpree endpoint here:"
    read FORMSPREE_ENDPOINT

    # Update form action
    sed -i.bak "s|action=\"#\"|action=\"$FORMSPREE_ENDPOINT\"|g" landing-page.html

    # Re-deploy
    wrangler pages deploy . --project-name=luna-agents --branch=main

    echo "✅ FormSpree configured!"

elif [ "$EMAIL_CHOICE" = "2" ]; then
    echo ""
    echo "Setting up Google Sheets:"
    echo "1. Go to: https://docs.google.com/spreadsheets"
    echo "2. Create new sheet: 'Luna Waitlist'"
    echo "3. Add headers: Email | Name | Date | Source"
    echo "4. Go to Extensions > Apps Script"
    echo "5. Paste this code:"
    echo ""
    cat <<'EOF'
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.email,
    data.name || '',
    new Date(),
    data.source || 'landing-page'
  ]);
  return ContentService.createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
EOF
    echo ""
    echo "6. Deploy as Web App (Anyone can access)"
    echo "7. Copy the Web App URL"
    echo ""
    echo "Paste Google Apps Script Web App URL here:"
    read SCRIPT_URL

    sed -i.bak "s|action=\"#\"|action=\"$SCRIPT_URL\"|g" landing-page.html
    wrangler pages deploy . --project-name=luna-agents --branch=main

    echo "✅ Google Sheets configured!"

elif [ "$EMAIL_CHOICE" = "3" ]; then
    echo ""
    echo "Setting up SendGrid:"
    echo "Please complete SendGrid setup manually following these steps:"
    echo "1. Go to: https://sendgrid.com"
    echo "2. Create account"
    echo "3. Create API key"
    echo "4. Import email templates from: frontend/email-templates/"
    echo ""
    echo "Press ENTER when done..."
    read

    echo "✅ SendGrid ready (manual setup required)"
fi

# ============================================
# STEP 4: Summary
# ============================================

echo ""
echo "=========================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "✅ Landing page: $DEPLOY_URL"
echo "✅ Analytics: Tracking with $GA_ID"
echo "✅ Email capture: Configured"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. Test the landing page:"
echo "   - Visit: $DEPLOY_URL"
echo "   - Submit email form (test)"
echo "   - Check mobile responsive"
echo ""
echo "2. Set up custom domain (optional):"
echo "   - Buy luna-agents.dev"
echo "   - Point DNS to Cloudflare"
echo "   - Update Pages project"
echo ""
echo "3. Start marketing:"
echo "   - Post on Twitter (templates in: social-media/)"
echo "   - Send beta DMs (templates in: beta-recruitment/)"
echo "   - Create LinkedIn page"
echo ""
echo "4. Track metrics:"
echo "   - Google Analytics: https://analytics.google.com"
echo "   - Email signups: Check your email service"
echo ""
echo "=========================================="
echo "🐱 REMEMBER THE MISSION:"
echo "Every signup = Potential customer"
echo "Every customer = Revenue"
echo "Every dollar = Saving cats like Luna"
echo "=========================================="
echo ""
echo "Want to open the deployed site now? (y/n)"
read OPEN_SITE

if [ "$OPEN_SITE" = "y" ]; then
    open "$DEPLOY_URL"
fi

echo ""
echo "🚀 Ready to launch! Good luck!"
echo ""

# Save deployment info
cat > ../DEPLOYMENT_INFO.txt <<EOF
DEPLOYMENT COMPLETED: $(date)

Landing Page URL: $DEPLOY_URL
Google Analytics: $GA_ID
Email Service: Choice $EMAIL_CHOICE

Next Steps:
1. Test landing page
2. Create Twitter account @lunaagentsai
3. Create LinkedIn company page
4. Send first 10 beta DMs
5. Post first tweet

Revenue Target:
- Week 1: 100 signups
- Week 2: 50 beta users
- Week 3: Product Hunt launch
- Week 4: First paying customers

Mission: Save cats like Luna! 🐱
EOF

echo "Deployment info saved to: DEPLOYMENT_INFO.txt"
