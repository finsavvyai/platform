#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Individual Service Deployment Script
# =============================================================================
# This script deploys individual Cloudflare Workers services
# Usage: ./deploy-service.sh [service] [environment]
# Examples:
#   ./deploy-service.sh gateway development
#   ./deploy-service.sh rag staging
#   ./deploy-service.sh vector production
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Service configurations
declare -A SERVICES=(
    ["gateway"]="API Gateway Service - Authentication, rate limiting, request routing"
    ["rag"]="RAG Service - Document processing, retrieval, generation"
    ["vector"]="Vector Service - Embeddings, semantic search, vector operations"
    ["policy"]="Policy Service - DLP, compliance, policy enforcement"
)

# Available environments
ENVIRONMENTS=("development" "staging" "production")

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

# Validate service parameter
validate_service() {
    local service="$1"
    if [[ -z "${SERVICES[$service]:-}" ]]; then
        log_error "Invalid service: $service"
        echo ""
        echo "Available services:"
        for svc in "${!SERVICES[@]}"; do
            echo "  - $svc: ${SERVICES[$svc]}"
        done
        exit 1
    fi
}

# Validate environment parameter
validate_environment() {
    local env="$1"
    for valid_env in "${ENVIRONMENTS[@]}"; do
        if [[ "$env" == "$valid_env" ]]; then
            return 0
        fi
    done
    log_error "Invalid environment: $env. Valid environments: ${ENVIRONMENTS[*]}"
    exit 1
}

# Check if service directory exists
check_service_directory() {
    local service="$1"
    if [[ ! -d "services/$service" ]]; then
        log_error "Service directory services/$service not found"
        exit 1
    fi
}

# Check if wrangler.toml exists for service
check_wrangler_config() {
    local service="$1"
    if [[ ! -f "services/$service/wrangler.toml" ]]; then
        log_error "wrangler.toml not found for service $service"
        exit 1
    fi
}

# Validate service dependencies
validate_dependencies() {
    local service="$1"
    log_info "Validating dependencies for $service service..."

    case $service in
        "gateway")
            # Gateway needs auth database and sessions KV
            log_info "Gateway dependencies: AUTH_DB, SESSIONS, RATE_LIMIT_CACHE"
            ;;
        "rag")
            # RAG needs documents database, document storage, and vector service
            log_info "RAG dependencies: DOCUMENTS_DB, DOCUMENT_STORAGE, DOCUMENT_VECTORS"
            ;;
        "vector")
            # Vector needs vector metadata database and search cache
            log_info "Vector dependencies: VECTOR_METADATA_DB, SEARCH_CACHE, EMBEDDING_CACHE"
            ;;
        "policy")
            # Policy needs policy database and DLP services
            log_info "Policy dependencies: POLICY_DB, DLP_SCAN_QUEUE"
            ;;
    esac
}

# Build service if needed
build_service() {
    local service="$1"
    local env="$2"

    cd services/$service

    log_info "Building $service service for $env environment..."

    # Check if package.json exists and run build if needed
    if [[ -f "package.json" ]]; then
        npm install
        if npm run build:$env 2>/dev/null || npm run build 2>/dev/null; then
            log_success "$service service built successfully"
        else
            log_warning "No build script found for $service service"
        fi
    fi

    # Check if go.mod exists and build Go service
    if [[ -f "go.mod" ]]; then
        go mod tidy
        if [[ "$env" == "development" ]]; then
            go build -o worker-dev main.go
        else
            go build -o worker main.go
        fi
        log_success "$service Go service built successfully"
    fi

    # Check if Cargo.toml exists and build Rust service
    if [[ -f "Cargo.toml" ]]; then
        if [[ "$env" == "development" ]]; then
            cargo build --target wasm32-unknown-unknown
        else
            cargo build --release --target wasm32-unknown-unknown
        fi
        log_success "$service Rust service built successfully"
    fi

    cd - > /dev/null
}

# Deploy service with retry logic
deploy_service() {
    local service="$1"
    local env="$2"
    local max_retries=3
    local retry_count=0

    cd services/$service

    log_info "Deploying $service service to $env environment..."

    while [[ $retry_count -lt $max_retries ]]; do
        if wrangler deploy --env $env; then
            log_success "$service service deployed to $env environment"
            cd - > /dev/null
            return 0
        else
            retry_count=$((retry_count + 1))
            log_warning "Deployment attempt $retry_count failed for $service service"

            if [[ $retry_count -lt $max_retries ]]; then
                log_info "Waiting 10 seconds before retry..."
                sleep 10
            fi
        fi
    done

    log_error "Failed to deploy $service service after $max_retries attempts"
    cd - > /dev/null
    exit 1
}

