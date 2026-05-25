#!/bin/bash

# QuantumBeam Deployment Script
# This script handles deployment of the QuantumBeam application to various environments

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_ROOT/config"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Default values
ENVIRONMENT="development"
REGION="us-east-1"
CLUSTER_NAME="quantumbeam-${ENVIRONMENT}"
NAMESPACE="quantumbeam"
DOCKER_REGISTRY="quantumbeam"
VERSION="latest"
DRY_RUN=false
VERBOSE=false
SKIP_TESTS=false
SKIP_BUILD=false
SKIP_MIGRATIONS=false
FORCE_DEPLOY=false
HELM_VALUES_FILE=""
SECRET_FILE=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗ $1${NC}"
}

# Usage information
usage() {
    cat << EOF
QuantumBeam Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENVIRONMENT    Target environment (development, staging, production) [default: development]
    -r, --region REGION              AWS region [default: us-east-1]
    -c, --cluster CLUSTER            Kubernetes cluster name [default: quantumbeam-\${environment}]
    -n, --namespace NAMESPACE        Kubernetes namespace [default: quantumbeam]
    -v, --version VERSION            Application version [default: latest]
    -d, --dry-run                    Perform a dry run without making changes
    -f, --force                      Force deployment without confirmation
    --skip-tests                      Skip running tests before deployment
    --skip-build                      Skip building the application
    --skip-migrations                 Skip running database migrations
    --helm-values FILE               Custom Helm values file
    --secrets FILE                    Secrets file for environment variables
    --verbose                         Enable verbose output
    -h, --help                       Show this help message

EXAMPLES:
    # Deploy to development environment
    $0 -e development

    # Deploy to production with specific version
    $0 -e production -v v1.2.3

    # Dry run deployment to staging
    $0 -e staging --dry-run

    # Deploy with custom Helm values
    $0 -e production --helm-values config/production-values.yaml

    # Force deployment without tests
    $0 -e production --force --skip-tests

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--region)
                REGION="$2"
                shift 2
                ;;
            -c|--cluster)
                CLUSTER_NAME="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE_DEPLOY=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-migrations)
                SKIP_MIGRATIONS=true
                shift
                ;;
            --helm-values)
                HELM_VALUES_FILE="$2"
                shift 2
                ;;
            --secrets)
                SECRET_FILE="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    log "Validating prerequisites..."

    # Check if required tools are installed
    local required_tools=("docker" "kubectl" "helm" "aws" "jq")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done

    # Check if we're in the project root
    if [[ ! -f "$PROJECT_ROOT/go.mod" ]] || [[ ! -f "$PROJECT_ROOT/main.go" ]]; then
        log_error "Script must be run from project root directory"
        exit 1
    fi

    # Check environment validity
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be one of: development, staging, production"
        exit 1
    fi

    # Check if config file exists for the environment
    local config_file="$CONFIG_DIR/config.${ENVIRONMENT}.yaml"
    if [[ ! -f "$config_file" ]]; then
        log_error "Configuration file not found: $config_file"
        exit 1
    fi

    # Check Kubernetes cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check AWS credentials for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if ! aws sts get-caller-identity &> /dev/null; then
            log_error "AWS credentials not configured or invalid"
            exit 1
        fi
    fi

    log_success "Prerequisites validation completed"
}

