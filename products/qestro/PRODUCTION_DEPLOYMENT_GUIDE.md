# 🚀 Questro Production Deployment Guide

## Domain Strategy
- **questro.app** - Main SaaS application (frontend + backend)
- **questro.io** - Marketing/landing page

## 🏗️ Infrastructure Setup

### Option 1: Vercel + Railway (Recommended - Fastest)
```bash
# Frontend (questro.app) - Vercel
npm install -g vercel
cd frontend
vercel --prod

# Backend - Railway
# Go to railway.app, connect GitHub, deploy backend folder
```

### Option 2: Render (All-in-one)
```bash
# Both frontend and backend on Render
# Already configured with render.yaml
```

### Option 3: AWS/DigitalOcean (Most scalable)
```bash
# Use Docker containers with provided docker-compose files
```

## 🎯 Step-by-Step Deployment

### Step 1: Environment Configuration

#### Frontend (.env.production)
```env
VITE_API_URL=https://api.questro.app
VITE_WS_URL=wss://api.questro.app
VITE_APP_ENV=production
VITE_ENABLE_ANALYTICS=true
```

#### Backend (.env.production)
```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://user:pass@host:5432/questro_prod
REDIS_URL=redis://user:pass@host:6379
FRONTEND_URL=https://questro.app
JWT_SECRET=your-super-secure-jwt-secret
OPENAI_API_KEY=sk-your-openai-key
STRIPE_SECRET_KEY=sk_live_your-stripe-key
```

### Step 2: Database Setup

#### PostgreSQL (Required)
```sql
-- Create production database
CREATE DATABASE questro_prod;
CREATE USER questro_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE questro_prod TO questro_user;
```

#### Redis (Optional - for sessions/cache)
```bash
# Use managed Redis service or install:
redis-server --daemonize yes
```

### Step 3: Build and Deploy

#### Quick Deploy with Vercel + Railway
```bash
# 1. Deploy Frontend to Vercel
cd frontend
echo "VITE_API_URL=https://api.questro.app" > .env.production
vercel --prod

# 2. Deploy Backend to Railway
# - Go to railway.app
# - Connect your GitHub repo
# - Select backend folder
# - Add environment variables
# - Deploy
```

#### Alternative: Deploy to Render
```bash
# Already configured - just push to main branch
git add .
git commit -m "Production deployment"
git push origin main

# Render will auto-deploy using render.yaml
```

### Step 4: Domain Configuration

#### DNS Settings
```dns
# For questro.app (main app)
Type: CNAME
Name: @
Value: your-vercel-deployment.vercel.app

# For API subdomain
Type: CNAME  
Name: api
Value: your-railway-deployment.railway.app

# For questro.io (marketing)
Type: CNAME
Name: @
Value: questro-io.vercel.app
```

#### SSL Certificates
- Vercel/Railway provide automatic SSL
- For custom setup: Use Let's Encrypt

## 🔧 Production Optimizations

### Frontend Optimizations
```bash
# Build optimizations already in place
cd frontend
npm run build

# Outputs optimized build with:
# - Code splitting
# - Tree shaking  
# - Asset optimization
# - Gzip compression
```

### Backend Optimizations
```typescript
// Already implemented in index.ts:
app.use(helmet()); // Security headers
app.use(compression()); // Gzip compression
app.use(morgan('combined')); // Logging
```

### Database Optimizations
```sql
-- Add indexes for performance
CREATE INDEX idx_recording_sessions_user_id ON recording_sessions(user_id);
CREATE INDEX idx_recorded_actions_session_id ON recorded_actions(session_id);
```

## 📊 Monitoring & Analytics

### Application Monitoring
```bash
# Add to package.json
npm install @sentry/node @sentry/react

# Backend error tracking
# Frontend error tracking  
# Performance monitoring
```

### Health Checks
```typescript
// Already implemented - /health endpoint
GET https://api.questro.app/health
```

### Logging
```typescript
// Winston logging already configured
// Logs go to console in production
// Add log aggregation service if needed
```

## 🔐 Security Hardening

### Backend Security
```typescript
// Already implemented:
- helmet() for security headers
- CORS configuration
- Rate limiting
- JWT authentication
- Input validation
```

