# 🌐 Cloudflare Pages Deployment Guide

## Quick Deploy

### Option 1: Simple Deployment (Recommended)

```bash
./scripts/deploy-cloudflare-simple.sh
```

This will:
1. Copy website templates to Cloudflare Pages format
2. Deploy to Cloudflare Pages
3. Give you a URL like `https://upm-website.pages.dev`

### Option 2: Full Deployment

```bash
./scripts/deploy-cloudflare-pages.sh
```

---

## Prerequisites

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Authenticate with Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Verify authentication**:
   ```bash
   wrangler whoami
   ```

---

## Manual Deployment Steps

### Step 1: Prepare Files

```bash
# Create public directory
mkdir -p cloudflare-pages/public

# Copy website files
cp templates/website/*.html cloudflare-pages/public/
```

### Step 2: Deploy

```bash
cd cloudflare-pages
wrangler pages deploy public --project-name=upm-website
```

### Step 3: Connect Custom Domain

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** > **upm-website**
3. Go to **Custom Domains**
4. Add **upmplus.dev**
5. Update DNS records as instructed

---

## Configuration

### Environment Variables

Set in Cloudflare Pages dashboard:

- `BACKEND_URL`: Your FastAPI backend URL (e.g., `http://34.29.39.106:8040`)
- `ENVIRONMENT`: `production` or `staging`

### Custom Domain Setup

1. **Add Domain in Cloudflare Pages**:
   - Project Settings > Custom Domains
   - Add: `upmplus.dev`

2. **DNS Configuration** (if domain is in Cloudflare):
   - Automatically configured by Cloudflare Pages

3. **DNS Configuration** (if domain is elsewhere):
   ```
   Type: CNAME
   Name: @
   Value: upm-website.pages.dev
   
   Type: CNAME
   Name: www
   Value: upm-website.pages.dev
   ```

---

## API Proxying

The website will automatically proxy API requests to your backend:

- `/api/*` → Proxied to backend
- `/health` → Proxied to backend
- `/ready` → Proxied to backend
- All other routes → Served as static HTML

---

## Benefits of Cloudflare Pages

1. **Global CDN**: Fast loading worldwide
2. **Free SSL**: Automatic HTTPS
3. **DDoS Protection**: Built-in protection
4. **Edge Caching**: Fast content delivery
5. **Custom Domains**: Easy domain setup
6. **Git Integration**: Auto-deploy on push

---

## Deployment URLs

After deployment, you'll get:

- **Pages URL**: `https://upm-website.pages.dev`
- **Custom Domain**: `https://upmplus.dev` (after setup)

---

## Troubleshooting

### Deployment Fails

1. Check authentication: `wrangler whoami`
2. Verify files exist: `ls cloudflare-pages/public/`
3. Check Wrangler version: `wrangler --version`

### Domain Not Working

1. Verify DNS records
2. Check Cloudflare Pages custom domain settings
3. Wait for DNS propagation (up to 24 hours)

### API Requests Failing

1. Check `BACKEND_URL` environment variable
2. Verify backend is accessible
3. Check CORS settings on backend

---

## Continuous Deployment

### GitHub Integration

1. Connect GitHub repo in Cloudflare Pages
2. Set build command: (none needed for static)
3. Set output directory: `public`
4. Auto-deploy on every push!

---

**Ready to deploy! Run `./scripts/deploy-cloudflare-simple.sh` 🚀**
