# UDP Cloud Deployment Guide

This guide provides comprehensive instructions for deploying the Universal Dependency Platform (UDP) in cloud environments using Kubernetes, CI/CD pipelines, and cloud-native best practices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
6. [Cloud Provider Specific Guides](#cloud-provider-specific-guides)
7. [Plugin Configuration](#plugin-configuration)
8. [Monitoring and Observability](#monitoring-and-observability)
9. [Security Configuration](#security-configuration)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- Docker 20.10+
- Kubernetes 1.24+
- kubectl
- Helm 3.8+
- kustomize 4.5+

### Cloud Provider CLIs (choose one)

- AWS CLI 2.0+ (for EKS)
- gcloud CLI (for GKE)
- Azure CLI (for AKS)

### Container Registry Access

Ensure you have access to push/pull images from:
- GitHub Container Registry (ghcr.io)
- Docker Hub
- AWS ECR / Google GCR / Azure ACR

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/universaldependency/udp.git
cd udp

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Local Development with Docker

```bash
# Start development environment
docker-compose -f docker-compose.cloud.yml up -d

# Check health
curl http://localhost:8000/health
```

### 3. Build Production Images

```bash
# Build all images
docker build -f Dockerfile.cloud --target production -t udp/api:latest .
docker build -f Dockerfile.cloud --target celery-worker -t udp/worker:latest .
docker build -f Dockerfile.cloud --target celery-beat -t udp/beat:latest .
```

## Docker Deployment

### Using Docker Compose (Production)

```bash
# Set environment variables
export VERSION=v1.0.0
export POSTGRES_PASSWORD=your-secure-password
export SECRET_KEY=your-secret-key-32-chars-minimum
export GRAFANA_PASSWORD=your-grafana-password

# Deploy with production configuration
docker-compose -f docker-compose.cloud.yml up -d

# Scale workers
docker-compose -f docker-compose.cloud.yml up -d --scale udp-worker=5
```

### Environment Variables

Required environment variables for cloud deployment:

```bash
# Application
ENVIRONMENT=production
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379/0
SECRET_KEY=your-secret-key

# Security
CORS_ORIGINS=["https://app.universaldependency.com"]

# Monitoring
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

## Kubernetes Deployment

### Method 1: Using Helm Charts (Recommended)

```bash
# Add UDP Helm repository (when available)
helm repo add udp https://charts.universaldependency.com
helm repo update

# Install with custom values
helm install udp udp/udp \
  --namespace udp-prod \
  --create-namespace \
  --values k8s/charts/udp/values-production.yaml

# Upgrade
helm upgrade udp udp/udp \
  --namespace udp-prod \
  --values k8s/charts/udp/values-production.yaml
```

#### Custom Values Example

```yaml
# values-production.yaml
global:
  imageRegistry: "ghcr.io"

api:
  replicaCount: 5
  resources:
    limits:
      cpu: 2000m
      memory: 2Gi

worker:
  replicaCount: 10
  autoscaling:
    enabled: true
    maxReplicas: 50

postgresql:
  auth:
    postgresPassword: "your-secure-password"
  persistence:
    size: 200Gi

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: "your-grafana-password"
```

### Method 2: Using Kustomize

```bash
# Development
kubectl apply -k k8s/overlays/development

# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

### Method 3: Raw Manifests

```bash
# Apply base configuration
kubectl apply -f k8s/base/

# Check deployment status
kubectl get pods -n udp-system
kubectl get services -n udp-system
```

## CI/CD Pipeline Setup

### GitHub Actions

The repository includes comprehensive GitHub Actions workflows:

```yaml
# .github/workflows/ci-cd.yml
# - Security scanning
# - Testing (unit, integration, e2e)
# - Multi-architecture Docker builds
# - Kubernetes deployments
# - Performance testing
```

Required secrets:

```bash
# Container Registry
GITHUB_TOKEN=ghp_xxx

# Kubernetes Access
KUBE_CONFIG_DEV=base64-encoded-kubeconfig
KUBE_CONFIG_STAGING=base64-encoded-kubeconfig
KUBE_CONFIG_PROD=base64-encoded-kubeconfig

# Application Secrets
SECRET_KEY=your-secret-key
POSTGRES_PASSWORD=your-db-password
```

### GitLab CI/CD

```bash
# Copy GitLab CI configuration
cp ci-cd/gitlab/.gitlab-ci.yml .gitlab-ci.yml
```

Required GitLab variables:

```bash
KUBE_CONFIG_DEV=base64-encoded-kubeconfig
KUBE_CONFIG_STAGING=base64-encoded-kubeconfig
KUBE_CONFIG_PROD=base64-encoded-kubeconfig
SECRET_KEY=your-secret-key
POSTGRES_PASSWORD=your-db-password
```

### Jenkins

```bash
# Copy Jenkinsfile
cp ci-cd/jenkins/Jenkinsfile .

# Configure Jenkins credentials:
# - docker-registry (username/password)
# - kube-config-dev (secret file)
# - kube-config-staging (secret file)
# - kube-config-prod (secret file)
```

### Azure DevOps

```bash
# Copy Azure Pipelines configuration
cp ci-cd/azure-devops/azure-pipelines.yml .

# Configure service connections:
# - Container registry connection
# - Kubernetes service connection
# - Variable groups for secrets
```

### AWS CodeBuild

```bash
# Copy buildspec
cp ci-cd/aws-codebuild/buildspec.yml .

# Configure environment variables:
# - AWS_ACCOUNT_ID
# - IMAGE_REPO_NAME
# - EKS_CLUSTER_NAME
```

### Google Cloud Build

```bash
# Copy Cloud Build configuration
cp ci-cd/gcp-cloudbuild/cloudbuild.yaml .

# Configure substitutions:
# - _GKE_CLUSTER
# - _GKE_LOCATION
```

## Cloud Provider Specific Guides

### Amazon Web Services (AWS)

#### EKS Cluster Setup

```bash
# Create EKS cluster
eksctl create cluster \
  --name udp-prod \
  --region us-west-2 \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 10 \
  --node-type m5.large

# Configure kubectl
aws eks update-kubeconfig --region us-west-2 --name udp-prod

# Install AWS Load Balancer Controller
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.12.0/cert-manager.yaml
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=udp-prod
```

#### ECR Registry

```bash
# Create ECR repositories
aws ecr create-repository --repository-name udp/api
aws ecr create-repository --repository-name udp/worker
aws ecr create-repository --repository-name udp/beat

# Get login token
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin \
  123456789012.dkr.ecr.us-west-2.amazonaws.com
```

### Google Cloud Platform (GCP)

#### GKE Cluster Setup

```bash
# Create GKE cluster
gcloud container clusters create udp-prod \
  --region us-central1 \
  --num-nodes 3 \
  --min-nodes 1 \
  --max-nodes 10 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --enable-autorepair \
  --enable-network-policy

# Configure kubectl
gcloud container clusters get-credentials udp-prod --region us-central1

# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

#### GCR Registry

```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Tag and push images
docker tag udp/api:latest gcr.io/your-project/udp/api:latest
docker push gcr.io/your-project/udp/api:latest
```

### Microsoft Azure (Azure)

#### AKS Cluster Setup

```bash
# Create resource group
az group create --name udp-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group udp-rg \
  --name udp-prod \
  --node-count 3 \
  --min-count 1 \
  --max-count 10 \
  --enable-cluster-autoscaler \
  --node-vm-size Standard_D2s_v3

# Configure kubectl
az aks get-credentials --resource-group udp-rg --name udp-prod

# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx
```

#### ACR Registry

```bash
# Create ACR
az acr create --resource-group udp-rg --name udpregistry --sku Basic

# Attach ACR to AKS
az aks update --resource-group udp-rg --name udp-prod --attach-acr udpregistry

# Login to ACR
az acr login --name udpregistry
```

## Plugin Configuration

### Cloud-Native Plugin Deployment

Plugins are configured to work seamlessly in cloud environments:

```yaml
# plugin-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: udp-plugin-config
data:
  npm_config.json: |
    {
      "udp_service_url": "http://udp-api-service:8000",
      "cache_enabled": true,
      "cache_ttl": 3600,
      "registry_url": "https://registry.npmjs.org",
      "auth_token": "${UDP_API_TOKEN}"
    }
```

### Plugin Registry Configuration

```bash
# Configure plugin registry
export UDP_PLUGIN_REGISTRY=ghcr.io/universaldependency/plugins

# Pull and run a plugin
docker run --rm \
  -e UDP_SERVICE_URL=https://api.universaldependency.com \
  -e UDP_API_TOKEN=your-token \
  ${UDP_PLUGIN_REGISTRY}/npm-analyzer:latest \
  analyze package.json
```

## Monitoring and Observability

### Prometheus and Grafana Setup

```bash
# Install monitoring stack with Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### Jaeger Tracing

```bash
# Install Jaeger
kubectl create namespace observability
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/download/v1.47.0/jaeger-operator.yaml -n observability

# Create Jaeger instance
kubectl apply -f - <<EOF
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: udp-jaeger
  namespace: udp-system
spec:
  strategy: production
  storage:
    type: elasticsearch
EOF
```

### Log Aggregation with ELK Stack

```bash
# Install Elasticsearch
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch \
  --namespace logging \
  --create-namespace

# Install Kibana
helm install kibana elastic/kibana --namespace logging

# Install Logstash
helm install logstash elastic/logstash --namespace logging
```

## Security Configuration

### TLS/SSL Certificates

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.12.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@universaldependency.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### Network Policies

```bash
# Apply network policies
kubectl apply -f k8s/base/ingress.yaml
```

### Secret Management

```bash
# Create secrets
kubectl create secret generic udp-secrets \
  --from-literal=SECRET_KEY=your-secret-key \
  --from-literal=DATABASE_URL=postgresql://user:pass@host:5432/db \
  --from-literal=REDIS_URL=redis://host:6379/0 \
  --namespace udp-system

# Use external secret managers (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager)
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets-system \
  --create-namespace
```

## Troubleshooting

### Common Issues

#### 1. Pod Not Starting

```bash
# Check pod status
kubectl get pods -n udp-system
kubectl describe pod <pod-name> -n udp-system
kubectl logs <pod-name> -n udp-system

# Check resource constraints
kubectl top pods -n udp-system
kubectl top nodes
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql postgresql://user:pass@postgres-service:5432/db

# Check database service
kubectl get svc postgres-service -n udp-system
kubectl describe svc postgres-service -n udp-system
```

#### 3. Ingress Not Working

```bash
# Check ingress configuration
kubectl get ingress -n udp-system
kubectl describe ingress udp-ingress -n udp-system

# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

#### 4. Performance Issues

```bash
# Check resource usage
kubectl top pods -n udp-system
kubectl top nodes

# Check HPA status
kubectl get hpa -n udp-system
kubectl describe hpa udp-api-hpa -n udp-system

# Scale manually if needed
kubectl scale deployment udp-api --replicas=10 -n udp-system
```

### Monitoring and Alerts

```bash
# Check application health
curl https://api.universaldependency.com/health

# View metrics
curl https://api.universaldependency.com/metrics

# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
```

### Support and Documentation

- **Documentation**: https://docs.universaldependency.com
- **GitHub Issues**: https://github.com/universaldependency/udp/issues
- **Community Slack**: https://universaldependency.slack.com
- **Support Email**: support@universaldependency.com

## Next Steps

1. **Custom Plugin Development**: See [Plugin Development Guide](PLUGIN_DEVELOPMENT.md)
2. **API Integration**: See [API Documentation](API_DOCUMENTATION.md)
3. **Advanced Configuration**: See [Advanced Configuration Guide](ADVANCED_CONFIGURATION.md)
4. **Performance Tuning**: See [Performance Tuning Guide](PERFORMANCE_TUNING.md)