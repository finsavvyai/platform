# QueryFlux Full Production Deployment Guide

## 🎯 Overview

This guide covers deploying the complete QueryFlux stack with both frontend and Go backend to production.

## 📋 Current Status

✅ **Frontend**: Deployed at https://queryflux-app.netlify.app
✅ **Go Backend**: Built and tested locally
✅ **Database Connectivity**: Working API endpoints
⏳ **Production Backend**: Ready for deployment
⏳ **Full Integration**: Ready for connection

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Go Backend    │    │   Databases     │
│   (React)       │◄──►│   (API Server)  │◄──►│ PostgreSQL      │
│   Netlify       │    │   Railway/Render │    │ MySQL           │
│   queryflux.app │    │   api.queryflux  │    │ MongoDB         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Deploy (5 Minutes)

### 1. Deploy Go Backend to Railway

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy from GitHub**
   ```bash
   # Push the updated code to your GitHub repository
   git add .
   git commit -m "feat: add Go backend with database connectivity"
   git push origin main
   ```

3. **Create New Project on Railway**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your queryflux repository
   - Select the backend folder or use root with monorepo configuration

4. **Configure Environment Variables**
   ```bash
   PORT=8080
   ENVIRONMENT=production
   LOG_LEVEL=info
   JWT_SECRET=your-secure-jwt-secret-key-here
   ```

5. **Add PostgreSQL Database**
   - In Railway project, click "New Service"
   - Select "PostgreSQL"
   - Note the connection URL

6. **Deploy and Test**
   - Railway will automatically deploy
   - Get the production URL (e.g., `queryflux-backend.up.railway.app`)

### 2. Update Frontend Configuration

1. **Set Environment Variables in Netlify**
   - Go to Netlify dashboard → QueryFlux site
   - Site settings → Environment variables
   - Add: `VITE_API_URL=https://your-backend-url.railway.app/api/v1`

2. **Redeploy Frontend**
   ```bash
   # Push the updated frontend
   git add .
   git commit -m "feat: connect to production Go backend"
   git push origin main
   ```

### 3. Test Full Integration

1. **Test Backend Health**
   ```bash
   curl https://your-backend-url.railway.app/health
   ```

2. **Test Frontend**
   - Visit https://queryflux-app.netlify.app
   - Try to create a database connection
   - Should see real connection attempts in backend logs

## 🔧 Detailed Deployment Options

### Option 1: Railway (Recommended)

**Setup Time**: 10 minutes
**Cost**: ~$20/month for production
**Best For**: Quick deployment, good performance

**Steps**:
1. Push code to GitHub
2. Create Railway project from repo
3. Add PostgreSQL database service
4. Set environment variables
5. Deploy and test

**Files Used**:
- `backend/railway.toml`
- `backend/cmd/server/main_simple.go`
- `backend/Dockerfile.simple`

### Option 2: Render

**Setup Time**: 15 minutes
**Cost**: ~$25/month for production
**Best For**: Built-in databases, easy scaling

**Steps**:
1. Push code to GitHub
2. Create Render account
3. Create new web service from repo
4. Add PostgreSQL database
5. Configure environment variables
6. Deploy and test

**Files Used**:
- `backend/render.yaml`
- `backend/cmd/server/main_simple.go`

### Option 3: Self-Hosted Docker

**Setup Time**: 30 minutes
**Cost**: VPS (~$10/month) + domain
**Best For**: Full control, custom domains

**Steps**:
1. Setup VPS (DigitalOcean, Linode, etc.)
2. Install Docker and Docker Compose
3. Clone repository
4. Configure environment
5. Deploy with Docker Compose

**Files Used**:
- `backend/docker-compose.simple.yml`
- `backend/Dockerfile.simple`

## 📊 Environment Configuration

### Production Environment Variables

```bash
# Backend Configuration
PORT=8080
ENVIRONMENT=production
LOG_LEVEL=info
JWT_SECRET=your-super-secure-jwt-secret-key-change-this

# Database Connections (Railway provides these automatically)
DATABASE_URL=postgresql://user:pass@host:port/dbname
REDIS_URL=redis://host:port
MONGODB_URL=mongodb://user:pass@host:port/dbname

# Frontend Configuration (Netlify)
VITE_API_URL=https://your-backend-url.railway.app/api/v1
VITE_SUPABASE_URL=your-supabase-url (optional)
VITE_SUPABASE_ANON_KEY=your-supabase-key (optional)

# Feature Flags
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_VOICE_COMMANDS=true
VITE_ENABLE_DOCKER_INTEGRATION=false
```

### Security Configuration

```bash
# JWT Secret (generate a secure one)
JWT_SECRET=$(openssl rand -base64 32)

# Database SSL (recommended for production)
POSTGRES_SSL_MODE=require
MYSQL_SSL_MODE=true
MONGODB_SSL=true
```

## 🔍 Testing and Verification

### 1. Health Check

```bash
# Backend health
curl https://your-backend-url.railway.app/health

# Expected response
{
  "status": "ok",
  "timestamp": "2025-10-19T18:30:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### 2. Database Connection Test

```bash
# Test PostgreSQL connection
curl -X POST https://your-backend-url.railway.app/api/v1/database/connect \
  -H "Content-Type: application/json" \
  -d '{
    "dbType": "postgresql",
    "connectionConfig": {
      "host": "your-railway-postgres-host",
      "port": 5432,
      "database": "queryflux",
      "user": "queryflux",
      "password": "your-password"
    }
  }'

