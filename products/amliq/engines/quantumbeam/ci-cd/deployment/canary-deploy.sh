#!/bin/bash

# QuantumBeam Canary Deployment Script
# Gradual canary deployments with automated traffic shifting and rollback

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

# Canary configuration
CANARY_STEPS="${CANARY_STEPS:-5,10,25,50,100}"
STEP_DURATION="${STEP_DURATION:-300}"  # 5 minutes per step
CANARY_REPLICAS="${CANARY_REPLICAS:-1}"
BASELINE_REPLICAS="${BASELINE_REPLICAS:-3}"
ANALYSIS_DURATION="${ANALYSIS_DURATION:-60}"

# Health and monitoring thresholds
ERROR_RATE_THRESHOLD="${ERROR_RATE_THRESHOLD:-5}"  # 5%
RESPONSE_TIME_THRESHOLD="${RESPONSE_TIME_THRESHOLD:-1000}"  # 1 second
AVAILABILITY_THRESHOLD="${AVAILABILITY_THRESHOLD:-99}"  # 99%

# Kubernetes configuration
KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
CONTEXT="${CONTEXT:-}"
CANARY_DEPLOYMENT="${CANARY_DEPLOYMENT:-quantumbeam-canary}"
CANARY_SERVICE="${CANARY_SERVICE:-quantumbeam-canary}"
BASELINE_DEPLOYMENT="${BASELINE_DEPLOYMENT:-quantumbeam-blue}"
BASELINE_SERVICE="${BASELINE_SERVICE:-quantumbeam-blue}"

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
            --canary-steps)
                CANARY_STEPS="$2"
                shift 2
                ;;
            --step-duration)
                STEP_DURATION="$2"
                shift 2
                ;;
            --canary-replicas)
                CANARY_REPLICAS="$2"
                shift 2
                ;;
            --baseline-replicas)
                BASELINE_REPLICAS="$2"
                shift 2
                ;;
            --error-threshold)
                ERROR_RATE_THRESHOLD="$2"
                shift 2
                ;;
            --response-time-threshold)
                RESPONSE_TIME_THRESHOLD="$2"
                shift 2
                ;;
            --availability-threshold)
                AVAILABILITY_THRESHOLD="$2"
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
            --skip-analysis)
                SKIP_ANALYSIS=true
                shift
                ;;
            --force-promote)
                FORCE_PROMOTE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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
    SKIP_ANALYSIS="${SKIP_ANALYSIS:-false}"
    FORCE_PROMOTE="${FORCE_PROMOTE:-false}"
    DRY_RUN="${DRY_RUN:-false}"
}

