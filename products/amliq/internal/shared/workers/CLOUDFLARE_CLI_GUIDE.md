# 🛠️ Cloudflare CLI Management Guide

## **Current Status & Fix Required**

The Cloudflare CLI commands are failing because your account ID in the environment variables is still set to a placeholder value. Here's how to fix it and use the CLI effectively.

## **🔧 Immediate Fix Required**

### 1. **Update Your Account ID**
You need to replace the placeholder account ID with your actual Cloudflare account ID:

```bash
# Get your actual account ID
wrangler whoami
# Look for "Account ID" in the output
```

Then update your `.env.local` file:
```bash
# Replace this line:
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here

# With your actual account ID:
CLOUDFLARE_ACCOUNT_ID=d2fe608a92dc9faa2ce5b0fd2cad5eb7
```

### 2. **Re-authenticate if Needed**
```bash
wrangler login
```

## **🚀 Cloudflare CLI Commands for FinTech Suite**

### **D1 Database Management**

```bash
# List all databases
wrangler d1 list

# View database details
wrangler d1 info finsavvy-primary
wrangler d1 info finsavvy-secondary
wrangler d1 info finsavvy-compliance

# Execute SQL queries
wrangler d1 execute finsavvy-primary --command="SELECT name FROM sqlite_master WHERE type='table';"

# Backup database
wrangler d1 export finsavvy-primary --output=backup-primary.sql

# Create new table
wrangler d1 execute finsavvy-primary --command="CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);"
```

### **KV Namespace Management**

```bash
# List all KV namespaces
wrangler kv namespace list

# Create new namespace
wrangler kv namespace create "NEW_NAMESPACE"

# View namespace contents
wrangler kv key list --namespace-id="YOUR_NAMESPACE_ID"

# Add key-value pair
wrangler kv key put "test-key" "test-value" --namespace-id="YOUR_NAMESPACE_ID"

# Get value
wrangler kv key get "test-key" --namespace-id="YOUR_NAMESPACE_ID"

# Delete key
wrangler kv key delete "test-key" --namespace-id="YOUR_NAMESPACE_ID"
```

### **R2 Bucket Management**

```bash
# List all buckets
wrangler r2 bucket list

# Create new bucket
wrangler r2 bucket create "my-new-bucket"

# Upload file to bucket
wrangler r2 object put my-new-bucket "file.txt" "./file.txt"

# List bucket contents
wrangler r2 object list my-new-bucket

# Download file from bucket
wrangler r2 object get my-new-bucket "file.txt"

# Delete object
wrangler r2 object delete my-new-bucket "file.txt"

# Delete bucket
wrangler r2 bucket delete my-new-bucket
```

### **Worker Management**

```bash
# Deploy worker
wrangler deploy

# Deploy with specific environment
wrangler deploy --env development

# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback <version-id>

# View worker logs
wrangler tail finsavvy-ai-suite

# Delete worker
wrangler delete finsavvy-ai-suite
```

### **AI Services Management**

```bash
# Test AI model
wrangler ai run "@cf/meta/llama-3.1-8b-instruct" "Hello, how can you help with FinTech?"

# Generate embeddings
wrangler ai run "@cf/baai/bge-base-en-v1.5" "Financial compliance and risk management"

# List available models
wrangler ai models list
```

### **Vectorize Index Management**

```bash
# List Vectorize indexes
wrangler vectorize list

# Create new index
wrangler vectorize create my-index --dimensions=768 --metric=cosine

# Add vectors to index
wrangler vectorize insert my-index --vectors="[[1,2,3], [4,5,6]]" --ids=["doc1","doc2"]

# Search vectors
wrangler vectorize query my-index --vector="[1,2,3] --topK=5
```

### **Queue Management**

```bash
# List queues
wrangler queues list

# Create queue
wrangler queues create my-queue

# Send message to queue
wrangler queues send my-queue --message="Hello from CLI"

# View queue metrics
wrangler queues metrics my-queue
```

## **📊 Monitoring & Debugging**

### **Real-time Logs**
```bash
# Tail worker logs
wrangler tail finsavvy-ai-suite

# Filter logs by status
wrangler tail finsavvy-ai-suite --status ok,error

# Filter logs by method
wrangler tail finsavvy-ai-suite --method GET,POST

# Search logs for specific text
wrangler tail finsavvy-ai-suite --search "error"
```

### **Performance Testing**
```bash
# Test worker endpoint
curl -X GET https://finsavvy-ai-suite.workers.dev/health

# Test API endpoint
curl -X GET https://finsavvy-ai-suite.workers.dev/api/status

# Test with headers
curl -X POST https://finsavvy-ai-suite.workers.dev/api/billing/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amount": 1000, "currency": "USD"}'
```

