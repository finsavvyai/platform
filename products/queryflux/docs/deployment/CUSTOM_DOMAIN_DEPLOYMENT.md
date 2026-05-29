# QueryFlux Custom Domain Deployment Guide
## 🌐 Deploy to queryflux.ai

### Prerequisites
- Cloudflare account with queryflux.ai domain configured
- Wrangler CLI installed and authenticated
- Node.js 18+

### Step 1: Setup Environment
```bash
# Install dependencies
npm install

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Copy environment configuration
cp .env.cloudflare .env
```

### Step 2: Configure Environment Variables
Edit `.env` file with your actual values:
```bash
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# Supabase (optional - for external database)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# AI Configuration
VITE_OLLAMA_URL=https://api.queryflux.ai/ollama
VITE_OPENAI_API_KEY=your-openai-api-key

# Custom Domain URLs
VITE_APP_URL=https://queryflux.ai
VITE_API_URL=https://api.queryflux.ai
```

### Step 3: Deploy Frontend to Cloudflare Pages
```bash
# Build the application
npm run build

# Deploy to Cloudflare Pages with custom domain
wrangler pages deploy dist --project-name=queryflux --compatibility-date=2024-01-01
```

### Step 4: Configure Custom Domain in Cloudflare Dashboard
1. Go to Cloudflare Dashboard → Pages → queryflux
2. Click "Custom domains"
3. Add domain: `queryflux.ai`
4. Configure DNS records:
   - CNAME: queryflux.ai → queryflux.pages.dev
   - Or A record if using Workers

### Step 5: Deploy Backend API Worker
```bash
# Navigate to worker directory
cd cloudflare-workers

# Deploy API worker
wrangler deploy

# Return to project root
cd ..
```

### Step 6: Setup D1 Database
```bash
# Create D1 database (if not exists)
wrangler d1 create queryflux-db

# Apply database schema
wrangler d1 execute queryflux-db --file=../backend/cloudflare-d1/schema.sql --remote
```

### Step 7: Verify Deployment
```bash
# Run health checks
npm run verify:cloudflare

# Or manually check
curl https://queryflux.ai/health.html
curl https://api.queryflux.ai/health
```

## 🎤 Voice-Enabled Deployment

For voice announcements during deployment:
```bash
# Run automated deployment with voice monitoring
npm run deploy:cloudflare
```

This will announce:
- "Starting QueryFlux deployment to queryflux.ai"
- "Build completed successfully"
- "Frontend deployed to Cloudflare Pages"
- "Backend deployed to Cloudflare Workers"
- "QueryFlux deployment completed successfully at queryflux.ai"

## 🌐 Final URLs

After successful deployment:
- **Main App**: https://queryflux.ai
- **API**: https://api.queryflux.ai
- **Health Check**: https://queryflux.ai/health.html
- **API Health**: https://api.queryflux.ai/health

## 🔧 Custom Worker Routes

Configure custom routes in `wrangler.toml`:
```toml
[[routes]]
pattern = "api.queryflux.ai/*"
zone_name = "queryflux.ai"

[[routes]]
pattern = "queryflux.ai/*"
zone_name = "queryflux.ai"
```

## 📊 Monitoring

- Cloudflare Dashboard: Analytics & Logs
- Health Endpoint: https://queryflux.ai/health.html
- Real-time monitoring with voice alerts

## 🔄 Continuous Deployment

Set up GitHub Actions for automatic deployment:
1. Connect repository to Cloudflare Pages
2. Configure custom domain in Cloudflare
3. Push to main branch triggers deployment

## 🎯 DNS Configuration

Ensure your DNS is configured correctly:
```
Type: CNAME
Name: @ (or queryflux.ai)
Value: queryflux.pages.dev
TTL: Auto
```

For API subdomain:
```
Type: CNAME
Name: api
Value: queryflux-api.your-subdomain.workers.dev
TTL: Auto
```

## 🚨 Troubleshooting

### Custom Domain Not Working
1. Check DNS propagation (can take up to 24 hours)
2. Verify CNAME records in Cloudflare DNS
3. Ensure SSL certificate is issued
4. Check Cloudflare Pages custom domain configuration

### API Not Accessible
1. Verify Worker deployment
2. Check custom routes in wrangler.toml
3. Ensure proper CORS configuration
4. Check Cloudflare Workers logs

### Voice Announcements Not Working
1. Ensure running on macOS for voice synthesis
2. Check system volume and voice settings
3. Run deployment script manually to see console output

## 🎉 Success!

When deployment is successful, you'll hear:
"QueryFlux deployment completed successfully at queryflux.ai"

Your AI-powered database management platform will be live at:
**https://queryflux.ai** 🚀