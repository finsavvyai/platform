# Cloudflare Workers RAG Deployment Guide

## 🚀 Quick Start with Cloudflare Workers

Your RAG system is now optimized for Cloudflare Workers with edge computing capabilities. This provides:

- **Global edge deployment** for fast response times
- **Automatic scaling** with no server management
- **Built-in CDN** for cached responses
- **Cost-effective** pay-per-request pricing
- **Environment isolation** (staging/production)

## 📋 Prerequisites

### 1. Cloudflare Account
```bash
# Create account at https://dash.cloudflare.com/
# Install Wrangler CLI (already installed)
wrangler --version
```

### 2. Login to Cloudflare
```bash
# Login to your Cloudflare account
wrangler auth login
```

### 3. Configure Environment Variables
```bash
# Create .dev.vars file for development
cd packages/api

cat > .dev.vars << EOF
OPENAI_API_KEY=your_openai_api_key_here
ENVIRONMENT=development
QDRANT_URL=your_qdrant_url_if_using_external
QDRANT_API_KEY=your_qdrant_api_key_if_using_external
EOF
```

## 🏗️ Deployment Architecture

### Cloudflare Workers Services
- **Worker**: Main RAG API server
- **KV Storage**: Fast key-value cache for responses and metadata
- **D1 Database**: SQLite database for structured data
- **R2 Storage**: S3-compatible storage for documents
- **Queue**: Background processing for indexing
- **Analytics**: Built-in monitoring and logging

### Service URLs
```
Production: https://claude-rag-api-prod.your-subdomain.workers.dev
Staging:    https://claude-rag-api-staging.your-subdomain.workers.dev
Local:      http://localhost:8787 (wrangler dev)
```

## 🚀 Deployment Steps

### 1. Setup Cloudflare Resources

#### Create KV Namespaces
```bash
# Create KV for caching
wrangler kv:namespace create "RAG_CACHE"
wrangler kv:namespace create "RAG_CACHE" --preview

# Create KV for document metadata
wrangler kv:namespace create "DOCUMENT_METADATA"
wrangler kv:namespace create "DOCUMENT_METADATA" --preview

# Note the IDs and update wrangler.toml
```

#### Create D1 Database
```bash
# Create D1 database
wrangler d1 create claude-rag-database

# Note the database ID and update wrangler.toml

# Initialize database schema
wrangler d1 execute claude-rag-database --file=./schema.sql
```

#### Create R2 Bucket
```bash
# Create R2 bucket for document storage
wrangler r2 bucket create claude-rag-documents
```

#### Create Queue
```bash
# Create queue for background processing
wrangler queue create rag-processing-queue
```

### 2. Update Configuration

#### Update wrangler.toml
```toml
# Replace placeholder IDs with actual values from the commands above
[[kv_namespaces]]
binding = "RAG_CACHE"
id = "your-actual-rag-cache-id"
preview_id = "your-actual-rag-cache-preview-id"

[[kv_namespaces]]
binding = "DOCUMENT_METADATA"
id = "your-actual-metadata-id"
preview_id = "your-actual-metadata-preview-id"

[[d1_databases]]
binding = "RAG_DB"
database_name = "claude-rag-database"
database_id = "your-actual-database-id"

[[r2_buckets]]
binding = "DOCUMENT_STORAGE"
bucket_name = "claude-rag-documents"

[[queues.producers]]
binding = "RAG_QUEUE"
queue = "rag-processing-queue"
```

### 3. Create Database Schema

Create `packages/api/schema.sql`:
```sql
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  environment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Conversation history
CREATE TABLE IF NOT EXISTS conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  environment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Query logs for analytics
CREATE TABLE IF NOT EXISTS query_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  response_time INTEGER,
  document_count INTEGER,
  environment TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexing jobs
CREATE TABLE IF NOT EXISTS indexing_jobs (
  id TEXT PRIMARY KEY,
  repository_path TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_environment ON documents(environment);
CREATE INDEX IF NOT EXISTS idx_conversation_environment ON conversation_history(environment);
CREATE INDEX IF NOT EXISTS idx_query_logs_environment ON query_logs(environment);
CREATE INDEX IF NOT EXISTS idx_indexing_jobs_status ON indexing_jobs(status);
```

### 4. Deploy to Cloudflare

#### Deploy to Staging
```bash
cd packages/api

# Deploy to staging environment
wrangler deploy --env staging

# Test staging deployment
curl https://claude-rag-api-staging.your-subdomain.workers.dev/health
```

#### Deploy to Production
```bash
# Deploy to production
wrangler deploy --env production

# Test production deployment
curl https://claude-rag-api-prod.your-subdomain.workers.dev/health
```

## 🔧 Configuration

