# UPM.Plus Production Deployment Guide

This guide will help you deploy UPM.Plus to production and make it ready for commercial use.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Security Configuration](#security-configuration)
3. [Database Setup](#database-setup)
4. [Payment Integration](#payment-integration)
5. [Monitoring & Observability](#monitoring--observability)
6. [Deployment](#deployment)
7. [Scaling](#scaling)
8. [Backup & Recovery](#backup--recovery)
9. [Commercial Features](#commercial-features)

## Prerequisites

### Required Services
- PostgreSQL 14+ (production database)
- Redis 6+ (caching and rate limiting)
- Docker & Docker Compose (recommended)
- SSL Certificate (Let's Encrypt recommended)

### Required Accounts
- Stripe account (for payments)
- OpenAI API key (for AI features)
- Optional: Sentry account (for error tracking)
- Optional: Cloudflare account (for CDN/DDoS protection)

## Security Configuration

### 1. Generate Secure Keys

```bash
# Generate SECRET_KEY (32+ characters)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate MFA_ENCRYPTION_KEY (32+ characters)
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Environment Variables

Copy `.env.production.example` to `.env.production` and configure:

```bash
cp .env.production.example .env.production
# Edit .env.production with your values
```

**Critical Security Settings:**
- `SECRET_KEY`: Must be unique and secure (32+ characters)
- `MFA_ENCRYPTION_KEY`: For MFA token encryption
- `ALLOWED_ORIGINS`: Only your production domains
- `ALLOWED_HOSTS`: Only your production domains
- `DEBUG=false`: Never enable in production
- `PRODUCTION=true`: Enable production mode

### 3. Database Security

- Use strong database passwords
- Enable SSL connections
- Restrict database access to application servers only
- Regular backups (automated)

### 4. API Security

- Enable rate limiting (already configured)
- Use HTTPS only
- Enable CORS with specific origins
- Implement API key authentication for programmatic access

## Database Setup

### PostgreSQL Production Database

```sql
-- Create database
CREATE DATABASE upmplus_prod;

-- Create user
CREATE USER upmplus_user WITH PASSWORD 'strong-password-here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE upmplus_prod TO upmplus_user;

-- Enable extensions
\c upmplus_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Run Migrations

```bash
cd backend
alembic upgrade head
```

## Payment Integration

### Stripe Setup

1. **Create Stripe Account**
   - Sign up at https://stripe.com
   - Get your API keys from dashboard

2. **Configure Webhooks**
   - Add webhook endpoint: `https://yourdomain.com/api/v1/billing/webhooks/stripe`
   - Subscribe to events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

3. **Set Environment Variables**
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### Subscription Tiers

The system includes 5 subscription tiers:

- **Free**: $0/month - Limited features
- **Starter**: $29/month - Basic automation
- **Professional**: $99/month - Advanced features
- **Business**: $299/month - Enterprise features
- **Enterprise**: $999/month - Unlimited + custom SLA

## Monitoring & Observability

### Health Checks

The application includes comprehensive health checks:

- `/health` - Basic health check
- `/health/detailed` - Detailed dependency checks
- `/metrics` - System metrics (Prometheus-compatible)
- `/readiness` - Kubernetes readiness probe
- `/liveness` - Kubernetes liveness probe

### Sentry Integration

1. Create Sentry project
2. Get DSN from Sentry dashboard
3. Set `SENTRY_DSN` in environment variables

### Prometheus Metrics

Metrics are available at `/metrics` endpoint. Configure Prometheus to scrape:

```yaml
scrape_configs:
  - job_name: 'upmplus'
    scrape_interval: 15s
    static_configs:
      - targets: ['yourdomain.com:8002']
```

## Deployment

### Docker Compose (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Manual Deployment

1. **Install Dependencies**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Configure Environment**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production
   ```

3. **Run Migrations**
   ```bash
   alembic upgrade head
   ```

4. **Start Application**
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
   ```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://localhost:8000/health;
        access_log off;
    }
}
```

## Scaling

### Horizontal Scaling

1. **Load Balancer**: Use Nginx or cloud load balancer
2. **Multiple Workers**: Run multiple uvicorn workers
3. **Database Connection Pooling**: Configure in database URL
4. **Redis Clustering**: For high availability

### Vertical Scaling

- Increase worker count: `--workers 8`
- Increase database connection pool
- Add more Redis memory

## Backup & Recovery

### Database Backups

```bash
# Automated daily backup
pg_dump -U upmplus_user upmplus_prod > backup_$(date +%Y%m%d).sql

# Restore
psql -U upmplus_user upmplus_prod < backup_20240101.sql
```

### Automated Backup Script

Create cron job for daily backups:

```bash
0 2 * * * /path/to/backup-script.sh
```

## Commercial Features

### Subscription Management

Users can:
- Subscribe to plans via `/api/v1/billing/subscriptions`
- Check usage limits via `/api/v1/billing/usage/check`
- View invoices via `/api/v1/billing/invoices`
- Cancel subscriptions via `/api/v1/billing/subscriptions/{id}/cancel`

### Usage Tracking

The system automatically tracks:
- API requests
- Workflow executions
- Browser sessions
- Storage usage
- Agent executions
- Document processing
- LLM tokens

### Billing

- Automatic invoice generation
- Usage-based overage charges
- Stripe payment processing
- Webhook handling for subscription events

## Production Checklist

- [ ] Secure environment variables configured
- [ ] Database migrations run
- [ ] SSL certificate installed
- [ ] Stripe account configured
- [ ] Monitoring set up (Sentry, Prometheus)
- [ ] Backups configured
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Health checks working
- [ ] Load balancer configured
- [ ] Firewall rules set
- [ ] Log rotation configured
- [ ] Error tracking enabled

## Support

For production support:
- Email: support@yourdomain.com
- Documentation: https://docs.yourdomain.com
- Status Page: https://status.yourdomain.com

## License

See LICENSE file for details.

