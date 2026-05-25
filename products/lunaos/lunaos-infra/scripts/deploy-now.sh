#!/bin/bash

# Quick deployment script that reloads token from zshrc

echo "🔄 Reloading Cloudflare token..."

# Extract token from zshrc
export CLOUDFLARE_API_TOKEN=$(grep 'export CLOUDFLARE_API_TOKEN' ~/.zshrc | tail -1 | sed 's/.*CLOUDFLARE_API_TOKEN=//' | tr -d '"' | tr -d "'")

echo "✅ Token loaded (first 20 chars): ${CLOUDFLARE_API_TOKEN:0:20}"
echo ""

# Create Pages project
echo "📦 Creating Cloudflare Pages project..."
wrangler pages project create luna-agents --production-branch=main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Project created!"
    echo ""
    echo "🚀 Deploying website..."
    wrangler pages deploy website --project-name=luna-agents --commit-dirty=true
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Deployment successful!"
        echo ""
        echo "🌐 Your website is live at:"
        echo "   https://luna-agents.pages.dev"
        echo ""
        echo "📝 Next: Add custom domain agent.lunaos.ai in Cloudflare Dashboard"
    fi
else
    echo ""
    echo "⚠️  Project might already exist. Trying to deploy anyway..."
    echo ""
    wrangler pages deploy website --project-name=luna-agents --commit-dirty=true
fi
