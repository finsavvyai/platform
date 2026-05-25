# UPM.Plus AutomationHub Deployment Guide

This guide provides comprehensive instructions for deploying the UPM.Plus AutomationHub platform to various environments including staging, production, and development setups.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment Methods](#deployment-methods)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring and Logging](#monitoring-and-logging)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Overview

The UPM.Plus AutomationHub supports multiple deployment strategies:

1. **Docker Compose** - Ideal for staging and single-host deployments
2. **Kubernetes** - Recommended for production and multi-node clusters
3. **Cloudflare Workers** - Edge computing for API services
4. **CI/CD Pipeline** - Automated deployments via GitHub Actions

### Architecture Components

- **Backend API** - FastAPI application with Python 3.11
- **Frontend** - React TypeScript application
- **Database** - PostgreSQL 15 with connection pooling
- **Cache** - Redis 7 for caching and session storage
- **Task Queue** - Celery with Redis broker
- **Reverse Proxy** - Nginx for SSL termination and load balancing
- **Monitoring** - Prometheus and Grafana stack

## Prerequisites

### System Requirements

- **CPU**: 4+ cores for production, 2+ cores for staging
- **RAM**: 8GB+ for production, 4GB+ for staging
- **Storage**: 50GB+ SSD for production, 20GB+ for staging
- **Network**: 1Gbps+ connection for production

### Software Dependencies

- Docker 24.0+
- Docker Compose 2.0+
- Kubernetes 1.28+ (for K8s deployments)
- kubectl 1.28+ (for K8s deployments)
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)

### External Services

- **GitHub Container Registry** (ghcr.io) for Docker images
- **Cloudflare** for DNS and edge services (optional)
- **Slack** for deployment notifications (optional)
- **Sentry** for error monitoring (recommended)

## Environment Configuration

### Environment Files

Create environment-specific configuration files:

```bash
# Development
cp .env.example .env.development

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_PASSWORD=secure_password

# Redis Configuration
REDIS_URL=redis://host:6379/0
REDIS_PASSWORD=secure_redis_password

# Security
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_here

# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Monitoring
SENTRY_DSN=your_sentry_dsn
GRAFANA_PASSWORD=secure_grafana_password

# Application
ENVIRONMENT=production
DEBUG=false
```

### Secret Management

For production deployments, use secure secret management:

1. **Kubernetes Secrets**
   ```bash
   kubectl create secret generic upm-plus-secrets \
     --from-literal=DATABASE_URL="..." \
     --from-literal=SECRET_KEY="..." \
     --from-literal=OPENAI_API_KEY="..."
   ```

2. **Docker Secrets** (Swarm mode)
   ```bash
   echo "secret_value" | docker secret create secret_name -
   ```

3. **Cloudflare Workers Secrets**
   ```bash
   wrangler secret put SECRET_NAME
   ```

## Deployment Methods

### 1. Docker Compose Deployment

#### Quick Start

```bash
# Clone repository
git clone <repository-url>
cd automationhub

# Configure environment
cp .env.example .env.staging
# Edit .env.staging with your values

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

#### Manual Docker Compose

```bash
# Build images
docker build -t upm-plus-automationhub/backend:latest .
docker build -f Dockerfile.frontend -t upm-plus-automationhub/frontend:latest .

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Kubernetes Deployment

#### Prerequisites

- Kubernetes cluster (v1.28+)
- kubectl configured
- Ingress controller (nginx or traefik)
- Persistent volume provisioner

#### Deployment Steps

```bash
# Create namespace
kubectl create namespace upm-plus-production

# Apply secrets
kubectl apply -f deployment/kubernetes/secrets.yaml -n upm-plus-production

# Apply configurations
kubectl apply -f deployment/kubernetes/configmaps.yaml -n upm-plus-production

# Deploy applications
kubectl apply -f deployment/kubernetes/ -n upm-plus-production

# Check deployment status
kubectl get pods -n upm-plus-production
kubectl get services -n upm-plus-production

# Check rollout status
kubectl rollout status deployment/upm-plus-backend -n upm-plus-production
```

#### Kubernetes Components

- **Deployments**: Backend, Frontend, Celery Worker, Celery Beat
- **Services**: Load balancers and internal cluster communication
- **ConfigMaps**: Application configuration
- **Secrets**: Sensitive data (API keys, passwords)
- **PersistentVolumes**: Database and file storage
- **Ingress**: External access and SSL termination

### 3. Cloudflare Workers Deployment

#### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Cloudflare API token

#### Deployment Steps