# Load environment-specific configuration
load_config() {
    log "Loading configuration for environment: $ENVIRONMENT"

    # Load main configuration
    export QUANTUMBEAM_ENVIRONMENT="$ENVIRONMENT"
    export QUANTUMBEAM_REGION="$REGION"
    export QUANTUMBEAM_CLUSTER="$CLUSTER_NAME"
    export QUANTUMBEAM_NAMESPACE="$NAMESPACE"
    export QUANTUMBEAM_VERSION="$VERSION"

    # Load secrets if provided
    if [[ -n "$SECRET_FILE" && -f "$SECRET_FILE" ]]; then
        log "Loading secrets from: $SECRET_FILE"
        set -a
        source "$SECRET_FILE"
        set +a
    fi

    # Export docker registry info
    export DOCKER_REGISTRY="$DOCKER_REGISTRY"
    export DOCKER_TAG="${VERSION:-latest}"
    export DOCKER_IMAGE="${DOCKER_REGISTRY}/quantumbeam:${DOCKER_TAG}"

    log_success "Configuration loaded successfully"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log_warning "Skipping tests as requested"
        return 0
    fi

    log "Running tests..."

    cd "$PROJECT_ROOT"

    # Run unit tests
    log "Running unit tests..."
    if ! go test -v -race -coverprofile=coverage.out ./...; then
        log_error "Unit tests failed"
        exit 1
    fi

    # Run integration tests
    log "Running integration tests..."
    if ! go test -v -tags=integration ./tests/integration/...; then
        log_error "Integration tests failed"
        exit 1
    fi

    # Run security tests
    log "Running security tests..."
    if ! go test -v -tags=security ./tests/security/...; then
        log_error "Security tests failed"
        exit 1
    fi

    log_success "All tests passed"
}

