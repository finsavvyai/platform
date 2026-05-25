# Questro Production Deployment Guide

## Overview

This comprehensive guide covers deploying Questro to production environments, including infrastructure setup, configuration, security, and monitoring.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Application Deployment](#application-deployment)
6. [Security Configuration](#security-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts and Services

1. **Cloud Provider Account** (AWS, Google Cloud, or Azure)
2. **Domain Name** (custom domain for the application)
3. **SSL Certificate** (for HTTPS)
4. **Email Service** (SendGrid, AWS SES, or similar)
5. **Monitoring Service** (DataDog, New Relic, or similar)
6. **Payment Processor** (Stripe or LemonSqueezy)
7. **CDN Service** (Cloudflare recommended)

### Technical Requirements

- Node.js 18+ and npm 8+
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 6+
- SSL certificate management
- Load balancer configuration

## Infrastructure Setup

### 1. Cloud Provider Configuration

#### AWS Setup
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=questro-vpc}]'

# Create subnets
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b

# Create security groups
aws ec2 create-security-group --group-name questro-sg --description "Questro security group" --vpc-id vpc-xxx
```

#### Google Cloud Setup
```bash
# Create project
gcloud projects create questro-production

# Set up networking
gcloud compute networks create questro-vpc --subnet-mode=custom
gcloud compute networks subnets create questro-subnet-1 \
  --network=questro-vpc --range=10.0.1.0/24 --region=us-central1
```

### 2. Database Setup

#### PostgreSQL Configuration
```bash
# Create RDS instance (AWS)
aws rds create-db-instance \
  --db-instance-identifier questro-prod-db \
  --db-instance-class db.m5.large \
  --engine postgres \
  --master-username questro_admin \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name questro-subnet-group

# Configure parameters
aws rds modify-db-parameter-group \
  --db-parameter-group-name questro-params \
  --parameters "ParameterName=shared_preload_libraries,ParameterValue=pg_stat_statements,ApplyMethod=immediate"
```

#### Redis Configuration
```bash
# Create ElastiCache cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id questro-prod-cache \
  --cache-node-type cache.m5.large \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-xxx \
  --subnet-group-name questro-cache-subnet-group
```

### 3. Load Balancer Setup

#### Application Load Balancer
```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name questro-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application

# Create target group
aws elbv2 create-target-group \
  --name questro-targets \
  --protocol HTTP \
  --port 8000 \
  --target-type instance \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

## Environment Configuration

### 1. Production Environment Variables

Create `.env.production`:

```bash
# Application Configuration
NODE_ENV=production
PORT=8000
FRONTEND_URL=https://app.questro.com
BACKEND_URL=https://api.questro.com

# Database Configuration
DATABASE_URL=postgresql://questro_admin:PASSWORD@questro-prod-db.xxx.us-east-1.rds.amazonaws.com:5432/questro_prod
DATABASE_SSL=true
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=20

# Redis Configuration
REDIS_URL=redis://questro-prod-cache.xxx.cache.amazonaws.com:6379
REDIS_PASSWORD=your_redis_password

# Authentication
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters
JWT_REFRESH_SECRET=your_super_secure_refresh_secret_at_least_32_characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key
SESSION_SECRET=your_session_secret_at_least_32_characters

# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
FROM_EMAIL=noreply@questro.com

# Payment Processing
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRODUCT_ID=prod_your_product_id

# AI Services
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_ORG_ID=org-your_organization_id
HUGGINGFACE_API_KEY=your_huggingface_api_key

# File Storage
AWS_S3_BUCKET=questro-production-files
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# Monitoring
DATADOG_API_KEY=your_datadog_api_key
DATADOG_APP_KEY=your_datadog_app_key
SENTRY_DSN=your_sentry_dsn

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true
ENABLE_VOICE_TESTING=true
ENABLE_API_TESTING=true
ENABLE_AI_FEATURES=true

# Performance
ENABLE_COMPRESSION=true
ENABLE_CACHING=true
CACHE_TTL_SECONDS=300

# Security
CORS_ORIGIN=https://app.questro.com
HELMET_ENABLED=true
RATE_LIMIT_ENABLED=true
```

### 2. Application Configuration