```bash
# Install dependencies
cd cloudflare-workers
npm install

# Configure environment
cp wrangler.example.toml wrangler.toml
# Edit wrangler.toml with your configuration

# Set secrets
echo "database_url" | wrangler secret put DATABASE_URL
echo "jwt_secret" | wrangler secret put JWT_SECRET

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## CI/CD Pipeline

### GitHub Actions Workflow

The project includes a comprehensive CI/CD pipeline (`.github/workflows/ci-cd.yml`) that:

1. **Quality Checks**
   - Linting and formatting
   - Type checking
   - Security scanning

2. **Testing**
   - Backend unit and integration tests
   - Frontend tests and coverage
   - Performance tests

3. **Build and Deploy**
   - Docker image building and pushing
   - Staging deployments (on develop branch)
   - Production deployments (on releases)

4. **Post-Deployment**
   - Health checks
   - Integration tests
   - Slack notifications

### Required GitHub Secrets

Configure these secrets in your GitHub repository:

- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `SECRET_KEY` - Application secret
- `JWT_SECRET_KEY` - JWT signing secret
- `SENTRY_DSN` - Sentry error tracking
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `SLACK_WEBHOOK` - Slack notifications webhook
- `KUBE_CONFIG_STAGING` - Kubernetes config for staging
- `KUBE_CONFIG_PRODUCTION` - Kubernetes config for production

### Deployment Triggers

- **Staging**: Push to `develop` branch
- **Production**: Create/release GitHub release
- **Security Scans**: Daily scheduled runs

## Monitoring and Logging

### Health Checks

All services include health checks:

```bash
# Backend health
curl https://api.upm.plus/health

# Frontend health
curl https://upm.plus/health

# Service health
docker-compose -f docker-compose.prod.yml ps
```

### Monitoring Stack

- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Visualization and dashboards (port 3001)
- **Custom dashboards**: Application-specific metrics

### Log Aggregation

Logs are collected and aggregated:

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f backend

# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# Kubernetes logs
kubectl logs -f deployment/upm-plus-backend -n upm-plus-production
```

### Key Metrics to Monitor

- Application response time
- Error rates
- Database connection pool usage
- Redis memory usage
- Celery queue length
- CPU and memory utilization

## Rollback Procedures

### Quick Rollback

```bash
# Using deployment script
./scripts/deploy.sh production rollback

# Manual Docker Compose rollback
docker-compose -f docker-compose.prod.yml down
# Restore previous docker-compose.yml and start again

# Kubernetes rollback
kubectl rollout undo deployment/upm-plus-backend -n upm-plus-production
kubectl rollout undo deployment/upm-plus-frontend -n upm-plus-production
```

### Blue-Green Deployment

Production deployments use blue-green strategy:

1. **Blue**: Current production version
2. **Green**: New version being deployed
3. **Switch**: Traffic routed to green after health checks
4. **Rollback**: Instant rollback to blue if issues detected

### Database Rollbacks

For database changes:

1. **Backup before deployment**
   ```bash
   pg_dump upmplus > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Rollback migrations**
   ```bash
   cd backend
   alembic downgrade -1
   ```

3. **Restore from backup** (if needed)
   ```bash
   psql upmplus < backup_20240101_120000.sql
   ```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check container logs
docker logs <container_name>

# Check resource usage
docker stats

# Verify environment variables
docker exec <container_name> env | grep -E "(DATABASE|REDIS)"
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
docker exec -it backend python -c "
from app.core.database import engine
try:
    with engine.connect() as conn:
        print('Database connection successful')
except Exception as e:
    print(f'Database error: {e}')
"

# Check database logs
docker logs postgres
```

#### 3. Redis Connection Issues

```bash
# Test Redis connectivity
docker exec -it redis redis-cli ping

# Check Redis logs
docker logs redis
```

#### 4. High Memory Usage

```bash
# Check memory usage by service
docker stats --no-stream

# Restart services if needed
docker-compose -f docker-compose.prod.yml restart <service_name>
```

#### 5. Slow API Response

```bash
# Check application logs for errors
docker-compose -f docker-compose.prod.yml logs -f backend

# Monitor database queries
# Enable query logging in PostgreSQL for debugging

# Check network connectivity
docker exec backend curl -w "@curl-format.txt" -o /dev/null -s http://frontend:80/health
```

### Performance Tuning

#### Database Optimization

```sql
-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'users';
```

#### Redis Optimization

```bash
# Check Redis memory usage
redis-cli info memory

# Monitor Redis performance
redis-cli --latency-history
```

### Security Considerations

1. **Regular Updates**: Keep all images and dependencies updated
2. **Secret Rotation**: Rotate API keys and passwords regularly
3. **Network Security**: Use firewalls and network policies
4. **SSL/TLS**: Enforce HTTPS for all external communications
5. **Access Control**: Implement RBAC for Kubernetes and databases

### Support and Escalation

1. **Check logs** for error messages and stack traces
2. **Review monitoring dashboards** for system health
3. **Consult documentation** for specific service issues
4. **Create GitHub issue** for persistent problems
5. **Contact infrastructure team** for production emergencies

---

## Emergency Procedures

### Production Outage Response

1. **Assess impact** - Check monitoring dashboards
2. **Communicate** - Notify stakeholders via Slack
3. **Isolate** - Identify affected components
4. **Rollback** - Use blue-green rollback if needed
5. **Verify** - Confirm service restoration
6. **Document** - Record incident details

### Data Recovery

1. **Stop all services** to prevent further data corruption
2. **Assess backup status** - Identify latest good backup
3. **Restore database** from backup if needed
4. **Verify data integrity** with application checks
5. **Restart services** in correct order
6. **Monitor** for any recurring issues

For additional support or questions, refer to the project documentation or create an issue in the repository.