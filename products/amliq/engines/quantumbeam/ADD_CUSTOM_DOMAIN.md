# 🌐 Add Custom Domain to QuantumBeam

Your QuantumBeam platform is ready to use custom domains!

---

## 🎯 Quick Setup

### Method 1: Via Cloudflare Dashboard (Recommended)

#### For Main Worker (quantumbeam)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/d2fe608a92dc9faa2ce5b0fd2cad5eb7/workers/overview)

2. Click on **quantumbeam** worker

3. Go to **Triggers** tab

4. Click **Add Custom Domain**

5. Enter your domain:
   - For API: `api.yourdomain.com`
   - For App: `app.yourdomain.com`

6. Click **Add Custom Domain**

7. Cloudflare will automatically:
   - Create DNS records
   - Issue SSL certificate
   - Configure routing

#### For Fraud Detection Worker (quantumbeam-api)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/d2fe608a92dc9faa2ce5b0fd2cad5eb7/workers/overview)

2. Click on **quantumbeam-api** worker

3. Go to **Triggers** tab

4. Click **Add Custom Domain**

5. Enter: `fraud.yourdomain.com` or `api.yourdomain.com`

#### For Website (quantumbeam-website)

1. Go to **Workers & Pages** > **quantumbeam-website**

2. Go to **Custom domains** tab

3. Click **Set up a custom domain**

4. Enter: `yourdomain.com` or `www.yourdomain.com`

5. Click **Continue**

6. DNS will be automatically configured

---

## Method 2: Via wrangler.toml Configuration

### Step 1: Update Main Worker Configuration

Edit `/wrangler.toml`:

```toml
# Uncomment and update these lines with your domain:

# Route Configuration
[[routes]]
pattern = "api.yourdomain.com/*"
zone_name = "yourdomain.com"

[[routes]]
pattern = "app.yourdomain.com/*"
zone_name = "yourdomain.com"
```

### Step 2: Update Fraud Detection Worker Configuration

Edit `/cloudflare/wrangler.toml`:

```toml
# Add route configuration
[[routes]]
pattern = "fraud.yourdomain.com/*"
zone_name = "yourdomain.com"

# Or add workers_dev route
workers_dev = true
```

### Step 3: Deploy with New Routes

```bash
# Deploy main worker
wrangler deploy --env=""

# Deploy fraud detection worker
cd cloudflare && wrangler deploy
```

---

## Method 3: Using Wrangler CLI Triggers

```bash
# Add custom domain to main worker
wrangler triggers add quantumbeam \
  --custom-domain api.yourdomain.com

# Add custom domain to fraud detection worker
wrangler triggers add quantumbeam-api \
  --custom-domain fraud.yourdomain.com
```

---

## 🔧 Domain Setup Examples

### Example 1: Using Subdomain for API

**Your Setup**:
- Main domain: `quantumbeam.io`
- API: `api.quantumbeam.io`
- Fraud API: `fraud.quantumbeam.io`
- Website: `quantumbeam.io`

**Configuration** (`wrangler.toml`):
```toml
[[routes]]
pattern = "api.quantumbeam.io/*"
zone_name = "quantumbeam.io"
```

**Configuration** (`cloudflare/wrangler.toml`):
```toml
[[routes]]
pattern = "fraud.quantumbeam.io/*"
zone_name = "quantumbeam.io"
```

### Example 2: Using Path-based Routing

**Your Setup**:
- Main domain: `quantumbeam.io`
- API: `quantumbeam.io/api/*`
- Website: `quantumbeam.io/*`

**Configuration**:
```toml
[[routes]]
pattern = "quantumbeam.io/api/*"
zone_name = "quantumbeam.io"
```

---

## 📋 DNS Records (Manual Setup)

If configuring DNS manually:

### For API Subdomain
```
Type: CNAME
Name: api
Content: quantumbeam.broad-dew-49ad.workers.dev
Proxy: Enabled (Orange cloud)
```

### For Fraud API Subdomain
```
Type: CNAME
Name: fraud
Content: quantumbeam-api.broad-dew-49ad.workers.dev
Proxy: Enabled (Orange cloud)
```

### For Root Domain (Website)
```
Type: CNAME
Name: @
Content: develop.quantumbeam-website.pages.dev
Proxy: Enabled (Orange cloud)
```

---

## ✅ Verification Steps

### 1. Check DNS Propagation

```bash
# Check if DNS is working
dig api.yourdomain.com
dig fraud.yourdomain.com
dig yourdomain.com

# Or use nslookup
nslookup api.yourdomain.com
```

### 2. Test HTTPS

```bash
# Test main API
curl https://api.yourdomain.com/health

# Test fraud detection
curl https://fraud.yourdomain.com/health/detailed

# Test website
curl -I https://yourdomain.com
```

### 3. Verify SSL Certificate

```bash
# Check SSL certificate
curl -vI https://api.yourdomain.com 2>&1 | grep "SSL certificate"

# Should show valid Cloudflare certificate
```

---

## 🚀 Quick Deploy Script

Create a script to update and deploy with your domain:

