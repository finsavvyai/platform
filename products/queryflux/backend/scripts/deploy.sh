#!/bin/bash

# QueryFlux Backend Deployment Script
# This script handles deployment to various environments

set -e

# Default values
ENVIRONMENT="staging"
NAMESPACE="queryflux"
HELM_CHART_PATH="./helm/queryflux"
DOCKER_REGISTRY="queryflux"
DOCKER_IMAGE="backend"
VERSION="latest"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  -e, --environment    Target environment (staging|production) [default: staging]"
      echo "  -n, --namespace      Kubernetes namespace [default: queryflux]"
      echo "  -v, --version       Image version to deploy [default: latest]"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "🚀 QueryFlux Backend Deployment"
echo "=============================="
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo "Version: $VERSION"
echo ""

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
    exit 1
fi

# Set namespace based on environment
if [[ "$ENVIRONMENT" == "staging" ]]; then
    NAMESPACE="queryflux-staging"
    VERSION="staging"
else
    NAMESPACE="queryflux"
fi

echo "🔍 Prerequisites check..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo "❌ helm is not installed or not in PATH"
    exit 1
fi

# Check Kubernetes connection
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

echo "✅ Prerequisites satisfied"

echo ""
echo "📋 Deployment steps:"

# Step 1: Build and push Docker image
echo "1. Building Docker image..."
docker build -t $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION .
docker tag $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION $DOCKER_REGISTRY/$DOCKER_IMAGE:latest
echo "✅ Docker image built"

# Step 2: Push Docker image
echo "2. Pushing Docker image..."
docker push $DOCKER_REGISTRY/$DOCKER_IMAGE:$VERSION
echo "✅ Docker image pushed"

# Step 3: Create namespace if it doesn't exist
echo "3. Creating namespace..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
echo "✅ Namespace ready"

# Step 4: Add Helm repository if needed
echo "4. Setting up Helm..."
helm repo add queryflux-charts https://charts.queryflux.com || echo "Repository already exists"
helm repo update
echo "✅ Helm repository ready"

# Step 5: Deploy with Helm
echo "5. Deploying application with Helm..."

# Set values based on environment
VALUES_FILE="values-${ENVIRONMENT}.yaml"
if [[ ! -f "$HELM_CHART_PATH/$VALUES_FILE" ]]; then
    echo "⚠️  Values file $VALUES_FILE not found, using default values"
    VALUES_FILE="values.yaml"
fi

# Prepare Helm upgrade command
HELM_CMD="helm upgrade --install queryflux-backend $HELM_CHART_PATH \
    --namespace $NAMESPACE \
    --set image.tag=$VERSION \
    --set image.repository=$DOCKER_REGISTRY/$DOCKER_IMAGE \
    --set config.environment=$ENVIRONMENT \
    -f $HELM_CHART_PATH/$VALUES_FILE \
    --wait \
    --timeout 10m"

# Add dry-run for preview
echo "   Preview (dry-run):"
helm upgrade --install queryflux-backend $HELM_CHART_PATH \
    --namespace $NAMESPACE \
    --dry-run \
    --set image.tag=$VERSION \
    --set image.repository=$DOCKER_REGISTRY/$DOCKER_IMAGE \
    --set config.environment=$ENVIRONMENT \
    -f $HELM_CHART_PATH/$VALUES_FILE

echo ""
read -p "Proceed with deployment? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Executing deployment..."
    eval $HELM_CMD
    echo "✅ Deployment completed"
else
    echo "❌ Deployment cancelled"
    exit 1
fi

# Step 6: Verify deployment
echo ""
echo "6. Verifying deployment..."

# Wait for pods to be ready
echo "   Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=queryflux -n $NAMESPACE --timeout=300s

# Check pod status
echo "   Pod status:"
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=queryflux

# Check service status
echo "   Service status:"
kubectl get svc -n $NAMESPACE

# Get deployment status
echo "   Deployment status:"
kubectl rollout status deployment/queryflux-backend -n $NAMESPACE

# Get logs from pods
echo "   Recent logs:"
kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=queryflux --tail=20

# Step 7: Health check
echo ""
echo "7. Performing health check..."

# Get the service URL
SERVICE_URL=$(kubectl get service queryflux-backend-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [[ -z "$SERVICE_URL" ]]; then
    # Fallback to port-forward for testing
    echo "   Using port-forward for health check..."
    kubectl port-forward -n $NAMESPACE service/queryflux-backend-service 8080:80 &
    PORT_FORWARD_PID=$!
    sleep 5

    # Health check
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
    fi

    # Clean up port-forward
    kill $PORT_FORWARD_PID 2>/dev/null || true
else
    if curl -f http://$SERVICE_URL/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
        echo "   Application is available at: http://$SERVICE_URL"
    else
        echo "❌ Health check failed"
    fi
fi

echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Useful commands:"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=queryflux"
echo "  kubectl exec -n $NAMESPACE -it deployment/queryflux-backend -- bash"
echo "  helm history queryflux-backend -n $NAMESPACE"
echo ""
echo "🔄 To rollback:"
echo "  helm rollback queryflux-backend -n $NAMESPACE"
echo ""
echo "📊 To monitor:"
echo "  kubectl top pods -n $NAMESPACE"
echo "  kubectl describe deployment queryflux-backend -n $NAMESPACE"