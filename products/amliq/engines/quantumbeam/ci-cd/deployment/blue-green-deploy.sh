#!/bin/bash

# QuantumBeam Blue-Green Deployment Script
# Provides zero-downtime deployments with automated rollback capabilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
NAMESPACE="${NAMESPACE:-quantumbeam}"
IMAGE_TAG="${IMAGE_TAG:-$(git describe --tags --dirty 2>/dev/null || echo 'latest')}"
REGISTRY="${REGISTRY:-ghcr.io}"
IMAGE_NAME="${IMAGE_NAME:-quantumbeam/quantumbeam}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
SMOKE_TEST_TIMEOUT="${SMOKE_TEST_TIMEOUT:-300}"
ROLLBACK_TIMEOUT="${ROLLBACK_TIMEOUT:-600}"
TRAFFIC_SWITCH_DELAY="${TRAFFIC_SWITCH_DELAY:-30}"
BLUE_GREEN_DELAY="${BLUE_GREEN_DELAY:-300}"

# Kubernetes configuration
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
CONTEXT="${CONTEXT:-}"
SERVICE_NAME="${SERVICE_NAME:-quantumbeam-service}"
BLUE_DEPLOYMENT="${BLUE_DEPLOYMENT:-quantumbeam-blue}"
GREEN_DEPLOYMENT="${GREEN_DEPLOYMENT:-quantumbeam-green}"
BLUE_SERVICE="${BLUE_SERVICE:-quantumbeam-blue}"
GREEN_SERVICE="${GREEN_SERVICE:-quantumbeam-green}"

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[✓] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[!] $1${NC}"
}

error() {
    echo -e "${RED}[✗] $1${NC}"
    exit 1
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --image-tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            --registry)
                REGISTRY="$2"
                shift 2
                ;;
            --image-name)
                IMAGE_NAME="$2"
                shift 2
                ;;
            --kubeconfig)
                KUBECONFIG="$2"
                shift 2
                ;;
            --context)
                CONTEXT="$2"
                shift 2
                ;;
            --service-name)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --health-check-timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            --smoke-test-timeout)
                SMOKE_TEST_TIMEOUT="$2"
                shift 2
                ;;
            --rollback-timeout)
                ROLLBACK_TIMEOUT="$2"
                shift 2
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --skip-health-check)
                SKIP_HEALTH_CHECK=true
                shift
                ;;
            --skip-smoke-test)
                SKIP_SMOKE_TEST=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error "Unknown argument: $1"
                ;;
        esac
    done

    # Set defaults
    FORCE_DEPLOY="${FORCE_DEPLOY:-false}"
    DRY_RUN="${DRY_RUN:-false}"
    SKIP_HEALTH_CHECK="${SKIP_HEALTH_CHECK:-false}"
    SKIP_SMOKE_TEST="${SKIP_SMOKE_TEST:-false}"
}

# Show help
show_help() {
    cat << EOF
QuantumBeam Blue-Green Deployment Script

USAGE:
    blue-green-deploy.sh [OPTIONS]

OPTIONS:
    --environment ENV           Target environment (default: production)
    --namespace NS             Kubernetes namespace (default: quantumbeam)
    --image-tag TAG            Image tag to deploy (default: git tag or latest)
    --registry REGISTRY        Container registry (default: ghcr.io)
    --image-name NAME          Image name (default: quantumbeam/quantumbeam)
    --kubeconfig PATH          Kubeconfig file path
    --context CONTEXT          Kubernetes context
    --service-name NAME        Main service name (default: quantumbeam-service)
    --health-check-timeout SEC Health check timeout (default: 300)
    --smoke-test-timeout SEC   Smoke test timeout (default: 300)
    --rollback-timeout SEC     Rollback timeout (default: 600)
    --force                    Force deployment bypassing checks
    --dry-run                  Dry run without making changes
    --skip-health-check        Skip health checks
    --skip-smoke-test          Skip smoke tests
    --help, -h                 Show this help message

EXAMPLES:
    # Standard deployment
    blue-green-deploy.sh --environment production --image-tag v1.2.3

    # Force deployment with longer timeouts
    blue-green-deploy.sh --force --health-check-timeout 600

    # Dry run to test deployment plan
    blue-green-deploy.sh --dry-run --image-tag v1.2.3

    # Development environment deployment
    blue-green-deploy.sh --environment staging --image-tag latest
EOF
}

