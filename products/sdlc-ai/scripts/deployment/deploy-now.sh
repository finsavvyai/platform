#!/bin/bash

echo "🚀 DEPLOYING SDLC PLATFORM TO PRODUCTION"
echo "=========================================="

# Test authentication
echo "🔐 Testing Cloudflare authentication..."
wrangler whoami

if [ $? -ne 0 ]; then
    echo "❌ Authentication failed. Please check your API token."
    exit 1
fi

echo "✅ Authentication successful!"

# Deploy landing page
echo "🌐 Deploying landing page..."
cd /Users/shaharsolomon/dev/projects/03_Enterprize_application/SDLC/landing-page
npm run deploy

if [ $? -eq 0 ]; then
    echo "✅ Landing page deployed successfully!"
else
    echo "❌ Landing page deployment failed."
fi

# Deploy LAM system
echo "🤖 Deploying LAM system..."
cd /Users/shaharsolomon/dev/projects/03_Enterprize_application/SDLC/services
npm run deploy

if [ $? -eq 0 ]; then
    echo "✅ LAM system deployed successfully!"
else
    echo "❌ LAM system deployment failed."
fi

echo ""
echo "🎉 DEPLOYMENT SUMMARY"
echo "====================="
echo "Landing Page: https://sdlc.finsavvyai.com"
echo "LAM API: Check wrangler output for workers.dev URL"
echo ""
echo "Next steps:"
echo "1. Test landing page functionality"
echo "2. Test API endpoints"
echo "3. Set up custom domain"