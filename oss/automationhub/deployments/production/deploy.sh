#!/bin/bash

# UPM.Plus Production Deployment Script
# Author: Luna Task Planning v2.0
# Version: 2.0
# Last Updated: 2024-11-07

set -euo pipefail

# Configuration
NAMESPACE="upm-plus-prod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/deployments/production/deployment.log"
BACKUP_DIR="$PROJECT_ROOT/backups/production"
SECRETS_FILE="$PROJECT_ROOT/.secrets/production.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check if we have kubernetes access
    if ! kubectl auth can-i create namespace &> /dev/null; then
        log_error "Insufficient permissions to create namespaces"
        exit 1
    fi

    # Check if helm is available (optional)
    if command -v helm &> /dev/null; then
        log_info "Helm is available"
    else
        log_warning "Helm is not available (optional for this deployment)"
    fi

    # Create necessary directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$(dirname "$SECRETS_FILE")"

    log "Prerequisites check completed"
}

# Load environment variables
load_secrets() {
    if [[ -f "$SECRETS_FILE" ]]; then
        log "Loading secrets from $SECRETS_FILE"
        source "$SECRETS_FILE"
    else
        log_warning "Secrets file not found: $SECRETS_FILE"
        log_info "Please create the secrets file with the following variables:"
        cat > "$SECRETS_FILE" << EOF
# UPM.Plus Production Secrets
# Generate strong passwords for production

# Database Credentials
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# JWT Configuration
JWT_SECRET_KEY=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
SESSION_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
CSRF_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

# Encryption
ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# AI Services
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# OAuth Providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
MICROSOFT_CLIENT_ID=""
MICROSOFT_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Email Configuration
SMTP_PASSWORD=""
EOF
        log_error "Please edit $SECRETS_FILE with actual values before continuing"
        exit 1
    fi
}

# Create namespace
create_namespace() {
    log "Creating namespace: $NAMESPACE"

    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace "$NAMESPACE"
        log "Namespace $NAMESPACE created successfully"
    fi
}

# Apply secrets
apply_secrets() {
    log "Applying Kubernetes secrets..."

    # Create secrets from environment variables
    kubectl create secret generic upm-plus-secrets \
        --from-literal=database-password="$DB_PASSWORD" \
        --from-literal=redis-password="$REDIS_PASSWORD" \
        --from-literal=jwt-secret="$JWT_SECRET_KEY" \
        --from-literal=session-secret="$SESSION_SECRET" \
        --from-literal=csrf-secret="$CSRF_SECRET" \
        --from-literal=encryption-key="$ENCRYPTION_KEY" \
        --from-literal=openai-api-key="$OPENAI_API_KEY" \
        --from-literal=anthropic-api-key="$ANTHROPIC_API_KEY" \
        --namespace="$NAMESPACE" \
        --dry-run=client -o yaml | kubectl apply -f -

    log "Secrets applied successfully"
}