#### Backend Configuration (`backend/config/production.ts`)
```typescript
export const productionConfig = {
  app: {
    name: 'Questro',
    version: '1.0.0',
    environment: 'production',
    port: parseInt(process.env.PORT || '8000'),
  },
  
  database: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_SSL === 'true',
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN || '10'),
      max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
    },
  },
  
  redis: {
    url: process.env.REDIS_URL!,
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
  },
  
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN!,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN!,
  },
  
  encryption: {
    key: process.env.ENCRYPTION_KEY!,
    algorithm: 'aes-256-gcm',
  },
  
  email: {
    smtp: {
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT!),
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASSWORD!,
      },
    },
    from: process.env.FROM_EMAIL!,
  },
  
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      productId: process.env.STRIPE_PRODUCT_ID!,
    },
  },
  
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      orgId: process.env.OPENAI_ORG_ID!,
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY!,
    },
  },
  
  storage: {
    aws: {
      bucket: process.env.AWS_S3_BUCKET!,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION!,
    },
  },
  
  monitoring: {
    datadog: {
      apiKey: process.env.DATADOG_API_KEY!,
      appKey: process.env.DATADOG_APP_KEY!,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN!,
    },
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
  
  features: {
    recording: process.env.ENABLE_RECORDING === 'true',
    mobileTesting: process.env.ENABLE_MOBILE_TESTING === 'true',
    webTesting: process.env.ENABLE_WEB_TESTING === 'true',
    voiceTesting: process.env.ENABLE_VOICE_TESTING === 'true',
    apiTesting: process.env.ENABLE_API_TESTING === 'true',
    aiFeatures: process.env.ENABLE_AI_FEATURES === 'true',
  },
  
  performance: {
    compression: process.env.ENABLE_COMPRESSION === 'true',
    caching: process.env.ENABLE_CACHING === 'true',
    cacheTtl: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
  },
  
  security: {
    corsOrigin: process.env.CORS_ORIGIN!,
    helmet: process.env.HELMET_ENABLED === 'true',
    rateLimit: process.env.RATE_LIMIT_ENABLED === 'true',
  },
};
```

## Database Setup

### 1. Database Migration

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Generate schema files
npm run db:generate

# Seed initial data (optional)
npm run db:seed
```

### 2. Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_projects_owner_id ON projects(owner_id);
CREATE INDEX CONCURRENTLY idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX CONCURRENTLY idx_test_runs_created_at ON test_runs(created_at);
CREATE INDEX CONCURRENTLY idx_sessions_user_id ON sessions(user_id);

-- Configure PostgreSQL settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

## Application Deployment

### 1. Build Application

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build

# Create production deployment package
mkdir -p ../dist
cp -r backend/dist ../dist/backend
cp -r frontend/dist ../dist/frontend
cp package*.json ../dist/
cp -r scripts ../dist/
```

### 2. Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build applications
RUN cd backend && npm run build
RUN cd frontend && npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built applications
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["node", "backend/dist/index.js"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: questro_prod
      POSTGRES_USER: questro_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/backup:/backup
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U questro_admin"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Kubernetes Deployment

#### Deployment Manifest
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: questro-backend
  labels:
    app: questro-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: questro-backend
  template:
    metadata:
      labels:
        app: questro-backend
    spec:
      containers:
      - name: questro-backend
        image: questro/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: questro-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: questro-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: questro-backend-service
spec:
  selector:
    app: questro-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: ClusterIP
```

## Security Configuration

### 1. SSL/TLS Configuration

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name app.questro.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.questro.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';";

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://app:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Security Hardening

```bash
# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Configure fail2ban
cat > /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl start fail2ban
```

## Monitoring Setup

### 1. Application Monitoring

#### DataDog Configuration
```typescript
// backend/src/monitoring/datadog.ts
import { datadog } from 'datadog';

datadog.init({
  apiKey: process.env.DATADOG_API_KEY,
  appKey: process.env.DATADOG_APP_KEY,
  env: 'production',
  service: 'questro-backend',
  version: '1.0.0',
});

// Custom metrics
datadog.metric('questro.users.active', 1500, {
  tags: ['environment:production', 'plan:premium'],
});

datadog.event('Application deployment', {
  text: 'New version deployed to production',
  tags: ['version:1.0.0', 'environment:production'],
});
```

### 2. Health Checks

```typescript
// backend/src/routes/health.ts
import { Router } from 'express';
import { checkDatabaseConnection } from '../utils/database';
import { checkRedisConnection } from '../utils/redis';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {
      database: await checkDatabaseConnection(),
      redis: await checkRedisConnection(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    },
  };

  const isHealthy = Object.values(health.checks).every(check => 
    typeof check === 'object' ? check.status === 'ok' : check
  );

  res.status(isHealthy ? 200 : 503).json(health);
});

