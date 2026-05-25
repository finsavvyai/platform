# Production Deployment Guide

This guide provides step-by-step instructions for deploying UPM.Plus to production.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ (or use provided Docker service)
- Redis 7+ (or use provided Docker service)
- Domain name with DNS configured
- SSL/TLS certificates (Let's Encrypt recommended)
- Environment variables configured

## Pre-Deployment Checklist

### 1. Security Configuration

- [ ] Generate secure `SECRET_KEY` (minimum 32 characters):
  ```bash
  openssl rand -hex 32
  ```

- [ ] Generate `MFA_ENCRYPTION_KEY`:
  ```bash
  openssl rand -hex 32
  ```

- [ ] Set strong database passwords
- [ ] Set Redis password
- [ ] Configure `ALLOWED_ORIGINS` with your production domain
- [ ] Configure `ALLOWED_HOSTS` with your production domain
- [ ] Set `ENVIRONMENT=production`
- [ ] Set `DEBUG=false`
- [ ] Set `PRODUCTION=true`

### 2. Environment Variables

Create a `.env.production` file with all required variables:

```bash
# Environment
ENVIRONMENT=production
PRODUCTION=true
DEBUG=false

# Security (REQUIRED - Generate secure values!)
SECRET_KEY=<your-secret-key-min-32-chars>
MFA_ENCRYPTION_KEY=<your-mfa-encryption-key>

# Database
POSTGRES_DB=upmplus
POSTGRES_USER=upmplus
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql+asyncpg://upmplus:<password>@postgres:5432/upmplus

# Redis
REDIS_PASSWORD=<strong-redis-password>
REDIS_URL=redis://:<password>@redis:6379/0
CELERY_BROKER_URL=redis://:<password>@redis:6379/1
CELERY_RESULT_BACKEND=redis://:<password>@redis:6379/1

# CORS & Hosts
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Monitoring (Optional but recommended)
SENTRY_DSN=<your-sentry-dsn>
GRAFANA_ADMIN_PASSWORD=<strong-password>

# AI Services (Optional)
OPENAI_API_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>

# Stripe (If using billing)
STRIPE_SECRET_KEY=<your-key>
STRIPE_WEBHOOK_SECRET=<your-secret>
```

### 3. Database Setup

Run migrations before starting services:

```bash
# Using Docker
docker-compose -f docker-compose.prod.yml run --rm backend alembic upgrade head

# Or manually
cd backend
alembic upgrade head
```

## Deployment Steps

### Option 1: Docker Compose (Recommended for Single Server)

1. **Clone repository and navigate to project:**
   ```bash
   git clone <repository-url>
   cd automationhub
   ```

2. **Copy and configure environment:**
   ```bash
   cp env.example .env.production
   # Edit .env.production with your values
   ```

3. **Build and start services:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

4. **Verify deployment:**
   ```bash
   # Check health
   curl http://localhost:8000/health
   
   # Check logs
   docker-compose -f docker-compose.prod.yml logs -f
   ```

### Option 2: Kubernetes (Recommended for Production)

1. **Apply namespace:**
   ```bash
   kubectl apply -f deployment/kubernetes/namespace.yaml
   ```

2. **Create secrets:**
   ```bash
   kubectl create secret generic upm-plus-secrets \
     --from-env-file=.env.production \
     -n upm-plus
   ```

3. **Apply configurations:**
   ```bash
   kubectl apply -f deployment/kubernetes/configmaps.yaml
   kubectl apply -f deployment/kubernetes/secrets.yaml
   ```

4. **Deploy services:**
   ```bash
   kubectl apply -f deployment/kubernetes/postgres.yaml
   kubectl apply -f deployment/kubernetes/redis.yaml
   kubectl apply -f deployment/kubernetes/backend.yaml
   kubectl apply -f deployment/kubernetes/frontend.yaml
   ```

5. **Apply ingress:**
   ```bash
   kubectl apply -f deployment/kubernetes/ingress.yaml
   ```

### Option 3: Cloud Platforms

#### AWS (ECS/EKS)
- Use provided Terraform configurations in `terraform/`
- Configure AWS credentials
- Run `terraform init && terraform apply`

#### Google Cloud (GKE)
- Use provided Kubernetes manifests
- Configure gcloud CLI
- Deploy using kubectl

#### Azure (AKS)
- Use provided Kubernetes manifests
- Configure Azure CLI
- Deploy using kubectl

## Post-Deployment

### 1. Verify Health Checks

```bash
# API health
curl https://yourdomain.com/health

# Database connectivity
docker-compose -f docker-compose.prod.yml exec backend python -c "from app.core.database import get_db_session; import asyncio; asyncio.run(get_db_session())"

# Redis connectivity
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

### 2. Monitor Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# With filtering
docker-compose -f docker-compose.prod.yml logs -f backend | grep ERROR
```

### 3. Access Monitoring

- **Prometheus:** http://yourdomain.com:9090
- **Grafana:** http://yourdomain.com:3001
  - Default username: `admin`
  - Password: Set via `GRAFANA_ADMIN_PASSWORD`

### 4. Create Admin User

```bash
# Using management command (if available)
docker-compose -f docker-compose.prod.yml exec backend python -m app.scripts.create_admin

# Or via API
curl -X POST https://yourdomain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "secure-password"}'
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Configure nginx/traefik to use certificates
# Certificates are typically in /etc/letsencrypt/live/yourdomain.com/
```

### Using Kubernetes Cert-Manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Apply certificate configuration
kubectl apply -f deployment/production/cert-manager-production.yaml
```

## Backup Strategy

### Database Backups

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U upmplus upmplus > backup_$(date +%Y%m%d).sql

# Automated daily backups (add to cron)
0 2 * * * docker-compose -f /path/to/docker-compose.prod.yml exec -T postgres pg_dump -U upmplus upmplus > /backups/upmplus_$(date +\%Y\%m\%d).sql
```

### Redis Backups

Redis persistence is configured with AOF (Append Only File). For additional backups:

```bash
# Manual backup
docker-compose -f docker-compose.prod.yml exec redis redis-cli --rdb /data/dump.rdb
```

## Scaling

### Horizontal Scaling

```bash
# Scale backend workers
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Scale Celery workers
docker-compose -f docker-compose.prod.yml up -d --scale celery-worker=4
```

### Kubernetes Scaling

```bash
# Scale backend deployment
kubectl scale deployment upm-plus-backend --replicas=3 -n upm-plus

# Auto-scaling (requires metrics server)
kubectl autoscale deployment upm-plus-backend --min=2 --max=10 --cpu-percent=80 -n upm-plus
```

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   - Check PostgreSQL is running: `docker-compose ps postgres`
   - Verify DATABASE_URL format
   - Check network connectivity

2. **Redis connection errors:**
   - Verify Redis password matches
   - Check Redis is running: `docker-compose ps redis`

3. **Health check failures:**
   - Check service logs: `docker-compose logs <service>`
   - Verify environment variables
   - Check resource limits

4. **High memory usage:**
   - Scale workers horizontally
   - Adjust Celery concurrency
   - Review and optimize queries

### Getting Help

- Check logs: `docker-compose logs -f`
- Review health endpoint: `/health`
- Check Prometheus metrics: `:9090/metrics`
- Review Grafana dashboards

## Security Hardening

1. **Firewall Configuration:**
   - Only expose ports 80, 443, and 8000 (if needed)
   - Block direct database access from internet
   - Use VPN for admin access

2. **Regular Updates:**
   ```bash
   # Update images
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Security Scanning:**
   ```bash
   # Scan images
   trivy image upm-plus:latest
   ```

4. **Audit Logging:**
   - All authentication events are logged
   - Review logs regularly
   - Set up log aggregation (ELK, Loki, etc.)

## Maintenance

### Regular Tasks

- **Weekly:** Review logs and metrics
- **Monthly:** Update dependencies and security patches
- **Quarterly:** Review and optimize database queries
- **Annually:** Security audit and penetration testing

### Update Procedure

1. Backup database
2. Pull latest code
3. Run migrations: `alembic upgrade head`
4. Rebuild images: `docker-compose build`
5. Rolling restart: `docker-compose up -d`
6. Verify health checks
7. Monitor for issues

---

**Last Updated:** 2025-01-27  
**Version:** 1.0.0