### Environment Variables
```bash
# Production (set in Cloudflare dashboard)
OPENAI_API_KEY=sk-proj-...
ENVIRONMENT=production

# Optional: External vector database
QDRANT_URL=https://your-qdrant-instance.qdrant.tech
QDRANT_API_KEY=your-qdrant-api-key

# Development (in .dev.vars)
OPENAI_API_KEY=sk-test-...
ENVIRONMENT=development
```

### Custom Domain (Optional)
```bash
# Add custom domain in Cloudflare dashboard
# Or via Wrangler:
wrangler custom-domains add api.yourdomain.com
```

## 📊 Monitoring and Analytics

### Built-in Cloudflare Monitoring
- **Request Analytics**: Automatic request logging
- **Error Tracking**: Built-in error monitoring
- **Performance Metrics**: Response time and throughput
- **Cost Tracking**: Usage-based billing

### Custom Analytics
```bash
# View query logs
wrangler tail --env production

# Check worker logs
wrangler tail --format json
```

### Grafana Dashboard
If you want advanced monitoring:
```bash
# Connect Cloudflare metrics to Grafana
# Use Cloudflare's GraphQL API for custom metrics
```

## 🧪 Testing

### Local Testing
```bash
# Start local development server
wrangler dev

# Test endpoints locally
curl http://localhost:8787/health
curl -X POST http://localhost:8787/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "test query"}'
```

### Staging Testing
```bash
# Deploy to staging first
wrangler deploy --env staging

# Test staging endpoint
curl https://claude-rag-api-staging.your-subdomain.workers.dev/rag/status
```

### Production Testing
```bash
# Test production after deployment
curl https://claude-rag-api-prod.your-subdomain.workers.dev/rag/status
```

## 🔒 Security

### Authentication
```typescript
// The worker includes JWT validation
// Set up API keys in Cloudflare dashboard
// Use secrets for sensitive data
```

### Rate Limiting
```typescript
// Built-in rate limiting via Cloudflare
// Configure in Cloudflare dashboard
```

### CORS Configuration
```typescript
// Already configured for Claude Code domains
origin: ['https://claude.ai', 'https://chat.openai.com']
```

## 💰 Cost Optimization

### Free Tier Limits (as of 2024)
- **Workers**: 100,000 requests/day free
- **KV**: 100,000 reads/day, 1,000 writes/day free
- **D1**: 25GB storage, 5GB reads/day free
- **R2**: 10GB storage free
- **Queue**: 1M messages/day free

### Optimization Tips
```typescript
// 1. Enable caching for frequently accessed data
// 2. Use compression for large responses
// 3. Optimize embedding requests
// 4. Monitor usage regularly
```

## 🔄 Updates and Maintenance

### Deploying Updates
```bash
# Make changes to code
git add .
git commit -m "feat: Update RAG functionality"
git push origin main

# Deploy to staging
wrangler deploy --env staging

# Test staging, then deploy to production
wrangler deploy --env production
```

### Database Migrations
```bash
# Create migration file
wrangler d1 execute claude-rag-database --file=./migrations/add_new_table.sql

# Apply to production
wrangler d1 execute claude-rag-database --file=./migrations/add_new_table.sql --env production
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Worker Deployment Fails
```bash
# Check wrangler.toml configuration
wrangler whoami
wrangler deploy --dry-run
```

#### 2. KV Namespace Not Found
```bash
# Verify KV namespace exists
wrangler kv:namespace list

# Check bindings in wrangler.toml
```

#### 3. Database Connection Issues
```bash
# Check D1 database exists
wrangler d1 list

# Test database connection
wrangler d1 execute claude-rag-database --command="SELECT 1"
```

#### 4. OpenAI API Errors
```bash
# Verify API key is set correctly
wrangler secret list

# Test API key
wrangler secret put OPENAI_API_KEY
```

### Debug Commands
```bash
# View real-time logs
wrangler tail

# View specific environment logs
wrangler tail --env production

# Debug specific requests
wrangler tail --format json
```

## 📈 Performance Optimization

### Edge Computing Benefits
- **Global Distribution**: Workers run in 200+ locations
- **Low Latency**: ~50ms response times globally
- **Auto-scaling**: No need to manage servers
- **Cost Efficiency**: Pay only for what you use

### Optimization Strategies
```typescript
// 1. Use KV for frequently accessed data
// 2. Enable response caching
// 3. Optimize vector search algorithms
// 4. Use Durable Objects for stateful operations
// 5. Implement smart caching strategies
```

## 🎯 Next Steps

1. **Deploy to Staging**: Test with staging environment
2. **Configure Production**: Set up production variables
3. **Update Luna Plugin**: Point to Cloudflare URL
4. **Monitor Performance**: Set up alerts and monitoring
5. **Scale as Needed**: Workers scale automatically

Your RAG system is now ready for global edge deployment! 🌍⚡

## 📞 Support

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/
- **RAG System**: Check this guide and repository issues

---

*Your RAG system will now run on Cloudflare's global network with automatic scaling and edge optimization!*