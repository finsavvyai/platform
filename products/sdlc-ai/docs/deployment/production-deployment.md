# Production Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring Setup](#monitoring-setup)
7. [Rollback Procedures](#rollback-procedures)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Requirements
- Cloudflare Enterprise account
- Custom domain configured
- SSL certificates installed
- Database access credentials
- API keys for external services
- Team permissions configured

### Checklist
- [ ] All code reviewed and approved
- [ ] All tests passing (95%+ coverage)
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Stakeholders notified
- [ ] Maintenance window scheduled

## Infrastructure Setup

### 1. Cloudflare Configuration

#### Worker Configuration
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Create production namespace
wrangler kv:namespace create "PRODUCTION_CACHE" --preview=false
wrangler kv:namespace create "PRODUCTION_SESSIONS" --preview=false
wrangler d1 create "sdlc-production-db"
wrangler vectorize create "sdlc-production-vectors"
```

#### Production Wrangler.toml
```toml
name = "sdlc-production"
main = "src/worker.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "sdlc-production"
vars = { ENVIRONMENT = "production" }
kv_namespaces = [
  { binding = "CACHE", id = "xxxx-xxxx-xxxx", preview_id = false },
  { binding = "SESSIONS", id = "yyyy-yyyy-yyyy", preview_id = false }
]

[[env.production.d1_databases]]
binding = "DB"
database_name = "sdlc-production-db"
database_id = "zzzz-zzzz-zzzz"

[[env.production.vectorize]]
binding = "VECTORS"
index_name = "sdlc-production-vectors"

[env.production.route]
pattern = "api.sdlc.ai/*"
zone_name = "sdlc.ai"
```

### 2. Database Setup

#### D1 Database Migration
```bash
# Apply production migrations
wrangler d1 execute sdlc-production-db --file=./migrations/001_initial_schema.sql
wrangler d1 execute sdlc-production-db --file=./migrations/002_production_data.sql
wrangler d1 execute sdlc-production-db --file=./migrations/003_indexes.sql
```

#### Vector Index Configuration
```bash
# Create production vector index
curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/vectorize/indexes" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sdlc-production-vectors",
    "config": {
      "dimensions": 1536,
      "metric": "cosine"
    }
  }'
```

### 3. R2 Storage Setup
```bash
# Create production buckets
wrangler r2 bucket create sdlc-production-docs
wrangler r2 bucket create sdlc-production-backups
wrangler r2 bucket create sdlc-production-exports

