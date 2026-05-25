#!/bin/bash

# SDLC.ai Kubernetes Deployment Script
# Production deployment with comprehensive validation and rollback

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"
LOG_FILE="$PROJECT_ROOT/logs/k8s-deploy-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="$PROJECT_ROOT/backups"
NAMESPACE="sdlc-platform"

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

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check kubectl version
    local kubectl_version=$(kubectl version --client --short | cut -d'v' -f2)
    log_info "kubectl version: $kubectl_version"

    # Check kubectl context
    local current_context=$(kubectl config current-context)
    log_info "Current context: $current_context"

    # Check cluster access
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster"
        exit 1
    fi

    # Check helm
    if ! command -v helm &> /dev/null; then
        log_error "Helm is not installed"
        exit 1
    fi

    # Check helm version
    local helm_version=$(helm version --short | cut -d'v' -f2)
    log_info "Helm version: $helm_version"

    # Check required tools
    for tool in kustomize yq; do
        if ! command -v $tool &> /dev/null; then
            log_warning "$tool is not installed, some features may not work"
        fi
    done

    log_success "Prerequisites check passed"
}

# Backup current deployment
backup_deployment() {
    log_info "Backing up current deployment..."

    local backup_file="$BACKUP_DIR/k8s-backup-$(date +%Y%m%d-%H%M%S).yaml"

    # Backup all resources in namespace
    kubectl get all,configmaps,secrets,pvc,ingress,netpol -n $NAMESPACE -o yaml > "$backup_file" || {
        log_warning "Failed to backup some resources"
    }

    # Backup CRDs
    kubectl get crds -o yaml >> "$backup_file" || {
        log_warning "Failed to backup CRDs"
    }

    # Save backup info
    echo "BACKUP_FILE=$backup_file" > "$PROJECT_ROOT/.k8s-backup"
    echo "BACKUP_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$PROJECT_ROOT/.k8s-backup"

    log_success "Backup completed: $backup_file"
}

# Validate manifests
validate_manifests() {
    log_info "Validating Kubernetes manifests..."

    cd "$K8S_DIR"

    # Check syntax
    for yaml in $(find . -name "*.yaml" -o -name "*.yml"); do
        if command -v yq &> /dev/null; then
            yq eval '.' "$yaml" > /dev/null || {
                log_error "Invalid YAML in $yaml"
                exit 1
            }
        fi
    done

    # Dry run apply
    kubectl apply --dry-run=client -f namespaces/ || {
        log_error "Namespace manifests validation failed"
        exit 1
    }

    kubectl apply --dry-run=client -f configmaps/ || {
        log_error "ConfigMap manifests validation failed"
        exit 1
    }

    kubectl apply --dry-run=client -f deployments/ || {
        log_error "Deployment manifests validation failed"
        exit 1
    }

    kubectl apply --dry-run=client -f services/ || {
        log_error "Service manifests validation failed"
        exit 1
    }

    kubectl apply --dry-run=client -f ingress/ || {
        log_error "Ingress manifests validation failed"
        exit 1
    }

    kubectl apply --dry-run=client -f storage/ || {
        log_error "Storage manifests validation failed"
        exit 1
    }

    kubectl apply --dry-run=client -f policies/ || {
        log_error "Policy manifests validation failed"
        exit 1
    }

    log_success "Manifest validation passed"
}

# Deploy namespaces
deploy_namespaces() {
    log_info "Deploying namespaces..."

    cd "$K8S_DIR/namespaces"

    kubectl apply -f . || {
        log_error "Failed to deploy namespaces"
        exit 1
    }

    # Wait for namespaces to be created
    for ns in sdlc-platform sdlc-monitoring sdlc-logging sdlc-security sdlc-backup; do
        kubectl wait --for=condition=Ready namespace/$ns --timeout=60s || {
            log_error "Namespace $ns not ready"
            exit 1
        }
    done

    log_success "Namespaces deployed successfully"
}

