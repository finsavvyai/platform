#!/bin/bash

# Simplified UPM Cloudflare Workers Deployment Script
# This script deploys the UPM API Gateway without interactive prompts

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT=${1:-staging}

# Log functions
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

# Main deployment function
main() {
    log_info "Starting UPM Cloudflare Workers deployment..."
    log_info "Environment: $ENVIRONMENT"

    cd "$PROJECT_ROOT"

    # Set basic secrets with default values for demo
    log_info "Setting basic secrets..."

    # Use default secrets for demo purposes
    UPM_BACKEND_URL=${UPM_BACKEND_URL:-"https://api.upm.plus.internal"}
    JWT_SECRET=${JWT_SECRET:-"demo-secret-key-change-in-production"}
    VULNERABILITY_DB_API_KEY=${VULNERABILITY_DB_API_KEY:-"demo-api-key"}
    GITHUB_TOKEN=${GITHUB_TOKEN:-"demo-github-token"}
    NPM_TOKEN=${NPM_TOKEN:-"demo-npm-token"}

    # Set secrets non-interactively
    echo "$UPM_BACKEND_URL" | wrangler secret put UPM_BACKEND_URL --env "$ENVIRONMENT"
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --env "$ENVIRONMENT"
    echo "$VULNERABILITY_DB_API_KEY" | wrangler secret put VULNERABILITY_DB_API_KEY --env "$ENVIRONMENT"
    echo "$GITHUB_TOKEN" | wrangler secret put GITHUB_TOKEN --env "$ENVIRONMENT"
    echo "$NPM_TOKEN" | wrangler secret put NPM_TOKEN --env "$ENVIRONMENT"

    log_success "Secrets configured"

    # Deploy worker
    log_info "Deploying worker to $ENVIRONMENT..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        wrangler deploy --env production
    else
        wrangler deploy --env staging
    fi

    log_success "🚀 Worker deployed successfully!"

    # Show deployment info
    if [[ "$ENVIRONMENT" == "production" ]]; then
        API_URL="https://api.upm.plus"
        WORKER_URL="https://upm-api-gateway.upm.workers.dev"
    else
        API_URL="https://api-staging.upm.plus"
        WORKER_URL="https://upm-api-gateway-staging.upm.workers.dev"
    fi

    log_success "Deployment completed!"
    log_info "API Gateway: $WORKER_URL"
    log_info "Custom Domain: $API_URL"
    log_info "Health Check: $WORKER_URL/health"
}

# Run the deployment
main "$@"
