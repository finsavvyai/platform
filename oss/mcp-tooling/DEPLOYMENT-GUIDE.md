# MCPOverflow Deployment Guide

Complete guide for deploying MCPOverflow to staging and production environments.

## Quick Start

### 1. Prerequisites

Required tools:
- Node.js 18+
- npm 9+
- Docker & Docker Compose
- Cloudflare account and wrangler CLI
- Supabase project
- Git

Install Cloudflare Wrangler:
```bash
npm install -g wrangler
```

### 2. Environment Setup

Create `.env` file using `.env.example`:
```bash
cp .env.example .env
# Fill in your actual values
```

Required environment variables:
```bash
# Database (Supabase)
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_ACCESS_TOKEN=your_access_token
SUPABASE_DB_PASSWORD=your_db_password

# Cloudflare (for deployment)
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Error Tracking (Sentry)
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_auth_token
SENTRY_ORG=your_sentry_org

# Notifications (Optional)
SLACK_WEBHOOK_URL=your_slack_webhook
```

### 3. Start Local Development

```bash
# Install dependencies
npm run bootstrap

# Start development servers
npm run dev

# Start monitoring stack
docker-compose up -d prometheus grafana
```

## Staging Deployment

### Automated Staging Deployment

```bash
# Deploy to staging environment
./scripts/deploy-staging.sh
```

### Manual Staging Steps

1. **Run Tests**:
   ```bash
   npm run test:run
   ```

2. **Build Applications**:
   ```bash
   npm run build
   ```

3. **Deploy to Cloudflare Pages**:
   ```bash
   # Marketing site
   wrangler pages deploy dist-marketing \
     --project-name mcpoverflow-marketing-staging \
     --env staging

   # Developer platform
   wrangler pages deploy dist-dev-platform \
     --project-name mcpoverflow-dev-platform-staging \
     --env staging

   # AI platform
   wrangler pages deploy dist-ai-platform \
     --project-name mcpoverflow-ai-platform-staging \
     --env staging
   ```

4. **Deploy Workers**:
   ```bash
   # If you have workers in the workers/ directory
   wrangler deploy --env staging
   ```

### Staging URLs

- Marketing: `https://staging-marketing.mcpoverflow.io`
- Developer App: `https://staging-app.mcpoverflow.io`
- AI Platform: `https://staging-ai.mcpoverflow.io`

## Production Deployment

### Automated Production Deployment

```bash
# Deploy to production (requires confirmation)
./scripts/deploy-production.sh
```

### Manual Production Steps

1. **Safety Checks**:
   ```bash
   # Ensure you're on main branch
   git checkout main
   git pull origin main

   # Check working directory is clean
   git status

   # Run full test suite
   npm run test:run
   npm run typecheck
   ```

2. **Build for Production**:
   ```bash
   # Set production environment
   export NODE_ENV=production
   export ENVIRONMENT=production

   # Build all applications
   npm run build
   ```

3. **Deploy to Production**:
   ```bash
   # Deploy marketing site
   wrangler pages deploy dist-marketing \
     --project-name mcpoverflow-marketing \
     --production

   # Deploy developer platform
   wrangler pages deploy dist-dev-platform \
     --project-name mcpoverflow-dev-platform \
     --production

   # Deploy AI platform
   wrangler pages deploy dist-ai-platform \
     --project-name mcpoverflow-ai-platform \
     --production
   ```

4. **Deploy Workers**:
   ```bash
   wrangler deploy --production
   ```

5. **Database Migrations**:
   ```bash
   # Run Supabase migrations
   supabase db push
   ```

### Production URLs

- Marketing: `https://mcpoverflow.com`
- Developer App: `https://app.mcpoverflow.io`
- AI Platform: `https://mcpoverflow.ai`

## Monitoring & Observability

### Local Monitoring

Start the monitoring stack:
```bash
docker-compose up -d prometheus grafana
```

Access dashboards:
- **Grafana**: http://localhost:3002
  - Username: `admin`
  - Password: `mcpoverflow_admin`
- **Prometheus**: http://localhost:9091

### Production Monitoring

1. **Grafana Dashboards**:
   - API Metrics: Request rates, latency, errors
   - Infrastructure: CPU, memory, disk usage

2. **Sentry Error Tracking**:
   - Automatic error capture
   - Performance monitoring
   - Session replay

3. **Alert Setup**:
   ```bash
   # Configure alerts in Grafana UI
   # Or set up alert rules in prometheus.yml
   ```

## Configuration

### Cloudflare Pages Configuration

Create `wrangler.toml` for each application:

```toml
name = "mcpoverflow-marketing"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.staging]
name = "mcpoverflow-marketing-staging"

[env.production]
name = "mcpoverflow-marketing"
```

### Database Configuration

Supabase migrations are in the `supabase/` directory:

```bash
# Generate migration
supabase db diff --use-migra

# Apply migrations
supabase db push
```

### Monitoring Configuration

Update monitoring settings in `docker-compose.yml`:

```yaml
services:
  prometheus:
    ports:
      - "9091:9090"  # Prometheus on port 9091

  grafana:
    ports:
      - "3002:3000"  # Grafana on port 3002
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**:
   ```bash
   # Check what's using ports
   lsof -i :3002
   lsof -i :9091

   # Kill processes if needed
   kill -9 <PID>
   ```

2. **Build Failures**:
   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Deployment Failures**:
   ```bash
   # Check Cloudflare auth
   wrangler whoami

   # Verify tokens are valid
   curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/user/tokens/verify"
   ```

4. **Monitoring Issues**:
   ```bash
   # Check Docker containers
   docker-compose ps

   # View logs
   docker-compose logs prometheus
   docker-compose logs grafana
   ```

### Deployment Rollback

1. **Cloudflare Pages Rollback**:
   ```bash
   # View deployment history
   wrangler pages deployment list --project-name mcpoverflow-marketing

   # Rollback to previous deployment
   wrangler pages deployment rollback <deployment-id> \
     --project-name mcpoverflow-marketing
   ```

2. **Database Rollback**:
   ```bash
   # View migration history
   supabase db history

   # Rollback migration (dangerous!)
   supabase db reset
   ```

## Security Considerations

### Production Security

1. **Environment Variables**:
   - Never commit `.env` files
   - Use GitHub Secrets for CI/CD
   - Rotate tokens regularly

2. **Access Control**:
   - Enable branch protection
   - Require PR reviews for production
   - Use deployment approval gates

3. **Monitoring**:
   - Set up security alerts
   - Monitor for unusual activity
   - Regular security audits

### Backup Strategy

1. **Database Backups**:
   - Enable daily automated backups in Supabase
   - Test restore procedures

2. **Configuration Backups**:
   ```bash
   # Backup monitoring configs
   tar -czf monitoring-backup-$(date +%Y%m%d).tar.gz \
     docker/grafana/ docker/prometheus/
   ```

## Performance Optimization

### Build Optimization

1. **Bundle Analysis**:
   ```bash
   # Analyze bundle sizes
   npm run build -- --analyze
   ```

2. **Caching**:
   - Configure Cloudflare caching rules
   - Set appropriate cache headers

3. **CDN Configuration**:
   - Enable Argo Smart Routing
   - Configure image optimization

### Monitoring Performance

1. **Key Metrics**:
   - Core Web Vitals (LCP, FID, CLS)
   - API response times (p95 < 1s)
   - Error rate (< 1%)

2. **Alert Thresholds**:
   ```yaml
   # Example Prometheus rules
   - alert: HighErrorRate
     expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
     for: 5m
   ```

## Support

### Getting Help

1. **Documentation**:
   - [Production Readiness](./PRODUCTION-READINESS-SUMMARY.md)
   - [Monitoring Setup](./docs/MONITORING-SETUP.md)
   - [Sentry Setup](./docs/SENTRY-SETUP.md)

2. **Debug Information**:
   ```bash
   # System info for debugging
   node --version
   npm --version
   docker --version
   wrangler --version
   git --version
   ```

3. **Contact**:
   - Create issue in GitHub repository
   - Check Slack for deployment notifications
   - Review monitoring dashboards

---

**Last Updated**: 2025-11-20
**Version**: MCPOverflow v0.1.4