# Configure lifecycle policies
wrangler r2 bucket put sdlc-production-docs --lifecycle-config='{
  "Rules": [
    {
      "ID": "DeleteOldExports",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "exports/"
      },
      "Expiration": {
        "Days": 30
      }
    }
  ]
}'
```

## Environment Configuration

### 1. Environment Variables
```typescript
// src/config/production.ts
export const productionConfig = {
  // Database
  database: {
    url: process.env.DATABASE_URL,
    maxConnections: 50,
    ssl: true
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: '1h',
    refreshTokenExpiresIn: '7d',
    issuer: 'https://api.sdlc.ai'
  },
  
  // External APIs
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
    maxTokens: 1000000,
    rateLimit: 10000
  },
  
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 500000,
    rateLimit: 5000
  },
  
  // R2 Storage
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: 'sdlc-production-docs'
  },
  
  // Monitoring
  monitoring: {
    enabled: true,
    endpoint: process.env.MONITORING_ENDPOINT,
    apiKey: process.env.MONITORING_API_KEY
  },
  
  // Security
  security: {
    rateLimiting: {
      enabled: true,
      requestsPerMinute: 1000,
      burstSize: 2000
    },
    cors: {
      allowedOrigins: ['https://app.sdlc.ai', 'https://admin.sdlc.ai'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
};
```

### 2. Secrets Management
```bash
# Set production secrets
wrangler secret put JWT_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put DATABASE_URL
wrangler secret put MONITORING_API_KEY
```

## Deployment Process

### 1. Pre-Deployment Checks
```bash
#!/bin/bash
# pre-deploy-check.sh

echo "Running pre-deployment checks..."

# Check if all tests pass
npm test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Aborting deployment."
  exit 1
fi

# Check code coverage
npm run coverage
COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
if (( $(echo "$COVERAGE < 95" | bc -l) )); then
  echo "❌ Code coverage below 95%. Current: $COVERAGE%"
  exit 1
fi

# Run security audit
npm audit --audit-level moderate
if [ $? -ne 0 ]; then
  echo "❌ Security vulnerabilities found. Aborting deployment."
  exit 1
fi

# Run linting
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting errors found. Aborting deployment."
  exit 1
fi

echo "✅ All checks passed. Proceeding with deployment."
```

### 2. Blue-Green Deployment
```bash
#!/bin/bash
# deploy-production.sh

set -e

BLUE_ENV="blue"
GREEN_ENV="green"
CURRENT_ENV=$(curl -s https://api.sdlc.ai/health | jq -r '.environment')

# Determine which environment to deploy to
if [ "$CURRENT_ENV" = "$BLUE_ENV" ]; then
  TARGET_ENV="$GREEN_ENV"
else
  TARGET_ENV="$BLUE_ENV"
fi

echo "Current environment: $CURRENT_ENV"
echo "Deploying to: $TARGET_ENV"

# Deploy to target environment
wrangler deploy --env $TARGET_ENV

# Health check on new deployment
echo "Performing health check..."
for i in {1..10}; do
  if curl -f https://$TARGET_ENV.api.sdlc.ai/health > /dev/null 2>&1; then
    echo "✅ Health check passed on iteration $i"
    break
  else
    echo "⏳ Health check failed on iteration $i, retrying..."
    sleep 10
  fi
  
  if [ $i -eq 10 ]; then
    echo "❌ Health check failed after 10 attempts. Rolling back..."
    # Trigger rollback
    ./scripts/rollback.sh $TARGET_ENV
    exit 1
  fi
done

# Run smoke tests
npm run smoke-tests -- --env=$TARGET_ENV
if [ $? -ne 0 ]; then
  echo "❌ Smoke tests failed. Rolling back..."
  ./scripts/rollback.sh $TARGET_ENV
  exit 1
fi

# Switch traffic to new deployment
echo "Switching traffic to $TARGET_ENV..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/{ruleset_id}" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d "{
    \"rules\": [
      {
        \"action\": \"route\",
        \"expression\": \"true\",
        \"description\": \"Route to $TARGET_ENV\",
        \"action_parameters\": {
          \"origin\": {
            \"host\": \"$TARGET_ENV.api.sdlc.ai\"
          }
        }
      }
    ]
  }"

echo "✅ Deployment successful! Traffic switched to $TARGET_ENV"
echo "📊 Updating monitoring dashboard..."
./scripts/update-monitoring.sh $TARGET_ENV
```

### 3. Migration Script
```bash
#!/bin/bash
# migrate-database.sh

VERSION=$1
BACKUP_NAME="pre-migration-$(date +%Y%m%d-%H%M%S)"

echo "Starting migration to version $VERSION"

# Create backup
echo "Creating backup: $BACKUP_NAME"
wrangler d1 execute sdlc-production-db --command "VACUUM INTO '/backup/$BACKUP_NAME.db'"

# Apply migration
echo "Applying migration $VERSION"
wrangler d1 execute sdlc-production-db --file="./migrations/$VERSION.sql"

# Verify migration
echo "Verifying migration..."
if npm run verify-migration -- --version=$VERSION; then
  echo "✅ Migration $VERSION completed successfully"
else
  echo "❌ Migration $VERSION failed. Restoring backup..."
  wrangler d1 execute sdlc-production-db --command "DROP TABLE IF EXISTS main;"
  wrangler d1 execute sdlc-production-db --command "ATTACH '/backup/$BACKUP_NAME.db' AS backup;"
  wrangler d1 execute sdlc-production-db --command "CREATE TABLE main AS SELECT * FROM backup.main;"
  exit 1
