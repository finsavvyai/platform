# 🌐 Questro Domain Configuration Guide

## 📋 Current Status
- ✅ **Frontend Deployed**: https://questro-frontend.pages.dev
- ✅ **Backend Deployed**: https://questro-backend.onrender.com
- ✅ **Both Domains on Cloudflare**: qestro.app, qestro.io

## 🎯 Domain Configuration Steps

### **Method 1: Cloudflare Pages Custom Domains (Recommended)**

1. **Access Cloudflare Dashboard**
   - Go to: https://dash.cloudflare.com/d2fe608a92dc9faa2ce5b0fd2cad5eb7/pages/view/questro-frontend
   - Click on **"Custom domains"** tab

2. **Add qestro.app**
   - Click **"Set up a custom domain"**
   - Enter: `qestro.app`
   - Click **"Continue"**
   - Cloudflare will automatically configure DNS

3. **Add qestro.io**
   - Click **"Set up a custom domain"**
   - Enter: `qestro.io`
   - Click **"Continue"**
   - Cloudflare will automatically configure DNS

### **Method 2: Manual DNS Configuration**

If automatic setup doesn't work, configure manually:

#### **For qestro.app:**
1. Go to DNS settings for qestro.app
2. Add these records:
   - **CNAME**: `@` → `questro-frontend.pages.dev`
   - **CNAME**: `www` → `questro-frontend.pages.dev`

#### **For qestro.io:**
1. Go to DNS settings for qestro.io
2. Add these records:
   - **CNAME**: `@` → `questro-frontend.pages.dev`
   - **CNAME**: `www` → `questro-frontend.pages.dev`

## 🔍 Testing After Configuration

Once domains are configured, test with these commands:

```bash
# Test main domain
curl -I https://qestro.app

# Test marketing domain
curl -I https://qestro.io

# Test API connectivity
curl https://qestro.app/health
```

## 🎯 Expected Results

After successful configuration:
- **qestro.app** → Questro main application
- **qestro.io** → Questro marketing site
- **API Integration** → Frontend connects to backend at `https://questro-backend.onrender.com`

## ⚡ Performance Benefits

- **Global CDN**: Content served from 200+ edge locations
- **Automatic HTTPS**: SSL certificates included
- **DDoS Protection**: Built-in security
- **Fast Load Times**: Optimized caching and compression

## 🚨 Troubleshooting

If domains don't work immediately:
1. **Wait 5-10 minutes** for DNS propagation
2. **Clear browser cache**
3. **Check DNS settings** are correct
4. **Verify SSL certificates** are generated

## ✅ Success Checklist

- [ ] qestro.app loads Questro application
- [ ] qestro.io loads Questro marketing site
- [ ] Both domains show HTTPS (green padlock)
- [ ] API calls work to backend
- [ ] All pages load without errors