# Deploy storage
deploy_storage() {
    log_info "Deploying storage resources..."

    cd "$K8S_DIR/storage"

    kubectl apply -f . || {
        log_error "Failed to deploy storage"
        exit 1
    }

    # Wait for storage classes
    kubectl wait --for=condition=Established storageclass/sdlc-platform-gp3 --timeout=60s || {
        log_warning "Storage class sdlc-platform-gp3 not ready"
    }

    log_success "Storage deployed successfully"
}

# Deploy configmaps and secrets
deploy_config() {
    log_info "Deploying configuration..."

    cd "$K8S_DIR/configmaps"
    kubectl apply -f . || {
        log_error "Failed to deploy configmaps"
        exit 1
    }

    if [[ -d "$K8S_DIR/secrets" ]]; then
        cd "$K8S_DIR/secrets"
        kubectl apply -f . || {
            log_error "Failed to deploy secrets"
            exit 1
        }
    fi

    log_success "Configuration deployed successfully"
}

# Deploy policies
deploy_policies() {
    log_info "Deploying security policies..."

    cd "$K8S_DIR/policies"

    kubectl apply -f . || {
        log_error "Failed to deploy policies"
        exit 1
    }

    log_success "Policies deployed successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."

    cd "$K8S_DIR/services"
    kubectl apply -f . || {
        log_error "Failed to deploy services"
        exit 1
    }

    log_success "Services deployed successfully"
}

# Deploy applications
deploy_applications() {
    log_info "Deploying applications..."

    cd "$K8S_DIR/deployments"

    kubectl apply -f . || {
        log_error "Failed to deploy applications"
        exit 1
    }

    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."

    kubectl wait --for=condition=Available deployment/sdlc-platform-api -n $NAMESPACE --timeout=300s || {
        log_error "API deployment not ready"
        exit 1
    }

    kubectl wait --for=condition=Available deployment/sdlc-platform-worker -n $NAMESPACE --timeout=300s || {
        log_error "Worker deployment not ready"
        exit 1
    }

    log_success "Applications deployed successfully"
}

# Deploy ingress
deploy_ingress() {
    log_info "Deploying ingress..."

    cd "$K8S_DIR/ingress"

    kubectl apply -f . || {
        log_error "Failed to deploy ingress"
        exit 1
    }

    log_success "Ingress deployed successfully"
}

# Deploy HPA
deploy_hpa() {
    log_info "Deploying HPA..."

    cd "$K8S_DIR/hpa"

    kubectl apply -f . || {
        log_error "Failed to deploy HPA"
        exit 1
    }

    log_success "HPA deployed successfully"
}

# Run post-deployment verification
verify_deployment() {
    log_info "Running post-deployment verification..."

    # Check all pods are running
    local pending_pods=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running -o jsonpath='{.items[*].metadata.name}')
    if [[ -n "$pending_pods" ]]; then
        log_warning "Some pods are not running: $pending_pods"

        # Wait a bit longer
        sleep 30

        # Check again
        pending_pods=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running -o jsonpath='{.items[*].metadata.name}')
        if [[ -n "$pending_pods" ]]; then
            log_error "Pods still not running after 30 seconds"
            kubectl get pods -n $NAMESPACE -o wide
            exit 1
        fi
    fi

    # Check services
    kubectl get svc -n $NAMESPACE

    # Check ingress
    kubectl get ingress -n $NAMESPACE

    # Check health endpoints
    log_info "Checking health endpoints..."

    local api_url="https://api.sdlc.ai"
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -s -f "$api_url/health" > /dev/null; then
            log_success "Health check passed"
            break
        fi

        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Health check failed after $max_attempts attempts"
            exit 1
        fi

        log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        ((attempt++))
    done

    # Run smoke tests
    if [[ -f "$PROJECT_ROOT/scripts/smoke-tests.sh" ]]; then
        log_info "Running smoke tests..."
        "$PROJECT_ROOT/scripts/smoke-tests.sh" || {
            log_error "Smoke tests failed"
            exit 1
        }
    fi

    log_success "Post-deployment verification completed"
}

