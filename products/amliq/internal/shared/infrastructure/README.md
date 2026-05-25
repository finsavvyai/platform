# Cloudflare Infrastructure Setup Guide

This guide provides comprehensive instructions for setting up the Cloudflare infrastructure required for the FinTech Suite.

## Prerequisites

1. **Cloudflare Account** with the following services enabled:
   - Workers
   - D1 (SQLite databases)
   - R2 (Object storage)
   - KV (Key-value storage)
   - Vectorize (Vector database)
   - Queues (Message queues)

2. **Required Tools**:
   ```bash
   npm install -g wrangler
   ```

3. **Domain Configuration**:
   - `finsavvyai.com` (primary domain)
   - `api.finsavvyai.com` (API subdomain)

## Quick Start

### 1. Health Check

Run the health check to verify your setup:
```bash
./infrastructure/cloudflare/health-check.sh
```

### 2. Automated Setup

Run the setup scripts in order:
```bash
# Set up D1 databases
./infrastructure/cloudflare/setup-databases.sh

# Set up R2 buckets
./infrastructure/cloudflare/setup-r2-buckets.sh

# Set up KV namespaces
./infrastructure/cloudflare/setup-kv-namespaces.sh

# Set up Vectorize indexes
./infrastructure/cloudflare/setup-vectorize-indexes.sh

# Set up Queues
./infrastructure/cloudflare/setup-queues.sh

# Set up environment variables
./infrastructure/cloudflare/environment-setup.sh
```

## Manual Configuration Steps

### 1. Update wrangler.toml

After running the setup scripts, update your `wrangler.toml` with the actual IDs returned by the creation commands:

```toml
# Update these with actual IDs from setup script output
[[d1_databases]]
binding = "DB_PRIMARY"
database_id = "your-actual-primary-db-id"
database_name = "fintech-unified-primary"

[[d1_databases]]
binding = "DB_SECONDARY"
database_id = "your-actual-secondary-db-id"
database_name = "fintech-unified-secondary"

[[d1_databases]]
binding = "DB_COMPLIANCE"
database_id = "your-actual-compliance-db-id"
database_name = "fintech-unified-compliance"

# Update KV namespace IDs
[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-actual-cache-kv-id"

# Update R2 bucket names
[[r2_buckets]]
binding = "DOCUMENTS_R2"
bucket_name = "fintech-documents-storage"

# Update Vectorize index names
[[vectorize]]
binding = "RAG_VECTORIZE"
index_name = "fintech-rag-index"
```

### 2. Configure Secrets

Copy the secrets template and fill in your actual values:
```bash
cp infrastructure/cloudflare/secrets-template.env infrastructure/cloudflare/secrets.env
# Edit infrastructure/cloudflare/secrets.env with your actual secrets
```

Set secrets using wrangler:
```bash
# Example for Stripe secret key
wrangler secret put STRIPE_SECRET_KEY < infrastructure/cloudflare/secrets.env

# Example for JWT secret
wrangler secret put JWT_SECRET < infrastructure/cloudflare/secrets.env
```

### 3. Configure Custom Domains

1. **API Domain** (`api.finsavvyai.com`):
   - Add custom domain in Cloudflare Dashboard
   - Update DNS records
   - Update `wrangler.toml` routes section

2. **Frontend Domain** (`finsavvyai.com`):
   - Configure SSL certificates
   - Set up DNS records
   - Update application URLs in environment variables

## Infrastructure Components

### D1 Databases

#### Primary Database (`fintech-unified-primary`)
- **Purpose**: Billing and intelligence data
- **Tables**: `billing_us_*`, `billing_eu_*`, `intelligence_us_*`, `intelligence_eu_*`
- **Regions**: Supports US/EU data separation

#### Secondary Database (`fintech-unified-secondary`)
- **Purpose**: Risk management and audit data
- **Tables**: `risk_*`, `organizations`, `audit_logs`, `api_keys`, `user_sessions`
- **Features**: Unified audit trail, user management

#### Compliance Database (`fintech-unified-compliance`)
- **Purpose**: KYC/AML and case management
- **Tables**: `compliance_us_*`, `compliance_eu_*`, `cases_*`, `evidence_*`
- **Compliance**: GDPR/CCPA ready with data retention policies

### R2 Storage Buckets

#### Documents Bucket (`fintech-documents-storage`)
- **Purpose**: Invoice PDFs, KYC documents, evidence files
- **Lifecycle**: 30 days → Standard IA → Glacier → Deep Archive
- **Retention**: 7 years (compliance requirement)

#### Backups Bucket (`fintech-backups-storage`)
- **Purpose**: Database backups and system backups
- **Lifecycle**: 7 days → Standard IA → Glacier → Deep Archive
- **Retention**: 7 years

#### Evidence Bucket (`fintech-evidence-storage`)
- **Purpose**: Compliance evidence and case files
- **Lifecycle**: 1 year → Standard IA → Glacier
- **Retention**: 10 years (regulatory requirement)

#### AI Models Bucket (`fintech-ai-models-storage`)
- **Purpose**: AI model files and training data
- **Lifecycle**: 90 days → Standard IA → Glacier
- **Retention**: 5 years

