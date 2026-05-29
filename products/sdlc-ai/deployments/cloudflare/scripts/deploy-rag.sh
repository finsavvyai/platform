#!/bin/bash

# =============================================================================
# SDLC.ai Platform - RAG Service Deployment Script
# =============================================================================
# Deploys the Python RAG service with all dependencies
# Usage: ./deploy-rag.sh [environment]
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

# Deploy RAG service
deploy_rag() {
    local env="$1"
    log_info "Deploying RAG service to $env environment..."

    cd services/rag

    # Install Python dependencies
    log_info "Installing Python dependencies..."
    pip install -r requirements.txt

    # Build for Cloudflare Workers
    log_info "Building Python RAG service for Workers..."
    npx wrangler build --env $env

    # Deploy to Cloudflare Workers
    log_info "Deploying to Cloudflare Workers..."
    wrangler deploy --env $env

    cd - > /dev/null

    log_success "RAG service deployed to $env environment"
}

# Setup RAG-specific resources
setup_rag_resources() {
    local env="$1"
    log_info "Setting up RAG-specific resources for $env..."

    # Create document processing queues
    wrangler queues create sdlc-document-processing-$env --env $env || log_warning "Document processing queue already exists"

    # Create embedding cache KV namespace
    wrangler kv:namespace create "EMBEDDING_CACHE" --env $env || log_warning "Embedding cache KV already exists"

    # Create processing cache KV namespace
    wrangler kv:namespace create "PROCESSING_CACHE" --env $env || log_warning "Processing cache KV already exists"

    # Create document storage R2 bucket
    wrangler r2 bucket create sdlc-document-storage-$env || log_warning "Document storage bucket already exists"

    # Create document vectors index
    wrangler vectorize create sdlc-document-vectors-$env --dimensions=1536 --distance-metric=cosine --env $env || log_warning "Document vectors index already exists"

    log_success "RAG-specific resources set up for $env environment"
}

# Run RAG migrations
run_rag_migrations() {
    local env="$1"
    log_info "Running RAG database migrations for $env..."

    # Migrate documents database
    wrangler d1 execute sdlc-documents-db-$env --env $env --file=./../../migrations/documents/0001_create_documents.sql
    wrangler d1 execute sdlc-documents-db-$env --env $env --file=./../../migrations/documents/0002_create_chunks.sql

    log_success "RAG migrations completed for $env environment"
}

# Health check
health_check() {
    local env="$1"
    log_info "Running RAG service health check..."

    local rag_url
    if [ "$env" = "development" ]; then
        rag_url="https://sdlc-rag-dev.{$(wrangler whoami | jq -r '.account.subdomain')}.workers.dev"
    else
        rag_url="https://rag-$env.sdlc.ai"
    fi

    # Test health endpoint
    if curl -f -s "$rag_url/health" > /dev/null; then
        log_success "RAG service health check passed"
    else
        log_warning "RAG service health check failed"
    fi

    # Test document processing endpoint
    if curl -f -s -X POST "$rag_url/documents/health" > /dev/null; then
        log_success "Document processing endpoint working"
    else
        log_warning "Document processing endpoint may need initialization"
    fi
}

# Main function
main() {
    local env="${1:-development}"

    log_info "Starting RAG service deployment..."
    validate_environment "$env"

    setup_rag_resources "$env"
    run_rag_migrations "$env"
    deploy_rag "$env"
    health_check "$env"

    log_success "RAG service deployment completed"
}

case "${1:-}" in
    -h|--help)
        echo "RAG Service Deployment Script"
        echo "Usage: $0 [environment]"
        echo "Environments: development, staging, production"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
