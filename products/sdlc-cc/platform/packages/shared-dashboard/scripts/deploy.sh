#!/bin/bash

# Unified Dashboard Deployment Script
# Automated deployment to Cloudflare Workers with pre-flight checks

set -e

echo "🚀 Unified Dashboard Deployment Script"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Environment (default to production)
ENVIRONMENT=${1:-production}
echo "📦 Environment: $ENVIRONMENT"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: wrangler CLI not found${NC}"
    echo "   Install with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler CLI found"

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Cloudflare${NC}"
    echo "   Running: wrangler login"
    wrangler login
fi

echo "✅ Cloudflare authentication verified"
echo ""

# Type check
echo "🔍 Running type check..."
npm run type-check
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# Linting
echo "🔍 Running linter..."
npm run lint:check
echo -e "${GREEN}✅ Linting passed${NC}"
echo ""

# Build
echo "🏗️  Building project..."
npm run build
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# Run tests
echo "🧪 Running tests..."
npm test
echo -e "${GREEN}✅ Tests passed${NC}"
echo ""

# Confirm deployment
echo -e "${YELLOW}📋 Deployment Summary:${NC}"
echo "   Environment: $ENVIRONMENT"
echo "   Worker Name: unified-dashboard-api-${ENVIRONMENT}"
echo ""

read -p "Continue with deployment? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Deploy
echo ""
echo "🚢 Deploying to Cloudflare Workers..."
wrangler deploy --env=$ENVIRONMENT

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""

# Show deployment info
echo "📊 Deployment Information:"
wrangler deployments list --env=$ENVIRONMENT | head -5

echo ""
echo "🌐 Your dashboard should be available at:"
if [ "$ENVIRONMENT" == "production" ]; then
    echo "   https://dashboard.finsavvyai.com"
    echo "   https://api.dashboard.finsavvyai.com"
else
    echo "   https://unified-dashboard-api-dev.workers.dev"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Verify the deployment: curl https://your-domain.com/health"
echo "   2. Check logs: wrangler tail --env=$ENVIRONMENT"
echo "   3. Monitor metrics in Cloudflare dashboard"
echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