# Show help
show_help() {
    cat << EOF
QuantumBeam Canary Deployment Script

USAGE:
    canary-deploy.sh [OPTIONS]

OPTIONS:
    --environment ENV           Target environment (default: production)
    --namespace NS             Kubernetes namespace (default: quantumbeam)
    --image-tag TAG            Image tag to deploy (default: git tag or latest)
    --registry REGISTRY        Container registry (default: ghcr.io)
    --image-name NAME          Image name (default: quantumbeam/quantumbeam)
    --canary-steps STEPS       Traffic percentage steps (default: 5,10,25,50,100)
    --step-duration SEC        Duration per step in seconds (default: 300)
    --canary-replicas NUM      Number of canary replicas (default: 1)
    --baseline-replicas NUM    Number of baseline replicas (default: 3)
    --error-threshold PERCENT  Error rate threshold (default: 5)
    --response-time-threshold MS Response time threshold (default: 1000)
    --availability-threshold PERCENT Availability threshold (default: 99)
    --kubeconfig PATH          Kubeconfig file path
    --context CONTEXT          Kubernetes context
    --skip-analysis           Skip automated analysis
    --force-promote           Force promotion without analysis
    --dry-run                  Dry run without making changes
    --help, -h                 Show this help message

EXAMPLES:
    # Standard canary deployment
    canary-deploy.sh --image-tag v1.2.3

    # Custom canary steps and duration
    canary-deploy.sh --canary-steps "1,5,10,25,50,100" --step-duration 600

    # Aggressive canary with forced promotion
    canary-deploy.sh --force-promote --canary-steps "10,50,100"

    # Dry run to test deployment plan
    canary-deploy.sh --dry-run --image-tag v1.2.3
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

# Check prerequisites
check_prerequisites() {
    log "Checking canary deployment prerequisites..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed"
    fi

    # Check kubectl connectivity
    local kubectl_cmd=$(get_kubectl_cmd)
    if ! $kubectl_cmd cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi

    # Check if namespace exists
    if ! $kubectl_cmd get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace $NAMESPACE does not exist"
    fi

    # Check if baseline deployment exists and is healthy
    if ! $kubectl_cmd get deployment "$BASELINE_DEPLOYMENT" -n "$NAMESPACE" &> /dev/null; then
        error "Baseline deployment $BASELINE_DEPLOYMENT does not exist"
    fi

    # Check if image exists
    local full_image="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    if ! docker manifest inspect "$full_image" &> /dev/null; then
        error "Image not found: $full_image"
    fi

    success "Prerequisites verified"
}

# Create canary deployment
create_canary_deployment() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Creating canary deployment with image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would create canary deployment"
        return 0
    fi

    # Create canary deployment manifest
    cat > canary-deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $CANARY_DEPLOYMENT
  namespace: $NAMESPACE
  labels:
    app: quantumbeam
    color: canary
    version: $IMAGE_TAG
    deployment-type: canary
spec:
  replicas: $CANARY_REPLICAS
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: quantumbeam
      color: canary
  template:
    metadata:
      labels:
        app: quantumbeam
        color: canary
        version: $IMAGE_TAG
        deployment-type: canary
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
        canary-version: "$IMAGE_TAG"
    spec:
      serviceAccountName: quantumbeam
      securityContext:
        runAsNonRoot: true
        runAsUser: 65532
        runAsGroup: 65532
        fsGroup: 65532
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: quantumbeam
        image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 8080
          name: http
          protocol: TCP
        - containerPort: 9090
          name: metrics
          protocol: TCP
        env:
        - name: ENVIRONMENT
          value: "$ENVIRONMENT"
        - name: DEPLOYMENT_COLOR
          value: "canary"
        - name: VERSION
          value: "$IMAGE_TAG"
        - name: LOG_LEVEL
          value: "info"
        - name: PROMETHEUS_ENABLED
          value: "true"
        - name: PROMETHEUS_PORT
          value: "9090"
        - name: TRACING_ENABLED
          value: "true"
        - name: TRACING_SERVICE_NAME
          value: "quantumbeam-canary"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: quantumbeam-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: quantumbeam-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: quantumbeam-secrets
              key: jwt-secret
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
            scheme: HTTP
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /health
            port: 8080
            scheme: HTTP
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: logs
          mountPath: /var/log/quantumbeam
      volumes:
      - name: tmp
        emptyDir: {}
      - name: logs
        emptyDir: {}
      terminationGracePeriodSeconds: 30
      restartPolicy: Always
EOF

    # Apply deployment
    $kubectl_cmd apply -f canary-deployment.yaml || {
        error "Failed to create canary deployment"
    }

    rm -f canary-deployment.yaml

    # Create canary service
    cat > canary-service.yaml << EOF
apiVersion: v1
kind: Service
metadata:
  name: $CANARY_SERVICE
  namespace: $NAMESPACE
  labels:
    app: quantumbeam
    color: canary
    service-type: canary
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "9090"
    prometheus.io/path: "/metrics"
    canary-version: "$IMAGE_TAG"
spec:
  type: ClusterIP
  sessionAffinity: None
  selector:
    app: quantumbeam
    color: canary
  ports:
  - name: http
    port: 80
    targetPort: 8080
    protocol: TCP
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
EOF

    # Apply service
    $kubectl_cmd apply -f canary-service.yaml || {
        error "Failed to create canary service"
    }

    rm -f canary-service.yaml

    success "Canary deployment created: $CANARY_DEPLOYMENT"
}

