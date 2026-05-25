# 🌐 Custom Domain Setup - rag.lunaos.ai

## Overview
Configure Luna Vision RAG™ to run on your custom domain: **rag.lunaos.ai**

---

## 📋 Prerequisites

- ✅ Domain: `lunaos.ai` (owned by you)
- ✅ Cloudflare account with domain management
- ✅ Zone ID: `cb6caa02e2da8b39e826cd6ba9fb18df`
- ✅ Account ID: `d2fe608a92dc9faa2ce5b0fd2cad5eb7`

---

## 🚀 Setup Steps

### Step 1: DNS Configuration

The subdomain `rag.lunaos.ai` needs to be configured in Cloudflare DNS.

**Option A: Automatic (via Wrangler)**
```bash
cd mcp-servers/luna-rag-glm-integration
wrangler deploy
```
Wrangler will automatically configure the DNS when you deploy with routes configured.

**Option B: Manual DNS Setup**

1. Go to Cloudflare Dashboard: https://dash.cloudflare.com
2. Select your domain: `lunaos.ai`
3. Go to **DNS** → **Records**
4. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: `rag`
   - **Target**: `luna-vision-rag.broad-dew-49ad.workers.dev`
   - **Proxy status**: ✅ Proxied (orange cloud)
   - **TTL**: Auto

---

### Step 2: Deploy Worker with Custom Domain

```bash
cd mcp-servers/luna-rag-glm-integration

# Deploy to custom domain
wrangler deploy

# Verify deployment
curl https://rag.lunaos.ai/health
```

---

### Step 3: Verify Configuration

Test all endpoints on the new domain:

```bash
# Health check
curl https://rag.lunaos.ai/health

# API info
curl https://rag.lunaos.ai/api

# RAG query
curl -X POST https://rag.lunaos.ai/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionName":"demo","topK":5}'
```

---

## 🔧 Configuration Details

### wrangler.toml
```toml
name = "luna-vision-rag"
account_id = "d2fe608a92dc9faa2ce5b0fd2cad5eb7"

# Custom domain route
routes = [
  { pattern = "rag.lunaos.ai/*", zone_id = "cb6caa02e2da8b39e826cd6ba9fb18df" }
]

[vars]
CUSTOM_DOMAIN = "rag.lunaos.ai"
```

### DNS Record
```
Type: CNAME
Name: rag
Target: luna-vision-rag.broad-dew-49ad.workers.dev
Proxied: Yes (orange cloud)
```

---

## 🌍 URLs After Setup

### Production URLs
- **Main API**: https://rag.lunaos.ai
- **Health Check**: https://rag.lunaos.ai/health
- **API Docs**: https://rag.lunaos.ai/api

### Legacy URL (still works)
- **Workers URL**: https://luna-vision-rag.broad-dew-49ad.workers.dev

### API Endpoints
- **RAG Setup**: `POST https://rag.lunaos.ai/api/rag/setup`
- **RAG Query**: `POST https://rag.lunaos.ai/api/rag/query`
- **RAG Index**: `POST https://rag.lunaos.ai/api/rag/index`
- **GLM Capture**: `POST https://rag.lunaos.ai/api/glm/capture`
- **GLM Analyze**: `POST https://rag.lunaos.ai/api/glm/analyze`
- **GLM Test**: `POST https://rag.lunaos.ai/api/glm/test`
- **Integration Validate**: `POST https://rag.lunaos.ai/api/integration/validate`
- **Integration Generate**: `POST https://rag.lunaos.ai/api/integration/generate`
- **Integration Report**: `POST https://rag.lunaos.ai/api/integration/report`

---

## 🔒 SSL/TLS Configuration

Cloudflare automatically provides:
- ✅ **Free SSL certificate** for rag.lunaos.ai
- ✅ **Automatic HTTPS** redirect
- ✅ **TLS 1.3** support
- ✅ **HTTP/2** and **HTTP/3** enabled

No additional SSL configuration needed!

---

## 🚦 Traffic Routing

