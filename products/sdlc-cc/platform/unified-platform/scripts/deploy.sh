#!/bin/bash

# Unified Compliance Platform Deployment Script
# This script automates the deployment process across different environments

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
ENVIRONMENT=${1:-development}
DOMAIN=${2:-unified.sdlc.finsavvyai.com}

# Helper functions
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

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please install it with: npm install -g wrangler"
        exit 1
    fi

    # Check if node is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi

    # Check Node.js version
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION is too old. Please upgrade to 18.0.0 or higher"
        exit 1
    fi

    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found. Please run this script from the project root."
        exit 1
    fi

    log_success "Prerequisites check passed"
}

setup_environment() {
    log_info "Setting up $ENVIRONMENT environment..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log_info "Installing dependencies..."
    npm install

    # Run linting and tests
    log_info "Running code quality checks..."
    npm run lint
    npm run test

    # Copy environment-specific wrangler.toml if it exists
    if [ -f "wrangler.$ENVIRONMENT.toml" ]; then
        log_info "Using environment-specific wrangler configuration..."
        cp "wrangler.$ENVIRONMENT.toml" wrangler.toml
    fi

    log_success "Environment setup completed"
}

setup_secrets() {
    log_info "Setting up secrets..."

    # List of required secrets
    local secrets=(
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
        "GOOGLE_AI_API_KEY"
        "AWS_ACCESS_KEY_ID"
        "AWS_SECRET_ACCESS_KEY"
        "SESSION_SECRET"
    )

    local missing_secrets=()

    # Check which secrets are already set
    for secret in "${secrets[@]}"; do
        if ! wrangler secret list | grep -q "$secret"; then
            missing_secrets+=("$secret")
        fi
    done

    # Prompt for missing secrets
    if [ ${#missing_secrets[@]} -gt 0 ]; then
        log_warning "The following secrets need to be set:"
        for secret in "${missing_secrets[@]}"; do
            echo "  - $secret"
        done

        read -p "Do you want to set these secrets now? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for secret in "${missing_secrets[@]}"; do
                read -p "Enter value for $secret: " -s value
                echo
                echo "$value" | wrangler secret put "$secret"
            done
        else
            log_warning "Skipping secrets setup. You may need to configure them manually."
        fi
    else
        log_success "All required secrets are already configured"
    fi
}

setup_database() {
    log_info "Setting up database and storage..."

    # Create D1 database if it doesn't exist
    DB_NAME="unified-platform-$ENVIRONMENT"
    if ! wrangler d1 list | grep -q "$DB_NAME"; then
        log_info "Creating D1 database: $DB_NAME"
        wrangler d1 create "$DB_NAME"

        # Update wrangler.toml with the new database ID
        log_info "Please update your wrangler.toml with the new database ID"
        read -p "Press Enter to continue after updating wrangler.toml..."
    fi

    # Create R2 bucket if it doesn't exist
    BUCKET_NAME="unified-platform-storage-$ENVIRONMENT"
    if ! wrangler r2 bucket list | grep -q "$BUCKET_NAME"; then
        log_info "Creating R2 bucket: $BUCKET_NAME"
        wrangler r2 bucket create "$BUCKET_NAME"
    fi

    # Create KV namespaces if they don't exist
    local kv_namespaces=(
        "UNIFIED_USERS"
        "UNIFIED_AUTH"
        "UNIFIED_METRICS"
        "UNIFIED_CONFIG"
    )

    for namespace in "${kv_namespaces[@]}"; do
        if ! wrangler kv namespace list | grep -q "$namespace"; then
            log_info "Creating KV namespace: $namespace"
            wrangler kv namespace create "$namespace"
        fi
    done

    log_success "Database and storage setup completed"
}

run_migrations() {
    log_info "Running database migrations..."

    # Run migrations if they exist
    if [ -d "$PROJECT_ROOT/migrations" ]; then
        for migration in "$PROJECT_ROOT/migrations"/*.sql; do
            if [ -f "$migration" ]; then
                migration_name=$(basename "$migration")
                log_info "Running migration: $migration_name"
                wrangler d1 execute unified-platform-$ENVIRONMENT --file="$migration"
            fi
        done
    fi

    log_success "Database migrations completed"
}

deploy_application() {
    log_info "Deploying application to $ENVIRONMENT..."

    cd "$PROJECT_ROOT"

    # Deploy to Cloudflare Workers
    if [ "$ENVIRONMENT" = "production" ]; then
        wrangler deploy --env production
    elif [ "$ENVIRONMENT" = "staging" ]; then
        wrangler deploy --env staging
    else
        wrangler deploy
    fi

    log_success "Application deployed successfully"
}

setup_domain() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Setting up custom domain: $DOMAIN"

        # Check if domain already exists
        if ! wrangler custom-domain list | grep -q "$DOMAIN"; then
            wrangler custom-domain create "$DOMAIN"
            log_success "Custom domain configured: $DOMAIN"
        else
            log_info "Custom domain already configured: $DOMAIN"
        fi
    fi
}

run_health_checks() {
    log_info "Running health checks..."

    # Wait a moment for deployment to settle
    sleep 10

    # Check if the application is responding
    local health_url="https://$DOMAIN/api/health"
    if [ "$ENVIRONMENT" != "production" ]; then
        health_url="https://unified-compliance-dev.$DOMAIN.workers.dev/api/health"
    fi

    log_info "Checking health endpoint: $health_url"

    if curl -f -s "$health_url" > /dev/null; then
        log_success "Health check passed"
    else
        log_warning "Health check failed. The application may still be starting up."
    fi
}

cleanup() {
    log_info "Cleaning up temporary files..."
    # Remove any temporary files created during deployment
    rm -f "$PROJECT_ROOT/wrangler.toml.local"
}

main() {
    log_info "Starting deployment of Unified Compliance Platform"
    log_info "Environment: $ENVIRONMENT"
    log_info "Domain: $DOMAIN"

    # Trap cleanup
    trap cleanup EXIT

    # Run deployment steps
    check_prerequisites
    setup_environment
    setup_secrets
    setup_database
    run_migrations
    deploy_application
    setup_domain
    run_health_checks

    log_success "🎉 Deployment completed successfully!"
    log_info "Your Unified Compliance Platform is now live at: https://$DOMAIN"
    log_info "Dashboard: https://app.$DOMAIN"

    if [ "$ENVIRONMENT" != "production" ]; then
        log_info "Development URL: https://unified-compliance-dev.$DOMAIN.workers.dev"
    fi
}

# Help function
show_help() {
    echo "Usage: $0 [ENVIRONMENT] [DOMAIN]"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT    Deployment environment (development|staging|production) [default: development]"
    echo "  DOMAIN         Custom domain for production deployment [default: unified.sdlc.finsavvyai.com]"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 staging"
    echo "  $0 production my-compliance-platform.com"
    echo ""
    echo "Environment variables:"
    echo "  CLOUDFLARE_API_TOKEN    Your Cloudflare API token"
    echo "  CLOUDFLARE_ACCOUNT_ID   Your Cloudflare account ID"
}

# Parse command line arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_help
    exit 0
fi

# Run main function
main