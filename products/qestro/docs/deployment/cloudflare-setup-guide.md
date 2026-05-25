# Cloudflare Infrastructure Setup Guide

This guide walks you through setting up the complete Cloudflare infrastructure for the Qestro MVP.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler
   ```
3. **Authentication**: Log in to Cloudflare
   ```bash
   wrangler login
   ```

## Infrastructure Components

### 1. Cloudflare Workers (Backend API)
- **Purpose**: Serverless API running on Cloudflare's edge network
- **Framework**: Hono (Express-like framework for Workers)
- **Features**: 
  - REST API endpoints
  - WebSocket support via Durable Objects
  - Global edge deployment (300+ locations)
  - Zero cold starts

### 2. Cloudflare Pages (Frontend)
- **Purpose**: Static site hosting with global CDN
- **Features**:
  - Automatic deployments from GitHub
  - Preview deployments for PRs
  - Custom domain support (qestro.app)
  - SSL certificates (automatic)

### 3. Cloudflare D1 (Database)
- **Purpose**: SQLite-based distributed database
- **Features**:
  - Automatic replication across regions
  - Point-in-time recovery
  - Sub-10ms read latency from edge
  - Drizzle ORM integration

### 4. Cloudflare KV (Key-Value Storage)
- **Purpose**: Low-latency key-value storage
- **Namespaces**:
  - `SESSIONS`: User session management
  - `CACHE`: API response caching
  - `RATE_LIMIT`: Rate limiting counters

### 5. Cloudflare R2 (Object Storage)
- **Purpose**: S3-compatible object storage
- **Buckets**:
  - `qestro-screenshots`: Test execution screenshots
  - `qestro-recordings`: Test recording files
  - `qestro-artifacts`: Test artifacts and logs

### 6. Cloudflare Durable Objects
- **Purpose**: Stateful serverless objects for real-time features
- **Objects**:
  - `CollaborationDO`: Real-time collaboration
  - `SessionDO`: Session management
  - `TestExecutionDO`: Test execution coordination
  - `MonitoringDO`: System monitoring

## Quick Setup

### Automated Setup (Recommended)

Run the setup script to create all resources:

```bash
chmod +x scripts/setup-cloudflare-infrastructure.sh
./scripts/setup-cloudflare-infrastructure.sh
```

The script will:
1. Create D1 databases for each environment
2. Create KV namespaces
3. Create R2 buckets
4. Run database migrations
5. Prompt for secrets setup

### Manual Setup

If you prefer manual setup, follow these steps:

#### 1. Create D1 Databases

```bash
# Development
wrangler d1 create qestro-dev

# Staging
wrangler d1 create qestro-staging

# Production
wrangler d1 create qestro-production
```

Save the database IDs and update `wrangler.toml`.

#### 2. Create KV Namespaces

```bash
# Production
wrangler kv:namespace create SESSIONS
wrangler kv:namespace create CACHE
wrangler kv:namespace create RATE_LIMIT

# Development
wrangler kv:namespace create SESSIONS --env dev
wrangler kv:namespace create CACHE --env dev
wrangler kv:namespace create RATE_LIMIT --env dev

# Staging
wrangler kv:namespace create SESSIONS --env staging
wrangler kv:namespace create CACHE --env staging
wrangler kv:namespace create RATE_LIMIT --env staging
```

Save the namespace IDs and update `wrangler.toml`.

#### 3. Create R2 Buckets

```bash
# Production
wrangler r2 bucket create qestro-screenshots
wrangler r2 bucket create qestro-recordings
wrangler r2 bucket create qestro-artifacts

# Development
wrangler r2 bucket create qestro-screenshots-dev
wrangler r2 bucket create qestro-recordings-dev
wrangler r2 bucket create qestro-artifacts-dev

# Staging
wrangler r2 bucket create qestro-screenshots-staging
wrangler r2 bucket create qestro-recordings-staging
wrangler r2 bucket create qestro-artifacts-staging
```

#### 4. Run Database Migrations

```bash
# Generate migrations from schema
npm run db:generate

# Apply migrations to production
wrangler d1 migrations apply qestro-production --remote

# Apply migrations to staging
wrangler d1 migrations apply qestro-staging --remote --env staging

# Apply migrations to development
wrangler d1 migrations apply qestro-dev --remote --env dev
```

#### 5. Set Secrets

Secrets are sensitive values that should never be committed to version control.

```bash
# Production secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put LEMONSQUEEZY_API_KEY --env production
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET --env production
wrangler secret put GITHUB_OAUTH_CLIENT_ID --env production
wrangler secret put GITHUB_OAUTH_CLIENT_SECRET --env production
wrangler secret put AZURE_OAUTH_CLIENT_ID --env production
wrangler secret put AZURE_OAUTH_CLIENT_SECRET --env production
wrangler secret put RESEND_API_KEY --env production
```

## Configuration

### Update wrangler.toml

After creating resources, update `wrangler.toml` with the generated IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "qestro-production"
database_id = "YOUR_DATABASE_ID_HERE"

[[kv_namespaces]]
binding = "SESSIONS"
id = "YOUR_KV_NAMESPACE_ID_HERE"

# ... etc
```

### Environment Variables

