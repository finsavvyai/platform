# 🔒 UPM Platform HTTPS Setup (Simple Approach)

## Current Status
- ✅ **HTTP**: http://upmplus.dev (working)
- ❌ **HTTPS**: https://upmplus.dev (not working - no load balancer)

## The Issue
The SSL certificate exists but there's no load balancer to handle HTTPS traffic. Your current setup uses a Kubernetes LoadBalancer service which only handles HTTP.

## Solution Options

### **Option 1: Use Cloudflare (Recommended - Free & Easy)**

1. **Sign up for Cloudflare** (free account)
2. **Add your domain** upmplus.dev to Cloudflare
3. **Change nameservers** in your domain registrar to Cloudflare's
4. **Enable SSL/TLS** in Cloudflare dashboard
5. **Set up proxy** to point to your current IP: 34.29.39.106

**Benefits:**
- ✅ Free SSL certificate
- ✅ Automatic HTTPS redirect
- ✅ CDN for faster access
- ✅ DDoS protection
- ✅ Easy setup

### **Option 2: Use Let's Encrypt with Certbot**

```bash
# Install certbot
brew install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d upmplus.dev -d www.upmplus.dev

# This will give you certificates in /etc/letsencrypt/live/upmplus.dev/
```

### **Option 3: Use Google Cloud Load Balancer (Complex)**

This requires setting up:
- Global static IP
- Backend service
- Health checks
- Instance groups
- URL maps
- HTTPS proxy
- Forwarding rules

## **Recommended: Cloudflare Setup**

### **Step 1: Add Domain to Cloudflare**
1. Go to https://dash.cloudflare.com/
2. Click "Add a Site"
3. Enter: upmplus.dev
4. Choose "Free" plan

### **Step 2: Update DNS Records**
In Cloudflare DNS settings, add:
```
Type: A
Name: @
Value: 34.29.39.106
Proxy: ✅ (Orange cloud)

Type: A
Name: www
Value: 34.29.39.106
Proxy: ✅ (Orange cloud)

Type: A
Name: api
Value: 34.29.39.106
Proxy: ✅ (Orange cloud)
```

### **Step 3: SSL/TLS Settings**
1. Go to "SSL/TLS" → "Overview"
2. Set encryption mode to "Full (strict)"
3. Enable "Always Use HTTPS"

### **Step 4: Update Your Domain Registrar**
Change nameservers to Cloudflare's:
```
ns1.cloudflare.com
ns2.cloudflare.com
```

## **Alternative: Quick HTTPS with ngrok**

If you want HTTPS immediately for testing:

```bash
# Start ngrok with your domain
ngrok http 34.29.39.106 --hostname upmplus.dev
```

## **Update UPM Configuration for HTTPS**

Once HTTPS is working, update your UPM configurations:

```yaml
# upm.yml
upm_platform:
  base_url: "https://upmplus.dev"  # HTTPS!
  api_endpoint: "https://upmplus.dev"  # HTTPS!
  api_key: "your-api-key-here"
  timeout: 30000
  retry_attempts: 3
  ssl_verify: true  # Enable SSL verification
```

## **Test HTTPS**

```bash
# Test HTTPS when ready
curl https://upmplus.dev/health
curl https://upmplus.dev/
```

## **Benefits of HTTPS**

1. **Security**: Encrypted communication
2. **Trust**: Users trust HTTPS sites
3. **SEO**: Better search engine ranking
4. **Modern**: Required for many web APIs
5. **Professional**: Looks more professional

## **Next Steps**

1. **Choose your HTTPS solution** (Cloudflare recommended)
2. **Set up HTTPS** using your chosen method
3. **Update UPM configurations** to use HTTPS
4. **Test the HTTPS endpoints**
5. **Update all project configurations** to use HTTPS

Your UPM platform will then be fully secure with HTTPS! 🔒


