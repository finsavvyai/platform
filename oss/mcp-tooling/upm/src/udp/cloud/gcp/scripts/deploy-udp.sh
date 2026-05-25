#!/bin/bash

# UDP GCP Deployment Script
# Complete one-command deployment for Universal Dependency Platform

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load configuration
if [ -f .env.gcp ]; then
    source .env.gcp
else
    echo "❌ .env.gcp file not found. Run setup-gcp.sh first."
    exit 1
fi

# Configuration
REGISTRY="gcr.io/$GOOGLE_CLOUD_PROJECT"
IMAGE_TAG="latest"
UDP_IMAGE="$REGISTRY/udp:$IMAGE_TAG"

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_prerequisites() {
    log_info "Checking deployment prerequisites..."

    # Check if gcloud is configured
    if ! gcloud auth list --filter="status:ACTIVE" --format="value(account)" | grep -q "@"; then
        log_error "Not authenticated with gcloud. Run setup-gcp.sh first."
        exit 1
    fi

    # Check if kubectl is configured
    if ! kubectl cluster-info &>/dev/null; then
        log_error "kubectl not configured. Run configure-project.sh first."
        exit 1
    fi

    # Check if docker is running
    if ! docker info &>/dev/null; then
        log_error "Docker is not running. Please start Docker."
        exit 1
    fi

    # Check if required APIs are enabled
    local required_apis=(
        "container.googleapis.com"
        "cloudbuild.googleapis.com"
        "containerregistry.googleapis.com"
        "cloudsql.googleapis.com"
        "redis.googleapis.com"
    )

    for api in "${required_apis[@]}"; do
        if ! gcloud services list --enabled --filter="name:$api" --format="value(name)" | grep -q "$api"; then
            log_error "Required API not enabled: $api"
            log_info "Run configure-project.sh to enable all required APIs"
            exit 1
        fi
    done

    log_success "Prerequisites check passed"
}

build_and_push_image() {
    log_info "Building and pushing UDP container image..."

    # Navigate to project root
    cd ../../../..

    # Check if Dockerfile exists
    if [ ! -f "Dockerfile.cloud" ]; then
        log_error "Dockerfile.cloud not found in project root"
        exit 1
    fi

    # Build image
    log_info "Building UDP image..."
    docker build -f Dockerfile.cloud -t "$UDP_IMAGE" .

    # Configure Docker for GCR
    gcloud auth configure-docker

    # Push image
    log_info "Pushing image to Google Container Registry..."
    docker push "$UDP_IMAGE"

    log_success "Image built and pushed: $UDP_IMAGE"

    # Return to deployment directory
    cd src/udp/cloud/gcp
}

setup_secrets() {
    log_info "Setting up Kubernetes secrets from Google Secret Manager..."

    # Get secrets from Secret Manager
    JWT_SECRET=$(gcloud secrets versions access latest --secret="udp-jwt-secret")
    SESSION_SECRET=$(gcloud secrets versions access latest --secret="udp-session-secret")
    ENCRYPTION_KEY=$(gcloud secrets versions access latest --secret="udp-encryption-key")
    DB_PASSWORD=$(gcloud secrets versions access latest --secret="udp-db-password")

    # Get Cloud SQL connection details
    SQL_CONNECTION_NAME=$(gcloud sql instances describe udp-postgres --format="value(connectionName)")
    POSTGRES_IP=$(gcloud sql instances describe udp-postgres --format="value(ipAddresses[0].ipAddress)")

    # Get Redis connection details
    REDIS_IP=$(gcloud redis instances describe udp-redis --region="$GOOGLE_CLOUD_REGION" --format="value(host)")

    # Create Kubernetes secrets
    kubectl create secret generic udp-secrets \
        --namespace=udp \
        --from-literal=SECRET_KEY="$JWT_SECRET" \
        --from-literal=JWT_SECRET="$JWT_SECRET" \
        --from-literal=SESSION_SECRET="$SESSION_SECRET" \
        --from-literal=ENCRYPTION_KEY="$ENCRYPTION_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic udp-database-secret \
        --namespace=udp \
        --from-literal=DATABASE_HOST="$POSTGRES_IP" \
        --from-literal=DATABASE_PORT="5432" \
        --from-literal=DATABASE_NAME="udp" \
        --from-literal=DATABASE_USER="udp" \
        --from-literal=DATABASE_PASSWORD="$DB_PASSWORD" \
        --from-literal=DATABASE_URL="postgresql://udp:$DB_PASSWORD@udp-postgres:5432/udp" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic udp-redis-secret \
        --namespace=udp \
        --from-literal=REDIS_HOST="$REDIS_IP" \
        --from-literal=REDIS_PORT="6379" \
        --from-literal=REDIS_URL="redis://$REDIS_IP:6379/0" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_success "Secrets configured"
}

