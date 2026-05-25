#!/bin/bash

# SDLC.ai Cloudflare Workers Deployment Script
# Production deployment with safety checks and rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKERS_DIR="$PROJECT_ROOT/workers"
LOG_FILE="$PROJECT_ROOT/logs/deploy-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="$PROJECT_ROOT/backups"
ROLLBACK_FILE="$PROJECT_ROOT/.rollback-info"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# Create necessary directories
mkdir -p "$PROJECT_ROOT/logs" "$BACKUP_DIR"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI is not installed. Please install it with: npm install -g wrangler"
        exit 1
    fi

    # Check if node version is compatible
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    local node_version=$(node --version | cut -d'v' -f2)
    local required_node_version="18.0.0"
    if ! node -e "process.exit(require('semver').gte('$node_version', '$required_node_version') ? 0 : 1)" 2>/dev/null; then
        log_error "Node.js version $node_version is not compatible. Required: >= $required_node_version"
        exit 1
    fi

    # Check if authenticated with Cloudflare
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Please run: wrangler auth login"
        exit 1
    fi

    # Check if required environment variables are set
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
        log_warning "CLOUDFLARE_API_TOKEN not set in environment"
    fi

    if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
        log_warning "CLOUDFLARE_ACCOUNT_ID not set in environment"
    fi

    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    log_info "Running tests..."

    cd "$WORKERS_DIR"

    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --silent

    # Run type checking
    log_info "Running type checking..."
    npm run type-check || {
        log_error "Type checking failed"
        exit 1
    }

    # Run linting
    log_info "Running linting..."
    npm run lint || {
        log_error "Linting failed"
        exit 1
    }

    # Run unit tests
    log_info "Running unit tests..."
    npm run test || {
        log_error "Unit tests failed"
        exit 1
    }

    # Run integration tests if they exist
    if [[ -f "$WORKERS_DIR/tests/integration.test.ts" ]]; then
        log_info "Running integration tests..."
        npm run test:integration || {
            log_error "Integration tests failed"
            exit 1
        }
    fi

    log_success "All tests passed"
}

# Build the project
build_project() {
    log_info "Building project..."

    cd "$WORKERS_DIR"

    # Clean previous build
    rm -rf dist .wrangler

    # Build
    npm run build || {
        log_error "Build failed"
        exit 1
    }

    log_success "Build completed"
}

# Backup current deployment
backup_current() {
    log_info "Backing up current deployment..."

    cd "$WORKERS_DIR"

    # Get current deployment info
    local deployment_info=$(wrangler deployments list --env production 2>/dev/null || echo "{}")
    local current_id=$(echo "$deployment_info" | jq -r '.[0].id // empty')

    if [[ -n "$current_id" ]]; then
        # Save rollback information
        cat > "$ROLLBACK_FILE" <<EOF
ROLLBACK_ID="$current_id"
ROLLBACK_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ROLLBACK_ENVIRONMENT="production"
EOF

        # Backup configuration
        cp wrangler.prod.toml "$BACKUP_DIR/wrangler.prod.toml.backup-$(date +%Y%m%d-%H%M%S)"

        log_success "Backup completed. Rollback ID: $current_id"
    else
        log_warning "No current deployment found to backup"
    fi
}

# Deploy to staging first
deploy_staging() {
    log_info "Deploying to staging environment..."

    cd "$WORKERS_DIR"

    # Deploy to staging
    wrangler deploy --env staging || {
        log_error "Staging deployment failed"
        exit 1
    }

    # Run smoke tests against staging
    log_info "Running smoke tests against staging..."
    npm run test:smoke:staging || {
        log_error "Staging smoke tests failed"
        exit 1
    }

    log_success "Staging deployment and tests passed"
}

# Deploy to production
deploy_production() {
    log_info "Deploying to production environment..."

    cd "$WORKERS_DIR"

    # Create deployment preview (optional)
    if [[ "${USE_PREVIEW:-true}" == "true" ]]; then
        log_info "Creating deployment preview..."
        wrangler deploy --dry-run --env production
    fi

    # Deploy to production
    wrangler deploy --env production || {
        log_error "Production deployment failed"

        # Attempt rollback if we have a previous deployment
        if [[ -f "$ROLLBACK_FILE" ]]; then
            log_warning "Attempting rollback due to deployment failure..."
            source "$ROLLBACK_FILE"
            wrangler rollback "$ROLLBACK_ID" --env production || {
                log_error "Rollback failed!"
            }
        fi

        exit 1
    }

    log_success "Production deployment completed"
}

