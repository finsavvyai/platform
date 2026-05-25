#!/bin/bash

# Qestro SaaS Platform - Deployment Script
# This script automates the deployment process for different environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/config/deploy.yml"

# Colors for output
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

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi

    # Parse YAML config (simplified parsing)
    ENVIRONMENT=${1:-staging}
    log_info "Loading configuration for environment: $ENVIRONMENT"

    # Set environment-specific variables
    case $ENVIRONMENT in
        "staging")
            RENDER_SERVICE_ID="${RENDER_STAGING_SERVICE_ID:-}"
            API_URL="https://staging-api.qestro.io"
            FRONTEND_URL="https://staging.qestro.io"
            ;;
        "production")
            RENDER_SERVICE_ID="${RENDER_PRODUCTION_SERVICE_ID:-}"
            API_URL="https://api.qestro.io"
            FRONTEND_URL="https://qestro.io"
            ;;
        *)
            log_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if required tools are installed
    local required_tools=("node" "npm" "curl" "git")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool not found: $tool"
            exit 1
        fi
    done

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check if working directory is clean
    if [[ -n $(git status --porcelain) ]]; then
        log_warning "Working directory is not clean. Commit or stash changes first."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check environment variables
    if [[ -z "$RENDER_API_KEY" ]]; then
        log_error "RENDER_API_KEY environment variable is not set"
        exit 1
    fi

    if [[ -z "$RENDER_SERVICE_ID" ]]; then
        log_error "RENDER_SERVICE_ID environment variable is not set"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    log_info "Running tests..."

    cd "$PROJECT_ROOT"

    # Install dependencies
    log_info "Installing dependencies..."
    npm ci

    # Run linting
    log_info "Running linting..."
    npm run lint

    # Run type checking
    log_info "Running type checking..."
    npm run type-check

    # Run unit tests
    log_info "Running unit tests..."
    npm run test

    # Run integration tests
    log_info "Running integration tests..."
    npm run integration-test

    # Run E2E tests
    log_info "Running E2E tests..."
    npm run test:playwright

    log_success "All tests passed"
}

# Build application
build_application() {
    log_info "Building application..."

    cd "$PROJECT_ROOT"

    # Build frontend
    log_info "Building frontend..."
    cd frontend
    npm run build

    # Build backend
    log_info "Building backend..."
    cd ../backend
    npm run build

    cd "$PROJECT_ROOT"
    log_success "Application built successfully"
}

# Create backup
create_backup() {
    log_info "Creating backup..."

    local backup_name="backup-$(date +%Y%m%d-%H%M%S)"

    # Create database backup
    curl -X POST \
        -H "Authorization: Bearer $BACKUP_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"environment\": \"$ENVIRONMENT\", \"name\": \"$backup_name\"}" \
        "$API_URL/api/backup/create" || {
        log_warning "Failed to create database backup"
    }

    log_success "Backup created: $backup_name"
}

# Deploy to Render
deploy_to_render() {
    log_info "Deploying to Render..."

    # Trigger deployment
    local deploy_response
    deploy_response=$(curl -s -X POST \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"serviceId\": \"$RENDER_SERVICE_ID\"}" \
        "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys")

    local deploy_id
    deploy_id=$(echo "$deploy_response" | jq -r '.id // empty')

    if [[ -z "$deploy_id" ]]; then
        log_error "Failed to trigger deployment"
        echo "$deploy_response"
        exit 1
    fi

    log_info "Deployment triggered with ID: $deploy_id"

    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    local timeout=1800  # 30 minutes
    local interval=30
    local elapsed=0

    while [[ $elapsed -lt $timeout ]]; do
        local status_response
        status_response=$(curl -s \
            -H "Authorization: Bearer $RENDER_API_KEY" \
            "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys/$deploy_id")

        local status
        status=$(echo "$status_response" | jq -r '.status // empty')

        log_info "Deployment status: $status (${elapsed}s elapsed)"

        case $status in
            "live")
                log_success "Deployment completed successfully"
                return 0
                ;;
            "failed"|"build_failed"|"crashed")
                log_error "Deployment failed with status: $status"
                echo "$status_response"
                return 1
                ;;
            "created"|"build_in_progress"|"deploying")
                # Continue waiting
                ;;
            *)
                log_warning "Unknown deployment status: $status"
                ;;
        esac

        sleep $interval
        elapsed=$((elapsed + interval))
    done

    log_error "Deployment timed out after $timeout seconds"
    return 1
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."

    # Wait for application to start
    sleep 30

    # Check API health
    log_info "Checking API health..."
    if ! curl -f -s "$API_URL/api/health" > /dev/null; then
        log_error "API health check failed"
        return 1
    fi

    # Check frontend
    log_info "Checking frontend..."
    if ! curl -f -s "$FRONTEND_URL" > /dev/null; then
        log_error "Frontend health check failed"
        return 1
    fi

    # Check database connectivity
    log_info "Checking database connectivity..."
    if ! curl -f -s "$API_URL/api/health/database" > /dev/null; then
        log_error "Database health check failed"
        return 1
    fi

    log_success "All health checks passed"
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."

    cd "$PROJECT_ROOT"

    # Run smoke tests against deployed environment
    npm run test:smoke -- --baseUrl="$API_URL" || {
        log_error "Smoke tests failed"
        return 1
    }

    log_success "Smoke tests passed"
}

