#!/bin/bash
# Deploy UPM Website to Cloudflare Pages

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying UPM Website to Cloudflare Pages${NC}"
echo "=========================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found${NC}"
    echo "Install it with: npm install -g wrangler"
    exit 1
fi

# Check if authenticated
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with Cloudflare${NC}"
    echo "Running: wrangler login"
    wrangler login
fi

# Create public directory for Pages
echo -e "${BLUE}📦 Preparing website files...${NC}"
mkdir -p cloudflare-pages/public

# Copy website templates to public directory
echo -e "${BLUE}📋 Copying website files...${NC}"
cp -r templates/website/* cloudflare-pages/public/

# Rename index.html if needed
if [ -f "cloudflare-pages/public/index.html" ]; then
    echo -e "${GREEN}✅ Website files ready${NC}"
else
    echo -e "${RED}❌ index.html not found${NC}"
    exit 1
fi

# Deploy to Cloudflare Pages
echo ""
echo -e "${BLUE}🌐 Deploying to Cloudflare Pages...${NC}"
cd cloudflare-pages

# Check if this is a git repo (required for Pages)
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Initializing git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit for Cloudflare Pages"
fi

# Deploy using wrangler pages
echo -e "${BLUE}Deploying...${NC}"
wrangler pages deploy public --project-name=upm-website

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${GREEN}🌐 Your website is now live at:${NC}"
echo -e "   https://upm-website.pages.dev"
echo ""
echo -e "${BLUE}📝 Next steps:${NC}"
echo "1. Connect your custom domain (upmplus.dev) in Cloudflare Pages dashboard"
echo "2. Configure DNS to point to Cloudflare Pages"
echo "3. Set up environment variables in Cloudflare dashboard"
echo ""
