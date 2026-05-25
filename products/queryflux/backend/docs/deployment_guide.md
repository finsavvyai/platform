# QueryFlux Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying QueryFlux in various environments, from development setups to production-scale deployments.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   API Gateway   │    │   Web Frontend  │
│   (nginx/HAProxy)│   │   (Kong/AWS)    │    │   (Next.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Go API Server  │
                    │  (Port 8080)    │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │     Redis       │    │  WebSocket Hub  │
│   (Primary DB)  │    │   (Cache/Sessions) │   │  (Real-time)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 50GB SSD
- Network: 100 Mbps

**Recommended Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 200GB+ SSD
- Network: 1 Gbps
- High availability setup

### Software Dependencies

- **Go 1.21+** (for building from source)
- **PostgreSQL 14+** (primary database)
- **Redis 7+** (caching and sessions)
- **nginx** (reverse proxy and load balancing)
- **Docker & Docker Compose** (containerized deployment)
- **SSL Certificate** (HTTPS)

## Deployment Options

### 1. Docker Deployment (Recommended)

#### Quick Start

```bash
# Clone repository
git clone https://github.com/queryflux/backend.git
cd backend

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env

# Deploy with Docker Compose
docker-compose up -d
```

#### Docker Compose Configuration

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  queryflux-api:
    build:
      context: .
      dockerfile: Dockerfile.prod
    ports:
      - "8080:8080"
    environment:
      - GIN_MODE=release
      - DB_HOST=postgres
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: queryflux
      POSTGRES_USER: queryflux
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - queryflux-api
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### Production Dockerfile

```dockerfile
# Dockerfile.prod
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main cmd/api/main.go

# Final image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

# Create non-root user
RUN addgroup -g 1001 -S queryflux && \
    adduser -u 1001 -S queryflux -G queryflux

# Change ownership
RUN chown -R queryflux:queryflux /app

USER queryflux

EXPOSE 8080

CMD ["./main"]
```

### 2. Kubernetes Deployment

#### Namespace and ConfigMap

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: queryflux

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: queryflux-config
  namespace: queryflux
data:
  GIN_MODE: "release"
  LOG_LEVEL: "info"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "queryflux"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  JWT_SECRET: "${JWT_SECRET}"
```

#### Secret Configuration

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: queryflux-secrets
  namespace: queryflux
type: Opaque
data:
  DB_PASSWORD: <base64-encoded-password>
  REDIS_PASSWORD: <base64-encoded-password>
  JWT_SECRET: <base64-encoded-secret>
```

#### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: queryflux-api
  namespace: queryflux
spec:
  replicas: 3
  selector:
    matchLabels:
      app: queryflux-api
  template:
    metadata:
      labels:
        app: queryflux-api
    spec:
      containers:
      - name: queryflux-api
        image: queryflux/api:latest
        ports:
        - containerPort: 8080
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: queryflux-secrets
              key: DB_PASSWORD
        envFrom:
        - configMapRef:
            name: queryflux-config
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
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: queryflux-api-service
  namespace: queryflux
spec:
  selector:
    app: queryflux-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: queryflux-ingress
  namespace: queryflux
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.queryflux.com
    secretName: queryflux-tls
  rules:
  - host: api.queryflux.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: queryflux-api-service
            port:
              number: 80
```

#### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: queryflux-hpa
  namespace: queryflux
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: queryflux-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 3. Cloud Platform Deployment

#### AWS ECS

```json
{
  "family": "queryflux-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "queryflux-api",
      "image": "queryflux/api:latest",
      "portMappings": [
        {
          "containerPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "GIN_MODE",
          "value": "release"
        }
      ],
      "secrets": [
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:queryflux/db-password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/queryflux-api",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT-ID/queryflux-api

# Deploy to Cloud Run
gcloud run deploy queryflux-api \
  --image gcr.io/PROJECT-ID/queryflux-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 100 \
  --set-env-vars GIN_MODE=release \
  --set-secrets DB_PASSWORD=queryflux-db-password:latest
```

#### Azure Container Instances

```bash
# Create container instance
az container create \
  --resource-group queryflux-rg \
  --name queryflux-api \
  --image queryflux/api:latest \
  --cpu 1 \
  --memory 2 \
  --ports 8080 \
  --environment-variables GIN_MODE=release \
  --secure-environment-variables DB_PASSWORD=$DB_PASSWORD \
  --dns-name-label queryflux-api-unique
```

## Environment Configuration

### Environment Variables

```bash
# .env.production
# Application
APP_NAME=QueryFlux
APP_VERSION=1.0.0
GIN_MODE=release
LOG_LEVEL=info
PORT=8080

# Database
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=queryflux
DB_USER=queryflux
DB_PASSWORD=secure_password
DB_SSL_MODE=require
DB_MAX_CONNECTIONS=25
DB_MAX_IDLE_CONNECTIONS=5

# Redis
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY_HOURS=24
REFRESH_TOKEN_EXPIRY_DAYS=30

# Security
CORS_ORIGINS=https://queryflux.com,https://app.queryflux.com
RATE_LIMIT_REQUESTS_PER_HOUR=1000
ENABLE_SECURITY_HEADERS=true

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
TRACING_ENABLED=true
TRACING_ENDPOINT=https://jaeger-collector.queryflux.com

# Email (for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=sendgrid_api_key

# Third-party integrations
LEMONSQUEEZY_API_KEY=lsk_live_xxx
LEMONSQUEEZY_STORE_ID=12345
OPENAI_API_KEY=sk-xxx
```

### SSL/TLS Configuration

```nginx
# nginx.conf
server {
    listen 80;
    server_name api.queryflux.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.queryflux.com;

    ssl_certificate /etc/ssl/certs/queryflux.com.crt;
    ssl_certificate_key /etc/ssl/private/queryflux.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # API backend
    location / {
        proxy_pass http://queryflux-api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://queryflux-api:8080/health;
    }
}
```

## Database Setup

### PostgreSQL Configuration

```sql
-- Create database and user
CREATE DATABASE queryflux;
CREATE USER queryflux WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE queryflux TO queryflux;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Performance tuning
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### Redis Configuration

```conf
# redis.conf
bind 127.0.0.1
port 6379
requirepass your_redis_password
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## Monitoring and Logging

### Application Monitoring

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'queryflux-api'
    static_configs:
      - targets: ['queryflux-api:9090']
    metrics_path: /metrics
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Alert Rules

```yaml
# monitoring/alert_rules.yml
groups:
- name: queryflux_alerts
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
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }} seconds"

  - alert: DatabaseConnectionsHigh
    expr: pg_stat_database_numbackends > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High database connection count"
      description: "Database has {{ $value }} active connections"
```

### Log Configuration

```go
// logger/config.go
package logger

import (
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

func NewLogger(level string) *zap.Logger {
    config := zap.Config{
        Level:       zap.NewAtomicLevelAt(getLogLevel(level)),
        Development: false,
        Sampling: &zap.SamplingConfig{
            Initial:    100,
            Thereafter: 100,
        },
        Encoding: "json",
        EncoderConfig: zapcore.EncoderConfig{
            TimeKey:        "timestamp",
            LevelKey:       "level",
            NameKey:        "logger",
            CallerKey:      "caller",
            MessageKey:     "message",
            StacktraceKey:  "stacktrace",
            LineEnding:     zapcore.DefaultLineEnding,
            EncodeLevel:    zapcore.LowercaseLevelEncoder,
            EncodeTime:     zapcore.ISO8601TimeEncoder,
            EncodeDuration: zapcore.SecondsDurationEncoder,
            EncodeCaller:   zapcore.ShortCallerEncoder,
        },
        OutputPaths:      []string{"stdout"},
        ErrorOutputPaths: []string{"stderr"},
    }

    logger, _ := config.Build()
    return logger
}
```

## Backup and Recovery

### Database Backup Script

```bash
#!/bin/bash
# scripts/backup_database.sh

set -e

BACKUP_DIR="/backups"
DB_NAME="queryflux"
DB_USER="queryflux"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/queryflux_backup_$TIMESTAMP.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -h localhost -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### Automated Backup with Cron

```bash
# Add to crontab
0 2 * * * /path/to/scripts/backup_database.sh
```

### Recovery Procedure

```bash
# Restore from backup
gunzip -c /backups/queryflux_backup_20240115_020000.sql.gz | psql -h localhost -U queryflux -d queryflux
```

## Security Considerations

### Network Security

- **Firewall Rules**: Only allow necessary ports (80, 443)
- **VPC/Private Networks**: Isolate database servers
- **Bastion Hosts**: Use jump servers for SSH access
- **VPN Access**: Require VPN for administrative access

### Application Security

- **Input Validation**: Sanitize all user inputs
- **SQL Injection Prevention**: Use parameterized queries
- **Rate Limiting**: Implement API rate limiting
- **CORS Configuration**: Restrict cross-origin requests
- **Security Headers**: Add security headers to responses

### Data Encryption

- **In Transit**: Use TLS 1.3 for all communications
- **At Rest**: Encrypt database storage and backups
- **Secrets Management**: Use key management service

## Performance Optimization

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_connections_user_id ON connections(user_id);
CREATE INDEX CONCURRENTLY idx_queries_created_at ON queries(created_at);

-- Analyze table statistics
ANALYZE users;
ANALYZE connections;
ANALYZE queries;

-- Monitor slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Application Optimization

```go
// Connection pooling
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)

// Response caching
cache := redis.NewClient(&redis.Options{
    Addr:     "localhost:6379",
    Password: "",
    DB:       0,
})

// Rate limiting middleware
func RateLimitMiddleware() gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(100), 200) // 100 RPS with burst of 200
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
            c.Abort()
            return
        }
        c.Next()
    }
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check network connectivity
   - Verify credentials
   - Check database server status

2. **High Memory Usage**
   - Monitor with `top` or `htop`
   - Check for memory leaks
   - Adjust memory limits

3. **Slow Response Times**
   - Check database query performance
   - Monitor system resources
   - Review application logs

### Health Checks

```bash
# Application health
curl -f http://localhost:8080/health || exit 1

# Database connectivity
pg_isready -h localhost -p 5432 -U queryflux || exit 1

# Redis connectivity
redis-cli -h localhost -r 1 ping || exit 1
```

### Log Analysis

```bash
# View application logs
docker-compose logs -f queryflux-api

# Filter error logs
docker-compose logs queryflux-api | grep ERROR

# Monitor resource usage
docker stats
```

## Deployment Checklist

### Pre-deployment

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups created
- [ ] Security scan completed
- [ ] Performance tests passed
- [ ] Documentation updated

### Post-deployment

- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Log collection working
- [ ] Load balancer configured
- [ ] DNS records updated
- [ ] Team notified

## Rollback Procedure

### Quick Rollback

```bash
# Docker rollback
docker-compose down
docker-compose up -d --force-recreate

# Kubernetes rollback
kubectl rollout undo deployment/queryflux-api
```

### Database Rollback

```bash
# Restore database from backup
psql -h localhost -U queryflux -d queryflux < backup_file.sql

# Run migrations to specific version
migrate -path migrations -database "postgres://..." version 20240101000000
```

## Support and Maintenance

### Regular Maintenance Tasks

- **Weekly**: Review logs and metrics
- **Monthly**: Apply security patches
- **Quarterly**: Performance optimization review
- **Annually**: Security audit and compliance check

### Monitoring Dashboards

- **Grafana**: Application and infrastructure metrics
- **Kibana**: Log analysis and search
- **Prometheus**: Metrics collection and alerting
- **Jaeger**: Distributed tracing

### Emergency Contacts

- **Primary DevOps**: devops@queryflux.com
- **Database Admin**: dba@queryflux.com
- **Security Team**: security@queryflux.com
- **On-call Engineer**: +1-555-0123

This deployment guide provides comprehensive instructions for deploying QueryFlux in production environments. Adjust configurations based on your specific requirements and infrastructure.