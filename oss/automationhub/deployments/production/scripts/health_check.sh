#!/bin/bash

# UPM.Plus AutomationHub - Health Check Script
# Version: 1.0
# Usage: ./health_check.sh [--namespace upm-plus-prod] [--output json] [--verbose]

set -euo pipefail

# Configuration
DEFAULT_NAMESPACE="upm-plus-prod"
NAMESPACE="$DEFAULT_NAMESPACE"
OUTPUT_FORMAT="text"
VERBOSE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/health-check-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables for health status
OVERALL_HEALTH=true
HEALTH_DETAILS=()

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
    OVERALL_HEALTH=false
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

log_verbose() {
    if [[ "$VERBOSE" = true ]]; then
        echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] VERBOSE:${NC} $1" | tee -a "$LOG_FILE"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--namespace NAMESPACE] [--output FORMAT] [--verbose] [--help]"
            echo "  --namespace   Kubernetes namespace to check (default: $DEFAULT_NAMESPACE)"
            echo "  --output      Output format: text, json, yaml (default: text)"
            echo "  --verbose     Enable verbose output"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Health check result structure
check_result() {
    local service="$1"
    local status="$2"
    local message="$3"
    local details="$4"

    HEALTH_DETAILS+=("$service:$status:$message:$details")
    if [[ "$status" = "UNHEALTHY" ]]; then
        OVERALL_HEALTH=false
    fi
}

# Check if command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if kubectl is available
    if ! command_exists kubectl; then
        log_error "kubectl is not installed"
        exit 1
    fi

    # Check kubernetes connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi

    log "✅ Prerequisites check completed"
}

# Check namespace-level health
check_namespace_health() {
    log "Checking namespace health for '$NAMESPACE'..."

    local namespace_status
    namespace_status=$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.status.phase}')

    if [[ "$namespace_status" = "Active" ]]; then
        log_verbose "✅ Namespace '$NAMESPACE' is Active"
        check_result "namespace" "HEALTHY" "Namespace is active" "Status: $namespace_status"
    else
        log_error "❌ Namespace '$NAMESPACE' is not Active (Status: $namespace_status)"
        check_result "namespace" "UNHEALTHY" "Namespace is not active" "Status: $namespace_status"
    fi
}

# Check deployment health
check_deployment_health() {
    log "Checking deployment health..."

    local deployments
    deployments=$(kubectl get deployments -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$deployments" ]]; then
        log_warning "⚠ No deployments found in namespace '$NAMESPACE'"
        check_result "deployments" "WARNING" "No deployments found" "Namespace may be empty"
        return
    fi

    for deployment in $deployments; do
        log_verbose "Checking deployment: $deployment"

        # Get deployment status
        local replicas
        replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
        local desired_replicas
        desired_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
        local unavailable_replicas
        unavailable_replicas=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.unavailableReplicas}')

        replicas=${replicas:-0}
        unavailable_replicas=${unavailable_replicas:-0}

        # Check deployment health
        if [[ $replicas -eq $desired_replicas && $unavailable_replicas -eq 0 ]]; then
            log_verbose "✅ Deployment '$deployment': $replicas/$desired_replicas replicas ready"
            check_result "deployment:$deployment" "HEALTHY" "All replicas ready" "Ready: $replicas/$desired_replicas"
        else
            log_error "❌ Deployment '$deployment': $replicas/$desired_replicas replicas ready, $unavailable_replicas unavailable"
            check_result "deployment:$deployment" "UNHEALTHY" "Not all replicas ready" "Ready: $replicas/$desired_replicas, Unavailable: $unavailable_replicas"
        fi

        # Check rollout status
        local rollout_status
        if kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=10s &>/dev/null; then
            log_verbose "✅ Deployment '$deployment': Rollout complete"
        else
            log_warning "⚠ Deployment '$deployment': Rollout in progress"
            check_result "deployment:$deployment" "WARNING" "Rollout in progress" "Check kubectl rollout status"
        fi
    done
}