## **🌐 Domain and DNS Management**

### **Custom Domain Setup**
```bash
# Add custom domain to worker
wrangler custom-domains add finsavvy-ai-suite.finsavvyai.com

# List custom domains
wrangler custom-domains list

# Delete custom domain
wrangler custom-domains delete finsavvy-ai-suite.finsavvyai.com
```

### **DNS Configuration via Cloudflare Dashboard**
1. Go to https://dash.cloudflare.com
2. Select your domain (finsavvyai.com)
3. Add DNS records:
   ```
   Type: CNAME
   Name: suite
   Content: finsavvy-ai-suite.workers.dev
   TTL: 3600

   Type: CNAME
   Name: api
   Content: finsavvy-ai-suite.workers.dev
   TTL: 3600

   Type: CNAME
   Name: billing
   Content: finsavvy-ai-suite.workers.dev
   TTL: 3600
   ```

## **🔒 Security Management**

### **Secrets Management**
```bash
# Add secret
wrangler secret put JWT_SECRET

# List secrets (can't view values, only names)
wrangler secret list

# Delete secret
wrangler secret delete JWT_SECRET
```

### **Rate Limiting Configuration**
```bash
# Test rate limiting
for i in {1..100}; do
  curl https://finsavvy-ai-suite.workers.dev/api/status
done
```

## **📈 Analytics and Reporting**

### **Enable Web Analytics**
```bash
# In Cloudflare Dashboard:
# 1. Go to Analytics & Logs > Web Analytics
# 2. Configure your domain
# 3. Set up custom events
```

### **Create Analytics Dashboard**
```bash
# Add analytics tracking to your worker
# Add this to your worker code:
c.waitUntil(env.ANALYTICS.writeData({
  timestamp: Date.now(),
  url: c.req.url,
  userAgent: c.req.headers.get('User-Agent'),
  method: c.req.method,
  responseTime: Date.now() - startTime
}));
```

## **🔄 Migration and Backup**

### **Database Backup**
```bash
# Export all databases
wrangler d1 export finsavvy-primary --output=backups/primary-$(date +%Y%m%d).sql
wrangler d1 export finsavvy-secondary --output=backups/secondary-$(date +%Y%m%d).sql
wrangler d1 export finsavvy-compliance --output=backups/compliance-$(date +%Y%m%d).sql
```

### **R2 Backup Script**
```bash
#!/bin/bash
# backup-r2.sh
BACKUP_DIR="backups/r2-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

wrangler r2 object list finsavvy-documents | jq '.objects[].key' | xargs -I {} sh -c '
  wrangler r2 object get finsavvy-documents "{}" -o "$BACKUP_DIR/{}"
'

echo "Backup completed: $BACKUP_DIR"
```

## **📋 Quick Commands Reference**

```bash
# Quick health check
wrangler tail finsavvy-ai-suite --once

# Quick database status
wrangler d1 info finsavvy-primary

# Quick API test
curl -f https://finsavvy-ai-suite.workers.dev/health

# Quick secrets check
wrangler secret list

# Quick deployment
wrangler deploy --dry-run && wrangler deploy
```

## **🚨 Troubleshooting**

### **Common Issues & Solutions**

1. **"Could not route" Error**
   ```bash
   # Check account ID in .env.local
   grep CLOUDFLARE_ACCOUNT_ID .env.local
   # Should be actual ID, not placeholder
   ```

2. **"Not authenticated" Error**
   ```bash
   wrangler login
   # Or check API token
   wrangler whoami
   ```

3. **"Missing entry-point" Error**
   ```bash
   # Check current directory
   pwd
   # Should be in workers directory
   ls wrangler.toml
   ```

4. **"Queue does not exist" Error**
   ```bash
   # Create the queue first
   wrangler queues create finsavvy-billing-queue
   wrangler queues create finsavvy-compliance-queue
   ```

5. **"Database constraint" Error**
   ```bash
   # Check database schema
   wrangler d1 execute finsavvy-primary --command="SELECT sql FROM sqlite_master WHERE type='table';"
   ```

## **🎯 Next Steps**

1. **Fix Account ID**: Update your `.env.local` with the actual account ID
2. **Test Basic Commands**: Try `wrangler d1 list` and `wrangler kv namespace list`
3. **Deploy Updated Worker**: Use the SEO-optimized worker
4. **Configure Custom Domains**: Set up DNS records for finsavvyai.com
5. **Monitor Performance**: Set up analytics and logging

Your FinTech suite is ready for production with proper Cloudflare CLI management! 🚀