### KV Namespaces

- **CACHE_KV**: Application caching and performance optimization
- **SESSIONS_KV**: User session management and authentication tokens
- **AGENT_MEMORY_KV**: AI agent memory and context storage
- **RATE_LIMITS_KV**: API rate limiting and quota management
- **USER_PREFERENCES_KV**: User preferences and settings
- **ORGANIZATION_CONFIG_KV**: Organization configuration

### Vectorize Indexes

#### RAG Index (`fintech-rag-index`)
- **Purpose**: Financial documents, regulations, and knowledge base
- **Dimensions**: 768 (BGE-base-en-v1.5)
- **Use Cases**: Compliance queries, risk assessment, best practices

#### Document Index (`fintech-document-index`)
- **Purpose**: Transaction descriptions and merchant data
- **Dimensions**: 768 (BGE-base-en-v1.5)
- **Use Cases**: Categorization, pattern recognition, semantic search

### Queues

- **BILLING_QUEUE**: Invoice processing, payment handling, subscription management
- **COMPLIANCE_QUEUE**: KYC processing, sanctions screening, compliance monitoring
- **INTELLIGENCE_QUEUE**: Data analysis, forecasting, report generation
- **RISK_QUEUE**: Risk assessment, fraud detection, investigation workflows
- **NOTIFICATION_QUEUE**: Email alerts, SMS notifications, system updates

## Environment Configuration

### Development Environment
- **URLs**: `http://localhost:3000`, `https://fintech-unified-suite-dev.shaharsolomon.workers.dev`
- **Logging**: Debug level
- **Features**: All features enabled including AI

### Staging Environment
- **URLs**: `https://staging.finsavvyai.com`, `https://fintech-unified-suite-staging.shaharsolomon.workers.dev`
- **Logging**: Info level
- **Features**: Production feature set with test data

### Production Environment
- **URLs**: `https://finsavvyai.com`, `https://api.finsavvyai.com`
- **Logging**: Warning level
- **Features**: Full production feature set

## Security Configuration

### Required Secrets
- `STRIPE_SECRET_KEY`: Stripe API secret key
- `ONFIDO_API_KEY`: Onfido API key
- `COMPLYADVANTAGE_API_KEY`: ComplyAdvantage API key
- `OPENAI_API_KEY`: OpenAI API key
- `JWT_SECRET`: JWT signing secret
- `DATABASE_ENCRYPTION_KEY`: Database encryption key
- `R2_ACCESS_KEY_ID`: R2 access key
- `R2_SECRET_ACCESS_KEY`: R2 secret key

### Security Best Practices
1. **Never commit secrets** to version control
2. **Use separate secrets** for each environment
3. **Rotate secrets** regularly
4. **Monitor access logs** for secret usage
5. **Implement least privilege** access for API keys

## Monitoring and Maintenance

### Health Monitoring
- Run health checks regularly: `./infrastructure/cloudflare/health-check.sh`
- Monitor Cloudflare Dashboard for service status
- Set up alerts for service disruptions
- Track performance metrics and costs

### Database Maintenance
- Regular database backups using R2
- Monitor database size and query performance
- Archive old data according to retention policies
- Test disaster recovery procedures

### Cost Optimization
- Monitor Cloudflare service usage
- Optimize KV storage with appropriate TTL
- Use lifecycle policies for R2 storage
- Regular review of queue processing patterns

## Troubleshooting

### Common Issues

1. **Database Migration Failures**
   - Check SQL syntax in migration files
   - Verify foreign key constraints
   - Ensure sufficient permissions

2. **Queue Processing Delays**
   - Monitor queue depth
   - Check worker performance
   - Verify dead letter queue contents

3. **Vector Search Issues**
   - Verify embedding model compatibility
   - Check index configuration
   - Monitor search accuracy metrics

4. **Authentication Problems**
   - Verify JWT secret configuration
   - Check session KV storage
   - Review authentication flow logs

### Getting Help

1. Check the [Cloudflare documentation](https://developers.cloudflare.com/)
2. Review [Wrangler CLI documentation](https://developers.cloudflare.com/workers/wrangler/)
3. Check application logs in Cloudflare Dashboard
4. Run health check to identify configuration issues

## Deployment

### Pre-deployment Checklist
- [ ] All health checks pass
- [ ] Secrets configured for target environment
- [ ] Database migrations applied
- [ ] Custom domains configured
- [ ] SSL certificates valid
- [ ] Monitoring and alerting set up

### Deployment Commands
```bash
# Development deployment
wrangler deploy --env development

# Staging deployment
wrangler deploy --env staging

# Production deployment
wrangler deploy --env production
```

### Post-deployment Verification
1. Test API endpoints
2. Verify database connectivity
3. Check authentication flows
4. Test AI functionality
5. Validate performance metrics
6. Review monitoring dashboards

## Support

For infrastructure issues:
1. Check this documentation
2. Run the health check script
3. Review Cloudflare Dashboard
4. Contact infrastructure team with detailed error logs