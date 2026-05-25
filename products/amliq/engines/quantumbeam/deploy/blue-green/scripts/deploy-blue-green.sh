#!/bin/bash

# QuantumBeam Blue-Green Deployment Script
# This script automates blue-green deployments with traffic switching and validation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-quantumbeam}"
HELM_RELEASE="${HELM_RELEASE:-quantumbeam}"
CONTEXT="${CONTEXT:-$(kubectl config current-context)}"
IMAGE_TAG="${IMAGE_TAG:-$(git describe --tags --always --dirty)}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_VALIDATION="${SKIP_VALIDATION:-false}"
AUTO_PROMOTE="${AUTO_PROMOTE:-false}"
ROLLBACK_TIMEOUT="${ROLLBACK_TIMEOUT:-300}"

# Deployment configuration
BLUE_DEPLOYMENT="quantumbeam-api-blue"
GREEN_DEPLOYMENT="quantumbeam-api-green"
ACTIVE_SERVICE="quantumbeam-api-active"
PREVIEW_SERVICE="quantumbeam-api-preview"
INGRESS_NAME="quantumbeam-api-ingress"

# Health check configuration
HEALTH_CHECK_ENDPOINT="${HEALTH_CHECK_ENDPOINT:-/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-5}"

# Log function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed or not in PATH"
    fi

    # Check helm
    if ! command -v helm &> /dev/null; then
        error "helm is not installed or not in PATH"
    fi

    # Check argocd CLI (optional)
    if ! command -v argocd &> /dev/null; then
        warning "argocd CLI is not installed. Manual ArgoCD sync may be required."
    fi

    # Check context
    if ! kubectl config get-contexts "${CONTEXT}" &> /dev/null; then
        error "Kubernetes context '${CONTEXT}' does not exist"
    fi

    # Check cluster connectivity
    if ! kubectl --context="${CONTEXT}" cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi

    # Check namespace
    if ! kubectl --context="${CONTEXT}" get namespace "${NAMESPACE}" &> /dev/null; then
        error "Namespace '${NAMESPACE}' does not exist"
    fi

    # Check ArgoCD Rollouts
    if ! kubectl --context="${CONTEXT}" get crd rollouts.argoproj.io &> /dev/null; then
        error "ArgoCD Rollouts is not installed in the cluster"
    fi

    success "Prerequisites check completed"
}

# Get current active deployment
get_active_deployment() {
    log "Determining current active deployment..."

    local active_service
    active_service=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${ACTIVE_SERVICE}" \
        -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "")

    if [[ -z "${active_service}" ]]; then
        error "Could not determine active deployment"
    fi

    echo "${active_service}"
    success "Current active deployment: ${active_service}"
}

# Determine which deployment to update
get_target_deployment() {
    local active_deployment
    active_deployment=$(get_active_deployment)

    local target_deployment
    if [[ "${active_deployment}" == "blue" ]]; then
        target_deployment="green"
    else
        target_deployment="blue"
    fi

    echo "${target_deployment}"
    success "Target deployment: ${target_deployment}"
}

# Deploy new version to target environment
deploy_new_version() {
    local target_deployment="$1"
    local image_tag="$2"

    log "Deploying new version to ${target_deployment} environment..."

    # Update the image tag in the deployment
    if [[ "${DRY_RUN}" == "true" ]]; then
        log "[DRY RUN] Would update ${target_deployment} with image tag: ${image_tag}"
    else
        # Update the rollout with new image
        kubectl --context="${CONTEXT}" -n "${NAMESPACE}" patch rollout "${HELM_RELEASE}" \
            --type='merge' \
            -p "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"quantumbeam-api\",\"image\":\"quay.io/quantumbeam/quantumbeam-api:${image_tag}\"}]}}}}"

        # Wait for rollout to complete
        log "Waiting for rollout to complete..."
        kubectl --context="${CONTEXT}" -n "${NAMESPACE}" rollout status "rollout/${HELM_RELEASE}" \
            --timeout="${ROLLBACK_TIMEOUT}s"

        success "Deployment to ${target_deployment} completed"
    fi
}

