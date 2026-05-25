#!/bin/bash

# UPM.Plus AutomationHub Deployment Script
# This script automates the deployment process for different environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"

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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi

    # Check if kubectl is installed (for Kubernetes deployment)
    if command -v kubectl &> /dev/null; then
        log_info "kubectl found: $(kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null)"
    else
        log_warning "kubectl not found - Kubernetes deployment will not be available"
    fi

    # Check environment file
    local env_file="${PROJECT_DIR}/.env.${ENVIRONMENT}"
    if [[ ! -f "$env_file" ]]; then
        log_error "Environment file not found: $env_file"
        log_info "Available environment files:"
        ls -la "${PROJECT_DIR}/.env."* 2>/dev/null || log_warning "No environment files found"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Load environment variables
load_environment() {
    log_info "Loading environment variables for ${ENVIRONMENT}..."

    local env_file="${PROJECT_DIR}/.env.${ENVIRONMENT}"
    if [[ -f "$env_file" ]]; then
        export $(cat "$env_file" | grep -v '^#' | xargs)
        log_success "Environment variables loaded from $env_file"
    else
        log_error "Environment file not found: $env_file"
        exit 1
    fi
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_DIR"

    # Build backend image
    log_info "Building backend image..."
    docker build -t upm-plus-automationhub/backend:${VERSION} .

    # Build frontend image
    log_info "Building frontend image..."
    docker build -f Dockerfile.frontend -t upm-plus-automationhub/frontend:${VERSION} .

    log_success "Docker images built successfully"
}

