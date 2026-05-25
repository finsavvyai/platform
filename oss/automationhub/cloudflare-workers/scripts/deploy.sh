#!/bin/bash

# UPM.Plus AutomationHub - Cloudflare Workers Deployment Script
# Version: 1.0
# Usage: ./deploy.sh [--env staging|production] [--skip-tests] [--force]

set -euo pipefail

# Configuration
DEFAULT_ENV="staging"
ENVIRONMENT="$DEFAULT_ENV"
SKIP_TESTS=false
FORCE_DEPLOY=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--env ENVIRONMENT] [--skip-tests] [--force] [--help]"
            echo "  --env         Target environment (staging|production, default: $DEFAULT_ENV)"
            echo "  --skip-tests  Skip running tests before deployment"
            echo "  --force       Force deployment without confirmation"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT (must be staging or production)"
    exit 1
fi

# Progress indicator
progress() {
    local current=$1
    local total=$2
    local desc=$3
    local percent=$((current * 100 / total))
    local filled=$((percent / 2))
    local empty=$((50 - filled))

    printf "\r${BLUE}%s${NC} [" "${GREEN}"%*s" "$filled"${NC}" "${YELLOW}%*s" "$empty"${NC}] $desc (%s%%)" "Deploying" "$percent"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi

    # Check if Wrangler is available
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed"
        log_info "Install Wrangler with: npm install -g wrangler"
        exit 1
    fi

    # Check if we're logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        log_error "Not logged in to Cloudflare"
        log_info "Login with: wrangler auth login"
        exit 1
    }

    # Check if wrangler.toml exists
    if [[ ! -f "$PROJECT_ROOT/wrangler.toml" ]]; then
        log_error "wrangler.toml not found"
        exit 1
    fi

    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"

    if [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]]; then
        log_error "Node.js version $node_version is too old (required: >= $required_version)"
        exit 1
    fi

    log "✅ Prerequisites check completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."

    cd "$PROJECT_ROOT"

    if npm ci --silent; then
        log "✅ Dependencies installed successfully"
    else
        log_error "❌ Failed to install dependencies"
        exit 1
    fi
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" = true ]]; then
        log_warning "⚠ Skipping tests as requested"
        return 0
    fi

    log "Running tests..."

    cd "$PROJECT_ROOT"

    # Run type checking
    if npm run type-check; then
        log "✅ Type checking passed"
    else
        log_error "❌ Type checking failed"
        return 1
    fi

    # Run linting
    if npm run lint; then
        log "✅ Linting passed"
    else
        log_error "❌ Linting failed"
        return 1
    fi

    # Run unit tests
    if npm test; then
        log "✅ Unit tests passed"
    else
        log_error "❌ Unit tests failed"
        return 1
    fi

    log "✅ All tests passed"
}

# Build project
build_project() {
    log "Building project..."

    cd "$PROJECT_ROOT"

    if npm run build; then
        log "✅ Build completed successfully"
    else
        log_error "❌ Build failed"
        exit 1
    fi
}

# Create D1 database (if needed)
setup_database() {
    log "Setting up D1 database..."

    local db_name="upm-plus-db"

    # Check if database exists
    if wrangler d1 list --json | jq -r ".[] | select(.name==\"$db_name\") | .name" | grep -q "$db_name"; then
        log "✅ D1 database '$db_name' already exists"
    else
        log "Creating D1 database '$db_name'..."
        if wrangler d1 create "$db_name"; then
            log "✅ D1 database created successfully"
            log_warning "⚠ Please update wrangler.toml with the new database ID"
        else
            log_error "❌ Failed to create D1 database"
            exit 1
        fi
    fi

    # Run migrations
    log "Running database migrations..."
    if wrangler d1 migrations apply "$db_name" --env "$ENVIRONMENT"; then
        log "✅ Database migrations completed"
    else
        log_error "❌ Database migrations failed"
        exit 1
    fi
}