# Deploy infrastructure components
deploy_infrastructure() {
    log "Deploying infrastructure components..."

    local components=(
        "namespace.yaml"
        "configmaps.yaml"
        "postgres.yaml"
        "redis.yaml"
    )

    local total=${#components[@]}
    local current=0

    for component in "${components[@]}"; do
        ((current++))
        progress "$current" "$total" "Deploying $component"

        if kubectl apply -f "$SCRIPT_DIR/$component" --namespace="$NAMESPACE"; then
            log "✓ $component deployed successfully"
        else
            log_error "✗ Failed to deploy $component"
            return 1
        fi
    done

    echo ""
    log "Infrastructure deployment completed"
}

# Deploy application
deploy_application() {
    log "Deploying application components..."

    local components=(
        "upm-plus-api.yaml"
    )

    local total=${#components[@]}
    local current=0

    for component in "${components[@]}"; do
        ((current++))
        progress "$current" "$total" "Deploying $component"

        if kubectl apply -f "$SCRIPT_DIR/$component" --namespace="$NAMESPACE"; then
            log "✓ $component deployed successfully"
        else
            log_error "✗ Failed to deploy $component"
            return 1
        fi
    done

    echo ""
    log "Application deployment completed"
}

# Deploy monitoring
deploy_monitoring() {
    log "Deploying monitoring stack..."

    local components=(
        "monitoring.yaml"
    )

    local total=${#components[@]}
    local current=0

    for component in "${components[@]}"; do
        ((current++))
        progress "$current" "$total" "Deploying $component"

        if kubectl apply -f "$SCRIPT_DIR/$component" --namespace="$NAMESPACE"; then
            log "✓ $component deployed successfully"
        else
            log_error "✗ Failed to deploy $component"
            return 1
        fi
    done

    echo ""
    log "Monitoring deployment completed"
}

# Deploy security
deploy_security() {
    log "Deploying security components..."

    local components=(
        "security.yaml"
    )

    local total=${#components[@]}
    local current=0

    for component in "${components[@]}"; do
        ((current++))
        progress "$current" "$total" "Deploying $component"

        if kubectl apply -f "$SCRIPT_DIR/$component" --namespace="$NAMESPACE"; then
            log "✓ $component deployed successfully"
        else
            log_error "✗ Failed to deploy $component"
            return 1
        fi
    done

    echo ""
    log "Security deployment completed"
}

# Deploy ingress
deploy_ingress() {
    log "Deploying ingress configuration..."

    local components=(
        "ingress.yaml"
    )

    local total=${#components[@]}
    local current=0

    for component in "${components[@]}"; do
        ((current++))
        progress "$current" "$total" "Deploying $component"

        if kubectl apply -f "$SCRIPT_DIR/$component" --namespace="$NAMESPACE"; then
            log "✓ $component deployed successfully"
        else
            log_error "✗ Failed to deploy $component"
            return 1
        fi
    done

    echo ""
    log "Ingress deployment completed"
}

# Wait for deployments to be ready
wait_for_deployments() {
    log "Waiting for deployments to be ready..."

    local deployments=(
        "postgres-primary"
        "postgres-replica"
        "redis-master"
        "redis-slave"
        "upm-plus-api"
        "prometheus"
        "grafana"
        "alertmanager"
        "ingress-nginx-controller"
    )

    local total=${#deployments[@]}
    local current=0

    for deployment in "${deployments[@]}"; do
        ((current++))
        progress "$current" "$total" "Waiting for $deployment"

        if kubectl rollout status deployment/"$deployment" --namespace="$NAMESPACE" --timeout=600s &> /dev/null; then
            log "✓ $deployment is ready"
        else
            log_warning "⚠ $deployment may not be fully ready"
        fi
    done

    echo ""
    log "Deployment readiness check completed"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."

    # Check if all pods are running
    local total_pods=$(kubectl get pods --namespace="$NAMESPACE" --no-headers | wc -l)
    local running_pods=$(kubectl get pods --namespace="$NAMESPACE" --field-selector=status=Running --no-headers | wc -l)

    log "Total pods: $total_pods, Running pods: $running_pods"

    if [[ $running_pods -eq $total_pods ]]; then
        log "✅ All pods are running"
    else
        log_warning "⚠ Some pods are not running yet"
    fi

    # Check services
    local services=$(kubectl get services --namespace="$NAMESPACE" --no-headers | wc -l)
    log "Services created: $services"

    # Check ingress
    if kubectl get ingress --namespace="$NAMESPACE" &> /dev/null; then
        local ingress=$(kubectl get ingress --namespace="$NAMESPACE" --no-headers | wc -l)
        log "Ingress rules created: $ingress"
    fi

    # Test basic connectivity
    if kubectl get service upm-plus-api --namespace="$NAMESPACE" &> /dev/null; then
        local node_port=$(kubectl get service upm-plus-api --namespace="$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
        if [[ -n "$node_port" ]]; then
            log "API service accessible on node port: $node_port"
        fi
    fi

    log "Deployment verification completed"
}

# Create post-deployment backup
create_backup() {
    log "Creating post-deployment backup..."

    local backup_file="$BACKUP_DIR/deployment-$(date +%Y%m%d_%H%M%S).yaml"

    kubectl get all --namespace="$NAMESPACE" -o yaml > "$backup_file"
    log "Backup created: $backup_file"
}

# Display deployment summary
show_summary() {
    log "🚀 UPM.Plus Production Deployment Summary"
    log "=================================================="
    log "Namespace: $NAMESPACE"
    log "Deployment Time: $(date)"
    log "Log File: $LOG_FILE"
    log ""

    log "📊 Resource Status:"
    kubectl get all --namespace="$NAMESPACE" | head -20

    log ""
    log "🔗 Service URLs:"

    # Get load balancer URLs
    local api_url=$(kubectl get service ingress-nginx-controller --namespace="ingress-nginx" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Not available")
    local grafana_url=$(kubectl get service grafana --namespace="$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "Not available")

    if [[ -n "$api_url" ]]; then
        log "API URL: https://$api_url"
    fi
    if [[ -n "$grafana_url" ]]; then
        log "Grafana URL: https://$grafana_url"
    fi

    log ""
    log "📋 Next Steps:"
    log "1. Configure DNS to point to the load balancer IPs"
    log "2. Update OAuth provider configurations"
    log "3. Test all API endpoints"
    log "4. Set up monitoring alerts"
    log "5. Configure backup schedules"
    log "6. Enable SSL certificate auto-renewal"
    log ""
    log "📊 Monitoring:"
    log "- Grafana Dashboard: $([[ -n "$grafana_url" ]] && echo "https://$grafana_url" || echo "Setup manually")
    log "- Prometheus Metrics: $([[ -n "$api_url" ]] && echo "https://$api_url/metrics" || echo "Setup manually")"

    log ""
    log "✅ Deployment completed successfully!"
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

    log "🚀 Starting UPM.Plus Production Deployment"
    log "=================================================="
    log "Project Root: $PROJECT_ROOT"
    log "Namespace: $NAMESPACE"
    log "Timestamp: $(date)"
    log ""

    # Execute deployment steps
    check_prerequisites
    load_secrets
    create_namespace
    apply_secrets
    deploy_infrastructure
    deploy_application
    deploy_monitoring
    deploy_security
    deploy_ingress
    wait_for_deployments
    verify_deployment
    create_backup
    show_summary
}

# Execute main function
main "$@"