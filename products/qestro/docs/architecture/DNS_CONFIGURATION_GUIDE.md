# qestro DNS Configuration Guide

## **DNS Setup for qestro.io**

### **Quick Answer: Use CNAME Record (Recommended)**

```
Type: CNAME
Name: @ (root domain)
Target: questro-marketing.pages.dev
TTL: 300 (or automatic)
Proxy: Enabled (orange cloud in Cloudflare)
```

---

## **DNS Record Options Explained**

### **Option 1: CNAME Record (Recommended)**

#### **Configuration**
```
Type: CNAME
Name: @ (or qestro.io for some DNS providers)
Target: questro-marketing.pages.dev
TTL: 300 (or provider default)
```

#### **Why CNAME is Better**
- **Cloudflare Native**: Designed specifically for Cloudflare Pages
- **SSL Automatic**: Free SSL certificate included
- **Load Balancing**: Multiple IP addresses for redundancy
- **Zero Downtime**: IP changes handled automatically
- **Performance**: Cloudflare's global CDN

#### **Current Cloudflare Pages IPs**
```
questro-marketing.pages.dev resolves to:
- 172.66.44.78
- 172.66.47.178
```

### **Option 2: A Record (Alternative)**

#### **Configuration**
```
Type: A
Name: @ (root domain)
Target: 172.66.44.78
TTL: 300
```

#### **When to Use A Record**
- **Root Domain Limitation**: Some DNS providers don't support CNAME on root domains
- **Specific Requirements**: Custom SSL or direct IP control needed
- **Non-Cloudflare DNS**: Using different DNS provider

#### **Multiple A Records (Load Balancing)**
```
Type: A
Name: @
Target: 172.66.44.78
TTL: 300

Type: A
Name: @
Target: 172.66.47.178
TTL: 300
```

---

## **Step-by-Step DNS Configuration**

### **If Using Cloudflare DNS**

1. **Login to Cloudflare Dashboard**
   - Go to: https://dash.cloudflare.com
   - Select your qestro.io domain

2. **Add DNS Record**
   ```
   - Click "Add record"
   - Type: CNAME
   - Name: @ (leave empty for root domain)
   - Target: questro-marketing.pages.dev
   - Proxy status: Proxied (orange cloud)
   - TTL: Auto
   - Click "Save"
   ```

3. **Verify in Cloudflare Pages**
   ```
   - Go to Pages → questro-marketing project
   - Click "Custom domains"
   - Add qestro.io
   - Wait for SSL certificate (1-5 minutes)
   ```

### **If Using Other DNS Providers**

#### **GoDaddy**
1. Login to GoDaddy DNS Management
2. Add CNAME record:
   ```
   Type: CNAME
   Name: @
   Value: questro-marketing.pages.dev
   TTL: 1 Hour
   ```

#### **Namecheap**
1. Login to Namecheap Dashboard
2. Go to Domain → Advanced DNS
3. Add CNAME record:
   ```
   Type: CNAME Record
   Host: @
   Value: questro-marketing.pages.dev
   TTL: 20 Minutes
   ```

#### **Google Domains**
1. Login to Google Domains
2. Go to DNS section
3. Add Custom record:
   ```
   Host name: @ (blank)
   Type: CNAME
   TTL: 1 Hour
   Data: questro-marketing.pages.dev
   ```

---

## **Special Cases and Troubleshooting**

### **Root Domain CNAME Limitation**

Some DNS providers (like Route 53) have special handling for root domains:

#### **AWS Route 53 Solution**
```
# Use Alias Record instead of CNAME
Type: A - Alias
Name: @ (root domain)
Alias Target: questro-marketing.pages.dev
```

#### **Workaround for CNAME-Limited Providers**
If CNAME on root domain isn't supported:

1. **Use www subdomain**:
   ```
   Type: CNAME
   Name: www
   Target: questro-marketing.pages.dev
   ```