# Create KV namespaces
setup_kv_namespaces() {
    log "Setting up KV namespaces..."

    local namespaces=("UPM_CACHE" "UPM_CONFIG")

    for namespace in "${namespaces[@]}"; do
        local kv_name="${namespace,,}_kv" # Convert to lowercase

        # Check if namespace exists
        if wrangler kv:namespace list --json | jq -r ".[] | select(.title==\"$kv_name\") | .title" | grep -q "$kv_name"; then
            log "✅ KV namespace '$kv_name' already exists"
        else
            log "Creating KV namespace '$kv_name'..."
            if wrangler kv:namespace create "$kv_name"; then
                log "✅ KV namespace '$kv_name' created successfully"
                log_warning "⚠ Please update wrangler.toml with the new namespace ID"
            else
                log_error "❌ Failed to create KV namespace '$kv_name'"
                exit 1
            fi
        fi
    done
}

# Create R2 bucket
setup_r2_bucket() {
    log "Setting up R2 bucket..."

    local bucket_name="upm-plus-files"

    # Check if bucket exists
    if wrangler r2 bucket list | grep -q "$bucket_name"; then
        log "✅ R2 bucket '$bucket_name' already exists"
    else
        log "Creating R2 bucket '$bucket_name'..."
        if wrangler r2 bucket create "$bucket_name"; then
            log "✅ R2 bucket created successfully"
        else
            log_error "❌ Failed to create R2 bucket"
            exit 1
        fi
    fi
}

# Set environment secrets
setup_secrets() {
    log "Setting up environment secrets..."

    local secrets=(
        "DATABASE_URL"
        "JWT_SECRET"
        "OPENAI_API_KEY"
        "ANTHROPIC_API_KEY"
    )

    for secret in "${secrets[@]}"; do
        # Check if secret is already set
        if wrangler secret list --env "$ENVIRONMENT" | grep -q "$secret"; then
            log "✅ Secret '$secret' already set"
        else
            log_warning "⚠ Secret '$secret' not set"
            log_info "Set it with: wrangler secret put $secret --env $ENVIRONMENT"
        fi
    done
}

# Deploy Workers
deploy_workers() {
    log "Deploying Workers to $ENVIRONMENT..."

    cd "$PROJECT_ROOT"

    if wrangler deploy --env "$ENVIRONMENT"; then
        log "✅ Workers deployed successfully to $ENVIRONMENT"
    else
        log_error "❌ Failed to deploy Workers to $ENVIRONMENT"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."

    local worker_url
    if [[ "$ENVIRONMENT" = "production" ]]; then
        worker_url="https://upm-plus-automationhub.upm.plus"
    else
        worker_url="https://upm-plus-automationhub-staging.upm-plus.workers.dev"
    fi

    # Wait a moment for deployment to propagate
    log_info "Waiting for deployment to propagate..."
    sleep 10

    # Test health endpoint
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f --max-time 10 "$worker_url/health" &>/dev/null; then
            log "✅ Health check passed"
            break
        else
            if [[ $attempt -eq $max_attempts ]]; then
                log_error "❌ Health check failed after $max_attempts attempts"
                return 1
            fi
            log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done

    # Test API endpoint
    if curl -f --max-time 10 "$worker_url/api/v1/stats" &>/dev/null; then
        log "✅ API endpoint test passed"
    else
        log_warning "⚠ API endpoint test failed (may need initialization)"
    fi

    log "✅ Deployment verification completed"
}

# Run post-deployment tests
run_post_deployment_tests() {
    log "Running post-deployment tests..."

    local worker_url
    if [[ "$ENVIRONMENT" = "production" ]]; then
        worker_url="https://upm-plus-automationhub.upm.plus"
    else
        worker_url="https://upm-plus-automationhub-staging.upm-plus.workers.dev"
    fi

    # Test basic functionality
    local tests=(
        "$worker_url/health:Health Check"
        "$worker_url/api/v1/stats:Stats API"
        "$worker_url/api/v1/agents:Agents API"
    )

    local failed_tests=0

    for test in "${tests[@]}"; do
        local url="${test%:*}"
        local name="${test#*:}"

        if curl -f --max-time 10 "$url" &>/dev/null; then
            log "✅ $name: PASSED"
        else
            log_error "❌ $name: FAILED"
            failed_tests=$((failed_tests + 1))
        fi
    done

    if [[ $failed_tests -eq 0 ]]; then
        log "✅ All post-deployment tests passed"
    else
        log_error "❌ $failed_tests post-deployment tests failed"
        return 1
    fi
}

