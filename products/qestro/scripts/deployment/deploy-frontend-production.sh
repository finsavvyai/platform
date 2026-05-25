#!/bin/bash

# Frontend Production Deployment Script
# Builds and deploys the frontend to Cloudflare Pages with proper API configuration

set -e

echo "🚀 Deploying Qestro Frontend to Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Configuration
PROJECT_NAME="qestro-frontend"
BUILD_COMMAND="npm run build"
ENVIRONMENT="production"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if we're in the frontend directory
    if [ ! -f "package.json" ] || [ ! -d "src" ]; then
        log_error "This script must be run from the frontend directory"
        exit 1
    fi

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Run: npm install -g wrangler"
        exit 1
    fi

    # Check if wrangler is authenticated
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Run: wrangler login"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    npm ci --silent
    log_success "Dependencies installed"
}

# Run tests (if available)
run_tests() {
    if [ -f "package.json" ] && npm run test --silent 2>/dev/null; then
        log_info "Running tests..."
        npm run test --silent
        log_success "Tests passed"
    else
        log_warning "No tests found, skipping test execution"
    fi
}

# Type checking
run_type_check() {
    if npm run type-check --silent 2>/dev/null; then
        log_info "Running type check..."
        npm run type-check --silent
        log_success "Type check passed"
    else
        log_warning "Type check not available, skipping"
    fi
}

# Build the application
build_app() {
    log_info "Building application for production..."

    # Set production environment
    export NODE_ENV=production
    export VITE_APP_ENVIRONMENT=production

    # Run the build command
    if ! npm run build; then
        log_error "Build failed"
        exit 1
    fi

    # Verify build output
    if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
        log_error "Build output not found"
        exit 1
    fi

    log_success "Application built successfully"
}

# Create Cloudflare Pages configuration
create_pages_config() {
    log_info "Creating Cloudflare Pages configuration..."

    cat > wrangler.toml << 'EOF'
# Cloudflare Pages configuration for Qestro Frontend
name = "qestro-frontend"
compatibility_date = "2024-10-26"

# Environment variables
[env.production.vars]
VITE_API_URL = "https://api.qestro.app"
VITE_WS_URL = "wss://api.qestro.app"
VITE_APP_ENVIRONMENT = "production"
VITE_ENABLE_ANALYTICS = "true"
VITE_ENABLE_ERROR_REPORTING = "true"

# Build configuration
[build]
command = "npm run build"
cwd = "."
watch_dir = "src"

# Directory configuration
[env.production]
compatibility_flags = ["nodejs_compat"]
EOF

    log_success "Cloudflare Pages configuration created"
}

# Deploy to Cloudflare Pages
deploy_to_pages() {
    log_info "Deploying to Cloudflare Pages..."

    # Check if project exists
    if wrangler pages project list | grep -q "$PROJECT_NAME"; then
        log_info "Updating existing project..."
    else
        log_info "Creating new project..."
        wrangler pages project create "$PROJECT_NAME" --compatibility-date=2024-10-26
    fi

    # Deploy the application
    wrangler pages deploy dist --project-name="$PROJECT_NAME" --compatibility-date=2024-10-26

    log_success "Deployment completed successfully"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    # Get the deployment URL
    local deployment_url=$(wrangler pages deployment list --project-name="$PROJECT_NAME" | head -1 | awk '{print $1}')

    if [ -n "$deployment_url" ]; then
        log_success "Deployment available at: https://$deployment_url"

        # Test the deployment
        if curl -f -s --max-time 10 "https://$deployment_url" > /dev/null; then
            log_success "Deployment is accessible"
        else
            log_warning "Deployment might not be fully propagated yet"
        fi
    else
        log_warning "Could not retrieve deployment URL"
    fi
}

# Update DNS (manual step reminder)
update_dns_reminder() {
    echo ""
    log_info "📋 Next Steps - DNS Configuration"
    echo "=================================="
    echo ""
    echo "1. Update your DNS settings to point qestro.app to Cloudflare:"
    echo "   - A record: qestro.app -> Cloudflare IP"
    echo "   - A record: www.qestro.app -> Cloudflare IP"
    echo ""
    echo "2. Configure SSL (automatically handled by Cloudflare)"
    echo ""
    echo "3. Ensure api.qestro.app is configured to point to your backend"
    echo ""
    echo "4. Test the complete setup by visiting:"
    echo "   - https://qestro.app (should show the frontend)"
    echo "   - https://api.qestro.app/api/health (should show API health)"
    echo ""
}

# Cleanup
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f wrangler.toml
}

# Main execution
main() {
    echo "🌐 Qestro Frontend - Production Deployment"
    echo "=========================================="
    echo ""

    # Check for help flag
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --skip-tests    Skip running tests"
        echo "  --skip-build    Skip build step (uses existing dist)"
        echo "  --dry-run       Show what would be done without executing"
        echo "  --help          Show this help message"
        echo ""
        exit 0
    fi

    # Parse options
    SKIP_TESTS=false
    SKIP_BUILD=false
    DRY_RUN=false

    for arg in "$@"; do
        case $arg in
            --skip-tests) SKIP_TESTS=true ;;
            --skip-build) SKIP_BUILD=true ;;
            --dry-run) DRY_RUN=true ;;
        esac
    done

    if [ "$DRY_RUN" = true ]; then
        log_info "Dry run mode - showing what would be done:"
        echo ""
        echo "1. Check prerequisites (wrangler, authentication)"
        echo "2. Install dependencies (npm ci)"
        echo "3. Run tests and type checking"
        echo "4. Build application for production"
        echo "5. Create Cloudflare Pages configuration"
        echo "6. Deploy to Cloudflare Pages"
        echo "7. Verify deployment"
        echo ""
        update_dns_reminder
        exit 0
    fi

    # Execute deployment steps
    check_prerequisites
    install_dependencies

    if [ "$SKIP_TESTS" = false ]; then
        run_tests
        run_type_check
    fi

    if [ "$SKIP_BUILD" = false ]; then
        build_app
    else
        if [ ! -d "dist" ]; then
            log_error "No build output found. Cannot skip build."
            exit 1
        fi
        log_warning "Using existing build output"
    fi

    create_pages_config
    deploy_to_pages
    verify_deployment
    update_dns_reminder
    cleanup

    echo ""
    log_success "🎉 Frontend deployment completed successfully!"
    echo ""
}

# Handle script interruption
trap 'log_error "Script interrupted. Deployment may be incomplete."' INT TERM

# Run main function
main "$@"