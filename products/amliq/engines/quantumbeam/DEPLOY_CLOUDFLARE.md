# 🚀 Deploy QuantumBeam to Cloudflare

Complete guide for deploying QuantumBeam to Cloudflare's global network using Workers, Pages, D1, and R2.

---

## 📋 Prerequisites

### Required Tools
```bash
# Install Wrangler CLI
npm install -g wrangler

# Install Node.js 18+ (if not installed)
# https://nodejs.org/

# Verify installations
wrangler --version
node --version
npm --version
```

### Cloudflare Account
- Active Cloudflare account
- Workers/Pages subscription (Free tier works!)
- Domain added to Cloudflare (optional but recommended)

---

## ⚡ Quick Deploy (5 Minutes)

### Option 1: Automated Script (Recommended)

```bash
# Run the deployment script
./cloudflare/deploy-cloudflare.sh
```

The script will:
1. Check prerequisites
2. Create D1 database
3. Set up KV namespaces
4. Create R2 buckets
5. Deploy API Worker
6. Build and deploy website to Pages

### Option 2: Manual Deployment

Follow the detailed steps below for more control.

---

## 🔧 Manual Deployment Steps

### Step 1: Authenticate with Cloudflare

```bash
# Login to Cloudflare
wrangler login

# Verify authentication
wrangler whoami
```

Expected output:
```
Getting User settings...
👋 You are logged in with an OAuth Token, associated with the email <your-email>!

┌─────────────────────────────┬──────────────────────────────────┐
│ Account Name                │ Account ID                        │
├─────────────────────────────┼──────────────────────────────────┤
│ Your Account                │ d2fe608a92dc9faa2ce5b0fd2cad5eb7 │
└─────────────────────────────┴──────────────────────────────────┘
```

### Step 2: Create D1 Database

```bash
# Create production database
wrangler d1 create quantumbeam-db

# Note the database_id from the output
# Update wrangler.toml with the ID

# Initialize database schema
wrangler d1 execute quantumbeam-db --file=database/schemas/001_initial_schema.sql
```

### Step 3: Create KV Namespaces

```bash
# Create KV namespace for caching
wrangler kv:namespace create "quantumbeam-cache"
wrangler kv:namespace create "quantumbeam-cache" --preview

# Create KV namespace for configuration
wrangler kv:namespace create "quantumbeam-config"
wrangler kv:namespace create "quantumbeam-config" --preview

# Note the IDs and update wrangler.toml
```

### Step 4: Create R2 Buckets

```bash
# Create R2 bucket for file storage
wrangler r2 bucket create quantumbeam-files

# Verify bucket creation
wrangler r2 bucket list
```

### Step 5: Configure Secrets

```bash
# Generate secrets
openssl rand -hex 32  # For JWT_SECRET (64 chars)
openssl rand -hex 16  # For API_KEY_ENCRYPTION_KEY (32 chars)

# Set secrets
echo "your-jwt-secret-here" | wrangler secret put JWT_SECRET
echo "your-api-key-here" | wrangler secret put API_KEY_ENCRYPTION_KEY

# Optional: Set quantum backend tokens
echo "your-ibm-token" | wrangler secret put IBM_QUANTUM_TOKEN
echo "your-openai-key" | wrangler secret put OPENAI_API_KEY
```

### Step 6: Deploy API Worker

```bash
# Deploy the worker
wrangler deploy cloudflare/worker.js

# Test deployment
curl https://quantumbeam.workers.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-09T...",
  "environment": "production",
  "version": "1.0.0"
}
```

### Step 7: Deploy Website to Pages

```bash
# Navigate to website directory
cd web/marketing

# Install dependencies
npm install

# Build the application
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name=quantumbeam-website

# Or use Cloudflare dashboard:
# 1. Go to Pages > Create a project
# 2. Connect GitHub repository
# 3. Set build command: npm run build
# 4. Set output directory: out
# 5. Deploy
```

---

## 🌐 Custom Domain Setup

