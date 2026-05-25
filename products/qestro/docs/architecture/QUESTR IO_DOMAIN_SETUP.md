# Qestro.io Domain Setup Instructions

## Current Status ✅
- **qestro.app**: ✅ Live and serving the full Questro platform
- **qestro.io**: ❌ Returns 522 error (needs configuration to serve the same platform)

## Platform Architecture
Both domains should serve the **identical Questro platform**:
- **qestro.app** → Full Questro platform (test automation, AI features, recording studio, etc.)
- **qestro.io** → Full Questro platform (same features, same content, identical experience)

## Steps to Configure qestro.io

### Option 1: Cloudflare Dashboard (Recommended)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Pages**
3. Select the **questro-frontend** project
4. Go to **Custom domains** tab
5. Click **Set up a custom domain**
6. Enter: `qestro.io`
7. Follow the DNS configuration steps

### Option 2: DNS Configuration
1. Ensure `qestro.io` is using Cloudflare nameservers
2. Add DNS record:
   - Type: `CNAME`
   - Name: `@` (root)
   - Target: `questro-frontend.pages.dev`
   - Proxy: Enabled (orange cloud)

### Option 3: WWW Subdomain Setup
Once qestro.io is working, also configure:
- **www.qestro.io** → CNAME to `questro-frontend.pages.dev`

## Verification
After configuration, test with:
```bash
curl -I https://qestro.io
# Should return 200 status

curl -s https://qestro.io | grep -o "🎉\|Questro"
# Should show React content
```

## Current Working Setup
The following is already configured and working:
- **Frontend Build**: ✅ React app properly bundled
- **Cloudflare Pages**: ✅ Deployed to questro-frontend project
- **qestro.app**: ✅ Live and serving React content
- **Build Process**: ✅ Simplified Vite configuration working

## Extension Publisher
✅ Created script: `/Users/shaharsolomon/dev/projects/qestro/scripts/publish-extension.sh`
- Auto-bumps version numbers
- Builds and packages extensions
- Saves to `/Users/shaharsolomon/projects/extensions/`
- Creates publishing instructions

Usage:
```bash
./scripts/publish-extension.sh
```