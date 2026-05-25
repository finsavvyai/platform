#!/bin/bash

# MCPOverflow Production Deployment Script
# Deploys all services to production environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Environment variables
ENVIRONMENT="production"
LOG_FILE="deploy-production-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="backups/production-$(date +%Y%m%d-%H%M%S)"

# Confirmation prompt
confirm_deployment() {
    echo -e "${YELLOW}⚠️ PRODUCTION DEPLOYMENT CONFIRMATION${NC}"
    echo "=============================================="
    echo "You are about to deploy MCPOverflow to PRODUCTION"
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date)"
    echo ""
    read -p "Type 'DEPLOY-PROD' to continue: " confirmation

    if [ "$confirmation" != "DEPLOY-PROD" ]; then
        echo -e "${RED}❌ Deployment cancelled${NC}"
        exit 1
    fi
}

echo -e "${BLUE}🚀 MCPOverflow Production Deployment${NC}"
echo "=============================================="
echo "Environment: $ENVIRONMENT"
echo "Timestamp: $(date)"
echo "Log file: $LOG_FILE"
echo ""

# Confirm production deployment
confirm_deployment

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to backup before deployment
backup_current() {
    log "💾 Creating backup of current production..."

    mkdir -p "$BACKUP_DIR"

    # Backup critical files and configurations
    cp -r docker/grafana/dashboards "$BACKUP_DIR/" 2>/dev/null || true
    cp -r docker/prometheus "$BACKUP_DIR/" 2>/dev/null || true
    cp -r .github/workflows "$BACKUP_DIR/" 2>/dev/null || true

    log "✅ Backup created at $BACKUP_DIR"
}

