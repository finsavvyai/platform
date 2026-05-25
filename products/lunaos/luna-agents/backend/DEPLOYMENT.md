# Luna RAG Cloudflare Workers Deployment Guide

This guide will help you deploy the Luna RAG backend to Cloudflare Workers using Wrangler.

## Prerequisites

1. **Cloudflare Account** with Workers and D1 enabled
2. **Node.js** (v18 or higher)
3. **Wrangler CLI** installed globally
4. **LemonSqueezy account** with products configured

### Setup Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Verify authentication
wrangler whoami
```

## Quick Deployment

### 1. Clone and Navigate

```bash
# Navigate to the Cloudflare Workers backend directory
cd backend-wrangler
```

### 2. Configure Environment

The backend uses environment variables and secrets for configuration.

#### Update wrangler.toml

Edit `wrangler.toml` with your specific configuration:

```toml
name = "luna-rag-backend"
main = "src/index.js"
compatibility_date = "2024-05-12"

# Environment variables
[vars]
ENVIRONMENT = "production"
LEMONSQUEEZY_STORE_ID = "214097"
JWT_EXPIRES_IN = "7d"
API_VERSION = "v1"

# D1 Database (will be created automatically)
[[d1_databases]]
binding = "DB"
database_name = "luna-rag-db"
database_id = "your-database-id-here" # Set after first deployment

# KV Storage for caching (will be created automatically)
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id-here"
preview_id = "your-preview-kv-namespace-id-here"
```

### 3. Set Secrets

Configure your secrets using Wrangler:

```bash
# LemonSqueezy API key
wrangler secret put LEMONSQUEEZY_API_KEY

# LemonSqueezy webhook secret
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET

# JWT signing secret
wrangler secret put JWT_SECRET

# SendGrid API key (for emails)
wrangler secret put SENDGRID_API_KEY

# Email configuration
wrangler secret put EMAIL_FROM
wrangler secret put EMAIL_SUPPORT
```

#### Generate Secure Secrets

For JWT secret, you can generate a secure key:

```bash
# Generate a secure JWT secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 4. Deploy

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run automated deployment
./deploy.sh
```

## Manual Deployment Steps

If you prefer manual deployment:

### 1. Install Dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
# Create database
wrangler d1 create luna-rag-db

# Note the database ID and update wrangler.toml
```

### 3. Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "luna-rag-cache"

# Create preview namespace
wrangler kv:namespace create "luna-rag-cache" --preview

# Update wrangler.toml with the namespace IDs
```

### 4. Run Database Migrations

```bash
# Apply migrations to production
wrangler d1 migrations apply luna-rag-db

# For local development
wrangler d1 migrations apply luna-rag-db --local
```

### 5. Deploy Worker

```bash
# Deploy to production
wrangler deploy

# Deploy to staging
wrangler deploy --env staging
```

## Post-Deployment Configuration

### 1. LemonSqueezy Webhook Setup

After deployment, configure LemonSqueezy webhooks:

1. Go to your LemonSqueezy dashboard
2. Navigate to Settings → Webhooks
3. Add a new webhook with URL: `[YOUR_WORKER_URL]/webhook`
4. Enable these events:
   - Order created
   - Subscription created
   - Subscription payment succeeded
   - Subscription cancelled
   - Subscription updated

### 2. Worker URL Configuration

Update your Claude Code plugin configuration:

```json
{
  "apiEndpoint": "https://luna-rag-backend.your-subdomain.workers.dev",
  "apiKey": "your-jwt-token-for-authentication"
}
```

### 3. Test the Deployment

```bash
# Test health endpoint
curl https://luna-rag-backend.your-subdomain.workers.dev/health

# Test status endpoint
curl -X POST https://luna-rag-backend.your-subdomain.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "message": "status"}'

# Test RAG query
curl -X POST https://luna-rag-backend.your-subdomain.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "message": "How does authentication work?"}'
```

## Environment Variables & Secrets

### Required Secrets

| Variable | Description | Example |
|----------|-------------|---------|
| `LEMONSQUEEZY_API_KEY` | LemonSqueezy API key | `prod_xxxxxx` |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook signature secret | `whsec_xxxxxx` |
| `JWT_SECRET` | JWT token signing secret | `your-32-byte-secret` |
| `SENDGRID_API_KEY` | SendGrid API key for emails | `SG.xxxxxx` |
| `EMAIL_FROM` | From email address | `noreply@lunaos.ai` |
| `EMAIL_SUPPORT` | Support email address | `support@lunaos.ai` |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment stage | `development` |
| `LEMONSQUEEZY_STORE_ID` | LemonSqueezy store ID | `214097` |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` |
| `API_VERSION` | API version | `v1` |