# Check prerequisites
check_prerequisites() {
    log "Checking blue-green deployment prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi

    # Check kubectl connectivity
    if [[ -n "$CONTEXT" ]]; then
        kubectl --context "$CONTEXT" cluster-info &> /dev/null || {
            error "Cannot connect to Kubernetes cluster with context: $CONTEXT"
        }
    else
        kubectl cluster-info &> /dev/null || {
            error "Cannot connect to Kubernetes cluster"
        }
    fi

    # Check if namespace exists
    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    if ! $kubectl_cmd get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
    fi

    # Check if required services exist
    if ! $kubectl_cmd get service "$SERVICE_NAME" -n "$NAMESPACE" &> /dev/null; then
        error "Service $SERVICE_NAME does not exist in namespace $NAMESPACE"
    fi

    # Check if image exists
    local full_image="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    if ! docker manifest inspect "$full_image" &> /dev/null; then
        error "Image not found: $full_image"
    fi

    # Check required environment variables
    local required_vars=("ENVIRONMENT" "NAMESPACE" "IMAGE_TAG")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Environment variable $var is not set"
        fi
    done

    success "Prerequisites verified"
}

# Get current active deployment
get_active_deployment() {
    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Check which deployment is currently serving traffic
    local active_color=$($kubectl_cmd get service "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "")

    if [[ -z "$active_color" ]]; then
        # Fallback: check which deployment has running pods
        local blue_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=blue --no-headers 2>/dev/null | wc -l)
        local green_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=green --no-headers 2>/dev/null | wc -l)

        if [[ "$blue_pods" -gt "$green_pods" ]]; then
            active_color="blue"
        elif [[ "$green_pods" -gt "$blue_pods" ]]; then
            active_color="green"
        else
            active_color="blue" # Default to blue
        fi
    fi

    echo "$active_color"
}

# Get target deployment (the inactive one)
get_target_deployment() {
    local active_color=$(get_active_deployment)
    local target_color="green"

    if [[ "$active_color" == "green" ]]; then
        target_color="blue"
    fi

    echo "$target_color"
}

# Create deployment backup
create_deployment_backup() {
    log "Creating deployment backup..."

    local backup_dir="backups/deployment-$(date -u +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Backup current deployments
    $kubectl_cmd get deployment "$BLUE_DEPLOYMENT" -n "$NAMESPACE" -o yaml > "$backup_dir/blue-deployment.yaml" 2>/dev/null || true
    $kubectl_cmd get deployment "$GREEN_DEPLOYMENT" -n "$NAMESPACE" -o yaml > "$backup_dir/green-deployment.yaml" 2>/dev/null || true

    # Backup services
    $kubectl_cmd get service "$SERVICE_NAME" -n "$NAMESPACE" -o yaml > "$backup_dir/main-service.yaml" 2>/dev/null || true
    $kubectl_cmd get service "$BLUE_SERVICE" -n "$NAMESPACE" -o yaml > "$backup_dir/blue-service.yaml" 2>/dev/null || true
    $kubectl_cmd get service "$GREEN_SERVICE" -n "$NAMESPACE" -o yaml > "$backup_dir/green-service.yaml" 2>/dev/null || true

    # Backup configmaps and secrets
    $kubectl_cmd get configmap -n "$NAMESPACE" -l app=quantumbeam -o yaml > "$backup_dir/configmaps.yaml" 2>/dev/null || true
    $kubectl_cmd get secret -n "$NAMESPACE" -l app=quantumbeam -o yaml > "$backup_dir/secrets.yaml" 2>/dev/null || true

    # Store backup info
    cat > "$backup_dir/backup-info.json" << EOF
{
    "backup": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "image_tag": "$IMAGE_TAG",
        "active_deployment": "$(get_active_deployment)",
        "target_deployment": "$(get_target_deployment)"
    },
    "deployment": {
        "registry": "$REGISTRY",
        "image_name": "$IMAGE_NAME",
        "service_name": "$SERVICE_NAME"
    }
}
EOF

    export DEPLOYMENT_BACKUP_DIR="$backup_dir"
    success "Deployment backup created: $backup_dir"
}

