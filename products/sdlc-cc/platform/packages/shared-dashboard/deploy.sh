#!/bin/bash

# Unified Dashboard Deployment Script
# Automates the complete deployment process

set -e  # Exit on error

echo "🚀 Starting Unified Dashboard Deployment"
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install: npm install -g wrangler${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build TypeScript
echo -e "${YELLOW}🔨 Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"

# Check if D1 database exists
echo -e "${YELLOW}🗄️  Checking D1 database...${NC}"
if wrangler d1 info unified_dashboard &> /dev/null; then
    echo -e "${GREEN}✅ D1 database exists${NC}"
else
    echo -e "${YELLOW}Creating D1 database...${NC}"
    wrangler d1 create unified_dashboard
    echo -e "${GREEN}✅ D1 database created${NC}"
fi

# Run database migrations
echo -e "${YELLOW}📊 Running database migrations...${NC}"
wrangler d1 execute unified_dashboard --file=src/worker/schema.sql
echo -e "${GREEN}✅ Database migrations complete${NC}"

# Check if KV namespace exists
echo -e "${YELLOW}🔑 Checking KV namespace...${NC}"
if wrangler kv:namespace list | grep -q "DASHBOARD_CACHE"; then
    echo -e "${GREEN}✅ KV namespace exists${NC}"
else
    echo -e "${YELLOW}Creating KV namespace...${NC}"
    wrangler kv:namespace create DASHBOARD_CACHE
    echo -e "${GREEN}✅ KV namespace created${NC}"
    echo -e "${YELLOW}⚠️  Please update wrangler.toml with the KV namespace ID${NC}"
fi

# Deploy to Cloudflare Workers
echo -e "${YELLOW}🌐 Deploying to Cloudflare Workers...${NC}"
wrangler deploy --config wrangler.toml
echo -e "${GREEN}✅ Deployment complete${NC}"

# Test the deployment
echo -e "${YELLOW}🧪 Testing deployment...${NC}"
HEALTH_URL="https://api.dashboard.finsavvyai.com/health"
if curl -s "$HEALTH_URL" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Health check returned unexpected response${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Deployment Successful!${NC}"
echo "========================================"
echo -e "Dashboard URL: ${GREEN}https://dashboard.finsavvyai.com${NC}"
echo -e "API URL: ${GREEN}https://api.dashboard.finsavvyai.com${NC}"
echo ""
echo "Next steps:"
echo "1. Update DNS records to point to Cloudflare Workers"
echo "2. Configure service bindings for all products"
echo "3. Set up monitoring and alerting"
echo "4. Test WebSocket connections"
echo ""
echo -e "${YELLOW}📖 See IMPLEMENTATION_GUIDE.md for more details${NC}"
