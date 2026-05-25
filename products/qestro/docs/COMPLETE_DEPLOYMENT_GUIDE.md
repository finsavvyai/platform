# Complete Step-by-Step Questro Deployment Guide

> **Total Time Required**: 2-3 hours  
> **Difficulty**: Intermediate  
> **Prerequisites**: GitHub account, Basic terminal knowledge

## 📋 Overview

This guide will walk you through deploying Questro completely from scratch to production on your domains `questro.io` and `questro.app`.

**Final Result:**
- 🌐 **questro.io** - Professional landing page
- 📱 **app.questro.io** - SaaS dashboard application  
- 🔧 **api.questro.io** - Backend API server
- 📊 **status.questro.io** - Status page
- 📚 **docs.questro.io** - Documentation (optional)

---

## 🚀 Phase 1: Repository and Code Setup (15 minutes)

### Step 1.1: Prepare Your Repository

```bash
# 1. Navigate to your project directory
cd /Users/shacharsolomon/projects/testflow-pro-saas

# 2. Ensure all files are committed
git add .
git commit -m "Prepare Questro for production deployment"

# 3. Push to your main branch
git push origin main

# 4. Create a production branch (recommended)
git checkout -b production
git push origin production
```

### Step 1.2: Verify Project Structure

Run this command to ensure all necessary files exist:

```bash
# Check deployment files exist
ls -la render.yaml netlify.toml DEPLOYMENT_CHECKLIST.md
ls -la landing/index.html landing/download.html landing/netlify.toml
ls -la scripts/setup-supabase.md scripts/deploy-production.sh
```

**Expected Output:** All files should be listed without errors.

---

## 🗄️ Phase 2: Database Setup with Supabase (20 minutes)

### Step 2.1: Create Supabase Project

1. **Go to [supabase.com](https://supabase.com)**
2. **Click "Start your project"** → **"New project"**
3. **Fill in project details:**
   ```
   Organization: [Your organization]
   Name: questro-production
   Database Password: [Generate strong password - SAVE THIS!]
   Region: [Choose closest to your users - e.g., US West]
   ```
4. **Click "Create new project"**
5. **Wait 2-3 minutes for project creation**

### Step 2.2: Get Supabase Credentials

1. **Go to Settings → API**
2. **Copy these values to a text file:**
   ```
   Project URL: https://[your-ref].supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 2.3: Configure Database

1. **Go to Settings → Database**
2. **Copy connection details:**
   ```
   Host: db.[your-ref].supabase.co
   Database name: postgres
   Port: 5432
   User: postgres
   Password: [Your database password from Step 2.1]
   ```

3. **Create the DATABASE_URL:**
   ```
   DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_REF].supabase.co:5432/postgres
   ```

### Step 2.4: Set Up Database Schema

**Option A: Manual Setup (Recommended)**
1. **Go to SQL Editor in Supabase**
2. **Create a new query**
3. **Copy and paste this schema:**

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recording sessions table
CREATE TABLE recording_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('mobile', 'web')),
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'idle',
    actions JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test suites table
CREATE TABLE test_suites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    test_cases JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

4. **Click "Run"** to execute the schema
5. **Verify tables were created** in the Table Editor

---

## 🔧 Phase 3: Deploy Backend API to Render (25 minutes)

### Step 3.1: Create Render Account and Service

1. **Go to [render.com](https://render.com)**
2. **Sign up/Login** with GitHub
3. **Click "New +" → "Web Service"**
4. **Connect your repository** (questro-saas)
5. **Fill in service details:**
   ```
   Name: questro-api
   Environment: Node
   Region: Oregon (US West) 
   Branch: production (or main)
   Build Command: cd backend && npm install && npm run build
   Start Command: cd backend && npm start
   ```

### Step 3.2: Configure Environment Variables

In the Render dashboard, go to **Environment** tab and add these variables:

```bash
NODE_ENV=production
PORT=8000

# Supabase (from Phase 2)
SUPABASE_URL=https://[your-ref].supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
DATABASE_URL=postgresql://postgres:[password]@db.[your-ref].supabase.co:5432/postgres

# Generate these secrets (use a password generator)
JWT_SECRET=[64-character-random-string]
JWT_REFRESH_SECRET=[64-character-random-string]

# CORS Configuration
CORS_ORIGIN=https://questro.io,https://app.questro.io

# Feature Flags
ENABLE_RECORDING=true
ENABLE_WEB_TESTING=true
ENABLE_MOBILE_TESTING=true

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

**⚠️ To generate secure secrets:**
```bash
# In terminal, generate random strings:
openssl rand -base64 48
openssl rand -base64 48
```

### Step 3.3: Deploy Backend

