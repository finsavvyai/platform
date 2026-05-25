#!/bin/bash

# QuantumBeam Health Monitor
# Monitors deployment health during blue-green and canary deployments

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
MONITOR_INTERVAL="${MONITOR_INTERVAL:-30}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
METRICS_COLLECTION_INTERVAL="${METRICS_COLLECTION_INTERVAL:-60}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-3}"

# Kubernetes configuration
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
CONTEXT="${CONTEXT:-}"

# Services to monitor
SERVICES=("quantumbeam-service" "quantumbeam-blue" "quantumbeam-green" "quantumbeam-canary")
DEPLOYMENTS=("quantumbeam-blue" "quantumbeam-green" "quantumbeam-canary")

# Health check endpoints
HEALTH_ENDPOINTS=("/health" "/ready" "/api/v1/status")
METRICS_ENDPOINT="/metrics"

# Alerting configuration
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_RECIPIENTS="${EMAIL_RECIPIENTS:-}"

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
            --monitor-interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            --health-timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            --metrics-interval)
                METRICS_COLLECTION_INTERVAL="$2"
                shift 2
                ;;
            --alert-threshold)
                ALERT_THRESHOLD="$2"
                shift 2
                ;;
            --slack-webhook)
                SLACK_WEBHOOK_URL="$2"
                shift 2
                ;;
            --email-recipients)
                EMAIL_RECIPIENTS="$2"
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
            --continuous)
                CONTINUOUS_MONITOR=true
                shift
                ;;
            --duration)
                MONITOR_DURATION="$2"
                shift 2
                ;;
            --output-format)
                OUTPUT_FORMAT="$2"
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

    # Set defaults
    CONTINUOUS_MONITOR="${CONTINUOUS_MONITOR:-false}"
    MONITOR_DURATION="${MONITOR_DURATION:-300}"
    OUTPUT_FORMAT="${OUTPUT_FORMAT:-table}"
}