# Check pod health
check_pod_health() {
    log "Checking pod health..."

    local pods
    pods=$(kubectl get pods -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pods" ]]; then
        log_warning "⚠ No pods found in namespace '$NAMESPACE'"
        check_result "pods" "WARNING" "No pods found" "Namespace may be empty"
        return
    fi

    local total_pods=0
    local healthy_pods=0
    local unhealthy_pods=0
    local pod_details=()

    for pod in $pods; do
        total_pods=$((total_pods + 1))

        local pod_phase
        pod_phase=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        local pod_ready
        pod_ready=$(kubectl get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')

        if [[ "$pod_phase" = "Running" && "$pod_ready" = "True" ]]; then
            healthy_pods=$((healthy_pods + 1))
            log_verbose "✅ Pod '$pod': $pod_phase, Ready"
        else
            unhealthy_pods=$((unhealthy_pods + 1))
            log_error "❌ Pod '$pod': $pod_phase, Ready: $pod_ready"
            pod_details+=("$pod:$pod_phase:$pod_ready")
        fi
    done

    log "Pod Health Summary: $healthy_pods/$total_pods healthy, $unhealthy_pods unhealthy"

    if [[ $unhealthy_pods -eq 0 ]]; then
        check_result "pods" "HEALTHY" "All pods healthy" "Total: $total_pods, Healthy: $healthy_pods"
    else
        local detail="Unhealthy pods: ${pod_details[*]}"
        check_result "pods" "UNHEALTHY" "$unhealthy_pods unhealthy pods" "$detail"
    fi
}

# Check service health
check_service_health() {
    log "Checking service health..."

    local services
    services=$(kubectl get services -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$services" ]]; then
        log_warning "⚠ No services found in namespace '$NAMESPACE'"
        check_result "services" "WARNING" "No services found" "Namespace may be empty"
        return
    fi

    for service in $services; do
        log_verbose "Checking service: $service"

        local service_type
        service_type=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.type}')
        local cluster_ip
        cluster_ip=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')

        if [[ "$service_type" = "LoadBalancer" ]]; then
            local external_ip
            external_ip=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

            if [[ -n "$external_ip" ]]; then
                log_verbose "✅ Service '$service': LoadBalancer ready ($external_ip)"
                check_result "service:$service" "HEALTHY" "LoadBalancer configured" "External: $external_ip"
            else
                log_warning "⚠ Service '$service': LoadBalancer not ready"
                check_result "service:$service" "WARNING" "LoadBalancer provisioning" "Check AWS/Azure/GCP console"
            fi
        elif [[ "$cluster_ip" != "<none>" && "$cluster_ip" != "" ]]; then
            log_verbose "✅ Service '$service': ClusterIP assigned ($cluster_ip)"
            check_result "service:$service" "HEALTHY" "ClusterIP assigned" "Internal: $cluster_ip"
        else
            log_warning "⚠ Service '$service': No IP assigned"
            check_result "service:$service" "WARNING" "No IP assigned" "Type: $service_type"
        fi
    done
}

# Check ingress health
check_ingress_health() {
    log "Checking ingress health..."

    local ingresses
    ingresses=$(kubectl get ingress -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)

    if [[ -z "$ingresses" ]]; then
        log_info "ℹ No ingress resources found in namespace '$NAMESPACE'"
        return
    fi

    for ingress in $ingresses; do
        log_verbose "Checking ingress: $ingress"

        local ingress_class
        ingress_class=$(kubectl get ingress "$ingress" -n "$NAMESPACE" -o jsonpath='{.spec.ingressClassName}')
        local addresses
        addresses=$(kubectl get ingress "$ingress" -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[*].hostname}')

        if [[ -n "$addresses" ]]; then
            log_verbose "✅ Ingress '$ingress': Addresses assigned ($addresses)"
            check_result "ingress:$ingress" "HEALTHY" "Ingress configured" "Addresses: $addresses, Class: $ingress_class"
        else
            log_warning "⚠ Ingress '$ingress': No addresses assigned"
            check_result "ingress:$ingress" "WARNING" "No addresses assigned" "Class: $ingress_class"
        fi
    done
}

# Check external endpoints
check_external_health() {
    log "Checking external endpoints..."

    # Define endpoints to check
    local endpoints=(
        "https://api.upm.plus/health:API"
        "https://upm.plus/health:Frontend"
        "https://api.upm.plus/ready:API Ready"
    )

    for endpoint_info in "${endpoints[@]}"; do
        local endpoint="${endpoint_info%:*}"
        local name="${endpoint_info#*:}"

        log_verbose "Checking endpoint: $name ($endpoint)"

        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$endpoint" 2>/dev/null || echo "000")

        if [[ "$http_code" =~ ^[23] ]]; then
            log_verbose "✅ Endpoint '$name': HTTP $http_code"
            check_result "endpoint:$name" "HEALTHY" "Endpoint responding" "HTTP $http_code"
        else
            log_error "❌ Endpoint '$name': HTTP $http_code"
            check_result "endpoint:$name" "UNHEALTHY" "Endpoint not responding" "HTTP $http_code"
        fi
    done
}

# Check resource utilization
check_resource_utilization() {
    log "Checking resource utilization..."

    if ! command_exists kubectl-top; then
        log_info "ℹ kubectl top command not available, skipping resource checks"
        return
    fi

    # Check node utilization
    local node_cpu
    local node_memory
    node_cpu=$(kubectl top nodes --no-headers | awk '{sum+=$2} END {print sum}' || echo "0")
    node_memory=$(kubectl top nodes --no-headers | awk '{sum+=$3} END {print sum}' || echo "0")

    if [[ -n "$node_cpu" && "$node_cpu" != "0" ]]; then
        log_verbose "Node CPU: $node_cpu, Memory: $node_memory"
        check_result "resources:nodes" "HEALTHY" "Resource metrics available" "CPU: $node_cpu, Memory: $node_memory"
    else
        log_warning "⚠ Node resource metrics not available"
        check_result "resources:nodes" "WARNING" "Metrics not available" "Check metrics-server"
    fi

    # Check pod utilization
    local pod_cpu
    local pod_memory
    pod_cpu=$(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null | awk '{sum+=$2} END {print sum}' || echo "0")
    pod_memory=$(kubectl top pods -n "$NAMESPACE" --no-headers 2>/dev/null | awk '{sum+=$3} END {print sum}' || echo "0")

    if [[ -n "$pod_cpu" && "$pod_cpu" != "0" ]]; then
        log_verbose "Pod CPU: $pod_cpu, Memory: $pod_memory"
        check_result "resources:pods" "HEALTHY" "Pod resource metrics available" "CPU: $pod_cpu, Memory: $pod_memory"
    else
        log_warning "⚠ Pod resource metrics not available"
        check_result "resources:pods" "WARNING" "Pod metrics not available" "Check metrics-server"
    fi
}

# Check persistent volumes
check_persistent_volumes() {
    log "Checking persistent volumes..."

    local pvcs
    pvcs=$(kubectl get pvc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')

    if [[ -z "$pvcs" ]]; then
        log_info "ℹ No PVCs found in namespace '$NAMESPACE'"
        return
    fi

    for pvc in $pvcs; do
        log_verbose "Checking PVC: $pvc"

        local pvc_status
        pvc_status=$(kubectl get pvc "$pvc" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
        local storage_class
        storage_class=$(kubectl get pvc "$pvc" -n "$NAMESPACE" -o jsonpath='{.spec.storageClassName}')

        if [[ "$pvc_status" = "Bound" ]]; then
            log_verbose "✅ PVC '$pvc': Bound ($storage_class)"
            check_result "pvc:$pvc" "HEALTHY" "PVC bound" "Status: $pvc_status, Class: $storage_class"
        else
            log_error "❌ PVC '$pvc': $pvc_status ($storage_class)"
            check_result "pvc:$pvc" "UNHEALTHY" "PVC not bound" "Status: $pvc_status, Class: $storage_class"
        fi
    done
}

# Generate text output
generate_text_output() {
    echo ""
    echo "=================================="
    echo "🏥 UPM.Plus Health Check Results"
    echo "=================================="
    echo "Namespace: $NAMESPACE"
    echo "Timestamp: $(date)"
    echo "Overall Health: $([ "$OVERALL_HEALTH" = true ] && echo "✅ HEALTHY" || echo "❌ UNHEALTHY")"
    echo ""

    for detail in "${HEALTH_DETAILS[@]}"; do
        IFS=':' read -r service status message extra <<< "$detail"

        local status_icon
        case "$status" in
            "HEALTHY")
                status_icon="✅"
                ;;
            "UNHEALTHY")
                status_icon="❌"
                ;;
            "WARNING")
                status_icon="⚠️"
                ;;
            *)
                status_icon="❓"
                ;;
        esac

        echo "$status_icon $service: $message"
        if [[ "$VERBOSE" = true && -n "$extra" ]]; then
            echo "   Details: $extra"
        fi
    done

    echo ""
    echo "=================================="
    echo "Log file: $LOG_FILE"
    echo "=================================="
}