router.get('/ready', async (req, res) => {
  // Readiness checks
  const ready = await checkApplicationReadiness();
  res.status(ready ? 200 : 503).json({ ready });
});

export default router;
```

## Backup and Disaster Recovery

### 1. Database Backup Script

```bash
#!/bin/bash
# scripts/backup/backup-database.sh

set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/questro_backup_$TIMESTAMP.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE.gz s3://questro-backups/database/

# Clean up local files (keep last 7 days)
find $BACKUP_DIR -name "questro_backup_*.sql.gz" -mtime +7 -delete

# Send notification
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Database backup completed successfully"}' \
  $SLACK_WEBHOOK_URL
```

### 2. Automated Backup with Cron

```bash
# Add to crontab
# Daily database backup at 2 AM
0 2 * * * /app/scripts/backup/backup-database.sh

# Weekly file backup at 3 AM on Sunday
0 3 * * 0 aws s3 sync /app/uploads s3://questro-backups/files/$(date +\%Y-\%m-\%d)/

# Monthly configuration backup at 4 AM on 1st
0 4 1 * * aws s3 cp /app/.env.production s3://questro-backups/config/.env.production.$(date +\%Y-\%m)
```

## Performance Optimization

### 1. Application Performance

```typescript
// backend/src/middleware/performance.ts
import { Request, Response, NextFunction } from 'express';

export const performanceMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    // Record metrics
    datadog.histogram('questro.request.duration', duration, {
      route: req.route?.path || req.path,
      method: req.method,
      status: res.statusCode.toString(),
    });
  });
  
  next();
};
```

### 2. Caching Strategy

```typescript
// backend/src/middleware/cache.ts
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await redis.get(key);
      
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data: any) {
        redis.setex(key, ttl, JSON.stringify(data));
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache error:', error);
      next();
    }
  };
};
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Issues
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
SELECT * FROM pg_stat_activity WHERE datname = 'questro_prod';

# Restart database connection
systemctl restart postgresql
```

#### 2. Redis Connection Issues
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis memory usage
redis-cli -u $REDIS_URL info memory

# Clear Redis cache (if needed)
redis-cli -u $REDIS_URL flushall
```

#### 3. Application Performance Issues
```bash
# Check application logs
docker logs questro-app

# Monitor resource usage
docker stats questro-app

# Check database queries
psql $DATABASE_URL -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

### Debug Mode

```bash
# Enable debug mode
DEBUG=questro:* npm start

# Check environment variables
env | grep QUESTRO

# Test health endpoint
curl -f https://api.questro.com/health
```

## Post-Deployment Checklist

- [ ] Database migrations completed successfully
- [ ] All environment variables configured
- [ ] SSL/TLS certificates installed and valid
- [ ] Load balancer configured and working
- [ ] Monitoring and alerting set up
- [ ] Backup procedures tested
- [ ] Security headers configured
- [ ] Rate limiting configured
- [ ] Health checks passing
- [ ] Performance benchmarks met
- [ ] Error tracking configured
- [ ] Log aggregation working
- [ ] CDN configured and caching
- [ ] DNS records updated
- [ ] Domain verification complete
- [ ] Payment processing tested
- [ ] Email delivery verified
- [ ] User registration flow tested
- [ ] Core functionality verified

## Emergency Procedures

### Rollback Procedure
1. Identify the last known good deployment
2. Roll back database migrations if necessary
3. Deploy previous version
4. Verify all systems are operational
5. Monitor for any issues

### Incident Response
1. Assess impact and scope
2. Notify stakeholders
3. Implement immediate fixes
4. Monitor system recovery
5. Conduct post-incident review

For emergency support, contact:
- DevOps Team: devops@questro.com
- On-call Engineer: +1-555-0123

---

This deployment guide should be used in conjunction with regular security audits and performance reviews to ensure optimal operation of the Questro platform in production environments.