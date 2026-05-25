# UPM.Plus Production Deployment Guide
## Complete Infrastructure Setup and Deployment

**Version:** 1.0  
**Date:** January 2025  
**Target:** Production Environment

---

## 📋 Prerequisites

### System Requirements
- **Operating System:** Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **CPU:** 8+ cores (16+ recommended for production)
- **RAM:** 32GB minimum (64GB+ recommended)
- **Storage:** 500GB SSD minimum (1TB+ recommended)
- **Network:** 1Gbps connection with static IP

### Required Software
- **Docker:** 24.0+
- **Docker Compose:** 2.20+
- **Kubernetes:** 1.28+ (for cluster deployment)
- **Git:** 2.30+
- **Python:** 3.11+ (for local development)

### Cloud Provider Requirements
- **AWS:** EC2, RDS, ElastiCache, S3, ELB, Route53
- **Azure:** VM, Database, Cache, Storage, Load Balancer, DNS
- **GCP:** Compute Engine, Cloud SQL, Memorystore, Cloud Storage, Load Balancer, Cloud DNS

---

## 🏗️ Architecture Overview

### Production Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (NGINX)                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)  │  API Gateway  │  WebSocket Gateway    │
├─────────────────────────────────────────────────────────────┤
│                    UPM.Plus Backend Services                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │   FastAPI   │ │   Celery    │ │   Agent Services    │   │
│  │   Workers   │ │   Workers   │ │   (4 Agents)        │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Data & Cache Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │ PostgreSQL  │ │    Redis    │ │     ChromaDB        │   │
│  │  (Primary)  │ │   (Cache)   │ │  (Vector Store)     │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    External Services                        │
│  OpenAI API  │  Anthropic API  │  Browser Instances      │
└─────────────────────────────────────────────────────────────┘
```

### Service Components
1. **API Layer:** FastAPI with async support
2. **Task Queue:** Celery with Redis broker
3. **Agent System:** 4 specialized AI agents
4. **Database:** PostgreSQL with async connections
5. **Cache:** Redis for session and task caching
6. **Vector DB:** ChromaDB for knowledge management
7. **Browser:** Playwright with headless browsers
8. **Monitoring:** Prometheus + Grafana + Sentry

---

## 🚀 Quick Start Deployment

### Option 1: Docker Compose (Recommended for Single Server)

#### 1. Clone Repository
```bash
git clone https://github.com/your-org/upm-plus.git
cd upm-plus
```

#### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

#### 3. Required Environment Variables
```bash
# Application
SECRET_KEY=your-super-secret-key-here
ENVIRONMENT=production
DEBUG=false

# Database
DATABASE_URL=postgresql+asyncpg://upmplus:password@postgres:5432/upmplus

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/1

# AI Services
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Security
ALLOWED_ORIGINS=["https://yourdomain.com"]
ALLOWED_HOSTS=["yourdomain.com", "www.yourdomain.com"]

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

#### 4. Deploy with Docker Compose
```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### Option 2: Kubernetes Deployment (Recommended for Scale)

#### 1. Prepare Kubernetes Manifests
```bash
# Create namespace
kubectl create namespace upm-plus

# Apply configurations
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/celery.yaml
kubectl apply -f k8s/nginx.yaml
```

#### 2. Kubernetes Configuration Files

**k8s/configmap.yaml:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: upm-plus-config
  namespace: upm-plus
data:
  ENVIRONMENT: "production"
  DEBUG: "false"
  DATABASE_URL: "postgresql+asyncpg://upmplus:password@postgres:5432/upmplus"
  REDIS_URL: "redis://redis:6379/0"
  CELERY_BROKER_URL: "redis://redis:6379/1"
  CELERY_RESULT_BACKEND: "redis://redis:6379/1"
```

**k8s/backend.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ump-plus-backend
  namespace: upm-plus
spec:
  replicas: 3
  selector:
    matchLabels:
      app: upm-plus-backend
  template:
    metadata:
      labels:
        app: upm-plus-backend
    spec:
      containers:
      - name: backend
        image: upmplus/backend:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: upm-plus-config
        - secretRef:
            name: upm-plus-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: upm-plus-backend-service
  namespace: upm-plus
spec:
  selector:
    app: upm-plus-backend
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

---

## 🗄️ Database Setup

### PostgreSQL Configuration

#### 1. Production Database Setup
```sql
-- Create database and user
CREATE DATABASE upmplus;
CREATE USER upmplus WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE upmplus TO upmplus;

-- Enable required extensions
\c upmplus;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

#### 2. Database Migration
```bash
# Run migrations
cd backend
python -m alembic upgrade head