# Health check function
health_check() {
    local service_name="$1"
    local endpoint="$2"
    local timeout="$3"
    local retries="$4"

    log "Performing health check for ${service_name}..."

    local attempt=1
    while [[ ${attempt} -le ${retries} ]]; do
        log "Health check attempt ${attempt}/${retries} for ${service_name}"

        # Get service URL
        local service_url
        service_url=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${service_name}" \
            -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")

        if [[ -z "${service_url}" ]]; then
            # Try getting the service IP
            service_url=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${service_name}" \
                -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        fi

        if [[ -z "${service_url}" ]]; then
            # Use cluster IP for internal testing
            service_url=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${service_name}" \
                -o jsonpath='{.spec.clusterIP}')
        fi

        if [[ -z "${service_url}" ]]; then
            error "Could not determine service URL for ${service_name}"
        fi

        # Perform health check
        local health_url="http://${service_url}${endpoint}"

        if curl -f -s -m "${timeout}" "${health_url}" > /dev/null 2>&1; then
            success "Health check passed for ${service_name}"
            return 0
        else
            warning "Health check failed for ${service_name} (attempt ${attempt}/${retries})"
            sleep 5
            ((attempt++))
        fi
    done

    error "Health check failed after ${retries} attempts for ${service_name}"
    return 1
}

# Run smoke tests
run_smoke_tests() {
    local service_name="$1"

    log "Running smoke tests against ${service_name}..."

    if [[ "${SKIP_VALIDATION}" == "true" ]]; then
        warning "Skipping smoke tests"
        return 0
    fi

    # Get service URL
    local service_url
    service_url=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${service_name}" \
        -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")

    if [[ -z "${service_url}" ]]; then
        service_url=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${service_name}" \
            -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    fi

    if [[ -z "${service_url}" ]]; then
        service_url=$(kubectl --context="${CONTEXT}" -n "${NAMESPACE}" get service "${service_name}" \
            -o jsonpath='{.spec.clusterIP}')
    fi

    # Basic smoke tests
    local tests_passed=0
    local total_tests=4

    # Test 1: Health endpoint
    log "Testing health endpoint..."
    if curl -f -s "http://${service_url}/health" > /dev/null 2>&1; then
        ((tests_passed++))
        success "Health endpoint test passed"
    else
        error "Health endpoint test failed"
    fi

    # Test 2: Readiness endpoint
    log "Testing readiness endpoint..."
    if curl -f -s "http://${service_url}/ready" > /dev/null 2>&1; then
        ((tests_passed++))
        success "Readiness endpoint test passed"
    else
        error "Readiness endpoint test failed"
    fi

    # Test 3: Metrics endpoint
    log "Testing metrics endpoint..."
    if curl -f -s "http://${service_url}/metrics" > /dev/null 2>&1; then
        ((tests_passed++))
        success "Metrics endpoint test passed"
    else
        error "Metrics endpoint test failed"
    fi

    # Test 4: API endpoint (basic)
    log "Testing API endpoint..."
    if curl -f -s -H "Authorization: Bearer test-token" "http://${service_url}/api/v1/health" > /dev/null 2>&1; then
        ((tests_passed++))
        success "API endpoint test passed"
    else
        error "API endpoint test failed"
    fi

    if [[ ${tests_passed} -eq ${total_tests} ]]; then
        success "All smoke tests passed (${tests_passed}/${total_tests})"
        return 0
    else
        error "Smoke tests failed (${tests_passed}/${total_tests})"
        return 1
    fi
}