# Run post-deployment verification
verify_deployment() {
    log_info "Running post-deployment verification..."

    local api_url="https://api.sdlc.cc"
    local max_attempts=30
    local attempt=1
    local wait_time=10

    while [[ $attempt -le $max_attempts ]]; do
        log_info "Verification attempt $attempt/$max_attempts..."

        # Health check
        if curl -s -f "$api_url/health" > /dev/null; then
            log_success "Health check passed"

            # Additional verification
            log_info "Running additional verification checks..."

            # Check API endpoints
            if curl -s -f "$api_url/api/v1/auth/status" > /dev/null; then
                log_success "Auth endpoint responding"
            fi

            if curl -s -f "$api_url/api/v1/tenants/status" > /dev/null; then
                log_success "Tenants endpoint responding"
            fi

            # Check analytics
            if curl -s -f "$api_url/analytics/health" > /dev/null; then
                log_success "Analytics endpoint responding"
            fi

            log_success "Post-deployment verification completed successfully"
            return 0
        fi

        log_warning "Health check failed, waiting ${wait_time}s before retry..."
        sleep $wait_time
        ((attempt++))
    done

    log_error "Post-deployment verification failed after $max_attempts attempts"

    # Attempt rollback if enabled
    if [[ "${AUTO_ROLLBACK:-true}" == "true" ]] && [[ -f "$ROLLBACK_FILE" ]]; then
        log_warning "Attempting automatic rollback due to verification failure..."
        source "$ROLLBACK_FILE"
        wrangler rollback "$ROLLBACK_ID" --env production || {
            log_error "Automatic rollback failed!"
        }
    fi

    exit 1
}

# Run load test
run_load_test() {
    if [[ "${RUN_LOAD_TEST:-false}" == "true" ]]; then
        log_info "Running load test..."

        cd "$WORKERS_DIR"

        # Run k6 load test if available
        if command -v k6 &> /dev/null && [[ -f "tests/load/k6-test.js" ]]; then
            k6 run tests/load/k6-test.js --out json=load-test-results.json || {
                log_warning "Load test completed with warnings"
            }
        else
            log_warning "k6 not installed or load test file not found, skipping load test"
        fi
    fi
}

# Send notification
send_notification() {
    local status=$1
    local message=$2

    log_info "Sending deployment notification..."

    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        [[ "$status" == "failure" ]] && color="danger"

        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"SDLC.ai Deployment\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {
                            \"title\": \"Environment\",
                            \"value\": \"production\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Timestamp\",
                            \"value\": \"$(date -u)",
                            \"short\": true
                        },
                        {
                            \"title\": \"Branch\",
                            \"value\": \"${CIRCLE_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Commit\",
                            \"value\": \"${CIRCLE_SHA1:-$(git rev-parse HEAD)}\",
                            \"short\": true
                        }
                    ]
                }]
            }" || log_warning "Failed to send Slack notification"
    fi

    # Email notification
    if [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
        # Send email using your preferred service
        log_info "Email notification would be sent to: $NOTIFICATION_EMAIL"
    fi
}

# Cleanup old logs
cleanup_logs() {
    log_info "Cleaning up old logs..."

    # Keep only last 30 days of logs
    find "$PROJECT_ROOT/logs" -name "deploy-*.log" -mtime +30 -delete

    # Keep only last 10 backup files
    cd "$BACKUP_DIR"
    ls -t wrangler.prod.toml.backup-* 2>/dev/null | tail -n +11 | xargs -r rm

    log_success "Log cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting SDLC.ai Cloudflare Workers deployment..."
    log_info "Environment: production"
    log_info "Project: $PROJECT_ROOT"

    # Set trap for cleanup
    trap 'log_error "Deployment interrupted"; exit 1' INT TERM

    # Run deployment pipeline
    check_prerequisites
    run_tests
    build_project
    backup_current

    if [[ "${SKIP_STAGING:-false}" != "true" ]]; then
        deploy_staging
    fi

    deploy_production
    verify_deployment
    run_load_test

    # Success
    log_success "Deployment completed successfully!"
    send_notification "success" "Production deployment completed successfully"

    # Cleanup
    cleanup_logs

    log_info "Deployment log saved to: $LOG_FILE"
}

# Rollback function
rollback() {
    log_info "Starting rollback..."

    if [[ ! -f "$ROLLBACK_FILE" ]]; then
        log_error "No rollback information found"
        exit 1
    fi

    source "$ROLLBACK_FILE"

    log_info "Rolling back to deployment: $ROLLBACK_ID"

    cd "$WORKERS_DIR"

    wrangler rollback "$ROLLBACK_ID" --env production || {
        log_error "Rollback failed"
        exit 1
    }

    log_success "Rollback completed"
    send_notification "warning" "Production deployment rolled back to $ROLLBACK_ID"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "test")
        check_prerequisites
        run_tests
        ;;
    "build")
        build_project
        ;;
    "verify")
        verify_deployment
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|test|build|verify}"
        echo "  deploy   - Full deployment pipeline"
        echo "  rollback - Rollback to previous deployment"
        echo "  test     - Run tests only"
        echo "  build    - Build project only"
        echo "  verify   - Verify current deployment"
        exit 1
        ;;
esac