2. **Redirect root to www**:
   ```
   Type: URL Redirect
   Name: @
   Target: https://www.qestro.io
   ```

### **Verification Commands**

#### **Check DNS Propagation**
```bash
# Check CNAME record
dig qestro.io CNAME

# Check A records
dig qestro.io A

# Detailed DNS lookup
nslookup qestro.io
```

#### **Test Website Access**
```bash
# Test HTTP status
curl -I https://qestro.io

# Test full page load
curl -s https://qestro.io | head -20

# Test with specific headers
curl -H "Host: qestro.io" https://questro-marketing.pages.dev
```

---

## **SSL Certificate Setup**

### **Automatic SSL (Cloudflare)**
```
- SSL Certificate: Automatic
- Encryption Mode: Full (recommended)
- HSTS: Enable after testing
```

### **Manual SSL (if needed)**
```
Certificate Type: Let's Encrypt (free)
Validation: DNS CNAME or HTTP file upload
Renewal: Automatic every 90 days
```

---

## **DNS Timeline**

### **Expected Timing**
- **DNS Propagation**: 5 minutes - 48 hours (usually 5-30 minutes)
- **SSL Certificate**: 1-10 minutes after DNS propagation
- **Full Functionality**: Within 1 hour in most cases

### **Monitoring Progress**
```bash
# Monitor DNS changes
watch -n 30 dig qestro.io

# Monitor SSL status
curl -I https://qestro.io 2>&1 | grep -i ssl
```

---

## **Advanced Configuration**

### **Multiple Subdomains**
```
# Platform subdomain
Type: CNAME
Name: platform
Target: questro-frontend.pages.dev

# API subdomain
Type: CNAME
Name: api
Target: your-api-backend.com

# Docs subdomain
Type: CNAME
Name: docs
Target: questro-marketing.pages.dev/docs
```

### **GeoDNS Configuration**
```
# Route to nearest Cloudflare data center
Type: CNAME
Name: @
Target: questro-marketing.pages.dev
# Cloudflare automatically handles geo-routing
```

### **Health Checks**
```
# Monitor uptime
Type: CNAME
Name: @
Target: questro-marketing.pages.dev
# Add monitoring: Pingdom, UptimeRobot, etc.
```

---

## **Quick Reference Commands**

### **Deployment Commands**
```bash
# Deploy marketing site
./scripts/deploy-qestro-io.sh

# Check deployment status
npx wrangler pages deployment list --project-name questro-marketing

# Force DNS refresh (after changes)
sudo dscacheutil -flushcache  # macOS
# OR
ipconfig /flushdns           # Windows
```

### **Testing Commands**
```bash
# Test from different locations
curl -H "CF-IPCountry: US" https://qestro.io
curl -H "CF-IPCountry: EU" https://qestro.io

# Performance test
curl -w "@curl-format.txt" -o /dev/null -s https://qestro.io
```

---

## **Troubleshooting Checklist**

### **DNS Issues**
- [ ] Record type correct (CNAME vs A)
- [ ] Target domain spelled correctly
- [ ] TTL set appropriately
- [ ] Proxy status correct (if using Cloudflare)
- [ ] DNS propagated globally

### **SSL Issues**
- [ ] Certificate issued
- [ ] Certificate not expired
- [ ] Domain validated correctly
- [ ] Mixed content avoided (HTTPS only)

### **Website Issues**
- [ ] Correct Cloudflare Pages project
- [ ] Deployment successful
- [ ] Custom domain added in dashboard
- [ ] No conflicting DNS records

---

## **Contact Support**

### **Cloudflare Support**
- Dashboard: https://dash.cloudflare.com/support
- Community: https://community.cloudflare.com
- Status: https://www.cloudflarestatus.com

### **DNS Provider Support**
- Refer to your specific DNS provider's documentation
- Most providers offer 24/7 chat or ticket support

---

**Last Updated: October 20, 2024**
**DNS Records Verified: questro-marketing.pages.dev → 172.66.44.78, 172.66.47.178**