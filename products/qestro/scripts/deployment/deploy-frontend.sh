#!/bin/bash

echo "🚀 Deploying Questro Frontend to Cloudflare Pages"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "${BLUE}Step 1: Pre-flight Checks${NC}"
echo "----------------------------"

# Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: frontend directory not found. Run from project root.${NC}"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${YELLOW}⚠️  Wrangler CLI not found. Installing...${NC}"
    npm install -g wrangler
fi

# Check authentication
echo -n "Checking Cloudflare authentication: "
if wrangler whoami &> /dev/null; then
    echo -e "${GREEN}✓ Authenticated${NC}"
else
    echo -e "${RED}❌ Not authenticated. Run 'wrangler login' first.${NC}"
    exit 1
fi

echo ""
echo "${BLUE}Step 2: Building Frontend${NC}"
echo "---------------------------"

cd frontend

# Install dependencies
echo "Installing dependencies..."
npm ci

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Build the project
echo "Building for production..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Verify build output
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build output directory not found${NC}"
    exit 1
fi

echo ""
echo "${BLUE}Step 3: Configuration Check${NC}"
echo "------------------------------"

# Check wrangler.toml
if [ ! -f "wrangler.toml" ]; then
    echo -e "${RED}❌ wrangler.toml not found${NC}"
    exit 1
fi

echo "Checking API URLs in configuration..."
if grep -q "api.qestro.app" wrangler.toml; then
    echo -e "${GREEN}✓ API URLs configured for qestro.app${NC}"
else
    echo -e "${YELLOW}⚠️  API URLs may need manual verification${NC}"
fi

echo ""
echo "${BLUE}Step 4: Deployment${NC}"
echo "-------------------"

echo "Deploying to Cloudflare Pages..."

# Deploy to production
wrangler pages deploy dist --project-name questro-frontend

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

echo ""
echo "${BLUE}Step 5: Post-deployment Verification${NC}"
echo "------------------------------------"

echo "Your frontend should be available at:"
echo "  • https://qestro.app"
echo "  • https://qestro.io"
echo ""
echo "API endpoints should be available at:"
echo "  • https://api.qestro.app/health"
echo "  • https://api.qestro.io/health"
echo ""
echo "${YELLOW}Note: Make sure DNS records for api.qestro.* are created before testing.${NC}"

echo ""
echo "${GREEN}🎉 Frontend deployment complete!${NC}"