# Seed initial data
python scripts/seed_db.py
```

#### 3. Database Optimization
```sql
-- Performance tuning for production
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Reload configuration
SELECT pg_reload_conf();
```

### Redis Configuration

#### 1. Redis Production Config
```bash
# /etc/redis/redis.conf
bind 0.0.0.0
port 6379
timeout 0
keepalive 300
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### 2. Redis Security
```bash
# Set password
requirepass your-redis-password

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```

---

## 🔧 Service Configuration

### FastAPI Backend Configuration

#### 1. Production Settings
```python
# backend/app/core/config.py (production overrides)
class ProductionSettings(Settings):
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    
    # Security
    SECRET_KEY: str = Field(env="SECRET_KEY")
    ALLOWED_ORIGINS: List[str] = Field(env="ALLOWED_ORIGINS")
    ALLOWED_HOSTS: List[str] = Field(env="ALLOWED_HOSTS")
    
    # Database
    DATABASE_URL: str = Field(env="DATABASE_URL")
    DATABASE_ECHO: bool = False
    
    # Performance
    WORKERS: int = Field(default=4, env="WORKERS")
    MAX_CONNECTIONS: int = Field(default=100, env="MAX_CONNECTIONS")
    
    # Monitoring
    SENTRY_DSN: str = Field(env="SENTRY_DSN")
    PROMETHEUS_PORT: int = Field(default=8002, env="PROMETHEUS_PORT")
```

#### 2. Gunicorn Configuration
```python
# gunicorn.conf.py
bind = "0.0.0.0:8000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100
timeout = 30
keepalive = 2
preload_app = True
```

### Celery Worker Configuration

#### 1. Celery Production Settings
```python
# backend/app/core/celery.py
from celery import Celery

app = Celery('upm_plus_tasks')

app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Performance settings
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,
    
    # Routing
    task_routes={
        'app.tasks.agent_tasks.*': {'queue': 'agents'},
        'app.tasks.workflow_tasks.*': {'queue': 'workflows'},
        'app.tasks.document_tasks.*': {'queue': 'documents'},
    },
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)
```

#### 2. Celery Worker Startup
```bash
# Start different worker types
celery -A app.core.celery worker --loglevel=info --queue=agents --concurrency=4
celery -A app.core.celery worker --loglevel=info --queue=workflows --concurrency=2
celery -A app.core.celery worker --loglevel=info --queue=documents --concurrency=2

# Start Celery Beat (scheduler)
celery -A app.core.celery beat --loglevel=info

# Start Flower (monitoring)
celery -A app.core.celery flower --port=5555
```

---

## 🌐 Load Balancer & Reverse Proxy

### NGINX Configuration

#### 1. Main Configuration
```nginx
# /etc/nginx/sites-available/upm-plus
upstream backend {
    least_conn;
    server backend-1:8000 max_fails=3 fail_timeout=30s;
    server backend-2:8000 max_fails=3 fail_timeout=30s;
    server backend-3:8000 max_fails=3 fail_timeout=30s;
}

upstream websocket {
    ip_hash;
    server backend-1:8001;
    server backend-2:8001;
    server backend-3:8001;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # API Routes
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # WebSocket Routes
    location /ws/ {
        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Static Files
    location /static/ {
        alias /var/www/upm-plus/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Frontend Application
    location / {
        root /var/www/upm-plus/frontend;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # Health Check
    location /health {
        access_log off;
        proxy_pass http://backend/health;
    }
}
```

#### 2. Rate Limiting
```nginx
# Rate limiting configuration
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
    
    server {
        # API rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            # ... other config
        }
        
        # Auth rate limiting
        location /api/v1/auth/ {
            limit_req zone=auth burst=5 nodelay;
            # ... other config
        }
    }
}
```

---

## 📊 Monitoring & Observability

### Prometheus Configuration

#### 1. Prometheus Setup
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "upm_plus_rules.yml"

scrape_configs:
  - job_name: 'upm-plus-backend'
    static_configs:
      - targets: ['backend:8002']
    metrics_path: /metrics
    scrape_interval: 30s
    
  - job_name: 'upm-plus-celery'
    static_configs:
      - targets: ['celery-exporter:9540']
    scrape_interval: 30s
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### 2. Alert Rules
```yaml
# upm_plus_rules.yml
groups:
  - name: upm_plus_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connections are high"
          
      - alert: CeleryQueueBacklog
        expr: celery_queue_length > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Celery queue backlog detected"
```

### Grafana Dashboards

