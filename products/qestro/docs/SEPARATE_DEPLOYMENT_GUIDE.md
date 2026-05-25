# Separate Deployment Guide

This guide shows you how to deploy each Questro component separately without conflicts.

## 🎯 **The Problem**

When you try to deploy components separately, they overwrite each other's `render.yaml` files, causing conflicts. This guide provides solutions for deploying each component independently.

## 📁 **File Structure**

```
questro/
├── render.yaml                    # Full-stack deployment (all components)
├── render-questro-io.yaml        # questro.io marketing site only
├── render-questro-app.yaml       # questro.app product site only  
├── render-backend.yaml           # Backend API only
├── questro-io/                   # Marketing site source
├── questro-app/                  # Product site source
├── backend/                      # Backend API source
└── scripts/                      # Deployment scripts
```

## 🚀 **Deployment Options**

### **Option 1: Manual Deployment (Recommended)**

#### **1. Deploy questro.io (Marketing Site)**

```bash
# 1. Build the site
cd questro-io
npm install
npm run build

# 2. Deploy to Render using the dedicated config
# Go to render.com → New Static Site → Connect GitHub
# Set build command: cd questro-io && npm install && npm run build
# Set publish directory: questro-io/dist
# Add custom domains: questro.io, www.questro.io
```

#### **2. Deploy questro.app (Product Site)**

```bash
# 1. Build the site
cd questro-app
npm install
npm run build

# 2. Deploy to Render using the dedicated config
# Go to render.com → New Static Site → Connect GitHub
# Set build command: cd questro-app && npm install && npm run build
# Set publish directory: questro-app/dist
# Add custom domains: questro.app, www.questro.app
```

#### **3. Deploy Backend API**

```bash
# 1. Build the backend
cd backend
npm install
npm run build

# 2. Deploy to Render using the dedicated config
# Go to render.com → New Web Service → Connect GitHub
# Set build command: cd backend && npm install && npm run build
# Set start command: cd backend && npm start
# Add environment variables (see below)
```

### **Option 2: Using Separate Render Projects**

Create separate Render projects for each component:

#### **Project 1: questro-io-marketing**
- **Type:** Static Site
- **Build Command:** `cd questro-io && npm install && npm run build`
- **Publish Directory:** `questro-io/dist`
- **Custom Domains:** `questro.io`, `www.questro.io`

#### **Project 2: questro-app-product**
- **Type:** Static Site
- **Build Command:** `cd questro-app && npm install && npm run build`
- **Publish Directory:** `questro-app/dist`
- **Custom Domains:** `questro.app`, `www.questro.app`

#### **Project 3: questro-backend-api**
- **Type:** Web Service
- **Build Command:** `cd backend && npm install && npm run build`
- **Start Command:** `cd backend && npm start`
- **Custom Domain:** `api.questro.app`

### **Option 3: Using Different Platforms**

#### **questro.io → Netlify**
```bash
cd questro-io
npm install
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=dist --message="Questro.io marketing site"
```

#### **questro.app → Vercel**
```bash
cd questro-app
npm install
npm run build

# Deploy to Vercel
vercel --prod --confirm
```

#### **Backend → Railway**
```bash
cd backend
npm install
npm run build

# Deploy to Railway
railway up --service questro-backend-api
```

## 🔧 **Environment Variables**

### **Backend API (Set in Render/Railway/Heroku)**
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secure-jwt-secret-key-here
CORS_ORIGIN=https://questro.app
API_VERSION=v1
REDIS_URL=redis://your-redis-url:port
```

### **Frontend Sites (Set in hosting platform)**
```bash
# questro.io
NODE_ENV=production
SITE_TYPE=marketing
VITE_API_URL=https://api.questro.app

# questro.app
NODE_ENV=production
SITE_TYPE=product
VITE_API_URL=https://api.questro.app
```

## 🌐 **DNS Configuration**

### **Namecheap DNS Setup**

#### **questro.io**
```
Type: CNAME Record
Host: www
Value: your-questro-io-service.onrender.com
TTL: Automatic

Type: A Record
Host: @
Value: 76.76.19.19
TTL: Automatic
```

#### **questro.app**
```
Type: CNAME Record
Host: www
Value: your-questro-app-service.onrender.com
TTL: Automatic

Type: A Record
Host: @
Value: 76.76.19.19
TTL: Automatic
```

#### **api.questro.app**
```
Type: CNAME Record
Host: api
Value: your-backend-service.onrender.com
TTL: Automatic
```

## 📋 **Step-by-Step Deployment Process**

### **Step 1: Deploy Backend First**
```bash
# 1. Go to render.com
# 2. Create new Web Service
# 3. Connect your GitHub repository
# 4. Configure:
#    - Build Command: cd backend && npm install && npm run build
#    - Start Command: cd backend && npm start
#    - Environment Variables: (see above)
# 5. Deploy and get the URL
```

### **Step 2: Deploy questro.io**
```bash
# 1. Go to render.com
# 2. Create new Static Site
# 3. Connect your GitHub repository
# 4. Configure:
#    - Build Command: cd questro-io && npm install && npm run build
#    - Publish Directory: questro-io/dist
#    - Environment Variables: VITE_API_URL=https://your-backend-url.onrender.com
# 5. Add custom domains: questro.io, www.questro.io
```

### **Step 3: Deploy questro.app**
```bash
# 1. Go to render.com
# 2. Create new Static Site
# 3. Connect your GitHub repository
# 4. Configure:
#    - Build Command: cd questro-app && npm install && npm run build
#    - Publish Directory: questro-app/dist
#    - Environment Variables: VITE_API_URL=https://your-backend-url.onrender.com
# 5. Add custom domains: questro.app, www.questro.app
```

## 🔍 **Verification Steps**

### **Check Each Deployment**
```bash
# Backend health check
curl https://your-backend-url.onrender.com/health

# Frontend sites
curl -I https://questro.io
curl -I https://questro.app

# Check DNS propagation
dig questro.io
dig questro.app
dig api.questro.app
```

### **Test Cross-Site Communication**
```bash
# Test API calls from frontend
curl -H "Origin: https://questro.app" \
     -H "Access-Control-Request-Method: GET" \
     https://api.questro.app/health
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Build Failures**
```bash
# Check if Node.js is installed
node --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### **2. Environment Variables Not Loading**
- Check variable names (case-sensitive)
- Restart services after changing variables
- Verify no typos

#### **3. CORS Issues**
- Ensure CORS_ORIGIN is set correctly
- Check that frontend URLs are in the allowed origins
- Verify HTTPS is used for all sites

#### **4. DNS Issues**
```bash
# Check DNS propagation
dig +short questro.io
dig +short questro.app

# Use online tools
# https://whatsmydns.net/
```

## 📊 **Monitoring**

### **Set Up Health Checks**
```bash
# Backend health endpoint
curl https://api.questro.app/health

# Frontend availability
curl -I https://questro.io
curl -I https://questro.app
```

### **Uptime Monitoring**
- Set up UptimeRobot for all three sites
- Monitor response times and availability
- Set up alerts for downtime

## 🎯 **Recommended Deployment Strategy**

### **For Production:**
1. **Backend First** - Deploy API and database
2. **questro.app Second** - Deploy product site
3. **questro.io Third** - Deploy marketing site
4. **DNS Configuration** - Update all domains
5. **SSL Setup** - Verify certificates
6. **Testing** - Test all integrations

### **For Development:**
- Use separate development environments
- Test each component independently
- Use staging domains for testing

---

**This approach ensures each component deploys independently without conflicts!**
