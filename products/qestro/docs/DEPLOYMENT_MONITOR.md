# Questro Deployment Monitor & Setup Guide

## Current Status: 🚀 Code Pushed to GitHub

Your code is now live at: https://github.com/finsavvyai/questro

## Step 1: Check Render Deployment Status

### If you haven't connected to Render yet:
1. Go to [render.com](https://render.com) 
2. Sign in/Sign up
3. Click "New" → "Blueprint"
4. Connect your GitHub account
5. Select the `finsavvyai/questro` repository
6. Render will detect the `render.yaml` file automatically
7. Click "Apply" to start deployment

### If Render is already connected:
- Check your Render dashboard for active deployments
- Look for `questro-api` (backend) and `questro-frontend` services

## Step 2: Set Up Supabase Database (Required)

You'll need these credentials for Render environment variables:

### Create Supabase Project:
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Project details:
   - **Name**: `questro`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait 2-3 minutes for setup

### Get Supabase Credentials:
From your Supabase dashboard, copy these values:

#### Settings → Database:
- **Host**: `db.your-project-id.supabase.co`
- **Database**: `postgres`
- **Port**: `5432`
- **User**: `postgres`
- **Password**: Your database password

#### Settings → API:
- **Project URL**: `https://your-project-id.supabase.co`
- **anon public key**
- **service_role key**

## Step 3: Configure Render Environment Variables

Once you have Supabase credentials, add these to your Render backend service:

### Backend Service Environment Variables:
```
NODE_ENV=production
PORT=10000
USE_SUPABASE=true
RUN_MIGRATIONS=true

# Replace with your actual Supabase values:
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
SUPABASE_DB_HOST=db.your-project-id.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-database-password

# Generate a secure JWT secret (32+ characters):
JWT_SECRET=your-super-secure-64-character-jwt-secret-here

# Will be updated after frontend deploys:
FRONTEND_URL=https://questro-frontend.onrender.com

# Feature flags:
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true
LOG_LEVEL=info
```

### Frontend Service Environment Variables:
```
VITE_APP_ENV=production
VITE_API_BASE_URL=https://questro-api.onrender.com
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_ENABLE_RECORDING=true
VITE_ENABLE_MOBILE_TESTING=true
VITE_ENABLE_WEB_TESTING=true
VITE_ENABLE_ANALYTICS=false
```

## Step 4: Test Deployment

### Backend Health Check:
```bash
curl https://questro-api.onrender.com/health
```
Should return: `{"status":"ok","database":"connected"}`

### Frontend:
Visit: `https://questro-frontend.onrender.com`

## Step 5: Update CORS Configuration

After both services are deployed:
1. Go to your backend service in Render
2. Update the `FRONTEND_URL` environment variable with your actual frontend URL
3. Trigger a redeploy

## Quick Commands

### Generate JWT Secret:
```bash
openssl rand -base64 48
```

### Check deployment logs:
```bash
# If you have Render CLI installed:
render logs --service questro-api
render logs --service questro-frontend
```

## Troubleshooting

### Common Issues:

1. **Build Fails**: Check Node.js version compatibility (needs 18+)
2. **Database Connection Error**: Verify Supabase credentials
3. **CORS Error**: Update `FRONTEND_URL` in backend environment
4. **Frontend 404 on Refresh**: Render should auto-configure SPA routing

### Getting Help:
- Render docs: https://render.com/docs
- Supabase docs: https://supabase.com/docs
- Check service logs in respective dashboards

## Next Steps After Successful Deployment

1. **Custom Domain** (Optional):
   - Add your domain in Render service settings
   - Update DNS CNAME records

2. **Monitoring**:
   - Set up health check notifications
   - Enable auto-deploy on git push

3. **Security**:
   - Review and rotate JWT secrets
   - Set up proper CORS origins
   - Enable Supabase Row Level Security

## URLs After Deployment

- **Frontend**: https://questro-frontend.onrender.com
- **Backend API**: https://questro-api.onrender.com
- **Health Check**: https://questro-api.onrender.com/health
- **GitHub**: https://github.com/finsavvyai/questro

---

**Status**: ✅ Code deployed to GitHub, ready for Render deployment
**Next**: Set up Supabase → Configure Render environment variables → Test deployment