fi
```

## Post-Deployment Verification

### 1. Automated Health Checks
```typescript
// health-check.ts
export async function performHealthChecks() {
  const checks = [
    {
      name: 'API Gateway',
      url: 'https://api.sdlc.ai/health',
      expectedStatus: 200
    },
    {
      name: 'Authentication',
      url: 'https://api.sdlc.ai/auth/health',
      expectedStatus: 200
    },
    {
      name: 'Document Service',
      url: 'https://api.sdlc.ai/documents/health',
      expectedStatus: 200
    },
    {
      name: 'RAG Service',
      url: 'https://api.sdlc.ai/rag/health',
      expectedStatus: 200
    },
    {
      name: 'Database Connection',
      check: async () => {
        const result = await env.DB.prepare('SELECT 1').first();
        return result !== undefined;
      }
    },
    {
      name: 'Vector Index',
      check: async () => {
        const result = await env.VECTORS.query([0.1, 0.2, 0.3], { topK: 1 });
        return result.matches.length >= 0;
      }
    }
  ];

  const results = [];
  
  for (const check of checks) {
    try {
      if (check.url) {
        const response = await fetch(check.url);
        results.push({
          name: check.name,
          status: response.status === check.expectedStatus ? 'PASS' : 'FAIL',
          responseTime: Date.now()
        });
      } else if (check.check) {
        const result = await check.check();
        results.push({
          name: check.name,
          status: result ? 'PASS' : 'FAIL'
        });
      }
    } catch (error) {
      results.push({
        name: check.name,
        status: 'FAIL',
        error: error.message
      });
    }
  }

  return results;
}
```

### 2. Performance Validation
```typescript
// performance-validation.ts
export async function validatePerformance() {
  const endpoints = [
    { path: '/auth/login', method: 'POST', expectedP95: 500 },
    { path: '/documents', method: 'GET', expectedP95: 300 },
    { path: '/rag/query', method: 'POST', expectedP95: 2000 },
    { path: '/vector/search', method: 'POST', expectedP95: 100 }
  ];

  for (const endpoint of endpoints) {
    const measurements = [];
    
    // Perform 100 requests
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await fetch(`https://api.sdlc.ai${endpoint.path}`, {
        method: endpoint.method,
        headers: { Authorization: `Bearer ${process.env.TEST_TOKEN}` }
      });
      measurements.push(Date.now() - start);
    }

    // Calculate p95
    measurements.sort((a, b) => a - b);
    const p95 = measurements[Math.floor(measurements.length * 0.95)];

    if (p95 > endpoint.expectedP95) {
      throw new Error(
        `Performance threshold exceeded for ${endpoint.path}: ` +
        `p95=${p95}ms, expected=${endpoint.expectedP95}ms`
      );
    }

    console.log(`✅ ${endpoint.path}: p95=${p95}ms (threshold=${endpoint.expectedP95}ms)`);
  }
}
```

## Monitoring Setup

### 1. Prometheus Metrics Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'sdlc-api'
    static_configs:
      - targets: ['api.sdlc.ai']
    metrics_path: '/metrics'
    scrape_interval: 10s
    
  - job_name: 'cloudflare-workers'
    static_configs:
      - targets: ['workers.cloudflare.com']
```

### 2. Grafana Dashboard
```json
{
  "dashboard": {
    "title": "SDLC Production Dashboard",
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
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_users_total"
          }
        ]
      }
    ]
  }
}
```

### 3. Alerting Rules
```yaml
# alerts.yml
groups:
  - name: sdlc-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "P95 response time is {{ $value }}s"
          
      - alert: DatabaseConnectionFailed
        expr: up{job="database"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failed"
          description: "Cannot connect to the database"
```

## Rollback Procedures