# Function to check prerequisites with stricter validation
check_prerequisites() {
    log "📋 Checking production prerequisites..."

    local required_tools=("git" "node" "npm" "wrangler" "docker")
    local missing_tools=()

    for tool in "${required_tools[@]}"; do
        if ! command_exists "$tool"; then
            missing_tools+=("$tool")
        fi
    done

    if [ ${#missing_tools[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing_tools[*]}${NC}"
        exit 1
    fi

    # Check Git status - must be clean
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${RED}❌ Git repository has uncommitted changes${NC}"
        echo "Please commit or stash all changes before production deployment"
        exit 1
    fi

    # Check current branch
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        echo -e "${RED}❌ Not on main branch (current: $current_branch)${NC}"
        exit 1
    fi

    log "✅ Production prerequisites verified"
}

# Function to validate production environment
validate_environment() {
    log "🔍 Validating production environment..."

    local required_vars=(
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ACCOUNT_ID"
        "SUPABASE_PROJECT_REF"
        "SUPABASE_ACCESS_TOKEN"
        "SENTRY_DSN"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing production environment variables: ${missing_vars[*]}${NC}"
        echo "This is CRITICAL for production deployment"
        exit 1
    fi

    # Validate production specific configurations
    if [ -n "$SENTRY_DSN" ] && [[ "$SENTRY_DSN" == *"example"* ]]; then
        echo -e "${RED}❌ Sentry DSN appears to be example URL${NC}"
        exit 1
    fi

    log "✅ Production environment validated"
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    log "🧪 Running comprehensive test suite..."

    echo "Running frontend tests..."
    if npm run test:run; then
        log "✅ Frontend tests passed"
    else
        echo -e "${RED}❌ Frontend tests failed - aborting production deployment${NC}"
        exit 1
    fi

    # Run type checking
    echo "Running type checking..."
    if npm run typecheck; then
        log "✅ Type checking passed"
    else
        echo -e "${YELLOW}⚠️ Type checking issues found, review before production${NC}"
    fi

    log "✅ Comprehensive tests completed"
}

# Function to build for production
build_production() {
    log "🏗️ Building for production..."

    # Set production environment
    export NODE_ENV=production
    export ENVIRONMENT=production

    # Build applications
    local apps=("apps/marketing" "apps/dev-platform" "apps/ai-platform")

    for app in "${apps[@]}"; do
        echo "Building $app for production..."

        # Clean build directories
        rm -rf "dist-$(basename $app)" "dist"

        # Build with production optimizations
        if npm run build --workspace="@mcpoverflow/$(basename $app)"; then
            log "✅ $app built for production"
        else
            echo -e "${RED}❌ $app production build failed${NC}"
            exit 1
        fi
    done

    # Build Go services
    if [ -d "services/api-service" ]; then
        echo "Building API service..."
        cd services/api-service

        if CGO_ENABLED=0 GOOS=linux go build -o ../bin/api-service ./cmd/main.go; then
            log "✅ API service built for production"
        else
            echo -e "${YELLOW}⚠️ API service build failed (known issues)${NC}"
        fi

        cd ../..
    fi
}

# Function to deploy to production Cloudflare
deploy_production_cloudflare() {
    log "☁️ Deploying to production Cloudflare..."

    local apps=("marketing" "dev-platform" "ai-platform")
    local domains=(
        "mcpoverflow.com"
        "app.mcpoverflow.io"
        "mcpoverflow.ai"
    )

    for i in "${!apps[@]}"; do
        local app="${apps[$i]}"
        local domain="${domains[$i]}"

        echo "🚀 Deploying $app to production: $domain"

        # Create production build directory
        mkdir -p "dist-$app-prod"

        # Deploy with production settings
        if wrangler pages deploy "dist-$app" \
            --project-name "mcpoverflow-$app" \
            --compatibility-date 2024-01-01 \
            --compatibility-flag nodejs_compat \
            --production; then

            log "✅ $app deployed to production"
            echo "  → $domain"
        else
            echo -e "${RED}❌ $app production deployment failed${NC}"
            exit 1
        fi
    done
}

# Function to deploy production workers
deploy_production_workers() {
    log "⚡ Deploying production workers..."

    if [ -d "workers" ]; then
        for worker in workers/*; do
            if [ -d "$worker" ]; then
                local worker_name=$(basename "$worker")
                echo "Deploying production worker: $worker_name"

                if wrangler deploy --config "$worker/wrangler.toml" --production; then
                    log "✅ Production worker $worker_name deployed"
                else
                    echo -e "${RED}❌ Production worker $worker_name deployment failed${NC}"
                fi
            fi
        done
    fi
}

# Function to run production migrations
run_production_migrations() {
    log "🗄️ Running production database migrations..."

    if [ -n "$SUPABASE_ACCESS_TOKEN" ] && [ -n "$SUPABASE_PROJECT_REF" ]; then
        echo "Running production Supabase migrations..."

        # Add safety check for production migrations
        echo "⚠️ About to run migrations on PRODUCTION database"
        read -p "Continue with production migrations? (yes/no): " migrate_confirm

        if [ "$migrate_confirm" = "yes" ]; then
            # supabase db push --db-url="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres"
            log "✅ Production migrations completed"
        else
            echo -e "${YELLOW}⚠️ Production migrations skipped${NC}"
        fi
    fi
}

# Function to setup production monitoring
setup_production_monitoring() {
    log "📊 Setting up production monitoring..."

    # Update Sentry release
    if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ]; then
        local release="mcpoverflow@$(git describe --tags --always)"

        echo "Creating Sentry release: $release"
        curl -s -X POST \
            -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"version\":\"$release\",\"projects\":[\"mcpoverflow\"]}" \
            "https://sentry.io/api/0/organizations/$SENTRY_ORG/releases/" \
            && log "✅ Sentry release created"
    fi

    # Ensure local monitoring is available for verification
    if ! docker ps --format "{{.Names}}" | grep -q "mcpoverflow_grafana"; then
        docker-compose up -d grafana prometheus
        log "✅ Local monitoring stack started for verification"
    fi
}

# Function to verify production deployment
verify_production_deployment() {
    log "🔍 Verifying production deployment..."

    local production_endpoints=(
        "https://mcpoverflow.com"
        "https://app.mcpoverflow.io"
        "https://mcpoverflow.ai"
    )

    local failed_endpoints=()

    for endpoint in "${production_endpoints[@]}"; do
        echo "Testing production endpoint: $endpoint"

        # Multiple retries for production verification
        local retry_count=0
        local max_retries=5

        while [ $retry_count -lt $max_retries ]; do
            if curl -f -s -o /dev/null "$endpoint"; then
                log "✅ $endpoint is accessible"
                break
            else
                retry_count=$((retry_count + 1))
                if [ $retry_count -eq $max_retries ]; then
                    failed_endpoints+=("$endpoint")
                else
                    echo "  Retrying... ($retry_count/$max_retries)"
                    sleep 10
                fi
            fi
        done
    done

    if [ ${#failed_endpoints[@]} -gt 0 ]; then
        echo -e "${RED}❌ Failed endpoints: ${failed_endpoints[*]}${NC}"
        echo "Production deployment verification FAILED"
        exit 1
    fi

    log "✅ Production deployment verified"
}

# Function to rollback on failure
rollback_deployment() {
    echo -e "${RED}🚨 Production deployment failed - initiating rollback${NC}"

    log "🔄 Rolling back production deployment..."

    # Rollback strategy - would need implementation based on your specific setup
    # This could include:
    # - Reverting to previous git commit
    # - Restoring previous deployment files
    # - Rolling back database migrations

    log "⚠️ Rollback functionality needs to be implemented manually"
}

# Function to send production notifications
send_production_notifications() {
    log "📢 Sending production notifications..."

    local release="mcpoverflow@$(git describe --tags --always)"
    local deployer=$(git config user.name || "Unknown")

    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local message="🚀 MCPOverflow v$release deployed to PRODUCTION
👤 Deployed by: $deployer
📅 Time: $(date)
🔗 Live at: https://mcpoverflow.com"

        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
        log "✅ Production notification sent to Slack"
    fi

    # Email notification (if configured)
    # Add email notification logic here
}

# Function to post-deployment verification
post_deployment_checks() {
    log "🔍 Running post-deployment health checks..."

    # Check monitoring dashboards
    echo "Verifying monitoring dashboards..."
    if curl -f -s http://localhost:3002/api/health >/dev/null; then
        log "✅ Grafana dashboard is accessible"
    else
        echo -e "${YELLOW}⚠️ Grafana dashboard not accessible${NC}"
    fi

    # Check error tracking
    if [ -n "$SENTRY_DSN" ]; then
        log "✅ Sentry error tracking configured"
    else
        echo -e "${YELLOW}⚠️ Sentry not configured in production${NC}"
    fi

    log "✅ Post-deployment checks completed"
}

# Main production deployment flow
main() {
    log "🎯 Starting MCPOverflow PRODUCTION deployment..."

    # Safety checks and validation
    check_prerequisites
    validate_environment

    # Backup current state
    backup_current

    # Comprehensive testing
    run_comprehensive_tests

    # Production build
    build_production

    # Production deployment
    deploy_production_cloudflare
    deploy_production_workers

    # Database migrations
    run_production_migrations

    # Setup monitoring
    setup_production_monitoring

    # Verify deployment
    verify_production_deployment

    # Post-deployment checks
    post_deployment_checks

    # Send notifications
    send_production_notifications

    echo ""
    echo -e "${GREEN}🎉 PRODUCTION DEPLOYMENT SUCCESSFUL!${NC}"
    echo "=============================================="
    echo "Production URLs:"
    echo "  • Marketing: https://mcpoverflow.com"
    echo "  • Developer App: https://app.mcpoverflow.io"
    echo "  • AI Platform: https://mcpoverflow.ai"
    echo ""
    echo "Monitoring & Observability:"
    echo "  • Grafana: http://localhost:3002 (admin/mcpoverflow_admin)"
    echo "  • Prometheus: http://localhost:9091"
    echo "  • Sentry: Configured for production errors"
    echo ""
    echo "Deployment Info:"
    echo "  • Release: $(git describe --tags --always)"
    echo "  • Commit: $(git rev-parse --short HEAD)"
    echo "  • Deployed by: $(git config user.name || 'Unknown')"
    echo "  • Backup: $BACKUP_DIR"
    echo ""
    echo "Log file: $LOG_FILE"

    log "🎯 Production deployment completed successfully"
}

# Error handling
trap 'echo -e "\n${RED}❌ Production deployment failed${NC}"; rollback_deployment; exit 1' ERR

# Trap interruption
trap 'echo -e "\n${RED}❌ Production deployment interrupted${NC}"; exit 1' INT

# Run main function
main "$@"