# Deploy new version to target deployment
deploy_to_target() {
    local target_color=$(get_target_deployment)
    local target_deployment="quantumbeam-$target_color"
    local target_service="quantumbeam-$target_color"

    log "Deploying new version to $target_deployment..."

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would deploy to $target_deployment"
        return 0
    fi

    # Create or update target deployment
    cat > deployment-temp.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $target_deployment
  namespace: $NAMESPACE
  labels:
    app: quantumbeam
    color: $target_color
    version: $IMAGE_TAG
spec:
  replicas: 3
  selector:
    matchLabels:
      app: quantumbeam
      color: $target_color
  template:
    metadata:
      labels:
        app: quantumbeam
        color: $target_color
        version: $IMAGE_TAG
    spec:
      containers:
      - name: quantumbeam
        image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: ENVIRONMENT
          value: "$ENVIRONMENT"
        - name: VERSION
          value: "$IMAGE_TAG"
        - name: DEPLOYMENT_COLOR
          value: "$target_color"
        - name: LOG_LEVEL
          value: "info"
        - name: PROMETHEUS_ENABLED
          value: "true"
        - name: PROMETHEUS_PORT
          value: "9090"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
      terminationGracePeriodSeconds: 30
EOF

    # Apply deployment
    $kubectl_cmd apply -f deployment-temp.yaml || {
        error "Failed to create/update deployment $target_deployment"
    }

    # Create or update target service
    cat > service-temp.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $target_service
  namespace: $NAMESPACE
  labels:
    app: quantumbeam
    color: $target_color
spec:
  selector:
    app: quantumbeam
    color: $target_color
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  type: ClusterIP
EOF

    # Apply service
    $kubectl_cmd apply -f service-temp.yaml || {
        error "Failed to create/update service $target_service"
    }

    # Clean up temporary files
    rm -f deployment-temp.yaml service-temp.yaml

    success "Deployment created: $target_deployment"
}

# Wait for deployment to be ready
wait_for_deployment_ready() {
    local target_color=$(get_target_deployment)
    local target_deployment="quantumbeam-$target_color"

    log "Waiting for deployment $target_deployment to be ready..."

    if [[ "$SKIP_HEALTH_CHECK" == "true" ]]; then
        warning "Skipping health checks"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would wait for deployment to be ready"
        return 0
    fi

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Wait for deployment rollout
    local start_time=$(date +%s)
    local timeout=$HEALTH_CHECK_TIMEOUT

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $timeout ]]; then
            error "Health check timeout after ${timeout}s"
        fi

        # Check deployment status
        local status=$($kubectl_cmd rollout status deployment/$target_deployment -n "$NAMESPACE" --timeout=10s 2>&1 || echo "pending")

        if [[ "$status" == *"successfully rolled out"* ]]; then
            success "Deployment $target_deployment is ready"
            return 0
        fi

        # Check pod status
        local ready_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=$target_color --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        local total_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=$target_color --no-headers 2>/dev/null | wc -l)

        log "Pods ready: $ready_pods/$total_pods (elapsed: ${elapsed}s)"

        sleep 10
    done
}

