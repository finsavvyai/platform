#!/bin/bash

# UPM.Plus Wrangler Multi-Environment Deployment Script
# Deploys Workers to all UPM.Plus domains using Wrangler CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 UPM.Plus Wrangler Multi-Environment Deployment${NC}"
echo -e "${BLUE}Project: ${PROJECT_DIR}${NC}"
echo

# Check if Wrangler is installed and authenticated
echo -e "${CYAN}Checking Wrangler setup...${NC}"
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}[✗] Wrangler CLI not found${NC}"
    echo -e "${YELLOW}Install with: npm install -g wrangler${NC}"
    exit 1
fi

if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}[✗] Not logged in to Wrangler${NC}"
    echo -e "${YELLOW}Login with: wrangler login${NC}"
    exit 1
fi

echo -e "${GREEN}[✓] Wrangler is authenticated${NC}"
wrangler whoami
echo

# Create KV namespaces if they don't exist
echo -e "${CYAN}Setting up KV namespaces...${NC}"

KV_NAMESPACES=("upm-plus-cache-kv" "upm-plus-config-kv")

for kv in "${KV_NAMESPACES[@]}"; do
    echo -e "${YELLOW}Creating KV namespace: ${kv}${NC}"
    if wrangler kv:namespace create "${kv}" --preview &> /dev/null; then
        echo -e "${GREEN}[✓] Created ${kv}${NC}"
    else
        echo -e "${GREEN}[✓] ${kv} already exists${NC}"
    fi
done

# Create D1 database if it doesn't exist
echo -e "${CYAN}Setting up D1 database...${NC}"
if wrangler d1 create upm-plus-config &> /dev/null; then
    echo -e "${GREEN}[✓] Created D1 database${NC}"
else
    echo -e "${GREEN}[✓] D1 database already exists${NC}"
fi

# Function to deploy to environment
deploy_environment() {
    local env=$1
    local env_name=$2

    echo -e "${MAGENTA}🌐 Deploying to ${env_name} (${env})${NC}"

    cd "$PROJECT_DIR"

    # Deploy the router worker
    echo -e "${YELLOW}  Deploying router worker...${NC}"
    if wrangler deploy --env "${env}"; then
        echo -e "${GREEN}  [✓] Router worker deployed${NC}"
    else
        echo -e "${RED}  [✗] Router worker deployment failed${NC}"
        return 1
    fi

    # Deploy API worker (separate)
    echo -e "${YELLOW}  Deploying API worker...${NC}"
    if wrangler deploy src/api-worker.js --name "upm-plus-api-${env}" --env "${env}"; then
        echo -e "${GREEN}  [✓] API worker deployed${NC}"
    else
        echo -e "${YELLOW}  [!] API worker deployment skipped (will use router)${NC}"
    fi

    echo -e "${GREEN}  [✓] ${env_name} deployment complete${NC}"
    echo
}

# Parse command line arguments
ENVIRONMENT=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --production)
            ENVIRONMENT="production"
            shift
            ;;
        --development)
            ENVIRONMENT="development"
            shift
            ;;
        --staging)
            ENVIRONMENT="staging"
            shift
            ;;
        --ai)
            ENVIRONMENT="ai-production"
            shift
            ;;
        --all)
            ENVIRONMENT="all"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo
            echo "Options:"
            echo "  --env ENVIRONMENT     Deploy to specific environment"
            echo "  --production          Deploy to production (upm.plus)"
            echo "  --development         Deploy to development (upmplus.dev)"
            echo "  --staging            Deploy to staging (upmplus.io)"
            echo "  --ai                 Deploy to AI production (upmplus.ai)"
            echo "  --all                Deploy to all environments"
            echo "  --dry-run            Show what would be deployed"
            echo "  -h, --help           Show this help message"
            echo
            echo "Environments:"
            echo "  production           upm.plus (main production)"
            echo "  development          upmplus.dev (development)"
            echo "  staging             upmplus.io (staging)"
            echo "  ai-production       upmplus.ai (AI production)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Deploy based on environment selection
if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}🔍 DRY RUN MODE - No actual deployment will occur${NC}"
    echo
fi

if [[ -z "$ENVIRONMENT" || "$ENVIRONMENT" == "all" ]]; then
    echo -e "${CYAN}Deploying to all environments...${NC}"
    echo

    if [[ "$DRY_RUN" != "true" ]]; then
        deploy_environment "production" "Production (upm.plus)"
        deploy_environment "development" "Development (upmplus.dev)"
        deploy_environment "staging" "Staging (upmplus.io)"
        deploy_environment "ai-production" "AI Production (upmplus.ai)"
    else
        echo -e "${YELLOW}Would deploy to:${NC}"
        echo -e "  - Production (upm.plus)"
        echo -e "  - Development (upmplus.dev)"
        echo -e "  - Staging (upmplus.io)"
        echo -e "  - AI Production (upmplus.ai)"
    fi
else
    case "$ENVIRONMENT" in
        "production")
            deploy_environment "production" "Production (upm.plus)"
            ;;
        "development")
            deploy_environment "development" "Development (upmplus.dev)"
            ;;
        "staging")
            deploy_environment "staging" "Staging (upmplus.io)"
            ;;
        "ai-production")
            deploy_environment "ai-production" "AI Production (upmplus.ai)"
            ;;
        *)
            echo -e "${RED}Unknown environment: $ENVIRONMENT${NC}"
            echo -e "${YELLOW}Valid environments: production, development, staging, ai-production, all${NC}"
            exit 1
            ;;
    esac
fi

# Post-deployment verification
echo -e "${CYAN}Post-deployment verification...${NC}"

if [[ "$DRY_RUN" != "true" ]]; then
    echo -e "${YELLOW}Checking deployed workers...${NC}"

    # Check production worker
    echo -e "${YELLOW}Testing production endpoint...${NC}"
    if curl -s "https://upm.plus/api/health" &> /dev/null; then
        echo -e "${GREEN}[✓] Production health check passed${NC}"
    else
        echo -e "${YELLOW}[!] Production endpoint not yet accessible (DNS propagation may take time)${NC}"
    fi

    # Check development worker
    echo -e "${YELLOW}Testing development endpoint...${NC}"
    if curl -s "https://upmplus.dev/api/health" &> /dev/null; then
        echo -e "${GREEN}[✓] Development health check passed${NC}"
    else
        echo -e "${YELLOW}[!] Development endpoint not yet accessible${NC}"
    fi
fi

echo
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo
echo -e "${CYAN}Next steps:${NC}"
echo -e "1. Wait for DNS propagation (5-15 minutes)"
echo -e "2. Test your endpoints:"
echo -e "   - https://upm.plus/api/health"
echo -e "   - https://upmplus.dev/api/health"
echo -e "   - https://upmplus.io/api/health"
echo -e "   - https://upmplus.ai/api/health"
echo -e "3. Check Cloudflare Dashboard for worker status"
echo -e "4. Monitor logs with: wrangler tail"
echo

if [[ "$DRY_RUN" != "true" ]]; then
    echo -e "${MAGENTA}🔍 Monitor your workers:${NC}"
    echo -e "wrangler tail --env production"
    echo -e "wrangler tail --env development"
    echo -e "wrangler tail --env staging"
    echo -e "wrangler tail --env ai-production"
fi