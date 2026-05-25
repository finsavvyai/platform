#!/bin/bash

# Simple Cloudflare Workers Deployment Script
# Usage: ./deploy.sh [staging|production]

set -euo pipefail

# Configuration
DEFAULT_ENV="staging"
ENVIRONMENT="${1:-$DEFAULT_ENV}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check if Wrangler is available
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed"
        log_info "Install Wrangler with: npm install -g wrangler"
        exit 1
    fi

    # Check if we're logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        log_error "Not logged in to Cloudflare"
        log_info "Login with: wrangler auth login"
        exit 1
    fi

    # Check if source file exists
    if [[ ! -f "src/index.js" ]]; then
        log_error "src/index.js not found"
        exit 1
    fi

    log "✅ Prerequisites check completed"
}

# Deploy Workers
deploy_workers() {
    log "Deploying Workers to $ENVIRONMENT..."

    # Use simple wrangler.toml for deployment
    if wrangler deploy --config wrangler-simple.toml --env "$ENVIRONMENT"; then
        log "✅ Workers deployed successfully to $ENVIRONMENT"
    else
        log_error "❌ Failed to deploy Workers to $ENVIRONMENT"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."

    # Get worker URL based on environment
    if [[ "$ENVIRONMENT" == "production" ]]; then
        WORKER_URL="https://upm-plus-automationhub.upm.plus.workers.dev"
    else
        WORKER_URL="https://upm-plus-automationhub-staging.upm-plus.workers.dev"
    fi

    # Wait a moment for deployment to propagate
    log_info "Waiting for deployment to propagate..."
    sleep 10

    # Test health endpoint
    local max_attempts=10
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f --max-time 10 "$WORKER_URL/health" &>/dev/null; then
            log "✅ Health check passed"
            break
        else
            if [[ $attempt -eq $max_attempts ]]; then
                log_warning "⚠ Health check failed after $max_attempts attempts"
                return 1
            fi
            log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done

    # Test API endpoint
    if curl -f --max-time 10 "$WORKER_URL/api/v1/stats" &>/dev/null; then
        log "✅ API endpoint test passed"
    else
        log_warning "⚠ API endpoint test failed"
    fi

    log "✅ Deployment verification completed"
}

# Main execution
main() {
    log "🚀 Starting UPM.Plus Cloudflare Workers Deployment"
    log "=================================================="
    log "Environment: $ENVIRONMENT"
    log "Working Directory: $(pwd)"
    log "Timestamp: $(date)"
    log ""

    # Execute deployment steps
    check_prerequisites
    deploy_workers
    verify_deployment

    log ""
    log "✅ Cloudflare Workers deployment completed successfully!"
    log ""
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "🌐 Worker URL: https://upm-plus-automationhub.upm.plus.workers.dev"
    else
        log "🌐 Worker URL: https://upm-plus-automationhub-staging.upm.plus.workers.dev"
    fi
    log ""
    log "📋 Available Endpoints:"
    log "- Health Check: /health"
    log "- API Stats: /api/v1/stats"
    log "- Root: /"
    log ""
    log "🔍 Test commands:"
    log "curl $WORKER_URL/health"
    log "curl $WORKER_URL/api/v1/stats"
}

# Execute main function
main "$@"