# Run smoke tests on new deployment
run_smoke_tests() {
    local target_color=$(get_target_deployment)
    local target_service="quantumbeam-$target_color"

    log "Running smoke tests on $target_service..."

    if [[ "$SKIP_SMOKE_TEST" == "true" ]]; then
        warning "Skipping smoke tests"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would run smoke tests"
        return 0
    fi

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Get service URL for testing
    local service_ip=$($kubectl_cmd get service "$target_service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

    if [[ -z "$service_ip" ]]; then
        error "Cannot get service IP for $target_service"
    fi

    # Set up port forwarding for testing
    $kubectl_cmd port-forward service/$target_service 8080:80 -n "$NAMESPACE" &
    local port_forward_pid=$!

    # Wait for port forwarding to be ready
    sleep 10

    # Run smoke tests
    local start_time=$(date +%s)
    local timeout=$SMOKE_TEST_TIMEOUT

    log "Starting smoke tests (timeout: ${timeout}s)..."

    # Test 1: Health check endpoint
    log "Testing health check endpoint..."
    local health_check_start=$(date +%s)
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $timeout ]]; then
            kill $port_forward_pid 2>/dev/null || true
            error "Smoke test timeout after ${timeout}s"
        fi

        if curl -f -s http://localhost:8080/health >/dev/null 2>&1; then
            success "Health check endpoint responding"
            break
        fi

        sleep 5
    done

    # Test 2: Readiness endpoint
    log "Testing readiness endpoint..."
    if curl -f -s http://localhost:8080/ready >/dev/null 2>&1; then
        success "Readiness endpoint responding"
    else
        kill $port_forward_pid 2>/dev/null || true
        error "Readiness endpoint not responding"
    fi

    # Test 3: Basic API functionality
    log "Testing basic API functionality..."
    if curl -f -s http://localhost:8080/api/v1/status >/dev/null 2>&1; then
        success "Basic API functionality working"
    else
        kill $port_forward_pid 2>/dev/null || true
        error "Basic API functionality not working"
    fi

    # Test 4: Metrics endpoint
    log "Testing metrics endpoint..."
    if curl -f -s http://localhost:9090/metrics >/dev/null 2>&1; then
        success "Metrics endpoint responding"
    else
        warning "Metrics endpoint not responding (may be expected)"
    fi

    # Clean up port forwarding
    kill $port_forward_pid 2>/dev/null || true

    success "Smoke tests completed successfully"
}

# Switch traffic to new deployment
switch_traffic() {
    local target_color=$(get_target_deployment)
    local active_color=$(get_active_deployment)

    log "Switching traffic from $active_color to $target_color..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would switch traffic from $active_color to $target_color"
        return 0
    fi

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Update main service selector to point to target deployment
    $kubectl_cmd patch service "$SERVICE_NAME" -n "$NAMESPACE" -p '{"spec":{"selector":{"color":"'$target_color'"}}}' || {
        error "Failed to switch traffic to $target_color"
    }

    log "Waiting for traffic switch to propagate..."
    sleep "$TRAFFIC_SWITCH_DELAY"

    # Verify traffic switch
    log "Verifying traffic switch..."
    local current_color=$($kubectl_cmd get service "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "")

    if [[ "$current_color" == "$target_color" ]]; then
        success "Traffic successfully switched to $target_color"
    else
        error "Traffic switch verification failed"
    fi
}

# Wait for stability after traffic switch
wait_for_stability() {
    log "Waiting for deployment stability after traffic switch..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would wait for stability"
        return 0
    fi

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    local target_color=$(get_target_deployment)
    local target_deployment="quantumbeam-$target_color"

    # Wait for specified delay
    log "Stability check period: ${BLUE_GREEN_DELAY}s"
    sleep "$BLUE_GREEN_DELAY"

    # Check deployment health
    local status=$($kubectl_cmd rollout status deployment/$target_deployment -n "$NAMESPACE" --timeout=30s 2>&1 || echo "failed")

    if [[ "$status" == *"successfully rolled out"* ]]; then
        success "Deployment stability confirmed"
    else
        warning "Deployment stability check failed, considering rollback"
        return 1
    fi

    # Check pod health
    local ready_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=$target_color --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
    local total_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=$target_color --no-headers 2>/dev/null | wc -l)

    if [[ "$ready_pods" -eq "$total_pods" ]] && [[ "$total_pods" -gt 0 ]]; then
        success "All pods are healthy: $ready_pods/$total_pods"
    else
        warning "Not all pods are healthy: $ready_pods/$total_pods"
        return 1
    fi
}

