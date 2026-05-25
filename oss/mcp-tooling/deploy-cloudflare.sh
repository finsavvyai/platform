#!/bin/bash

# MCPoverflow Cloudflare Deployment Script
# Deploys AI Engine and Go Backend to Cloudflare

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Wrangler
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI not found. Installing..."
        npm install -g wrangler
    fi

    # Check login status
    log_info "Checking Cloudflare authentication..."
    if ! wrangler whoami &> /dev/null; then
        log_warning "Not logged in to Cloudflare. Please login:"
        wrangler login
    fi

    log_success "Prerequisites checked"
}

# Setup Cloudflare resources
setup_cloudflare_resources() {
    log_info "Setting up Cloudflare resources..."

    cd packages/ai-engine

    # Create KV namespace for job storage
    log_info "Creating KV namespace for AI jobs..."

    # Production namespace
    if ! wrangler kv:namespace list | grep -q "AI_JOBS"; then
        log_info "Creating production KV namespace..."
        PROD_KV=$(wrangler kv:namespace create AI_JOBS --preview false | grep "id =" | awk '{print $3}' | tr -d '"')
        log_success "Production KV namespace created: $PROD_KV"

        # Update wrangler.toml
        sed -i.bak "s/id = \"\" # Production KV/id = \"$PROD_KV\" # Production KV/" wrangler.toml
    fi

    # Preview namespace
    log_info "Creating preview KV namespace..."
    PREVIEW_KV=$(wrangler kv:namespace create AI_JOBS --preview | grep "id =" | awk '{print $3}' | tr -d '"')
    log_success "Preview KV namespace created: $PREVIEW_KV"

    # Update wrangler.toml
    sed -i.bak "s/preview_id = \"\" # Development KV/preview_id = \"$PREVIEW_KV\" # Development KV/" wrangler.toml

    cd ../..

    log_success "Cloudflare resources created"
}

