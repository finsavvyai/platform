#!/bin/bash
# Quick Cloudflare Workers Deployment Script

set -e

cd "$(dirname "$0")"

echo "🚀 FinSavvyAI Cloudflare Workers Deployment"
echo "============================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not logged in. Opening browser for authentication..."
    wrangler login
fi

# Show current user
echo ""
echo "✅ Logged in as:"
wrangler whoami

echo ""
echo "📦 Deploying worker..."
echo ""

# Deploy
wrangler deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your worker is now live!"
echo ""
echo "Test it:"
echo "  curl https://finsavvyai-llm-proxy.YOUR_SUBDOMAIN.workers.dev/info"
echo ""
echo "View logs:"
echo "  wrangler tail"
echo ""