#### 1. Application Metrics Dashboard
```json
{
  "dashboard": {
    "title": "UPM.Plus Application Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Agent Task Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(agent_tasks_completed_total[5m]) / rate(agent_tasks_total[5m]) * 100",
            "legendFormat": "Success Rate %"
          }
        ]
      }
    ]
  }
}
```

### Logging Configuration

#### 1. Structured Logging
```python
# backend/app/core/logging.py
import structlog
import logging.config

def setup_logging():
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "json": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.dev.ConsoleRenderer(colors=False),
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "json",
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": "/var/log/upm-plus/app.log",
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "formatter": "json",
            },
        },
        "loggers": {
            "": {
                "handlers": ["console", "file"],
                "level": "INFO",
            },
            "uvicorn": {
                "handlers": ["console", "file"],
                "level": "INFO",
                "propagate": False,
            },
        },
    })
    
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
```

---

## 🔒 Security Configuration

### SSL/TLS Setup

#### 1. Let's Encrypt Certificate
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 2. Security Headers
```nginx
# Security headers in NGINX
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
```

### Application Security

#### 1. Environment Variables Security
```bash
# Use secrets management
export SECRET_KEY=$(openssl rand -hex 32)
export DATABASE_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)

# Store in secure location
echo "SECRET_KEY=$SECRET_KEY" >> /etc/upm-plus/secrets.env
chmod 600 /etc/upm-plus/secrets.env
```

#### 2. Database Security
```sql
-- Create read-only user for monitoring
CREATE USER monitoring WITH PASSWORD 'monitoring-password';
GRANT CONNECT ON DATABASE upmplus TO monitoring;
GRANT USAGE ON SCHEMA public TO monitoring;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring;

-- Revoke unnecessary permissions
REVOKE ALL ON SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO upmplus;
```

---

## 🚀 Deployment Scripts

### Automated Deployment Script

#### 1. Complete Deployment Script
```bash
#!/bin/bash
# deploy.sh - UPM.Plus Production Deployment

set -e

# Configuration
REPO_URL="https://github.com/your-org/ump-plus.git"
DEPLOY_DIR="/opt/upm-plus"
BACKUP_DIR="/opt/backups/upm-plus"
LOG_FILE="/var/log/upm-plus/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a $LOG_FILE
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a $LOG_FILE
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running"
    fi
    
    # Check if required environment variables are set
    if [[ -z "$SECRET_KEY" ]]; then
        error "SECRET_KEY environment variable is not set"
    fi
    
    # Check disk space
    AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
    if [[ $AVAILABLE_SPACE -lt 5242880 ]]; then  # 5GB in KB
        error "Insufficient disk space. At least 5GB required."
    fi
    
    log "Pre-deployment checks passed"
}

# Backup current deployment
backup_current_deployment() {
    log "Creating backup of current deployment..."
    
    if [[ -d "$DEPLOY_DIR" ]]; then
        BACKUP_NAME="backup-$(date +'%Y%m%d-%H%M%S')"
        mkdir -p "$BACKUP_DIR"
        
        # Backup application files
        tar -czf "$BACKUP_DIR/$BACKUP_NAME-app.tar.gz" -C "$DEPLOY_DIR" .
        
        # Backup database
        docker exec upm-plus-postgres pg_dump -U upmplus upmplus > "$BACKUP_DIR/$BACKUP_NAME-db.sql"
        
        log "Backup created: $BACKUP_NAME"
    else
        log "No existing deployment found, skipping backup"
    fi
}

# Deploy application
deploy_application() {
    log "Deploying UPM.Plus application..."
    
    # Clone or update repository
    if [[ -d "$DEPLOY_DIR" ]]; then
        cd "$DEPLOY_DIR"
        git pull origin main
    else
        git clone "$REPO_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
    fi
    
    # Copy environment configuration
    if [[ -f "/etc/upm-plus/.env" ]]; then
        cp "/etc/upm-plus/.env" "$DEPLOY_DIR/.env"
    else
        error "Environment configuration not found at /etc/upm-plus/.env"
    fi
    
    # Build and deploy with Docker Compose
    docker-compose -f docker-compose.prod.yml down --remove-orphans
    docker-compose -f docker-compose.prod.yml build --no-cache
    docker-compose -f docker-compose.prod.yml up -d
    
    log "Application deployed successfully"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Wait for database to be ready
    sleep 30
    
    # Run migrations
    docker-compose -f docker-compose.prod.yml exec -T backend python -m alembic upgrade head
    
    log "Database migrations completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for services to start
    sleep 60
    
    # Check API health
    for i in {1..30}; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log "Health check passed"
            return 0
        fi
        sleep 10
    done
    
    error "Health check failed after 5 minutes"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 10 backups
    cd "$BACKUP_DIR"
    ls -t backup-*.tar.gz | tail -n +11 | xargs -r rm
    ls -t backup-*.sql | tail -n +11 | xargs -r rm
    
    log "Old backups cleaned up"
}

# Main deployment process
main() {
    log "Starting UPM.Plus deployment..."
    
    pre_deployment_checks
    backup_current_deployment
    deploy_application
    run_migrations
    health_check
    cleanup_old_backups
    
    log "UPM.Plus deployment completed successfully!"
    log "Application is available at: https://yourdomain.com"
}

# Run deployment
main "$@"
```

