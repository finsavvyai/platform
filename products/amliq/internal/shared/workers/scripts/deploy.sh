#!/bin/bash

# Deployment Script for FinTech Suite
# Deploys the worker with all configured services

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Navigate to workers directory
cd "$(dirname "$0")/.."

# Check command line arguments
ENVIRONMENT="production"
if [ "$1" = "staging" ] || [ "$1" = "development" ]; then
    ENVIRONMENT="$1"
fi

log_info "Deploying FinTech suite to $ENVIRONMENT environment..."

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    log_error "wrangler.toml not found. Please run setup first."
    exit 1
fi

# Check authentication
if ! wrangler whoami &> /dev/null; then
    log_error "Not authenticated with Cloudflare. Please run: wrangler login"
    exit 1
fi

# Type checking if TypeScript
if [ -f "tsconfig.json" ]; then
    log_info "Running TypeScript type check..."
    npm run typecheck || log_warning "TypeScript type check failed - proceeding anyway"
fi

# Linting if configured
if [ -f "package.json" ] && grep -q "lint" package.json; then
    log_info "Running linter..."
    npm run lint || log_warning "Linting failed - proceeding anyway"
fi

# Deployment
log_info "Deploying worker to Cloudflare..."
if [ "$ENVIRONMENT" = "production" ]; then
    wrangler deploy
else
    wrangler deploy --env "$ENVIRONMENT"
fi

# Post-deployment verification
log_info "Running post-deployment verification..."

# Check if deployment succeeded
DEPLOYMENT_URL=$(wrangler deployments list --format=json | jq -r '.[0].url' 2>/dev/null || echo "")

if [ -n "$DEPLOYMENT_URL" ] && [ "$DEPLOYMENT_URL" != "null" ]; then
    log_success "Deployment successful!"
    log_info "Worker URL: $DEPLOYMENT_URL"

    # Health check
    log_info "Performing health check..."
    if curl -f -s "$DEPLOYMENT_URL/health" > /dev/null; then
        log_success "Health check passed!"
    else
        log_warning "Health check failed - worker may need additional configuration"
    fi
else
    log_warning "Could not retrieve deployment URL - please verify manually"
fi

# Display next steps
log_success "Deployment to $ENVIRONMENT completed!"
echo ""
log_info "Next steps:"
echo "1. Test your worker at the deployment URL"
echo "2. Configure custom domains in Cloudflare dashboard"
echo "3. Set up monitoring and alerting"
echo "4. Configure any additional routing rules"

if [ "$ENVIRONMENT" = "production" ]; then
    echo "5. Enable production monitoring and analytics"
    echo "6. Configure backup and disaster recovery procedures"
fi