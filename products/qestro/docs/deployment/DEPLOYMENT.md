# Questro Platform Deployment Guide

This comprehensive guide covers the deployment of the Questro AI-powered testing platform across various environments, from development to production.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Monitoring and Observability](#monitoring-and-observability)
- [Security Considerations](#security-considerations)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Overview

The Questro platform consists of multiple microservices that can be deployed using Docker Compose (for development/staging) or Kubernetes (for production).

### Architecture Components

- **Backend API**: Node.js/TypeScript REST API with Express.js
- **AI Service**: Python-based AI/ML service with OpenAI integration
- **Frontend**: React TypeScript web application
- **Mobile**: React Native iOS/Android applications
- **Database**: PostgreSQL with Redis caching
- **Message Queue**: RabbitMQ for asynchronous processing
- **Monitoring**: Prometheus, Grafana, and Loki
- **Load Balancer**: Nginx/Traefik with SSL termination

### Service Dependencies

```
Frontend → Backend API → Database (PostgreSQL)
           ↓              ↓
        AI Service ← → Redis Cache
           ↓              ↓
      Message Queue → Background Workers
```

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 4 cores
- Memory: 8GB RAM
- Storage: 50GB SSD
- Network: 100Mbps

**Recommended Requirements:**
- CPU: 8 cores
- Memory: 16GB RAM
- Storage: 100GB SSD
- Network: 1Gbps

### Required Software

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (for local development)
- Python 3.9+ (for AI service)
- kubectl 1.24+ (for Kubernetes deployment)
- Helm 3.8+ (for Kubernetes package management)

### Cloud Provider Setup

This guide supports deployment on:
- AWS (EKS, ECS, EC2)
- Google Cloud Platform (GKE, GCE)
- Microsoft Azure (AKS, VMs)
- DigitalOcean (DOK, Droplets)
- Any Kubernetes-compatible platform

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/questro/questro-platform.git
cd questro-platform
```

### 2. Environment Variables

Create environment files for different environments:

```bash
# Development
cp .env.example .env.development

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

### 3. SSL Certificates

For production, prepare SSL certificates:

```bash
mkdir -p certs/ssl
# Place your SSL certificates in certs/ssl/
# - questro-app.crt
# - questro-app.key
# - questro-api.crt
# - questro-api.key
```

## Local Development

### Quick Start

```bash
# Start all services
npm run dev:docker

# Or start with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### Development Workflow

1. **Backend Development**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Frontend Development**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **AI Service Development**:
   ```bash
   cd ai-service
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py
   ```

4. **Mobile Development**:
   ```bash
   cd mobile
   npm install
   # iOS
   cd ios && pod install && npx react-native run-ios
   # Android
   npx react-native run-android
   ```

### Database Setup

```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up postgres redis -d

# Run migrations
cd backend
npm run migrate:dev

# Seed database (optional)
npm run seed:dev
```

### Environment Configuration

**Development Environment (.env.development):**
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/questro_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=debug
```

## Staging Deployment

### Docker Compose Deployment

```bash
# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d

# Run database migrations
docker-compose -f docker-compose.staging.yml exec api npm run migrate:prod

# Check health
curl http://staging.questro.app/api/health
```

### Kubernetes Deployment

```bash
# Apply staging configurations
kubectl apply -f k8s/staging/

# Wait for rollout
kubectl rollout status deployment/questro-api -n questro-staging

# Check logs
kubectl logs -f deployment/questro-api -n questro-staging
```

### Staging Environment Configuration

**Staging Environment (.env.staging):**
```env
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://postgres:password@postgres:5432/questro_staging
REDIS_URL=redis://redis:6379
JWT_SECRET=staging-jwt-secret
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
CORS_ORIGIN=https://staging.questro.app
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX_REQUESTS=100
```

## Production Deployment

### Automated Deployment Script

```bash
# Run production deployment
./scripts/deploy-production.sh

# This script handles:
# - Backup current deployment
# - Build and push Docker images
# - Deploy to Kubernetes
# - Run migrations
# - Setup SSL certificates
# - Configure monitoring
# - Run health checks
```

### Manual Kubernetes Deployment

1. **Prepare Environment**:
   ```bash
   # Create production namespace
   kubectl create namespace questro-prod

   # Apply ConfigMaps
   kubectl apply -f k8s/production/configmap.yaml

   # Create secrets
   kubectl create secret generic questro-secrets \
     --from-literal=postgres-password=$POSTGRES_PASSWORD \
     --from-literal=redis-password=$REDIS_PASSWORD \
     --from-literal=jwt-secret=$JWT_SECRET \
     -n questro-prod
   ```

2. **Deploy Database**:
   ```bash
   kubectl apply -f k8s/production/postgres.yaml
   kubectl wait --for=condition=ready pod -l app=postgres -n questro-prod
   ```

3. **Deploy Services**:
   ```bash
   # Deploy Redis
   kubectl apply -f k8s/production/redis.yaml

   # Deploy API
   kubectl apply -f k8s/production/api.yaml

   # Deploy AI Service
   kubectl apply -f k8s/production/ai-service.yaml

   # Deploy Frontend
   kubectl apply -f k8s/production/frontend.yaml
   ```

4. **Configure Ingress**:
   ```bash
   # Setup SSL certificates with cert-manager
   kubectl apply -f k8s/production/cert-manager.yaml

   # Deploy ingress
   kubectl apply -f k8s/production/ingress.yaml
   ```

### Production Environment Configuration

**Production Environment (.env.production):**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:password@postgres:5432/questro_prod
REDIS_URL=redis://redis:6379
JWT_SECRET=super-secure-jwt-secret
OPENAI_API_KEY=your-production-openai-key
ANTHROPIC_API_KEY=your-production-anthropic-key
CORS_ORIGIN=https://questro.app,https://app.questro.app
LOG_LEVEL=warn
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
ENABLE_METRICS=true
ENABLE_ANALYTICS=true
```

## Monitoring and Observability

### Prometheus Configuration

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'questro-api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'

  - job_name: 'questro-ai-service'
    static_configs:
      - targets: ['ai-service:3001']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboards

Pre-configured dashboards include:
- **Application Metrics**: Request rate, response time, error rate
- **Infrastructure**: CPU, memory, disk usage
- **Database**: Connection pool, query performance
- **AI Service**: Model inference time, token usage
- **Business Metrics**: Test generation rate, user activity

### Alerting Rules

```yaml
# monitoring/rules/alerts.yml
groups:
  - name: questro-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"
```

### Log Aggregation

```yaml
# monitoring/loki-config.yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
    chunk_idle_period: 1h
    max_chunk_age: 1h
    chunk_target_size: 1048576
    chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

## Security Considerations

### Network Security

```yaml
# Network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: questro-network-policy
  namespace: questro-prod
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: questro-prod
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: questro-prod
  - to: []
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 443
```

### Pod Security

```yaml
# Pod security policy
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: questro-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

### Secrets Management

```bash
# Encrypt sensitive values
kubectl create secret generic questro-secrets \
  --from-env-file=.env.production \
  --dry-run=client -o yaml | \
  kubeseal --cert=cert.pem --key=key.pem --sealed -o yaml > sealed-secrets.yaml

# Apply sealed secrets
kubectl apply -f sealed-secrets.yaml
```

## Backup and Recovery

### Database Backup

```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/questro-backup-$DATE.sql"

mkdir -p $BACKUP_DIR

# Create backup
kubectl exec -n questro-prod deployment/postgres -- pg_dump -U postgres questro_prod > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage (AWS S3 example)
aws s3 cp $BACKUP_FILE.gz s3://questro-backups/postgres/

# Clean up old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### Application State Backup

```bash
# Backup Kubernetes resources
kubectl get all -n questro-prod -o yaml > backup-k8s-$(date +%Y%m%d-%H%M%S).yaml

# Backup ConfigMaps and Secrets
kubectl get configmaps,secrets -n questro-prod -o yaml > backup-configs-$(date +%Y%m%d-%H%M%S).yaml

# Backup Persistent Volumes
kubectl get pvc -n questro-prod -o yaml > backup-pvc-$(date +%Y%m%d-%H%M%S).yaml
```

### Disaster Recovery

```bash
# Restore database
kubectl exec -i -n questro-prod deployment/postgres -- psql -U postgres questro_prod < backup-file.sql

# Restore application configuration
kubectl apply -f backup-configs-YYYYMMDD-HHMMSS.yaml

# Restore persistent volumes
kubectl apply -f backup-pvc-YYYYMMDD-HHMMSS.yaml
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   ```bash
   # Check database pod status
   kubectl get pods -n questro-prod -l app=postgres

   # Check database logs
   kubectl logs -n questro-prod deployment/postgres

   # Test database connection
   kubectl exec -n questro-prod deployment/postgres -- pg_isready -U postgres
   ```

2. **API Service Issues**:
   ```bash
   # Check API pod status
   kubectl get pods -n questro-prod -l app=questro-api

   # Check API logs
   kubectl logs -n questro-prod deployment/questro-api

   # Port-forward to local for debugging
   kubectl port-forward -n questro-prod deployment/questro-api 3000:3000
   ```

3. **SSL Certificate Issues**:
   ```bash
   # Check certificate status
   kubectl get certificates -n questro-prod

   # Check cert-manager logs
   kubectl logs -n cert-manager deployment/cert-manager

   # Describe certificate
   kubectl describe certificate -n questro-prod questro-app-tls
   ```

4. **Memory Issues**:
   ```bash
   # Check resource usage
   kubectl top pods -n questro-prod

   # Describe pod for resource limits
   kubectl describe pod -n questro-prod <pod-name>
   ```

### Performance Issues

1. **Database Performance**:
   ```sql
   -- Check slow queries
   SELECT query, mean_time, calls
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;

   -- Check active connections
   SELECT count(*) FROM pg_stat_activity;
   ```

2. **API Performance**:
   ```bash
   # Check response times
   curl -w "@curl-format.txt" -o /dev/null -s https://api.questro.app/health

   # Load test
   hey -n 100 -c 10 https://api.questro.app/api/health
   ```

3. **AI Service Performance**:
   ```bash
   # Check AI service metrics
   curl https://ai.questro.app/metrics | grep ai_inference_duration
   ```

### Log Analysis

```bash
# Application logs
kubectl logs -n questro-prod deployment/questro-api --tail=100

# System logs
journalctl -u kubelet -f

# Network logs
tcpdump -i any port 443 -n
```

## Maintenance

### Rolling Updates

```bash
# Update API with zero downtime
kubectl set image deployment/questro-api questro-api=questro/api:v2.1.0 -n questro-prod
kubectl rollout status deployment/questro-api -n questro-prod

# Update AI service
kubectl set image deployment/questro-ai-service questro-ai-service=questro/ai-service:v2.1.0 -n questro-prod
kubectl rollout status deployment/questro-ai-service -n questro-prod
```

### Scaling

```bash
# Horizontal scaling
kubectl scale deployment questro-api --replicas=5 -n questro-prod

# Vertical scaling (edit resources)
kubectl edit deployment questro-api -n questro-prod

# Auto-scaling
kubectl apply -f k8s/production/autoscaler.yaml
```

### Certificate Renewal

```bash
# Check certificate expiration
kubectl get certificates -n questro-prod

# Force renewal (if needed)
kubectl delete certificate questro-app-tls -n questro-prod
```

### Database Maintenance

```bash
# Run VACUUM
kubectl exec -n questro-prod deployment/postgres -- psql -U postgres -d questro_prod -c "VACUUM ANALYZE;"

# Update statistics
kubectl exec -n questro-prod deployment/postgres -- psql -U postgres -d questro_prod -c "ANALYZE;"

# Reindex (if needed)
kubectl exec -n questro-prod deployment/postgres -- psql -U postgres -d questro_prod -c "REINDEX DATABASE questro_prod;"
```

## Support and Monitoring

### Health Checks

All services include comprehensive health checks:

```yaml
# Example health check configuration
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Metrics Collection

Key metrics to monitor:
- **Application Metrics**: Request rate, response time, error rate
- **Business Metrics**: Test generation rate, user activity, API usage
- **Infrastructure Metrics**: CPU, memory, disk, network usage
- **Database Metrics**: Connection pool, query performance, replication lag

### Alerting Channels

Configure alerts to be sent to:
- **Email**: Critical alerts
- **Slack**: All alerts and notifications
- **PagerDuty**: Emergency alerts
- **Webhooks**: Custom integrations

For additional support, contact:
- **Documentation**: https://docs.questro.app
- **Support**: support@questro.app
- **Status Page**: https://status.questro.app
- **Community**: https://discord.gg/questro