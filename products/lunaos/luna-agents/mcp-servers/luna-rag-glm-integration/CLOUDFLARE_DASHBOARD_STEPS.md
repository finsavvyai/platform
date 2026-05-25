# 🎯 Cloudflare Dashboard Setup - Visual Guide

## Step-by-Step: Add rag.lunaos.ai to Luna Vision RAG Worker

---

## Method 1: Via Workers Routes (Recommended)

### Step 1: Access Cloudflare Dashboard
```
1. Open browser → https://dash.cloudflare.com
2. Log in with your Cloudflare account
3. You'll see your domains list
```

### Step 2: Select Your Domain
```
1. Click on "lunaos.ai" domain
2. You'll be taken to the domain overview page
```

### Step 3: Navigate to Workers Routes
```
Option A (Direct):
1. Look for "Workers Routes" in the left sidebar
2. Click "Workers Routes"

Option B (Via Workers & Pages):
1. Click "Workers & Pages" in the left sidebar
2. Find "luna-vision-rag" in the list
3. Click on it
4. Go to "Settings" tab
5. Click "Triggers" section
6. Scroll to "Routes"
```

### Step 4: Add New Route
```
1. Click "Add route" button
2. Fill in the form:
   
   Route:    rag.lunaos.ai/*
   Zone:     lunaos.ai
   Worker:   luna-vision-rag (select from dropdown)

3. Click "Save" or "Add Route"
```

### Step 5: Verify Route Added
```
You should see in the routes list:
✅ rag.lunaos.ai/* → luna-vision-rag
```

---

## Method 2: Via Custom Domains (Alternative)

### Step 1: Go to Worker Settings
```
1. Dashboard → Workers & Pages
2. Click "luna-vision-rag"
3. Go to "Settings" tab
4. Click "Domains & Routes"
```

### Step 2: Add Custom Domain
```
1. Click "Add Custom Domain"
2. Enter: rag.lunaos.ai
3. Click "Add Domain"
```

Cloudflare will automatically:
- Create DNS record
- Configure SSL certificate
- Set up routing

---

## DNS Verification

### Check if DNS Record Exists

```
1. Go to "DNS" → "Records" in Cloudflare Dashboard
2. Look for a record with name "rag"
```

### If DNS Record Doesn't Exist, Add It:

```
1. Click "Add record"
2. Fill in:
   
   Type:          CNAME
   Name:          rag
   Target:        luna-vision-rag.broad-dew-49ad.workers.dev
   Proxy status:  ✅ Proxied (orange cloud - MUST be enabled)
   TTL:           Auto

3. Click "Save"
```

---

## ✅ Verification Steps

### 1. Wait for DNS Propagation
```bash
# Wait 1-2 minutes, then check DNS
dig rag.lunaos.ai

# Should return Cloudflare IPs (if proxied)
```

### 2. Test HTTPS Connection
```bash
# Test health endpoint
curl https://rag.lunaos.ai/health

# Expected response:
{
  "status": "healthy",
  "service": "Luna Vision RAG",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2025-11-06T12:00:00.000Z",
  "features": {
    "rag": true,
    "glm_vision": true,
    "integration": true
  }
}
```

### 3. Test API Endpoints
```bash
# Test API info
curl https://rag.lunaos.ai/api

# Test RAG query
curl -X POST https://rag.lunaos.ai/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "authentication",
    "collectionName": "demo",
    "topK": 5
  }'
```

### 4. Check SSL Certificate
```bash
# Verify SSL is working
curl -I https://rag.lunaos.ai/health | grep -i "HTTP\|server"

# Should show:
# HTTP/2 200
# server: cloudflare
```

### 5. Test Response Time
```bash
# Check global performance
curl -w "\nTime: %{time_total}s\n" https://rag.lunaos.ai/health

# Should be < 0.1s (100ms)
```

---

## 🐛 Troubleshooting

### Issue: "Cannot add route - Authentication error"
**Solution**: Your API token needs "Workers Routes:Edit" permission
- Go to: https://dash.cloudflare.com/profile/api-tokens
- Edit your token
- Add "Zone.Workers Routes.Edit" permission
- Or use the Dashboard method instead (no API token needed)