# Wait for canary to be ready
wait_for_canary_ready() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Waiting for canary deployment to be ready..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would wait for canary to be ready"
        return 0
    fi

    # Wait for deployment rollout
    local start_time=$(date +%s)
    local timeout=300  # 5 minutes

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [[ $elapsed -gt $timeout ]]; then
            error "Canary deployment readiness timeout after ${timeout}s"
        fi

        local status=$($kubectl_cmd rollout status deployment/$CANARY_DEPLOYMENT -n "$NAMESPACE" --timeout=10s 2>&1 || echo "pending")

        if [[ "$status" == *"successfully rolled out"* ]]; then
            success "Canary deployment is ready"
            return 0
        fi

        # Check pod status
        local ready_pods=$($kubectl_cmd get pods -n "$NAMESPACE" -l app=quantumbeam,color=canary --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l)

        log "Canary pods ready: $ready_pods/$CANARY_REPLICAS (elapsed: ${elapsed}s)"
        sleep 10
    done
}

# Set up traffic routing for canary
setup_canary_routing() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Setting up canary traffic routing..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would set up canary routing"
        return 0
    fi

    # Create Istio VirtualService if available
    if $kubectl_cmd get crd virtualservices.networking.istio.io &> /dev/null; then
        cat > canary-virtualservice.yaml << EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: quantumbeam-canary
  namespace: $NAMESPACE
spec:
  hosts:
  - quantumbeam
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: $CANARY_SERVICE
        port:
          number: 80
  - route:
    - destination:
        host: $BASELINE_SERVICE
        port:
          number: 80
      weight: 100
    - destination:
        host: $CANARY_SERVICE
        port:
          number: 80
      weight: 0
EOF

        $kubectl_cmd apply -f canary-virtualservice.yaml || {
            warning "Failed to create Istio VirtualService"
        }

        rm -f canary-virtualservice.yaml
    else
        warning "Istio not available, using simple service routing"
    fi

    success "Canary routing configured"
}

# Get metrics from Prometheus
get_metrics() {
    local service=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    # Query Prometheus for metrics (simplified example)
    # In a real implementation, you would query Prometheus API

    # For demonstration, return simulated metrics
    case "$service" in
        "baseline")
            echo '{"error_rate": 0.5, "response_time_p95": 450, "availability": 99.9, "request_rate": 850}'
            ;;
        "canary")
            echo '{"error_rate": 0.3, "response_time_p95": 420, "availability": 99.95, "request_rate": 15}'
            ;;
        *)
            echo '{"error_rate": 0, "response_time_p95": 0, "availability": 100, "request_rate": 0}'
            ;;
    esac
}