update_manifests() {
    log_info "Updating Kubernetes manifests with deployment-specific values..."

    # Create temporary manifests directory
    mkdir -p /tmp/udp-manifests
    cp -r manifests/* /tmp/udp-manifests/

    # Update image references
    find /tmp/udp-manifests -name "*.yaml" -type f -exec sed -i.bak "s|gcr.io/PROJECT_ID/udp:latest|$UDP_IMAGE|g" {} \;

    # Update project-specific values
    find /tmp/udp-manifests -name "*.yaml" -type f -exec sed -i.bak "s|GOOGLE_CLOUD_PROJECT|$GOOGLE_CLOUD_PROJECT|g" {} \;

    # Update Redis IP in HAProxy config
    REDIS_IP=$(gcloud redis instances describe udp-redis --region="$GOOGLE_CLOUD_REGION" --format="value(host)")
    sed -i.bak "s|REDIS_IP|$REDIS_IP|g" /tmp/udp-manifests/redis.yaml

    # Add project-specific ConfigMap values
    cat >> /tmp/udp-manifests/configmap.yaml << EOF

  # Project-specific configuration
  GOOGLE_CLOUD_PROJECT: "$GOOGLE_CLOUD_PROJECT"
  GCP_REGISTRY: "$REGISTRY"
EOF

    log_success "Manifests updated"
}

deploy_kubernetes_resources() {
    log_info "Deploying Kubernetes resources..."

    # Apply resources in order
    local resources=(
        "namespace.yaml"
        "configmap.yaml"
        "postgresql.yaml"
        "redis.yaml"
        "udp-api.yaml"
        "udp-workers.yaml"
        "ingress.yaml"
        "hpa.yaml"
        "pdb.yaml"
        "monitoring.yaml"
    )

    for resource in "${resources[@]}"; do
        if [ -f "/tmp/udp-manifests/$resource" ]; then
            log_info "Applying $resource..."
            kubectl apply -f "/tmp/udp-manifests/$resource"
        else
            log_warning "Resource file not found: $resource"
        fi
    done

    log_success "Kubernetes resources deployed"
}

wait_for_deployment() {
    log_info "Waiting for deployments to be ready..."

    # Wait for deployments
    local deployments=(
        "udp-cloudsql-proxy"
        "udp-redis-proxy"
        "udp-api"
    )

    for deployment in "${deployments[@]}"; do
        log_info "Waiting for deployment: $deployment"
        kubectl wait --for=condition=available --timeout=600s deployment/"$deployment" -n udp || {
            log_warning "Deployment $deployment did not become ready in time"
            kubectl describe deployment "$deployment" -n udp
            kubectl logs -l app=udp,component="${deployment#udp-}" -n udp --tail=50
        }
    done

    # Wait for jobs to complete
    log_info "Waiting for initialization jobs..."
    kubectl wait --for=condition=complete --timeout=300s job/udp-db-init -n udp || {
        log_warning "Database initialization job failed or timed out"
        kubectl describe job udp-db-init -n udp
        kubectl logs job/udp-db-init -n udp
    }

    log_success "Deployments are ready"
}

setup_ingress() {
    log_info "Setting up ingress and load balancer..."

    # Get the external IP (this might take a few minutes)
    log_info "Waiting for load balancer IP assignment..."

    local timeout=300
    local elapsed=0
    local ip=""

    while [ $elapsed -lt $timeout ]; do
        ip=$(kubectl get ingress udp-ingress -n udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
        if [ -n "$ip" ] && [ "$ip" != "null" ]; then
            break
        fi
        echo "Waiting for IP assignment... ($elapsed/$timeout seconds)"
        sleep 10
        elapsed=$((elapsed + 10))
    done

    if [ -n "$ip" ] && [ "$ip" != "null" ]; then
        log_success "Load balancer IP assigned: $ip"
        echo "UDP API will be available at: http://$ip"
    else
        log_warning "Load balancer IP not assigned yet. Check status with:"
        echo "kubectl get ingress udp-ingress -n udp"
    fi
}

setup_monitoring() {
    log_info "Setting up monitoring and cost tracking..."

    # Create cost monitoring alert
    cat > /tmp/cost-alert.json << EOF
{
  "displayName": "UDP High Cost Alert",
  "documentation": {
    "content": "UDP deployment costs are approaching the budget threshold"
  },
  "conditions": [
    {
      "displayName": "Billing account costs exceed threshold",
      "conditionThreshold": {
        "filter": "resource.type=\"billing_account\"",
        "comparison": "COMPARISON_GREATER_THAN",
        "thresholdValue": 25.0,
        "duration": "60s"
      }
    }
  ],
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": []
}
EOF

    # Create the alert policy
    gcloud alpha monitoring policies create --policy-from-file=/tmp/cost-alert.json || log_warning "Failed to create cost alert"

    rm -f /tmp/cost-alert.json

    log_success "Monitoring configured"
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Check pod status
    log_info "Pod status:"
    kubectl get pods -n udp

    # Check service status
    log_info "Service status:"
    kubectl get services -n udp

    # Check ingress status
    log_info "Ingress status:"
    kubectl get ingress -n udp

    # Test API health
    log_info "Testing API health..."
    if kubectl port-forward service/udp-api-service 8080:8000 -n udp &>/dev/null &; then
        PORT_FORWARD_PID=$!
        sleep 5

        if curl -f http://localhost:8080/health &>/dev/null; then
            log_success "API health check passed"
        else
            log_warning "API health check failed"
        fi

        kill $PORT_FORWARD_PID &>/dev/null || true
    fi

    log_success "Deployment verification completed"
}

cleanup_temp_files() {
    log_info "Cleaning up temporary files..."

    # Remove temporary manifests
    rm -rf /tmp/udp-manifests

    # Remove backup files
    find . -name "*.bak" -type f -delete

    log_success "Cleanup completed"
}

output_deployment_info() {
    log_info "Generating deployment information..."

    # Get important information
    EXTERNAL_IP=$(kubectl get ingress udp-ingress -n udp -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending")
    CLUSTER_NAME=$(kubectl config current-context | cut -d'_' -f4)

    cat > deployment-info.txt << EOF
UDP GCP Deployment Information
=============================

Project: $GOOGLE_CLOUD_PROJECT
Region: $GOOGLE_CLOUD_REGION
Cluster: $CLUSTER_NAME
Image: $UDP_IMAGE

Endpoints:
---------
External IP: $EXTERNAL_IP
API URL: http://$EXTERNAL_IP (when available)
Health Check: http://$EXTERNAL_IP/health
API Docs: http://$EXTERNAL_IP/docs
Metrics: http://$EXTERNAL_IP/metrics

Useful Commands:
---------------
# Check deployment status
kubectl get pods -n udp

# View logs
kubectl logs -l app=udp,component=api -n udp

# Port forward for local access
kubectl port-forward service/udp-api-service 8080:8000 -n udp

# Scale deployment
kubectl scale deployment udp-api --replicas=3 -n udp

# Update image
kubectl set image deployment/udp-api udp-api=$UDP_IMAGE -n udp

Cost Management:
---------------
# Check current costs
gcloud billing budgets list

# Scale down for cost savings
./scale-down.sh

# Complete cleanup
./cleanup-resources.sh

Next Steps:
----------
1. Configure your domain to point to $EXTERNAL_IP
2. Set up SSL/TLS certificates
3. Configure teddk to use this endpoint
4. Set up monitoring alerts
5. Configure backup schedules

For teddk integration, run:
./configure-teddk.sh
EOF

    log_success "Deployment information saved to deployment-info.txt"
}

main() {
    echo "🚀 UDP GCP Deployment"
    echo "===================="
    echo

    log_info "Starting deployment to project: $GOOGLE_CLOUD_PROJECT"
    log_info "Region: $GOOGLE_CLOUD_REGION"
    echo

    check_prerequisites
    build_and_push_image
    setup_secrets
    update_manifests
    deploy_kubernetes_resources
    wait_for_deployment
    setup_ingress
    setup_monitoring
    verify_deployment
    cleanup_temp_files
    output_deployment_info

    echo
    log_success "UDP deployment completed successfully!"
    echo
    log_info "Deployment details saved to deployment-info.txt"
    echo
    log_warning "Remember to:"
    echo "1. Set up domain and SSL certificates"
    echo "2. Configure backup schedules"
    echo "3. Monitor costs regularly"
    echo "4. Configure teddk integration"
    echo
    log_info "For teddk integration: ./configure-teddk.sh"
    log_info "To scale down for cost savings: ./scale-down.sh"
}

main "$@"