```bash
#!/bin/bash

# Your domain
DOMAIN="yourdomain.com"

echo "🌐 Configuring custom domain: $DOMAIN"

# Update main wrangler.toml
cat >> wrangler.toml << EOF

# Route Configuration
[[routes]]
pattern = "api.$DOMAIN/*"
zone_name = "$DOMAIN"
EOF

# Update fraud detection wrangler.toml
cat >> cloudflare/wrangler.toml << EOF

# Route Configuration
[[routes]]
pattern = "fraud.$DOMAIN/*"
zone_name = "$DOMAIN"
EOF

# Deploy main worker
echo "📦 Deploying main worker..."
wrangler deploy --env=""

# Deploy fraud detection worker
echo "📦 Deploying fraud detection worker..."
cd cloudflare && wrangler deploy && cd ..

# Configure website
echo "🌐 Configuring website domain..."
cd web/marketing
npx wrangler pages project create quantumbeam-website --production-branch=main || true
npx wrangler pages domain add quantumbeam-website $DOMAIN

echo "✅ Domain configuration complete!"
echo ""
echo "Your URLs:"
echo "  Main API: https://api.$DOMAIN"
echo "  Fraud API: https://fraud.$DOMAIN"
echo "  Website: https://$DOMAIN"
echo ""
echo "DNS propagation may take up to 24 hours."
```

---

## 🎯 Recommended Domain Structure

### Option 1: Subdomain Approach (Recommended)
```
yourdomain.com              → Website
api.yourdomain.com          → Main API Worker
fraud.yourdomain.com        → Fraud Detection API
ws.yourdomain.com           → WebSocket endpoint
admin.yourdomain.com        → Admin dashboard
```

### Option 2: Path-based Approach
```
yourdomain.com              → Website
yourdomain.com/api/*        → Main API Worker
yourdomain.com/fraud/*      → Fraud Detection
yourdomain.com/ws           → WebSocket
yourdomain.com/admin        → Admin dashboard
```

### Option 3: Separate Domains
```
quantumbeam.io              → Marketing website
app.quantumbeam.io          → Application
api.quantumbeam.io          → API Gateway
fraud.quantumbeam.io        → Fraud Detection
docs.quantumbeam.io         → Documentation
```

---

## 🔒 SSL/TLS Configuration

### Automatic (Recommended)

Cloudflare automatically:
- ✅ Issues SSL certificates
- ✅ Renews certificates
- ✅ Configures HTTPS
- ✅ Redirects HTTP to HTTPS

### Manual Configuration

1. Go to [SSL/TLS Settings](https://dash.cloudflare.com/d2fe608a92dc9faa2ce5b0fd2cad5eb7/ssl-tls)

2. Set SSL/TLS encryption mode:
   - **Full (strict)** - Recommended for Workers
   - Encrypts end-to-end

3. Enable:
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites
   - ✅ HTTP Strict Transport Security (HSTS)

---

## 🧪 Testing Your Custom Domain

### Test Script

```bash
#!/bin/bash

DOMAIN="yourdomain.com"

echo "🧪 Testing QuantumBeam Custom Domain"
echo "====================================="

# Test API health
echo ""
echo "1️⃣  Testing API health..."
curl -s https://api.$DOMAIN/health | python3 -m json.tool

# Test fraud detection
echo ""
echo "2️⃣  Testing fraud detection..."
curl -s https://fraud.$DOMAIN/health/detailed | python3 -m json.tool

# Test website
echo ""
echo "3️⃣  Testing website..."
curl -I https://$DOMAIN | head -5

# Test SSL
echo ""
echo "4️⃣  Testing SSL certificate..."
echo | openssl s_client -connect api.$DOMAIN:443 2>/dev/null | openssl x509 -noout -dates

echo ""
echo "✅ All tests complete!"
```

---

## 📊 Current Configuration

### Current URLs (workers.dev):
- Main API: https://quantumbeam.broad-dew-49ad.workers.dev
- Fraud API: https://quantumbeam-api.broad-dew-49ad.workers.dev
- Website: https://develop.quantumbeam-website.pages.dev

### After Custom Domain Setup:
- Main API: https://api.yourdomain.com
- Fraud API: https://fraud.yourdomain.com (or https://api.yourdomain.com)
- Website: https://yourdomain.com

---

## 🆘 Troubleshooting

### Domain Not Working

```bash
# Check DNS records
wrangler zones list
wrangler zones details <zone-id>

# Verify worker routes
wrangler deployments list
```

### SSL Certificate Issues

1. Wait 15-30 minutes for certificate issuance
2. Check SSL/TLS mode in dashboard
3. Verify DNS is proxied (orange cloud)

### 522 Error (Connection Timed Out)

- Check worker is deployed: `wrangler deployments list`
- Verify routes are correct
- Check worker logs: `wrangler tail`

### 1001 Error (DNS Resolution)

- DNS not propagated yet (wait 24h)
- Check nameservers point to Cloudflare
- Verify zone is active

---

## 💡 Pro Tips

1. **Use Subdomain for API**: Easier to manage and scale
2. **Enable HSTS**: Improved security
3. **Set up Page Rules**: Cache static assets, redirect HTTP to HTTPS
4. **Monitor with Analytics**: Track usage and performance
5. **Use Custom Domain for Branding**: Professional appearance

---

## 📞 Next Steps

**Tell me your domain name and I'll:**
1. Update wrangler.toml configurations
2. Create deployment script
3. Test the setup
4. Provide specific instructions for your domain

**Example domains to configure:**
- `api.quantumbeam.io` - Main API
- `fraud.quantumbeam.io` - Fraud Detection
- `quantumbeam.io` - Website

---

*Ready to add your domain? Just provide the domain name!*