# Show help
show_help() {
    cat << EOF
QuantumBeam Health Monitor

USAGE:
    health-monitor.sh [OPTIONS]

OPTIONS:
    --environment ENV           Target environment (default: production)
    --namespace NS             Kubernetes namespace (default: quantumbeam)
    --monitor-interval SEC     Health check interval (default: 30)
    --health-timeout SEC       Health check timeout (default: 300)
    --metrics-interval SEC     Metrics collection interval (default: 60)
    --alert-threshold COUNT    Alert after N consecutive failures (default: 3)
    --slack-webhook URL        Slack webhook URL for alerts
    --email-recipients EMAIL   Email recipients for alerts (comma-separated)
    --kubeconfig PATH          Kubeconfig file path
    --context CONTEXT          Kubernetes context
    --continuous               Run continuous monitoring
    --duration SEC             Monitor duration in seconds (default: 300)
    --output-format FORMAT     Output format: table, json, csv (default: table)
    --help, -h                 Show this help message

EXAMPLES:
    # Monitor for 5 minutes
    health-monitor.sh --duration 300

    # Continuous monitoring with Slack alerts
    health-monitor.sh --continuous --slack-webhook https://hooks.slack.com/...

    # Detailed monitoring with custom intervals
    health-monitor.sh --monitor-interval 15 --metrics-interval 30 --duration 600

    # JSON output for integration
    health-monitor.sh --output-format json --duration 120
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

# Check service health
check_service_health() {
    local service=$1
    local endpoint=$2
    local kubectl_cmd=$(get_kubectl_cmd)

    # Get service cluster IP
    local service_ip=$($kubectl_cmd get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")

    if [[ -z "$service_ip" || "$service_ip" == "None" ]]; then
        return 1
    fi

    # Get service port
    local service_port=$($kubectl_cmd get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="http")].port}' 2>/dev/null || echo "80")

    # Check endpoint health
    if curl -f -s --max-time 10 "http://$service_ip:$service_port$endpoint" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check pod health
check_pod_health() {
    local pod=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Check pod phase
    local phase=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")

    if [[ "$phase" != "Running" ]]; then
        return 1
    fi

    # Check pod conditions
    local ready_condition=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")

    if [[ "$ready_condition" != "True" ]]; then
        return 1
    fi

    return 0
}

# Get deployment metrics
get_deployment_metrics() {
    local deployment=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Get deployment status
    local replicas=$($kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    local ready_replicas=$($kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local available_replicas=$($kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.availableReplicas}' 2>/dev/null || echo "0")
    local updated_replicas=$($kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.updatedReplicas}' 2>/dev/null || echo "0")

    # Get rollout status
    local rollout_status=$($kubectl_cmd rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout=10s 2>&1 || echo "failed")

    # Generate JSON output
    cat << EOF
{
    "deployment": "$deployment",
    "replicas": $replicas,
    "ready_replicas": $ready_replicas,
    "available_replicas": $available_replicas,
    "updated_replicas": $updated_replicas,
    "rollout_status": "$rollout_status",
    "healthy": $([[ "$rollout_status" == *"successfully rolled out"* && "$ready_replicas" -eq "$replicas" ]] && echo "true" || echo "false")
}
EOF
}

# Get service metrics
get_service_metrics() {
    local service=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Get service endpoints
    local endpoints=$($kubectl_cmd get endpoints "$service" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w || echo "0")

    # Get service ports
    local http_port=$($kubectl_cmd get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.ports[?(@.name=="http")].port}' 2>/dev/null || echo "0")

    # Check health endpoints
    local health_status="unknown"
    local ready_status="unknown"

    if [[ "$endpoints" -gt 0 ]]; then
        if check_service_health "$service" "/health"; then
            health_status="healthy"
        else
            health_status="unhealthy"
        fi

        if check_service_health "$service" "/ready"; then
            ready_status="ready"
        else
            ready_status="not_ready"
        fi
    fi

    # Generate JSON output
    cat << EOF
{
    "service": "$service",
    "endpoints": $endpoints,
    "http_port": $http_port,
    "health_status": "$health_status",
    "ready_status": "$ready_status",
    "healthy": $([[ "$health_status" == "healthy" && "$ready_status" == "ready" ]] && echo "true" || echo "false")
}
EOF
}

# Get pod metrics
get_pod_metrics() {
    local pod=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Get pod status
    local phase=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
    local node=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.nodeName}' 2>/dev/null || echo "Unknown")
    local pod_ip=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.podIP}' 2>/dev/null || echo "Unknown")

    # Get resource usage
    local cpu_request=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.cpu}' 2>/dev/null || echo "0")
    local memory_request=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].resources.requests.memory}' 2>/dev/null || echo "0")

    # Get restart count
    local restart_count=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || echo "0")

    # Get age
    local start_time=$($kubectl_cmd get pod "$pod" -n "$NAMESPACE" -o jsonpath='{.status.startTime}' 2>/dev/null || echo "")
    local age="Unknown"
    if [[ -n "$start_time" ]]; then
        age=$(date -d "$start_time" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Unknown")
    fi

    # Generate JSON output
    cat << EOF
{
    "pod": "$pod",
    "phase": "$phase",
    "node": "$node",
    "pod_ip": "$pod_ip",
    "cpu_request": "$cpu_request",
    "memory_request": "$memory_request",
    "restart_count": $restart_count,
    "start_time": "$start_time",
    "age": "$age",
    "healthy": $([[ "$phase" == "Running" ]] && echo "true" || echo "false")
}
EOF
}

# Collect all metrics
collect_metrics() {
    local kubectl_cmd=$(get_kubectl_cmd)
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Initialize JSON structure
    local metrics="{\"timestamp\": \"$timestamp\", \"environment\": \"$ENVIRONMENT\", \"namespace\": \"$NAMESPACE\""

    # Add deployment metrics
    metrics="$metrics, \"deployments\": ["
    local first=true
    for deployment in "${DEPLOYMENTS[@]}"; do
        if $kubectl_cmd get deployment "$deployment" -n "$NAMESPACE" &>/dev/null; then
            if [[ "$first" == "false" ]]; then
                metrics="$metrics,"
            fi
            metrics="$metrics$(get_deployment_metrics "$deployment")"
            first=false
        fi
    done
    metrics="$metrics]"

    # Add service metrics
    metrics="$metrics, \"services\": ["
    first=true
    for service in "${SERVICES[@]}"; do
        if $kubectl_cmd get service "$service" -n "$NAMESPACE" &>/dev/null; then
            if [[ "$first" == "false" ]]; then
                metrics="$metrics,"
            fi
            metrics="$metrics$(get_service_metrics "$service")"
            first=false
        fi
    done
    metrics="$metrics]"

    # Add pod metrics
    metrics="$metrics, \"pods\": ["
    first=true
    local pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    for pod in $pods; do
        if [[ -n "$pod" ]]; then
            if [[ "$first" == "false" ]]; then
                metrics="$metrics,"
            fi
            metrics="$metrics$(get_pod_metrics "$pod")"
            first=false
        fi
    done
    metrics="$metrics]"

    metrics="$metrics}"

    echo "$metrics"
}

