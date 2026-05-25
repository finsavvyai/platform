#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Gateway Service Deployment Script
# =============================================================================
# Deploys the Go Gateway service with all dependencies
# Usage: ./deploy-gateway.sh [environment]
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate environment
validate_environment() {
    local env="$1"
    case $env in
        development|staging|production)
            return 0
            ;;
        *)
            log_error "Invalid environment: $env"
            exit 1
            ;;
    esac
}

# Deploy Gateway service
deploy_gateway() {
    local env="$1"
    log_info "Deploying Gateway service to $env environment..."

    cd services/gateway

    # Build the Go application
    log_info "Building Go Gateway service..."
    GOOS=js GOARCH=wasm go build -o main.wasm ./cmd/gateway

    # Deploy to Cloudflare Workers
    log_info "Deploying to Cloudflare Workers..."
    wrangler deploy --env $env

    cd - > /dev/null

    log_success "Gateway service deployed to $env environment"
}

# Health check
health_check() {
    local env="$1"
    log_info "Running Gateway service health check..."

    local gateway_url
    if [ "$env" = "development" ]; then
        gateway_url="https://sdlc-gateway-dev.{$(wrangler whoami | jq -r '.account.subdomain')}.workers.dev"
    else
        gateway_url="https://api-$env.sdlc.ai"
    fi

    # Test health endpoint
    if curl -f -s "$gateway_url/health" > /dev/null; then
        log_success "Gateway service health check passed"
    else
        log_warning "Gateway service health check failed"
    fi

    # Test authentication endpoint
    if curl -f -s -X POST "$gateway_url/auth/health" > /dev/null; then
        log_success "Gateway auth endpoint working"
    else
        log_warning "Gateway auth endpoint may need initialization"
    fi
}

# Main function
main() {
    local env="${1:-development}"

    log_info "Starting Gateway service deployment..."
    validate_environment "$env"

    deploy_gateway "$env"
    health_check "$env"

    log_success "Gateway service deployment completed"
}

case "${1:-}" in
    -h|--help)
        echo "Gateway Service Deployment Script"
        echo "Usage: $0 [environment]"
        echo "Environments: development, staging, production"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
