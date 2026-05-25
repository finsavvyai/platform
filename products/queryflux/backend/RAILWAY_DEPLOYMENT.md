# Railway Deployment Guide for QueryFlux Backend

This guide provides step-by-step instructions to deploy the QueryFlux Go backend to Railway with PostgreSQL database.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. Railway CLI installed (optional)
3. Git repository with the backend code

## Quick Deployment Steps

### 1. Push to GitHub

Ensure your backend code is pushed to a GitHub repository:

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### 2. Create Railway Project

1. Log in to Railway dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your queryflux repository
5. Select the `backend` directory as the root path

### 3. Configure the Service

Railway will automatically detect your Go application. Use these settings:

**Build Settings:**
- Root Directory: `backend`
- Build Command: `go build -o bin/queryflux-backend ./cmd/server/main_simple.go`
- Start Command: `./bin/queryflux-backend`

**Or use Dockerfile:**
- Root Directory: `backend`
- Dockerfile Path: `Dockerfile.simple`
- Port: 8080

### 4. Add PostgreSQL Database

1. In your Railway project, click "+ New Service"
2. Select "Add from Template"
3. Choose "PostgreSQL"
4. Give it a name: `queryflux-db`

### 5. Configure Environment Variables

Go to your backend service settings and add these environment variables:

#### Required Variables:

```bash
# Application Settings
PORT=8080
ENVIRONMENT=production
LOG_LEVEL=info

# Database (from Railway PostgreSQL service)
DATABASE_URL=${{ DATABASE_URL }}

# Security
JWT_SECRET=your-super-secure-jwt-secret-key-here

# Optional External Services (if needed)
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/queryflux
```

**To get the DATABASE_URL:**
1. Click on your PostgreSQL service
2. Go to the "Connect" tab
3. Copy the DATABASE_URL variable
4. It will look like: `postgresql://postgres:password@containers-us-west-1.railway.app:7802/railway`

### 6. Update railway.toml

Make sure your `backend/railway.toml` is configured correctly:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "go build -o bin/queryflux-backend ./cmd/server/main_simple.go"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "queryflux-backend"

[sources]
[sources.config]
mountPath = "/app"

[services.variables]
PORT = "8080"
ENVIRONMENT = "production"
LOG_LEVEL = "info"
JWT_SECRET = "${{ secrets.JWT_SECRET }}"

[services.health_checks]
[services.health_checks.http]
path = "/health"
port = 8080

[[services.ports]]
port = 8080
protocol = "TCP"
```

### 7. Add CORS Configuration (For Frontend)

After deployment, you'll need to update the CORS configuration in `main_simple.go` to allow your frontend domain:

```go
// Replace the CORS middleware with:
router.Use(func(c *gin.Context) {
    c.Header("Access-Control-Allow-Origin", "https://your-frontend-domain.com")
    c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if c.Request.Method == "OPTIONS" {
        c.AbortWithStatus(204)
        return
    }

    c.Next()
})
```

### 8. Deploy

1. Commit any changes
2. Railway will automatically redeploy on each push
3. Monitor the deployment logs in Railway dashboard

### 9. Test the Deployment

Once deployed, test these endpoints:

- Health Check: `https://your-app-name.up.railway.app/health`
- API Base: `https://your-app-name.up.railway.app/api/v1`

Test with curl:
```bash
# Test health endpoint
curl https://your-app-name.up.railway.app/health

# Test database connection
curl -X POST https://your-app-name.up.railway.app/api/v1/database/connect \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "host": "your-railway-db-host",
    "port": "5432",
    "database": "railway",
    "username": "postgres",
    "password": "your-password"
  }'
```

## Production URL

After deployment, Railway will provide:
- Production URL: `https://your-app-name.up.railway.app`
- Database URL: Available in PostgreSQL service settings

## Updating Frontend Configuration

Update your frontend environment variables:

```bash
# Frontend .env
VITE_API_BASE_URL=https://your-app-name.up.railway.app
VITE_WS_URL=wss://your-app-name.up.railway.app
```

## Monitoring and Logs

- View logs in Railway dashboard under your service
- Monitor metrics in the "Metrics" tab
- Set up alerts in the "Alerts" section

## Custom Domain (Optional)

1. Go to your service settings
2. Click "Settings" tab
3. Under "Networking", click "Add Custom Domain"
4. Add your domain (e.g., `api.queryflux.com`)
5. Update DNS records as instructed by Railway

## Common Issues and Solutions

### Build Failures
- Ensure Go version is compatible (Go 1.21+)
- Check that all dependencies are in go.mod
- Verify Dockerfile.simple is in the backend directory

### Runtime Errors
- Check environment variables are correctly set
- Verify DATABASE_URL is properly connected
- Check logs for specific error messages

### Connection Issues
- Ensure PostgreSQL service is running
- Verify network connectivity between services
- Check firewall rules

## Scaling Options

Railway supports automatic scaling. Configure in service settings:
- Minimum instances: 0 (for cost savings)
- Maximum instances: 5 or more based on traffic
- CPU/Memory limits as needed

## Security Best Practices

1. Use Railway's built-in secrets for sensitive data
2. Enable SSL/TLS (automatic on Railway)
3. Use strong JWT secrets
4. Implement rate limiting
5. Monitor logs for suspicious activity

## Cost Optimization

- Enable auto-suspend for low traffic
- Use appropriate instance sizes
- Monitor usage regularly
- Consider Railway Pro for better performance

## Support

- Railway documentation: https://docs.railway.app
- QueryFlux documentation: Check the docs/ directory
- Create issues in GitHub for problems