# Generate JSON output
generate_json_output() {
    local json_output
    json_output=$(cat << EOF
{
  "namespace": "$NAMESPACE",
  "timestamp": "$(date -Iseconds)",
  "overall_health": $([ "$OVERALL_HEALTH" = true ] && echo "true" || echo "false"),
  "checks": [
EOF
)

    local first=true
    for detail in "${HEALTH_DETAILS[@]}"; do
        IFS=':' read -r service status message extra <<< "$detail"

        if [[ "$first" = true ]]; then
            first=false
        else
            json_output+=","
        fi

        json_output+=$(cat << EOF
    {
      "service": "$service",
      "status": "$status",
      "message": "$message",
      "details": "$extra"
    }
EOF
)
    done

    json_output+=$(cat << EOF
  ],
  "log_file": "$LOG_FILE"
}
EOF
)

    echo "$json_output"
}

# Generate YAML output
generate_yaml_output() {
    echo "namespace: $NAMESPACE"
    echo "timestamp: $(date -Iseconds)"
    echo "overall_health: $([ "$OVERALL_HEALTH" = true ] && echo "true" || echo "false")"
    echo "checks:"

    for detail in "${HEALTH_DETAILS[@]}"; do
        IFS=':' read -r service status message extra <<< "$detail"

        echo "  - service: $service"
        echo "    status: $status"
        echo "    message: $message"
        echo "    details: $extra"
    done

    echo "log_file: $LOG_FILE"
}

# Set exit code based on overall health
set_exit_code() {
    if [[ "$OVERALL_HEALTH" = true ]]; then
        exit 0
    else
        exit 1
    fi
}

# Main execution
main() {
    log "🏥 Starting UPM.Plus Health Check"
    log "=================================="
    log "Namespace: $NAMESPACE"
    log "Output Format: $OUTPUT_FORMAT"
    log "Verbose: $VERBOSE"
    log ""

    # Execute health checks
    check_prerequisites
    check_namespace_health
    check_deployment_health
    check_pod_health
    check_service_health
    check_ingress_health
    check_external_health
    check_resource_utilization
    check_persistent_volumes

    log ""
    log "Health checks completed"

    # Generate output
    case "$OUTPUT_FORMAT" in
        "json")
            generate_json_output
            ;;
        "yaml")
            generate_yaml_output
            ;;
        *)
            generate_text_output
            ;;
    esac

    # Set exit code
    set_exit_code
}

# Execute main function
main "$@"