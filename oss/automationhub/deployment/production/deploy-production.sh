#!/bin/bash

# UPM.Plus Production Deployment Script
# Domain: upm.plus

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="upm.plus"
NAMESPACE="upm-plus"
REGISTRY="ghcr.io/your-org"
DOCKER_TAG="latest"

echo -e "${BLUE}🚀 Starting UPM.Plus Production Deployment${NC}"
echo -e "${BLUE}Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}Namespace: ${NAMESPACE}${NC}"
echo ""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed"
        exit 1
    fi

    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        print_error "helm is not installed"
        exit 1
    fi

    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    print_status "Prerequisites check passed ✓"
}

# Create namespace
create_namespace() {
    print_status "Creating namespace: ${NAMESPACE}"
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    print_status "Namespace created ✓"
}

# Create secrets
create_secrets() {
    print_status "Creating production secrets..."

    # Prompt for database password
    read -s -p "Enter database password: " DB_PASSWORD
    echo
    read -s -p "Enter Redis password (optional): " REDIS_PASSWORD
    echo
    read -s -p "Enter OpenAI API key: " OPENAI_API_KEY
    echo
    read -s -p "Enter JWT secret key: " JWT_SECRET
    echo
    read -s -p "Enter application secret key: " SECRET_KEY
    echo

    # Create secrets
    kubectl create secret generic upm-plus-production-secrets \
        --from-literal=DATABASE_URL="postgresql://upmplus:${DB_PASSWORD}@postgres:5432/upmplus" \
        --from-literal=REDIS_URL="redis://redis:6379/0" \
        --from-literal=REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
        --from-literal=OPENAI_API_KEY="${OPENAI_API_KEY}" \
        --from-literal=JWT_SECRET_KEY="${JWT_SECRET}" \
        --from-literal=SECRET_KEY="${SECRET_KEY}" \
        --from-literal=POSTGRES_DB=upmplus \
        --from-literal=POSTGRES_USER=upmplus \
        --from-literal=POSTGRES_PASSWORD="${DB_PASSWORD}" \
        --namespace=${NAMESPACE} \
        --dry-run=client -o yaml | kubectl apply -f -

    print_status "Secrets created ✓"
}

# Deploy cert-manager
deploy_cert_manager() {
    print_status "Deploying cert-manager..."

    # Add cert-manager repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update

    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --version v1.13.0 \
        --set installCRDs=true \
        --wait

    print_status "Cert-manager deployed ✓"
}

# Deploy ingress-nginx
deploy_ingress() {
    print_status "Deploying ingress-nginx..."

    # Add ingress-nginx repository
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update

    # Install ingress-nginx
    helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.metrics.enabled=true \
        --set controller.podAnnotations."prometheus\.io/scrape"="true" \
        --set controller.podAnnotations."prometheus\.io/port"="10254" \
        --set controller.service.type=LoadBalancer \
        --wait

    print_status "Ingress-nginx deployed ✓"
}

# Deploy databases
deploy_databases() {
    print_status "Deploying databases..."

    # Apply PostgreSQL
    kubectl apply -f deployment/kubernetes/postgres.yaml -n ${NAMESPACE}

    # Apply Redis
    kubectl apply -f deployment/kubernetes/redis.yaml -n ${NAMESPACE}

    # Apply ChromaDB
    kubectl apply -f deployment/kubernetes/chromadb.yaml -n ${NAMESPACE}

    print_status "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=ready pod -l app=chromadb -n ${NAMESPACE} --timeout=300s

    print_status "Databases deployed ✓"
}

# Deploy backend services
deploy_backend() {
    print_status "Deploying backend services..."

    # Apply backend deployment
    kubectl apply -f deployment/kubernetes/backend.yaml -n ${NAMESPACE}

    # Apply Celery workers
    kubectl apply -f deployment/kubernetes/celery-worker.yaml -n ${NAMESPACE}

    print_status "Waiting for backend to be ready..."
    kubectl wait --for=condition=ready pod -l app=upm-plus-backend -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=ready pod -l app=upm-plus-celery-worker -n ${NAMESPACE} --timeout=300s

    print_status "Backend services deployed ✓"
}

