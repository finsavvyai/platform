# Questro Custom Domain Setup Guide

## Overview

This guide will walk you through setting up custom domains for the Questro platform on Cloudflare, so your APIs and frontend are accessible at professional URLs like `api.questro.io` and `app.questro.io`.

## Current Status

✅ **Backend API**: Deployed on Cloudflare Workers  
🔄 **Custom Domains**: Need to be configured  
🎯 **Goal**: `api.questro.io` → Questro API

## Domain Setup Requirements

### Prerequisites
- Cloudflare account (✅ Already configured)
- Access to DNS management for questro.io
- Questro domains added to Cloudflare account

### Required Domains
- **Primary**: `questro.io` (base domain)
- **API Subdomain**: `api.questro.io` (backend API)
- **Frontend Subdomain**: `app.questro.io` (frontend)

## Step 1: Add Domain to Cloudflare

### 1.1 Add Base Domain
1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **"Add a site"**
3. Enter `questro.io`
4. Select **"Free"** plan (or appropriate plan)
5. Follow the setup wizard

### 1.2 Update Nameservers
After adding the domain, Cloudflare will provide nameservers like:
- `lina.ns.cloudflare.com`
- `matt.ns.cloudflare.com`

**Action**: Update your domain registrar to use these Cloudflare nameservers.

### 1.3 Verify Domain Propagation
Wait for DNS propagation (usually 15-30 minutes):
```bash
nslookup questro.io
# Should return Cloudflare DNS servers
```

## Step 2: Configure DNS Records

### 2.1 API Subdomain (api.questro.io)
In Cloudflare DNS management for `questro.io`:

**A Record for api.questro.io:**
```
Type: A
Name: api
IPv4 address: 192.0.2.1  # Temporary, will be updated by Workers
Proxy status: Proxied (Orange cloud)
TTL: Auto
```

**AAAA Record (optional, for IPv6):**
```
Type: AAAA
Name: api
IPv6 address: 100::  # Temporary, will be updated by Workers
Proxy status: Proxied (Orange cloud)
TTL: Auto
```

### 2.2 Frontend Subdomain (app.questro.io)
**A Record for app.questro.io:**
```
Type: A
Name: app
IPv4 address: 192.0.2.1  # Temporary
Proxy status: Proxied (Orange cloud)
TTL: Auto
```

### 2.3 Base Domain (questro.io)
**A Record for questro.io:**
```
Type: A
Name: @
IPv4 address: 192.0.2.1  # Temporary
Proxy status: Proxied (Orange cloud)
TTL: Auto
```

**CNAME for www (redirect):**
```
Type: CNAME
Name: www
Target: questro.io
Proxy status: Proxied (Orange cloud)
TTL: Auto
```

## Step 3: Configure Workers Routes

### 3.1 Update Backend Configuration
Update `/backend/wrangler.minimal.toml`:

```toml
name = "questro-backend"
main = "src/index.js"
compatibility_date = "2024-10-25"
account_id = "d2fe608a92dc9faa2ce5b0fd2cad5eb7"

# Custom domain routing
[[routes]]
pattern = "api.questro.io/*"
zone_name = "questro.io"

[env.production.vars]
NODE_ENV = "production"
ENVIRONMENT = "production"
```

### 3.2 Deploy with Custom Routes
```bash
cd backend
wrangler deploy --config wrangler.minimal.toml
```

## Step 4: Configure Frontend

### 4.1 Update Frontend Configuration
Update `/frontend/wrangler.toml`:

```toml
name = "questro-frontend"
pages_build_output_dir = "dist"

[env.production.vars]
NODE_ENV = "production"
VITE_API_URL = "https://api.questro.io"
VITE_WS_URL = "wss://api.questro.io"
VITE_APP_URL = "https://app.questro.io"
VITE_MARKETING_URL = "https://questro.io"
VITE_DOMAIN = "questro.io"
```

### 4.2 Deploy Frontend
```bash
cd frontend
npm run build
wrangler pages deploy
```

## Step 5: SSL/TLS Configuration

### 5.1 Enable SSL/TLS
1. In Cloudflare Dashboard → SSL/TLS → Overview
2. Set encryption mode to **"Full (Strict)"**
3. Enable **"Always Use HTTPS"**
4. Enable **"HSTS"**

### 5.2 Upload Custom Certificates (Optional)
If you have custom SSL certificates:
1. Go to SSL/TLS → Edge Certificates
2. Upload certificate files
3. Activate for all subdomains