### Add Custom Domain to Worker

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers & Pages > quantumbeam
3. Click "Triggers" > "Add Custom Domain"
4. Enter: `api.quantumbeam.io`
5. Click "Add Custom Domain"

DNS will be automatically configured.

### Add Custom Domain to Pages

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages > quantumbeam-website
3. Click "Custom domains" > "Set up a custom domain"
4. Enter: `quantumbeam.io` or `www.quantumbeam.io`
5. Click "Continue"

---

## 📊 Configuration Reference

### Wrangler.toml Configuration

```toml
name = "quantumbeam"
main = "cloudflare/worker.js"
compatibility_date = "2024-01-01"
account_id = "your-account-id"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "quantumbeam-db"
database_id = "your-database-id"

# KV Namespaces
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"

# R2 Storage
[[r2_buckets]]
binding = "FILES"
bucket_name = "quantumbeam-files"

# Analytics
[[analytics_engine_datasets]]
binding = "ANALYTICS"
```

### Environment Variables

Set in Cloudflare Dashboard or via Wrangler:

```bash
# Required
JWT_SECRET=<64-character-string>
API_KEY_ENCRYPTION_KEY=<32-character-string>

# Optional (for quantum features)
IBM_QUANTUM_TOKEN=<your-token>
AWS_BRAKET_ACCESS_KEY=<your-key>
AWS_BRAKET_SECRET_KEY=<your-secret>
OPENAI_API_KEY=<your-key>
```

---

## 🔄 Update/Redeploy

### Update API Worker

```bash
# Make changes to cloudflare/worker.js
# Then redeploy
wrangler deploy cloudflare/worker.js
```

### Update Website

```bash
cd web/marketing
npm run build
npx wrangler pages deploy out --project-name=quantumbeam-website
```

### Rollback Deployment

```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

---

## 📈 Monitoring & Analytics

### View Worker Analytics

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages > quantumbeam
3. Click "Analytics" tab

Metrics available:
- Requests per second
- CPU time
- Success rate
- Errors
- Duration

### View Pages Analytics

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages > quantumbeam-website
3. Click "Analytics" tab

Metrics available:
- Page views
- Unique visitors
- Bandwidth
- Requests by country

### View Logs

```bash
# Tail Worker logs in real-time
wrangler tail

# Tail with filters
wrangler tail --format=pretty --status=error
```

---

## 💰 Cost Estimates

### Workers (API)

| Tier | Requests/month | Cost |
|------|----------------|------|
| Free | 100,000 | $0 |
| Paid | 10M | $5 |
| Paid | 100M | $50 |

CPU time: $0.02 per million CPU milliseconds

### Pages (Website)

| Tier | Builds | Bandwidth | Cost |
|------|--------|-----------|------|
| Free | 500/month | Unlimited | $0 |
| Paid | Unlimited | Unlimited | $20/month |

### D1 Database

| Tier | Reads | Writes | Cost |
|------|-------|--------|------|
| Free | 5M/day | 100k/day | $0 |
| Paid | Billed per read/write | - | $0.001/1M reads |

### R2 Storage

| Metric | Free Tier | Cost (Paid) |
|--------|-----------|-------------|
| Storage | 10 GB | $0.015/GB/month |
| Class A ops | 1M/month | $4.50/million |
| Class B ops | 10M/month | $0.36/million |

**Total Estimated Cost for Small Deployment**: $0-5/month

---

## 🧪 Testing Your Deployment

### Test Health Endpoints

```bash
# Basic health check
curl https://api.quantumbeam.io/health

# Liveness probe
curl https://api.quantumbeam.io/health/live

# Readiness probe
curl https://api.quantumbeam.io/health/ready

# Detailed health
curl https://api.quantumbeam.io/health/detailed
```

### Test Fraud Detection API

```bash
# Analyze a transaction
curl -X POST https://api.quantumbeam.io/api/v1/fraud/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "test_123",
    "amount": 1500.00,
    "user_id": "user_123",
    "merchant_id": "merchant_456"
  }'
