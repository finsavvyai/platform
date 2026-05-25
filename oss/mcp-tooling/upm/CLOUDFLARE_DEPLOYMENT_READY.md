# ✅ Cloudflare Pages Deployment - Ready!

## 🚀 Quick Deploy (3 Steps)

### Step 1: Install Wrangler (if not installed)
```bash
npm install -g wrangler
```

### Step 2: Authenticate with Cloudflare
```bash
wrangler login
```

### Step 3: Deploy
```bash
./scripts/deploy-to-cloudflare.sh
```

**That's it!** Your website will be live at `https://upm-website.pages.dev`

---

## 📋 What's Been Prepared

### ✅ Files Ready
- `cloudflare-pages/public/index.html` (30KB) - Landing page
- `cloudflare-pages/public/pricing.html` (6.4KB) - Pricing page
- `cloudflare-pages/public/docs.html` (8.6KB) - Documentation
- `cloudflare-pages/public/about.html` (5.3KB) - About page
- `cloudflare-pages/public/blog.html` (4.8KB) - Blog page
- `cloudflare-pages/public/_redirects` - SPA routing
- `cloudflare-pages/public/_headers` - Security headers

### ✅ Functions Created
- `functions/api/[[path]].js` - API request proxying
- `functions/health.js` - Health check proxying
- `functions/_middleware.js` - Request middleware

### ✅ Configuration
- `wrangler.toml` - Cloudflare Pages configuration
- `package.json` - Deployment scripts

---

## 🌐 After Deployment

### 1. Get Your Pages URL
After deployment, you'll get:
- **Pages URL**: `https://upm-website.pages.dev`

### 2. Connect Custom Domain (upmplus.dev)

**Option A: Via Cloudflare Dashboard** (Recommended)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** > **upm-website**
3. Click **Custom Domains**
4. Add **upmplus.dev**
5. Follow DNS setup instructions

**Option B: Via DNS Records**
If your domain is managed elsewhere:
```
Type: CNAME
Name: @
Value: upm-website.pages.dev

Type: CNAME
Name: www
Value: upm-website.pages.dev
```

### 3. Set Environment Variables
In Cloudflare Pages dashboard:
- `BACKEND_URL`: `http://34.29.39.106:8040` (your FastAPI backend)

---

## 🔄 How It Works

### Website Pages
- Served directly from Cloudflare Pages (static HTML)
- Fast global CDN delivery
- Automatic HTTPS

### API Requests
- `/api/*` requests are proxied to your FastAPI backend
- `/health` and `/ready` are also proxied
- Handled by Cloudflare Pages Functions

### Benefits
- ✅ **Global CDN**: Fast loading worldwide
- ✅ **Free SSL**: Automatic HTTPS
- ✅ **DDoS Protection**: Built-in
- ✅ **Edge Caching**: Fast content delivery
- ✅ **Custom Domain**: Easy setup
- ✅ **Auto-Deploy**: Git integration available

---

## 📊 Deployment Status

**Files Prepared**: ✅
- 5 HTML pages ready
- Security headers configured
- API proxying functions ready

**Ready to Deploy**: ✅
- Just run: `./scripts/deploy-to-cloudflare.sh`

---

## 🧪 Test Deployment

After deployment, test:

```bash
# Test landing page
curl https://upm-website.pages.dev/

# Test API proxying (if backend is accessible)
curl https://upm-website.pages.dev/api/v1/health

# Test health endpoint
curl https://upm-website.pages.dev/health
```

---

## 🔧 Troubleshooting

### Deployment Fails
1. Check authentication: `wrangler whoami`
2. Verify files: `ls cloudflare-pages/public/`
3. Check Wrangler version: `wrangler --version` (should be 3.x)

### Domain Not Working
1. Wait for DNS propagation (5-30 minutes)
2. Check Cloudflare Pages custom domain settings
3. Verify DNS records

### API Requests Failing
1. Check `BACKEND_URL` environment variable in Cloudflare dashboard
2. Verify backend is accessible from internet
3. Check CORS settings on backend

---

## 🎯 Next Steps

1. ✅ **Deploy**: Run `./scripts/deploy-to-cloudflare.sh`
2. ✅ **Connect Domain**: Add upmplus.dev in Cloudflare dashboard
3. ✅ **Set Environment**: Add BACKEND_URL variable
4. ✅ **Test**: Visit https://upm-website.pages.dev
5. ✅ **Verify**: Check all pages work correctly

---

**Ready to deploy! Run `./scripts/deploy-to-cloudflare.sh` 🚀**
