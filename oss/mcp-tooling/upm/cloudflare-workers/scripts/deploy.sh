#!/bin/bash

# UPM Cloudflare Workers Deployment Script
# This script deploys the UPM API Gateway to Cloudflare Workers

set -e  # Exit on any error

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

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please run: npm install -g wrangler"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18 or later."
        exit 1
    fi

    log_success "All dependencies are installed"
}

# Authenticate with Cloudflare
authenticate() {
    log_info "Authenticating with Cloudflare..."

    if ! wrangler whoami &> /dev/null; then
        log_warning "Not authenticated with Cloudflare. Please run: wrangler login"
        wrangler login
    fi

    log_success "Authenticated with Cloudflare"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    cd "$PROJECT_ROOT"
    npm install

    log_success "Dependencies installed"
}

# Create KV namespaces
create_kv_namespaces() {
    log_info "Creating KV namespaces..."

    cd "$PROJECT_ROOT"

    # Create production KV namespaces
    if wrangler kv:namespace list | grep -q "upm-cache-production"; then
        log_info "upm-cache-production already exists"
    else
        log_info "Creating upm-cache-production namespace..."
        KV_ID=$(wrangler kv:namespace create "upm-cache-production" --env production | grep "id" | cut -d'"' -f4)
        log_success "Created upm-cache-production with ID: $KV_ID"
    fi

    if wrangler kv:namespace list | grep -q "dependency-cache-production"; then
        log_info "dependency-cache-production already exists"
    else
        log_info "Creating dependency-cache-production namespace..."
        KV_ID=$(wrangler kv:namespace create "dependency-cache-production" --env production | grep "id" | cut -d'"' -f4)
        log_success "Created dependency-cache-production with ID: $KV_ID"
    fi

    # Create staging KV namespaces
    if wrangler kv:namespace list | grep -q "upm-cache-staging"; then
        log_info "upm-cache-staging already exists"
    else
        log_info "Creating upm-cache-staging namespace..."
        KV_ID=$(wrangler kv:namespace create "upm-cache-staging" --env staging | grep "id" | cut -d'"' -f4)
        log_success "Created upm-cache-staging with ID: $KV_ID"
    fi

    log_success "KV namespaces created successfully"
}

# Create D1 databases
create_d1_databases() {
    log_info "Creating D1 databases..."

    cd "$PROJECT_ROOT"

    # Create production database
    if wrangler d1 list | grep -q "upm-database-production"; then
        log_info "upm-database-production already exists"
    else
        log_info "Creating upm-database-production..."
        DB_ID=$(wrangler d1 create "upm-database-production" | grep "database_id" | cut -d'"' -f4)
        log_success "Created upm-database-production with ID: $DB_ID"
    fi

    # Create staging database
    if wrangler d1 list | grep -q "upm-database-staging"; then
        log_info "upm-database-staging already exists"
    else
        log_info "Creating upm-database-staging..."
        DB_ID=$(wrangler d1 create "upm-database-staging" | grep "database_id" | cut -d'"' -f4)
        log_success "Created upm-database-staging with ID: $DB_ID"
    fi

    log_success "D1 databases created successfully"
}

# Create R2 buckets
create_r2_buckets() {
    log_info "Creating R2 buckets..."

    cd "$PROJECT_ROOT"

    # Create production bucket
    if wrangler r2 bucket list | grep -q "upm-storage-production"; then
        log_info "upm-storage-production already exists"
    else
        log_info "Creating upm-storage-production..."
        wrangler r2 bucket create "upm-storage-production"
        log_success "Created upm-storage-production bucket"
    fi

    # Create staging bucket
    if wrangler r2 bucket list | grep -q "upm-storage-staging"; then
        log_info "upm-storage-staging already exists"
    else
        log_info "Creating upm-storage-staging..."
        wrangler r2 bucket create "upm-storage-staging"
        log_success "Created upm-storage-staging bucket"
    fi

    log_success "R2 buckets created successfully"
}

# Create queues
create_queues() {
    log_info "Creating queues..."

    cd "$PROJECT_ROOT"

    if wrangler queues list | grep -q "upm-analysis-queue"; then
        log_info "upm-analysis-queue already exists"
    else
        log_info "Creating upm-analysis-queue..."
        wrangler queues create "upm-analysis-queue"
        log_success "Created upm-analysis-queue"
    fi

    log_success "Queues created successfully"
}