## Step 6: Testing and Verification

### 6.1 Test Backend API
```bash
# Test health endpoint
curl https://api.questro.io/health

# Test API status
curl https://api.questro.io/api/status
```

### 6.2 Test Frontend
```bash
# Test frontend
curl https://app.questro.io

# Check API connectivity
curl https://app.questro.io/api/health
```

### 6.3 Verify SSL
```bash
# Check SSL certificate
openssl s_client -connect api.questro.io:443 -servername api.questro.io
```

## Step 7: Performance Optimization

### 7.1 Enable Caching Rules
**API Routes (api.questro.io/*):**
```
Cache Level: Bypass
Edge Cache TTL: Respect existing headers
Browser Cache TTL: 4 hours
```

**Static Assets (app.questro.io/static/*):**
```
Cache Level: Cache Everything
Edge Cache TTL: 1 month
Browser Cache TTL: 1 year
```

### 7.2 Enable Page Rules
**Redirect www to non-www:**
```
www.questro.io/* -> https://questro.io/$1 (301 Redirect)
```

**API Security Headers:**
```
api.questro.io/* -> Add security headers
```

## Troubleshooting

### Common Issues

**1. Domain Not Found (NXDOMAIN)**
- ✅ Nameservers not updated at registrar
- ✅ DNS propagation not complete
- ✅ Domain not added to Cloudflare account

**2. Workers Route Not Working**
- ✅ Zone name incorrect in wrangler.toml
- ✅ DNS A records pointing to wrong IPs
- ✅ Workers not deployed with route configuration

**3. SSL Certificate Issues**
- ✅ SSL/TLS mode not set to "Full (Strict)"
- ✅ Mixed content issues (HTTP/HTTPS)
- ✅ Certificate not properly uploaded

### Debug Commands

**Check DNS Resolution:**
```bash
nslookup api.questro.io
dig api.questro.io A
```

**Check Workers Route:**
```bash
curl -v https://api.questro.io/health
```

**Check SSL Certificate:**
```bash
curl -I https://api.questro.io
```

## Security Best Practices

### 1. Enable Security Headers
```javascript
// In your Workers code
return new Response(response, {
  headers: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'"
  }
});
```

### 2. Rate Limiting
```javascript
// Add rate limiting to critical endpoints
const rateLimit = new Map();
```

### 3. CORS Configuration
```javascript
// Proper CORS headers
headers: {
  'Access-Control-Allow-Origin': 'https://app.questro.io',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}
```

## Timeline

**Day 1:**
- [ ] Add domain to Cloudflare
- [ ] Update nameservers
- [ ] Wait for DNS propagation

**Day 2:**
- [ ] Configure DNS records
- [ ] Test domain resolution
- [ ] Deploy with custom routes

**Day 3:**
- [ ] Configure SSL/TLS
- [ ] Set up caching rules
- [ ] Test full integration

**Day 4:**
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Monitor and adjust

## Support

**Cloudflare Documentation:**
- [Workers](https://developers.cloudflare.com/workers/)
- [Pages](https://developers.cloudflare.com/pages/)
- [DNS](https://developers.cloudflare.com/dns/)

**Questro Documentation:**
- [API Documentation](https://docs.questro.io)
- [Frontend Guide](https://docs.questro.io/frontend)

**Community Support:**
- [Cloudflare Community](https://community.cloudflare.com/)
- [Questro Discord](https://discord.gg/questro)

## Success Criteria

✅ **All endpoints accessible via custom domains**
- `https://api.questro.io/health` → ✅ Working
- `https://api.questro.io/api/*` → ✅ Working
- `https://app.questro.io` → ✅ Working

✅ **SSL/TLS properly configured**
- Valid certificates
- HTTPS redirects
- HSTS enabled

✅ **Performance optimized**
- Global edge caching
- Sub-second response times
- Proper cache headers

✅ **Security hardened**
- Security headers configured
- Rate limiting enabled
- CORS properly configured

## Conclusion

Once these steps are completed, the Questro platform will have a professional domain setup with:
- **Professional URLs**: api.questro.io, app.questro.io
- **Global Performance**: Edge caching and CDN distribution
- **Enterprise Security**: SSL/TLS, security headers, rate limiting
- **Easy Management**: Centralized Cloudflare dashboard control

The platform will be ready for production use with a professional, branded domain presence! 🚀