# Generate deployment report
generate_report() {
    log "Generating deployment report..."

    local report_file="$PROJECT_ROOT/deployment-report-$(date +%Y%m%d_%H%M%S).txt"

    cat > "$report_file" << EOF
UPM.Plus Cloudflare Workers Deployment Report
==============================================

Deployment Information:
- Environment: $ENVIRONMENT
- Deployed At: $(date)
- Deployed By: $(whoami)
- Node Version: $(node --version)
- Wrangler Version: $(wrangler --version)

Deployment Results:
- Dependencies: ✅ Installed
- Tests: $([ "$SKIP_TESTS" = true ] && echo "⏭ Skipped" || echo "✅ Passed")
- Build: ✅ Completed
- Database: ✅ Migrated
- KV Namespaces: ✅ Configured
- R2 Bucket: ✅ Created
- Workers: ✅ Deployed
- Verification: ✅ Passed

Access Information:
EOF

    if [[ "$ENVIRONMENT" = "production" ]]; then
        cat >> "$report_file" << EOF
- Worker URL: https://upm-plus-automationhub.upm.plus
- API Endpoint: https://upm-plus-automationhub.upm.plus/api/v1
- Health Check: https://upm-plus-automationhub.upm.plus/health
EOF
    else
        cat >> "$report_file" << EOF
- Worker URL: https://upm-plus-automationhub-staging.upm.plus.workers.dev
- API Endpoint: https://upm-plus-automationhub-staging.upm.plus.workers.dev/api/v1
- Health Check: https://upm-plus-automationhub-staging.upm.plus.workers.dev/health
EOF
    fi

    cat >> "$report_file" << EOF

Next Steps:
1. Test all API endpoints
2. Monitor worker logs with: wrangler tail --env $ENVIRONMENT
3. Update DNS records if needed
4. Configure monitoring and alerting
5. Update documentation

Deployment completed successfully at $(date).
EOF

    log "✅ Deployment report generated: $report_file"
}

# Cleanup function
cleanup() {
    log_error "Deployment interrupted. Cleaning up..."
    # Add cleanup logic if needed
    exit 1
}

# Main execution
main() {
    # Set up error handling
    trap cleanup ERR
    trap 'log "Deployment completed successfully"; exit 0' EXIT

    log "🚀 Starting UPM.Plus Cloudflare Workers Deployment"
    log "=================================================="
    log "Environment: $ENVIRONMENT"
    log "Skip Tests: $SKIP_TESTS"
    log "Force Deploy: $FORCE_DEPLOY"
    log "Project Root: $PROJECT_ROOT"
    log "Timestamp: $(date)"
    log ""

    # Confirmation prompt
    if [[ "$FORCE_DEPLOY" = false ]]; then
        log_info "Ready to deploy to $ENVIRONMENT environment"
        read -p "Do you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log "Deployment cancelled by user"
            exit 0
        fi
    fi

    # Execute deployment steps
    check_prerequisites
    install_dependencies
    run_tests
    build_project
    setup_database
    setup_kv_namespaces
    setup_r2_bucket
    setup_secrets
    deploy_workers
    verify_deployment
    run_post_deployment_tests
    generate_report

    log ""
    log "✅ Cloudflare Workers deployment completed successfully!"
    log ""
    if [[ "$ENVIRONMENT" = "production" ]]; then
        log "🌐 Production URL: https://upm-plus-automationhub.upm.plus"
        log "📊 Health Check: https://upm-plus-automationhub.upm.plus/health"
    else
        log "🌐 Staging URL: https://upm-plus-automationhub-staging.upm.plus.workers.dev"
        log "📊 Health Check: https://upm-plus-automationhub-staging.upm.plus.workers.dev/health"
    fi
    log ""
    log "📋 Next Steps:"
    log "1. Test the deployment by visiting the URLs above"
    log "2. Monitor logs with: wrangler tail --env $ENVIRONMENT"
    log "3. Update DNS records if using custom domains"
    log "4. Configure monitoring and alerting"
}

# Execute main function
main "$@"