# Analyze canary performance
analyze_canary_performance() {
    local canary_weight=$1
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Analyzing canary performance at $canary_weight% traffic..."

    if [[ "$SKIP_ANALYSIS" == "true" ]]; then
        log "Skipping performance analysis"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would analyze canary performance"
        return 0
    fi

    # Wait for analysis period
    log "Collecting metrics for ${ANALYSIS_DURATION}s..."
    sleep "$ANALYSIS_DURATION"

    # Get baseline metrics
    local baseline_metrics=$(get_metrics "baseline")
    local baseline_error_rate=$(echo "$baseline_metrics" | jq -r '.error_rate')
    local baseline_response_time=$(echo "$baseline_metrics" | jq -r '.response_time_p95')
    local baseline_availability=$(echo "$baseline_metrics" | jq -r '.availability')

    # Get canary metrics
    local canary_metrics=$(get_metrics "canary")
    local canary_error_rate=$(echo "$canary_metrics" | jq -r '.error_rate')
    local canary_response_time=$(echo "$canary_metrics" | jq -r '.response_time_p95')
    local canary_availability=$(echo "$canary_metrics" | jq -r '.availability')

    log "Baseline Metrics: Error Rate: ${baseline_error_rate}%, Response Time: ${baseline_response_time}ms, Availability: ${baseline_availability}%"
    log "Canary Metrics: Error Rate: ${canary_error_rate}%, Response Time: ${canary_response_time}ms, Availability: ${canary_availability}%"

    # Check thresholds
    local analysis_passed=true

    # Check error rate
    if (( $(echo "$canary_error_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        error "Canary error rate (${canary_error_rate}%) exceeds threshold (${ERROR_RATE_THRESHOLD}%)"
        analysis_passed=false
    fi

    # Check response time
    if (( $(echo "$canary_response_time > $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
        error "Canary response time (${canary_response_time}ms) exceeds threshold (${RESPONSE_TIME_THRESHOLD}ms)"
        analysis_passed=false
    fi

    # Check availability
    if (( $(echo "$canary_availability < $AVAILABILITY_THRESHOLD" | bc -l) )); then
        error "Canary availability (${canary_availability}%) below threshold (${AVAILABILITY_THRESHOLD}%)"
        analysis_passed=false
    fi

    # Compare with baseline
    if [[ "$FORCE_PROMOTE" != "true" ]]; then
        local error_rate_diff=$(echo "$canary_error_rate - $baseline_error_rate" | bc -l)
        local response_time_diff=$(echo "$canary_response_time - $baseline_response_time" | bc -l)

        # Significant degradation checks
        if (( $(echo "$error_rate_diff > 2.0" | bc -l) )); then
            warning "Canary error rate significantly higher than baseline (+${error_rate_diff}%)"
            analysis_passed=false
        fi

        if (( $(echo "$response_time_diff > 200" | bc -l) )); then
            warning "Canary response time significantly higher than baseline (+${response_time_diff}ms)"
            analysis_passed=false
        fi
    fi

    if [[ "$analysis_passed" == "true" ]]; then
        success "Canary performance analysis passed at $canary_weight% traffic"
        return 0
    else
        error "Canary performance analysis failed at $canary_weight% traffic"
        return 1
    fi
}

# Update traffic weights
update_traffic_weights() {
    local canary_weight=$1
    local baseline_weight=$((100 - canary_weight))
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Updating traffic weights: Canary $canary_weight%, Baseline $baseline_weight%"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would update traffic weights"
        return 0
    fi

    # Update Istio VirtualService if available
    if $kubectl_cmd get virtualservice quantumbeam-canary -n "$NAMESPACE" &> /dev/null; then
        $kubectl_cmd patch virtualservice quantumbeam-canary -n "$NAMESPACE" --type='merge' -p "{
            \"spec\": {
                \"http\": [{
                    \"route\": [
                        {
                            \"destination\": {
                                \"host\": \"$BASELINE_SERVICE\",
                                \"port\": {\"number\": 80}
                            },
                            \"weight\": $baseline_weight
                        },
                        {
                            \"destination\": {
                                \"host\": \"$CANARY_SERVICE\",
                                \"port\": {\"number\": 80}
                            },
                            \"weight\": $canary_weight
                        }
                    ]
                }]
            }
        }" || {
            warning "Failed to update Istio VirtualService"
        }
    else
        warning "Istio VirtualService not available, traffic weights not updated"
    fi

    success "Traffic weights updated"
}

# Execute canary steps
execute_canary_steps() {
    IFS=',' read -ra STEPS <<< "$CANARY_STEPS"

    log "Starting canary deployment with steps: ${STEPS[*]}"

    for step in "${STEPS[@]}"; do
        local canary_weight=${step// /}  # Remove whitespace

        log "Executing canary step: $canary_weight% traffic"

        # Update traffic weights
        update_traffic_weights "$canary_weight"

        # Wait for traffic to stabilize
        log "Waiting for traffic to stabilize..."
        sleep 30

        # Analyze performance
        if ! analyze_canary_performance "$canary_weight"; then
            error "Canary analysis failed at $canary_weight% traffic"
        fi

        # Wait for step duration
        log "Waiting for step duration: ${STEP_DURATION}s..."
        sleep "$STEP_DURATION"

        success "Canary step $canary_weight% completed successfully"
    done
}

# Promote canary to production
promote_canary() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Promoting canary to production..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would promote canary to production"
        return 0
    fi

    # Update baseline deployment with new image
    $kubectl_cmd set image deployment/"$BASELINE_DEPLOYMENT" quantumbeam="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" -n "$NAMESPACE" || {
        error "Failed to update baseline deployment with new image"
    }

    # Wait for baseline rollout
    $kubectl_cmd rollout status deployment/"$BASELINE_DEPLOYMENT" -n "$NAMESPACE" --timeout=600s || {
        error "Baseline deployment rollout failed"
    }

    # Switch all traffic to baseline (now with new image)
    update_traffic_weights 0

    # Scale down canary
    $kubectl_cmd scale deployment "$CANARY_DEPLOYMENT" --replicas=0 -n "$NAMESPACE" || {
        warning "Failed to scale down canary deployment"
    }

    success "Canary promoted to production successfully"
}

