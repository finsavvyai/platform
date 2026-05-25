# ⚙️ Cloudflare Pages Configuration Guide

## ✅ Current Status

**Deployment**: ✅ Successfully deployed
- **Project**: `upm-website`
- **Cloudflare Pages URL**: `https://upm-website.pages.dev`
- **Files**: 5 HTML pages deployed

---

## 🌐 Important: Domain Configuration

### If you're visiting `upmplus.dev` and seeing the old site:

**That's because `upmplus.dev` is still pointing to your old backend server!**

You have two options:

### Option 1: Visit the Cloudflare Pages URL
Visit: **https://upm-website.pages.dev** to see your new modern website!

### Option 2: Connect Custom Domain (Recommended)

1. **Go to Cloudflare Dashboard**:
   - Visit: https://dash.cloudflare.com
   - Navigate to: **Pages** > **upm-website**

2. **Add Custom Domain**:
   - Click **Custom Domains** tab
   - Click **Set up a custom domain**
   - Enter: `upmplus.dev`
   - Click **Continue**

3. **DNS Configuration**:
   - If your domain is managed by Cloudflare: DNS is automatically configured
   - If your domain is elsewhere: Follow the DNS instructions shown

4. **Wait for Propagation**:
   - DNS changes take 5-30 minutes to propagate
   - Once complete, `upmplus.dev` will show your new website!

---

## 🔧 Environment Variables

Set these in Cloudflare Dashboard:

1. Go to: **Pages** > **upm-website** > **Settings** > **Environment Variables**
2. Add:
   - **Variable**: `BACKEND_URL`
   - **Value**: `http://34.29.39.106:8040`
   - **Environment**: Production

This allows API requests (`/api/*`) to be proxied to your FastAPI backend.

---

## 📋 Wrangler Commands

### View Project Info
```bash
wrangler pages project list
```

### View Deployments
```bash
wrangler pages deployment list --project-name=upm-website
```

### Redeploy
```bash
cd cloudflare-pages
wrangler pages deploy public --project-name=upm-website
```

### Set Secrets (Environment Variables)
```bash
# Note: Secrets must be set via Dashboard or wrangler pages secret
wrangler pages secret put BACKEND_URL --project-name=upm-website
# Then enter: http://34.29.39.106:8040
```

---

## 🎯 Quick Checklist

- [x] Website deployed to Cloudflare Pages
- [x] Files uploaded successfully
- [ ] Custom domain connected (upmplus.dev)
- [ ] Environment variables set (BACKEND_URL)
- [ ] Tested website at Cloudflare Pages URL

---

## 🐛 Troubleshooting

### Still seeing old website at upmplus.dev?

1. **Check DNS**: `upmplus.dev` might still point to old IP
2. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
3. **Visit Cloudflare Pages URL**: https://upm-website.pages.dev
4. **Wait for DNS propagation**: Can take up to 30 minutes

### API requests not working?

1. Set `BACKEND_URL` environment variable in Cloudflare Dashboard
2. Verify backend is accessible: `curl http://34.29.39.106:8040/health`
3. Check Functions are deployed: `functions/api/[[path]].js`

---

## 📞 Next Steps

1. ✅ **Visit**: https://upm-website.pages.dev (to see new site)
2. ✅ **Connect domain**: Add upmplus.dev in Cloudflare Dashboard
3. ✅ **Set variables**: Add BACKEND_URL in environment variables
4. ✅ **Test**: Verify all pages work correctly

---

**Your website is deployed! Just need to connect the custom domain! 🚀**
