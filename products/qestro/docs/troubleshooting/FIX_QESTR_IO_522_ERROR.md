# Fix qestro.io 522 Connection Timeout Error

## **Problem Identified:**
- **Error**: HTTP 522 (Connection timeout)
- **Cause**: qestro.io DNS points to Cloudflare but no custom domain configured
- **Solution**: Add qestro.io as custom domain to questro-marketing project

## **Root Cause Analysis:**

### **Current State:**
```
qestro.io DNS → Cloudflare Proxy IPs (172.67.136.79, 104.21.94.131)
↓
Cloudflare tries to connect to origin server
↓
❌ No origin server configured → 522 Error
```

### **What Should Happen:**
```
qestro.io DNS → Cloudflare Proxy
↓
Cloudflare connects to questro-marketing.pages.dev
↓
✅ Marketing site loads correctly
```

---

## **Solution: Cloudflare Dashboard Configuration**

### **Step 1: Access Cloudflare Dashboard**
1. Go to: https://dash.cloudflare.com
2. Log in with your Cloudflare account
3. Select the `qestro.io` domain from your domains list

### **Step 2: Go to Pages Projects**
1. In the left sidebar, click **"Pages"**
2. Find and select the **"questro-marketing"** project
3. Click on the project name to enter project settings

### **Step 3: Add Custom Domain**
1. In the project dashboard, click the **"Custom domains"** tab
2. Click **"Set up a custom domain"**
3. Enter: `qestro.io`
4. Click **"Add domain"**

### **Step 4: Verify DNS Configuration**
Cloudflare will automatically configure the DNS records. You should see:
```
Type: CNAME
Name: @
Target: questro-marketing.pages.dev
Proxy: Enabled (orange cloud)
```

### **Step 5: Wait for SSL Certificate**
- Cloudflare will automatically provision SSL certificate
- This usually takes 1-5 minutes
- You'll see a green checkmark when ready

---

## **Alternative Solution: DNS Configuration Fix**

If you prefer to fix via DNS instead of Cloudflare Pages:

### **Option A: Direct CNAME to Pages**
```
Type: CNAME
Name: @
Target: questro-marketing.pages.dev
Proxy: Disabled (gray cloud)
```

### **Option B: Point to qestro.app (Temporary)**
```
Type: CNAME
Name: @
Target: qestro.app
Proxy: Enabled (orange cloud)
```

---

## **Verification Steps**

### **1. Check DNS Resolution**
```bash
# After configuration, check DNS
dig qestro.io CNAME

# Should return:
# qestro.io. 300 IN CNAME questro-marketing.pages.dev.
```

### **2. Test Website Access**
```bash
# Test HTTP status
curl -I https://qestro.io

# Should return 200 OK
# HTTP/2 200
# date: Mon, 20 Oct 2025 18:45:00 GMT
```

### **3. Verify Content**
```bash
# Check if marketing content loads
curl -s https://qestro.io | grep -o "qestro.*AI.*Test" | head -1

# Should return: qestro - AI-Powered Test Automation Platform
```

---

## **Timeline Expectations**

### **DNS Propagation**
- **Global**: 5-30 minutes (usually under 10 minutes)
- **Local**: May need to clear DNS cache
  ```bash
  # macOS
  sudo dscacheutil -flushcache

  # Windows
  ipconfig /flushdns
  ```

### **SSL Certificate**
- **Provisioning**: 1-5 minutes after DNS propagation
- **Validation**: Automatic through Cloudflare

### **Full Functionality**
- **Expected**: Within 30 minutes total
- **Maximum**: Up to 24 hours (rare cases)

---

## **Troubleshooting Checklist**

### **If Still Getting 522 Error:**
- [ ] Custom domain added in Cloudflare Pages dashboard
- [ ] DNS records show CNAME to questro-marketing.pages.dev
- [ ] SSL certificate is issued and active
- [ ] Sufficient time passed for DNS propagation (15+ minutes)

### **If Getting 525 SSL Error:**
- [ ] SSL certificate has been issued
- [ ] SSL mode set to "Full" or "Full (strict)"
- [ ] No mixed content (HTTP resources on HTTPS page)

### **If Getting 404 Error:**
- [ ] Deployment exists in questro-marketing project
- [ ] Custom domain points to correct project
- [ ] No conflicting DNS records

---

## **Current Working URLs**

### **Marketing Site Access:**
- **Direct Pages URL**: https://questro-marketing.pages.dev ✅
- **Target Domain**: https://qestro.io (needs configuration)

### **Platform Access:**
- **Live Platform**: https://qestro.app ✅
- **Direct Pages URL**: https://questro-frontend.pages.dev ✅

---

## **Quick Fix Commands**

### **Force DNS Cache Clear:**
```bash
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder

# Linux
sudo systemctl restart systemd-resolved

# Windows
ipconfig /flushdns
```

### **Test Different Locations:**
```bash
# Test from different geographic locations
curl -H "CF-IPCountry: US" https://qestro.io
curl -H "CF-IPCountry: EU" https://qestro.io
curl -H "CF-IPCountry: ASIA" https://qestro.io
```

---

## **Emergency Fallback**

If qestro.io configuration is taking too long, you can:

### **Temporary Redirect:**
```
# Add URL redirect in Cloudflare
Source URL: qestro.io/*
Target URL: https://questro-marketing.pages.dev/$1
Status Code: 301 (Permanent Redirect)
```

### **Subdomain Alternative:**
```
# Use www.qestro.io temporarily
Type: CNAME
Name: www
Target: questro-marketing.pages.dev
```

---

## **Monitoring Progress**

### **Command Line Monitoring:**
```bash
# Watch DNS changes
watch -n 30 dig qestro.io

# Monitor HTTP status
watch -n 60 "curl -I https://qestro.io 2>/dev/null | head -1"
```

### **Browser Testing:**
1. Open browser in incognito mode
2. Go to https://qestro.io
3. Check browser developer tools for any errors
4. Test on different devices/networks

---

## **Expected Final Result**

After successful configuration:
```
https://qestro.io
├── Loads marketing landing page
├── Shows "qestro - AI-Powered Test Automation Platform"
├── Responsive design works on mobile
├── Sign-up forms functional
├── Links to qestro.app for platform access
└── HTTPS with valid SSL certificate
```

---

**Status: Problem identified, solution provided**
**Next Action: Configure custom domain in Cloudflare Dashboard**
**Estimated Time: 10-30 minutes for full resolution**