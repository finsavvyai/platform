# 🌐 Cloudflare Workers Deployment - Complete Setup

## ✅ Deployment Status

**Worker Deployed**: ✅ Success  
**URL**: https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev  
**Status**: Configured, needs backend connection

---

## 🔗 Connect Your Local Cluster

Cloudflare Workers **cannot access localhost**. You need to connect your local cluster using one of these methods:

### Option 1: Cloudflare Tunnel (Recommended) ⭐

**Best for**: Local development, secure connection

```bash
# 1. Install cloudflared
brew install cloudflared  # macOS
# or download from Cloudflare

# 2. Login
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create finsavvyai-cluster

# 4. Configure tunnel
# Edit ~/.cloudflared/config.yml:
tunnel: finsavvyai-cluster
credentials-file: ~/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: cluster.finsavvyai.com
    service: http://localhost:8080
  - service: http_status:404

# 5. Run tunnel
cloudflared tunnel run finsavvyai-cluster

# 6. Update worker with tunnel URL
wrangler secret put GATEWAY_URL
# Enter: https://cluster.finsavvyai.com
```

**Quick Setup Script:**
```bash
cd cloudflare-api
./setup_tunnel.sh
```

### Option 2: Public URLs

**Best for**: Production, publicly accessible cluster

```bash
# Set environment variables in Cloudflare
wrangler secret put GATEWAY_URL
# Enter your public gateway URL: https://your-gateway-domain.com

wrangler secret put CLUSTER_MASTER_URL
# Enter your public master URL: https://your-master-domain.com
```

### Option 3: ngrok (Quick Testing)

**Best for**: Quick testing, temporary access

```bash
# Install ngrok
brew install ngrok  # macOS

# Start tunnel
ngrok http 8080

# Use the ngrok URL
wrangler secret put GATEWAY_URL
# Enter: https://your-ngrok-url.ngrok.io
```

---

## 🚀 Update Worker Configuration

After setting up tunnel or public URLs:

```bash
cd cloudflare-api

# Set secrets
wrangler secret put GATEWAY_URL
# Enter your gateway URL

# Redeploy
wrangler deploy
```

---

## ✅ Test Your Deployment

```bash
# Test info endpoint
curl https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/info

# Test health (if backend connected)
curl https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/health

# Test chat completion
curl -X POST https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo-sim",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 📊 Monitor Deployment

```bash
# View real-time logs
wrangler tail

# View analytics
wrangler analytics

# Check deployments
wrangler deployments list
```

---

## 🔧 Current Configuration

**Worker URL**: https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev

**Status**: 
- ✅ Worker deployed
- ⚠️  Backend URLs need configuration

**Next Steps**:
1. Set up Cloudflare Tunnel (recommended)
2. Or configure public URLs
3. Set environment variables
4. Redeploy worker

---

## 🎯 Quick Commands

```bash
# Deploy
cd cloudflare-api && wrangler deploy

# Set secrets
wrangler secret put GATEWAY_URL

# View logs
wrangler tail

# Update worker
wrangler deploy
```

---

**Your Cloudflare Worker is deployed and ready!** 🎉

Just connect it to your local cluster using one of the methods above.