1. **Click "Create Web Service"**
2. **Wait for deployment** (5-10 minutes)
3. **Check deployment logs** for any errors
4. **Test the API** by visiting: `https://questro-api.onrender.com/health`

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-XX...",
  "version": "1.0.0"
}
```

### Step 3.4: Configure Custom Domain

1. **In Render dashboard, go to Settings → Custom Domains**
2. **Click "Add Custom Domain"**
3. **Enter:** `api.questro.io`
4. **Copy the CNAME value** (something like `questro-api.onrender.com`)
5. **Keep this tab open** - we'll configure DNS later

---

## 🌐 Phase 4: Deploy Frontend to Netlify (25 minutes)

### Step 4.1: Create Netlify Account

1. **Go to [netlify.com](https://netlify.com)**
2. **Sign up/Login** with GitHub
3. **Click "Add new site" → "Import an existing project"**
4. **Choose GitHub** and select your repository

### Step 4.2: Deploy Main Application

**Site 1: Main Dashboard (app.questro.io)**

1. **Configure build settings:**
   ```
   Base directory: frontend
   Build command: npm run build
   Publish directory: frontend/dist
   ```

2. **Add environment variables** in **Site settings → Environment variables:**
   ```bash
   VITE_APP_ENV=production
   VITE_API_BASE_URL=https://api.questro.io
   VITE_SUPABASE_URL=https://[your-ref].supabase.co
   VITE_SUPABASE_ANON_KEY=[your-anon-key]
   VITE_APP_NAME=Questro
   VITE_COMPANY_NAME=Questro
   VITE_SUPPORT_EMAIL=support@questro.io
   VITE_DOCS_URL=https://docs.questro.io
   ```

3. **Click "Deploy site"**
4. **Wait for deployment** (3-5 minutes)
5. **Test the site** at the temporary Netlify URL

### Step 4.3: Deploy Landing Page

**Site 2: Landing Page (questro.io)**

1. **Click "Add new site" again**
2. **Configure build settings:**
   ```
   Base directory: landing
   Build command: echo "Static site, no build needed"
   Publish directory: landing
   ```

3. **Click "Deploy site"**
4. **Test the landing page** at the temporary Netlify URL

### Step 4.4: Configure Custom Domains

**For Main App:**
1. **Go to Site settings → Domain management**
2. **Click "Add custom domain"**
3. **Enter:** `app.questro.io`
4. **Copy the DNS target** (something like `xxx.netlify.app`)

**For Landing Page:**
1. **Go to the landing site → Site settings → Domain management**
2. **Click "Add custom domain"**
3. **Enter:** `questro.io`
4. **Also add:** `www.questro.io`
5. **Copy the DNS targets**

---

## 🌍 Phase 5: Configure DNS and Domains (15 minutes)

### Step 5.1: Access Your Domain DNS Settings

**Go to your domain registrar** (where you bought questro.io):
- GoDaddy: DNS Management
- Namecheap: Advanced DNS
- Cloudflare: DNS Records
- Google Domains: DNS Settings

### Step 5.2: Add DNS Records

**Add these CNAME records:**

```dns
Type    Name            Value                           TTL
CNAME   questro.io      [netlify-landing-target]       300
CNAME   www.questro.io  questro.io                     300
CNAME   app.questro.io  [netlify-app-target]           300
CNAME   api.questro.io  [render-api-target]            300
```

**Example with actual values:**
```dns
CNAME   questro.io      wonderful-unicorn-123.netlify.app     300
CNAME   www.questro.io  questro.io                           300
CNAME   app.questro.io  amazing-koala-456.netlify.app        300
CNAME   api.questro.io  questro-api.onrender.com             300
```

### Step 5.3: Verify DNS Propagation

**Wait 5-10 minutes, then test:**

```bash
# Test DNS resolution
nslookup questro.io
nslookup app.questro.io
nslookup api.questro.io

# Test HTTPS (may take up to 24 hours for SSL)
curl -I https://questro.io
curl -I https://app.questro.io
curl -I https://api.questro.io/health
```

---

## 📊 Phase 6: Set Up Monitoring and Analytics (30 minutes)

### Step 6.1: Google Analytics 4

1. **Go to [analytics.google.com](https://analytics.google.com)**
2. **Create account** → **Create property**
3. **Property name:** "Questro"
4. **Create data streams:**
   - Web stream for `questro.io`
   - Web stream for `app.questro.io`
5. **Copy Measurement ID** (G-XXXXXXXXXX)

**Add to both sites:**
```html
<!-- Add to landing/index.html and frontend/index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Step 6.2: Uptime Monitoring

