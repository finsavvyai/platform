# Questro Subdomain DNS Setup Guide

## Quick Summary

✅ **Base Domains Ready:** `qestro.io` and `qestro.app` (already on Cloudflare)  
✅ **Workers Deployed:** Routes configured for `api.qestro.io/*` and `api.qestro.app/*`  
🔄 **Next Step:** Create A records for API subdomains  

## Current Status

### ✅ Working
- `qestro.io` → Resolves to Cloudflare nameservers
- `qestro.app` → Resolves to Cloudflare nameservers  
- Questro API → Deployed on Cloudflare Workers
- Custom routes configured for both domains

### 🔄 Needed
- `api.qestro.io` → DNS A record needed
- `api.qestro.app` → DNS A record needed

## DNS Setup Instructions

### Prerequisites
- ✅ Access to Cloudflare dashboard
- ✅ Admin permissions for qestro.io and qestro.app
- ✅ Base domains already added to Cloudflare

### Step 1: Log into Cloudflare Dashboard
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select **qestro.io** zone
3. Click **DNS** → **Records**

### Step 2: Create API Subdomain for qestro.io

#### Add A Record for api.qestro.io:
```
Type: A
Name: api
IPv4 address: 192.0.2.1
Proxy status: Proxied (☁️ Orange cloud)
TTL: Auto
Comment: Questro API subdomain
```

#### Optional: Add AAAA Record (IPv6)
```
Type: AAAA  
Name: api
IPv6 address: 100::
Proxy status: Proxied (☁️ Orange cloud)
TTL: Auto
Comment: Questro API IPv6 support
```

### Step 3: Switch to qestro.app Zone

1. In Cloudflare dashboard, select **qestro.app** zone
2. Click **DNS** → **Records**

#### Add A Record for api.qestro.app:
```
Type: A
Name: api
IPv4 address: 192.0.2.1
Proxy status: Proxied (☁️ Orange cloud)
TTL: Auto
Comment: Questro API subdomain
```

#### Optional: Add AAAA Record (IPv6)
```
Type: AAAA
Name: api
IPv6 address: 100::
Proxy status: Proxied (☁️ Orange cloud)
TTL: Auto
Comment: Questro API IPv6 support
```

### Step 4: DNS Propagation Check

Wait 5-15 minutes for DNS propagation, then test:

```bash
# Test qestro.io
nslookup api.qestro.io

# Test qestro.app  
nslookup api.qestro.app
```

Expected results:
```
api.qestro.io has address 192.0.2.1
api.qestro.app has address 192.0.2.1
```

### Step 5: Test API Endpoints

```bash
# Test qestro.io API
curl https://api.qestro.io/health

# Test qestro.app API
curl https://api.qestro.app/health
```

Both should return:
```json
{
  "status": "healthy",
  "platform": "cloudflare-workers",
  "message": "Questro API is running on Cloudflare Workers!"
}
```

## Alternative: Automatic DNS Creation

If you prefer not to manually create DNS records, Cloudflare Workers can create them automatically when the subdomain is first accessed. However, manual setup gives you more control over:

- **TTL values**
- **Proxying settings**  
- **IPv4/IPv6 dual-stack**
- **Analytics tags**

## Frontend Configuration Update

The frontend has been updated to use the new domains:

### Production Configuration (qestro.app)
```toml
[env.production.vars]
VITE_API_URL = "https://api.qestro.app"
VITE_WS_URL = "wss://api.qestro.app"
VITE_APP_URL = "https://app.qestro.io"
```

### Preview Configuration
```toml
[env.preview.vars]
VITE_API_URL = "https://api-preview.qestro.app"
VITE_WS_URL = "wss://api-preview.qestro.app"
VITE_APP_URL = "https://preview-app.qestro.io"
```

## Security Configuration

### 1. SSL/TLS Settings
For both zones in Cloudflare dashboard:
1. **SSL/TLS** → **Overview**
2. **Encryption mode:** Set to **Full (Strict)**
3. **Always Use HTTPS:** ✅ Enabled
4. **HSTS:** ✅ Enabled

### 2. Security Headers
The Workers automatically include security headers:
```javascript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}
```

### 3. Firewall Rules (Optional)
Consider adding rate limiting:
- `api.qestro.io/*` → Rate limit requests
- `api.qestro.app/*` → DDoS protection

## Performance Optimization

### 1. Caching Rules
For API endpoints (both domains):
```
Cache Level: Bypass
Edge Cache TTL: Respect existing headers
Browser Cache TTL: 4 hours
```