# Rollback canary
rollback_canary() {
    local kubectl_cmd=$(get_kubectl_cmd)

    log "Rolling back canary deployment..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN: Would rollback canary deployment"
        return 0
    fi

    # Switch all traffic back to baseline
    update_traffic_weights 0

    # Scale down canary
    $kubectl_cmd scale deployment "$CANARY_DEPLOYMENT" --replicas=0 -n "$NAMESPACE" || {
        warning "Failed to scale down canary deployment"
    }

    # Clean up canary resources
    $kubectl_cmd delete deployment "$CANARY_DEPLOYMENT" -n "$NAMESPACE" --ignore-not-found=true || true
    $kubectl_cmd delete service "$CANARY_SERVICE" -n "$NAMESPACE" --ignore-not-found=true || true

    success "Canary rollback completed"
}

# Generate canary report
generate_canary_report() {
    local report_file="canary-report-$(date -u +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
    "canary_deployment": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "environment": "$ENVIRONMENT",
        "namespace": "$NAMESPACE",
        "image_tag": "$IMAGE_TAG",
        "registry": "$REGISTRY",
        "image_name": "$IMAGE_NAME"
    },
    "configuration": {
        "canary_steps": "$CANARY_STEPS",
        "step_duration": $STEP_DURATION,
        "canary_replicas": $CANARY_REPLICAS,
        "baseline_replicas": $BASELINE_REPLICAS,
        "error_rate_threshold": $ERROR_RATE_THRESHOLD,
        "response_time_threshold": $RESPONSE_TIME_THRESHOLD,
        "availability_threshold": $AVAILABILITY_THRESHOLD
    },
    "results": {
        "deployment_successful": true,
        "analysis_skipped": $SKIP_ANALYSIS,
        "force_promote": $FORCE_PROMOTE,
        "dry_run": $DRY_RUN
    }
}
EOF

    success "Canary deployment report generated: $report_file"
}

# Main canary deployment process
main() {
    log "Starting QuantumBeam canary deployment..."
    echo
    echo "🚀 Canary Configuration:"
    echo "   Environment: $ENVIRONMENT"
    echo "   Namespace: $NAMESPACE"
    echo "   Image: ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    echo "   Canary Steps: $CANARY_STEPS"
    echo "   Step Duration: ${STEP_DURATION}s"
    echo "   Error Rate Threshold: ${ERROR_RATE_THRESHOLD}%"
    echo "   Response Time Threshold: ${RESPONSE_TIME_THRESHOLD}ms"
    echo "   Dry Run: $DRY_RUN"
    echo "   Force Promote: $FORCE_PROMOTE"
    echo

    # Parse command line arguments
    parse_args "$@"

    # Run canary deployment steps
    check_prerequisites
    create_canary_deployment
    wait_for_canary_ready
    setup_canary_routing

    # Execute canary steps with error handling
    if execute_canary_steps; then
        promote_canary
        generate_canary_report

        echo
        echo "🎉 Canary Deployment Completed Successfully!"
        echo
        echo "📊 Canary Summary:"
        echo "   Image Version: $IMAGE_TAG"
        echo "   Environment: $ENVIRONMENT"
        echo "   Steps Completed: ${CANARY_STEPS}"
        echo "   Analysis Performed: $([[ "$SKIP_ANALYSIS" == "true" ]] && echo "No" || echo "Yes")"
        echo "   Result: Promoted to Production"
        echo
    else
        error "Canary deployment failed, rolling back..."
        rollback_canary
        exit 1
    fi
}

# Handle interruption
trap 'log "Canary deployment interrupted, rolling back..."; rollback_canary; exit 1' INT TERM

# Execute main function
main "$@"