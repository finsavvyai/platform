#!/bin/bash

# QuantumBeam Blue-Green Deployment Script
# This script implements zero-downtime blue-green deployment strategy

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-quantumbeam-production}"
CONTEXT="${CONTEXT:-production-context}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
SERVICE_NAME="quantumbeam-api-service"
BLUE_DEPLOYMENT="quantumbeam-api-deployment-blue"
GREEN_DEPLOYMENT="quantumbeam-api-deployment-green"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-https://quantumbeam.io/api/v1/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
SWITCH_TIMEOUT="${SWITCH_TIMEOUT:-60}"
ROLLBACK_TIMEOUT="${ROLLBACK_TIMEOUT:-120}"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
        exit 1
    fi

    # Check helm
    if ! command -v helm &> /dev/null; then
        error "helm is not installed"
        exit 1
    fi

    # Check curl
    if ! command -v curl &> /dev/null; then
        error "curl is not installed"
        exit 1
    fi

    # Check kubectl context
    current_context=$(kubectl config current-context)
    if [[ "$current_context" != "$CONTEXT" ]]; then
        error "Wrong kubectl context. Current: $current_context, Expected: $CONTEXT"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
        exit 1
    fi

    success "Prerequisites check passed"
}

# Get current active color
get_active_color() {
    local selector=$(kubectl get service "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "")

    if [[ "$selector" == "blue" ]]; then
        echo "blue"
    elif [[ "$selector" == "green" ]]; then
        echo "green"
    else
        echo "unknown"
    fi
}

# Get next color to deploy
get_next_color() {
    local active_color=$(get_active_color)

    if [[ "$active_color" == "blue" ]]; then
        echo "green"
    elif [[ "$active_color" == "green" ]]; then
        echo "blue"
    else
        echo "blue"  # Default to blue for first deployment
    fi
}

# Deploy to specified color
deploy_to_color() {
    local color=$1
    local deployment_name="quantumbeam-api-deployment-$color"

    log "Deploying to $color environment..."

    # Deploy using Helm
    helm upgrade --install "quantumbeam-$color" ./deployment/helm \
        --namespace "$NAMESPACE" \
        --set image.tag="$IMAGE_TAG" \
        --set environment=production \
        --set deployment.strategy=blue-green \
        --set deployment.color="$color" \
        --set deployment.enabled=true \
        --values ./deployment/helm/values-production.yaml \
        --wait \
        --timeout=10m

    success "Deployment to $color completed"
}

# Wait for deployment to be ready
wait_for_deployment() {
    local color=$1
    local deployment_name="quantumbeam-api-deployment-$color"

    log "Waiting for $color deployment to be ready..."

    # Wait for rollout to complete
    kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout=600s

    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=quantumbeam-api,color="$color" -n "$NAMESPACE" --timeout=300s

    # Get service URL for health check
    local service_url
    if [[ "$color" == "blue" ]]; then
        service_url="https://blue.quantumbeam.io/api/v1/health"
    else
        service_url="https://green.quantumbeam.io/api/v1/health"
    fi

    # Wait for health check
    log "Performing health check on $color deployment..."
    local start_time=$(date +%s)

    while true; do
        if curl -f -s "$service_url" > /dev/null 2>&1; then
            success "$color deployment is healthy"
            break
        fi

        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $HEALTH_CHECK_TIMEOUT ]]; then
            error "Health check timeout for $color deployment"
            return 1
        fi

        log "Waiting for $color deployment to become healthy... ($elapsed/${HEALTH_CHECK_TIMEOUT}s)"
        sleep 10
    done
}