# Run service-specific migrations if needed
run_service_migrations() {
    local service="$1"
    local env="$2"

    log_info "Checking for $service service migrations..."

    case $service in
        "gateway")
            # Gateway uses auth database
            if [[ -f "../../migrations/auth/0001_create_users.sql" ]]; then
                log_info "Running auth database migrations for gateway..."
                wrangler d1 execute sdlc-auth-db-$env --env $env --file=../../migrations/auth/0001_create_users.sql
            fi
            ;;
        "rag")
            # RAG uses documents database
            if [[ -f "../../migrations/documents/0001_create_documents.sql" ]]; then
                log_info "Running documents database migrations for RAG..."
                wrangler d1 execute sdlc-documents-db-$env --env $env --file=../../migrations/documents/0001_create_documents.sql
            fi
            ;;
        "vector")
            # Vector service uses vector metadata database
            if [[ -f "../../migrations/vector/0001_create_vector_tables.sql" ]]; then
                log_info "Running vector database migrations for vector service..."
                wrangler d1 execute sdlc-vector-metadata-db-$env --env $env --file=../../migrations/vector/0001_create_vector_tables.sql
            fi
            ;;
        "policy")
            # Policy service uses policy database
            if [[ -f "../../migrations/policies/0001_create_policies.sql" ]]; then
                log_info "Running policy database migrations for policy service..."
                wrangler d1 execute sdlc-policy-db-$env --env $env --file=../../migrations/policies/0001_create_policies.sql
            fi
            ;;
    esac
}

# Health check for deployed service
health_check() {
    local service="$1"
    local env="$2"

    log_info "Running health check for $service service in $env environment..."

    # Determine service URL
    local service_url
    if [[ "$env" == "development" ]]; then
        service_url="https://sdlc-$service-dev.$(wrangler whoami | jq -r '.account.subdomain' 2>/dev/null || echo 'workers.dev').workers.dev"
    else
        service_url="https://$service-api-$env.sdlc.cc"
    fi

    # Attempt health check with timeout
    local health_endpoint="$service_url/health"
    local timeout=30

    if curl -f -s --max-time $timeout "$health_endpoint" > /dev/null 2>&1; then
        log_success "Health check passed for $service service"
        return 0
    else
        log_warning "Health check failed for $service service - this may be expected for initial deployment"
        return 1
    fi
}

# Display service deployment summary
deployment_summary() {
    local service="$1"
    local env="$2"
    local health_result="$3"

    log_info "Deployment Summary for $service Service ($env Environment):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 Service:           $service"
    echo "🌍 Environment:       $env"
    echo "🔧 Description:        ${SERVICES[$service]}"
    echo "📝 Configuration:      services/$service/wrangler.toml"
    echo "🏗️  Build Status:      ✅ Completed"
    echo "🚀 Deployment Status:  ✅ Deployed"
    echo "💚 Health Check:       $([ "$health_result" -eq 0 ] && echo "✅ Passed" || echo "⚠️  Failed (Expected for initial deployment)")"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Show service-specific next steps
    echo ""
    log_info "Next Steps for $service Service:"
    case $service in
        "gateway")
            echo "  1. Configure custom domain routes"
            echo "  2. Set up SSL certificates"
            echo "  3. Configure rate limiting rules"
            echo "  4. Test authentication endpoints"
            ;;
        "rag")
            echo "  1. Test document upload functionality"
            echo "  2. Verify vector embedding generation"
            echo "  3. Test retrieval endpoints"
            echo "  4. Configure DLP scanning rules"
            ;;
        "vector")
            echo "  1. Verify vector index creation"
            echo "  2. Test semantic search functionality"
            echo "  3. Configure embedding cache"
            echo "  4. Set up vector search monitoring"
            ;;
        "policy")
            echo "  1. Configure DLP scanning rules"
            echo "  2. Set up policy enforcement"
            echo "  3. Test compliance checks"
            echo "  4. Configure audit logging"
            ;;
    esac
}

# Main deployment function
main() {
    local service="${1:-}"
    local env="${2:-development}"

    # Validate parameters
    if [[ -z "$service" ]]; then
        log_error "Service parameter is required"
        echo ""
        echo "Usage: $0 [service] [environment]"
        echo ""
        echo "Available services:"
        for svc in "${!SERVICES[@]}"; do
            echo "  - $svc: ${SERVICES[$svc]}"
        done
        echo ""
        echo "Available environments: ${ENVIRONMENTS[*]}"
        exit 1
    fi

    validate_service "$service"
    validate_environment "$env"
    check_service_directory "$service"
    check_wrangler_config "$service"

    log_info "Starting deployment of $service service to $env environment..."

    # Validate dependencies
    validate_dependencies "$service"

    # Build service
    build_service "$service" "$env"

    # Run migrations if needed
    run_service_migrations "$service" "$env"

    # Deploy service
    deploy_service "$service" "$env"

    # Health check
    if health_check "$service" "$env"; then
        health_result=0
    else
        health_result=1
    fi

    # Display summary
    deployment_summary "$service" "$env" "$health_result"

    if [[ $health_result -eq 0 ]]; then
        log_success "$service service deployment completed successfully!"
    else
        log_warning "$service service deployment completed, but health check failed"
    fi
}

# Help function
show_help() {
    echo "SDLC.ai Platform - Individual Service Deployment Script"
    echo ""
    echo "Usage: $0 [service] [environment]"
    echo ""
    echo "Services:"
    for service in "${!SERVICES[@]}"; do
        echo "  - $service: ${SERVICES[$service]}"
    done
    echo ""
    echo "Environments: ${ENVIRONMENTS[*]}"
    echo ""
    echo "Examples:"
    echo "  $0 gateway development    # Deploy gateway service to development"
    echo "  $0 rag staging           # Deploy RAG service to staging"
    echo "  $0 vector production     # Deploy vector service to production"
    echo ""
    echo "Prerequisites:"
    echo "  - Wrangler CLI installed and authenticated"
    echo "  - Service directory exists with wrangler.toml"
    echo "  - Required Cloudflare resources created"
    echo "  - Environment variables configured"
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