### 2. Page Rules
```
qestro.io/api/* → Add security headers
qestro.app/api/* → Add security headers

app.qestro.io/* → Redirect to qestro.io/*
api.qestro.io/* → Add CORS headers
```

### 3. Analytics
- Enable Cloudflare Analytics for both domains
- Track API usage patterns
- Monitor geographic distribution

## Testing Checklist

### DNS Tests
- [ ] `nslookup api.qestro.io` returns Cloudflare IP
- [ ] `nslookup api.qestro.app` returns Cloudflare IP
- [ ] Both resolve to proxied IPs (192.0.2.1)

### API Tests
- [ ] `https://api.qestro.io/health` returns 200 OK
- [ ] `https://api.qestro.app/health` returns 200 OK
- [ ] Response time < 100ms (global edge)

### Frontend Tests
- [ ] Frontend connects to `https://api.qestro.app`
- [ ] WebSocket connection to `wss://api.qestro.app`
- [ ] All API calls work through custom domains

### Cross-Domain Tests
- [ ] CORS headers properly configured
- [ ] Requests from app.qestro.io work
- [ Requests from questro.io work

## Troubleshooting

### Common Issues

**1. Subdomain Not Found (NXDOMAIN)**
- ✅ **Wait longer:** DNS propagation can take 15-30 minutes
- ✅ **Check Cloudflare proxy:** Ensure proxy status is orange (proxied)
- ✅ **Clear DNS cache:** `ipconfig /flushdns` or use online tools

**2. API Returns 404**
- ✅ **Workers route configuration:** Verify wrangler.toml settings
- ✅ **Zone name:** Ensure correct zone name in routes
- ✅ **Worker deployment:** Verify latest deployment

**3. CORS Issues**
- ✅ **Workers code:** CORS headers included in Worker
- ✅ **Frontend config:** Environment variables updated
- ✅ **Preflight requests:** OPTIONS method handled

### Debug Commands

**Check DNS Resolution:**
```bash
# Detailed DNS lookup
dig api.qestro.io A
dig api.qestro.app AAAA

# Check Cloudflare configuration
curl -I https://api.qestro.io
```

**Check Workers Logs:**
```bash
wrangler tail questro-backend
```

**Test API Endpoints:**
```bash
# Verbose curl with headers
curl -v https://api.qestro.io/health

# Test with different domains
curl -H "Origin: https://app.questro.io" https://api.qestro.app/health
```

## Success Criteria

✅ **DNS Resolution**
- `api.qestro.io` resolves to Cloudflare
- `api.qestro.app` resolves to Cloudflare
- Both show proxied status

✅ **API Functionality**
- Health endpoints respond correctly
- API endpoints return proper data
- Response times are optimal

✅ **Frontend Integration**
- Frontend successfully calls APIs via custom domains
- WebSocket connections established
- Cross-origin requests work properly

✅ **Performance**
- Response times < 100ms globally
- Edge caching is working
- SSL/TLS configured correctly

✅ **Security**
- HTTPS enforced automatically
- Security headers configured
- Rate limiting enabled (if configured)

## Timeline

**Immediate (Today):**
- [ ] Create A records for `api.qestro.io`
- [ ] Create A records for `api.qestro.app`
- [ ] Test both domains resolve correctly
- [ ] Verify API endpoints work

**Day 1:**
- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Security verification

**Week 1:**
- [ ] Analytics setup
- [ ] Monitoring configuration
- [ ] Fine-tune caching rules

## Support Resources

**Cloudflare Documentation:**
- [Workers](https://developers.cloudflare.com/workers/)
- [DNS](https://developers.cloudflare.com/dns/)
- [SSL/TLS](https://developers.cloudflare.com/ssl/)

**Questro Resources:**
- [API Documentation](https://docs.questro.io)
- [Frontend Guide](https://docs.questro.io/frontend)
- [Deployment Guide](https://docs.questro.io/deployment)

## Conclusion

Once the DNS records are created and propagated, the Questro platform will have:

🎯 **Professional Domain Presence:**
- `api.qestro.io` - Primary API endpoint
- `api.qestro.app` - Alternative API endpoint
- `app.qestro.io` - Frontend application
- `questro.io` - Marketing site

🚀 **Complete Platform Integration:**
- Unified domain architecture
- Global edge performance
- Professional branding
- SSL/TLS security

🔒 **Enhanced Security:**
- DDoS protection
- Automatic HTTPS
- Security headers
- Rate limiting capability

The DNS setup typically takes 5-15 minutes to propagate, after which the Questro platform will be fully operational with professional custom domains! 🚀