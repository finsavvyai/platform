#!/bin/bash

# =============================================================================
# SDLC.ai Platform - Production Deployment Script
# =============================================================================
# Blue-Green Deployment with Zero Downtime
# Features:
# - Blue-Green deployment strategy
# - Automated rollback on failure
# - Comprehensive health checks
# - Traffic switching with immediate rollback capability
# - Real-time monitoring during deployment
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Deployment configuration
readonly PLATFORM_NAME="sdlc-platform"
readonly PRODUCTION_DOMAIN="sdlc.ai"
readonly API_DOMAIN="api.sdlc.ai"
readonly ADMIN_DOMAIN="admin.sdlc.ai"
readonly HEALTH_CHECK_TIMEOUT=300
readonly ROLLBACK_TIMEOUT=30
readonly DEPLOYMENT_TIMEOUT=1800

# Global variables
DEPLOYMENT_ID=""
BLUE_ENV=""
GREEN_ENV=""
CURRENT_ACTIVE=""
PREVIOUS_DEPLOYMENT=""
ROLLBACK_TRIGGERED=false
MONITORING_PID=""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_deployment() {
    echo -e "${PURPLE}[DEPLOY]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_monitoring() {
    echo -e "${CYAN}[MONITOR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Error handling and cleanup
cleanup() {
    local exit_code=$?

    # Kill monitoring process if running
    if [[ -n "$MONITORING_PID" ]]; then
        kill "$MONITORING_PID" 2>/dev/null || true
    fi

    # If deployment failed and rollback wasn't triggered
    if [[ $exit_code -ne 0 && "$ROLLBACK_TRIGGERED" = false ]]; then
        log_error "Deployment failed. Initiating automatic rollback..."
        trigger_rollback "Deployment failure"
    fi

    exit $exit_code
}

# Set trap for error handling
trap cleanup ERR
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    # Check required tools
    local required_tools=("wrangler" "curl" "jq" "dig")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Required tool '$tool' is not installed"
            exit 1
        fi
    done

    # Check Wrangler authentication
    if ! wrangler whoami &> /dev/null; then
        log_error "Wrangler is not authenticated. Please run 'wrangler auth login'"
        exit 1
    fi

    # Verify Cloudflare account access
    local account_id
    account_id=$(wrangler whoami | jq -r '.account.id' 2>/dev/null)
    if [[ -z "$account_id" || "$account_id" = "null" ]]; then
        log_error "Unable to access Cloudflare account. Check permissions."
        exit 1
    fi

    # Check if production environment is properly configured
    if [[ ! -f "wrangler.toml" ]]; then
        log_error "wrangler.toml not found in current directory"
        exit 1
    fi

    # Verify production configuration exists
    if ! grep -q "\[env.production\]" wrangler.toml; then
        log_error "Production environment configuration not found in wrangler.toml"
        exit 1
    fi

    log_success "All prerequisites passed"
}

# Generate unique deployment ID
generate_deployment_id() {
    DEPLOYMENT_ID="deploy-$(date +%Y%m%d-%H%M%S)-$(openssl rand -hex 4)"
    log_deployment "Generated deployment ID: $DEPLOYMENT_ID"
}

# Initialize blue-green environments
initialize_environments() {
    log_deployment "Initializing blue-green deployment environments..."

    # Create blue and green environment names
    BLUE_ENV="${PLATFORM_NAME}-blue"
    GREEN_ENV="${PLATFORM_NAME}-green"

    # Check current active environment by inspecting DNS
    local current_cname
    current_cname=$(dig +short CNAME "$API_DOMAIN" 2>/dev/null | head -n1 || echo "")

    if [[ -n "$current_cname" && "$current_cname" =~ blue ]]; then
        CURRENT_ACTIVE="blue"
        PREVIOUS_DEPLOYMENT="green"
    elif [[ -n "$current_cname" && "$current_cname" =~ green ]]; then
        CURRENT_ACTIVE="green"
        PREVIOUS_DEPLOYMENT="blue"
    else
        # Default to blue if no current deployment
        CURRENT_ACTIVE="blue"
        PREVIOUS_DEPLOYMENT="green"
        log_warning "No active deployment detected, defaulting to blue environment"
    fi

    log_info "Current active environment: $CURRENT_ACTIVE"
    log_info "Target deployment environment: $PREVIOUS_DEPLOYMENT"

    # Export for other functions
    export BLUE_ENV GREEN_ENV CURRENT_ACTIVE PREVIOUS_DEPLOYMENT DEPLOYMENT_ID
}