```
User Request
    ↓
rag.lunaos.ai (Cloudflare DNS)
    ↓
Cloudflare Edge (200+ locations)
    ↓
Luna Vision RAG Worker
    ↓
Response (< 100ms globally)
```

---

## 📊 Monitoring

### Check Worker Status
```bash
# View logs
wrangler tail

# Check deployment
wrangler deployments list

# View worker details
wrangler whoami
```

### Performance Metrics
```bash
# Test response time
curl -w "\nTime: %{time_total}s\n" https://rag.lunaos.ai/health

# Test from multiple locations
curl https://rag.lunaos.ai/health -H "CF-IPCountry: US"
curl https://rag.lunaos.ai/health -H "CF-IPCountry: EU"
curl https://rag.lunaos.ai/health -H "CF-IPCountry: AS"
```

---

## 🔄 Updating the Domain

### Change Subdomain
If you want to change to a different subdomain:

1. Update `wrangler.toml`:
```toml
routes = [
  { pattern = "newsubdomain.lunaos.ai/*", zone_id = "cb6caa02e2da8b39e826cd6ba9fb18df" }
]
```

2. Update DNS in Cloudflare Dashboard

3. Redeploy:
```bash
wrangler deploy
```

### Add Multiple Domains
```toml
routes = [
  { pattern = "rag.lunaos.ai/*", zone_id = "cb6caa02e2da8b39e826cd6ba9fb18df" },
  { pattern = "api.lunaos.ai/*", zone_id = "cb6caa02e2da8b39e826cd6ba9fb18df" }
]
```

---

## 🐛 Troubleshooting

### DNS Not Resolving
```bash
# Check DNS propagation
dig rag.lunaos.ai
nslookup rag.lunaos.ai

# Check Cloudflare DNS
curl -H "Host: rag.lunaos.ai" https://1.1.1.1/dns-query?name=rag.lunaos.ai
```

**Solution**: Wait 1-5 minutes for DNS propagation

### 522 Error (Connection Timeout)
**Cause**: Worker not responding
**Solution**: 
```bash
wrangler deploy
wrangler tail  # Check for errors
```

### 404 Not Found
**Cause**: Route not configured correctly
**Solution**: Verify `wrangler.toml` routes and zone_id

### SSL Certificate Issues
**Cause**: Cloudflare proxy not enabled
**Solution**: Enable orange cloud (Proxied) in DNS settings

---

## ✅ Verification Checklist

After setup, verify:

- [ ] DNS resolves: `dig rag.lunaos.ai`
- [ ] HTTPS works: `curl https://rag.lunaos.ai/health`
- [ ] SSL certificate valid (check in browser)
- [ ] All API endpoints respond correctly
- [ ] Response time < 100ms
- [ ] CORS headers present
- [ ] Old workers.dev URL still works (fallback)

---

## 📈 Next Steps

After custom domain is configured:

1. **Update Documentation**
   - Update all docs with new domain
   - Update README.md
   - Update DEPLOYMENT_SUCCESS.md

2. **Update Marketing Materials**
   - Update website
   - Update social media
   - Update email signatures

3. **Configure Analytics**
   - Set up Cloudflare Analytics
   - Configure custom dashboards
   - Set up alerts

4. **Add More Features**
   - Custom error pages
   - Rate limiting
   - Authentication
   - API versioning

---

## 🎯 Production Checklist

- [x] Custom domain configured (rag.lunaos.ai)
- [x] DNS CNAME record added
- [x] SSL certificate active
- [x] Worker deployed to custom domain
- [x] All endpoints tested
- [ ] Analytics configured
- [ ] Monitoring alerts set up
- [ ] Documentation updated
- [ ] Team notified

---

## 📞 Support

**Cloudflare Dashboard**: https://dash.cloudflare.com
**Worker URL**: https://rag.lunaos.ai
**Documentation**: `/mcp-servers/luna-rag-glm-integration/README.md`

---

**🎉 Your Luna Vision RAG™ is now live at rag.lunaos.ai!**
