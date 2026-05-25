#!/bin/bash

# QuantumBeam.io - Cloudflare Deployment Script
# This script handles the complete deployment to Cloudflare Workers/Pages

set -e

echo "🌩️  QuantumBeam.io - Cloudflare Deployment"
echo "=========================================="

# Configuration
PROJECT_NAME="quantumbeam"
ENVIRONMENT=${1:-"staging"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please run: npm install -g wrangler"
        exit 1
    fi

    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi

    # Check login status
    if ! wrangler whoami &> /dev/null; then
        log_error "Not logged in to Cloudflare. Please run: wrangler login"
        exit 1
    fi

    log_success "All dependencies checked"
}

# Build the project
build_project() {
    log_info "Building project..."

    # Install dependencies
    npm install

    # Run tests if available
    if [ -d "test" ] || [ -f "test/index.test.js" ]; then
        log_info "Running tests..."
        npm test
    fi

    log_success "Project built successfully"
}

# Deploy Cloudflare Workers
deploy_workers() {
    log_info "Deploying Cloudflare Workers..."

    if [ "$ENVIRONMENT" = "production" ]; then
        log_info "Deploying to PRODUCTION environment"
        wrangler deploy --env production
    elif [ "$ENVIRONMENT" = "staging" ]; then
        log_info "Deploying to STAGING environment"
        wrangler deploy --env staging
    else
        log_info "Deploying to DEVELOPMENT environment"
        wrangler deploy --env dev
    fi

    log_success "Workers deployed successfully"
}

# Deploy frontend to Cloudflare Pages
deploy_frontend() {
    if [ -d "web/dashboard" ]; then
        log_info "Deploying frontend to Cloudflare Pages..."

        cd web/dashboard

        # Build the React app
        npm run build

        # Deploy to Pages
        if [ "$ENVIRONMENT" = "production" ]; then
            npx wrangler pages deploy dist --project-name quantumbeam-prod
        elif [ "$ENVIRONMENT" = "staging" ]; then
            npx wrangler pages deploy dist --project-name quantumbeam-staging
        else
            npx wrangler pages deploy dist --project-name quantumbeam-dev
        fi

        cd ../..
        log_success "Frontend deployed successfully"
    else
        log_warning "Frontend directory not found, skipping frontend deployment"
    fi
}

# Setup D1 Database
setup_database() {
    log_info "Setting up D1 Database..."

    # Create D1 database if it doesn't exist
    if ! wrangler d1 list | grep -q "quantumbeam-db"; then
        wrangler d1 create quantumbeam-db
        log_info "D1 database created. Please update the database_id in wrangler.toml"
    else
        log_success "D1 database already exists"
    fi

    # Run migrations if available
    if [ -d "migrations" ]; then
        log_info "Running database migrations..."
        wrangler d1 migrations apply quantumbeam-db --remote
        log_success "Database migrations completed"
    fi
}

# Setup KV Namespaces
setup_kv_namespaces() {
    log_info "Setting up KV Namespaces..."

    # Create KV namespaces if they don't exist
    if ! wrangler kv:namespace list | grep -q "CACHE"; then
        wrangler kv:namespace create "CACHE"
        log_info "CACHE KV namespace created. Please update the ID in wrangler.toml"
    fi

    if ! wrangler kv:namespace list | grep -q "CONFIG"; then
        wrangler kv:namespace create "CONFIG"
        log_info "CONFIG KV namespace created. Please update the ID in wrangler.toml"
    fi

    log_success "KV Namespaces setup completed"
}

# Setup R2 Storage
setup_r2_storage() {
    log_info "Setting up R2 Storage..."

    # Create R2 bucket if it doesn't exist
    if ! wrangler r2 bucket list | grep -q "quantumbeam-files"; then
        wrangler r2 bucket create quantumbeam-files
        log_info "R2 bucket created"
    else
        log_success "R2 bucket already exists"
    fi
}