# Scale down old deployment
scale_down_old_deployment() {
    local old_color=$(get_active_deployment)
    local old_deployment="quantumbeam-$old_color"
    local new_color=$(get_target_deployment)

    log "Scaling down old deployment: $old_deployment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would scale down $old_deployment"
        return 0
    fi

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Scale down old deployment to 0 replicas
    $kubectl_cmd scale deployment "$old_deployment" --replicas=0 -n "$NAMESPACE" || {
        warning "Failed to scale down old deployment $old_deployment"
    }

    # Wait for scaling to complete
    $kubectl_cmd rollout status deployment/$old_deployment -n "$NAMESPACE" --timeout=60s || {
        warning "Timeout waiting for old deployment to scale down"
    }

    success "Old deployment scaled down: $old_deployment"

    # Log final status
    log "Deployment completed successfully!"
    log "  New active deployment: $new_color"
    log "  Image version: $IMAGE_TAG"
    log "  Environment: $ENVIRONMENT"
}

# Rollback to previous deployment
rollback_deployment() {
    log "Initiating rollback to previous deployment..."

    if [[ -z "${DEPLOYMENT_BACKUP_DIR:-}" ]]; then
        error "No backup directory found for rollback"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would rollback to previous deployment"
        return 0
    fi

    local kubectl_cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        kubectl_cmd="kubectl --context $CONTEXT"
    fi

    # Read backup info
    local backup_info_file="$DEPLOYMENT_BACKUP_DIR/backup-info.json"
    if [[ ! -f "$backup_info_file" ]]; then
        error "Backup info file not found: $backup_info_file"
    fi

    local previous_active=$(jq -r '.backup.active_deployment' "$backup_info_file")
    local previous_deployment="quantumbeam-$previous_active"

    log "Rolling back to deployment: $previous_deployment"

    # Switch traffic back to previous deployment
    $kubectl_cmd patch service "$SERVICE_NAME" -n "$NAMESPACE" -p '{"spec":{"selector":{"color":"'$previous_active'"}}}' || {
        error "Failed to switch traffic back to $previous_deployment"
    }

    # Scale up previous deployment if needed
    $kubectl_cmd scale deployment "$previous_deployment" --replicas=3 -n "$NAMESPACE" || {
        warning "Failed to scale up previous deployment $previous_deployment"
    }

    # Wait for rollback to complete
    local start_time=$(date +%s)
    local timeout=$ROLLBACK_TIMEOUT

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $timeout ]]; then
            error "Rollback timeout after ${timeout}s"
        fi

        local status=$($kubectl_cmd rollout status deployment/$previous_deployment -n "$NAMESPACE" --timeout=10s 2>&1 || echo "pending")

        if [[ "$status" == *"successfully rolled out"* ]]; then
            success "Rollback completed successfully"
            break
        fi

        log "Rollback in progress... (elapsed: ${elapsed}s)"
        sleep 10
    done

    # Scale down new deployment
    local new_color=$(get_target_deployment)
    local new_deployment="quantumbeam-$new_color"

    $kubectl_cmd scale deployment "$new_deployment" --replicas=0 -n "$NAMESPACE" || {
        warning "Failed to scale down new deployment $new_deployment"
    }

    success "Rollback completed: $previous_deployment is now active"
}

