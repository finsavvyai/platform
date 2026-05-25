#!/bin/bash

# Complete Build and Deployment Script for Production Readiness Systems
# This script builds all container images and deploys all systems

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${REGISTRY:-your-registry.com}"
VERSION="${VERSION:-latest}"
PROJECT_NAME="quantumbeam"

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

# Build container image
build_image() {
    local service_path=$1
    local service_name=$2
    local dockerfile_path="${service_path}/Dockerfile"

    print_status "Building ${service_name} image..."

    if [[ ! -f "$dockerfile_path" ]]; then
        print_error "Dockerfile not found at $dockerfile_path"
        return 1
    fi

    cd "$service_path"
    docker build -t "${REGISTRY}/${PROJECT_NAME}/${service_name}:${VERSION}" .
    docker tag "${REGISTRY}/${PROJECT_NAME}/${service_name}:${VERSION}" "${REGISTRY}/${PROJECT_NAME}/${service_name}:latest"
    cd - > /dev/null

    print_success "Built ${service_name} image: ${REGISTRY}/${PROJECT_NAME}/${service_name}:${VERSION}"
}

# Push container image
push_image() {
    local service_name=$1

    print_status "Pushing ${service_name} image..."

    docker push "${REGISTRY}/${PROJECT_NAME}/${service_name}:${VERSION}"
    docker push "${REGISTRY}/${PROJECT_NAME}/${service_name}:latest"

    print_success "Pushed ${service_name} image"
}

# Update Kubernetes deployment with new image
update_deployment() {
    local deployment_file=$1
    local service_name=$2
    local namespace=$3

    print_status "Updating ${service_name} deployment with new image..."

    # Update the image in the deployment file
    sed -i.bak "s|image: quantumbeam/${service_name}:latest|image: ${REGISTRY}/${PROJECT_NAME}/${service_name}:${VERSION}|g" "$deployment_file"

    print_success "Updated ${service_name} deployment image"
}

# Build all images
build_all_images() {
    print_status "Building all container images..."

    # Define services to build
    declare -A services=(
        ["deployment/config-validation"]="config-validator"
        ["monitoring/anomaly-detection"]="anomaly-detector"
        ["monitoring/correlation"]="alert-correlation"
        ["operations/resource-optimization"]="resource-optimizer"
    )

    for service_path in "${!services[@]}"; do
        service_name="${services[$service_path]}"

        if [[ -d "$service_path" ]]; then
            build_image "$service_path" "$service_name"

            # Push image if registry is set and not localhost
            if [[ "$REGISTRY" != "your-registry.com" ]]; then
                push_image "$service_name"
            fi

            # Update deployment files
            case "$service_name" in
                "config-validator")
                    if [[ -f "deployment/config-validation/config-validation-deployment.yaml" ]]; then
                        update_deployment "deployment/config-validation/config-validation-deployment.yaml" "$service_name" "config-validation"
                    fi
                    ;;
                "anomaly-detector")
                    # Create deployment for anomaly detector
                    create_anomaly_detector_deployment
                    ;;
                "alert-correlation")
                    # Create deployment for alert correlation
                    create_alert_correlation_deployment
                    ;;
                "resource-optimizer")
                    # Create deployment for resource optimizer
                    create_resource_optimizer_deployment
                    ;;
            esac
        else
            print_warning "Service path $service_path not found, skipping..."
        fi
    done
}

# Create deployment for ML Anomaly Detection
create_anomaly_detector_deployment() {
    cat > monitoring/anomaly-detection/anomaly-detector-deployment.yaml << EOF
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: anomaly-detector
  namespace: monitoring
  labels:
    app: anomaly-detector
    component: monitoring
spec:
  replicas: 2
  selector:
    matchLabels:
      app: anomaly-detector
      component: monitoring
  template:
    metadata:
      labels:
        app: anomaly-detector
        component: monitoring
        monitoring: enabled
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
      - name: anomaly-detector
        image: ${REGISTRY}/${PROJECT_NAME}/anomaly-detector:${VERSION}
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        - name: metrics
          containerPort: 8000
          protocol: TCP
        env:
        - name: PYTHONUNBUFFERED
          value: "1"
        - name: LOG_LEVEL
          value: "INFO"
        - name: SLACK_WEBHOOK
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: slack-webhook
              optional: true
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1Gi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 10
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: anomaly-detector
  namespace: monitoring
  labels:
    app: anomaly-detector
    component: monitoring
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8000"
    prometheus.io/path: "/metrics"
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 8080
    targetPort: http
  - name: metrics
    port: 8000
    targetPort: metrics
  selector:
    app: anomaly-detector
    component: monitoring
EOF

    print_success "Created anomaly detector deployment"
}