# Switch traffic to new deployment
switch_traffic() {
    local target_deployment="$1"

    log "Switching traffic to ${target_deployment} deployment..."

    if [[ "${DRY_RUN}" == "true" ]]; then
        log "[DRY RUN] Would switch traffic to ${target_deployment}"
        return 0
    fi

    # Update active service to point to new deployment
    kubectl --context="${CONTEXT}" -n "${NAMESPACE}" patch service "${ACTIVE_SERVICE}" \
        --type='merge' \
        -p "{\"spec\":{\"selector\":{\"version\":\"${target_deployment}\"}}}"

    # Update preview service to point to old deployment
    local old_deployment
    if [[ "${target_deployment}" == "blue" ]]; then
        old_deployment="green"
    else
        old_deployment="blue"
    fi

    kubectl --context="${CONTEXT}" -n "${NAMESPACE}" patch service "${PREVIEW_SERVICE}" \
        --type='merge' \
        -p "{\"spec\":{\"selector\":{\"version\":\"${old_deployment}\"}}}"

    success "Traffic switched to ${target_deployment} deployment"
}

# Promote new deployment
promote_deployment() {
    log "Promoting new deployment..."

    if [[ "${AUTO_PROMOTE}" == "true" ]]; then
        # Auto-promote the rollout
        kubectl --context="${CONTEXT}" -n "${NAMESPACE}" annotate rollout "${HELM_RELEASE}" \
            rollouts.argoproj.io/phase="Complete" --overwrite

        success "Deployment auto-promoted"
    else
        warning "Auto-promotion disabled. Manual promotion required."
        log "To promote manually, run:"
        echo "kubectl --context=\"${CONTEXT}\" -n \"${NAMESPACE}\" annotate rollout \"${HELM_RELEASE}\" rollouts.argoproj.io/phase=\"Complete\""
    fi
}

# Rollback function
rollback_deployment() {
    log "Rolling back deployment..."

    if [[ "${DRY_RUN}" == "true" ]]; then
        log "[DRY RUN] Would rollback deployment"
        return 0
    fi

    # Rollback the rollout
    kubectl --context="${CONTEXT}" -n "${NAMESPACE}" rollout undo "rollout/${HELM_RELEASE}"

    # Switch traffic back
    local active_deployment
    active_deployment=$(get_active_deployment)
    switch_traffic "${active_deployment}"

    success "Rollback completed"
}

# Generate deployment report
generate_report() {
    local status="$1"
    local target_deployment="$2"
    local image_tag="$3"

    log "Generating deployment report..."

    local report_file="deployment-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "${report_file}" << EOF
{
    "deployment": {
        "status": "${status}",
        "image_tag": "${image_tag}",
        "target_deployment": "${target_deployment}",
        "namespace": "${NAMESPACE}",
        "context": "${CONTEXT}",
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "dry_run": ${DRY_RUN},
        "auto_promote": ${AUTO_PROMOTE}
    },
    "configuration": {
        "health_check_endpoint": "${HEALTH_CHECK_ENDPOINT}",
        "health_check_timeout": ${HEALTH_CHECK_TIMEOUT},
        "health_check_retries": ${HEALTH_CHECK_RETRIES},
        "rollback_timeout": ${ROLLBACK_TIMEOUT}
    },
    "services": {
        "active_service": "${ACTIVE_SERVICE}",
        "preview_service": "${PREVIEW_SERVICE}",
        "helm_release": "${HELM_RELEASE}"
    },
    "cluster": {
        "context": "${CONTEXT}",
        "namespace": "${NAMESPACE}",
        "server": "$(kubectl --context="${CONTEXT}" config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
    }
}
EOF

    success "Deployment report generated: ${report_file}"
}