# Generate deployment report
generate_deployment_report() {
    log "Generating deployment report..."

    local report_file="deployment-report-$(date -u +%Y%m%d-%H%M%S).json"
    local target_color=$(get_target_deployment)
    local active_color=$(get_active_deployment)

    cat > "$report_file" << EOF
{
    "deployment": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "image_tag": "$IMAGE_TAG",
        "registry": "$REGISTRY",
        "image_name": "$IMAGE_NAME",
        "service_name": "$SERVICE_NAME",
        "dry_run": $DRY_RUN,
        "force_deploy": $FORCE_DEPLOY
    },
    "blue_green": {
        "active_deployment_before": "$active_color",
        "target_deployment": "$target_color",
        "active_deployment_after": "$target_color",
        "health_check_timeout": $HEALTH_CHECK_TIMEOUT,
        "smoke_test_timeout": $SMOKE_TEST_TIMEOUT,
        "traffic_switch_delay": $TRAFFIC_SWITCH_DELAY,
        "stability_delay": $BLUE_GREEN_DELAY
    },
    "configuration": {
        "skip_health_check": $SKIP_HEALTH_CHECK,
        "skip_smoke_test": $SKIP_SMOKE_TEST,
        "kubectl_context": "${CONTEXT:-default}",
        "backup_directory": "${DEPLOYMENT_BACKUP_DIR:-}"
    },
    "results": {
        "deployment_successful": true,
        "health_checks_passed": $([[ "$SKIP_HEALTH_CHECK" != "true" ]] && echo "true" || echo "null"),
        "smoke_tests_passed": $([[ "$SKIP_SMOKE_TEST" != "true" ]] && echo "true" || echo "null"),
        "traffic_switch_successful": true,
        "rollback_initiated": false
    }
}
EOF

    success "Deployment report generated: $report_file"
}

# Main deployment process
main() {
    log "Starting QuantumBeam blue-green deployment..."
    echo
    echo "🚀 Deployment Configuration:"
    echo "   Environment: $ENVIRONMENT"
    echo "   Namespace: $NAMESPACE"
    echo "   Image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    echo "   Service: $SERVICE_NAME"
    echo "   Dry Run: $DRY_RUN"
    echo "   Force Deploy: $FORCE_DEPLOY"
    echo

    # Parse command line arguments
    parse_args "$@"

    # Run deployment steps
    check_prerequisites

    local active_color=$(get_active_deployment)
    local target_color=$(get_target_deployment)

    log "Current active deployment: $active_color"
    log "Target deployment: $target_color"

    create_deployment_backup
    deploy_to_target
    wait_for_deployment_ready
    run_smoke_tests

    # Switch traffic and check stability
    if switch_traffic; then
        if wait_for_stability; then
            scale_down_old_deployment
            generate_deployment_report

            echo
            echo "🎉 Blue-Green Deployment Completed Successfully!"
            echo
            echo "📊 Deployment Summary:"
            echo "   Previous Active: $active_color"
            echo "   New Active: $target_color"
            echo "   Image Version: $IMAGE_TAG"
            echo "   Environment: $ENVIRONMENT"
            echo "   Health Checks: $([[ "$SKIP_HEALTH_CHECK" == "true" ]] && echo "Skipped" || echo "✓ Passed")"
            echo "   Smoke Tests: $([[ "$SKIP_SMOKE_TEST" == "true" ]] && echo "Skipped" || echo "✓ Passed")"
            echo
        else
            warning "Stability check failed, initiating rollback..."
            rollback_deployment
            exit 1
        fi
    else
        error "Traffic switch failed, initiating rollback..."
        rollback_deployment
        exit 1
    fi
}

# Handle interruption
trap 'log "Deployment interrupted, initiating rollback..."; rollback_deployment; exit 1' INT TERM

# Execute main function
main "$@"