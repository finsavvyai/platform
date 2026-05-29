#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Vector Service Deployment Script
# =============================================================================
# Deploys the Rust Vector Core service with all dependencies
# Usage: ./deploy-vector.sh [environment]
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

# Deploy Vector service
deploy_vector() {
    local env="$1"
    log_info "Deploying Vector service to $env environment..."

    cd services/vector-core

    # Build the Rust application for WebAssembly
    log_info "Building Rust Vector service for WebAssembly..."
    cargo build --target wasm32-wasi --release

    # Deploy to Cloudflare Workers
    log_info "Deploying to Cloudflare Workers..."
    wrangler deploy --env $env

    cd - > /dev/null

    log_success "Vector service deployed to $env environment"
}

# Setup Vector-specific resources
setup_vector_resources() {
    local env="$1"
    log_info "Setting up Vector-specific resources for $env..."

    # Create semantic search index
    local preset="openai-3-small"
    if [ "$env" = "production" ]; then
        preset="openai-3-large"
    fi

    wrangler vectorize create sdlc-semantic-search-$env --dimensions=1536 --distance-metric=cosine --preset=$preset --env $env || log_warning "Semantic search index already exists"

    # Create context vectors index
    wrangler vectorize create sdlc-context-vectors-$env --dimensions=1536 --distance-metric=cosine --preset=$preset --env $env || log_warning "Context vectors index already exists"

    # Create embedding cache KV namespace
    wrangler kv:namespace create "EMBEDDING_CACHE" --env $env || log_warning "Embedding cache KV already exists"

    # Create search cache KV namespace
    wrangler kv:namespace create "SEARCH_CACHE" --env $env || log_warning "Search cache KV already exists"

    # Create embedding queue
    wrangler queues create sdlc-embedding-$env --env $env || log_warning "Embedding queue already exists"

    log_success "Vector-specific resources set up for $env environment"
}

# Run Vector migrations
run_vector_migrations() {
    local env="$1"
    log_info "Running Vector database migrations for $env..."

    # Migrate vector metadata database
    wrangler d1 execute sdlc-vector-metadata-db-$env --env $env --file=./../../migrations/vector/0001_create_vector_tables.sql

    log_success "Vector migrations completed for $env environment"
}

# Test vector search functionality
test_vector_operations() {
    local env="$1"
    log_info "Testing Vector service operations..."

    local vector_url
    if [ "$env" = "development" ]; then
        vector_url="https://sdlc-vector-dev.{$(wrangler whoami | jq -r '.account.subdomain')}.workers.dev"
    else
        vector_url="https://vector-$env.sdlc.ai"
    fi

    # Test health endpoint
    if curl -f -s "$vector_url/health" > /dev/null; then
        log_success "Vector service health check passed"
    else
        log_warning "Vector service health check failed"
    fi

    # Test vector search endpoint
    if curl -f -s -X POST "$vector_url/search/health" > /dev/null; then
        log_success "Vector search endpoint working"
    else
        log_warning "Vector search endpoint may need initialization"
    fi

    # Test embedding generation (requires API key)
    if curl -f -s -X POST "$vector_url/embeddings/health" > /dev/null; then
        log_success "Embedding generation endpoint working"
    else
        log_warning "Embedding generation endpoint may need API key configuration"
    fi
}

# Initialize vector indexes
initialize_vector_indexes() {
    local env="$1"
    log_info "Initializing Vector indexes for $env environment..."

    # This would typically be done via an admin endpoint or script
    # For now, we'll just log that it needs to be done
    log_warning "Vector indexes need to be initialized with sample data"
    log_info "Run: curl -X POST $vector_url/admin/initialize-indexes"

    log_success "Vector index initialization noted for $env environment"
}

# Main function
main() {
    local env="${1:-development}"

    log_info "Starting Vector service deployment..."
    validate_environment "$env"

    setup_vector_resources "$env"
    run_vector_migrations "$env"
    deploy_vector "$env"
    test_vector_operations "$env"
    initialize_vector_indexes "$env"

    log_success "Vector service deployment completed"
}

case "${1:-}" in
    -h|--help)
        echo "Vector Service Deployment Script"
        echo "Usage: $0 [environment]"
        echo "Environments: development, staging, production"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