# Main deployment function
main() {
    log "Starting QuantumBeam blue-green deployment..."
    log "Image tag: ${IMAGE_TAG}"
    log "Namespace: ${NAMESPACE}"
    log "Context: ${CONTEXT}"
    log "Dry run: ${DRY_RUN}"
    log "Auto promote: ${AUTO_PROMOTE}"

    # Check prerequisites
    check_prerequisites

    # Get current active deployment
    local active_deployment
    active_deployment=$(get_active_deployment)

    # Determine target deployment
    local target_deployment
    target_deployment=$(get_target_deployment)

    # Deploy new version
    deploy_new_version "${target_deployment}" "${IMAGE_TAG}"

    # Health check for new deployment
    if ! health_check "${PREVIEW_SERVICE}" "${HEALTH_CHECK_ENDPOINT}" "${HEALTH_CHECK_TIMEOUT}" "${HEALTH_CHECK_RETRIES}"; then
        error "Health check failed for new deployment"
    fi

    # Run smoke tests
    if ! run_smoke_tests "${PREVIEW_SERVICE}"; then
        error "Smoke tests failed for new deployment"
    fi

    # Switch traffic
    switch_traffic "${target_deployment}"

    # Health check after traffic switch
    if ! health_check "${ACTIVE_SERVICE}" "${HEALTH_CHECK_ENDPOINT}" "${HEALTH_CHECK_TIMEOUT}" "${HEALTH_CHECK_RETRIES}"; then
        error "Health check failed after traffic switch"
    fi

    # Run smoke tests on active service
    if ! run_smoke_tests "${ACTIVE_SERVICE}"; then
        warning "Smoke tests failed after traffic switch, considering rollback..."
        if [[ "${AUTO_PROMOTE}" != "true" ]]; then
            read -p "Do you want to rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
                generate_report "rolled_back" "${target_deployment}" "${IMAGE_TAG}"
                exit 1
            fi
        fi
    fi

    # Promote deployment
    promote_deployment

    success "Blue-green deployment completed successfully!"
    generate_report "success" "${target_deployment}" "${IMAGE_TAG}"

    log "Deployment summary:"
    log "  - Previous active deployment: ${active_deployment}"
    log "  - New active deployment: ${target_deployment}"
    log "  - Image tag: ${IMAGE_TAG}"
    log "  - Namespace: ${NAMESPACE}"
}

# Cleanup function
cleanup() {
    log "Cleaning up deployment resources..."
    # Remove any temporary resources if needed
}

# Trap cleanup on exit
trap cleanup EXIT

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --image-tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        --context)
            CONTEXT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --auto-promote)
            AUTO_PROMOTE=true
            shift
            ;;
        --rollback-timeout)
            ROLLBACK_TIMEOUT="$2"
            shift 2
            ;;
        --help|-h)
            cat << EOF
QuantumBeam Blue-Green Deployment Script

Usage: $0 [OPTIONS]

Options:
    --namespace NAMESPACE           Kubernetes namespace (default: quantumbeam)
    --image-tag TAG                 Docker image tag to deploy (default: git describe)
    --context CONTEXT                Kubernetes context (default: current context)
    --dry-run                        Perform dry run without making changes
    --skip-validation                Skip smoke tests and validation
    --auto-promote                   Auto-promote deployment after validation
    --rollback-timeout SECONDS       Timeout for rollback operations (default: 300)
    --help, -h                       Show this help message

Environment Variables:
    NAMESPACE                        Kubernetes namespace
    HELM_RELEASE                    Helm release name
    CONTEXT                          Kubernetes context
    IMAGE_TAG                       Docker image tag
    DRY_RUN                         Enable dry run mode
    SKIP_VALIDATION                Skip validation
    AUTO_PROMOTE                   Enable auto promotion
    ROLLBACK_TIMEOUT                Rollback timeout in seconds
    HEALTH_CHECK_ENDPOINT           Health check endpoint
    HEALTH_CHECK_TIMEOUT            Health check timeout
    HEALTH_CHECK_RETRIES            Health check retries

Examples:
    $0 --image-tag v1.2.0 --namespace production
    $0 --dry-run --skip-validation
    $0 --auto-promote --context prod-cluster

EOF
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@"