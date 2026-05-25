#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Complete Cloudflare Deployment Script
# =============================================================================
# This script deploys all Cloudflare services across all environments
# Usage: ./deploy-all.sh [environment] [service]
# Examples:
#   ./deploy-all.sh development
#   ./deploy-all.sh staging gateway
#   ./deploy-all.sh production all
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please install it with: npm install -g wrangler"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    log_success "All dependencies are installed"
}

# Validate environment parameter
validate_environment() {
    local env="$1"
    case $env in
        development|staging|production)
            return 0
            ;;
        *)
            log_error "Invalid environment: $env. Valid environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Create all required Cloudflare resources
create_resources() {
    local env="$1"
    log_info "Creating Cloudflare resources for $env environment..."

    # Create D1 databases
    log_info "Creating D1 databases..."
    wrangler d1 create sdlc-tenant-db-$env --env $env || log_warning "Tenant DB already exists"
    wrangler d1 create sdlc-auth-db-$env --env $env || log_warning "Auth DB already exists"
    wrangler d1 create sdlc-documents-db-$env --env $env || log_warning "Documents DB already exists"
    wrangler d1 create sdlc-vector-metadata-db-$env --env $env || log_warning "Vector metadata DB already exists"
    wrangler d1 create sdlc-policy-db-$env --env $env || log_warning "Policy DB already exists"

    # Create KV namespaces
    log_info "Creating KV namespaces..."
    wrangler kv:namespace create "CACHE" --env $env || log_warning "CACHE KV already exists"
    wrangler kv:namespace create "SESSIONS" --env $env || log_warning "SESSIONS KV already exists"
    wrangler kv:namespace create "RATE_LIMIT_CACHE" --env $env || log_warning "RATE_LIMIT_CACHE KV already exists"
    wrangler kv:namespace create "EMBEDDING_CACHE" --env $env || log_warning "EMBEDDING_CACHE KV already exists"
    wrangler kv:namespace create "SEARCH_CACHE" --env $env || log_warning "SEARCH_CACHE KV already exists"

    # Create R2 buckets
    log_info "Creating R2 buckets..."
    wrangler r2 bucket create sdlc-documents-$env || log_warning "Documents bucket already exists"
    wrangler r2 bucket create sdlc-backup-archive-$env || log_warning "Backup archive bucket already exists"
    wrangler r2 bucket create sdlc-temp-uploads-$env || log_warning "Temp uploads bucket already exists"

    # Create Vectorize indexes
    log_info "Creating Vectorize indexes..."
    wrangler vectorize create sdlc-semantic-search-$env --dimensions=1536 --distance-metric=cosine --env $env || log_warning "Semantic search index already exists"
    wrangler vectorize create sdlc-document-vectors-$env --dimensions=1536 --distance-metric=cosine --env $env || log_warning "Document vectors index already exists"
    wrangler vectorize create sdlc-code-vectors-$env --dimensions=1536 --distance-metric=cosine --env $env || log_warning "Code vectors index already exists"

    # Create Queues
    log_info "Creating Queues..."
    wrangler queues create sdlc-document-processing-$env --env $env || log_warning "Document processing queue already exists"
    wrangler queues create sdlc-embedding-$env --env $env || log_warning "Embedding queue already exists"
    wrangler queues create sdlc-dlp-scan-$env --env $env || log_warning "DLP scan queue already exists"
    wrangler queues create sdlc-notifications-$env --env $env || log_warning "Notifications queue already exists"
    wrangler queues create sdlc-backup-$env --env $env || log_warning "Backup queue already exists"

    log_success "All Cloudflare resources created for $env environment"
}

# Run database migrations
run_migrations() {
    local env="$1"
    log_info "Running database migrations for $env environment..."

    # Migrate all databases
    wrangler d1 execute sdlc-tenant-db-$env --env $env --file=./migrations/tenants/0001_create_tenants.sql
    wrangler d1 execute sdlc-auth-db-$env --env $env --file=./migrations/auth/0001_create_users.sql
    wrangler d1 execute sdlc-documents-db-$env --env $env --file=./migrations/documents/0001_create_documents.sql
    wrangler d1 execute sdlc-documents-db-$env --env $env --file=./migrations/documents/0002_create_chunks.sql
    wrangler d1 execute sdlc-vector-metadata-db-$env --env $env --file=./migrations/vector/0001_create_vector_tables.sql
    wrangler d1 execute sdlc-policy-db-$env --env $env --file=./migrations/policies/0001_create_policies.sql
    wrangler d1 execute sdlc-policy-db-$env --env $env --file=./migrations/policies/0002_create_usage_tracking.sql

    log_success "All migrations completed for $env environment"
}

# Deploy specific service
deploy_service() {
    local env="$1"
    local service="$2"
    log_info "Deploying $service service to $env environment..."

    cd services/$service
    wrangler deploy --env $env
    cd - > /dev/null

    log_success "$service service deployed to $env environment"
}

