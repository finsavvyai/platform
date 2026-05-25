#!/bin/bash

# QueryLens Vectorize Worker Setup Script
# This script creates the Vectorize index and deploys the Worker

set -e

echo "=== QueryLens Vectorize Worker Setup ==="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler CLI not found${NC}"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

echo -e "${GREEN}✓${NC} Wrangler CLI found"

# Check if user is logged in
echo ""
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Not logged in to Cloudflare"
    echo "Please run: wrangler login"
    exit 1
fi

echo -e "${GREEN}✓${NC} Authenticated with Cloudflare"

# Create production index
echo ""
echo "Creating Vectorize index (production)..."
if wrangler vectorize create querylens-schema-index \
  --dimensions=1536 \
  --metric=cosine \
  --metadata-fields=type,database,tableName,columnName,text 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Created index: querylens-schema-index"
else
  echo -e "${YELLOW}⚠${NC} Index may already exist or creation failed"
fi

# Create development index
echo ""
echo "Creating Vectorize index (development)..."
if wrangler vectorize create querylens-schema-index-dev \
  --dimensions=1536 \
  --metric=cosine \
  --metadata-fields=type,database,tableName,columnName,text \
  --env development 2>/dev/null; then
  echo -e "${GREEN}✓${NC} Created index: querylens-schema-index-dev"
else
  echo -e "${YELLOW}⚠${NC} Development index may already exist"
fi

# Set OpenAI API key
echo ""
echo "Setting OpenAI API key..."
echo "Note: Workers AI uses @cf/openai/text-embedding-ada-002"
echo "This is different from OpenAI's API and is included in Workers bundle"
echo ""

read -p "Do you want to set OPENAI_API_KEY secret? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Enter OpenAI API key (or press Enter to skip - Workers AI will be used):"
  wrangler secret put OPENAI_API_KEY
  echo -e "${GREEN}✓${NC} Secret set"
else
  echo -e "${YELLOW}⚠${NC} Skipping API key (Workers AI will be used)"
fi

# Install dependencies
echo ""
echo "Installing Worker dependencies..."
cd "$(dirname "$0")"
if npm install; then
  echo -e "${GREEN}✓${NC} Dependencies installed"
else
  echo -e "${RED}✗${NC} Failed to install dependencies"
  exit 1
fi

# Deploy to development
echo ""
echo "Deploying Worker to development..."
if wrangler deploy --env development; then
  echo -e "${GREEN}✓${NC} Worker deployed to development"
  DEV_URL=$(wrangler deployments list --env development | grep -oP 'https://[^\s]+querylens-vectorize-worker-dev[^\s]*' | head -1)
  echo -e "${GREEN}Worker URL:${NC} $DEV_URL"
else
  echo -e "${RED}✗${NC} Failed to deploy to development"
  exit 1
fi

# Ask about production deployment
echo ""
read -p "Deploy to production? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  if wrangler deploy; then
    echo -e "${GREEN}✓${NC} Worker deployed to production"
    PROD_URL=$(wrangler deployments list | grep -oP 'https://[^\s]+querylens-vectorize-worker[^\s]*' | head -1)
    echo -e "${GREEN}Worker URL:${NC} $PROD_URL"
  else
    echo -e "${RED}✗${NC} Failed to deploy to production"
  fi
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Test health endpoint: curl https://querylens-vectorize-worker.workers.dev/health"
echo "2. Update application.yml with worker URL"
echo "3. Start indexing schemas"
echo ""
echo "For API documentation, see: README.md"