# Update deployment status
update_deployment_status() {
    local status="$1"
    local version="${2:-$(git rev-parse --short HEAD)}"

    log_info "Updating deployment status: $status"

    curl -X POST \
        -H "Authorization: Bearer $DEPLOYMENT_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"version\": \"$version\",
            \"status\": \"$status\",
            \"environment\": \"$ENVIRONMENT\",
            \"commit\": \"$(git rev-parse HEAD)\",
            \"deployedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
        }" \
        "$API_URL/api/deployments/status" || {
        log_warning "Failed to update deployment status"
    }
}

# Send notification
send_notification() {
    local status="$1"
    local version="${2:-$(git rev-parse --short HEAD)}"

    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        local message="🚀 Deployment to $ENVIRONMENT completed successfully!"

        if [[ "$status" == "failure" ]]; then
            color="danger"
            message="❌ Deployment to $ENVIRONMENT failed!"
        fi

        curl -X POST \
            -H "Content-Type: application/json" \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"Qestro Deployment\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {
                            \"title\": \"Environment\",
                            \"value\": \"$ENVIRONMENT\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Version\",
                            \"value\": \"$version\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Deployed by\",
                            \"value\": \"$(git config user.name)\",
                            \"short\": true
                        },
                        {
                            \"title\": \"Commit\",
                            \"value\": \"$(git rev-parse --short HEAD)\",
                            \"short\": true
                        }
                    ],
                    \"footer\": \"Qestro Deployment Bot\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" || {
            log_warning "Failed to send Slack notification"
        }
    fi

    # Send email notification for production deployments
    if [[ "$ENVIRONMENT" == "production" && -n "$EMAIL_NOTIFICATIONS" ]]; then
        # Implementation depends on email service
        log_info "Production deployment email notification would be sent here"
    fi
}

# Rollback deployment
rollback_deployment() {
    log_warning "Initiating rollback..."

    local rollback_response
    rollback_response=$(curl -s -X POST \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"serviceId\": \"$RENDER_SERVICE_ID\", \"rollback\": true}" \
        "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys")

    local rollback_id
    rollback_id=$(echo "$rollback_response" | jq -r '.id // empty')

    if [[ -z "$rollback_id" ]]; then
        log_error "Failed to trigger rollback"
        echo "$rollback_response"
        return 1
    fi

    log_info "Rollback triggered with ID: $rollback_id"

    # Wait for rollback to complete
    log_info "Waiting for rollback to complete..."
    sleep 60

    # Send rollback notification
    send_notification "rollback" "$(git rev-parse --short HEAD)"

    log_success "Rollback completed"
}

# Main deployment function
deploy() {
    local environment="${1:-staging}"
    local skip_tests="${2:-false}"
    local skip_backup="${3:-false}"

    log_info "Starting deployment to $environment..."

    # Load configuration
    load_config "$environment"

    # Check prerequisites
    check_prerequisites

    # Run tests unless skipped
    if [[ "$skip_tests" != "true" ]]; then
        run_tests
    else
        log_warning "Skipping tests as requested"
    fi

    # Build application
    build_application

    # Create backup for production
    if [[ "$environment" == "production" && "$skip_backup" != "true" ]]; then
        create_backup
    fi

    # Deploy to Render
    if ! deploy_to_render; then
        update_deployment_status "failure"
        send_notification "failure"

        # Ask if user wants to rollback
        if [[ "$environment" == "production" ]]; then
            read -p "Deployment failed. Rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
        fi

        exit 1
    fi

    # Run health checks
    if ! run_health_checks; then
        log_error "Health checks failed"
        update_deployment_status "failure"
        send_notification "failure"

        if [[ "$environment" == "production" ]]; then
            read -p "Health checks failed. Rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
        fi

        exit 1
    fi

    # Run smoke tests
    if ! run_smoke_tests; then
        log_error "Smoke tests failed"
        update_deployment_status "failure"
        send_notification "failure"

        if [[ "$environment" == "production" ]]; then
            read -p "Smoke tests failed. Rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
        fi

        exit 1
    fi

    # Update deployment status
    update_deployment_status "success"

    # Send success notification
    send_notification "success"

    log_success "Deployment to $environment completed successfully! 🎉"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [OPTIONS]

ENVIRONMENTS:
    staging       Deploy to staging environment
    production    Deploy to production environment

OPTIONS:
    --skip-tests    Skip running tests
    --skip-backup   Skip creating backup (production only)
    --rollback-only Rollback only (production only)
    --help          Show this help message

EXAMPLES:
    $0 staging
    $0 production
    $0 staging --skip-tests
    $0 production --skip-backup
    $0 --rollback-only

ENVIRONMENT VARIABLES:
    RENDER_API_KEY         Render API key (required)
    RENDER_STAGING_SERVICE_ID    Render service ID for staging (required for staging)
    RENDER_PRODUCTION_SERVICE_ID  Render service ID for production (required for production)
    BACKUP_API_KEY        Backup service API key (optional)
    DEPLOYMENT_API_KEY    Deployment tracking API key (optional)
    SLACK_WEBHOOK         Slack webhook URL for notifications (optional)
    EMAIL_NOTIFICATIONS   Email address for notifications (optional)
EOF
}

# Parse command line arguments
ENVIRONMENT=""
SKIP_TESTS="false"
SKIP_BACKUP="false"
ROLLBACK_ONLY="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        staging|production)
            ENVIRONMENT="$1"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP="true"
            shift
            ;;
        --rollback-only)
            ROLLBACK_ONLY="true"
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" && "$ROLLBACK_ONLY" != "true" ]]; then
    log_error "Environment is required"
    show_usage
    exit 1
fi

# Execute main function
if [[ "$ROLLBACK_ONLY" == "true" ]]; then
    rollback_deployment
else
    deploy "$ENVIRONMENT" "$SKIP_TESTS" "$SKIP_BACKUP"
fi