# Rollback function
rollback() {
    log_info "Starting rollback..."

    if [[ ! -f "$PROJECT_ROOT/.k8s-backup" ]]; then
        log_error "No backup information found"
        exit 1
    fi

    source "$PROJECT_ROOT/.k8s-backup"

    log_info "Rolling back to backup: $BACKUP_FILE"

    # Delete current deployment
    kubectl delete -f "$K8S_DIR" --ignore-not-found=true || {
        log_warning "Failed to delete some resources"
    }

    # Restore from backup
    kubectl apply -f "$BACKUP_FILE" || {
        log_error "Failed to restore from backup"
        exit 1
    }

    log_success "Rollback completed"
}

# Get status
get_status() {
    log_info "Getting deployment status..."

    echo ""
    echo "=== Namespace Status ==="
    kubectl get namespaces -l app=sdlc-platform

    echo ""
    echo "=== Pod Status ==="
    kubectl get pods -n $NAMESPACE -o wide

    echo ""
    echo "=== Service Status ==="
    kubectl get svc -n $NAMESPACE

    echo ""
    echo "=== Ingress Status ==="
    kubectl get ingress -n $NAMESPACE

    echo ""
    echo "=== HPA Status ==="
    kubectl get hpa -n $NAMESPACE

    echo ""
    echo "=== PVC Status ==="
    kubectl get pvc -n $NAMESPACE

    echo ""
    echo "=== Events ==="
    kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -20
}

# Main deployment function
main() {
    log_info "Starting SDLC.ai Kubernetes deployment..."
    log_info "Namespace: $NAMESPACE"
    log_info "Project: $PROJECT_ROOT"

    # Set trap for cleanup
    trap 'log_error "Deployment interrupted"; exit 1' INT TERM

    # Run deployment pipeline
    check_prerequisites
    backup_deployment
    validate_manifests

    # Deploy in order
    deploy_namespaces
    deploy_storage
    deploy_policies
    deploy_config
    deploy_services
    deploy_applications
    deploy_ingress
    deploy_hpa

    verify_deployment

    # Success
    log_success "Deployment completed successfully!"

    # Show status
    get_status

    log_info "Deployment log saved to: $LOG_FILE"
}

# Parse command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "status")
        get_status
        ;;
    "validate")
        check_prerequisites
        validate_manifests
        ;;
    "backup")
        backup_deployment
        ;;
    "namespace")
        deploy_namespaces
        ;;
    "storage")
        deploy_storage
        ;;
    "config")
        deploy_config
        ;;
    "policies")
        deploy_policies
        ;;
    "services")
        deploy_services
        ;;
    "apps")
        deploy_applications
        ;;
    "ingress")
        deploy_ingress
        ;;
    "hpa")
        deploy_hpa
        ;;
    "verify")
        verify_deployment
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|status|validate|backup|namespace|storage|config|policies|services|apps|ingress|hpa|verify}"
        echo "  deploy     - Full deployment pipeline"
        echo "  rollback   - Rollback to previous deployment"
        echo "  status     - Show deployment status"
        echo "  validate   - Validate manifests"
        echo "  backup     - Backup current deployment"
        echo "  namespace  - Deploy namespaces only"
        echo "  storage    - Deploy storage only"
        echo "  config     - Deploy configmaps and secrets only"
        echo "  policies   - Deploy security policies only"
        echo "  services   - Deploy services only"
        echo "  apps       - Deploy applications only"
        echo "  ingress    - Deploy ingress only"
        echo "  hpa        - Deploy HPA only"
        echo "  verify     - Run post-deployment verification"
        exit 1
        ;;
esac
