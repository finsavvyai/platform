# 🚀 TestFlow Pro SaaS - Render Deployment Guide

Deploy your TestFlow Pro SaaS platform on Render with this step-by-step guide.

## 📋 Prerequisites

- GitHub account with your TestFlow Pro repository
- Render account (free tier available)
- Supabase account for database

## 🗄️ Step 1: Set Up Supabase Database

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Enter project details:
   - **Name**: `testflow-pro`
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to be ready (2-3 minutes)

### 1.2 Get Database Credentials
1. Go to **Settings** → **Database**
2. Copy these values (you'll need them for Render):
   - **Host**: `db.your-project-id.supabase.co`
   - **Database**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: Your database password

3. Go to **Settings** → **API** and copy:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Project API Keys** → `anon public`
   - **Project API Keys** → `service_role`

## 🚀 Step 2: Deploy to Render

### Option A: One-Click Deployment (Recommended)

1. **Push your code to GitHub** (if not already done):
```bash
git add .
git commit -m "Ready for Render deployment"
git push origin main
```

2. **Deploy with Render Blueprint**:
   - Go to [render.com](https://render.com) and sign in
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select the repository with TestFlow Pro
   - Render will automatically detect the `render.yaml` file
   - Click "Apply"

### Option B: Manual Service Creation

#### 2.1 Deploy Backend API

1. **Create Web Service**:
   - Go to [render.com](https://render.com) dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Configure service:
     - **Name**: `testflow-pro-api`
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Region**: `Oregon` (or closest to you)
     - **Branch**: `main`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm start`

2. **Set Environment Variables**:
   Click "Advanced" and add these environment variables:

   ```
   NODE_ENV=production
   PORT=10000
   USE_SUPABASE=true
   RUN_MIGRATIONS=true
   
   # Supabase Configuration (replace with your values)
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_DB_HOST=db.your-project-id.supabase.co
   SUPABASE_DB_PORT=5432
   SUPABASE_DB_NAME=postgres
   SUPABASE_DB_USER=postgres
   SUPABASE_DB_PASSWORD=your-database-password
   
   # JWT Secret (generate a random string)
   JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
   
   # CORS Configuration
   FRONTEND_URL=https://your-frontend-app.onrender.com
   
   # Feature Flags
   ENABLE_RECORDING=true
   ENABLE_MOBILE_TESTING=true
   ENABLE_WEB_TESTING=true
   LOG_LEVEL=info
   ```

3. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Note the service URL (e.g., `https://testflow-pro-api.onrender.com`)

#### 2.2 Deploy Frontend

1. **Create Static Site**:
   - Click "New" → "Static Site"
   - Connect same GitHub repository
   - Configure:
     - **Name**: `testflow-pro-frontend`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `dist`

2. **Set Environment Variables**:
   ```
   VITE_APP_ENV=production
   VITE_API_BASE_URL=https://testflow-pro-api.onrender.com
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_ENABLE_RECORDING=true
   VITE_ENABLE_MOBILE_TESTING=true
   VITE_ENABLE_WEB_TESTING=true
   VITE_ENABLE_ANALYTICS=false
   ```

3. **Configure Redirects**:
   - In "Settings" → "Redirects/Rewrites"
   - Add rule: `/*` → `/index.html` (for SPA routing)

4. **Deploy**:
   - Click "Create Static Site"
   - Wait for deployment (3-5 minutes)

## 🔧 Step 3: Configure CORS

1. **Update Backend Environment**:
   - Go to your backend service settings
   - Update `FRONTEND_URL` with your actual frontend URL
   - Example: `FRONTEND_URL=https://testflow-pro-frontend.onrender.com`

2. **Redeploy Backend**:
   - Click "Manual Deploy" → "Deploy latest commit"

## 🧪 Step 4: Test Your Deployment

1. **Check Backend Health**:
   - Visit: `https://your-backend-url.onrender.com/health`
   - Should return status "ok" with database "connected"

2. **Test Frontend**:
   - Visit your frontend URL
   - Try creating an account
   - Test the recording studio

3. **Database Connection**:
   - Check Supabase dashboard for activity
   - Verify tables were created automatically

## 🎛️ Step 5: Production Configuration

### 5.1 Custom Domains (Optional)
1. **Frontend Domain**:
   - In Render dashboard: Settings → Custom Domains
   - Add your domain (e.g., `app.testflow.pro`)
   - Update DNS CNAME record

2. **Backend Domain**:
   - Add API subdomain (e.g., `api.testflow.pro`)
   - Update frontend environment variable

### 5.2 SSL Certificates
- Render automatically provides SSL certificates
- No additional configuration needed

### 5.3 Monitoring
- Enable "Auto-Deploy" for automatic deployments
- Set up health check notifications
- Monitor logs in Render dashboard

## 📊 Render Service Configuration

### Backend Service (Web Service)
- **Plan**: Starter ($7/month) or Free tier
- **Region**: Oregon (US West) or Frankfurt (Europe)
- **Health Check**: `/health` endpoint
- **Auto-scaling**: Available on paid plans

### Frontend Service (Static Site)
- **Plan**: Free (100GB bandwidth) or Pro
- **CDN**: Global edge locations
- **SPA Support**: Configured for React Router

## 🔐 Security Checklist

- [ ] Strong JWT secret (32+ characters)
- [ ] Secure database password
- [ ] CORS configured correctly
- [ ] Environment variables set
- [ ] HTTPS enabled (automatic)
- [ ] Supabase RLS policies configured

## 💰 Cost Estimate

### Free Tier
- **Backend**: Free (750 hours/month, sleeps after 15 min)
- **Frontend**: Free (100GB bandwidth)
- **Database**: Supabase free tier (500MB)
- **Total**: $0/month

### Production Tier
- **Backend**: Starter $7/month (always on)
- **Frontend**: Free or Pro $5/month
- **Database**: Supabase Pro $25/month
- **Total**: ~$32/month

## 🚨 Troubleshooting

### Common Issues:

1. **Build Fails**:
   - Check Node.js version (should be 18+)
   - Verify package.json scripts
   - Check build logs in Render dashboard

2. **Database Connection Error**:
   - Verify Supabase credentials
   - Check database status in Supabase dashboard
   - Ensure `USE_SUPABASE=true`

3. **CORS Error**:
   - Update `FRONTEND_URL` in backend settings
   - Redeploy backend service
   - Check browser console for exact error

4. **Frontend 404 on Refresh**:
   - Add SPA redirect rule: `/*` → `/index.html`
   - Verify in Render static site settings

### Getting Help:
- Render docs: [render.com/docs](https://render.com/docs)
- Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- Check service logs in Render dashboard

## 🎉 Success!

Your TestFlow Pro SaaS platform is now live on Render! 

**URLs:**
- **Frontend**: `https://your-app.onrender.com`
- **Backend API**: `https://your-api.onrender.com`
- **Health Check**: `https://your-api.onrender.com/health`

**Features Available:**
- ✅ User registration and authentication
- ✅ Mobile test recording with Maestro
- ✅ Web test recording with workflow-use
- ✅ Real-time recording preview
- ✅ Test export in multiple formats
- ✅ Project and test management
- ✅ Secure multi-tenant architecture

## 🔄 Continuous Deployment

Render automatically deploys when you push to your main branch:

```bash
git add .
git commit -m "Add new feature"
git push origin main
```

Your changes will be live in 3-5 minutes! 🚀