#!/bin/bash

# Anomaly Detection System Build and Deploy Script
set -e

# Configuration
REGISTRY="your-registry.com"
PROJECT_NAME="quantumbeam"
NAMESPACE="monitoring"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed or not in PATH"
        exit 1
    fi

    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warning "Namespace $NAMESPACE does not exist, creating it..."
        kubectl create namespace $NAMESPACE
    fi

    log_success "Prerequisites check completed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    # Build statistical anomaly detector
    log_info "Building statistical anomaly detector..."
    docker build -f Dockerfile.statistical -t ${REGISTRY}/${PROJECT_NAME}/statistical-anomaly-detector:latest .
    docker build -f Dockerfile.statistical -t ${REGISTRY}/${PROJECT_NAME}/statistical-anomaly-detector:$(date +%Y%m%d-%H%M%S) .

    # Build ML anomaly detector
    log_info "Building ML anomaly detector..."
    docker build -f Dockerfile.ml -t ${REGISTRY}/${PROJECT_NAME}/ml-anomaly-detector:latest .
    docker build -f Dockerfile.ml -t ${REGISTRY}/${PROJECT_NAME}/ml-anomaly-detector:$(date +%Y%m%d-%H%M%S) .

    log_success "Docker images built successfully"
}

# Push images to registry
push_images() {
    log_info "Pushing Docker images to registry..."

    # Push statistical anomaly detector
    docker push ${REGISTRY}/${PROJECT_NAME}/statistical-anomaly-detector:latest
    docker push ${REGISTRY}/${PROJECT_NAME}/statistical-anomaly-detector:$(date +%Y%m%d-%H%M%S)

    # Push ML anomaly detector
    docker push ${REGISTRY}/${PROJECT_NAME}/ml-anomaly-detector:latest
    docker push ${REGISTRY}/${PROJECT_NAME}/ml-anomaly-detector:$(date +%Y%m%d-%H%M%S)

    log_success "Docker images pushed successfully"
}

# Create secrets
create_secrets() {
    log_info "Creating/updating secrets..."

    # Generate Redis URL
    REDIS_URL="redis://redis.observability.svc.cluster.local:6379/0"
    REDIS_URL_BASE64=$(echo -n $REDIS_URL | base64)

    # Create or update secret
    kubectl create secret generic anomaly-detector-secrets \
        --from-literal=redis_url=$REDIS_URL \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets created/updated successfully"
}

# Deploy the system
deploy_system() {
    log_info "Deploying anomaly detection system..."

    # Apply the deployment configuration
    kubectl apply -f anomaly-detector-service.yaml

    log_success "Deployment configuration applied"
}

# Wait for deployment to be ready
wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."

    # Wait for statistical anomaly detector
    kubectl wait --for=condition=available --timeout=300s deployment/statistical-anomaly-detector -n $NAMESPACE

    # Wait for ML anomaly detector
    kubectl wait --for=condition=available --timeout=300s deployment/ml-anomaly-detector -n $NAMESPACE

    log_success "All deployments are ready"
}

# Run health checks
health_check() {
    log_info "Running health checks..."

    # Check statistical anomaly detector
    STATISTICAL_POD=$(kubectl get pods -n $NAMESPACE -l app=statistical-anomaly-detector -o jsonpath='{.items[0].metadata.name}')
    if kubectl exec -n $NAMESPACE $STATISTICAL_POD -- curl -f http://localhost:8000/health; then
        log_success "Statistical anomaly detector is healthy"
    else
        log_error "Statistical anomaly detector health check failed"
    fi

    # Check ML anomaly detector
    ML_POD=$(kubectl get pods -n $NAMESPACE -l app=ml-anomaly-detector -o jsonpath='{.items[0].metadata.name}')
    if kubectl exec -n $NAMESPACE $ML_POD -- curl -f http://localhost:8000/health; then
        log_success "ML anomaly detector is healthy"
    else
        log_error "ML anomaly detector health check failed"
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment status:"
    echo

    # Show pods
    echo "=== Pods ==="
    kubectl get pods -n $NAMESPACE -l component=anomaly-detection

    echo
    echo "=== Services ==="
    kubectl get services -n $NAMESPACE -l component=anomaly-detection

    echo
    echo "=== HPAs ==="
    kubectl get hpa -n $NAMESPACE -l component=anomaly-detection

    echo
    echo "=== Recent Events ==="
    kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
}

# Cleanup function
cleanup() {
    log_warning "Cleanup function called"
    # Add any cleanup logic here if needed
}

# Main execution
main() {
    log_info "Starting anomaly detection system deployment..."

    # Set up trap for cleanup
    trap cleanup EXIT

    # Execute deployment steps
    check_prerequisites
    build_images
    push_images
    create_secrets
    deploy_system
    wait_for_deployment
    health_check
    show_status

    log_success "Anomaly detection system deployed successfully!"

    echo
    log_info "Next steps:"
    echo "1. Monitor the system using: kubectl get pods -n $NAMESPACE -w"
    echo "2. Check logs: kubectl logs -n $NAMESPACE -l component=anomaly-detection"
    echo "3. Access APIs: kubectl port-forward -n $NAMESPACE svc/statistical-anomaly-detector 8000:8000"
    echo "4. View metrics: http://localhost:8000/metrics"
}

# Handle command line arguments
case "${1:-}" in
    "build-only")
        check_prerequisites
        build_images
        ;;
    "deploy-only")
        check_prerequisites
        create_secrets
        deploy_system
        wait_for_deployment
        ;;
    "status")
        show_status
        ;;
    "health")
        health_check
        ;;
    "cleanup")
        log_info "Cleaning up deployment..."
        kubectl delete -f anomaly-detector-service.yaml --ignore-not-found=true
        kubectl delete secret anomaly-detector-secrets -n $NAMESPACE --ignore-not-found=true
        log_success "Cleanup completed"
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [COMMAND]"
        echo
        echo "Commands:"
        echo "  build-only   - Only build Docker images"
        echo "  deploy-only  - Only deploy existing images"
        echo "  status       - Show deployment status"
        echo "  health       - Run health checks"
        echo "  cleanup      - Remove deployment"
        echo "  help         - Show this help message"
        echo
        echo "If no command is specified, the full build and deploy process will be executed."
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for available commands"
        exit 1
        ;;
esac