# Format output based on format type
format_output() {
    local data=$1
    local format=$2

    case "$format" in
        "json")
            echo "$data" | jq '.'
            ;;
        "csv")
            # Convert to CSV format
            echo "timestamp,deployment,replicas,ready,available,healthy"
            echo "$data" | jq -r '.deployments[] | "\(.timestamp),\(.deployment),\(.replicas),\(.ready_replicas),\(.available_replicas),\(.healthy)"'
            ;;
        "table"|*)
            # Format as table
            local timestamp=$(echo "$data" | jq -r '.timestamp')
            echo "Health Monitor Report - $timestamp"
            echo "================================"
            echo

            # Deployments
            echo "Deployments:"
            echo "-----------"
            printf "%-20s %-10s %-10s %-10s %-10s %-10s\n" "Deployment" "Replicas" "Ready" "Available" "Updated" "Healthy"
            echo "$data" | jq -r '.deployments[] | [.deployment, .replicas, .ready_replicas, .available_replicas, .updated_replicas, .healthy] | @tsv' | while IFS=$'\t' read -r deployment replicas ready available updated healthy; do
                local health_icon="❌"
                if [[ "$healthy" == "true" ]]; then
                    health_icon="✅"
                fi
                printf "%-20s %-10s %-10s %-10s %-10s %-10s\n" "$deployment" "$replicas" "$ready" "$available" "$updated" "$health_icon"
            done
            echo

            # Services
            echo "Services:"
            echo "---------"
            printf "%-20s %-10s %-15s %-15s %-10s\n" "Service" "Endpoints" "Health" "Ready" "Healthy"
            echo "$data" | jq -r '.services[] | [.service, .endpoints, .health_status, .ready_status, .healthy] | @tsv' | while IFS=$'\t' read -r service endpoints health ready healthy; do
                local health_icon="❌"
                if [[ "$healthy" == "true" ]]; then
                    health_icon="✅"
                fi
                printf "%-20s %-10s %-15s %-15s %-10s\n" "$service" "$endpoints" "$health" "$ready" "$health_icon"
            done
            echo

            # Pods
            echo "Pods:"
            echo "-----"
            printf "%-30s %-15s %-10s %-10s %-10s\n" "Pod" "Phase" "Node" "Restarts" "Healthy"
            echo "$data" | jq -r '.pods[] | [.pod, .phase, .node, .restart_count, .healthy] | @tsv' | while IFS=$'\t' read -r pod phase node restarts healthy; do
                local health_icon="❌"
                if [[ "$healthy" == "true" ]]; then
                    health_icon="✅"
                fi
                printf "%-30s %-15s %-10s %-10s %-10s\n" "$pod" "$phase" "$node" "$restarts" "$health_icon"
            done
            ;;
    esac
}

# Send alert
send_alert() {
    local message=$1
    local severity=$2

    log "Sending alert: $message"

    # Send Slack alert
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        local color="good"
        if [[ "$severity" == "critical" ]]; then
            color="danger"
        elif [[ "$severity" == "warning" ]]; then
            color="warning"
        fi

        local slack_payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "QuantumBeam Health Monitor Alert",
            "title_link": "https://console.cloud.google.com/kubernetes/workload",
            "text": "$message",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Namespace",
                    "value": "$NAMESPACE",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
                    "short": true
                },
                {
                    "title": "Severity",
                    "value": "$severity",
                    "short": true
                }
            ],
            "footer": "QuantumBeam Health Monitor",
            "ts": $(date +%s)
        }
    ]
}
EOF
        )

        curl -X POST -H 'Content-type: application/json' --data "$slack_payload" "$SLACK_WEBHOOK_URL" &>/dev/null || {
            warning "Failed to send Slack alert"
        }
    fi

    # Send email alert (placeholder)
    if [[ -n "$EMAIL_RECIPIENTS" ]]; then
        # In a real implementation, you would use sendmail or an email service
        log "Email alert would be sent to: $EMAIL_RECIPIENTS"
    fi
}

