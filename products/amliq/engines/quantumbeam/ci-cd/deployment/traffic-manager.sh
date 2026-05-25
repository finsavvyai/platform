#!/bin/bash

# QuantumBeam Traffic Manager
# Manages traffic routing between blue and green deployments

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
SERVICE_NAME="${SERVICE_NAME:-quantumbeam-service}"
BLUE_SERVICE="${BLUE_SERVICE:-quantumbeam-blue}"
GREEN_SERVICE="${GREEN_SERVICE:-quantumbeam-green}"
BLUE_DEPLOYMENT="${BLUE_DEPLOYMENT:-quantumbeam-blue}"
GREEN_DEPLOYMENT="${GREEN_DEPLOYMENT:-quantumbeam-green}"
CANARY_SERVICE="${CANARY_SERVICE:-quantumbeam-canary}"
CANARY_DEPLOYMENT="${CANARY_DEPLOYMENT:-quantumbeam-canary}"

# Traffic routing configuration
TRAFFIC_MODE="${TRAFFIC_MODE:-blue-green}" # blue-green, canary, weighted
BLUE_WEIGHT="${BLUE_WEIGHT:-100}"
GREEN_WEIGHT="${GREEN_WEIGHT:-0}"
CANARY_WEIGHT="${CANARY_WEIGHT:-0}"
GRACEFUL_SWITCH_TIMEOUT="${GRACEFUL_SWITCH_TIMEOUT:-60}"

# Kubernetes configuration
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
CONTEXT="${CONTEXT:-}"

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
            --service-name)
                SERVICE_NAME="$2"
                shift 2
                ;;
            --traffic-mode)
                TRAFFIC_MODE="$2"
                shift 2
                ;;
            --blue-weight)
                BLUE_WEIGHT="$2"
                shift 2
                ;;
            --green-weight)
                GREEN_WEIGHT="$2"
                shift 2
                ;;
            --canary-weight)
                CANARY_WEIGHT="$2"
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
            --graceful-timeout)
                GRACEFUL_SWITCH_TIMEOUT="$2"
                shift 2
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

    # Validate traffic weights
    local total_weight=$((BLUE_WEIGHT + GREEN_WEIGHT + CANARY_WEIGHT))
    if [[ $total_weight -ne 100 ]]; then
        error "Traffic weights must sum to 100 (blue: $BLUE_WEIGHT, green: $GREEN_WEIGHT, canary: $CANARY_WEIGHT)"
    fi
}

# Show help
show_help() {
    cat << EOF
QuantumBeam Traffic Manager

USAGE:
    traffic-manager.sh [COMMAND] [OPTIONS]

COMMANDS:
    switch-blue      Switch all traffic to blue deployment
    switch-green     Switch all traffic to green deployment
    switch-canary    Switch all traffic to canary deployment
    weighted         Set weighted traffic distribution
    status           Show current traffic status
    health           Check health of all deployments
    canary-gradual   Gradual canary deployment
    rollback         Rollback to previous traffic config

OPTIONS:
    --environment ENV           Target environment (default: production)
    --namespace NS             Kubernetes namespace (default: quantumbeam)
    --service-name NAME        Main service name (default: quantumbeam-service)
    --traffic-mode MODE        Traffic mode: blue-green, canary, weighted (default: blue-green)
    --blue-weight PERCENT      Traffic percentage for blue (default: 100)
    --green-weight PERCENT     Traffic percentage for green (default: 0)
    --canary-weight PERCENT    Traffic percentage for canary (default: 0)
    --kubeconfig PATH          Kubeconfig file path
    --context CONTEXT          Kubernetes context
    --graceful-timeout SEC     Graceful switch timeout (default: 60)
    --help, -h                 Show this help message

EXAMPLES:
    # Switch all traffic to green
    traffic-manager.sh switch-green

    # Set weighted traffic (70% blue, 30% green)
    traffic-manager.sh weighted --blue-weight 70 --green-weight 30

    # Gradual canary deployment (10% canary, 90% blue)
    traffic-manager.sh canary-gradual --canary-weight 10 --blue-weight 90

    # Check current traffic status
    traffic-manager.sh status
EOF
}