# Deploy frontend
deploy_frontend() {
    print_status "Deploying frontend..."

    # Apply frontend deployment
    kubectl apply -f deployment/kubernetes/frontend.yaml -n ${NAMESPACE}

    print_status "Waiting for frontend to be ready..."
    kubectl wait --for=condition=ready pod -l app=upm-plus-frontend -n ${NAMESPACE} --timeout=300s

    print_status "Frontend deployed ✓"
}

# Configure SSL and ingress
configure_ssl() {
    print_status "Configuring SSL and ingress..."

    # Apply cert-manager certificate
    kubectl apply -f deployment/production/cert-manager-production.yaml -n ${NAMESPACE}

    # Apply domain-specific ingress
    kubectl apply -f deployment/production/upm.plus-domain.yaml -n ${NAMESPACE}

    print_status "SSL and ingress configured ✓"
}

# Deploy monitoring
deploy_monitoring() {
    print_status "Deploying monitoring..."

    # Apply monitoring stack
    kubectl apply -f deployment/kubernetes/monitoring.yaml -n ${NAMESPACE}

    print_status "Monitoring deployed ✓"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."

    # Get backend pod name
    BACKEND_POD=$(kubectl get pods -l app=upm-plus-backend -n ${NAMESPACE} -o jsonpath='{.items[0].metadata.name}')

    # Run migrations
    kubectl exec ${BACKEND_POD} -n ${NAMESPACE} -- alembic upgrade head

    print_status "Database migrations completed ✓"
}

# Verify deployment
verify_deployment() {
    print_status "Verifying deployment..."

    # Check all pods are running
    kubectl get pods -n ${NAMESPACE}

    # Check services
    kubectl get services -n ${NAMESPACE}

    # Check ingress
    kubectl get ingress -n ${NAMESPACE}

    # Wait for SSL certificate
    print_status "Waiting for SSL certificate..."
    kubectl wait --for=condition=ready certificate/upm-plus-production-wildcard -n ${NAMESPACE} --timeout=600s

    print_status "Deployment verification completed ✓"
}

# Show deployment summary
show_summary() {
    print_status "🎉 UPM.Plus Production Deployment Complete!"
    echo ""
    echo -e "${BLUE}Deployment Summary:${NC}"
    echo -e "  Domain: ${GREEN}https://upm.plus${NC}"
    echo -e "  API: ${GREEN}https://api.upm.plus${NC}"
    echo -e "  App: ${GREEN}https://app.upm.plus${NC}"
    echo -e "  Dashboard: ${GREEN}https://dashboard.upm.plus${NC}"
    echo -e "  Namespace: ${YELLOW}${NAMESPACE}${NC}"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo -e "  View pods: ${YELLOW}kubectl get pods -n ${NAMESPACE}${NC}"
    echo -e "  View logs: ${YELLOW}kubectl logs -f deployment/upm-plus-backend -n ${NAMESPACE}${NC}"
    echo -e "  Check certificate: ${YELLOW}kubectl get certificate -n ${NAMESPACE}${NC}"
    echo -e "  Access Grafana: ${YELLOW}kubectl port-forward svc/grafana 3000:3000 -n ${NAMESPACE}${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Configure your domain DNS to point to the LoadBalancer IP"
    echo "  2. Test the application by visiting https://upm.plus"
    echo "  3. Set up monitoring and alerting"
    echo "  4. Configure backup strategies"
    echo "  5. Review security configurations"
}

# Main deployment flow
main() {
    echo -e "${BLUE}Starting production deployment for ${DOMAIN}${NC}"
    echo ""

    # Confirmation prompt
    read -p "This will deploy UPM.Plus to production. Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 1
    fi

    # Run deployment steps
    check_prerequisites
    create_namespace
    create_secrets
    deploy_cert_manager
    deploy_ingress
    deploy_databases
    deploy_backend
    deploy_frontend
    configure_ssl
    deploy_monitoring
    run_migrations
    verify_deployment
    show_summary
}

# Error handling
trap 'print_error "Deployment failed! Check the logs above for details."' ERR

# Run main function
main "$@"