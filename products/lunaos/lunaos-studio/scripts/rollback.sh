#!/bin/bash

# Rollback Script for Luna Studio
# This script performs a rollback to the previous deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SITE_ID="${NETLIFY_SITE_ID}"
AUTH_TOKEN="${NETLIFY_AUTH_TOKEN}"
ENVIRONMENT="${1:-production}"

echo -e "${BLUE}🔄 Luna Studio Rollback Script${NC}"
echo "================================================"
echo "Environment: $ENVIRONMENT"
echo "Site ID: ${SITE_ID:0:8}..."
echo ""

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo -e "${RED}✗${NC} Netlify CLI is not installed"
    echo "Install with: npm install -g netlify-cli"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$SITE_ID" ]; then
    echo -e "${RED}✗${NC} NETLIFY_SITE_ID environment variable is not set"
    exit 1
fi

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}✗${NC} NETLIFY_AUTH_TOKEN environment variable is not set"
    exit 1
fi

# Function to list recent deployments
list_deployments() {
    echo -e "${BLUE}📋 Recent Deployments:${NC}"
    echo "================================================"
    netlify deploys:list --site-id="$SITE_ID" --auth="$AUTH_TOKEN" | head -n 10
    echo ""
}

# Function to get current deployment
get_current_deployment() {
    CURRENT_DEPLOY=$(netlify api listSiteDeploys --site-id="$SITE_ID" --auth="$AUTH_TOKEN" | jq -r '.[0].id')
    echo -e "${BLUE}Current Deployment:${NC} $CURRENT_DEPLOY"
}

# Function to get previous successful deployment
get_previous_deployment() {
    PREVIOUS_DEPLOY=$(netlify api listSiteDeploys --site-id="$SITE_ID" --auth="$AUTH_TOKEN" | jq -r '.[1].id')
    echo -e "${BLUE}Previous Deployment:${NC} $PREVIOUS_DEPLOY"
}

# Function to perform rollback
perform_rollback() {
    local deploy_id=$1
    
    echo ""
    echo -e "${YELLOW}⚠${NC} About to rollback to deployment: $deploy_id"
    echo ""
    
    # In CI/CD, skip confirmation
    if [ -z "$CI" ]; then
        read -p "Are you sure you want to proceed? (yes/no): " -r
        echo
        if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
            echo -e "${YELLOW}⚠${NC} Rollback cancelled"
            exit 0
        fi
    fi
    
    echo -e "${BLUE}🔄 Rolling back...${NC}"
    
    # Perform rollback using Netlify API
    netlify api publishDeploy --deploy-id="$deploy_id" --auth="$AUTH_TOKEN"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✓ Rollback successful!${NC}"
        echo ""
        return 0
    else
        echo ""
        echo -e "${RED}✗ Rollback failed${NC}"
        echo ""
        return 1
    fi
}

# Function to verify rollback
verify_rollback() {
    local site_url=$1
    
    echo -e "${BLUE}🔍 Verifying rollback...${NC}"
    
    # Wait for deployment to propagate
    sleep 10
    
    # Run health check
    if [ -f "./scripts/health-check.sh" ]; then
        ./scripts/health-check.sh "$site_url"
        return $?
    else
        # Simple HTTP check
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$site_url")
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo -e "${GREEN}✓ Site is accessible (HTTP 200)${NC}"
            return 0
        else
            echo -e "${RED}✗ Site is not accessible (HTTP $HTTP_CODE)${NC}"
            return 1
        fi
    fi
}

# Main rollback process
main() {
    echo -e "${BLUE}Step 1: Fetching deployment information${NC}"
    echo "================================================"
    
    get_current_deployment
    get_previous_deployment
    
    echo ""
    list_deployments
    
    echo -e "${BLUE}Step 2: Performing rollback${NC}"
    echo "================================================"
    
    if [ -n "$PREVIOUS_DEPLOY" ]; then
        perform_rollback "$PREVIOUS_DEPLOY"
        
        if [ $? -eq 0 ]; then
            echo -e "${BLUE}Step 3: Verifying rollback${NC}"
            echo "================================================"
            
            # Get site URL
            SITE_URL=$(netlify api getSite --site-id="$SITE_ID" --auth="$AUTH_TOKEN" | jq -r '.url')
            
            verify_rollback "$SITE_URL"
            
            if [ $? -eq 0 ]; then
                echo ""
                echo "================================================"
                echo -e "${GREEN}✓ Rollback completed successfully!${NC}"
                echo "================================================"
                echo "Site URL: $SITE_URL"
                echo "Deployment ID: $PREVIOUS_DEPLOY"
                echo ""
                exit 0
            else
                echo ""
                echo "================================================"
                echo -e "${RED}✗ Rollback verification failed${NC}"
                echo "================================================"
                echo "Manual intervention may be required"
                echo ""
                exit 1
            fi
        else
            exit 1
        fi
    else
        echo -e "${RED}✗ Could not find previous deployment${NC}"
        exit 1
    fi
}

# Handle script arguments
case "${1:-rollback}" in
    list)
        list_deployments
        ;;
    current)
        get_current_deployment
        ;;
    previous)
        get_previous_deployment
        ;;
    rollback|*)
        main
        ;;
esac