```

Expected response:
```json
{
  "transaction_id": "test_123",
  "fraud_score": 0.65,
  "confidence": 0.85,
  "risk_level": "medium",
  "recommendation": "review",
  "processing_time_ms": 45
}
```

### Test Website

```bash
# Check website loads
curl -I https://quantumbeam.io

# Should return 200 OK with HTML
```

### Load Testing

```bash
# Simple load test
for i in {1..100}; do
  curl -s https://api.quantumbeam.io/health > /dev/null &
done
wait

# Using Apache Bench
ab -n 1000 -c 10 https://api.quantumbeam.io/health
```

---

## 🔒 Security Best Practices

### 1. Enable WAF Rules

1. Go to Cloudflare Dashboard > Security > WAF
2. Enable Managed Rules
3. Add custom rules for API protection:
   ```
   (http.request.uri.path contains "/api/" and
    cf.threat_score gt 50) then Block
   ```

### 2. Configure Rate Limiting

1. Go to Security > WAF > Rate limiting rules
2. Create rule:
   - Name: "API Rate Limit"
   - When incoming requests match: `http.request.uri.path contains "/api/"`
   - With the same: IP Address
   - Requests: 100 per 1 minute
   - Action: Block

### 3. Enable DDoS Protection

- Automatically enabled on all Cloudflare accounts
- Configure additional protections in Security > DDoS

### 4. Set Security Headers

Add to Worker:
```javascript
headers: {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000'
}
```

---

## 🐛 Troubleshooting

### Worker Not Responding

```bash
# Check worker status
wrangler tail

# View logs
wrangler tail --format=pretty

# Check recent deployments
wrangler deployments list
```

### Database Connection Issues

```bash
# Test D1 connection
wrangler d1 execute quantumbeam-db --command="SELECT 1"

# Check database exists
wrangler d1 list

# Verify binding in wrangler.toml
cat wrangler.toml | grep -A 3 "d1_databases"
```

### KV Namespace Issues

```bash
# List KV namespaces
wrangler kv:namespace list

# Test write/read
wrangler kv:key put --binding=CACHE "test_key" "test_value"
wrangler kv:key get --binding=CACHE "test_key"
```

### Pages Build Failures

```bash
# Check build logs in Cloudflare Dashboard
# Workers & Pages > quantumbeam-website > Deployments > View details

# Test build locally
cd web/marketing
npm run build

# Clear cache and rebuild
rm -rf .next out node_modules
npm install
npm run build
```

### Custom Domain Not Working

1. Verify DNS records in Cloudflare Dashboard
2. Check SSL/TLS encryption mode is "Full" or "Full (strict)"
3. Wait up to 24 hours for DNS propagation
4. Use `dig` or `nslookup` to verify DNS:
   ```bash
   dig api.quantumbeam.io
   ```

---

## 📚 Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [R2 Storage Docs](https://developers.cloudflare.com/r2/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

---

## 🆘 Support

- **Documentation**: This file
- **Cloudflare Support**: [support.cloudflare.com](https://support.cloudflare.com)
- **Community**: [Cloudflare Discord](https://discord.cloudflare.com)
- **Email**: support@quantumbeam.io

---

## ✅ Deployment Checklist

- [ ] Wrangler CLI installed
- [ ] Logged in to Cloudflare
- [ ] D1 database created and initialized
- [ ] KV namespaces created
- [ ] R2 bucket created
- [ ] Secrets configured
- [ ] Worker deployed successfully
- [ ] Website deployed to Pages
- [ ] Custom domains configured
- [ ] DNS records verified
- [ ] Health checks passing
- [ ] API tested successfully
- [ ] Website loads correctly
- [ ] Monitoring enabled
- [ ] WAF rules configured
- [ ] Rate limiting set up

---

**Ready to deploy? Run:**

```bash
./cloudflare/deploy-cloudflare.sh
```

---

*Last updated: January 9, 2026*
*Version: 1.0.0*
