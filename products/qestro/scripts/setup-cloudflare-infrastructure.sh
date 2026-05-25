#!/bin/bash

# Qestro MVP - Cloudflare Infrastructure Setup Script
# This script sets up all required Cloudflare resources for the MVP launch

set -e  # Exit on error

echo "🚀 Qestro MVP - Cloudflare Infrastructure Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: Wrangler CLI is not installed${NC}"
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
echo -e "${BLUE}🔐 Checking Cloudflare authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Cloudflare${NC}"
    echo "Please run: wrangler login"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated with Cloudflare${NC}"
echo ""

# Function to create KV namespace
create_kv_namespace() {
    local name=$1
    local env=$2
    
    echo -e "${BLUE}📦 Creating KV namespace: ${name} (${env})${NC}"
    
    if [ "$env" = "production" ]; then
        wrangler kv:namespace create "$name" || echo "Namespace may already exist"
    else
        wrangler kv:namespace create "$name" --env "$env" || echo "Namespace may already exist"
    fi
}

# Function to create R2 bucket
create_r2_bucket() {
    local name=$1
    
    echo -e "${BLUE}🪣 Creating R2 bucket: ${name}${NC}"
    wrangler r2 bucket create "$name" || echo "Bucket may already exist"
}

# Function to create D1 database
create_d1_database() {
    local name=$1
    
    echo -e "${BLUE}🗄️  Creating D1 database: ${name}${NC}"
    wrangler d1 create "$name" || echo "Database may already exist"
}

# Prompt for environment
echo -e "${YELLOW}Which environment do you want to set up?${NC}"
echo "1) Development"
echo "2) Staging"
echo "3) Production"
echo "4) All environments"
read -p "Enter choice [1-4]: " env_choice

case $env_choice in
    1) ENVIRONMENTS=("dev") ;;
    2) ENVIRONMENTS=("staging") ;;
    3) ENVIRONMENTS=("production") ;;
    4) ENVIRONMENTS=("dev" "staging" "production") ;;
    *) echo -e "${RED}Invalid choice${NC}"; exit 1 ;;
esac

echo ""
echo -e "${GREEN}Setting up environments: ${ENVIRONMENTS[*]}${NC}"
echo ""

# Setup for each environment
for ENV in "${ENVIRONMENTS[@]}"; do
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Setting up ${ENV} environment${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Create D1 Database
    echo -e "${YELLOW}📊 Setting up D1 Database...${NC}"
    create_d1_database "qestro-${ENV}"
    echo ""
    
    # Create KV Namespaces
    echo -e "${YELLOW}🔑 Setting up KV Namespaces...${NC}"
    create_kv_namespace "SESSIONS" "$ENV"
    create_kv_namespace "CACHE" "$ENV"
    create_kv_namespace "RATE_LIMIT" "$ENV"
    echo ""
    
    # Create R2 Buckets
    echo -e "${YELLOW}☁️  Setting up R2 Buckets...${NC}"
    create_r2_bucket "qestro-screenshots-${ENV}"
    create_r2_bucket "qestro-recordings-${ENV}"
    create_r2_bucket "qestro-artifacts-${ENV}"
    echo ""
    
    echo -e "${GREEN}✅ ${ENV} environment setup complete${NC}"
    echo ""
done

# Run database migrations
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🔄 Running database migrations...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for ENV in "${ENVIRONMENTS[@]}"; do
    echo -e "${BLUE}Running migrations for ${ENV}...${NC}"
    
    if [ "$ENV" = "production" ]; then
        wrangler d1 migrations apply qestro-production --remote || echo "Migrations may already be applied"
    else
        wrangler d1 migrations apply "qestro-${ENV}" --remote --env "$ENV" || echo "Migrations may already be applied"
    fi
    
    echo ""
done

# Setup secrets (production only)
if [[ " ${ENVIRONMENTS[*]} " =~ " production " ]]; then
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}🔐 Setting up secrets for production...${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    echo -e "${YELLOW}⚠️  You need to set the following secrets manually:${NC}"
    echo ""
    echo "Required secrets:"
    echo "  • JWT_SECRET - Secret key for JWT token signing"
    echo "  • OPENAI_API_KEY - OpenAI API key for AI test generation"
    echo "  • LEMONSQUEEZY_API_KEY - LemonSqueezy API key for payments"
    echo "  • LEMONSQUEEZY_WEBHOOK_SECRET - LemonSqueezy webhook signature"
    echo "  • GITHUB_OAUTH_CLIENT_ID - GitHub OAuth client ID"
    echo "  • GITHUB_OAUTH_CLIENT_SECRET - GitHub OAuth client secret"
    echo "  • AZURE_OAUTH_CLIENT_ID - Azure AD OAuth client ID"
    echo "  • AZURE_OAUTH_CLIENT_SECRET - Azure AD OAuth client secret"
    echo "  • RESEND_API_KEY - Resend API key for email sending"
    echo ""
    echo "To set a secret, run:"
    echo "  wrangler secret put <SECRET_NAME> --env production"
    echo ""
    
    read -p "Do you want to set secrets now? (y/n): " setup_secrets
    
    if [ "$setup_secrets" = "y" ] || [ "$setup_secrets" = "Y" ]; then
        echo ""
        echo -e "${BLUE}Setting up secrets...${NC}"
        
        wrangler secret put JWT_SECRET --env production
        wrangler secret put OPENAI_API_KEY --env production
        wrangler secret put LEMONSQUEEZY_API_KEY --env production
        wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --env production
        wrangler secret put GITHUB_OAUTH_CLIENT_ID --env production
        wrangler secret put GITHUB_OAUTH_CLIENT_SECRET --env production
        wrangler secret put AZURE_OAUTH_CLIENT_ID --env production
        wrangler secret put AZURE_OAUTH_CLIENT_SECRET --env production
        wrangler secret put RESEND_API_KEY --env production
        
        echo -e "${GREEN}✅ Secrets configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Remember to set secrets before deploying to production${NC}"
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Infrastructure setup complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Next steps:"
echo "  1. Update wrangler.toml with the created resource IDs"
echo "  2. Build your application: npm run build"
echo "  3. Deploy to Cloudflare: wrangler deploy --env <environment>"
echo ""
echo -e "${YELLOW}📝 Note: Save the resource IDs from the output above${NC}"
echo ""