### Environment Secrets
```bash
# Never commit these to git:
JWT_SECRET=<generate with: openssl rand -base64 32>
DATABASE_URL=<your database connection string>
STRIPE_SECRET_KEY=<your stripe secret key>
OPENAI_API_KEY=<your openai api key>
```

## 🚀 Deployment Commands

### One-Click Deploy to Vercel (Recommended)
```bash
# Frontend
cd frontend
vercel --prod

# Set custom domain in Vercel dashboard:
# questro.app -> frontend deployment
```

### Backend to Railway
```bash
# 1. Go to railway.app
# 2. "New Project" -> "Deploy from GitHub"
# 3. Select your repo
# 4. Choose backend folder
# 5. Add environment variables
# 6. Set custom domain: api.questro.app
```

### Complete Docker Deployment
```bash
# If using Docker on VPS/Cloud
docker-compose -f docker-compose.prod.yml up -d

# Or with our existing setup:
npm run deploy:prod
```

## 🌐 Domain Setup Checklist

### questro.app (Main App)
- [ ] Frontend deployed to Vercel
- [ ] Backend API on api.questro.app  
- [ ] SSL certificate active
- [ ] Environment variables set
- [ ] Database connected

### questro.io (Marketing)
- [ ] Marketing site deployed
- [ ] Redirects to questro.app for signup
- [ ] SEO optimized
- [ ] Analytics tracking

## 🧪 Pre-Production Testing

### Test Checklist
```bash
# 1. Frontend tests
cd frontend && npm test
# Should show: ✅ 19/19 RecordingStudio tests passing

# 2. Backend build
cd backend && npm run build
# Should compile successfully

# 3. Integration test
curl https://api.questro.app/health
# Should return: {"status": "ok", ...}

# 4. Recording workflow test
# - Start recording session
# - Stop recording session  
# - Verify real-time sync works
# - Test AI analysis
```

### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Create test script
echo '
config:
  target: "https://api.questro.app"
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health check"
    requests:
      - get:
          url: "/health"
' > load-test.yml

artillery run load-test.yml
```

## 📈 Scaling Strategy

### Phase 1: MVP Launch
- Single server deployment
- PostgreSQL database
- Up to 1,000 users

### Phase 2: Growth
- Multiple server instances  
- Database replication
- CDN for assets
- Up to 10,000 users

### Phase 3: Scale
- Microservices architecture
- Database sharding
- Auto-scaling
- Global CDN
- 100,000+ users

## 🚨 Backup Strategy

### Database Backups
```bash
# Daily automated backups
pg_dump questro_prod > questro_backup_$(date +%Y%m%d).sql

# Store in S3 or similar
aws s3 cp questro_backup_*.sql s3://questro-backups/
```

### File Storage Backups
```bash
# Recording files and artifacts
rsync -av /recordings/ s3://questro-recordings/
```

## 📞 Support & Monitoring

### Error Tracking
- Sentry for error monitoring
- Uptime monitoring (Pingdom/StatusPage)
- Performance monitoring (New Relic/DataDog)

### User Support
- Intercom/Zendesk integration
- User analytics with Mixpanel/Amplitude
- Feature flags with LaunchDarkly

## 🎯 Go-Live Checklist

### Pre-Launch
- [ ] All tests passing
- [ ] Environment variables set
- [ ] Domains configured
- [ ] SSL certificates active
- [ ] Database migrations run
- [ ] Monitoring setup
- [ ] Backup strategy implemented

### Launch Day
- [ ] Deploy to production
- [ ] Verify all endpoints working
- [ ] Test recording workflow end-to-end
- [ ] Monitor error rates
- [ ] Check performance metrics

### Post-Launch
- [ ] Monitor user feedback
- [ ] Track key metrics
- [ ] Plan first updates
- [ ] Scale infrastructure as needed

---

## 🚀 TLDR: Quick Production Deploy

```bash
# 1. Set up environment files
cp .env.example .env

# 2. Deploy frontend to Vercel
cd frontend && vercel --prod

# 3. Deploy backend to Railway
# Visit railway.app, connect GitHub, deploy backend

# 4. Configure domains
# questro.app -> Vercel deployment
# api.questro.app -> Railway deployment  

# 5. Test everything works
curl https://api.questro.app/health
```

**You'll have a production-ready AI-powered recording tool in under 30 minutes!** 🎉