### 1. Automated Rollback Script
```bash
#!/bin/bash
# rollback.sh

TARGET_ENV=$1
PREVIOUS_VERSION=$2

echo "Rolling back $TARGET_ENV to version $PREVIOUS_VERSION"

# Restore previous code
git checkout $PREVIOUS_VERSION
wrangler deploy --env $TARGET_ENV

# Restore database if needed
if [ "$3" = "--restore-db" ]; then
  echo "Restoring database..."
  BACKUP_NAME=$4
  wrangler d1 execute sdlc-production-db --command "DROP TABLE IF EXISTS main;"
  wrangler d1 execute sdlc-production-db --command "ATTACH '/backup/$BACKUP_NAME.db' AS backup;"
  wrangler d1 execute sdlc-production-db --command "CREATE TABLE main AS SELECT * FROM backup.main;"
fi

# Verify rollback
npm run smoke-tests -- --env=$TARGET_ENV
if [ $? -eq 0 ]; then
  echo "✅ Rollback successful"
  
  # Switch traffic back
  curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/rulesets/{ruleset_id}" \
    -H "Authorization: Bearer {token}" \
    -H "Content-Type: application/json" \
    -d '{
      "rules": [
        {
          "action": "route",
          "expression": "true",
          "description": "Route to rolled back version",
          "action_parameters": {
            "origin": {
              "host": "$TARGET_ENV.api.sdlc.ai"
            }
          }
        }
      ]
    }'
    
  # Notify team
  curl -X POST "https://hooks.slack.com/services/{webhook}" \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"🚨 Production rollback completed successfully\",
      \"attachments\": [
        {
          \"color\": \"warning\",
          \"fields\": [
            {
              \"title\": \"Environment\",
              \"value\": \"$TARGET_ENV\",
              \"short\": true
            },
            {
              \"title\": \"Version\",
              \"value\": \"$PREVIOUS_VERSION\",
              \"short\": true
            },
            {
              \"title\": \"Time\",
              \"value\": \"$(date)\",
              \"short\": true
            }
          ]
        }
      ]
    }"
else
  echo "❌ Rollback verification failed"
  exit 1
fi
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Worker Deployment Fails
**Error**: `Worker script exceeds size limit`
**Solution**:
- Minify the worker bundle
- Split into multiple workers
- Use dynamic imports for non-critical code

#### 2. Database Connection Timeout
**Error**: `Connection timeout after 30 seconds`
**Solution**:
- Check database credentials
- Verify network connectivity
- Increase timeout in configuration
- Check connection pool settings

#### 3. Vector Search Slow Performance
**Error**: `Query taking >10 seconds`
**Solution**:
- Check vector index size
- Optimize indexing strategy
- Consider using approximate nearest neighbor
- Review query parameters

#### 4. High Memory Usage
**Error**: `Worker exceeded memory limit`
**Solution**:
- Optimize memory usage
- Implement streaming for large responses
- Use Web Workers for CPU-intensive tasks
- Increase memory limits if possible

### Debug Mode
```typescript
// Enable debug logging
export const debugConfig = {
  enabled: process.env.DEBUG === 'true',
  level: process.env.LOG_LEVEL || 'info',
  exclude: ['password', 'token', 'secret']
};

// Debug middleware
export function debugMiddleware(request: Request, env: Env) {
  if (debugConfig.enabled) {
    console.log({
      method: request.method,
      url: request.url,
      headers: sanitizeHeaders(request.headers),
      timestamp: new Date().toISOString()
    });
  }
}
```

### Health Endpoint
```typescript
// Enhanced health endpoint
export async function healthCheck(request: Request, env: Env): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: env.VERSION,
    environment: env.ENVIRONMENT,
    checks: {
      database: await checkDatabase(env),
      vectorIndex: await checkVectorIndex(env),
      externalApis: await checkExternalApis(env),
      memory: checkMemoryUsage(),
      uptime: process.uptime()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');
  
  return new Response(JSON.stringify(health), {
    status: isHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## Conclusion

This production deployment guide provides a comprehensive process for deploying SDLC.ai to production with:
- Zero-downtime deployments
- Automated rollback capabilities
- Comprehensive monitoring
- Performance validation
- Security best practices

Always perform deployments during scheduled maintenance windows and ensure all team members are available for immediate response if issues arise.

For additional support, contact the DevOps team at devops@sdlc.ai or check the troubleshooting documentation.