# Deploy to Docker Compose (staging/development)
deploy_docker_compose() {
    log_info "Deploying to ${ENVIRONMENT} using Docker Compose..."

    cd "$PROJECT_DIR"

    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down --remove-orphans || true

    # Pull latest images (if not just built)
    if [[ "$VERSION" != "local" ]]; then
        log_info "Pulling latest images..."
        docker-compose -f docker-compose.prod.yml pull
    fi

    # Start services
    log_info "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30

    # Check service health
    check_service_health

    log_success "Docker Compose deployment completed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found - cannot deploy to Kubernetes"
        exit 1
    fi

    log_info "Deploying to ${ENVIRONMENT} using Kubernetes..."

    cd "$PROJECT_DIR"

    # Set namespace based on environment
    local namespace="upm-plus-${ENVIRONMENT}"

    # Create namespace if it doesn't exist
    kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

    # Apply secrets
    log_info "Applying secrets..."
    kubectl apply -f deployment/kubernetes/secrets.yaml -n "$namespace"

    # Apply configurations
    log_info "Applying configurations..."
    kubectl apply -f deployment/kubernetes/configmaps.yaml -n "$namespace"

    # Update image tags
    log_info "Updating image tags..."
    sed -i.bak "s|image: upm-plus-automationhub/backend:.*|image: upm-plus-automationhub/backend:${VERSION}|g" deployment/kubernetes/backend.yaml
    sed -i.bak "s|image: upm-plus-automationhub/frontend:.*|image: upm-plus-automationhub/frontend:${VERSION}|g" deployment/kubernetes/frontend.yaml

    # Apply deployments
    log_info "Applying deployments..."
    kubectl apply -f deployment/kubernetes/ -n "$namespace"

    # Wait for rollouts
    log_info "Waiting for rollouts to complete..."
    kubectl rollout status deployment/upm-plus-backend -n "$namespace" --timeout=300s
    kubectl rollout status deployment/upm-plus-frontend -n "$namespace" --timeout=300s
    kubectl rollout status deployment/upm-plus-celery-worker -n "$namespace" --timeout=300s

    # Clean up backup files
    rm -f deployment/kubernetes/*.bak

    # Check service health
    check_service_health_kubernetes "$namespace"

    log_success "Kubernetes deployment completed"
}

# Check service health (Docker Compose)
check_service_health() {
    log_info "Checking service health..."

    local services=("backend" "frontend" "postgres" "redis")
    local unhealthy_services=()

    for service in "${services[@]}"; do
        if docker-compose -f docker-compose.prod.yml ps "$service" | grep -q "Up (healthy)"; then
            log_success "$service is healthy"
        else
            log_warning "$service may not be healthy yet"
            unhealthy_services+=("$service")
        fi
    done

    if [[ ${#unhealthy_services[@]} -gt 0 ]]; then
        log_warning "Some services may need more time to start up"
        log_info "Checking logs for unhealthy services..."
        for service in "${unhealthy_services[@]}"; do
            echo "--- $service logs ---"
            docker-compose -f docker-compose.prod.yml logs --tail=20 "$service"
        done
    fi

    # Test API endpoint
    local api_url="http://localhost:8000"
    if curl -f -s "$api_url/health" > /dev/null; then
        log_success "API health check passed"
    else
        log_warning "API health check failed - service may still be starting"
    fi
}

# Check service health (Kubernetes)
check_service_health_kubernetes() {
    local namespace="$1"

    log_info "Checking Kubernetes service health..."

    # Check pod status
    kubectl get pods -n "$namespace"

    # Check services
    kubectl get services -n "$namespace"

    # Test API endpoint (if LoadBalancer is configured)
    local external_ip=$(kubectl get service upm-plus-backend -n "$namespace" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

    if [[ -n "$external_ip" ]]; then
        local api_url="http://$external_ip:8000"
        if curl -f -s "$api_url/health" > /dev/null; then
            log_success "API health check passed"
        else
            log_warning "API health check failed"
        fi
    else
        log_info "No external IP found - skipping external health check"
    fi
}

# Rollback deployment
rollback() {
    log_info "Rolling back deployment..."

    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_warning "Rolling back production deployment - proceed with caution"
        read -p "Are you sure you want to rollback production? (yes/no): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Rollback cancelled"
            exit 0
        fi
    fi

    cd "$PROJECT_DIR"

    if command -v kubectl &> /dev/null && kubectl get namespace "upm-plus-${ENVIRONMENT}" >/dev/null 2>&1; then
        log_info "Rolling back Kubernetes deployment..."
        kubectl rollout undo deployment/upm-plus-backend -n "upm-plus-${ENVIRONMENT}"
        kubectl rollout undo deployment/upm-plus-frontend -n "upm-plus-${ENVIRONMENT}"
        kubectl rollout undo deployment/upm-plus-celery-worker -n "upm-plus-${ENVIRONMENT}"
    else
        log_info "Rolling back Docker Compose deployment..."
        docker-compose -f docker-compose.prod.yml down
        # TODO: Implement proper rollback logic for Docker Compose
        log_warning "Docker Compose rollback not fully implemented - please restore from backup"
    fi

    log_success "Rollback initiated"
}

# Show usage
usage() {
    echo "Usage: $0 <environment> [version] [command]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging environment"
    echo "  production  Deploy to production environment"
    echo ""
    echo "Versions:"
    echo "  latest      Use latest version (default)"
    echo "  <tag>       Use specific version tag"
    echo "  local       Use locally built images"
    echo ""
    echo "Commands:"
    echo "  deploy      Deploy application (default)"
    echo "  rollback    Rollback to previous version"
    echo ""
    echo "Examples:"
    echo "  $0 staging"
    echo "  $0 production v1.2.3"
    echo "  $0 staging local rollback"
}

# Main execution
main() {
    local command="${3:-deploy}"

    echo "🚀 UPM.Plus AutomationHub Deployment"
    echo "Environment: $ENVIRONMENT"
    echo "Version: $VERSION"
    echo "Command: $command"
    echo "=================================="

    case "$command" in
        "deploy")
            check_prerequisites
            load_environment

            if [[ "$VERSION" == "local" ]]; then
                build_images
            fi

            # Choose deployment method based on environment and available tools
            if command -v kubectl &> /dev/null && [[ -d "${PROJECT_DIR}/deployment/kubernetes" ]]; then
                deploy_kubernetes
            else
                deploy_docker_compose
            fi
            ;;
        "rollback")
            load_environment
            rollback
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac

    echo "=================================="
    log_success "Deployment script completed successfully!"
}

# Run main function with all arguments
main "$@"