Environment-specific variables are configured in `wrangler.toml`:

- **Development**: `[env.dev.vars]`
- **Staging**: `[env.staging.vars]`
- **Production**: `[env.production.vars]`

## Deployment

### Deploy Backend (Workers)

```bash
# Development
wrangler deploy --env dev

# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

### Deploy Frontend (Pages)

#### Via GitHub Integration (Recommended)

1. Go to Cloudflare Dashboard → Pages
2. Click "Create a project"
3. Connect your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `frontend/dist`
   - **Root directory**: `frontend`
5. Add environment variables:
   - `VITE_API_URL`: Your API URL
   - `VITE_WS_URL`: Your WebSocket URL
6. Deploy

#### Via Wrangler CLI

```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name qestro-frontend
```

## Custom Domain Setup

### Configure qestro.app Domain

1. **Add domain to Cloudflare**:
   - Go to Cloudflare Dashboard → Websites
   - Add `qestro.app`
   - Update nameservers at your registrar

2. **Configure DNS for Workers**:
   ```bash
   # Add route for API
   wrangler route add "api.qestro.app/*" qestro-api-production
   ```

3. **Configure DNS for Pages**:
   - Go to Pages project settings
   - Add custom domain: `qestro.app`
   - Cloudflare will automatically provision SSL certificate

4. **DNS Records**:
   ```
   Type  Name  Content                    Proxy
   A     @     192.0.2.1                  Yes (Orange cloud)
   CNAME api   qestro-api-production      Yes (Orange cloud)
   CNAME www   qestro.app                 Yes (Orange cloud)
   ```

## Monitoring and Maintenance

### View Logs

```bash
# Tail production logs
wrangler tail --env production

# Tail with filters
wrangler tail --env production --status error
```

### Database Management

```bash
# Execute SQL query
wrangler d1 execute qestro-production --command "SELECT * FROM users LIMIT 10"

# Export database
wrangler d1 export qestro-production --output backup.sql

# Import database
wrangler d1 execute qestro-production --file backup.sql
```

### KV Management

```bash
# List keys
wrangler kv:key list --namespace-id YOUR_NAMESPACE_ID

# Get value
wrangler kv:key get "key-name" --namespace-id YOUR_NAMESPACE_ID

# Put value
wrangler kv:key put "key-name" "value" --namespace-id YOUR_NAMESPACE_ID

# Delete key
wrangler kv:key delete "key-name" --namespace-id YOUR_NAMESPACE_ID
```

### R2 Management

```bash
# List buckets
wrangler r2 bucket list

# List objects in bucket
wrangler r2 object list qestro-screenshots

# Download object
wrangler r2 object get qestro-screenshots/screenshot.png --file screenshot.png

# Upload object
wrangler r2 object put qestro-screenshots/screenshot.png --file screenshot.png

# Delete object
wrangler r2 object delete qestro-screenshots/screenshot.png
```

## Troubleshooting

### Common Issues

1. **"Not authenticated" error**:
   ```bash
   wrangler login
   ```

2. **"Database not found" error**:
   - Verify database ID in `wrangler.toml`
   - Check database exists: `wrangler d1 list`

3. **"KV namespace not found" error**:
   - Verify namespace ID in `wrangler.toml`
   - Check namespace exists: `wrangler kv:namespace list`

4. **"R2 bucket not found" error**:
   - Verify bucket name in `wrangler.toml`
   - Check bucket exists: `wrangler r2 bucket list`

5. **CORS errors**:
   - Verify `CORS_ALLOWED_ORIGINS` in `wrangler.toml`
   - Check origin is included in allowed origins

### Health Checks

Test your deployment:

```bash
# Check API health
curl https://api.qestro.app/health

# Check API version
curl https://api.qestro.app/api

# Check frontend
curl https://qestro.app
```

## Security Best Practices

1. **Never commit secrets**: Use `wrangler secret put` for sensitive values
2. **Use environment-specific resources**: Separate dev/staging/production
3. **Enable rate limiting**: Configure rate limits in KV
4. **Monitor logs**: Set up alerts for errors
5. **Regular backups**: Export D1 database regularly
6. **Update dependencies**: Keep Wrangler and packages updated

## Cost Optimization

### Free Tier Limits

- **Workers**: 100,000 requests/day
- **D1**: 5 GB storage, 5M reads/day, 100K writes/day
- **KV**: 100,000 reads/day, 1,000 writes/day
- **R2**: 10 GB storage, 1M Class A operations/month
- **Pages**: Unlimited requests, 500 builds/month

### Paid Plans

When you exceed free tier:
- **Workers Paid**: $5/month + $0.50/million requests
- **D1**: $5/month + usage-based pricing
- **KV**: $0.50/million reads
- **R2**: $0.015/GB storage

## Next Steps

After infrastructure setup:

1. ✅ Infrastructure configured
2. 🔄 Implement authentication (Task 2)
3. 🔄 Build onboarding flow (Task 3)
4. 🔄 Implement test recording (Task 4)
5. 🔄 Add AI test generation (Task 5)

## Support

- **Cloudflare Docs**: https://developers.cloudflare.com
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler
- **Discord**: https://discord.gg/cloudflaredev
- **Qestro Docs**: https://docs.qestro.app