1. **Go to [betteruptime.com](https://betteruptime.com)**
2. **Create free account**
3. **Add monitors:**
   ```
   Monitor 1: questro.io (HTTP check)
   Monitor 2: app.questro.io (HTTP check)
   Monitor 3: api.questro.io/health (HTTP check, JSON response)
   ```
4. **Set up notifications** to your email/Slack

### Step 6.3: Error Monitoring with Sentry

1. **Go to [sentry.io](https://sentry.io)**
2. **Create account** → **Create projects:**
   - questro-frontend (React)
   - questro-backend (Node.js)
3. **Copy DSN URLs**
4. **Add to environment variables:**
   ```bash
   # Add to Netlify environment variables
   VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
   
   # Add to Render environment variables
   SENTRY_DSN=https://xxx@sentry.io/xxx
   ```

---

## 🔧 Phase 7: Final Configuration and Testing (30 minutes)

### Step 7.1: Update API URLs in Frontend

**Update frontend environment variables in Netlify:**
```bash
VITE_API_BASE_URL=https://api.questro.io
VITE_WS_URL=wss://api.questro.io
```

**Redeploy frontend** after making this change.

### Step 7.2: Update CORS in Backend

**Update CORS_ORIGIN in Render:**
```bash
CORS_ORIGIN=https://questro.io,https://app.questro.io,https://www.questro.io
```

### Step 7.3: Enable HTTPS Redirects

**In Netlify (both sites):**
1. **Go to Site settings → Domain management**
2. **Enable "Force HTTPS"**
3. **Enable "Pretty URLs"**

### Step 7.4: Test Complete System

**Run these tests:**

```bash
# 1. Test landing page
curl -I https://questro.io
# Expected: 200 OK

# 2. Test app loads
curl -I https://app.questro.io
# Expected: 200 OK

# 3. Test API health
curl https://api.questro.io/health
# Expected: {"status":"ok",...}

# 4. Test API CORS
curl -H "Origin: https://app.questro.io" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     https://api.questro.io/api/auth/login
# Expected: CORS headers present
```

### Step 7.5: Test User Registration Flow

1. **Visit https://app.questro.io**
2. **Click "Sign Up"**
3. **Create test account**
4. **Verify email works** (check Supabase Auth)
5. **Test dashboard loads**
6. **Try creating a project**

---

## 🎉 Phase 8: Launch and Post-Deployment (15 minutes)

### Step 8.1: Create Status Page

1. **Go to [atlassian.com/software/statuspage](https://www.atlassian.com/software/statuspage)**
2. **Create free status page**
3. **Configure components:**
   - Landing Page
   - Dashboard Application  
   - API Services
   - Mobile Testing
   - Web Testing
4. **Set public URL:** `status.questro.io`
5. **Add DNS CNAME** for status.questro.io

### Step 8.2: Final Verification Checklist

**✅ Check each of these URLs:**

- [ ] https://questro.io - Landing page loads
- [ ] https://www.questro.io - Redirects to questro.io
- [ ] https://app.questro.io - Dashboard loads
- [ ] https://api.questro.io/health - API responds
- [ ] SSL certificates working on all domains
- [ ] User registration/login works
- [ ] Error monitoring active in Sentry
- [ ] Uptime monitoring active
- [ ] Google Analytics tracking

### Step 8.3: Performance Optimization

**Test with Google PageSpeed:**
1. **Go to [pagespeed.web.dev](https://pagespeed.web.dev)**
2. **Test https://questro.io**
3. **Test https://app.questro.io**
4. **Aim for scores >90**

### Step 8.4: Security Scan

```bash
# Test security headers
curl -I https://questro.io | grep -i security
curl -I https://app.questro.io | grep -i security

# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
```

---

## 🚀 Congratulations! 

**Questro is now live in production! 🎉**

### Your Live URLs:
- 🌐 **Landing Page**: https://questro.io
- 📱 **Dashboard**: https://app.questro.io
- 🔧 **API**: https://api.questro.io
- 📊 **Status**: https://status.questro.io

### Next Steps:
1. **Marketing**: Share your launch on social media
2. **SEO**: Submit sitemap to Google Search Console
3. **User Feedback**: Set up feedback collection
4. **Iterate**: Monitor usage and improve features
5. **Scale**: Monitor performance and scale as needed

### Emergency Contacts:
- **Technical Issues**: Check Render/Netlify dashboards
- **DNS Issues**: Contact your domain registrar
- **Database Issues**: Check Supabase dashboard
- **General Support**: Create GitHub issues

---

## 📞 Need Help?

If you encounter any issues:

1. **Check the logs:**
   - Render: Dashboard → Service → Logs
   - Netlify: Dashboard → Site → Functions
   - Supabase: Dashboard → Logs

2. **Common Issues:**
   - DNS propagation: Wait 24-48 hours
   - SSL certificates: Wait 1-2 hours after DNS
   - 500 errors: Check environment variables
   - CORS errors: Verify CORS_ORIGIN setting

3. **Get Support:**
   - GitHub Issues: Create detailed issue reports
   - Platform Support: Contact Render/Netlify support
   - Community: Join Discord/Slack communities

**You did it! Questro is now a fully functional SaaS platform! 🚀**