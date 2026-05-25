#!/bin/bash

# Qestro Production Deployment Script
# Handles safe deployment to production environment

set -euo pipefail

# Configuration
PROJECT_NAME="qestro"
WORKER_NAME="questro-platform-worker"
FRONTEND_DIR="../frontend/dist"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Pre-deployment health check
pre_deploy_check() {
    log "🔍 Running pre-deployment health checks..."

    # Check if all required files exist
    if [ ! -f "../src/questro-platform-worker.ts" ]; then
        log "❌ Worker source file not found"
        exit 1
    fi

    if [ ! -d "$FRONTEND_DIR" ]; then
        log "❌ Frontend build directory not found"
        exit 1
    fi

    log "✅ Pre-deployment checks passed"
}

# Deploy backend worker
deploy_worker() {
    log "🚀 Deploying backend worker..."

    cd ..
    npx wrangler deploy --compatibility-date=2023-11-01

    log "✅ Backend worker deployed"
}

# Deploy frontend
deploy_frontend() {
    log "🌐 Deploying frontend..."

    cd "$FRONTEND_DIR"
    npx wrangler pages deploy . --project-name="$PROJECT_NAME" --commit-dirty=true

    log "✅ Frontend deployed"
}

# Post-deployment verification
post_deploy_check() {
    log "🔍 Running post-deployment verification..."

    # Wait for deployment to propagate
    sleep 30

    # Check frontend
    if curl -s -f "https://qestro.app" --max-time 10 > /dev/null; then
        log "✅ Frontend deployment verified"
    else
        log "❌ Frontend deployment failed verification"
        exit 1
    fi

    # Check API
    if curl -s -f "https://api.qestro.app/health" --max-time 10 > /dev/null; then
        log "✅ API deployment verified"
    else
        log "❌ API deployment failed verification"
        exit 1
    fi

    log "✅ All deployment verifications passed"
}

# Main deployment flow
main() {
    log "🚀 Starting Qestro production deployment..."

    pre_deploy_check
    deploy_worker
    deploy_frontend
    post_deploy_check

    log "🎉 Production deployment completed successfully!"

    # Run health check
    /opt/qestro/scripts/production/health-check.sh
}

# Execute deployment
main "$@"
