# Cloudflare Migration Guide for Questro Platform

## Overview

This guide provides step-by-step instructions for migrating the Questro backend from Render to Cloudflare Workers, creating a unified deployment strategy on the Cloudflare platform.

## Why Migrate to Cloudflare?

### Benefits Over Render
- **No Configuration Caching Issues** - Predictable build behavior
- **Global CDN** - Automatic edge caching in 200+ locations
- **Better Performance** - Sub-second response times globally
- **Cost Efficiency** - Generous free tier and predictable pricing
- **Unified Platform** - Frontend and backend on the same infrastructure
- **Developer Experience** - Simple configuration, instant rollbacks

### Architecture Benefits
- **Edge Computing** - Code runs closer to users globally
- **Serverless** - No server management or scaling concerns
- **Built-in Security** - DDoS protection and security headers
- **Analytics** - Built-in performance monitoring

## Current State

- ✅ **Frontend**: Already deployed on Cloudflare Pages (`app.questro.io`)
- 🔄 **Backend**: Currently on Render (experiencing deployment issues)
- 🎯 **Goal**: Migrate backend to Cloudflare Workers

## Migration Steps

### 1. Prerequisites

Install Wrangler CLI:
```bash
npm install -g wrangler
```

Authenticate with Cloudflare:
```bash
wrangler auth login
```

### 2. Database Setup

#### Option A: Continue with Supabase (Recommended)
- Keep existing Supabase database
- Update connection strings in Cloudflare Workers environment
- No data migration required

#### Option B: Migrate to Cloudflare D1
- Export data from Supabase
- Create D1 database: `wrangler d1 create questro-db`
- Import data using wrangler commands
- Update database schema

### 3. Redis/Cache Setup

#### Option A: Continue with Upstash Redis (Recommended)
- Keep existing Upstash Redis instance
- Update connection URL in Cloudflare Workers
- No data migration required

#### Option B: Migrate to Cloudflare KV
- Create KV namespace: `wrangler kv:namespace create "CACHE"`
- Update caching logic to use KV instead of Redis
- Migrate frequently accessed data

### 4. Environment Variables Setup

1. **Get your Cloudflare Account ID:**
   ```bash
   wrangler whoami
   ```

2. **Update wrangler.toml:**
   ```toml
   account_id = "your-account-id-here"
   ```

3. **Set production environment variables:**
   ```bash
   wrangler secret put DATABASE_URL
   wrangler secret put JWT_SECRET
   wrangler secret put REDIS_URL
   wrangler secret put OPENAI_API_KEY
   # Add other required secrets
   ```

### 5. Build and Test Locally

```bash
cd backend

# Build for Cloudflare Workers
npm run build:cloudflare

# Test locally
npm run dev:cloudflare
```

### 6. Deploy to Preview Environment

```bash
# Deploy to preview first
npm run deploy:cloudflare:preview

# Test preview deployment
curl https://api-preview.questro.io/health
```

### 7. Deploy to Production

```bash
# Deploy to production
npm run deploy:cloudflare

# Test production deployment
curl https://api.questro.io/health
```

### 8. Update Frontend Configuration

The frontend wrangler.toml has already been updated to point to the new Cloudflare backend URLs.

Deploy updated frontend:
```bash
cd frontend
npm run build
npm run deploy
```

## Post-Migration Steps

### 1. Update DNS Records

Create CNAME records for:
- `api.questro.io` → Cloudflare Workers
- `api-preview.questro.io` → Cloudflare Workers (preview)

### 2. Monitoring Setup

1. **Cloudflare Analytics**: Monitor through Cloudflare dashboard
2. **Health Checks**: Set up external monitoring for `/health` endpoint
3. **Error Tracking**: Configure error reporting (if needed)

### 3. Performance Optimization

1. **Enable Cache Headers**: Configure appropriate caching
2. **Optimize Bundle Size**: Monitor and optimize Workers bundle
3. **Configure Edge Caching**: Set up caching for static responses

## Rollback Plan

If issues arise:

1. **Immediate Rollback**: Point frontend back to Render backend
2. **Database Safety**: Database is separate - no data risk
3. **Gradual Migration**: Can run both platforms in parallel during transition

## Testing Checklist

- [ ] Health endpoint responds correctly
- [ ] Database connections work
- [ ] Redis/KV caching functions
- [ ] WebSocket connections establish
- [ ] Authentication works end-to-end
- [ ] File uploads/downloads work
- [ ] Scheduled jobs run correctly
- [ ] Performance is acceptable
- [ ] Error handling works properly

## Troubleshooting

### Common Issues

1. **Bundle Size Too Large**
   - Optimize imports
   - Use dynamic imports for rarely used modules
   - Enable code splitting

2. **Database Connection Issues**
   - Verify connection strings in secrets
   - Check IP allowlist settings
   - Test connection from Workers environment

3. **CORS Issues**
   - Update CORS origins in Workers code
   - Configure headers properly
   - Test with browser dev tools

4. **Environment Variable Issues**
   - Verify all secrets are set
   - Check naming conventions
   - Use wrangler secret list to verify

## Migration Timeline

- **Day 1**: Environment setup and local testing
- **Day 2**: Preview deployment and testing
- **Day 3**: Production deployment and DNS updates
- **Day 4-7**: Monitoring and optimization
- **Day 8**: Decommission Render backend

## Success Metrics

- ✅ All API endpoints respond correctly
- ✅ Database performance maintained or improved
- ✅ WebSocket connections work globally
- ✅ Page load times improve
- ✅ Error rates remain low
- ✅ Cost reduction achieved
- ✅ Development workflow simplified

## Support Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [Questro Documentation](https://docs.questro.io)

## Conclusion

This migration should resolve the persistent deployment issues experienced with Render while providing better performance, global reach, and simplified deployment processes. The unified Cloudflare architecture will make future development and deployment much more straightforward.