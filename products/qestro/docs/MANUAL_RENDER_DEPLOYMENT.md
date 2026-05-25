# Manual Render Deployment Guide

Since the Blueprint deployment is having issues, let's deploy each service manually. This approach is actually more reliable and gives you better control.

## Step 1: Deploy Backend Service Manually

### 1. Create Backend Web Service
1. Go to https://render.com dashboard
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub repository: `finsavvyai/questro`
4. Configure the service:

**Basic Settings:**
- **Name**: `questro-api`
- **Region**: Oregon (or your preferred region)
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Advanced Settings:**
- **Plan**: Free or Starter ($7/month for always-on)
- **Health Check Path**: `/health`
- **Auto-Deploy**: Yes

### 2. Add Backend Environment Variables
In the **Environment** tab, add these variables:

```
NODE_ENV=production
PORT=10000
USE_SUPABASE=true
RUN_MIGRATIONS=true
SUPABASE_URL=https://cbssjcqdkgllgfhqivuy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNic3NqY3Fka2dsbGdmaHFpdnV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTM5MzAsImV4cCI6MjA3MTEyOTkzMH0.5VfGhMx0mShpFXJPPWRGQyL_J0wLG7dXkFoIEyQ7xYE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNic3NqY3Fka2dsbGdmaHFpdnV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTU1MzkzMCwiZXhwIjoyMDcxMTI5OTMwfQ.UJPEDz4a2geii80joreIgzCUzyCbhqdB4WclT1mEwdA
SUPABASE_DB_HOST=db.cbssjcqdkgllgfhqivuy.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=26.H*@?hi9bH6Gb
JWT_SECRET=6NaIBcfYTKjW/PM8QNWfAcDidoxdN11sy24kvuw1DK+EMbaTZIYGq+BF0xTM6DM7
FRONTEND_URL=https://questro-frontend.onrender.com
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true
LOG_LEVEL=info
```

### 3. Deploy Backend
Click **"Create Web Service"** and wait for deployment (5-10 minutes).

## Step 2: Deploy Frontend Service Manually

### 1. Create Frontend Static Site
1. Click **"New"** → **"Static Site"**
2. Connect same GitHub repository: `finsavvyai/questro`
3. Configure the service:

**Basic Settings:**
- **Name**: `questro-frontend`
- **Branch**: `main`
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

### 2. Add Frontend Environment Variables
In the **Environment** tab, add these variables:

```
VITE_APP_ENV=production
VITE_API_BASE_URL=https://questro-api.onrender.com
VITE_SUPABASE_URL=https://cbssjcqdkgllgfhqivuy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNic3NqY3Fka2dsbGdmaHFpdnV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NTM5MzAsImV4cCI6MjA3MTEyOTkzMH0.5VfGhMx0mShpFXJPPWRGQyL_J0wLG7dXkFoIEyQ7xYE
VITE_ENABLE_RECORDING=true
VITE_ENABLE_MOBILE_TESTING=true
VITE_ENABLE_WEB_TESTING=true
VITE_ENABLE_ANALYTICS=false
```

### 3. Configure Redirects
In **Settings** → **Redirects/Rewrites**, add:
- **Source**: `/*`
- **Destination**: `/index.html`
- **Status**: `200` (Rewrite)

### 4. Deploy Frontend
Click **"Create Static Site"** and wait for deployment (3-5 minutes).

## Step 3: Update CORS Configuration

After both services are deployed:

1. **Get your actual URLs** from Render dashboard
2. **Update backend environment variable**:
   - Go to backend service → Environment
   - Update `FRONTEND_URL` with your actual frontend URL
   - Example: `https://questro-frontend-abc123.onrender.com`
3. **Update frontend environment variable**:
   - Go to frontend service → Environment  
   - Update `VITE_API_BASE_URL` with your actual backend URL
   - Example: `https://questro-api-xyz789.onrender.com`

## Step 4: Test Deployment

### Backend Test:
```bash
curl https://your-backend-url.onrender.com/health
```
Should return: `{"status":"ok","database":"connected"}`

### Frontend Test:
Visit your frontend URL in browser.

## Common Issues & Solutions

### Backend Build Fails:
- Check if `backend/package.json` has all required dependencies
- Verify Node.js version compatibility (should be 18+)
- Check build logs for specific errors

### Database Connection Issues:
- Verify all Supabase environment variables are correct
- Check Supabase project status
- Ensure `RUN_MIGRATIONS=true` for first deployment

### Frontend Build Fails:
- Check if `frontend/package.json` has all dependencies
- Verify environment variables are set correctly
- Check for TypeScript errors

### CORS Errors:
- Ensure `FRONTEND_URL` in backend matches your actual frontend URL
- Update and redeploy backend service

## Success Indicators

✅ **Backend Deployed**: Health check returns database connected
✅ **Frontend Deployed**: App loads without errors
✅ **CORS Configured**: Frontend can communicate with backend
✅ **Database Connected**: Backend can connect to Supabase

Your Questro platform will be live at:
- **Frontend**: `https://questro-frontend-[hash].onrender.com`
- **Backend**: `https://questro-api-[hash].onrender.com`