# Expected response on success
{
  "success": true,
  "message": "Connection successful"
}
```

### 3. Frontend Integration Test

1. Visit https://queryflux-app.netlify.app
2. Click "Add Connection"
3. Select PostgreSQL
4. Enter connection details
5. Click "Test Connection"
6. Should see success/failure message from backend

## 📈 Performance Optimization

### Backend Optimization

1. **Enable Gzip Compression**
   ```go
   // Add to main.go
   import "github.com/gin-contrib/gzip"
   router.Use(gzip.Gzip(gzip.DefaultCompression))
   ```

2. **Add Request Rate Limiting**
   ```go
   import "github.com/gin-contrib/limit"
   router.Use(limit.MaxAllowed(100))
   ```

3. **Database Connection Pooling**
   ```go
   // PostgreSQL pool config
   config, _ := pgxpool.ParseConfig(databaseURL)
   config.MaxConns = 25
   config.MinConns = 5
   config.HealthCheckPeriod = 1 * time.Minute
   ```

### Frontend Optimization

1. **Bundle Analysis**
   ```bash
   npm run build -- --analyze
   ```

2. **Service Worker for Caching**
   ```bash
   # Add workbox to Vite config
   npm install vite-plugin-pwa workbox-window
   ```

## 🔒 Security Best Practices

### Backend Security

1. **CORS Configuration**
   ```go
   // Restrict to frontend domain
   c.Header("Access-Control-Allow-Origin", "https://queryflux-app.netlify.app")
   ```

2. **Input Validation**
   ```go
   // Validate connection parameters
   if config["host"] == "" || config["port"] == "" {
       return errors.New("host and port are required")
   }
   ```

3. **SQL Injection Prevention**
   ```go
   // Use parameterized queries only
   pool.QueryRow(ctx, "SELECT * FROM users WHERE id = $1", userID)
   ```

### Frontend Security

1. **Environment Variable Protection**
   - Never expose secrets in frontend
   - Use VITE_ prefix for public variables
   - Validate API responses

2. **Content Security Policy**
   ```toml
   # In netlify.toml
   [[headers]]
     for = "/*"
     [headers.values]
       Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'"
   ```

## 📝 Monitoring and Logging

### Application Monitoring

1. **Backend Logs**
   ```bash
   # Railway provides logs in dashboard
   # Check for connection attempts, errors, performance
   ```

2. **Frontend Analytics**
   ```bash
   # Add Google Analytics or Plausible
   VITE_GA_ID=G-XXXXXXXXXX
   ```

3. **Error Tracking**
   ```bash
   # Add Sentry for error tracking
   VITE_SENTRY_DSN=your-sentry-dsn
   ```

### Health Monitoring

1. **Uptime Monitoring**
   - Set up uptime checks for backend and frontend
   - Use UptimeRobot, Pingdom, or similar

2. **Performance Monitoring**
   - Monitor API response times
   - Track database query performance
   - Set up alerts for high error rates

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy QueryFlux

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: '1.24'
      - run: go test ./...
      - run: go build ./cmd/server/main_simple.go

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: railway-app/railway-action@v1
        with:
          api-token: ${{ secrets.RAILWAY_TOKEN }}
          service: queryflux-backend

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=dist
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 🆘 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check backend CORS configuration
   - Verify frontend URL in allowed origins

2. **Database Connection Failed**
   - Verify database is running
   - Check connection string format
   - Ensure firewall allows connections

3. **Environment Variables Not Working**
   - Restart services after changing variables
   - Check for typos in variable names
   - Verify secrets are properly set

4. **Frontend Not Loading**
   - Check browser console for errors
   - Verify API URL is correct
   - Check network requests in dev tools

### Debug Commands

```bash
# Check backend logs (Railway)
railway logs

# Check frontend build
npm run build

# Test API locally
curl -X POST http://localhost:8081/api/v1/database/connect \
  -H "Content-Type: application/json" \
  -d '{"dbType":"postgresql","connectionConfig":{"host":"localhost","port":5432,"database":"test","user":"test","password":"test"}}'

# Check environment variables
printenv | grep QUERYFLUX
```

## 🎉 Success Criteria

Your production deployment is successful when:

✅ **Backend Health**: `/health` endpoint returns 200
✅ **Database Connectivity**: Connection tests work
✅ **Frontend Integration**: UI connects to backend
✅ **HTTPS Enabled**: Both services use SSL
✅ **Environment Variables**: All secrets configured
✅ **Error Handling**: Graceful error messages
✅ **Performance**: Page loads <3 seconds
✅ **Security**: CORS and validation working

## 📞 Support

If you encounter issues:

1. **Check logs**: Railway and Netlify dashboards
2. **Test locally**: Reproduce issues in development
3. **Review configuration**: Environment variables and secrets
4. **Check documentation**: This guide and API docs
5. **Community**: GitHub issues for support

---

**Your QueryFlux application is now ready for production use!** 🚀

The stack provides:
- ✅ Scalable frontend on Netlify
- ✅ High-performance Go backend
- ✅ Production database connectivity
- ✅ Real-time query execution
- ✅ Secure authentication system
- ✅ Monitoring and logging
- ✅ CI/CD pipeline ready