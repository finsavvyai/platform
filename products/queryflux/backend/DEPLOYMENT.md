# QueryFlux Backend - Deployment Guide

This guide covers building, testing, and deploying the QueryFlux backend service.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Building](#building)
4. [Testing](#testing)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Helm Deployment](#helm-deployment)
8. [Environment Configuration](#environment-configuration)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Development Environment
- Go 1.24+
- Docker 20.10+
- Git
- Make (optional)

### Deployment Tools
- Kubernetes cluster (minikube, kind, or cloud provider)
- Helm 3.0+
- kubectl configured for cluster access
- Container registry access (Docker Hub, ECR, GCR, etc.)

### Required Services
- PostgreSQL 13+ (primary database)
- Redis 6+ (caching and sessions)
- Object storage (S3, GCS, Azure Blob)

## Local Development

### 1. Clone Repository
```bash
git clone https://github.com/queryflux/backend.git
cd backend
```

### 2. Install Dependencies
```bash
go mod download
go mod verify
```

### 3. Environment Setup
Create environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/queryflux

# Redis
REDIS_URL=redis://localhost:6379

# Application
GIN_MODE=debug
LOG_LEVEL=debug
ENVIRONMENT=development

# Security
JWT_SECRET=your-super-secret-jwt-key
API_SECRET=your-api-secret-key

# External Services
OPENAI_API_KEY=your-openai-api-key
LEMONSQUEZY_API_KEY=your-lemonsqueezy-key
```

### 4. Run Database Migrations
```bash
go run ./cmd/migrate up
```

### 5. Start the Server
```bash
go run ./cmd/server
```

The server will start on `http://localhost:8080`

## Building

### Development Build
```bash
go build -o queryflux-backend ./cmd/server
```

### Production Build (Multiple Platforms)
```bash
./scripts/build.sh -r
```

### Custom Build
```bash
./scripts/build.sh -v 1.0.0 -p linux/amd64,linux/arm64,darwin/amd64
```

### Build Options
- `-v, --version`: Set version string
- `-b, --binary`: Set binary name (default: queryflux-backend)
- `-o, --output`: Set output directory (default: dist)
- `-p, --platforms`: Set target platforms (comma-separated)
- `-r, --release`: Build for release

## Testing

### Run All Tests
```bash
go test -v ./...
```

### Run Tests with Coverage
```bash
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### Run Benchmarks
```bash
go test -bench=. -benchmem ./...
```

### Run Integration Tests
```bash
go test -tags=integration ./tests/integration/...
```

### Security Scan
```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
govulncheck ./...
```

### Linting
```bash
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
golangci-lint run
```

## Docker Deployment

### Build Docker Image
```bash
docker build -t queryflux/backend:latest .
```

### Build with Custom Version
```bash
docker build --build-arg VERSION=1.0.0 -t queryflux/backend:1.0.0 .
```

### Run Docker Container
```bash
docker run -p 8080:8080 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e JWT_SECRET=your-secret \
  queryflux/backend:latest
```

### Run with Docker Compose
```bash
docker-compose up -d
```

## Kubernetes Deployment

### 1. Prepare Configuration
```bash
# Create namespace
kubectl create namespace queryflux

# Create ConfigMap
kubectl create configmap queryflux-config \
  --from-file=configs/ \
  --namespace=queryflux

# Create Secrets
kubectl create secret generic queryflux-secrets \
  --from-literal=database-url=postgresql://... \
  --from-literal=jwt-secret=your-secret \
  --namespace=queryflux
```

### 2. Deploy with kubectl
```bash
# Deploy all manifests
kubectl apply -f k8s/production/

# Check deployment status
kubectl get pods -n queryflux
kubectl get services -n queryflux
```

### 3. Port Forward for Testing
```bash
kubectl port-forward -n queryflux service/queryflux-backend-service 8080:80
```

## Helm Deployment

### 1. Install Helm Chart
```bash
# From local chart
helm install queryflux-backend ./helm/queryflux \
  --namespace queryflux \
  --set image.tag=1.0.0 \
  --set config.environment=production

# From remote repository
helm repo add queryflux-charts https://charts.queryflux.com
helm install queryflux-backend queryflux-charts/queryflux \
  --namespace queryflux \
  --set image.tag=1.0.0
```

### 2. Deploy to Staging
```bash
helm upgrade --install queryflux-backend ./helm/queryflux \
  --namespace queryflux-staging \
  --set image.tag=staging \
  --set config.environment=staging \
  --set replicaCount=2 \
  --set resources.requests.memory=256Mi \
  --set resources.requests.cpu=250m
```

### 3. Deploy to Production
```bash
helm upgrade --install queryflux-backend ./helm/queryflux \
  --namespace queryflux \
  --set image.tag=1.0.0 \
  --set config.environment=production \
  --set replicaCount=3 \
  --set resources.requests.memory=512Mi \
  --set resources.requests.cpu=500m \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=api.queryflux.com
```

### 4. Upgrade with Values File
```bash
helm upgrade --install queryflux-backend ./helm/queryflux \
  --namespace queryflux \
  -f values-production.yaml \
  --set image.tag=1.0.0
```

### 5. Rollback
```bash
helm rollback queryflux-backend -n queryflux
```

### 6. Uninstall
```bash
helm uninstall queryflux-backend -n queryflux
```

## Environment Configuration

### Development Environment
```yaml
# values-development.yaml
replicaCount: 1
config:
  environment: development
  ginMode: debug
  logLevel: debug
resources:
  requests:
    memory: 256Mi
    cpu: 250m
  limits:
    memory: 512Mi
    cpu: 500m
```

### Staging Environment
```yaml
# values-staging.yaml
replicaCount: 2
config:
  environment: staging
  ginMode: release
  logLevel: info
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5
  targetCPUUtilizationPercentage: 70
resources:
  requests:
    memory: 512Mi
    cpu: 500m
  limits:
    memory: 1Gi
    cpu: 1000m
```

### Production Environment
```yaml
# values-production.yaml
replicaCount: 3
config:
  environment: production
  ginMode: release
  logLevel: warn
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "1000"
  hosts:
    - host: api.queryflux.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: queryflux-tls
      hosts:
        - api.queryflux.com
resources:
  requests:
    memory: 1Gi
    cpu: 1000m
  limits:
    memory: 2Gi
    cpu: 2000m
```

## Monitoring

### Health Checks
- **Health Endpoint**: `/health` - Basic health status
- **Ready Endpoint**: `/ready` - Readiness probe
- **Metrics Endpoint**: `/metrics` - Prometheus metrics

### Prometheus Monitoring
```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: queryflux-backend
  namespace: queryflux
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: queryflux
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

### Log Collection
```yaml
# Fluent Bit configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
data:
  fluent-bit.conf: |
    [INPUT]
        Name tail
        Path /var/log/containers/*queryflux*.log
        Parser docker
        Tag queryflux.*

    [OUTPUT]
        Name stdout
        Match *
```

## Deployment Scripts

### Automated Deployment
```bash
# Deploy to staging
./scripts/deploy.sh -e staging -v 1.0.0

# Deploy to production
./scripts/deploy.sh -e production -v 1.0.0

# Deploy with custom namespace
./scripts/deploy.sh -e production -n queryflux-prod -v 1.0.0
```

### Build and Deploy
```bash
# Build and deploy in one command
./scripts/build.sh -r && ./scripts/deploy.sh -e production
```

## Security

### Container Security
- Non-root user (UID 1001)
- Read-only root filesystem
- Minimal attack surface
- Security context constraints

### Network Security
- Network policies enabled
- TLS encryption for external traffic
- Internal service communication

### Secrets Management
- Kubernetes secrets for sensitive data
- Environment-specific configurations
- Regular secret rotation

## Performance

### Resource Optimization
- Binary size optimization with build flags
- Memory usage monitoring
- CPU utilization scaling
- Horizontal pod autoscaling

### Database Optimization
- Connection pooling
- Query optimization
- Index recommendations
- Caching strategies

## Troubleshooting

### Common Issues

#### Pod Fails to Start
```bash
# Check pod logs
kubectl logs -n queryflux deployment/queryflux-backend

# Check pod status
kubectl describe pod -n queryflux -l app=queryflux-backend

# Check events
kubectl get events -n queryflux --sort-by='.lastTimestamp'
```

#### Database Connection Issues
```bash
# Check database connectivity
kubectl exec -n queryflux -it deployment/queryflux-backend -- \
  nc -zv postgresql.database.svc.cluster.local 5432

# Check database logs
kubectl logs -n postgresql deployment/postgresql
```

#### High Memory Usage
```bash
# Check resource usage
kubectl top pods -n queryflux

# Check memory leaks
kubectl exec -n queryflux -it deployment/queryflux-backend -- \
  pmap -x 1
```

#### Health Check Failures
```bash
# Check health endpoint
kubectl exec -n queryflux -it deployment/queryflux-backend -- \
  curl -f http://localhost:8080/health

# Check service connectivity
kubectl port-forward -n queryflux service/queryflux-backend-service 8080:80
curl -f http://localhost:8080/health
```

### Debug Commands
```bash
# Access pod shell
kubectl exec -n queryflux -it deployment/queryflux-backend -- /bin/sh

# Port forward service
kubectl port-forward -n queryflux service/queryflux-backend-service 8080:80

# View configuration
kubectl get configmap queryflux-config -n queryflux -o yaml

# View secrets (masked)
kubectl get secret queryflux-secrets -n queryflux -o yaml
```

## CI/CD Integration

### GitHub Actions
- Automated testing on push/PR
- Multi-platform builds
- Docker image publishing
- Helm chart deployment
- Security scanning

### GitLab CI
- Pipeline as Code
- Auto-deployment to staging
- Manual approval for production
- Rollback capabilities

### Jenkins
- Declarative pipelines
- Blue-green deployment
- Canary releases
- Performance testing

## Best Practices

### Development
- Use environment variables for configuration
- Implement proper error handling
- Write comprehensive tests
- Use structured logging

### Deployment
- Use immutable infrastructure
- Implement zero-downtime deployments
- Monitor all deployments
- Have rollback strategies

### Security
- Regular security audits
- Keep dependencies updated
- Use least privilege principle
- Encrypt sensitive data

### Performance
- Monitor resource usage
- Optimize database queries
- Implement caching strategies
- Use connection pooling

---

For more information, see:
- [API Documentation](https://docs.queryflux.com/api)
- [Architecture Guide](https://docs.queryflux.com/architecture)
- [Monitoring Guide](https://docs.queryflux.com/monitoring)