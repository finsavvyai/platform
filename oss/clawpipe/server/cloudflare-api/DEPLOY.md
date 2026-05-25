# 🚀 Cloudflare Workers Deployment Guide

## Quick Deploy

### 1. Login to Cloudflare
```bash
cd cloudflare-api
wrangler login
```

### 2. Deploy to Workers (Free Tier)
```bash
# Deploy to default environment
wrangler deploy

# Or deploy to production
wrangler deploy --env production
```

### 3. Set Environment Variables (if needed)
```bash
# Set cluster URLs (if your cluster is publicly accessible)
wrangler secret put CLUSTER_MASTER_URL
wrangler secret put AI_WORKER_URL
wrangler secret put GATEWAY_URL
```

---

## Configuration Options

### Option 1: Local Cluster via Tunnel (Recommended)

If your cluster is running locally, use Cloudflare Tunnel:

```bash
# Install cloudflared
brew install cloudflared  # macOS
# or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# Create tunnel
cloudflared tunnel create finsavvyai-cluster

# Configure tunnel
cloudflared tunnel route dns finsavvyai-cluster cluster.yourdomain.com

# Run tunnel (connects localhost:8080 to Cloudflare)
cloudflared tunnel run finsavvyai-cluster
```

Then update worker to use tunnel URL.

### Option 2: Public Cluster URLs

If your cluster is publicly accessible:

```bash
# Set secrets
wrangler secret put CLUSTER_MASTER_URL
# Enter: https://your-master-domain.com

wrangler secret put GATEWAY_URL
# Enter: https://your-gateway-domain.com
```

### Option 3: Use Cloudflare Tunnel in Worker

Update worker to use Cloudflare Tunnel connection.

---

## Deployment Steps

### Step 1: Verify Setup
```bash
cd cloudflare-api
npm install
wrangler whoami
```

### Step 2: Deploy
```bash
# Deploy to workers.dev subdomain
wrangler deploy

# Your worker will be available at:
# https://finsavvyai-llm-proxy.YOUR_SUBDOMAIN.workers.dev
```

### Step 3: Test
```bash
# Test health endpoint
curl https://finsavvyai-llm-proxy.YOUR_SUBDOMAIN.workers.dev/health

# Test info endpoint
curl https://finsavvyai-llm-proxy.YOUR_SUBDOMAIN.workers.dev/info
```

### Step 4: Custom Domain (Optional)
```bash
# Add custom domain in Cloudflare dashboard
# Or update wrangler.toml with routes
wrangler deploy --env production
```

---

## Environment Variables

The worker supports these environment variables:

- `CLUSTER_MASTER_URL` - Master server URL (default: http://localhost:8000)
- `AI_WORKER_URL` - Worker node URL (default: http://localhost:8001)
- `GATEWAY_URL` - API Gateway URL (default: http://localhost:8080)

**Note**: Cloudflare Workers cannot access localhost. You need:
- Public URLs, OR
- Cloudflare Tunnel, OR
- Update worker to use tunnel connection

---

## Quick Deploy Script

```bash
#!/bin/bash
# Quick deploy script

cd cloudflare-api

echo "🔐 Logging in to Cloudflare..."
wrangler login

echo "📦 Deploying worker..."
wrangler deploy

echo "✅ Deployment complete!"
echo ""
echo "Your worker is available at:"
wrangler whoami
```

---

## Troubleshooting

### Error: Cannot access localhost
**Solution**: Use Cloudflare Tunnel or public URLs

### Error: Authentication failed
**Solution**: Run `wrangler login` again

### Error: Route not found
**Solution**: Deploy without routes first, add domain later

---

## Monitoring

```bash
# View logs
wrangler tail

# View analytics
wrangler analytics

# Check status
wrangler deployments list
```

---

**Ready to deploy!** 🚀

