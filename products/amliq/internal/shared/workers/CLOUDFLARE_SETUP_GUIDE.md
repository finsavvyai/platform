# FinTech Suite Cloudflare Setup Guide

This guide will help you configure all the necessary Cloudflare services for your FinTech suite using Wrangler.

## Prerequisites

1. **Cloudflare Account**: You need an active Cloudflare account with a paid plan for Workers, D1, R2, and Queues.
2. **Domain**: Your domain (finsavvyai.com) should be added to your Cloudflare account.
3. **Node.js and npm**: Required for Wrangler CLI.
4. **API Token**: Generate a Cloudflare API token with appropriate permissions.

## Installation

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

Or use API token:

```bash
export CLOUDFLARE_API_TOKEN=your_api_token_here
```

## Quick Setup (Recommended)

Run the master setup script to configure all services:

```bash
cd workers
./setup-cloudflare-services.sh
```

This will create:
- ✅ 8 D1 databases (multi-region setup)
- ✅ 5 KV namespaces
- ✅ 4 R2 buckets
- ✅ 5 Cloudflare Queues
- ✅ 1 Vectorize index
- ✅ Basic secrets configuration

## Manual Setup (Optional)

If you prefer to set up services individually, use the following scripts:

### D1 Databases

```bash
cd workers
./scripts/setup-d1.sh
```

Creates:
- `finsavvy-billing-us` & `finsavvy-billing-eu`
- `finsavvy-compliance-us` & `finsavvy-compliance-eu`
- `finsavvy-intelligence-us` & `finsavvy-intelligence-eu`
- `finsavvy-risk-us` & `finsavvy-risk-eu`

### KV Namespaces

```bash
cd workers
./scripts/setup-kv.sh
```

Creates:
- `CACHE_KV` - Application caching
- `SESSIONS_KV` - User session management
- `AGENT_MEMORY_KV` - AI agent memory
- `RATE_LIMITS_KV` - Rate limiting data
- `USER_PREFERENCES_KV` - User preferences

### R2 Storage

```bash
cd workers
./scripts/setup-r2.sh
```

Creates:
- `finsavvy-documents` - Document storage
- `finsavvy-evidence` - Compliance evidence
- `finsavvy-backups` - Database backups
- `finsavvy-ai-models` - AI model files

### Cloudflare Queues

```bash
cd workers
./scripts/setup-queues.sh
```

Creates:
- `finsavvy-billing-queue` - Billing operations
- `finsavvy-compliance-queue` - Compliance checks
- `finsavvy-intelligence-queue` - Financial analysis
- `finsavvy-risk-queue` - Risk assessment
- `finsavvy-notification-queue` - Notifications

### Secrets Configuration

```bash
cd workers
./scripts/setup-secrets.sh
```

Configure secrets from your `.env.local` file. Make sure to update placeholder values with actual API keys and secrets.

## Configuration

### Update wrangler.toml

After creating resources, update your `wrangler.toml` with the actual resource IDs:

```bash
# List resources and update IDs
wrangler d1 list
wrangler kv namespace list
wrangler r2 bucket list
wrangler queues list
```

Replace placeholder IDs in `wrangler.toml`:
- `DB_BILLING_US_ID` → Actual D1 database ID
- `CACHE_KV_ID` → Actual KV namespace ID
- etc.

### Environment Variables

Update your `.env.local` with actual values:

```bash
# Cloudflare Configuration
CLOUDFLARE_API_TOKEN=your_actual_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ZONE_ID=your_zone_id

# Database IDs (from wrangler d1 list)
DB_BILLING_US_ID=actual_database_id
DB_BILLING_EU_ID=actual_database_id
# ... other database IDs

# KV Namespace IDs (from wrangler kv namespace list)
CACHE_KV_ID=actual_kv_namespace_id
SESSIONS_KV_ID=actual_kv_namespace_id
# ... other KV IDs
```

## Deployment

### Development Deployment

```bash
cd workers
./scripts/deploy.sh development
```

### Staging Deployment

```bash
cd workers
./scripts/deploy.sh staging
```

### Production Deployment

```bash
cd workers
./scripts/deploy.sh production
```

## Post-Deployment Configuration

### 1. Custom Domains

Configure custom domains in the Cloudflare dashboard:

- `api.finsavvyai.com` → Main API
- `billing.finsavvyai.com` → Billing service
- `compliance.finsavvyai.com` → Compliance service
- `intelligence.finsavvyai.com` → Intelligence service
- `risk.finsavvyai.com` → Risk service

### 2. Database Schema

Apply database migrations to your D1 databases:

```bash
# Apply schema to billing database
wrangler d1 execute finsavvy-billing-us --file=./schema/billing.sql

# Apply schema to compliance database
wrangler d1 execute finsavvy-compliance-us --file=./schema/compliance.sql

# ... repeat for other databases
```

### 3. R2 Bucket Configuration

Configure bucket settings in Cloudflare dashboard:

- **Lifecycle rules**: Set up automatic cleanup for old files
- **Public access**: Configure as needed for your use case
- **CORS rules**: Configure cross-origin access if required

### 4. Monitoring and Analytics

Set up monitoring:

```bash
# View real-time logs
wrangler tail

# Set up analytics (if using Cloudflare Analytics)
# Configure in Cloudflare dashboard
```

## Security Configuration

### 1. Worker Security

- Configure CORS settings in your worker code
- Set up proper authentication middleware
- Enable rate limiting using KV namespaces

### 2. Database Security

- Use Row Level Security (RLS) policies
- Implement proper access controls
- Regular backups using R2

### 3. API Security

- Configure API gateway settings
- Set up WAF rules in Cloudflare
- Monitor for suspicious activity

## Troubleshooting

### Common Issues

1. **Authentication Errors**:
   ```bash
   wrangler whoami  # Check authentication
   wrangler login   # Re-authenticate if needed
   ```

2. **Resource Already Exists**:
   - Scripts handle existing resources gracefully
   - Check resource names in Cloudflare dashboard

3. **Permission Errors**:
   - Ensure your API token has sufficient permissions
   - Check account and zone access

4. **Deployment Failures**:
   ```bash
   wrangler deploy --dry-run  # Test deployment
   wrangler deployments list  # Check recent deployments
   ```

### Debug Commands

```bash
# Check worker logs
wrangler tail

# Test worker locally
wrangler dev

# Check configuration
wrangler tail --format=json
```

## Maintenance

### Regular Tasks

1. **Database Backups**: Set up automated backups to R2
2. **Log Monitoring**: Monitor worker logs for errors
3. **Performance Monitoring**: Track response times and errors
4. **Security Updates**: Keep dependencies updated

### Scaling Considerations

- **Database Scaling**: Consider read replicas for high-traffic databases
- **Queue Scaling**: Adjust batch sizes and timeouts based on load
- **Cache Management**: Implement cache invalidation strategies
- **Rate Limiting**: Adjust limits based on usage patterns

## Support

- **Cloudflare Documentation**: https://developers.cloudflare.com/
- **Wrangler CLI Docs**: https://developers.cloudflare.com/workers/wrangler/
- **D1 Documentation**: https://developers.cloudflare.com/d1/
- **R2 Documentation**: https://developers.cloudflare.com/r2/
- **Queues Documentation**: https://developers.cloudflare.com/queues/

## Next Steps

After completing setup:

1. Test all services thoroughly
2. Set up CI/CD pipeline for automated deployments
3. Configure monitoring and alerting
4. Document your specific configurations
5. Train team members on the new architecture