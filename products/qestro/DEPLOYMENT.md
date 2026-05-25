# Qestro Deployment Guide

This guide covers deploying Qestro to different environments: local development, staging, and production.

## Table of Contents

1. [Local Development](#local-development)
2. [Staging Deployment](#staging-deployment)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Database Management](#database-management)
7. [Monitoring and Health Checks](#monitoring-and-health-checks)
8. [Troubleshooting](#troubleshooting)

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 16
- Redis 7
- Docker (optional, for containerized services)

### Quick Start

```bash
# Clone repository
git clone https://github.com/qestro/qestro.git
cd qestro

# Install dependencies
npm install

# Start local environment with Docker Compose
docker-compose up -d

# Run database setup
bash scripts/setup-db.sh

# Start development servers
./start.sh dev
```

This will:
- Start PostgreSQL on port 5432
- Start Redis on port 6379
- Start backend API on port 8787
- Start frontend on port 3000

### Development Server URLs

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8787
- **Health Check:** http://localhost:8787/health
- **Demo Login:** test@qestro.io / testpassword123

### Database Setup

```bash
# Initialize database
bash scripts/setup-db.sh

# Environment variables
export DATABASE_URL="postgresql://qestro_user:password@localhost:5432/qestro"
export REDIS_URL="redis://localhost:6379"
```

## Staging Deployment

### Prerequisites

- AWS account with ECS/EKS access
- Kubernetes cluster (staging-k8s)
- RDS PostgreSQL instance
- ElastiCache Redis instance
- Docker registry access (ECR)

### Deployment Steps

1. **Prepare environment:**

```bash
# Create .env.staging file with secrets
cp .env.production.example .env.staging

# Edit with staging values
export ENVIRONMENT=staging
source .env.staging
```

2. **Build and push Docker images:**

```bash
# Using GitHub Actions (recommended)
# Push to main branch to trigger automated build

# Or manually build
./start.sh staging
```

3. **Deploy via Kubernetes:**

```bash
# Configure kubectl
aws eks update-kubeconfig --name qestro-staging --region us-west-2

# Apply deployments
kubectl apply -f k8s/staging/

# Check deployment status
kubectl rollout status deployment/qestro-backend -n staging
kubectl rollout status deployment/qestro-frontend -n staging
```

4. **Verify deployment:**

```bash
# Check pod status
kubectl get pods -n staging

# Check logs
kubectl logs -f deployment/qestro-backend -n staging

# Test API
curl https://staging-api.qestro.app/health
```

### Staging URLs

- **Frontend:** https://staging.qestro.app
- **API:** https://staging-api.qestro.app
- **Health:** https://staging-api.qestro.app/health

## Production Deployment

### Prerequisites

- AWS account with production access
- Production Kubernetes cluster
- RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis (Multi-AZ)
- WAF/CloudFront distribution
- SSL certificates
- Backup and disaster recovery setup

### Deployment Steps

1. **Pre-deployment checks:**

```bash
# Verify tests pass
npm run test
npm run test:e2e

# Build and verify
npm run build

# Check security
npm audit
```

2. **Create production secrets:**

```bash
# Use GitHub Secrets for sensitive data
# Set in GitHub repository settings:
# - PRODUCTION_AWS_ROLE_ARN
# - PRODUCTION_API_URL
# - PRODUCTION_DEPLOYMENT_URL
# - SLACK_WEBHOOK_URL
```

3. **Deploy via GitHub Actions:**

```bash
# Trigger deployment workflow
# Go to GitHub → Actions → Deploy
# Select environment: production
# Confirm deployment
```

4. **Manual deployment (if needed):**

```bash
# Configure kubectl
aws eks update-kubeconfig --name qestro-production --region us-west-2

# Create backup before deployment
kubectl create namespace production-backup-$(date +%Y%m%d-%H%M%S)

# Apply production deployments
kubectl apply -f k8s/production/

# Monitor rollout
kubectl rollout status deployment/qestro-backend -n production --timeout=10m
kubectl rollout status deployment/qestro-frontend -n production --timeout=10m
```

5. **Verify deployment:**

```bash
# Check pod status
kubectl get pods -n production

# Check logs
kubectl logs -f deployment/qestro-backend -n production

# Smoke tests
curl https://api.qestro.app/health
curl https://qestro.app

# Monitor metrics
kubectl top nodes
kubectl top pods -n production
```

### Production URLs

- **Frontend:** https://qestro.app
- **API:** https://api.qestro.app
- **Health:** https://api.qestro.app/health

### Rollback Procedure

```bash
# If deployment has issues, rollback to previous version
kubectl rollout undo deployment/qestro-backend -n production
kubectl rollout undo deployment/qestro-frontend -n production

# Verify rollback
kubectl rollout status deployment/qestro-backend -n production
```

## Docker Deployment

### Building Docker Images

```bash
# Build backend image
docker build -t qestro-backend:latest -f backend/Dockerfile .

# Build frontend image
docker build -t qestro-frontend:latest ./frontend

# Tag for registry
docker tag qestro-backend:latest gcr.io/project/qestro-backend:latest
docker tag qestro-frontend:latest gcr.io/project/qestro-frontend:latest

# Push to registry
docker push gcr.io/project/qestro-backend:latest
docker push gcr.io/project/qestro-frontend:latest
```

### Running with Docker Compose

```bash
# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Docker Compose Configuration

See `docker-compose.prod.yml` for:
- PostgreSQL 16 with persistent storage
- Redis 7 with persistence
- Backend API service
- Frontend service
- Health checks and networking

## Kubernetes Deployment

### Directory Structure

```
k8s/
├── staging/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-service.yaml
│   └── ingress.yaml
└── production/
    ├── namespace.yaml
    ├── configmap.yaml
    ├── secrets.yaml
    ├── backend-deployment.yaml
    ├── frontend-deployment.yaml
    ├── backend-service.yaml
    ├── frontend-service.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    └── pdb.yaml
```

### Creating Kubernetes Resources

```bash
# Create namespace
kubectl create namespace staging

# Create secrets
kubectl create secret generic qestro-secrets \
  --from-literal=DATABASE_URL=postgresql://... \
  --from-literal=REDIS_URL=redis://... \
  --from-literal=JWT_SECRET=... \
  -n staging

# Deploy applications
kubectl apply -f k8s/staging/

# Verify deployment
kubectl get deployments -n staging
kubectl get services -n staging
kubectl get ingress -n staging
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment qestro-backend --replicas=3 -n staging

# Horizontal Pod Autoscaler (HPA)
kubectl apply -f k8s/staging/hpa.yaml
kubectl get hpa -n staging
```

## Database Management

### Backup and Restore

```bash
# Backup database
pg_dump postgresql://user:pass@host:5432/qestro > backup.sql

# Restore database
psql postgresql://user:pass@host:5432/qestro < backup.sql

# Backup to S3
pg_dump postgresql://... | gzip | aws s3 cp - s3://bucket/backups/qestro-$(date +%Y%m%d).sql.gz
```

### Migrations

```bash
# Run migrations
cd backend
npm run db:migrate

# Create migration
npm run db:generate

# Rollback migration
npm run db:rollback
```

### Database Setup Script

```bash
# Run setup script
bash scripts/setup-db.sh

# Configure environment
export DATABASE_URL=postgresql://...
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=qestro
export DB_USER=qestro_user
export DB_PASSWORD=password
```

## Monitoring and Health Checks

### Health Check Endpoints

```bash
# Backend health
curl http://localhost:8000/health

# Response:
# {
#   "status": "healthy",
#   "timestamp": "2024-04-07T12:00:00Z",
#   "version": "1.0.0"
# }
```

### Kubernetes Health Checks

```yaml
# Liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 10

# Readiness probe
readinessProbe:
  httpGet:
    path: /health/ready
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Metrics and Logging

```bash
# Kubernetes metrics
kubectl top nodes
kubectl top pods -n staging

# View logs
kubectl logs deployment/qestro-backend -n staging
kubectl logs -f pod/qestro-backend-xyz -n staging

# Export logs
kubectl logs deployment/qestro-backend -n staging > backend.log
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check database connectivity
psql -h localhost -U qestro_user -d qestro -c "SELECT 1"

# Check environment variables
echo $DATABASE_URL
echo $REDIS_URL

# Verify firewall rules
telnet localhost 5432
```

#### 2. Pod CrashLoopBackOff

```bash
# Check pod logs
kubectl logs pod/qestro-backend-xyz -n staging

# Check resource limits
kubectl describe pod qestro-backend-xyz -n staging

# Check events
kubectl get events -n staging --sort-by='.lastTimestamp'
```

#### 3. Deployment Timeout

```bash
# Check image pull
kubectl describe deployment qestro-backend -n staging

# Check image registry access
docker login gcr.io
docker pull gcr.io/project/qestro-backend:latest

# Increase timeout
kubectl rollout status deployment/qestro-backend -n staging --timeout=15m
```

#### 4. High Memory Usage

```bash
# Check resource usage
kubectl top pods -n staging --containers

# Check memory limits
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].resources}{"\n"}{end}'

# Increase memory limit
kubectl set resources deployment qestro-backend -n staging --limits=memory=2Gi
```

### Debug Commands

```bash
# Execute command in pod
kubectl exec -it pod/qestro-backend-xyz -n staging -- /bin/sh

# Port forward
kubectl port-forward svc/qestro-backend 8000:8000 -n staging

# Stream logs with grep
kubectl logs -f deployment/qestro-backend -n staging | grep error

# Get deployment history
kubectl rollout history deployment/qestro-backend -n staging
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com)
- [Kubernetes Documentation](https://kubernetes.io/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [PostgreSQL Backup Guide](https://www.postgresql.org/docs/current/backup.html)
- [Redis Persistence](https://redis.io/docs/management/persistence/)