# Prepare target environment
prepare_environment() {
    local target_env="$1"
    log_deployment "Preparing $target_env environment..."

    # Create temporary wrangler configuration for target environment
    local temp_config="wrangler-${target_env}.toml"
    cp wrangler.toml "$temp_config"

    # Update configuration for target environment
    sed -i.bak "s/name = \"sdlc-platform\"/name = \"$target_env\"/g" "$temp_config"
    sed -i.bak "s/sdlc-platform-production/sdlc-platform-${target_env}/g" "$temp_config"

    # Create environment-specific variables
    cat >> "$temp_config" << EOF

# Blue-Green Deployment Configuration
[env.${target_env}]
name = "${target_env}"
vars = { ENVIRONMENT = "production", DEPLOYMENT_ID = "${DEPLOYMENT_ID}", COLOR = "${target_env}" }
EOF

    log_success "Environment $target_env prepared"
}

# Deploy to target environment
deploy_to_environment() {
    local target_env="$1"
    log_deployment "Deploying application to $target_env environment..."

    # Prepare environment configuration
    prepare_environment "$target_env"

    # Deploy to target environment
    local config_file="wrangler-${target_env}.toml"

    log_info "Building and deploying to $target_env..."
    wrangler deploy --config "$config_file" --env production

    # Verify deployment
    if ! wrangler tail --config "$config_file" --env production --since 1m --format json | jq -e '.message' &>/dev/null; then
        log_warning "Unable to verify deployment logs"
    fi

    # Cleanup temporary config
    rm -f "$config_file" "${config_file}.bak"

    log_success "Deployment to $target_env completed"
}

# Comprehensive health check
health_check() {
    local target_env="$1"
    local worker_url="https://${target_env}.${(wrangler whoami | jq -r '.account.subdomain')}.workers.dev"
    local start_time=$(date +%s)

    log_deployment "Running comprehensive health checks for $target_env..."

    # Wait for initial startup
    log_info "Waiting for worker to initialize..."
    sleep 10

    # Health check endpoints
    local endpoints=(
        "/health"
        "/api/v1/health"
        "/api/v1/status"
        "/metrics"
    )

    local all_healthy=true

    for endpoint in "${endpoints[@]}"; do
        local url="${worker_url}${endpoint}"
        local retries=0
        local max_retries=30

        log_info "Checking $endpoint..."

        while [[ $retries -lt $max_retries ]]; do
            local response
            local status_code

            response=$(curl -s -w "%{http_code}" -m 10 "$url" 2>/dev/null || echo "000")
            status_code="${response: -3}"
            response_body="${response%???}"

            if [[ "$status_code" =~ ^2[0-9][0-9]$ ]]; then
                log_success "✓ $endpoint - Status: $status_code"
                break
            elif [[ "$status_code" = "000" ]]; then
                log_warning "✗ $endpoint - Connection failed (attempt $((retries + 1))/$max_retries)"
            else
                log_warning "✗ $endpoint - Status: $status_code"
            fi

            ((retries++))
            sleep 2
        done

        if [[ $retries -eq $max_retries ]]; then
            log_error "✗ $endpoint - Health check failed after $max_retries attempts"
            all_healthy=false
        fi
    done

    # Check critical functionality
    log_info "Testing critical functionality..."

    # Test authentication endpoint
    local auth_test
    auth_test=$(curl -s -X POST "${worker_url}/api/v1/auth/test" -H "Content-Type: application/json" -d '{"test": true}' 2>/dev/null || echo "")
    if [[ "$auth_test" =~ "success" || "$auth_test" =~ "ok" ]]; then
        log_success "✓ Authentication test passed"
    else
        log_warning "✗ Authentication test failed"
        all_healthy=false
    fi

    # Test database connectivity
    local db_test
    db_test=$(curl -s "${worker_url}/api/v1/health/db" 2>/dev/null || echo "")
    if [[ "$db_test" =~ "healthy" || "$db_test" =~ "connected" ]]; then
        log_success "✓ Database connectivity test passed"
    else
        log_warning "✗ Database connectivity test failed"
        all_healthy=false
    done

    # Calculate total health check time
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [[ "$all_healthy" = true ]]; then
        log_success "All health checks passed for $target_env (${duration}s)"
        return 0
    else
        log_error "Health checks failed for $target_env (${duration}s)"
        return 1
    fi
}