# Check overall health
check_overall_health() {
    local metrics=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Check deployment health
    local unhealthy_deployments=$(echo "$metrics" | jq -r '.deployments[] | select(.healthy == false) | .deployment' | wc -l)
    local total_deployments=$(echo "$metrics" | jq -r '.deployments | length')

    # Check service health
    local unhealthy_services=$(echo "$metrics" | jq -r '.services[] | select(.healthy == false) | .service' | wc -l)
    local total_services=$(echo "$metrics" | jq -r '.services | length')

    # Check pod health
    local unhealthy_pods=$(echo "$metrics" | jq -r '.pods[] | select(.healthy == false) | .pod' | wc -l)
    local total_pods=$(echo "$metrics" | jq -r '.pods | length')

    # Determine overall health
    local overall_health="healthy"
    local alert_message=""

    if [[ "$unhealthy_deployments" -gt 0 ]]; then
        overall_health="unhealthy"
        alert_message="$unhealthy_deployments/$total_deployments deployments are unhealthy"
    fi

    if [[ "$unhealthy_services" -gt 0 ]]; then
        overall_health="unhealthy"
        if [[ -n "$alert_message" ]]; then
            alert_message="$alert_message; "
        fi
        alert_message="${alert_message}$unhealthy_services/$total_services services are unhealthy"
    fi

    if [[ "$unhealthy_pods" -gt 0 ]]; then
        if [[ "$overall_health" == "healthy" ]]; then
            overall_health="degraded"
        fi
        if [[ -n "$alert_message" ]]; then
            alert_message="$alert_message; "
        fi
        alert_message="${alert_message}$unhealthy_pods/$total_pods pods are unhealthy"
    fi

    # Return health status
    echo "$overall_health|$alert_message|$unhealthy_deployments|$unhealthy_services|$unhealthy_pods"
}

# Run monitoring
run_monitoring() {
    local start_time=$(date +%s)
    local end_time=$((start_time + MONITOR_DURATION))
    local consecutive_failures=0

    log "Starting health monitoring for ${MONITOR_DURATION}s..."
    log "Monitoring interval: ${MONITOR_INTERVAL}s"
    log "Metrics collection interval: ${METRICS_COLLECTION_INTERVAL}s"

    while [[ $(date +%s) -lt $end_time ]]; do
        local current_time=$(date +%s)
        local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

        # Collect metrics
        local metrics=$(collect_metrics)

        # Format and display output
        format_output "$metrics" "$OUTPUT_FORMAT"

        # Check overall health
        local health_result=$(check_overall_health "$metrics")
        IFS='|' read -r overall_health alert_message unhealthy_deployments unhealthy_services unhealthy_pods <<< "$health_result"

        # Handle health status
        if [[ "$overall_health" == "healthy" ]]; then
            success "Overall health: $overall_health"
            consecutive_failures=0
        elif [[ "$overall_health" == "degraded" ]]; then
            warning "Overall health: $overall_health - $alert_message"
            consecutive_failures=0
        else
            error "Overall health: $overall_health - $alert_message"
            consecutive_failures=$((consecutive_failures + 1))

            # Send alert if threshold reached
            if [[ $consecutive_failures -ge $ALERT_THRESHOLD ]]; then
                send_alert "Health check failed $consecutive_failures consecutive times: $alert_message" "critical"
            fi
        fi

        echo "----------------------------------------"

        # Wait for next check
        sleep "$MONITOR_INTERVAL"
    done

    success "Health monitoring completed"
}

# Main monitoring process
main() {
    log "Starting QuantumBeam health monitor..."
    echo
    echo "🔍 Monitor Configuration:"
    echo "   Environment: $ENVIRONMENT"
    echo "   Namespace: $NAMESPACE"
    echo "   Monitor Interval: ${MONITOR_INTERVAL}s"
    echo "   Duration: ${MONITOR_DURATION}s"
    echo "   Continuous: $CONTINUOUS_MONITOR"
    echo "   Output Format: $OUTPUT_FORMAT"
    echo

    # Parse command line arguments
    parse_args "$@"

    # Check prerequisites
    local kubectl_cmd=$(get_kubectl_cmd)
    if ! $kubectl_cmd cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi

    if ! $kubectl_cmd get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
    fi

    # Run monitoring
    if [[ "$CONTINUOUS_MONITOR" == "true" ]]; then
        log "Running continuous monitoring (press Ctrl+C to stop)..."
        while true; do
            run_monitoring
            log "Restarting continuous monitoring..."
        done
    else
        run_monitoring
    fi
}

# Handle interruption
trap 'log "Health monitoring interrupted"; exit 0' INT TERM

# Execute main function
main "$@"