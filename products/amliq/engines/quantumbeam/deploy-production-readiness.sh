#!/bin/bash

# Production Readiness Systems Deployment Script
# This script deploys all production readiness components to Kubernetes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    print_success "Prerequisites check passed"
}

# Create namespaces
create_namespaces() {
    print_status "Creating namespaces..."

    namespaces=(
        "config-validation"
        "monitoring"
        "observability"
        "operations"
    )

    for ns in "${namespaces[@]}"; do
        if kubectl get namespace $ns &> /dev/null; then
            print_warning "Namespace $ns already exists"
        else
            kubectl create namespace $ns
            print_success "Created namespace: $ns"
        fi

        # Add labels to namespace
        kubectl label namespace $ns purpose=production-readiness --overwrite
    done
}

# Deploy Configuration Validation System
deploy_config_validation() {
    print_status "Deploying Configuration Validation System..."

    # Create secrets first (if they don't exist)
    if ! kubectl get secret config-validator-secrets -n config-validation &> /dev/null; then
        print_warning "Creating placeholder secrets - please update with real values"
        kubectl create secret generic config-validator-secrets \
            --from-literal=slack-webhook="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
            --from-literal=pagerduty-key="YOUR_PAGERDUTY_KEY" \
            --from-literal=aws-access-key-id="" \
            --from-literal=aws-secret-access-key="" \
            -n config-validation
    fi

    # Deploy configuration validation system
    if [[ -f "deployment/config-validation/config-validation-deployment.yaml" ]]; then
        kubectl apply -f deployment/config-validation/config-validation-deployment.yaml
        print_success "Configuration Validation deployment applied"
    else
        print_error "Configuration validation deployment file not found"
        return 1
    fi

    # Deploy drift detection configuration
    if [[ -f "deployment/config-validation/drift-detection-config.yaml" ]]; then
        kubectl apply -f deployment/config-validation/drift-detection-config.yaml
        print_success "Drift Detection configuration applied"
    fi

    # Deploy custom policies
    if [[ -f "deployment/config-validation/policies/custom-policies.yaml" ]]; then
        kubectl apply -f deployment/config-validation/policies/custom-policies.yaml
        print_success "Custom policies applied"
    fi

    # Wait for deployment to be ready
    print_status "Waiting for Configuration Validation deployment to be ready..."
    kubectl wait --for=condition=available deployment/config-validator -n config-validation --timeout=300s
    print_success "Configuration Validation system is ready"
}

# Deploy Monitoring Systems
deploy_monitoring() {
    print_status "Deploying Monitoring and Alerting Systems..."

    # Deploy alerting integrations
    if [[ -f "monitoring/alerting/pagerduty-integration.yaml" ]]; then
        kubectl apply -f monitoring/alerting/pagerduty-integration.yaml
        print_success "PagerDuty integration deployed"
    fi

    if [[ -f "monitoring/alerting/slack-integration.yaml" ]]; then
        kubectl apply -f monitoring/alerting/slack-integration.yaml
        print_success "Slack integration deployed"
    fi

    # Deploy alert correlation engine
    if [[ -f "monitoring/correlation/alert-correlation-engine.py" ]]; then
        # Note: This needs to be containerized first
        print_warning "Alert correlation engine needs to be built as container image"
    fi

    # Deploy anomaly detection system
    if [[ -f "monitoring/anomaly-detection/ml-anomaly-detection-advanced.py" ]]; then
        # Note: This needs to be containerized first
        print_warning "ML Anomaly Detection system needs to be built as container image"
    fi
}

# Deploy Observability Stack
deploy_observability() {
    print_status "Deploying Observability Stack..."

    # Deploy OpenTelemetry and Jaeger
    if [[ -f "observability/tracing/opentelemetry-config.yaml" ]]; then
        kubectl apply -f observability/tracing/opentelemetry-config.yaml
        print_success "OpenTelemetry and Jaeger deployed"
    fi

    # Wait for Jaeger to be ready
    print_status "Waiting for Jaeger deployment..."
    kubectl wait --for=condition=available deployment/jaeger -n observability --timeout=300s || \
    kubectl wait --for=condition=available deployment/jaeger-all-in-one -n observability --timeout=300s || \
    print_warning "Jaeger deployment check timed out, but continuing..."
}

# Deploy Resource Optimization
deploy_resource_optimization() {
    print_status "Deploying Resource Optimization System..."

    if [[ -f "operations/resource-optimization/resource-optimizer.py" ]]; then
        # Note: This needs to be containerized first
        print_warning "Resource Optimization system needs to be built as container image"
    fi
}

# Verify deployments
verify_deployments() {
    print_status "Verifying deployments..."

    # Check Configuration Validation
    if kubectl get pods -n config-validation -l app=config-validator | grep -q Running; then
        print_success "Configuration Validation system is running"
    else
        print_error "Configuration Validation system is not running properly"
    fi

    # Check Observability
    if kubectl get pods -n observability -l app=jaeger | grep -q Running; then
        print_success "Observability stack is running"
    else
        print_warning "Observability stack may not be fully ready"
    fi

    # Check services
    print_status "Checking services..."
    kubectl get services -n config-validation
    kubectl get services -n observability
}

# Get access information
get_access_info() {
    print_status "Getting access information..."

    echo ""
    echo "=== Service Access Information ==="

    # Configuration Validator
    config_validator_svc=$(kubectl get svc config-validator -n config-validation -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "ClusterIP only")
    echo "Configuration Validator: $config_validator_svc (port 80)"

    # Jaeger UI
    jaeger_svc=$(kubectl get svc jaeger-query -n observability -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "ClusterIP only")
    echo "Jaeger UI: $jaeger_svc (port 16686)"

    # Port forward commands
    echo ""
    echo "=== Port Forward Commands ==="
    echo "# Configuration Validator API:"
    echo "kubectl port-forward svc/config-validator 8080:80 -n config-validation"
    echo ""
    echo "# Jaeger UI:"
    echo "kubectl port-forward svc/jaeger-query 16686:16686 -n observability"
    echo ""
    echo "# OpenTelemetry Collector:"
    echo "kubectl port-forward svc/opentelemetry-collector 4317:4317 -n observability"
}

# Cleanup function
cleanup() {
    print_status "Deployment completed with some components requiring manual setup"
    echo ""
    echo "=== Next Steps ==="
    echo "1. Build container images for Python services:"
    echo "   - Resource Optimizer"
    echo "   - ML Anomaly Detection"
    echo "   - Alert Correlation Engine"
    echo ""
    echo "2. Update secrets with real values:"
    echo "   kubectl edit secret config-validator-secrets -n config-validation"
    echo ""
    echo "3. Configure monitoring integration:"
    echo "   - Update Prometheus to scrape new services"
    echo "   - Configure Grafana dashboards"
    echo ""
    echo "4. Test the deployments:"
    echo "   - Check pod logs: kubectl logs -n config-validation deployment/config-validator"
    echo "   - Verify API access: curl http://localhost:8080/health"
}

# Main deployment function
main() {
    echo "🚀 QuantumBeam Production Readiness Deployment"
    echo "============================================"
    echo ""

    check_prerequisites
    create_namespaces
    deploy_config_validation
    deploy_monitoring
    deploy_observability
    deploy_resource_optimization
    verify_deployments
    get_access_info
    cleanup

    print_success "Deployment completed! Check the output above for next steps."
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"