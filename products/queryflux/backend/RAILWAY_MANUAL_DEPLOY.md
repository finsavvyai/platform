# QueryFlux Go Backend - Railway Manual Deployment

Since the Railway MCP has reached its usage limit, here's how to deploy manually to Railway:

## 🚀 Quick Manual Deployment (5 Minutes)

### Option 1: Via Railway Dashboard (Easiest)

1. **Push Code to GitHub**
   ```bash
   cd backend
   git add .
   git commit -m "feat: production-ready Go backend with database connectivity"
   git push origin main
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Select "Deploy from GitHub repository"
   - Choose your queryflux repository
   - Select "Root" path

3. **Add Environment Variables**
   After project creation, click "Variables" and add:
   ```
   PORT = 8080
   ENVIRONMENT = production
   LOG_LEVEL = info
   JWT_SECRET = your-super-secure-jwt-secret-key-here
   ```

4. **Add PostgreSQL Database**
   - In your Railway project, click "New Service"
   - Select "PostgreSQL" from the database options
   - Configure as needed (Railway provides connection details)

5. **Deploy**
   - Railway will automatically deploy your backend
   - Get your production URL (e.g., `queryflux-backend.up.railway.app`)

### Option 2: Via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Create Railway Project**
   ```bash
   railway init
   # Follow prompts to create a new project
   # Choose "Empty project" when prompted
   ```

4. **Deploy Backend**
   ```bash
   railway up
   # This will build and deploy using the railway-full.toml configuration
   ```

## 📋 Post-Deployment Setup

### 1. Test Your Backend
```bash
# Test health endpoint
curl https://your-app-name.up.railway.app/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-10-19T18:30:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. Update Frontend Configuration

In your Netlify dashboard, set this environment variable:
```
VITE_API_URL=https://your-app-name.up.railway.app/api/v1
```

Then redeploy your frontend:
```bash
cd ..
git add .
git commit -m "feat: update API URL to Railway production"
git push origin main
```

### 3. Test Full Integration

1. Visit your frontend: https://queryflux-app.netlify.app
2. Try to create a database connection
3. Use "localhost" as host if testing with local database
4. Check Railway logs for any connection attempts

## 🔧 Database Configuration

### Connect to Railway PostgreSQL

After Railway deploys, you'll get PostgreSQL connection details. Use these in Railway environment:

```bash
DATABASE_URL=postgresql://user:password@host.railway.internal:5432/database
```

### Connect to External Database

If you want to use your own PostgreSQL:

```bash
DATABASE_URL=postgresql://your-user:your-password@your-host:5432/your-database
```

## 📊 Railway Service Management

### Monitor Your Service
- Go to Railway dashboard
- View metrics and logs
- Monitor health checks
- Set up alerts

### Scale Your Service
- In Railway dashboard, go to service settings
- Adjust CPU and memory allocation
- Enable auto-scaling if needed

### Environment Variables Reference

```bash
# Required
PORT=8080
ENVIRONMENT=production
LOG_LEVEL=info
JWT_SECRET=your-super-secure-jwt-secret-key

# Database (Railway provides these automatically)
RAILWAY_ENVIRONMENT=production
RAILWAY_SERVICE_NAME=your-service-name
PGHOST=your-postgres-host
PGPORT=5432
PGUSER=your-postgres-user
PGPASSWORD=your-postgres-password
PGDATABASE=your-database
```

## 🔍 Custom Domain Setup

### Option 1: Railway Custom Domain
1. In Railway dashboard, go to service settings
2. Add your custom domain (e.g., api.queryflux.com)
3. Configure DNS to point to Railway

### Option 2: Netlify Reverse Proxy
Keep frontend on Netlify and configure proxy to Railway backend.

## 🚨 Troubleshooting

### Common Issues

**Build Failures:**
- Check Go version in railway-full.toml (should be 1.24)
- Verify all dependencies are in go.mod

**Connection Issues:**
- Verify database connection strings
- Check Railway network policies
- Ensure SSL is configured correctly

**CORS Issues:**
- Verify frontend URL is in allowed origins
- Check backend CORS configuration

**Health Check Failing:**
- Check Railway service logs
- Verify environment variables
- Test locally first

### Debug Commands

```bash
# Check Railway logs
railway logs

# Check service status
railway status

# Test locally
PORT=8081 ./queryflux-backend-simple

# Rebuild and redeploy
railway up --detach
```

## 💰 Cost Estimation

### Railway Pricing
- **Free Tier**: Limited but functional
- **Starter**: $5/month (More resources)
- **Professional**: $20/month (Production-ready)
- **Enterprise**: $100/month (Scale)

### Recommended Setup
- Start with Free or Starter tier
- Add PostgreSQL database (~$5/month)
- Monitor usage and scale as needed

---

## 📞 Next Steps After Deployment

1. **Update Frontend** with Railway backend URL
2. **Test End-to-End** connection functionality
3. **Add Monitoring** and error tracking
4. **Set Up CI/CD** using GitHub Actions
5. **Configure Custom Domain** for branding

Your QueryFlux backend is production-ready and will be running on Railway within minutes! 🚀