## Database Schema

The deployment automatically creates these tables in D1:

### Users Table
- User authentication and subscription management
- API key storage
- Subscription status tracking

### Usage Stats Table
- Daily usage tracking
- Search query counts
- Feature usage analytics

### Conversations Table
- Chat history storage
- Context management
- Analytics data

### User Preferences Table
- User settings and preferences
- Notification preferences
- UI customization

## Local Development

### Setup Local Development

```bash
# Install dependencies
npm install

# Start local development server
wrangler dev

# The worker will be available at http://localhost:8787
```

### Local Database

```bash
# Create local database (optional)
wrangler d1 execute luna-rag-db --local --file="./migrations/0001_create_users.sql"

# Run migrations locally
wrangler d1 migrations apply luna-rag-db --local
```

### Environment for Local Development

Create a `.dev.vars` file for local development:

```bash
# .dev.vars
LEMONSQUEEZY_API_KEY=your-test-api-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-test-webhook-secret
JWT_SECRET=your-test-jwt-secret
SENDGRID_API_KEY=your-test-sendgrid-key
EMAIL_FROM=test@example.com
EMAIL_SUPPORT=test@example.com
```

## Monitoring and Debugging

### View Logs

```bash
# View real-time logs
wrangler tail

# View logs with filtering
wrangler tail --format=json | jq '.message'
```

### Monitor Usage

```bash
# Check database usage
wrangler d1 execute luna-rag-db --command="SELECT COUNT(*) as users FROM users"

# Check KV storage
wrangler kv:key list --namespace-id="your-kv-namespace-id"
```

### Performance Monitoring

Cloudflare Workers includes built-in analytics:

1. Go to your Cloudflare dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. View Analytics tab for request metrics

## Troubleshooting

### Common Issues

1. **Database Migration Errors**:
   ```bash
   # Reset and re-run migrations
   wrangler d1 execute luna-rag-db --command="DROP TABLE IF EXISTS users"
   wrangler d1 migrations apply luna-rag-db
   ```

2. **Secret Not Found**:
   ```bash
   # Check if secret is set
   wrangler secret list
   # Set missing secret
   wrangler secret put SECRET_NAME
   ```

3. **CORS Issues**:
   - Verify CORS headers in the response
   - Check your API client includes proper headers

4. **Webhook Verification Failed**:
   - Verify webhook secret matches LemonSqueezy
   - Check webhook signature format

### Debug Commands

```bash
# Test worker locally
wrangler dev --local

# Check configuration
wrangler whoami

# View worker logs
wrangler tail

# Test API endpoint
curl -X POST http://localhost:8787/query \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "message": "Hello"}'
```

## Security Considerations

1. **API Security**: All endpoints require authentication
2. **Secret Management**: Use Wrangler secrets, never commit secrets
3. **Rate Limiting**: Implement usage limits and monitoring
4. **Webhook Security**: Verify LemonSqueezy webhook signatures
5. **Data Privacy**: Regular data cleanup and anonymization

## Performance Optimization

1. **Caching**: KV storage for frequently accessed data
2. **Database Optimization**: Indexed queries and efficient schema
3. **Worker Limits**: Monitor CPU and memory usage
4. **Edge Computing**: Leverage Cloudflare's global network

## Production Checklist

- [ ] All secrets configured in production
- [ ] D1 database created and migrated
- [ ] KV namespaces configured
- [ ] Custom domain configured (optional)
- [ ] SSL certificates active
- [ ] LemonSqueezy webhooks configured
- [ ] Monitoring and alerting set up
- [ ] Error logging configured
- [ ] Rate limiting implemented
- [ ] Backup strategy for D1 data
- [ ] Performance testing completed

## Scaling Considerations

- **Multi-region deployment**: Leverage Cloudflare's global network
- **Database scaling**: Consider read replicas for high traffic
- **Queue processing**: Use Cloudflare Queues for background tasks
- **CDN caching**: Cache static responses at edge
- **Load balancing**: Automatic with Cloudflare Workers

## Support

For deployment issues:

1. Check Cloudflare Workers documentation
2. Review Wrangler CLI help: `wrangler --help`
3. Monitor worker logs: `wrangler tail`
4. Contact Cloudflare support for platform issues
5. Check LemonSqueezy webhook documentation

## Updates and Maintenance

```bash
# Update dependencies
npm update

# Redeploy with changes
wrangler deploy

# Update database schema
# Create new migration file in migrations/
wrangler d1 migrations apply luna-rag-db

# Update worker code
# Edit src/ files and redeploy
wrangler deploy
```