# Set secrets
set_secrets() {
    log_info "Setting secrets for $ENVIRONMENT environment..."

    cd "$PROJECT_ROOT"

    # Required secrets
    declare -a secrets=(
        "UPM_BACKEND_URL"
        "JWT_SECRET"
        "VULNERABILITY_DB_API_KEY"
        "GITHUB_TOKEN"
        "NPM_TOKEN"
    )

    for secret in "${secrets[@]}"; do
        if [[ -z "${!secret}" ]]; then
            log_warning "Secret $secret is not set. Please set it as environment variable or enter it now:"
            read -p "Enter $secret: " value
            wrangler secret put "$secret" --env "$ENVIRONMENT" <<< "$value"
        else
            log_info "Setting secret: $secret"
            echo "${!secret}" | wrangler secret put "$secret" --env "$ENVIRONMENT"
        fi
    done

    log_success "Secrets configured successfully"
}

# Run tests
run_tests() {
    log_info "Running tests..."

    cd "$PROJECT_ROOT"

    if [[ "$ENVIRONMENT" == "production" ]]; then
        npm test
        log_success "Tests passed"
    else
        log_warning "Skipping tests for staging environment"
    fi
}

# Build and deploy
deploy_worker() {
    log_info "Building and deploying worker to $ENVIRONMENT..."

    cd "$PROJECT_ROOT"

    # Build
    npm run build

    # Deploy
    if [[ "$ENVIRONMENT" == "production" ]]; then
        wrangler deploy --env production
        log_success "Worker deployed to production"
    else
        wrangler deploy --env staging
        log_success "Worker deployed to staging"
    fi
}

# Upload static assets
upload_static_assets() {
    log_info "Uploading static assets to R2..."

    cd "$PROJECT_ROOT"

    # Find and upload web UI assets
    if [[ -d "../web-ui/dist" ]]; then
        wrangler r2 object sync "../web-ui/dist" "r2://upm-storage-$ENVIRONMENT" --env "$ENVIRONMENT"
        log_success "Static assets uploaded"
    else
        log_warning "Web UI assets not found at ../web-ui/dist"
    fi
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    local domain
    if [[ "$ENVIRONMENT" == "production" ]]; then
        domain="api.upm.plus"
    else
        domain="api-staging.upm.plus"
    fi

    # Wait for deployment to be ready
    sleep 10

    # Test health endpoint
    if curl -f "https://$domain/health" > /dev/null 2>&1; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        return 1
    fi

    log_success "Deployment verified successfully"
}

# Main deployment function
main() {
    log_info "Starting UPM Cloudflare Workers deployment..."
    log_info "Environment: $ENVIRONMENT"

    check_dependencies
    authenticate
    install_dependencies

    if [[ "$ENVIRONMENT" == "production" ]]; then
        create_kv_namespaces
        create_d1_databases
        create_r2_buckets
        create_queues
        run_tests
    fi

    set_secrets
    deploy_worker
    upload_static_assets
    verify_deployment

    log_success "🚀 Deployment completed successfully!"
    log_info "Your UPM API Gateway is now live at:"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "  API: https://api.upm.plus"
        log_info "  Dashboard: https://upm.plus"
    else
        log_info "  API: https://api-staging.upm.plus"
        log_info "  Dashboard: https://staging.upm.plus"
    fi
}

# Handle script arguments
case "${1:-}" in
    "staging"|"production")
        main "$@"
        ;;
    "dev")
        log_info "Starting development server..."
        cd "$PROJECT_ROOT"
        wrangler dev --env staging
        ;;
    "kv"|"d1"|"r2"|"queue")
        setup_$1
        ;;
    "test")
        cd "$PROJECT_ROOT"
        npm test
        ;;
    "lint")
        cd "$PROJECT_ROOT"
        npm run lint
        ;;
    "format")
        cd "$PROJECT_ROOT"
        npm run format
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment] [options]"
        echo ""
        echo "Environments:"
        echo "  staging     Deploy to staging (default)"
        echo "  production  Deploy to production"
        echo "  dev         Start development server"
        echo ""
        echo "Options:"
        echo "  test        Run tests"
        echo "  lint        Run linter"
        echo "  format      Format code"
        echo "  help        Show this help message"
        ;;
    *)
        log_error "Invalid environment: $1"
        echo "Use 'staging', 'production', or 'dev'"
        exit 1
        ;;
esac
