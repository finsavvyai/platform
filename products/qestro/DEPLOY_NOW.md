# 🚀 Deploy Questro to Production NOW!

## Prerequisites (5 minutes)
1. **Create accounts** (if you haven't already):
   - [Render.com](https://render.com) account
   - OpenAI API key from [OpenAI](https://openai.com)
   - Stripe account from [Stripe](https://stripe.com)

2. **Domain setup**:
   - Point `questro.app` DNS to Render (instructions below)
   - Point `questro.io` DNS to Render

## 🏃‍♂️ Quick Deploy (10 minutes)

### Step 1: Set Up Render
```bash
# 1. Go to https://render.com
# 2. Connect your GitHub account  
# 3. Create new service from repo
# 4. Select your questro repository
```

### Step 2: Configure Environment Variables
In Render dashboard, add these environment variables for the backend:

**Required:**
```
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
OPENAI_API_KEY=sk-your-openai-api-key
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
```

**Auto-configured by Render:**
- `DATABASE_URL` (from PostgreSQL database)
- `REDIS_URL` (from Redis service)

### Step 3: Deploy with One Command
```bash
# Run the deployment script
./scripts/deploy-production.sh
```

That's it! 🎉

## 📋 Manual Deploy Steps (Alternative)

If you prefer manual control:

### 1. Push to GitHub
```bash
git add .
git commit -m "Production deployment"
git push origin main
```

### 2. Create Render Services
Go to Render dashboard and create:

**Backend Service:**
- Repository: Your GitHub repo
- Build Command: `cd backend && npm install && npm run build`
- Start Command: `cd backend && npm start`
- Environment: Add the required env vars above

**Frontend Service:**
- Repository: Your GitHub repo  
- Build Command: `cd frontend && npm install && npm run build`
- Publish Directory: `frontend/dist`

**Database:**
- Create PostgreSQL database
- Name: `questro-database`

### 3. Domain Configuration
In Render dashboard:
- Add custom domain `questro.app` to frontend service
- Add custom domain `questro.io` to marketing service  
- Backend will be at: `questro-backend-api.onrender.com`

### 4. DNS Configuration
Point your domains to Render:

```dns
# For questro.app
Type: CNAME
Name: @  
Value: questro-app-frontend.onrender.com

# For questro.io  
Type: CNAME
Name: @
Value: questro-io-marketing.onrender.com
```

## ✅ Post-Deployment Checklist

### Verify Everything Works:
```bash
# 1. Check backend health
curl https://questro-backend-api.onrender.com/health

# 2. Check frontend loads
curl https://questro.app

# 3. Test recording workflow:
# - Go to https://questro.app
# - Start a recording session
# - Stop recording session
# - Verify actions are returned

# 4. Test AI analysis:
# - Use the analyze endpoint
# - Verify test cases are generated
```

### Monitor:
- Check Render deployment logs
- Monitor error rates
- Test critical user flows

## 🎯 Expected Results

After deployment, you'll have:

✅ **questro.app** - Full SaaS application with:
- Recording studio for mobile/web testing
- Real-time sync via WebSockets  
- AI-powered test generation
- User authentication
- Payment processing

✅ **questro.io** - Marketing site

✅ **Backend API** - Full-featured API with:
- Recording session management
- AI analysis endpoints
- Real-time WebSocket support
- Database persistence
- Authentication & authorization

## 🚨 Troubleshooting

### Build Fails?
```bash
# Check build logs in Render dashboard
# Common issues:
# - Missing environment variables
# - Node.js version mismatch  
# - Dependency conflicts

# Fix locally first:
cd frontend && npm run build
cd backend && npm run build
```

### Environment Variables?
```bash
# Required for backend:
JWT_SECRET=<32+ character string>
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...

# Check in Render dashboard under Environment
```

### DNS Issues?
```bash
# Check DNS propagation
dig questro.app
dig questro.io

# May take up to 24 hours to propagate
# Use temporary Render URLs while waiting
```

### Database Issues?
```bash  
# Check database connection in Render logs
# Verify DATABASE_URL is set correctly
# Run migrations if needed
```

## 💡 Pro Tips

### Speed Up Deployment:
- Use Render's auto-deploy on git push
- Set up preview environments for testing
- Enable build caching

### Monitor Performance:
- Set up Sentry for error tracking
- Use Render metrics for performance monitoring
- Add custom health checks

### Scale When Ready:
- Upgrade to paid Render plans for better performance
- Add CDN for global speed
- Consider database read replicas

---

## 🎉 Success! 

Your AI-powered test recording tool is now live at:
- **Main App**: https://questro.app
- **Marketing**: https://questro.io  
- **API**: https://questro-backend-api.onrender.com

**Next Steps:**
1. Test all critical workflows
2. Set up monitoring and alerts
3. Plan user onboarding
4. Start getting feedback!

**You've just launched a production-ready SaaS tool! 🚀**