# Start real-time monitoring
start_monitoring() {
    local target_env="$1"
    log_monitoring "Starting real-time monitoring for $target_env..."

    # Start monitoring in background
    (
        while true; do
            # Check error rates
            local error_rate
            error_rate=$(wrangler analytics --since 1m --format json 2>/dev/null | jq -r '.data[0].error_rate // 0' 2>/dev/null || echo "0")

            # Check response times
            local avg_response_time
            avg_response_time=$(wrangler analytics --since 1m --format json 2>/dev/null | jq -r '.data[0].avg_response_time // 0' 2>/dev/null || echo "0")

            # Log metrics
            log_monitoring "Error Rate: ${error_rate}% | Avg Response: ${avg_response_time}ms"

            # Trigger rollback if error rate is too high
            if [[ $(echo "$error_rate > 10" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
                log_error "High error rate detected: ${error_rate}%"
                trigger_rollback "High error rate"
                break
            fi

            sleep 10
        done
    ) &

    MONITORING_PID=$!
}

# Switch traffic to new environment
switch_traffic() {
    local target_env="$1"
    log_deployment "Switching traffic to $target_env environment..."

    # Update DNS records
    local worker_subdomain="${target_env}.$(wrangler whoami | jq -r '.account.subdomain').workers.dev"

    # Update API domain
    log_info "Updating DNS for $API_DOMAIN..."
    wrangler route rule create --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="$target_env" || {
        log_warning "Route rule already exists, updating..."
        wrangler route rule delete --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" || true
        wrangler route rule create --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="$target_env"
    }

    # Update admin domain
    log_info "Updating DNS for $ADMIN_DOMAIN..."
    wrangler route rule create --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="$target_env" || {
        log_warning "Route rule already exists, updating..."
        wrangler route rule delete --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" || true
        wrangler route rule create --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="$target_env"
    }

    # Wait for DNS propagation
    log_info "Waiting for DNS propagation..."
    sleep 30

    # Verify traffic switch
    local verification_url="https://$API_DOMAIN/health"
    local retries=0
    local max_retries=10

    while [[ $retries -lt $max_retries ]]; do
        if curl -f -s "$verification_url" > /dev/null 2>&1; then
            log_success "Traffic successfully switched to $target_env"
            return 0
        fi

        log_warning "Waiting for DNS propagation... (attempt $((retries + 1))/$max_retries)"
        sleep 10
        ((retries++))
    done

    log_error "Traffic switch verification failed"
    return 1
}

# Trigger rollback
trigger_rollback() {
    local reason="$1"
    log_error "Initiating rollback: $reason"

    if [[ "$ROLLBACK_TRIGGERED" = true ]]; then
        log_warning "Rollback already in progress"
        return 1
    fi

    ROLLBACK_TRIGGERED=true

    # Kill monitoring
    if [[ -n "$MONITORING_PID" ]]; then
        kill "$MONITORING_PID" 2>/dev/null || true
    fi

    # Switch back to previous environment
    log_info "Switching traffic back to $CURRENT_ACTIVE environment..."

    # Update DNS to point back to current active
    wrangler route rule delete --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" || true
    wrangler route rule delete --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" || true

    wrangler route rule create --pattern="$API_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="$CURRENT_ACTIVE" || true
    wrangler route rule create --pattern="$ADMIN_DOMAIN/*" --zone-name="$PRODUCTION_DOMAIN" --worker="$CURRENT_ACTIVE" || true

    # Wait for DNS propagation
    sleep 30

    # Verify rollback
    local verification_url="https://$API_DOMAIN/health"
    if curl -f -s "$verification_url" > /dev/null 2>&1; then
        log_success "Rollback completed successfully"
        log_info "Traffic restored to $CURRENT_ACTIVE environment"
    else
        log_error "Rollback verification failed"
    fi

    # Send notifications
    send_notification "rollback" "Deployment $DEPLOYMENT_ID rolled back: $reason"

    exit 1
}

# Send notifications
send_notification() {
    local status="$1"
    local message="$2"

    # Log notification
    log_info "Notification: $message"

    # Send to monitoring system (example with webhook)
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        local payload
        payload=$(jq -n \
            --arg status "$status" \
            --arg message "$message" \
            --arg deployment_id "$DEPLOYMENT_ID" \
            --arg environment "production" \
            '{
                status: $status,
                message: $message,
                deployment_id: $deployment_id,
                environment: $environment,
                timestamp: now
            }')

        curl -s -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "$payload" &>/dev/null || true
    fi
}

# Post-deployment verification
post_deployment_verification() {
    log_deployment "Running post-deployment verification..."

    local verification_url="https://$API_DOMAIN"
    local test_cases=(
        "$verification_url/health"
        "$verification_url/api/v1/status"
        "$verification_url/api/v1/metrics"
    )

    local all_passed=true

    for test_case in "${test_cases[@]}"; do
        if curl -f -s "$test_case" > /dev/null 2>&1; then
            log_success "✓ $test_case"
        else
            log_error "✗ $test_case"
            all_passed=false
        fi
    done

    if [[ "$all_passed" = true ]]; then
        log_success "Post-deployment verification passed"
        send_notification "success" "Deployment $DEPLOYMENT_ID completed successfully"
    else
        log_error "Post-deployment verification failed"
        trigger_rollback "Post-deployment verification failed"
    fi
}

# Deployment summary
deployment_summary() {
    local target_env="$1"
    local deployment_time=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo "══════════════════════════════════════════════════════════════════════════════"
    echo "                    PRODUCTION DEPLOYMENT SUMMARY"
    echo "══════════════════════════════════════════════════════════════════════════════"
    echo "Deployment ID:     $DEPLOYMENT_ID"
    echo "Environment:       $target_env"
    echo "Domain:            $API_DOMAIN"
    echo "Time:              $deployment_time"
    echo "Status:            SUCCESS"
    echo "Previous Version:  $CURRENT_ACTIVE"
    echo "New Version:       $target_env"
    echo "══════════════════════════════════════════════════════════════════════════════"
    echo ""

    # Save deployment record
    local deployment_record="deployments/${DEPLOYMENT_ID}.json"
    mkdir -p deployments
    jq -n \
        --arg deployment_id "$DEPLOYMENT_ID" \
        --arg environment "$target_env" \
        --arg domain "$API_DOMAIN" \
        --arg timestamp "$deployment_time" \
        --arg status "success" \
        --arg previous_version "$CURRENT_ACTIVE" \
        --arg new_version "$target_env" \
        '{
            deployment_id: $deployment_id,
            environment: $environment,
            domain: $domain,
            timestamp: $timestamp,
            status: $status,
            previous_version: $previous_version,
            new_version: $new_version
        }' > "$deployment_record"

    log_success "Deployment record saved to $deployment_record"
}

# Main deployment function
main() {
    log_info "Starting production deployment with blue-green strategy..."

    # Check prerequisites
    check_prerequisites

    # Initialize deployment
    generate_deployment_id
    initialize_environments

    local target_env="$PREVIOUS_DEPLOYMENT"
    log_deployment "Target deployment environment: $target_env"

    # Start deployment process
    log_deployment "Starting deployment process..."

    # Deploy to target environment
    deploy_to_environment "$target_env"

    # Run health checks
    if ! health_check "$target_env"; then
        log_error "Health checks failed for $target_env"
        trigger_rollback "Health check failure"
        exit 1
    fi

    # Start monitoring
    start_monitoring "$target_env"

    # Switch traffic
    if ! switch_traffic "$target_env"; then
        log_error "Traffic switch failed"
        trigger_rollback "Traffic switch failure"
        exit 1
    fi

    # Run post-deployment verification
    sleep 10  # Brief stabilization period
    post_deployment_verification

    # Stop monitoring
    if [[ -n "$MONITORING_PID" ]]; then
        kill "$MONITORING_PID" 2>/dev/null || true
    fi

    # Success
    log_success "Production deployment completed successfully!"
    deployment_summary "$target_env"
}

# Help function
show_help() {
    cat << EOF
SDLC.ai Platform Production Deployment Script

Blue-Green Deployment with Zero Downtime

Usage: $0 [OPTIONS]

Options:
    -h, --help      Show this help message
    -v, --verbose   Enable verbose logging

Features:
    - Blue-Green deployment strategy
    - Zero downtime deployment
    - Automated rollback on failure
    - Comprehensive health checks
    - Real-time monitoring
    - Traffic switching with verification
    - Post-deployment verification
    - Deployment logging and history

Prerequisites:
    - Wrangler CLI installed and authenticated
    - curl, jq, dig commands available
    - Production environment configured
    - Proper DNS permissions for sdlc.ai domain

Examples:
    $0              # Deploy to production with blue-green strategy
    $0 -v           # Deploy with verbose logging

Environment Variables:
    WEBHOOK_URL     Notification webhook URL (optional)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
