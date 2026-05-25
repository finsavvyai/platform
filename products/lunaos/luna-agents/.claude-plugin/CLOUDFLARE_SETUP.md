# Cloudflare RAG Setup for Luna Agents

## 🔧 Update Plugin Configuration

### 1. Update API Client Configuration

Edit `luna-agents/.claude-plugin/lib/api-client.js` to use your Cloudflare URL:

```javascript
// Replace with your actual Cloudflare Worker URL
this.baseURL = config.baseURL ||
               process.env.LUNA_API_URL ||
               'https://claude-rag-api-prod.your-subdomain.workers.dev/api/v1';
```

### 2. Environment Configuration

Create or update `.env` file in your project root:

```bash
# Cloudflare RAG API configuration
CLOUDFLARE_RAG_URL=https://claude-rag-api-prod.your-subdomain.workers.dev/api/v1
CLOUDFLARE_RAG_STAGING_URL=https://claude-rag-api-staging.your-subdomain.workers.dev/api/v1

# Optional: Local development fallback
LOCAL_RAG_URL=http://localhost:3000/api/v1
```

### 3. Update Plugin Manifest

Update `luna-agents/.claude-plugin/claude-plugin.json`:

```json
{
  "name": "luna-agents",
  "version": "2.1.0",
  "description": "Luna Agents with Cloudflare RAG - Global edge deployment",
  "features": [
    "Cloudflare Workers global deployment",
    "Edge-optimized RAG system",
    "Real-time semantic search",
    "Auto-scaling infrastructure",
    "Global CDN caching",
    "Zero cold start times"
  ],
  "endpoints": {
    "production": "https://claude-rag-api-prod.your-subdomain.workers.dev/api/v1",
    "staging": "https://claude-rag-api-staging.your-subdomain.workers.dev/api/v1"
  }
}
```

## 🚀 Deployment Commands

### 1. Setup Cloudflare Resources

```bash
# Login to Cloudflare
wrangler auth login

# Create KV namespaces
wrangler kv:namespace create "RAG_CACHE"
wrangler kv:namespace create "DOCUMENT_METADATA"

# Create D1 database
wrangler d1 create claude-rag-database

# Create R2 bucket
wrangler r2 bucket create claude-rag-documents

# Create queue
wrangler queue create rag-processing-queue
```

### 2. Update Configuration

Replace placeholder IDs in `packages/api/wrangler.toml` with actual values from the commands above.

### 3. Initialize Database

```bash
cd packages/api

# Initialize D1 database schema
wrangler d1 execute claude-rag-database --file=./schema.sql
```

### 4. Deploy to Staging

```bash
# Deploy to staging first
wrangler deploy --env staging

# Test staging deployment
curl https://claude-rag-api-staging.your-subdomain.workers.dev/health
```

### 5. Deploy to Production

```bash
# Deploy to production
wrangler deploy --env production

# Test production deployment
curl https://claude-rag-api-prod.your-subdomain.workers.dev/health
```

## 🧪 Testing the Integration

### Test API Endpoints

```bash
# Test health endpoint
curl https://claude-rag-api-prod.your-subdomain.workers.dev/api/v1/health

# Test RAG status
curl https://claude-rag-api-prod.your-subdomain.workers.dev/api/v1/rag/status

# Test search endpoint
curl -X POST https://claude-rag-api-prod.your-subdomain.workers.dev/api/v1/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search", "maxResults": 5}'
```

### Test in Claude Code

```bash
# Start Claude Code with Luna plugin
# The plugin should automatically connect to your Cloudflare API

# Test RAG functionality:
"Check RAG system status"
"What is the current indexing status?"
```

## 📊 Monitoring

### Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. Navigate to Workers & Pages
3. Select your RAG API worker
4. View analytics, logs, and metrics

### Custom Monitoring

```bash
# View real-time logs
wrangler tail --env production

# View specific function logs
wrangler tail --format json
```

### Available Metrics

- Request count and response times
- Error rates and success rates
- Cache hit rates
- Queue processing times
- D1 query performance
- KV storage usage

## 🔧 Configuration Options

### API Keys and Secrets

```bash
# Set production secrets
wrangler secret put OPENAI_API_KEY

# Set environment-specific secrets
wrangler secret put OPENAI_API_KEY --env production
wrangler secret put OPENAI_API_KEY --env staging
```

### Custom Domain (Optional)

```bash
# Add custom domain
wrangler custom-domains add api.yourdomain.com

# Update plugin configuration to use custom domain
```

### Rate Limiting

Configure rate limiting in Cloudflare dashboard:
- Workers > Rate Limiting
- Set appropriate limits for your usage

## 🔄 Update Process

### Making Changes

1. Update code in `packages/api/src/`
2. Test locally with `wrangler dev`
3. Deploy to staging: `wrangler deploy --env staging`
4. Test staging deployment
5. Deploy to production: `wrangler deploy --env production`

### Database Migrations

```bash
# Create migration file
# Apply to staging
wrangler d1 execute claude-rag-database --file=./migrations/update.sql --env staging

# Apply to production
wrangler d1 execute claude-rag-database --file=./migrations/update.sql --env production
```

## 🚨 Troubleshooting

### Common Issues

1. **Worker Not Found Error**
   ```bash
   # Check worker name in wrangler.toml
   wrangler whoami
   wrangler deploy --dry-run
   ```

2. **KV Namespace Errors**
   ```bash
   # List KV namespaces
   wrangler kv:namespace list
   
   # Check bindings in wrangler.toml
   ```

3. **Database Connection Issues**
   ```bash
   # Check D1 database exists
   wrangler d1 list
   
   # Test database connection
   wrangler d1 execute claude-rag-database --command="SELECT 1"
   ```

4. **Plugin Connection Issues**
   ```bash
   # Test API directly
   curl https://your-worker-url.workers.dev/health
   
   # Check plugin configuration
   cat luna-agents/.claude-plugin/lib/api-client.js
   ```

### Debug Commands

```bash
# View worker logs
wrangler tail

# Test specific endpoint
curl -X POST https://your-worker-url.workers.dev/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}' -v

# Check configuration
wrangler tail --format pretty
```

## 📈 Performance Optimization

### Edge Benefits

- **Global Distribution**: Workers run in 200+ edge locations
- **Low Latency**: ~50ms response times globally
- **Auto-scaling**: No server management needed
- **Built-in CDN**: Automatic caching and optimization

### Optimization Tips

1. **Enable caching** for frequently accessed data
2. **Use KV** for small, fast-access data
3. **Use R2** for large files and documents
4. **Monitor usage** to optimize costs
5. **Implement smart caching** strategies

### Cost Management

- **Free Tier**: 100,000 requests/day
- **KV Storage**: 100,000 reads/day, 1,000 writes/day
- **D1 Database**: 25GB storage, 5GB reads/day
- **R2 Storage**: 10GB free storage

Monitor usage in Cloudflare dashboard to optimize costs.

## 🎯 Next Steps

1. ✅ **Deploy to Cloudflare** - Global edge deployment
2. ✅ **Update Luna Plugin** - Point to Cloudflare API
3. ✅ **Test Integration** - Verify everything works
4. 🔄 **Monitor Performance** - Set up alerts and monitoring
5. 🚀 **Scale as Needed** - Workers scale automatically

Your RAG system is now running on Cloudflare's global edge network! 🌍⚡

## 📞 Support Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI Guide**: https://developers.cloudflare.com/workers/wrangler/
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **Community Forum**: https://community.cloudflare.com/