# Create deployment for Alert Correlation
create_alert_correlation_deployment() {
    cat > monitoring/correlation/alert-correlation-deployment.yaml << EOF
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alert-correlation
  namespace: monitoring
  labels:
    app: alert-correlation
    component: monitoring
spec:
  replicas: 2
  selector:
    matchLabels:
      app: alert-correlation
      component: monitoring
  template:
    metadata:
      labels:
        app: alert-correlation
        component: monitoring
        monitoring: enabled
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
      - name: alert-correlation
        image: ${REGISTRY}/${PROJECT_NAME}/alert-correlation:${VERSION}
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        - name: metrics
          containerPort: 8000
          protocol: TCP
        env:
        - name: PYTHONUNBUFFERED
          value: "1"
        - name: LOG_LEVEL
          value: "INFO"
        - name: SLACK_WEBHOOK
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: slack-webhook
              optional: true
        - name: PAGERDUTY_KEY
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: pagerduty-key
              optional: true
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 10
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: alert-correlation
  namespace: monitoring
  labels:
    app: alert-correlation
    component: monitoring
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8000"
    prometheus.io/path: "/metrics"
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 8080
    targetPort: http
  - name: metrics
    port: 8000
    targetPort: metrics
  selector:
    app: alert-correlation
    component: monitoring
EOF

    print_success "Created alert correlation deployment"
}