#### 2. Rollback Script
```bash
#!/bin/bash
# rollback.sh - UPM.Plus Rollback Script

set -e

BACKUP_DIR="/opt/backups/upm-plus"
DEPLOY_DIR="/opt/upm-plus"

# List available backups
list_backups() {
    echo "Available backups:"
    ls -la "$BACKUP_DIR" | grep backup- | awk '{print $9}' | sort -r
}

# Rollback to specific backup
rollback() {
    BACKUP_NAME=$1
    
    if [[ -z "$BACKUP_NAME" ]]; then
        echo "Usage: ./rollback.sh <backup-name>"
        list_backups
        exit 1
    fi
    
    echo "Rolling back to: $BACKUP_NAME"
    
    # Stop current services
    cd "$DEPLOY_DIR"
    docker-compose -f docker-compose.prod.yml down
    
    # Restore application files
    rm -rf "$DEPLOY_DIR"/*
    tar -xzf "$BACKUP_DIR/$BACKUP_NAME-app.tar.gz" -C "$DEPLOY_DIR"
    
    # Restore database
    docker-compose -f docker-compose.prod.yml up -d postgres
    sleep 30
    docker exec -i upm-plus-postgres psql -U upmplus -d upmplus < "$BACKUP_DIR/$BACKUP_NAME-db.sql"
    
    # Start services
    docker-compose -f docker-compose.prod.yml up -d
    
    echo "Rollback completed successfully"
}

rollback "$@"
```

---

## 📈 Performance Optimization

### Database Optimization

#### 1. Connection Pooling
```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.pool import QueuePool

engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DATABASE_ECHO
)
```

#### 2. Query Optimization
```sql
-- Create indexes for common queries
CREATE INDEX CONCURRENTLY idx_workflows_created_by ON workflows(created_by);
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status);
CREATE INDEX CONCURRENTLY idx_agents_type ON agents(type);
CREATE INDEX CONCURRENTLY idx_documents_created_at ON documents(created_at DESC);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY idx_active_workflows ON workflows(id) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_running_tasks ON tasks(id) WHERE status = 'running';
```

### Caching Strategy

#### 1. Redis Caching
```python
# backend/app/services/cache_service.py
import json
from typing import Any, Optional
from app.core.redis import redis_client

class CacheService:
    @staticmethod
    async def get(key: str) -> Optional[Any]:
        value = await redis_client.get(key)
        return json.loads(value) if value else None
    
    @staticmethod
    async def set(key: str, value: Any, expire: int = 3600):
        await redis_client.set(key, json.dumps(value, default=str), expire)
    
    @staticmethod
    async def delete(key: str):
        await redis_client.delete(key)
    
    @staticmethod
    async def get_or_set(key: str, func, expire: int = 3600):
        value = await CacheService.get(key)
        if value is None:
            value = await func()
            await CacheService.set(key, value, expire)
        return value
```

#### 2. Application-Level Caching
```python
# Cache frequently accessed data
@cache_result(expire=300)  # 5 minutes
async def get_user_workflows(user_id: UUID):
    return await workflow_service.list_user_workflows(user_id)

@cache_result(expire=60)  # 1 minute
async def get_agent_status():
    return await agent_service.get_all_agent_status()
```

---

## 🔧 Maintenance & Operations

### Backup Strategy

