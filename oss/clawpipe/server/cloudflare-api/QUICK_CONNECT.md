# 🚀 Quick Connect: Cloudflare Worker to Local Cluster

## ✅ Current Status

**Worker Deployed**: ✅  
**URL**: https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev  
**Status**: Ready, needs backend connection

---

## 🔗 Connect Your Local Cluster (3 Options)

### Option 1: Cloudflare Tunnel (Recommended) ⭐

**Best for**: Secure, permanent connection

```bash
# 1. Install cloudflared (if not installed)
brew install cloudflared

# 2. Login to Cloudflare
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create finsavvyai-cluster

# 4. Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep finsavvyai-cluster | awk '{print $1}')

# 5. Configure tunnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: ~/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: cluster.finsavvyai.com
    service: http://localhost:8080
  - service: http_status:404
EOF

# 6. Route DNS (if you have domain)
cloudflared tunnel route dns finsavvyai-cluster cluster.finsavvyai.com

# 7. Start tunnel (keep this running)
cloudflared tunnel run finsavvyai-cluster
```

**Then update worker:**
```bash
cd cloudflare-api
wrangler secret put GATEWAY_URL
# Enter: https://cluster.finsavvyai.com
# Or use the tunnel URL from cloudflared output

wrangler deploy
```

### Option 2: ngrok (Quick Testing)

**Best for**: Quick testing, temporary

```bash
# Install ngrok
brew install ngrok

# Start tunnel
ngrok http 8080

# Copy the https URL (e.g., https://abc123.ngrok.io)

# Update worker
cd cloudflare-api
wrangler secret put GATEWAY_URL
# Paste ngrok URL

wrangler deploy
```

### Option 3: Public IP/URL

**Best for**: Production, publicly accessible cluster

If your cluster is publicly accessible:

```bash
cd cloudflare-api
wrangler secret put GATEWAY_URL
# Enter: https://your-public-gateway-url.com

wrangler deploy
```

---

## 🎯 Quick Setup Script

Use the automated script:

```bash
cd cloudflare-api
./setup_tunnel.sh
```

---

## ✅ Verify Connection

After setting up tunnel/URL:

```bash
# Test info
curl https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/info

# Test health (should connect to your cluster)
curl https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/health

# Test chat
curl -X POST https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo-sim","messages":[{"role":"user","content":"Hello!"}]}'
```

---

## 📊 Current Worker Status

**Deployed**: ✅  
**URL**: https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev  
**Backend**: ⚠️ Needs configuration

**Next**: Set up tunnel or configure backend URLs!

