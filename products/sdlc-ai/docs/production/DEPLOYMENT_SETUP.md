# SDLC.ai Platform - Production Deployment Setup Guide

## Overview

This document provides comprehensive instructions for setting up the SDLC.ai platform in production environment with zero-downtime deployment, high availability, and disaster recovery capabilities.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Cloudflare Workers Configuration](#cloudflare-workers-configuration)
4. [Database Setup](#database-setup)
5. [Blue-Green Deployment](#blue-green-deployment)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Disaster Recovery](#disaster-recovery)
8. [Security Configuration](#security-configuration)
9. [Runbook](#runbook)

## Prerequisites

### Required Tools
- Node.js 18+ and npm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with appropriate permissions
- Domain access (sdlc.ai)
- SSL certificates managed by Cloudflare

### Environment Variables
```bash
# Authentication
export JWT_SECRET="your-jwt-secret-here"
export API_KEY_ENCRYPTION_KEY="your-api-key-encryption"
export SESSION_ENCRYPTION_KEY="your-session-encryption"

# External Services
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# Monitoring
export SENTRY_DSN="your-sentry-dsn"
export DATADOG_API_KEY="your-datadog-key"

# Backup
export BACKUP_ENCRYPTION_KEY="your-backup-encryption"
```

## Infrastructure Setup

### 1. Cloudflare Account Configuration

```bash
# Authenticate with Cloudflare
wrangler auth login

# Verify account access
wrangler whoami
```

### 2. D1 Database Setup

```bash
# Create production databases
wrangler d1 create sdlc-tenant-db
wrangler d1 create sdlc-auth-db
wrangler d1 create sdlc-documents-db
wrangler d1 create sdlc-vector-metadata-db
wrangler d1 create sdlc-policy-db

# Note the database IDs and update wrangler.toml
```

### 3. KV Namespaces

```bash
# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "RATE_LIMIT_CACHE"
wrangler kv:namespace create "EMBEDDING_CACHE"
wrangler kv:namespace create "SEARCH_CACHE"

# Create preview namespaces for development
wrangler kv:namespace create "CACHE" --preview
wrangler kv:namespace create "SESSIONS" --preview
```

### 4. R2 Storage Buckets

```bash
# Create R2 buckets
wrangler r2 bucket create sdlc-documents
wrangler r2 bucket create sdlc-backup-archive
wrangler r2 bucket create sdlc-temp-uploads
```

### 5. Vectorize Indexes

```bash
# Create vector indexes
wrangler vectorize create sdlc-semantic-search --preset openai-3-large
wrangler vectorize create sdlc-document-vectors --preset openai-3-large
wrangler vectorize create sdlc-code-vectors --preset openai-3-large
```

### 6. Queues

```bash
# Create message queues
wrangler queues create sdlc-document-processing
wrangler queues create sdlc-embedding
wrangler queues create sdlc-dlp-scan
wrangler queues create sdlc-notifications
wrangler queues create sdlc-backup
```

## Cloudflare Workers Configuration

### Production Environment Setup

Update your `wrangler.toml` with the actual IDs from the setup steps:

```toml
[env.production.d1_databases]
binding = "TENANT_DB"
database_name = "sdlc-tenant-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

[env.production.kv_namespaces]
binding = "CACHE"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

[env.production.r2_buckets]
binding = "DOCUMENTS"
bucket_name = "sdlc-documents"

[env.production.vectorize]
binding = "SEMANTIC_SEARCH_INDEX"
index_name = "sdlc-semantic-search"
preset = "openai-3-large"
```

### Set Production Secrets

```bash
# Authentication secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put API_KEY_ENCRYPTION_KEY --env production
wrangler secret put SESSION_ENCRYPTION_KEY --env production

# Service secrets
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put ANTHROPIC_API_KEY --env production

# Monitoring secrets
wrangler secret put SENTRY_DSN --env production
wrangler secret put DATADOG_API_KEY --env production
```

## Database Setup

### D1 Migrations

```bash
# Run database migrations
wrangler d1 migrations list sdlc-tenant-db --env production
wrangler d1 migrations apply sdlc-tenant-db --env production
wrangler d1 migrations apply sdlc-auth-db --env production
wrangler d1 migrations apply sdlc-documents-db --env production
wrangler d1 migrations apply sdlc-vector-metadata-db --env production
wrangler d1 migrations apply sdlc-policy-db --env production
```

### Database Backup Configuration

Configure automated backups in the Cloudflare dashboard:

1. Navigate to D1 databases
2. Select each database
3. Enable point-in-time recovery
4. Configure backup retention (30 days recommended)
5. Set up backup notifications

## Blue-Green Deployment

### Architecture Overview

```
Internet → Cloudflare CDN → DNS → [Blue/Green Environment]
                                    ├─ Blue (Active)
                                    └─ Green (Inactive)
```

### Deployment Process

1. **Deploy to Green Environment**
   ```bash
   ./deployments/cloudflare/scripts/deploy-production.sh
   ```

2. **Health Checks**
   - Automatic health verification
   - Database connectivity tests
   - API endpoint validation

3. **Traffic Switch**
   - DNS update with atomic switch
   - Zero downtime transition
   - Immediate rollback capability

4. **Monitoring**
   - Real-time error rate monitoring
   - Performance metrics tracking
   - Automatic rollback on threshold breach

### Manual Deployment Commands

```bash
# Deploy to specific environment
./deploy-production.sh --environment green

# Force rollback
./deploy-production.sh --rollback

# Check deployment status
./deploy-production.sh --status
```

## Monitoring and Alerting

### Cloudflare Analytics

Enable comprehensive analytics:

1. **Real-time Metrics**
   - Request count and rate
   - Error rates by status code
   - Response time percentiles
   - Geographic distribution

2. **Custom Metrics**
   ```javascript
   // In your Worker code
   env.ANALYTICS.writeDataPoint({
     blobs: [tenantId, operation],
     doubles: [responseTime, documentSize],
     indexes: [statusCode]
   });
   ```

### External Monitoring Integration

#### Sentry Configuration

```javascript
import * as Sentry from "@sentry/cloudflare";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.ENVIRONMENT,
  tracesSampleRate: 0.1,
});
```

#### DataDog Configuration

```javascript
// Send custom metrics to DataDog
const response = await fetch(`https://api.datadoghq.com/api/v1/series`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'DD-API-KEY': env.DATADOG_API_KEY,
  },
  body: JSON.stringify({
    series: [{
      metric: 'sdlc.api.response_time',
      points: [[Date.now() / 1000, responseTime]],
      tags: [`env:${env.ENVIRONMENT}`, `endpoint:${endpoint}`],
    }],
  }),
});
```

### Alert Configuration

Set up alerts for:

1. **Critical Alerts (Page/SMS)**
   - Error rate > 5%
   - Response time p95 > 5s
   - Database connection failures
   - Authentication failures > 1%

2. **Warning Alerts (Email/Slack)**
   - Error rate > 1%
   - Response time p95 > 2s
   - Queue backlog > 1000
   - Storage usage > 80%

## Disaster Recovery

### RTO/RPO Targets

- **Recovery Time Objective (RTO)**: 5 minutes
- **Recovery Point Objective (RPO)**: 1 minute

### Backup Strategy

1. **Database Backups**
   - Continuous point-in-time recovery
   - Daily full backups
   - Cross-region replication

2. **Storage Backups**
   - R2 Cross-Region Replication
   - Daily snapshots
   - 30-day retention

3. **Configuration Backups**
   - Git version control
   - Infrastructure as Code
   - Secret rotation logs

### Disaster Recovery Procedures

#### Scenario 1: Single Worker Failure

```bash
# Symptoms: 5xx errors from specific endpoint
# Impact: Limited functionality
# Recovery: Automatic failover to replica

# Manual recovery if needed
wrangler rollback --env production --version <previous-version>
```

#### Scenario 2: Database Connection Issues

```bash
# Symptoms: Database timeouts
# Impact: Read/write operations fail
# Recovery: Switch to read replica

# Check database status
wrangler d1 info sdlc-tenant-db --env production

# Initiate failover if needed
wrangler d1 failover --database sdlc-tenant-db --env production
```

#### Scenario 3: Complete Region Outage

```bash
# Symptoms: Service unavailable
# Impact: Full system outage
# Recovery: Activate DR region

# 1. Update DNS to DR region
wrangler route rule update --pattern="sdlc.ai/*" --zone-name="sdlc.ai" --worker="sdlc-platform-dr"

# 2. Restore databases from latest backup
wrangler d1 restore --database sdlc-tenant-db --timestamp <backup-timestamp>

# 3. Verify service health
curl https://dr.sdlc.ai/health
```

### Recovery Testing

1. **Monthly DR Drills**
   - Simulate outage scenarios
   - Test recovery procedures
   - Document recovery times
   - Update procedures based on results

2. **Chaos Engineering**
   ```javascript
   // Implement failure injection
   if (Math.random() < 0.01) { // 1% failure rate
     throw new Error("Simulated failure for testing");
   }
   ```

## Security Configuration

### 1. Network Security

```yaml
# WAF Rules
- Block SQL injection attempts
- Rate limit by IP
- Geographic blocking if needed
- Bot detection and mitigation
```

### 2. Application Security

```javascript
// Security headers
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'",
};
```

### 3. Secret Management

- Rotate secrets every 90 days
- Use Cloudflare's Secret Store
- Implement secret versioning
- Audit secret access

### 4. Access Control

```bash
# Create service accounts with minimal permissions
wrangler service-account create sdlc-deployer --permissions "deploy:read,deploy:write"

# Use short-lived tokens
wrangler token create --scopes "user:read" --expiration 1h
```

## Runbook

### Daily Operations

```bash
# Morning health check
curl https://api.sdlc.ai/health
wrangler analytics --since 24h

# Check error rates
wrangler analytics --filter="status:5xx" --since 24h

# Review queue backlogs
wrangler queues list --env production
```

### Weekly Operations

```bash
# Review performance metrics
wrangler analytics --since 7d --format json > metrics.json

# Check for security vulnerabilities
npm audit

# Review cost and usage
wrangler usage --since 7d
```

### Monthly Operations

```bash
# Update dependencies
npm update
npm test

# Run security scan
npm run security-scan

# Test disaster recovery
./scripts/test-dr.sh

# Review and rotate secrets
./scripts/rotate-secrets.sh
```

### Incident Response

1. **Detection**
   - Monitor alerts
   - Check dashboard
   - Review user reports

2. **Assessment**
   - Determine impact scope
   - Identify root cause
   - Estimate recovery time

3. **Response**
   - Implement fix
   - Deploy hotfix if needed
   - Monitor recovery

4. **Post-Incident**
   - Write incident report
   - Update procedures
   - Schedule follow-up

## Troubleshooting

### Common Issues

#### 1. Worker Timeouts

```bash
# Symptoms: 504 Gateway Timeout
# Causes: CPU limit exceeded, long-running operations
# Solutions:
- Optimize code efficiency
- Implement async processing with queues
- Increase CPU limits if needed
```

#### 2. Database Connection Errors

```bash
# Symptoms: Intermittent 500 errors
# Causes: Connection pool exhaustion, query timeouts
# Solutions:
- Implement connection pooling
- Add query timeouts
- Optimize database queries
```

#### 3. High Memory Usage

```bash
# Symptoms: Out of memory errors
# Causes: Large payloads, memory leaks
# Solutions:
- Implement streaming for large files
- Add memory monitoring
- Profile memory usage
```

### Debugging Commands

```bash
# View real-time logs
wrangler tail --env production

# Debug specific request
curl -v https://api.sdlc.ai/debug -H "Debug-Token: $DEBUG_TOKEN"

# Check worker metrics
wrangler metrics --env production

# Test configuration
wrangler dev --env production --local
```

## Performance Optimization

### 1. Caching Strategy

```javascript
// Implement multi-level caching
const cacheKey = `cache:${request.url}`;
const cached = await env.CACHE.get(cacheKey);

if (cached) {
  return new Response(cached, {
    headers: { 'X-Cache': 'HIT' },
  });
}

// Cache response for 1 hour
ctx.waitUntil(env.CACHE.put(cacheKey, response.clone().body, { expirationTtl: 3600 }));
```

### 2. Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_documents_tenant_created ON documents(tenant_id, created_at);
CREATE INDEX idx_vectors_metadata ON vectors(metadata);

-- Use prepared statements
PREPARE get_document AS SELECT * FROM documents WHERE id = ?;
```

### 3. CDN Optimization

```javascript
// Set cache headers
response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');

// Compress responses
response.headers.set('Content-Encoding', 'br');
```

## Scaling Strategy

### Horizontal Scaling

1. **Worker Replicas**
   - Automatic scaling based on request volume
   - Geographic distribution
   - Load balancing at edge

2. **Database Scaling**
   - Read replicas for read-heavy workloads
   - Database sharding for multi-tenant isolation
   - Connection pooling

3. **Storage Scaling**
   - R2 automatic scaling
   - CDN distribution
   - Cache warming strategies

### Vertical Scaling

1. **Resource Limits**
   ```toml
   [limits]
   cpu_ms = 50000  # Increase for CPU-intensive tasks
   memory_mb = 256 # Increase for memory-intensive tasks
   ```

2. **Optimization**
   - Profile CPU usage
   - Optimize algorithms
   - Implement lazy loading

## Conclusion

This production deployment setup provides:
- ✅ Zero-downtime deployments with blue-green strategy
- ✅ High availability with automatic failover
- ✅ Comprehensive monitoring and alerting
- ✅ Disaster recovery with RTO < 5 minutes
- ✅ Security best practices
- ✅ Performance optimization
- ✅ Scalable architecture

The setup ensures enterprise-grade reliability and performance for the SDLC.ai platform.

## Support

For issues and questions:
- Check the troubleshooting section
- Review Cloudflare documentation
- Contact the infrastructure team
- Create an incident ticket for critical issues