# Create deployment for Resource Optimizer
create_resource_optimizer_deployment() {
    cat > operations/resource-optimization/resource-optimizer-deployment.yaml << EOF
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: resource-optimizer
  namespace: operations
  labels:
    app: resource-optimizer
    component: optimization
spec:
  replicas: 1
  selector:
    matchLabels:
      app: resource-optimizer
      component: optimization
  template:
    metadata:
      labels:
        app: resource-optimizer
        component: optimization
        monitoring: enabled
    spec:
      serviceAccountName: resource-optimizer
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
      - name: resource-optimizer
        image: ${REGISTRY}/${PROJECT_NAME}/resource-optimizer:${VERSION}
        imagePullPolicy: Always
        ports:
        - name: http
          containerPort: 8080
          protocol: TCP
        - name: metrics
          containerPort: 8000
          protocol: TCP
        env:
        - name: PYTHONUNBUFFERED
          value: "1"
        - name: LOG_LEVEL
          value: "INFO"
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: access-key-id
              optional: true
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: secret-access-key
              optional: true
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 10
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: resource-optimizer
  namespace: operations
  labels:
    app: resource-optimizer
    component: optimization
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8000"
    prometheus.io/path: "/metrics"
spec:
  type: ClusterIP
  ports:
  - name: http
    port: 8080
    targetPort: http
  - name: metrics
    port: 8000
    targetPort: metrics
  selector:
    app: resource-optimizer
    component: optimization

---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: resource-optimizer
  namespace: operations
  labels:
    app: resource-optimizer
    component: optimization

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: resource-optimizer
  labels:
    app: resource-optimizer
    component: optimization
rules:
- apiGroups: [""]
  resources: ["pods", "nodes", "services"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["autoscaling"]
  resources: ["horizontalpodautoscalers"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: resource-optimizer
  labels:
    app: resource-optimizer
    component: optimization
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: resource-optimizer
subjects:
- kind: ServiceAccount
  name: resource-optimizer
  namespace: operations
EOF

    print_success "Created resource optimizer deployment"
}

# Deploy all systems
deploy_all() {
    print_status "Deploying all systems to Kubernetes..."

    # Run the main deployment script
    if [[ -f "deploy-production-readiness.sh" ]]; then
        ./deploy-production-readiness.sh
    else
        print_error "Main deployment script not found"
        return 1
    fi

    # Deploy additional services
    print_status "Deploying additional services..."

    # Deploy anomaly detector
    if [[ -f "monitoring/anomaly-detection/anomaly-detector-deployment.yaml" ]]; then
        kubectl apply -f monitoring/anomaly-detection/anomaly-detector-deployment.yaml
        print_success "Deployed anomaly detector"
    fi

    # Deploy alert correlation
    if [[ -f "monitoring/correlation/alert-correlation-deployment.yaml" ]]; then
        kubectl apply -f monitoring/correlation/alert-correlation-deployment.yaml
        print_success "Deployed alert correlation"
    fi

    # Deploy resource optimizer
    if [[ -f "operations/resource-optimization/resource-optimizer-deployment.yaml" ]]; then
        kubectl apply -f operations/resource-optimization/resource-optimizer-deployment.yaml
        print_success "Deployed resource optimizer"
    fi
}

# Create monitoring secrets
create_secrets() {
    print_status "Creating monitoring secrets..."

    # Create monitoring secrets
    if ! kubectl get secret monitoring-secrets -n monitoring &> /dev/null; then
        kubectl create secret generic monitoring-secrets \
            --from-literal=slack-webhook="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
            --from-literal=pagerduty-key="YOUR_PAGERDUTY_KEY" \
            -n monitoring
        print_success "Created monitoring secrets"
    else
        print_warning "Monitoring secrets already exist"
    fi

    # Create AWS credentials secret
    if ! kubectl get secret aws-credentials -n operations &> /dev/null; then
        kubectl create secret generic aws-credentials \
            --from-literal=access-key-id="" \
            --from-literal=secret-access-key="" \
            -n operations
        print_success "Created AWS credentials secret"
    else
        print_warning "AWS credentials secret already exist"
    fi
}

# Wait for all deployments to be ready
wait_for_deployments() {
    print_status "Waiting for all deployments to be ready..."

    deployments=(
        "config-validator/config-validation"
        "monitoring/anomaly-detector"
        "monitoring/alert-correlation"
        "operations/resource-optimizer"
    )

    for deployment in "${deployments[@]}"; do
        namespace=$(echo "$deployment" | cut -d'/' -f1)
        name=$(echo "$deployment" | cut -d'/' -f2)

        print_status "Waiting for $name in namespace $namespace..."
        kubectl wait --for=condition=available deployment/$name -n $namespace --timeout=600s || \
        print_warning "$name deployment not ready after timeout, continuing..."
    done
}

# Show deployment status
show_status() {
    print_status "Deployment Status:"
    echo ""

    echo "=== Configuration Validation ==="
    kubectl get pods -n config-validation -l app=config-validator
    kubectl get services -n config-validation

    echo ""
    echo "=== Monitoring Systems ==="
    kubectl get pods -n monitoring -l component=monitoring
    kubectl get services -n monitoring

    echo ""
    echo "=== Operations ==="
    kubectl get pods -n operations -l component=optimization
    kubectl get services -n operations

    echo ""
    echo "=== Observability ==="
    kubectl get pods -n observability
    kubectl get services -n observability
}

# Show access information
show_access_info() {
    print_status "Access Information:"
    echo ""
    echo "=== Port Forward Commands ==="
    echo "# Configuration Validator:"
    echo "kubectl port-forward svc/config-validator 8080:80 -n config-validation"
    echo ""
    echo "# Anomaly Detector:"
    echo "kubectl port-forward svc/anomaly-detector 8080:80 -n monitoring"
    echo ""
    echo "# Alert Correlation:"
    echo "kubectl port-forward svc/alert-correlation 8080:80 -n monitoring"
    echo ""
    echo "# Resource Optimizer:"
    echo "kubectl port-forward svc/resource-optimizer 8080:80 -n operations"
    echo ""
    echo "# Jaeger UI:"
    echo "kubectl port-forward svc/jaeger-query 16686:16686 -n observability"
    echo ""
    echo "=== API Health Checks ==="
    echo "curl http://localhost:8080/health"
    echo ""
    echo "=== Metrics Endpoints ==="
    echo "curl http://localhost:8000/metrics"
}

# Cleanup
cleanup() {
    print_status "Build and deployment completed!"
    echo ""
    echo "=== Next Steps ==="
    echo "1. Update secrets with real values:"
    echo "   kubectl edit secret monitoring-secrets -n monitoring"
    echo "   kubectl edit secret aws-credentials -n operations"
    echo ""
    echo "2. Configure Prometheus to scrape new services"
    echo "3. Set up Grafana dashboards"
    echo "4. Test all APIs using the port forward commands above"
    echo "5. Configure alerting rules and notification channels"
}

# Main function
main() {
    echo "🚀 QuantumBeam Production Readiness - Build & Deploy"
    echo "=================================================="
    echo ""
    echo "Registry: $REGISTRY"
    echo "Version: $VERSION"
    echo ""

    # Check if we should only build or only deploy
    case "${1:-all}" in
        "build")
            build_all_images
            ;;
        "deploy")
            create_secrets
            deploy_all
            wait_for_deployments
            show_status
            show_access_info
            ;;
        "all")
            build_all_images
            create_secrets
            deploy_all
            wait_for_deployments
            show_status
            show_access_info
            ;;
        *)
            echo "Usage: $0 [build|deploy|all]"
            echo "  build  - Build all container images"
            echo "  deploy - Deploy all systems to Kubernetes"
            echo "  all    - Build and deploy (default)"
            exit 1
            ;;
    esac
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"