# Set secrets
set_secrets() {
    log_info "Setting Cloudflare Workers secrets..."

    cd packages/ai-engine

    # Check if secrets are in environment or .env
    if [ -z "$OPENHANDS_API_KEY" ]; then
        read -sp "Enter OPENHANDS_API_KEY: " OPENHANDS_API_KEY
        echo
    fi

    if [ -z "$OPENHANDS_API_URL" ]; then
        read -p "Enter OPENHANDS_API_URL (default: http://localhost:3000): " OPENHANDS_API_URL
        OPENHANDS_API_URL=${OPENHANDS_API_URL:-http://localhost:3000}
    fi

    # Set secrets via Wrangler
    echo "$OPENHANDS_API_KEY" | wrangler secret put OPENHANDS_API_KEY
    echo "$OPENHANDS_API_URL" | wrangler secret put OPENHANDS_API_URL

    cd ../..

    log_success "Secrets configured"
}

# Build AI Engine
build_ai_engine() {
    log_info "Building AI Engine for Cloudflare Workers..."

    cd packages/ai-engine

    # Install dependencies
    log_info "Installing dependencies..."
    npm install

    # Build worker
    log_info "Building worker bundle..."
    npm run build:worker

    cd ../..

    log_success "AI Engine built successfully"
}

# Deploy AI Engine
deploy_ai_engine() {
    local env=${1:-production}

    log_info "Deploying AI Engine to Cloudflare Workers ($env)..."

    cd packages/ai-engine

    if [ "$env" == "staging" ]; then
        npm run deploy:staging
    else
        npm run deploy:production
    fi

    cd ../..

    log_success "AI Engine deployed successfully"
}

# Update Go backend configuration
update_go_config() {
    local worker_url=$1

    log_info "Updating Go backend configuration..."

    # Update .env or environment variables
    if [ -f "services/api-service/.env" ]; then
        sed -i.bak "s|OPENHANDS_API_URL=.*|OPENHANDS_API_URL=$worker_url|" services/api-service/.env
        log_success "Updated Go backend .env with Worker URL: $worker_url"
    else
        log_warning "No .env file found. Please manually set OPENHANDS_API_URL=$worker_url"
    fi
}

# Test deployment
test_deployment() {
    local worker_url=$1

    log_info "Testing Cloudflare deployment..."

    # Test health endpoint
    log_info "Testing health endpoint..."
    if curl -f "$worker_url/health" &> /dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        return 1
    fi

    # Test API analyze endpoint (requires auth)
    log_info "Worker is responding. Manual testing required for authenticated endpoints."
}

# Show deployment info
show_deployment_info() {
    log_info "Deployment Information:"
    echo ""
    echo "  AI Engine Worker URL: Check wrangler output above or run:"
    echo "  $ cd packages/ai-engine && wrangler deployments list"
    echo ""
    echo "  To view logs:"
    echo "  $ cd packages/ai-engine && wrangler tail"
    echo ""
    echo "  To update secrets:"
    echo "  $ cd packages/ai-engine"
    echo "  $ wrangler secret put OPENHANDS_API_KEY"
    echo ""
    echo "  Custom Domain Setup:"
    echo "  1. Add custom domain in Cloudflare Dashboard"
    echo "  2. Update wrangler.toml routes section"
    echo "  3. Redeploy: npm run deploy"
    echo ""
}

# Rollback deployment
rollback_deployment() {
    log_warning "Rolling back to previous deployment..."

    cd packages/ai-engine

    # List deployments
    wrangler deployments list

    read -p "Enter deployment ID to rollback to: " deployment_id

    if [ -n "$deployment_id" ]; then
        wrangler rollback "$deployment_id"
        log_success "Rolled back to deployment: $deployment_id"
    else
        log_error "No deployment ID provided"
    fi

    cd ../..
}

# View logs
view_logs() {
    log_info "Viewing Cloudflare Workers logs..."

    cd packages/ai-engine
    wrangler tail
    cd ../..
}

# Main menu
show_menu() {
    echo ""
    echo "MCPoverflow Cloudflare Deployment"
    echo "=================================="
    echo "1. Full deployment (setup + build + deploy)"
    echo "2. Setup Cloudflare resources only"
    echo "3. Set secrets only"
    echo "4. Build and deploy AI Engine"
    echo "5. Deploy to staging"
    echo "6. Deploy to production"
    echo "7. Test deployment"
    echo "8. View logs (tail)"
    echo "9. Rollback deployment"
    echo "10. Show deployment info"
    echo "0. Exit"
    echo ""
    read -p "Select an option: " choice

    case $choice in
        1)
            check_prerequisites
            setup_cloudflare_resources
            set_secrets
            build_ai_engine
            deploy_ai_engine production
            show_deployment_info
            ;;
        2)
            check_prerequisites
            setup_cloudflare_resources
            ;;
        3)
            check_prerequisites
            set_secrets
            ;;
        4)
            build_ai_engine
            deploy_ai_engine production
            ;;
        5)
            build_ai_engine
            deploy_ai_engine staging
            ;;
        6)
            build_ai_engine
            deploy_ai_engine production
            ;;
        7)
            read -p "Enter Worker URL: " worker_url
            test_deployment "$worker_url"
            ;;
        8)
            view_logs
            ;;
        9)
            rollback_deployment
            ;;
        10)
            show_deployment_info
            ;;
        0)
            exit 0
            ;;
        *)
            log_error "Invalid option"
            show_menu
            ;;
    esac
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    show_menu
else
    case $1 in
        deploy)
            check_prerequisites
            setup_cloudflare_resources
            set_secrets
            build_ai_engine
            deploy_ai_engine production
            show_deployment_info
            ;;
        deploy-staging)
            check_prerequisites
            build_ai_engine
            deploy_ai_engine staging
            ;;
        deploy-production)
            check_prerequisites
            build_ai_engine
            deploy_ai_engine production
            ;;
        setup)
            check_prerequisites
            setup_cloudflare_resources
            ;;
        secrets)
            check_prerequisites
            set_secrets
            ;;
        build)
            build_ai_engine
            ;;
        test)
            test_deployment "$2"
            ;;
        logs)
            view_logs
            ;;
        rollback)
            rollback_deployment
            ;;
        info)
            show_deployment_info
            ;;
        *)
            echo "Usage: $0 {deploy|deploy-staging|deploy-production|setup|secrets|build|test|logs|rollback|info}"
            exit 1
            ;;
    esac
fi
