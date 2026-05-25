# 🚀 START HERE - Qestro Deployment

**You're ready to deploy! Everything is prepared.**

---

## ⚡ Quick Deploy (30 Minutes)

### Step 1: Supabase (5 min)
1. Go to https://supabase.com/
2. Create project "qestro-production"
3. Copy DATABASE_URL (Session Mode, port 5432)

### Step 2: Migrate (3 min)
```bash
cd backend
export DATABASE_URL="your-supabase-url?sslmode=require"
./scripts/setup-supabase.sh
```

### Step 3: Render (10 min)
1. https://dashboard.render.com/
2. New Web Service from GitHub
3. Add environment variables (see below)
4. Deploy

### Step 4: Netlify (5 min)
1. https://app.netlify.com/
2. Import from GitHub
3. Set VITE_API_URL
4. Deploy

### Step 5: Update CORS (2 min)
Add Netlify URL to CORS_ORIGIN in Render

---

## 📝 Environment Variables for Render

**Copy-paste these:**
```bash
NODE_ENV=production
PORT=8000
DATABASE_URL=[your-supabase-url]?sslmode=require
USE_SUPABASE=true
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
JWT_SECRET=a3b30048ed02c9b0f1525a5707ed8b39259039a8c8c99587f4f12467b61007f2
JWT_REFRESH_SECRET=eb2266be18d856a20cc974e7a20e456cd40c4957b0910aebac64e3c296b22731
SESSION_SECRET=d35cd54e2acc45e80d0215e394fa3f34f6c08c76214b41bc3e9b98c147e6718f
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
TRUST_PROXY=true
CORS_ORIGIN=http://localhost:3000
```

Update CORS_ORIGIN later with your Netlify URL.

---

## 📚 Need More Details?

- **Quick Guide:** QUICK_START_DEPLOYMENT.md (30-min step-by-step)
- **Checklist:** DEPLOYMENT_CHECKLIST.md (checkboxes for each step)
- **Troubleshooting:** DEPLOYMENT_TROUBLESHOOTING.md (if stuck)
- **Complete Overview:** DEPLOYMENT_READY.md (full context)

---

## ✅ Test Deployment

```bash
# Backend
curl https://questro-api.onrender.com/health

# Frontend
open https://your-app.netlify.app
```

---

**Time to deploy: 30 minutes | Cost: $7/month**

🚀 **Let's go!** Start with QUICK_START_DEPLOYMENT.md
