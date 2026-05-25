# Cloudflare Deployment - Quick Start

Get your MCPoverflow AI Engine running on Cloudflare in 5 minutes.

## Prerequisites

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Get your Account ID from dashboard
wrangler whoami
```

## Deploy in 3 Steps

### Step 1: Configure

```bash
cd packages/ai-engine

# Edit wrangler.toml - add your account_id
nano wrangler.toml
```

### Step 2: Set Secrets

```bash
# Set OpenHands credentials
echo "your-openhands-api-key" | wrangler secret put OPENHANDS_API_KEY
echo "https://your-openhands-url" | wrangler secret put OPENHANDS_API_URL
```

### Step 3: Deploy

```bash
# Create KV namespace
npm run cf:create-kv

# Build and deploy
npm install
npm run build:worker
npm run deploy
```

## Automated Deployment

```bash
# From root directory
./deploy-cloudflare.sh deploy
```

This will:
- ✅ Create KV namespaces
- ✅ Set secrets
- ✅ Build worker
- ✅ Deploy to Cloudflare

## Test Deployment

```bash
# Your worker URL will be shown after deployment
WORKER_URL="https://mcpoverflow-ai-engine.workers.dev"

# Test health
curl $WORKER_URL/health

# Test API
curl -X POST $WORKER_URL/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"specType":"openapi","spec":{"openapi":"3.0.0","info":{"title":"Test","version":"1.0"},"paths":{"/test":{"get":{}}}}}'
```

## Update Go Backend

```bash
# Update environment variable
export OPENHANDS_API_URL=https://mcpoverflow-ai-engine.workers.dev

# Or in .env
echo "OPENHANDS_API_URL=https://mcpoverflow-ai-engine.workers.dev" >> services/api-service/.env

# Restart Go API
./deploy-ai.sh restart
```

## View Logs

```bash
cd packages/ai-engine
wrangler tail
```

## Common Commands

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# View deployments
wrangler deployments list

# Rollback
wrangler rollback <deployment-id>

# Update secret
echo "new-value" | wrangler secret put SECRET_NAME
```

## Custom Domain

1. Add domain in Cloudflare Dashboard
2. Update `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "ai.mcpoverflow.io", custom_domain = true }
   ]
   ```
3. Redeploy: `npm run deploy`

## Troubleshooting

### Worker Not Responding
```bash
wrangler tail --format=pretty
```

### Check KV Storage
```bash
wrangler kv:namespace list
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

### CPU Time Limit
- Upgrade to paid plan ($5/month)
- Optimize code
- Use caching

## Costs

- **Free**: 100K requests/day
- **Paid**: $5/month + $0.50 per million requests

## Next Steps

1. ✅ Configure custom domain
2. ✅ Set up monitoring alerts
3. ✅ Implement caching
4. ✅ Load test

## Support

- 📖 Full docs: [CLOUDFLARE_DEPLOYMENT.md](../../../08_open_source/OpenHands/CLOUDFLARE_DEPLOYMENT.md)
- 💬 Discord: https://discord.gg/mcpoverflow
- 🐛 Issues: https://github.com/mcpoverflow/mcpoverflow/issues

---

**That's it! Your AI Engine is now globally distributed on Cloudflare's edge network.** 🚀