# Run smoke tests
run_smoke_tests() {
    local color=$1
    local service_url

    if [[ "$color" == "blue" ]]; then
        service_url="https://blue.quantumbeam.io"
    else
        service_url="https://green.quantumbeam.io"
    fi

    log "Running smoke tests on $color deployment..."

    # Test basic health endpoint
    if ! curl -f -s "$service_url/api/v1/health" > /dev/null; then
        error "Health endpoint test failed"
        return 1
    fi

    # Test metrics endpoint
    if ! curl -f -s "$service_url/metrics" > /dev/null; then
        error "Metrics endpoint test failed"
        return 1
    fi

    # Test API functionality (simple fraud detection)
    test_transaction='{
        "transaction_id": "test-smoke-001",
        "amount": 100.00,
        "currency": "USD",
        "merchant_id": "test-merchant",
        "card_number": "4111111111111111",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }'

    response=$(curl -s -X POST "$service_url/api/v1/analyze" \
        -H "Content-Type: application/json" \
        -d "$test_transaction")

    if [[ $? -ne 0 ]] || [[ "$response" == *"error"* ]]; then
        error "API functionality test failed"
        return 1
    fi

    success "Smoke tests passed for $color deployment"
}

# Switch traffic to new deployment
switch_traffic() {
    local color=$1

    log "Switching traffic to $color deployment..."

    # Update service selector to point to new deployment
    kubectl patch service "$SERVICE_NAME" -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"version\":\"$color\"}}}"

    # Wait for traffic switch
    sleep 10

    # Verify traffic switch
    log "Verifying traffic switch..."
    local start_time=$(date +%s)

    while true; do
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            success "Traffic successfully switched to $color deployment"
            break
        fi

        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $SWITCH_TIMEOUT ]]; then
            error "Traffic switch verification timeout"
            return 1
        fi

        log "Waiting for traffic switch to take effect... ($elapsed/${SWITCH_TIMEOUT}s)"
        sleep 5
    done
}

# Scale down old deployment
scale_down_old_deployment() {
    local old_color=$1
    local old_deployment="quantumbeam-api-deployment-$old_color"

    log "Scaling down old $old_color deployment..."

    # Scale down to 0 replicas
    kubectl scale deployment "$old_deployment" -n "$NAMESPACE" --replicas=0

    # Wait for scaling to complete
    kubectl rollout status deployment/"$old_deployment" -n "$NAMESPACE" --timeout=120s

    success "Old $old_color deployment scaled down"
}

# Rollback deployment
rollback() {
    local failed_color=$1
    local active_color=$(get_active_color)

    log "Rolling back deployment from $failed_color to $active_color..."

    # Switch traffic back to active color
    kubectl patch service "$SERVICE_NAME" -n "$NAMESPACE" -p "{\"spec\":{\"selector\":{\"version\":\"$active_color\"}}}"

    # Wait for rollback to take effect
    sleep 10

    # Verify rollback
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        success "Rollback completed successfully"
    else
        error "Rollback verification failed"
        return 1
    fi

    # Scale down failed deployment
    scale_down_old_deployment "$failed_color"
}

# Cleanup old resources
cleanup() {
    log "Cleaning up old resources..."

    # Remove old helm releases that are no longer needed
    local releases=$(helm list -n "$NAMESPACE" -q | grep -E "quantumbeam-(blue|green)" || true)

    for release in $releases; do
        local deployment_color=$(echo "$release" | sed 's/quantumbeam-//')
        local active_color=$(get_active_color)

        if [[ "$deployment_color" != "$active_color" ]]; then
            log "Removing old helm release: $release"
            helm uninstall "$release" -n "$NAMESPACE" || true
        fi
    done

    success "Cleanup completed"
}

# Generate deployment report
generate_report() {
    local active_color=$1
    local deployment_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    log "Generating deployment report..."

    cat > "deployment-report-${deployment_time}.json" << EOF
{
    "deployment": {
        "active_color": "$active_color",
        "image_tag": "$IMAGE_TAG",
        "deployment_time": "$deployment_time",
        "namespace": "$NAMESPACE",
        "service_name": "$SERVICE_NAME"
    },
    "status": {
        "health_check": "passed",
        "smoke_tests": "passed",
        "traffic_switch": "passed"
    },
    "pods": {
        "total": $(kubectl get pods -n "$NAMESPACE" -l app=quantumbeam-api --no-headers | wc -l),
        "ready": $(kubectl get pods -n "$NAMESPACE" -l app=quantumbeam-api --no-headers | grep "Running" | wc -l)
    }
}
EOF

    success "Deployment report generated: deployment-report-${deployment_time}.json"
}