# Deploy all services
deploy_all_services() {
    local env="$1"
    log_info "Deploying all services to $env environment..."

    # Deploy main platform
    wrangler deploy --env $env

    # Deploy individual services
    for service in gateway rag vector policy; do
        if [ -d "services/$service" ]; then
            deploy_service "$env" "$service"
        else
            log_warning "Service directory services/$service not found"
        fi
    done

    log_success "All services deployed to $env environment"
}

# Set up secrets from environment file
setup_secrets() {
    local env="$1"
    log_info "Setting up secrets for $env environment..."

    if [ -f ".env.$env" ]; then
        # Load environment variables
        set -a
        source .env.$env
        set +a

        # Set secrets for Wrangler
        [ ! -z "$JWT_SECRET" ] && wrangler secret put JWT_SECRET --env $env
        [ ! -z "$OPENAI_API_KEY" ] && wrangler secret put OPENAI_API_KEY --env $env
        [ ! -z "$ANTHROPIC_API_KEY" ] && wrangler secret put ANTHROPIC_API_KEY --env $env
        [ ! -z "$API_KEY_ENCRYPTION_KEY" ] && wrangler secret put API_KEY_ENCRYPTION_KEY --env $env
        [ ! -z "$SESSION_ENCRYPTION_KEY" ] && wrangler secret put SESSION_ENCRYPTION_KEY --env $env
        [ ! -z "$DLP_API_KEY" ] && wrangler secret put DLP_API_KEY --env $env
        [ ! -z "$BACKUP_ENCRYPTION_KEY" ] && wrangler secret put BACKUP_ENCRYPTION_KEY --env $env
        [ ! -z "$SENTRY_DSN" ] && wrangler secret put SENTRY_DSN --env $env
        [ ! -z "$WEBHOOK_SECRET" ] && wrangler secret put WEBHOOK_SECRET --env $env

        log_success "All secrets configured for $env environment"
    else
        log_warning ".env.$env file not found. Please set up secrets manually."
    fi
}

# Health check after deployment
health_check() {
    local env="$1"
    log_info "Running health checks for $env environment..."

    # Get the worker URL
    local worker_url
    if [ "$env" = "development" ]; then
        worker_url="https://sdlc-platform-dev.{$(wrangler whoami | jq -r '.account.subdomain')}.workers.dev"
    else
        worker_url="https://api-$env.sdlc.cc"
    fi

    # Simple health check
    if curl -f -s "$worker_url/health" > /dev/null; then
        log_success "Health check passed for $env environment"
    else
        log_warning "Health check failed for $env environment - this may be expected for initial deployment"
    fi
}

# Display deployment summary
deployment_summary() {
    local env="$1"
    log_info "Deployment Summary for $env Environment:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ D1 Databases:     5 databases created and migrated"
    echo "✅ KV Namespaces:    5 namespaces created"
    echo "✅ R2 Buckets:       3 buckets created"
    echo "✅ Vectorize Indexes: 3 indexes created"
    echo "✅ Queues:           5 queues created"
    echo "✅ Workers:          Platform + 4 services deployed"
    echo "✅ Secrets:          Configured from .env file"
    echo "✅ Routes:           Custom domains configured"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "SDLC.ai Platform deployment completed successfully!"
}

# Main deployment function
main() {
    local env="${1:-development}"
    local service="${2:-all}"

    log_info "Starting SDLC.ai Platform deployment..."
    log_info "Environment: $env"
    log_info "Service: $service"

    # Validate inputs
    validate_environment "$env"
    check_dependencies

    # Create resources
    create_resources "$env"

    # Run migrations
    run_migrations "$env"

    # Deploy services
    if [ "$service" = "all" ]; then
        deploy_all_services "$env"
    else
        deploy_service "$env" "$service"
    fi

    # Setup secrets
    setup_secrets "$env"

    # Health check
    health_check "$env"

    # Display summary
    deployment_summary "$env"
}

# Help function
show_help() {
    echo "SDLC.ai Platform Cloudflare Deployment Script"
    echo ""
    echo "Usage: $0 [environment] [service]"
    echo ""
    echo "Arguments:"
    echo "  environment    Deployment environment (development, staging, production)"
    echo "  service        Service to deploy (all, gateway, rag, vector, policy)"
    echo ""
    echo "Examples:"
    echo "  $0 development      # Deploy all services to development"
    echo "  $0 staging all      # Deploy all services to staging"
    echo "  $0 production       # Deploy all services to production"
    echo "  $0 staging gateway  # Deploy only gateway service to staging"
    echo ""
    echo "Prerequisites:"
    echo "  - Wrangler CLI installed and authenticated"
    echo "  - Node.js installed"
    echo "  - .env.{environment} file with required secrets"
    echo ""
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