#### 1. Automated Backup Script
```bash
#!/bin/bash
# backup.sh - Automated backup script

BACKUP_DIR="/opt/backups/upm-plus"
RETENTION_DAYS=30
DATE=$(date +'%Y%m%d-%H%M%S')

# Database backup
docker exec upm-plus-postgres pg_dump -U upmplus upmplus | gzip > "$BACKUP_DIR/db-$DATE.sql.gz"

# Application files backup
tar -czf "$BACKUP_DIR/app-$DATE.tar.gz" -C /opt/upm-plus .

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/db-$DATE.sql.gz" s3://your-backup-bucket/upm-plus/
aws s3 cp "$BACKUP_DIR/app-$DATE.tar.gz" s3://your-backup-bucket/upm-plus/

# Cleanup old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

#### 2. Cron Job Setup
```bash
# Add to crontab
0 2 * * * /opt/scripts/backup.sh >> /var/log/upm-plus/backup.log 2>&1
```

### Log Rotation

#### 1. Logrotate Configuration
```bash
# /etc/logrotate.d/upm-plus
/var/log/upm-plus/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 upmplus upmplus
    postrotate
        docker-compose -f /opt/upm-plus/docker-compose.prod.yml restart backend
    endscript
}
```

### System Monitoring

#### 1. System Health Check Script
```bash
#!/bin/bash
# health-check.sh - System health monitoring

check_service() {
    SERVICE=$1
    if docker-compose -f /opt/upm-plus/docker-compose.prod.yml ps $SERVICE | grep -q "Up"; then
        echo "✓ $SERVICE is running"
    else
        echo "✗ $SERVICE is not running"
        return 1
    fi
}

check_disk_space() {
    USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ $USAGE -gt 80 ]; then
        echo "✗ Disk usage is high: ${USAGE}%"
        return 1
    else
        echo "✓ Disk usage is normal: ${USAGE}%"
    fi
}

check_memory() {
    USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if [ $USAGE -gt 90 ]; then
        echo "✗ Memory usage is high: ${USAGE}%"
        return 1
    else
        echo "✓ Memory usage is normal: ${USAGE}%"
    fi
}

# Run checks
echo "UPM.Plus Health Check - $(date)"
echo "=================================="

FAILED=0

check_service "backend" || FAILED=1
check_service "postgres" || FAILED=1
check_service "redis" || FAILED=1
check_service "celery" || FAILED=1
check_disk_space || FAILED=1
check_memory || FAILED=1

if [ $FAILED -eq 0 ]; then
    echo "✓ All checks passed"
    exit 0
else
    echo "✗ Some checks failed"
    exit 1
fi
```

---

## 🚨 Troubleshooting Guide

### Common Issues

#### 1. Service Won't Start
```bash
# Check logs
docker-compose logs backend
docker-compose logs postgres
docker-compose logs redis

# Check resource usage
docker stats

# Restart services
docker-compose restart backend
```

#### 2. Database Connection Issues
```bash
# Check database status
docker-compose exec postgres pg_isready -U upmplus

# Check connections
docker-compose exec postgres psql -U upmplus -c "SELECT count(*) FROM pg_stat_activity;"

# Reset connections
docker-compose restart postgres
```

#### 3. High Memory Usage
```bash
# Check memory usage by service
docker stats --no-stream

# Restart memory-intensive services
docker-compose restart celery
docker-compose restart backend
```

#### 4. Performance Issues
```bash
# Check database performance
docker-compose exec postgres psql -U upmplus -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check Redis performance
docker-compose exec redis redis-cli info stats

# Check application metrics
curl http://localhost:8002/metrics
```

### Emergency Procedures

#### 1. Complete System Recovery
```bash
# Stop all services
docker-compose -f docker-compose.prod.yml down

# Restore from backup
./rollback.sh backup-20240101-120000

# Verify system health
./health-check.sh
```

#### 2. Database Recovery
```bash
# Create emergency backup
docker exec upm-plus-postgres pg_dump -U upmplus upmplus > emergency-backup.sql

# Restore from backup
docker exec -i upm-plus-postgres psql -U upmplus -d upmplus < backup-file.sql
```

---

## 📞 Support & Maintenance

### Monitoring Checklist
- [ ] All services are running
- [ ] Database connections are healthy
- [ ] Redis is responding
- [ ] Disk space is adequate (< 80%)
- [ ] Memory usage is normal (< 90%)
- [ ] API response times are acceptable (< 2s)
- [ ] Error rates are low (< 1%)
- [ ] Backups are completing successfully

### Regular Maintenance Tasks
- **Daily:** Check system health, review error logs
- **Weekly:** Review performance metrics, update dependencies
- **Monthly:** Security updates, backup verification
- **Quarterly:** Capacity planning, disaster recovery testing

### Contact Information
- **Technical Support:** support@upmplus.com
- **Emergency Hotline:** +1-XXX-XXX-XXXX
- **Documentation:** https://docs.upmplus.com
- **Status Page:** https://status.upmplus.com

---

**UPM.Plus Production Deployment Guide Complete**

*For additional support, please refer to our documentation or contact our technical support team.*