# Main deployment function
deploy() {
    local active_color=$(get_active_color)
    local next_color=$(get_next_color)

    log "Starting blue-green deployment..."
    log "Active color: $active_color"
    log "Next color: $next_color"
    log "Image tag: $IMAGE_TAG"

    # Deploy to new color
    if ! deploy_to_color "$next_color"; then
        error "Deployment to $next_color failed"
        exit 1
    fi

    # Wait for deployment to be ready
    if ! wait_for_deployment "$next_color"; then
        error "Deployment readiness check failed for $next_color"
        rollback "$next_color"
        exit 1
    fi

    # Run smoke tests
    if ! run_smoke_tests "$next_color"; then
        error "Smoke tests failed for $next_color"
        rollback "$next_color"
        exit 1
    fi

    # Switch traffic
    if ! switch_traffic "$next_color"; then
        error "Traffic switch failed"
        rollback "$next_color"
        exit 1
    fi

    # Scale down old deployment
    if [[ "$active_color" != "unknown" ]]; then
        scale_down_old_deployment "$active_color"
    fi

    # Generate report
    generate_report "$next_color"

    # Cleanup
    cleanup

    success "Blue-green deployment completed successfully!"
    log "Active deployment is now: $next_color"
}

# Display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --tag TAG           Image tag to deploy (default: latest)"
    echo "  -n, --namespace NAMESPACE Kubernetes namespace (default: quantumbeam-production)"
    echo "  -c, --context CONTEXT     kubectl context (default: production-context)"
    echo "  -h, --health-url URL      Health check URL"
    echo "  --rollback                Rollback to previous deployment"
    echo "  --status                 Show current deployment status"
    echo "  --help                   Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  IMAGE_TAG                Image tag to deploy"
    echo "  NAMESPACE                Kubernetes namespace"
    echo "  CONTEXT                  kubectl context"
    echo "  HEALTH_CHECK_URL        Health check URL"
}

# Show current status
show_status() {
    local active_color=$(get_active_color)
    local active_deployment="quantumbeam-api-deployment-$active_color"

    echo "=== Deployment Status ==="
    echo "Active Color: $active_color"
    echo "Active Deployment: $active_deployment"
    echo "Namespace: $NAMESPACE"
    echo ""

    if [[ "$active_color" != "unknown" ]]; then
        echo "=== Active Deployment Pods ==="
        kubectl get pods -n "$NAMESPACE" -l app=quantumbeam-api,color="$active_color"
        echo ""

        echo "=== Service Status ==="
        kubectl get service "$SERVICE_NAME" -n "$NAMESPACE"
        echo ""

        echo "=== Health Check ==="
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            echo "✓ Health check passed"
        else
            echo "✗ Health check failed"
        fi
    fi
}

# Main script execution
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -c|--context)
                CONTEXT="$2"
                shift 2
                ;;
            -h|--health-url)
                HEALTH_CHECK_URL="$2"
                shift 2
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            --status)
                SHOW_STATUS=true
                shift
                ;;
            --help)
                usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Handle rollback
    if [[ "${ROLLBACK:-false}" == "true" ]]; then
        local active_color=$(get_active_color)
        if [[ "$active_color" == "unknown" ]]; then
            error "Cannot determine active deployment for rollback"
            exit 1
        fi

        local old_color="blue"
        if [[ "$active_color" == "blue" ]]; then
            old_color="green"
        fi

        log "Performing rollback from $active_color to $old_color..."
        rollback "$active_color"
        exit 0
    fi

    # Handle status
    if [[ "${SHOW_STATUS:-false}" == "true" ]]; then
        show_status
        exit 0
    fi

    # Run deployment
    check_prerequisites
    deploy
}

# Trap for cleanup on exit
trap 'log "Deployment script interrupted"; exit 1' INT TERM

# Run main function
main "$@"