# Build application
build_application() {
    if [[ "$SKIP_BUILD" == true ]]; then
        log_warning "Skipping build as requested"
        return 0
    fi

    log "Building application..."

    cd "$PROJECT_ROOT"

    # Build for multiple architectures
    local platforms=("linux/amd64" "linux/arm64")

    for platform in "${platforms[@]}"; do
        local os_arch=(${platform//\// })
        local os="${os_arch[0]}"
        local arch="${os_arch[1]}"

        log "Building for $os/$arch..."

        GOOS="$os" GOARCH="$arch" CGO_ENABLED=0 go build \
            -ldflags="-w -s -X main.version=$VERSION -X main.environment=$ENVIRONMENT" \
            -o "bin/quantumbeam-$os-$arch" \
            ./cmd/api-server/

        if [[ $? -ne 0 ]]; then
            log_error "Build failed for $os/$arch"
            exit 1
        fi
    done

    log_success "Application built successfully"
}

# Build Docker image
build_docker_image() {
    log "Building Docker image..."

    cd "$PROJECT_ROOT"

    # Create Docker build context
    local build_context="build-context"
    mkdir -p "$build_context"

    # Copy necessary files
    cp bin/quantumbeam-linux-amd64 "$build_context/quantumbeam"
    cp config/config.${ENVIRONMENT}.yaml "$build_context/config.yaml"
    cp Dockerfile "$build_context/"

    # Build Docker image
    docker build \
        --platform linux/amd64 \
        --tag "$DOCKER_IMAGE" \
        --build-arg VERSION="$VERSION" \
        --build-arg ENVIRONMENT="$ENVIRONMENT" \
        "$build_context"

    if [[ $? -ne 0 ]]; then
        log_error "Docker build failed"
        exit 1
    fi

    # Cleanup build context
    rm -rf "$build_context"

    log_success "Docker image built successfully: $DOCKER_IMAGE"
}

# Push Docker image
push_docker_image() {
    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Skipping Docker image push"
        return 0
    fi

    log "Pushing Docker image..."

    docker push "$DOCKER_IMAGE"

    if [[ $? -ne 0 ]]; then
        log_error "Docker push failed"
        exit 1
    fi

    log_success "Docker image pushed successfully"
}

# Prepare Kubernetes namespace
prepare_namespace() {
    log "Preparing Kubernetes namespace: $NAMESPACE"

    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    else
        log "Namespace already exists: $NAMESPACE"
    fi

    # Set default namespace context
    kubectl config set-context --current --namespace="$NAMESPACE"

    # Apply labels and annotations
    kubectl label namespace "$NAMESPACE" \
        environment="$ENVIRONMENT" \
        managed-by="quantumbeam-deploy" \
        --overwrite

    log_success "Namespace prepared successfully"
}

# Apply secrets and configmaps
apply_secrets_and_configmaps() {
    log "Applying secrets and configmaps..."

    # Apply ConfigMaps
    log "Applying ConfigMaps..."
    kubectl apply -f "$CONFIG_DIR/k8s/configmaps/" \
        --recursive \
        --namespace="$NAMESPACE"

    # Apply Secrets
    log "Applying Secrets..."
    kubectl apply -f "$CONFIG_DIR/k8s/secrets/" \
        --recursive \
        --namespace="$NAMESPACE"

    log_success "Secrets and configmaps applied successfully"
}

# Run database migrations
run_migrations() {
    if [[ "$SKIP_MIGRATIONS" == true ]]; then
        log_warning "Skipping migrations as requested"
        return 0
    fi

    log "Running database migrations..."

    # Create migration job
    local migration_job="$CONFIG_DIR/k8s/jobs/migration-job.yaml"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN: Would apply migration job"
        kubectl apply --dry-run=client -f "$migration_job"
        return 0
    fi

    # Apply migration job
    kubectl apply -f "$migration_job"

    # Wait for migration to complete
    log "Waiting for migration job to complete..."
    kubectl wait --for=condition=complete job/migration \
        --namespace="$NAMESPACE" \
        --timeout=300s

    # Check migration job status
    local migration_status=$(kubectl get job migration \
        --namespace="$NAMESPACE" \
        -o jsonpath='{.status.succeeded}')

    if [[ "$migration_status" != "1" ]]; then
        log_error "Migration job failed"
        kubectl logs job/migration --namespace="$NAMESPACE"
        exit 1
    fi

    # Cleanup migration job
    kubectl delete job migration --namespace="$NAMESPACE"

    log_success "Database migrations completed successfully"
}

# Deploy application with Helm
deploy_application() {
    log "Deploying application with Helm..."

    local chart_path="$PROJECT_ROOT/helm/quantumbeam"
    local release_name="quantumbeam"

    # Prepare Helm values
    local helm_values_args=()
    if [[ -n "$HELM_VALUES_FILE" ]]; then
        helm_values_args+=("--values" "$HELM_VALUES_FILE")
    fi

    # Add environment-specific values
    helm_values_args+=("--set" "image.repository=$DOCKER_REGISTRY/quantumbeam")
    helm_values_args+=("--set" "image.tag=$DOCKER_TAG")
    helm_values_args+=("--set" "environment=$ENVIRONMENT")
    helm_values_args+=("--set" "region=$REGION")
    helm_values_args+=("--set" "namespace=$NAMESPACE")

    # Check if release exists
    if helm status "$release_name" --namespace="$NAMESPACE" &> /dev/null; then
        log "Upgrading existing Helm release..."

        if [[ "$DRY_RUN" == true ]]; then
            log_warning "DRY RUN: Would upgrade Helm release"
            helm upgrade "$release_name" "$chart_path" \
                --namespace="$NAMESPACE" \
                --dry-run \
                "${helm_values_args[@]}"
        else
            helm upgrade "$release_name" "$chart_path" \
                --namespace="$NAMESPACE" \
                "${helm_values_args[@]}"
        fi
    else
        log "Installing new Helm release..."

        if [[ "$DRY_RUN" == true ]]; then
            log_warning "DRY RUN: Would install Helm release"
            helm install "$release_name" "$chart_path" \
                --namespace="$NAMESPACE" \
                --dry-run \
                "${helm_values_args[@]}"
        else
            helm install "$release_name" "$chart_path" \
                --namespace="$NAMESPACE" \
                "${helm_values_args[@]}"
        fi
    fi

    if [[ $? -ne 0 ]]; then
        log_error "Helm deployment failed"
        exit 1
    fi

    log_success "Helm deployment completed successfully"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."

    # Wait for deployment to be ready
    log "Waiting for deployment to be ready..."
    kubectl wait --for=condition=available deployment/quantumbeam \
        --namespace="$NAMESPACE" \
        --timeout=600s

    # Check pod status
    log "Checking pod status..."
    local pod_status=$(kubectl get pods \
        --namespace="$NAMESPACE" \
        -l app=quantumbeam \
        -o jsonpath='{.items[0].status.phase}')

    if [[ "$pod_status" != "Running" ]]; then
        log_error "Pod is not running: $pod_status"
        kubectl get pods --namespace="$NAMESPACE"
        kubectl logs --namespace="$NAMESPACE" -l app=quantumbeam
        exit 1
    fi

    # Run health check
    log "Running health check..."
    local service_url=$(kubectl get service quantumbeam \
        --namespace="$NAMESPACE" \
        -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

    if [[ -n "$service_url" ]]; then
        local health_check_url="http://$service_url/health"
        log "Checking health endpoint: $health_check_url"

        # Wait a bit for service to be ready
        sleep 10

        if curl -f -s "$health_check_url" > /dev/null; then
            log_success "Health check passed"
        else
            log_error "Health check failed"
            exit 1
        fi
    else
        log_warning "No external service URL found, skipping external health check"
    fi

    log_success "Deployment verification completed"
}

# Post-deployment tasks
post_deployment() {
    log "Running post-deployment tasks..."

    # Update DNS records if needed
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Updating DNS records..."
        # This would integrate with your DNS provider
        log_warning "DNS update not implemented"
    fi

    # Send deployment notification
    log "Sending deployment notification..."
    # This would integrate with your notification system
    log_warning "Deployment notification not implemented"

    # Cleanup old resources
    log "Cleaning up old resources..."
    # Remove old Docker images, old Helm releases, etc.
    kubectl delete helmreleases --namespace="$NAMESPACE" --selector="app.kubernetes.io/instance!=quantumbeam" || true

    log_success "Post-deployment tasks completed"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."

    local release_name="quantumbeam"

    # Get previous revision
    local previous_revision=$(helm history "$release_name" \
        --namespace="$NAMESPACE" \
        -o json | jq -r '.[-2].revision')

    if [[ -z "$previous_revision" ]]; then
        log_error "No previous revision found for rollback"
        exit 1
    fi

    log "Rolling back to revision: $previous_revision"

    helm rollback "$release_name" "$previous_revision" \
        --namespace="$NAMESPACE"

    if [[ $? -ne 0 ]]; then
        log_error "Rollback failed"
        exit 1
    fi

    log_success "Rollback completed successfully"
}

# Main deployment function
deploy() {
    log "Starting deployment to environment: $ENVIRONMENT"
    log "Version: $VERSION"
    log "Region: $REGION"
    log "Cluster: $CLUSTER_NAME"
    log "Namespace: $NAMESPACE"

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi

    # Confirmation prompt (unless force is set)
    if [[ "$FORCE_DEPLOY" != true && "$DRY_RUN" != true ]]; then
        echo
        read -p "Are you sure you want to deploy to $ENVIRONMENT? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Deployment cancelled"
            exit 0
        fi
    fi

    # Execute deployment steps
    validate_prerequisites
    load_config

    if [[ "$DRY_RUN" != true ]]; then
        run_tests
    fi

    build_application
    build_docker_image
    push_docker_image
    prepare_namespace
    apply_secrets_and_configmaps
    run_migrations
    deploy_application
    verify_deployment
    post_deployment

    log_success "Deployment completed successfully!"
    log "Application is now running in environment: $ENVIRONMENT"
    log "Version: $VERSION"
    log "Namespace: $NAMESPACE"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    # Remove temporary files, cleanup containers, etc.
}

# Trap signals for cleanup
trap cleanup EXIT INT TERM

# Main execution
main() {
    parse_args "$@"

    # Enable verbose mode if requested
    if [[ "$VERBOSE" == true ]]; then
        set -x
    fi

    # Execute deployment
    deploy

    # If script reaches here, deployment was successful
    exit 0
}

# Run main function with all arguments
main "$@"