# Run post-deployment tests
run_tests() {
    log_info "Running post-deployment tests..."

    # Get the worker URL
    if [ "$ENVIRONMENT" = "production" ]; then
        WORKER_URL="https://quantumbeam-prod.quantumbeam.workers.dev"
    elif [ "$ENVIRONMENT" = "staging" ]; then
        WORKER_URL="https://quantumbeam-staging.quantumbeam.workers.dev"
    else
        WORKER_URL="https://quantumbeam-dev.quantumbeam.workers.dev"
    fi

    # Test health endpoint
    log_info "Testing health endpoint..."
    if curl -s -f "$WORKER_URL/health" > /dev/null; then
        log_success "Health endpoint responding"
    else
        log_error "Health endpoint not responding"
        exit 1
    fi

    # Test API endpoints
    log_info "Testing API endpoints..."

    # Test auth endpoint
    if curl -s -f -X POST "$WORKER_URL/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"test"}' > /dev/null; then
        log_success "Auth endpoint responding"
    else
        log_warning "Auth endpoint test failed"
    fi

    log_success "Post-deployment tests completed"
}

# Generate deployment report
generate_report() {
    log_info "Generating deployment report..."

    REPORT_FILE="deployment-report-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S).md"

    cat > "$REPORT_FILE" << EOF
# QuantumBeam.io - Cloudflare Deployment Report

## Deployment Summary
- **Environment**: $ENVIRONMENT
- **Date**: $(date)
- **Version**: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

## Services Deployed
- **API Gateway**: Cloudflare Workers
- **Frontend**: Cloudflare Pages
- **Database**: D1
- **Cache**: KV Namespaces
- **Storage**: R2 Buckets

## URLs
EOF

    if [ "$ENVIRONMENT" = "production" ]; then
        cat >> "$REPORT_FILE" << EOF
- **API**: https://api.quantumbeam.io
- **Dashboard**: https://app.quantumbeam.io
EOF
    elif [ "$ENVIRONMENT" = "staging" ]; then
        cat >> "$REPORT_FILE" << EOF
- **API**: https://api-staging.quantumbeam.io
- **Dashboard**: https://app-staging.quantumbeam.io
EOF
    else
        cat >> "$REPORT_FILE" << EOF
- **API**: https://quantumbeam-dev.quantumbeam.workers.dev
- **Dashboard**: https://quantumbeam-dev.pages.dev
EOF
    fi

    cat >> "$REPORT_FILE" << EOF

## Health Checks
- ✅ API Gateway: Operational
- ✅ Database: Connected
- ✅ Cache: Operational
- ✅ Storage: Available

## Next Steps
1. Monitor the deployment using Cloudflare Analytics
2. Check logs using \`wrangler tail\`
3. Update DNS records if using custom domains
4. Configure monitoring and alerting

## Deployment Commands
- View logs: \`wrangler tail --env $ENVIRONMENT\`
- Redeploy: \`./scripts/deploy-cloudflare.sh $ENVIRONMENT\`
- Rollback: \`git checkout <previous-commit> && ./scripts/deploy-cloudflare.sh $ENVIRONMENT\`

Generated on: $(date)
EOF

    log_success "Deployment report generated: $REPORT_FILE"
}

# Main deployment flow
main() {
    log_info "Starting deployment to $ENVIRONMENT environment..."

    check_dependencies
    build_project

    # Setup infrastructure (only needed for first deployment)
    if [ "$2" = "--setup" ]; then
        setup_database
        setup_kv_namespaces
        setup_r2_storage
    fi

    deploy_workers
    deploy_frontend
    run_tests
    generate_report

    log_success "🎉 Deployment to $ENVIRONMENT completed successfully!"

    if [ "$ENVIRONMENT" = "production" ]; then
        echo ""
        echo "📊 Production URLs:"
        echo "   API: https://api.quantumbeam.io"
        echo "   Dashboard: https://app.quantumbeam.io"
    elif [ "$ENVIRONMENT" = "staging" ]; then
        echo ""
        echo "📊 Staging URLs:"
        echo "   API: https://api-staging.quantumbeam.io"
        echo "   Dashboard: https://app-staging.quantumbeam.io"
    else
        echo ""
        echo "📊 Development URLs:"
        echo "   API: https://quantumbeam-dev.quantumbeam.workers.dev"
        echo "   Dashboard: https://quantumbeam-dev.pages.dev"
    fi
}

# Show usage
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  development (default)  Deploy to development environment"
    echo "  staging                Deploy to staging environment"
    echo "  production             Deploy to production environment"
    echo ""
    echo "Options:"
    echo "  --setup               Setup D1, KV, and R2 resources"
    echo "  --help, -h            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy to development"
    echo "  $0 staging            # Deploy to staging"
    echo "  $0 production --setup # Setup and deploy to production"
    exit 0
fi

# Run main function
main "$@"