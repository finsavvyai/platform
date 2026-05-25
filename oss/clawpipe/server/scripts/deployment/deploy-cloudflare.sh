#!/bin/bash

echo "🚀 FinSavvyAI Cloudflare Deployment Script"
echo "======================================"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if user is logged in
echo "🔐 Checking authentication..."
wrangler whoami

if [ $? -ne 0 ]; then
    echo "Please login to Cloudflare:"
    wrangler login
    exit 1
fi

# Change to cloudflare directory
cd cloudflare-api

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Test configuration
echo "🧪 Testing configuration..."
wrangler dev --port 8787 &

# Wait for dev server
sleep 5

echo "🌐 Testing local dev server..."
curl -s http://localhost:8787/health

if [ $? -eq 0 ]; then
    echo "✅ Local test successful!"
else
    echo "⚠️ Local test failed, but continuing with deployment..."
fi

# Stop dev server
pkill -f "wrangler dev"

# Deploy to Cloudflare
echo "🌍 Deploying to Cloudflare..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "========================"
    echo "🔗 Your FinSavvyAI cluster is now accessible at:"
    echo "   https://llm.finsavvyai.com"
    echo ""
    echo "📱 Mobile App Configuration:"
    echo "   Base URL: https://llm.finsavvyai.com"
    echo "   API Key: finsavvy-5d19b8e7c71d4679"
    echo ""
    echo "🧪 Test the deployment:"
    echo "   curl https://llm.finsavvyai.com/health"
    echo "   curl https://llm.finsavvyai.com/v1/models"
    echo ""
    echo "💡 Make sure your local cluster is running when testing!"
else
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi
