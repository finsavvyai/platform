# SDLC.ai Platform - Production Deployment Guide

**Version:** 1.0  
**Last Updated:** 2025-11-04  
**Environment:** Production  

---

## Overview

This guide provides step-by-step instructions for deploying the SDLC.ai platform to production using our advanced blue-green deployment strategy with zero downtime.

## Prerequisites

### System Requirements
- **Node.js:** 18.x or higher
- **Wrangler CLI:** Latest version
- **Git:** Latest version
- **bash:** 4.x or higher
- **curl**, **jq**, **dig** commands

### Access Requirements
- Cloudflare account with Workers, D1, KV, R2, Vectorize enabled
- DNS management access for sdlc.cc domain
- Slack channel for notifications (optional)
- Email setup for alerts (optional)

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/sdlc/sdlc-platform.git
cd sdlc-platform

# Install dependencies
npm install

# Install Wrangler CLI
npm install -g wrangler

# Authenticate with Cloudflare
wrangler auth login

# Verify authentication
wrangler whoami
```

---

## Deployment Architecture

### Blue-Green Deployment Strategy
Our production deployment uses a blue-green strategy to ensure zero downtime:

1. **Blue Environment:** Currently active production environment
2. **Green Environment:** Staging environment for new deployments
3. **Traffic Switch:** Instant DNS switch between environments
4. **Rollback:** Immediate rollback capability if issues detected

### Production Infrastructure
- **Primary Domain:** api.sdlc.cc
- **Admin Domain:** admin.sdlc.cc
- **DR Domain:** dr.api.sdlc.cc (disaster recovery)
- **Monitoring:** Real-time metrics and alerting
- **Backup:** Automated backups with 1-minute RPO

---

## Deployment Process

### Step 1: Pre-Deployment Checks

```bash
# Run pre-deployment health checks
./scripts/pre-deployment-checks.sh

# Verify all environments are healthy
./scripts/health-check-all.sh

# Check backup status
./scripts/verify-backups.sh

# Validate deployment configuration
./scripts/validate-deployment-config.sh
```

### Step 2: Deploy to Production

#### Automated Deployment (Recommended)
```bash
# Deploy with blue-green strategy
./scripts/deploy-production.sh

# Deploy with verbose logging
./scripts/deploy-production.sh -v
```

#### Manual Deployment Steps
```bash
# 1. Build the application
npm run build

# 2. Run tests
npm test

# 3. Deploy to green environment
wrangler deploy --env production

# 4. Run health checks on green environment
./scripts/health-check.sh green

# 5. Switch traffic to green environment
./scripts/switch-traffic.sh green

# 6. Verify traffic switch
./scripts/verify-deployment.sh
```

### Step 3: Post-Deployment Validation

```bash
# Run comprehensive health checks
./scripts/comprehensive-health-check.sh

# Validate all endpoints
./scripts/validate-endpoints.sh

# Check monitoring metrics
./scripts/monitor-deployment.sh status

# Generate deployment report
./scripts/generate-deployment-report.sh
```

---

## Monitoring and Alerting

### Start Monitoring
```bash
# Start deployment monitoring
./scripts/monitor-deployment.sh start

# Check monitoring status
./scripts/monitor-deployment.sh status

# Generate monitoring report
./scripts/monitor-deployment.sh report detailed
```

### Configure Alerts
Edit `monitoring/alert-config.json`:
```json
{
    "alerts": {
        "error_rate": {
            "enabled": true,
            "threshold": 10,
            "severity": "critical"
        },
        "response_time": {
            "enabled": true,
            "threshold_ms": 2000,
            "severity": "warning"
        }
    },
    "notifications": {
        "webhook_url": "https://hooks.slack.com/...",
        "email_recipients": "team@sdlc.cc"
    }
}
```

---

## Rollback Procedures

### Automatic Rollback
The deployment script includes automatic rollback if:
- Error rate exceeds 10%
- Health checks fail
- Response time exceeds 5000ms

### Manual Rollback
```bash
# Immediate rollback to previous version
./scripts/rollback.sh "Performance issues detected"

# Rollback with specific reason
./scripts/rollback.sh "Critical bug in production"

# Check rollback history
./scripts/rollback.sh history
```

### Rollback Monitoring
```bash
# Monitor rollback progress
./scripts/rollback.sh status

# Verify rollback success
./scripts/verify-rollback.sh
```

---

## Disaster Recovery

### Initiate Disaster Recovery
```bash
# Full disaster recovery
./scripts/disaster-recovery.sh init critical "Production outage"

# Partial recovery
./scripts/disaster-recovery.sh init high "Database corruption"

# Service-specific recovery
./scripts/disaster-recovery.sh init medium "API Gateway issues"
```

### DR Status and Reporting
```bash
# Check DR status
./scripts/disaster-recovery.sh status

# Generate DR report
./scripts/disaster-recovery.sh report

# List DR history
./scripts/disaster-recovery.sh list
```

---

## Environment Configuration

### Production Environment Variables
Create `.env.production`:
```bash
# Authentication
JWT_SECRET=your-jwt-secret
API_KEY_ENCRYPTION_KEY=your-encryption-key
SESSION_ENCRYPTION_KEY=your-session-key

# External Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
DLP_API_KEY=your-dlp-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
DATADOG_API_KEY=your-datadog-key

# Notifications
WEBHOOK_URL=your-webhook-url
SLACK_WEBHOOK_URL=your-slack-webhook
ALERT_EMAIL=alerts@sdlc.cc
```

### Set Production Secrets
```bash
# Set secrets for production environment
wrangler secret put JWT_SECRET --env production
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put API_KEY_ENCRYPTION_KEY --env production
wrangler secret put SESSION_ENCRYPTION_KEY --env production
wrangler secret put DLP_API_KEY --env production
wrangler secret put BACKUP_ENCRYPTION_KEY --env production
wrangler secret put SENTRY_DSN --env production
wrangler secret put WEBHOOK_SECRET --env production
```

---

## Backup and Recovery

### Create Backups
```bash
# Full system backup
./scripts/backup-all.sh

# Database backup only
./scripts/backup-databases.sh

# Configuration backup
./scripts/backup-configurations.sh
```

### Restore from Backup
```bash
# Restore complete system
./scripts/restore-all.sh --backup latest

# Restore specific database
./scripts/restore-database.sh --database sdlc-documents-db --backup 2025-11-04

# Restore configurations
./scripts/restore-config.sh --backup latest
```

---

## Performance Optimization

### Pre-Deployment Optimization
```bash
# Optimize build
npm run build:prod

# Run performance benchmarks
./scripts/performance-benchmark.sh

# Optimize assets
./scripts/optimize-assets.sh
```

### Post-Deployment Monitoring
```bash
# Monitor response times
./scripts/monitor-response-times.sh

# Check error rates
./scripts/monitor-error-rates.sh

# Generate performance report
./scripts/performance-report.sh
```

---

## Security Checklist

### Pre-Deployment Security
- [ ] All secrets are encrypted and stored securely
- [ ] SSL/TLS certificates are valid
- [ ] Security headers are configured
- [ ] Rate limiting is enabled
- [ ] DLP scanning is active
- [ ] Audit logging is enabled

### Post-Deployment Security
- [ ] Run security scan
- [ ] Validate authentication flows
- [ ] Check authorization controls
- [ ] Monitor for suspicious activity
- [ ] Validate data encryption

---

## Troubleshooting

### Common Issues

#### Deployment Fails
```bash
# Check wrangler configuration
wrangler whoami
wrangler config list

# Validate wrangler.toml
./scripts/validate-wrangler-config.sh

# Check resource limits
wrangler limits
```

#### Health Check Failures
```bash
# Check worker logs
wrangler tail --format json

# Debug specific endpoint
curl -v https://api.sdlc.cc/health

# Check database connectivity
./scripts/test-database-connectivity.sh
```

#### High Error Rates
```bash
# Check current metrics
./scripts/monitor-deployment.sh metrics

# Analyze errors
./scripts/analyze-errors.sh

# Trigger rollback if needed
./scripts/rollback.sh "High error rate"
```

#### DNS Issues
```bash
# Check DNS propagation
dig +short api.sdlc.cc
nslookup api.sdlc.cc

# Verify Cloudflare routes
wrangler route rule list

# Flush DNS cache
sudo dscacheutil -flushcache  # macOS
# or
sudo systemctl flush-dns     # Linux
```

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug

# Run deployment with debug
./scripts/deploy-production.sh -v

# Monitor with debug output
./scripts/monitor-deployment.sh start &
LOG_LEVEL=debug ./scripts/monitor-deployment.sh status
```

---

## Maintenance

### Regular Tasks

#### Daily
- [ ] Check deployment status
- [ ] Review error logs
- [ ] Monitor performance metrics
- [ ] Verify backup completion

#### Weekly
- [ ] Update dependencies
- [ ] Run security scans
- [ ] Test rollback procedures
- [ ] Review capacity planning

#### Monthly
- [ ] Full DR drill
- [ ] Performance optimization review
- [ ] Security audit
- [ ] Documentation update

### Health Monitoring
```bash
# System health dashboard
./scripts/health-dashboard.sh

# Generate health report
./scripts/health-report.sh

# Automated health checks (add to cron)
0 */6 * * * /path/to/sdlc-platform/scripts/health-check-all.sh
```

---

## Contact and Support

### Emergency Contacts
- **DevOps Lead:** devops@sdlc.cc
- **CTO:** cto@sdlc.cc
- **Security Team:** security@sdlc.cc

### Documentation
- Architecture: `/docs/architecture.md`
- API Reference: `/docs/api/`
- Runbooks: `/docs/runbooks/`
- FAQ: `/docs/faq.md`

### Support Channels
- Slack: #sdlc-deployments
- Email: support@sdlc.cc
- Status Page: https://status.sdlc.cc

---

## Appendix

### Deployment Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `deploy-production.sh` | Main production deployment | `./scripts/deploy-production.sh` |
| `rollback.sh` | Automated rollback | `./scripts/rollback.sh [reason]` |
| `monitor-deployment.sh` | Deployment monitoring | `./scripts/monitor-deployment.sh start` |
| `disaster-recovery.sh` | DR orchestration | `./scripts/disaster-recovery.sh init` |
| `backup-all.sh` | System backup | `./scripts/backup-all.sh` |
| `health-check-all.sh` | Health validation | `./scripts/health-check-all.sh` |

### Performance Targets
- **API Response Time:** <500ms (p95)
- **Error Rate:** <0.1%
- **Uptime:** >99.9%
- **Deployment Time:** <5 minutes
- **Rollback Time:** <30 seconds

### Environment URLs
- **Production API:** https://api.sdlc.cc
- **Production Admin:** https://admin.sdlc.cc
- **Monitoring:** https://monitoring.sdlc.cc
- **Status Page:** https://status.sdlc.cc

---

## Quick Reference

### Essential Commands
```bash
# Deploy to production
./scripts/deploy-production.sh

# Check status
./scripts/monitor-deployment.sh status

# Rollback
./scripts/rollback.sh "Reason"

# Monitor health
./scripts/health-check-all.sh

# Create backup
./scripts/backup-all.sh

# DR recovery
./scripts/disaster-recovery.sh init critical "Reason"
```

### Environment Variables
```bash
export LOG_LEVEL=info
export WEBHOOK_URL=https://hooks.slack.com/...
export ALERT_EMAIL=team@sdlc.cc
export SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

---

**Document Version:** 1.0  
**Next Review:** 2025-12-04  
**Approved by:** DevOps Team