### Issue: DNS not resolving
**Solution**: 
1. Check DNS record exists
2. Ensure Proxy is enabled (orange cloud)
3. Wait 2-5 minutes for propagation
4. Clear DNS cache: `sudo dscacheutil -flushcache` (Mac)

### Issue: 522 Connection Timed Out
**Solution**:
1. Verify worker is deployed: `wrangler deployments list`
2. Check worker route is correct: `rag.lunaos.ai/*` (with /*)
3. Ensure worker name matches: `luna-vision-rag`

### Issue: 404 Not Found
**Solution**:
1. Route pattern must include `/*` at the end
2. Verify route is added in Cloudflare Dashboard
3. Check worker is deployed and running

### Issue: SSL Certificate Error
**Solution**:
1. Ensure DNS proxy is enabled (orange cloud)
2. Wait 1-2 minutes for SSL provisioning
3. Cloudflare provides automatic SSL for proxied domains

---

## 📊 Expected Configuration

After successful setup:

### Routes Table (in Cloudflare Dashboard)
```
Route                  Worker              Zone
─────────────────────  ──────────────────  ─────────
rag.lunaos.ai/*        luna-vision-rag     lunaos.ai
```

### DNS Records Table
```
Type    Name    Content                                      Proxy
──────  ──────  ───────────────────────────────────────────  ──────
CNAME   rag     luna-vision-rag.broad-dew-49ad.workers.dev  ✅ Yes
```

### SSL/TLS Settings
```
Mode:           Full (strict) or Flexible
Status:         Active Certificate
Edge:           Universal SSL
```

---

## 🎉 Success Indicators

When everything is working:

✅ **DNS resolves**: `dig rag.lunaos.ai` returns Cloudflare IPs  
✅ **HTTPS works**: `curl https://rag.lunaos.ai/health` returns 200  
✅ **SSL valid**: No certificate warnings in browser  
✅ **Fast response**: < 100ms globally  
✅ **CORS enabled**: Headers present in responses  
✅ **All endpoints work**: All 9 API endpoints responding  

---

## 📝 Post-Setup Checklist

After domain is live:

- [ ] Test all API endpoints
- [ ] Verify SSL certificate
- [ ] Check response times
- [ ] Update documentation with new domain
- [ ] Update README.md
- [ ] Update DEPLOYMENT_SUCCESS.md
- [ ] Update LAUNCH_SUMMARY.md
- [ ] Update marketing materials
- [ ] Announce new domain to team
- [ ] Set up monitoring alerts

---

## 🔗 Quick Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Workers & Pages**: https://dash.cloudflare.com/?to=/:account/workers-and-pages
- **DNS Settings**: https://dash.cloudflare.com/?to=/:account/:zone/dns
- **SSL/TLS**: https://dash.cloudflare.com/?to=/:account/:zone/ssl-tls
- **API Tokens**: https://dash.cloudflare.com/profile/api-tokens

---

## 📞 Need Help?

**Cloudflare Support**: https://support.cloudflare.com  
**Workers Docs**: https://developers.cloudflare.com/workers  
**Custom Domains**: https://developers.cloudflare.com/workers/configuration/routing/custom-domains

---

## 🎯 Final Test Script

Run this after setup to verify everything:

```bash
#!/bin/bash

echo "🧪 Testing rag.lunaos.ai setup..."
echo ""

# Test 1: DNS Resolution
echo "1️⃣ Testing DNS..."
dig +short rag.lunaos.ai
echo ""

# Test 2: Health Check
echo "2️⃣ Testing Health Endpoint..."
curl -s https://rag.lunaos.ai/health | jq .
echo ""

# Test 3: API Info
echo "3️⃣ Testing API Info..."
curl -s https://rag.lunaos.ai/api | jq .
echo ""

# Test 4: Response Time
echo "4️⃣ Testing Response Time..."
curl -w "\nTime: %{time_total}s\n" -s -o /dev/null https://rag.lunaos.ai/health
echo ""

# Test 5: SSL Certificate
echo "5️⃣ Testing SSL..."
curl -I https://rag.lunaos.ai/health 2>&1 | grep -i "HTTP\|server"
echo ""

echo "✅ All tests complete!"
```

Save as `test-domain.sh`, make executable with `chmod +x test-domain.sh`, then run `./test-domain.sh`

---

**🚀 Ready to go live at rag.lunaos.ai!**