# Get kubectl command
get_kubectl_cmd() {
    local cmd="kubectl"
    if [[ -n "$CONTEXT" ]]; then
        cmd="kubectl --context $CONTEXT"
    fi
    echo "$cmd"
}

# Get current active deployment
get_active_deployment() {
    local kubectl_cmd=$(get_kubectl_cmd)

    local active_color=$($kubectl_cmd get service "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "")

    if [[ -z "$active_color" ]]; then
        # Fallback: check which deployment has more running pods
        local blue_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=blue --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        local green_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=green --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

        if [[ "$blue_pods" -ge "$green_pods" ]]; then
            active_color="blue"
        else
            active_color="green"
        fi
    fi

    echo "$active_color"
}

# Check if deployment is healthy
is_deployment_healthy() {
    local deployment=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Check if deployment exists
    if ! $kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
        return 1
    fi

    # Check deployment status
    local status=$($kubectl_cmd rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=10s 2>&1 || echo "failed")

    if [[ "$status" == *"successfully rolled out"* ]]; then
        # Check pod health
        local ready_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=${deployment##*-} --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)
        local total_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=${deployment##*-} --no-headers 2>/dev/null | wc -l)

        if [[ "$ready_pods" -eq "$total_pods" ]] && [[ "$total_pods" -gt 0 ]]; then
            return 0
        fi
    fi

    return 1
}

# Create ingress for weighted routing
create_weighted_ingress() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Creating weighted ingress configuration..."

    cat > weighted-ingress.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: quantumbeam-weighted-ingress
  namespace: $NAMESPACE
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  ingressClassName: nginx
  rules:
  - host: quantumbeam.$ENVIRONMENT.io
    http:
      paths:
EOF

    # Add blue backend
    if [[ "$BLUE_WEIGHT" -gt 0 ]]; then
        cat >> weighted-ingress.yaml << EOF
      - path: /
        pathType: Prefix
        backend:
          service:
            name: $BLUE_SERVICE
            port:
              number: 80
EOF
    fi

    # Add green backend
    if [[ "$GREEN_WEIGHT" -gt 0 ]]; then
        cat >> weighted-ingress.yaml << EOF
      - path: /
        pathType: Prefix
        backend:
          service:
            name: $GREEN_SERVICE
            port:
              number: 80
EOF
    fi

    # Add canary backend
    if [[ "$CANARY_WEIGHT" -gt 0 ]]; then
        cat >> weighted-ingress.yaml << EOF
      - path: /
        pathType: Prefix
        backend:
          service:
            name: $CANARY_SERVICE
            port:
              number: 80
EOF
    fi

    # Apply ingress
    $kubectl_cmd apply -f weighted-ingress.yaml || {
        error "Failed to create weighted ingress"
    }

    rm -f weighted-ingress.yaml
    success "Weighted ingress created"
}

# Create service mesh configuration for weighted routing
create_service_mesh_config() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Creating service mesh configuration for weighted routing..."

    # Create VirtualService for Istio
    cat > virtualservice.yaml << EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: quantumbeam
  namespace: $NAMESPACE
spec:
  hosts:
  - quantumbeam
  http:
  - match:
    - uri:
        prefix: /
    route:
EOF

    # Add weighted destinations
    if [[ "$BLUE_WEIGHT" -gt 0 ]]; then
        cat >> virtualservice.yaml << EOF
    - destination:
        host: $BLUE_SERVICE
        port:
          number: 80
      weight: $BLUE_WEIGHT
EOF
    fi

    if [[ "$GREEN_WEIGHT" -gt 0 ]]; then
        cat >> virtualservice.yaml << EOF
    - destination:
        host: $GREEN_SERVICE
        port:
          number: 80
      weight: $GREEN_WEIGHT
EOF
    fi

    if [[ "$CANARY_WEIGHT" -gt 0 ]]; then
        cat >> virtualservice.yaml << EOF
    - destination:
        host: $CANARY_SERVICE
        port:
          number: 80
      weight: $CANARY_WEIGHT
EOF
    fi

    # Apply if Istio is available
    if $kubectl_cmd get crd virtualservices.networking.istio.io &> /dev/null; then
        $kubectl_cmd apply -f virtualservice.yaml || {
            warning "Failed to create Istio VirtualService (Istio may not be available)"
        }
    else
        warning "Istio not available, skipping service mesh configuration"
    fi

    rm -f virtualservice.yaml
}

# Switch traffic to specific deployment
switch_traffic_to() {
    local target_color=$1
    local target_service="quantumbeam-$target_color"
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Switching traffic to $target_color deployment..."

    # Check if target deployment is healthy
    if ! is_deployment_healthy "$target_service"; then
        error "Target deployment $target_service is not healthy"
    fi

    # Get current active deployment
    local current_active=$(get_active_deployment)

    if [[ "$current_active" == "$target_color" ]]; then
        log "Traffic already pointing to $target_color"
        return 0
    fi

    # Perform graceful switch
    log "Initiating graceful traffic switch..."

    # Update main service selector
    $kubectl_cmd patch service "$SERVICE_NAME" -n "$NAMESPACE" -p '{"spec":{"selector":{"color":"'$target_color'"}}}' || {
        error "Failed to update service selector"
    }

    # Wait for graceful switch
    log "Waiting for graceful switch (timeout: ${GRACEFUL_SWITCH_TIMEOUT}s)..."
    sleep "$GRACEFUL_SWITCH_TIMEOUT"

    # Verify switch
    local new_active=$(get_active_deployment)
    if [[ "$new_active" == "$target_color" ]]; then
        success "Traffic successfully switched to $target_color"
    else
        error "Traffic switch verification failed"
    fi
}

# Set weighted traffic distribution
set_weighted_traffic() {
    log "Setting weighted traffic distribution: Blue $BLUE_WEIGHT%, Green $GREEN_WEIGHT%, Canary $CANARY_WEIGHT%"

    # Create weighted routing configuration
    create_weighted_ingress
    create_service_mesh_config

    success "Weighted traffic distribution configured"
}

# Show current traffic status
show_traffic_status() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Current Traffic Status"
    echo "========================"

    # Get active deployment
    local active_color=$(get_active_deployment)
    echo "Active Deployment: $active_color"

    # Check deployment health
    echo
    echo "Deployment Health:"

    for deployment in "$BLUE_DEPLOYMENT" "$GREEN_DEPLOYMENT" "$CANARY_DEPLOYMENT"; do
        local color=${deployment##*-}
        local health_status="❌ Unhealthy"
        local replicas="0/0"

        if $kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            if is_deployment_healthy "$deployment"; then
                health_status="✅ Healthy"
            fi

            local ready=$($kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
            local total=$($kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
            replicas="$ready/$total"
        fi

        echo "  $color: $health_status (Replicas: $replicas)"
    done

    # Show service endpoints
    echo
    echo "Service Endpoints:"
    for service in "$SERVICE_NAME" "$BLUE_SERVICE" "$GREEN_SERVICE" "$CANARY_SERVICE"; do
        if $kubectl_cmd get service "$service" -n "$NAMESPACE" &> /dev/null; then
            local endpoints=$($kubectl_cmd get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w)
            local service_name=${service##*-}
            echo "  $service_name: $endpoints endpoints"
        fi
    done

    # Show traffic configuration
    echo
    echo "Traffic Configuration:"
    echo "  Mode: $TRAFFIC_MODE"
    if [[ "$TRAFFIC_MODE" == "weighted" ]]; then
        echo "  Blue Weight: $BLUE_WEIGHT%"
        echo "  Green Weight: $GREEN_WEIGHT%"
        echo "  Canary Weight: $CANARY_WEIGHT%"
    fi
}

# Check health of all deployments
check_health() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Checking health of all deployments..."

    local all_healthy=true

    for deployment in "$BLUE_DEPLOYMENT" "$GREEN_DEPLOYMENT" "$CANARY_DEPLOYMENT"; do
        local color=${deployment##*-}

        if $kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            if is_deployment_healthy "$deployment"; then
                success "$color deployment: ✅ Healthy"
            else
                error "$color deployment: ❌ Unhealthy"
                all_healthy=false
            fi
        else
            warning "$color deployment: ⚠️ Not found"
        fi
    done

    if [[ "$all_healthy" == "true" ]]; then
        success "All deployments are healthy"
    else
        error "Some deployments are unhealthy"
        exit 1
    fi
}

# Gradual canary deployment
gradual_canary() {
    local kubectl_cmd=$(get_kubectl_cmd)
    local steps=(5 10 25 50 75 100)
    local step_duration=300  # 5 minutes per step

    log "Starting gradual canary deployment..."

    # Check if canary deployment exists and is healthy
    if ! is_deployment_healthy "$CANARY_DEPLOYMENT"; then
        error "Canary deployment is not healthy"
    fi

    # Save current traffic state for rollback
    local original_active=$(get_active_deployment)

    for step in "${steps[@]}"; do
        local canary_weight=$step
        local blue_weight=$((100 - step))

        log "Traffic step: $canary_weight% canary, $blue_weight% blue"

        # Update weights
        BLUE_WEIGHT=$blue_weight
        GREEN_WEIGHT=0
        CANARY_WEIGHT=$canary_weight

        # Apply weighted routing
        set_weighted_traffic

        # Wait and monitor
        log "Monitoring for ${step_duration}s..."

        local step_start=$(date +%s)
        local step_end=$((step_start + step_duration))

        while [[ $(date +%s) -lt $step_end ]]; do
            # Check canary health
            if ! is_deployment_healthy "$CANARY_DEPLOYMENT"; then
                warning "Canary deployment became unhealthy, rolling back..."
                rollback_to_original "$original_active"
                exit 1
            fi

            # Check metrics and error rates (placeholder for actual monitoring)
            sleep 30
        done

        success "Step $canary_weight% completed successfully"
    done

    # Final switch to canary
    log "Final switch to canary deployment..."
    switch_traffic_to "canary"

    success "Gradual canary deployment completed successfully"
}

# Rollback to original deployment
rollback_to_original() {
    local original_color=$1

    log "Rolling back to $original_color deployment..."

    # Switch traffic back
    switch_traffic_to "$original_color"

    # Reset weights
    if [[ "$original_color" == "blue" ]]; then
        BLUE_WEIGHT=100
        GREEN_WEIGHT=0
        CANARY_WEIGHT=0
    elif [[ "$original_color" == "green" ]]; then
        BLUE_WEIGHT=0
        GREEN_WEIGHT=100
        CANARY_WEIGHT=0
    fi

    success "Rollback completed"
}

# Main command handler
main() {
    local command=${1:-status}
    shift || true

    # Parse arguments
    parse_args "$@"

    # Check prerequisites
    local kubectl_cmd=$(get_kubectl_cmd)
    if ! $kubectl_cmd cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi

    if ! $kubectl_cmd get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
    fi

    # Execute command
    case "$command" in
        switch-blue)
            switch_traffic_to "blue"
            ;;
        switch-green)
            switch_traffic_to "green"
            ;;
        switch-canary)
            switch_traffic_to "canary"
            ;;
        weighted)
            set_weighted_traffic
            ;;
        status)
            show_traffic_status
            ;;
        health)
            check_health
            ;;
        canary-gradual)
            gradual_canary
            ;;
        rollback)
            local original_active=$(get_active_deployment)
            rollback_to_original "$original_active"
            ;;
        *)
            error "Unknown command: $command. Use --help for available commands."
            ;;
    esac
}

# Execute main function
main "$@"