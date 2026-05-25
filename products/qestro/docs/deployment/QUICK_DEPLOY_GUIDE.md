# 🚀 Qestro Quick Deployment Guide

**You're 90% ready to launch!** You already have the critical services configured.

---

## ✅ What You Already Have

- ✅ **LemonSqueezy** - Payment processing configured with 3 product variants
- ✅ **Cloudflare** - Domains qestro.app and qestro.io ready
- ✅ **SendGrid** - Email service API key configured
- ✅ **Resend** - Backup email service available

**This means you're VERY close to launch!**

---

## ⚡ Quick Launch (2-3 Hours)

### Step 1: Generate Secrets (5 minutes)

```bash
cd qestro

# Generate JWT secrets
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
```

Copy these values - you'll need them in Step 3.

### Step 2: Set Up Supabase Database (15 minutes)

1. **Create Supabase Project**
   - Go to: https://app.supabase.com
   - Click "New Project"
   - Name: `qestro-production`
   - Choose region closest to your users
   - Set a strong database password (save it!)

2. **Get Database URL**
   - Go to Project Settings → Database
   - Find "Connection string" → "URI"
   - Copy the full connection string
   - It looks like: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

3. **Enable Row Level Security**
   - Go to Authentication → Policies
   - We'll configure policies after deployment

### Step 3: Configure Environment Variables (10 minutes)

Copy `.env.production` to `.env` and update these values:

```bash
# Copy the template
cp .env.production .env

# Edit the file
nano .env  # or use your preferred editor
```

**Required updates:**

```bash
# 1. JWT Secrets (from Step 1)
JWT_SECRET=YOUR_GENERATED_SECRET_HERE
JWT_REFRESH_SECRET=YOUR_OTHER_GENERATED_SECRET_HERE

# 2. Database (from Step 2)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# 3. OpenAI (if you want AI features)
OPENAI_API_KEY=sk-your-openai-key-here
# Get from: https://platform.openai.com/api-keys
# Note: Can skip this for MVP, add later

# 4. Redis (Optional for MVP, recommended for production)
# For now, you can skip Redis or use Upstash free tier:
# https://upstash.com → Create Redis → Copy URL
REDIS_URL=redis://default:[PASSWORD]@[HOST]:6379
```

**Everything else is already configured!**
- ✅ LemonSqueezy credentials
- ✅ SendGrid API key
- ✅ Domain configuration
- ✅ Email settings

### Step 4: Set Up LemonSqueezy Webhook (10 minutes)

1. **Log in to LemonSqueezy**
   - Go to: https://app.lemonsqueezy.com
   - Navigate to Settings → Webhooks

2. **Create Webhook**
   - Click "+" or "Add endpoint"
   - URL: `https://api.qestro.app/api/webhooks/lemonsqueezy`
   - Signing Secret: `AUTOBOOTRULESMAN14071979` (already in your .env)
   - Select events:
     - `subscription_created`
     - `subscription_updated`
     - `subscription_cancelled`
     - `subscription_payment_success`
     - `subscription_payment_failed`
     - `order_created`

3. **Save and Test**
   - Save the webhook
   - You can test it after deployment

### Step 5: Configure Cloudflare DNS (15 minutes)

Since your domains are already on Cloudflare:

1. **Log in to Cloudflare**
   - Go to: https://dash.cloudflare.com
   - Select `qestro.app` domain

2. **Add DNS Records for Render**
   - Go to DNS → Records
   - Add CNAME record:
     - Name: `@` (or `qestro.app`)
     - Target: `[your-app-name].onrender.com` (you'll get this from Render)
     - Proxy status: Proxied (orange cloud)
   
   - Add CNAME record for API:
     - Name: `api`
     - Target: `[your-app-name].onrender.com`
     - Proxy status: Proxied

   - Add CNAME record for www:
     - Name: `www`
     - Target: `qestro.app`
     - Proxy status: Proxied

3. **Repeat for qestro.io**
   - Same process for marketing site
   - Point to Netlify or Render static site

4. **Configure Email Records**
   Already done if SendGrid is working, but verify:
   - SPF record: `v=spf1 include:sendgrid.net ~all`
   - DKIM records: From SendGrid dashboard
   - DMARC record: `v=DMARC1; p=none; rua=mailto:postmaster@qestro.app`

### Step 6: Deploy to Render (20 minutes)

1. **Create Render Account**
   - Go to: https://render.com
   - Sign up with GitHub

2. **Connect GitHub Repository**
   - Dashboard → New → Web Service
   - Connect your GitHub repo
   - Select the `qestro` repository

3. **Configure Web Service**
   ```
   Name: qestro-backend-api
   Region: Oregon (or closest to you)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm ci && npm run build
   Start Command: npm start
   ```

4. **Add Environment Variables**
   - Click "Environment" tab
   - Add all variables from your `.env` file
   - **Important:** Add each variable one by one
   - Or upload the file (but remove comments first)

5. **Create Frontend Service**
   - Dashboard → New → Static Site
   - Connect GitHub repo
   - Configure:
     ```
     Name: qestro-frontend-app
     Branch: main
     Root Directory: frontend
     Build Command: npm ci && npm run build
     Publish Directory: dist
     ```

6. **Add Frontend Environment Variables**
   ```
   VITE_API_URL=https://api.qestro.app
   VITE_WS_URL=wss://api.qestro.app
   VITE_APP_NAME=Qestro
   VITE_ENVIRONMENT=production
   ```

7. **Deploy!**
   - Click "Create Web Service" / "Create Static Site"
   - Wait 5-10 minutes for first deploy
   - Check logs for any errors

### Step 7: Run Database Migrations (5 minutes)

After backend deploys successfully:

1. **Open Render Shell**
   - Go to your backend service
   - Click "Shell" tab
   - Run:
   ```bash
   npm run db:migrate
   ```

2. **Verify Database**
   - Go to Supabase dashboard
   - Check Table Editor
   - You should see all tables created

### Step 8: Configure Custom Domains in Render (10 minutes)

1. **Backend API Domain**
   - Go to backend service → Settings → Custom Domain
   - Add: `api.qestro.app`
   - Copy the CNAME target shown
   - Update Cloudflare DNS if needed
   - Wait for SSL certificate (automatic, ~5 min)

2. **Frontend Domain**
   - Go to frontend service → Settings → Custom Domain
   - Add: `qestro.app`
   - Copy the target
   - Update Cloudflare DNS if needed
   - Wait for SSL certificate

3. **Marketing Site**
   - Deploy `landing/` to Netlify or Render
   - Point `qestro.io` to it

### Step 9: Test Everything (30 minutes)

**Critical Tests:**

```bash
# 1. Health Check
curl https://api.qestro.app/health
# Should return: {"status": "ok"}

# 2. Frontend Loads
# Open: https://qestro.app
# Should show landing page

# 3. API Endpoint
curl https://api.qestro.app/api/health
# Should return API health status
```

**User Flow Tests:**

1. **Signup Flow**
   - Go to https://qestro.app/signup
   - Create account
   - Check email for verification
   - Verify email link works

2. **Payment Flow**
   - Try to upgrade to paid plan
   - Use test mode in LemonSqueezy
   - Verify checkout opens
   - Complete test purchase
   - Check webhook receives event

3. **Test Recording**
   - Log in to app
   - Try recording a test
   - Verify it saves
   - Try executing the test

**Fix Issues:**
- Check Render logs: Service → Logs tab
- Check browser console: F12 → Console
- Check Supabase logs: Dashboard → Logs
- Check SendGrid activity: Dashboard → Activity

### Step 10: Deploy Marketing Site (20 minutes)

**Option A: Deploy to Netlify (Recommended for static sites)**

1. **Create Netlify Account**
   - Go to: https://netlify.com
   - Sign up with GitHub

2. **Deploy Landing Page**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli

   # Deploy from landing directory
   cd landing
   netlify deploy --prod
   ```

3. **Configure Domain**
   - Netlify Dashboard → Domain Settings
   - Add `qestro.io`
   - Follow DNS instructions
   - Update Cloudflare CNAME to point to Netlify

**Option B: Deploy to Render**

1. Create Static Site on Render
2. Point to `landing/` directory
3. Configure `qestro.io` domain

---

## 🎉 You're Live!

If all tests pass, you're ready to launch!

### Post-Deployment Checklist

- [ ] All health checks pass
- [ ] Domains resolve correctly (qestro.app, api.qestro.app, qestro.io)
- [ ] SSL certificates are active (check for padlock icon)
- [ ] Signup flow works end-to-end
- [ ] Email delivery works (SendGrid)
- [ ] Payment flow works (LemonSqueezy)
- [ ] Test recording and execution works
- [ ] Database is accessible and migrations ran
- [ ] Error tracking is active (check Render logs)

---

## 🚀 Launch Day

### Marketing Launch

1. **Product Hunt**
   - Submit at 12:01 AM PST on Tuesday or Wednesday
   - URL: https://www.producthunt.com/posts/create
   - Have team upvote and comment

2. **Hacker News**
   - Post "Show HN: Qestro - AI-powered testing automation"
   - URL: https://news.ycombinator.com/submit
   - Engage in comments immediately

3. **Social Media**
   ```
   Twitter: Announcement thread (8-10 tweets)
   LinkedIn: Professional post with demo video
   Reddit: r/SaaS, r/webdev, r/testing
   Dev.to: Technical blog post
   ```

4. **Email**
   - Send to any waitlist you have
   - Personal network
   - Beta testers

### Monitor Everything

First 24 hours:
- Check Render logs every hour
- Monitor error rates
- Watch signup funnel
- Respond to every comment/question
- Fix critical bugs immediately

---

## 📊 Success Metrics

**Day 1:**
- 50-100 signups
- 5-10 paid customers
- Product Hunt top 10
- Hacker News front page

**Week 1:**
- 200-300 signups
- 20-40 paid customers
- $1,000-2,000 MRR

**Month 1:**
- 500-1,000 signups
- 100-150 paid customers
- $5,000-10,000 MRR

---

## 🆘 Troubleshooting

### Common Issues

**1. Database Connection Failed**
```bash
# Check Supabase is accessible
psql $DATABASE_URL -c "SELECT 1"

# Verify connection pooling
# Supabase has built-in pooling, but you might need pgBouncer
```

**2. Email Not Sending**
```bash
# Test SendGrid API key
curl --request POST \
  --url https://api.sendgrid.com/v3/mail/send \
  --header "Authorization: Bearer $SENDGRID_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"noreply@qestro.app"},"subject":"Test","content":[{"type":"text/plain","value":"Test email"}]}'
```

**3. Payment Webhook Not Working**
- Check LemonSqueezy webhook logs
- Verify signing secret matches
- Check Render logs for webhook errors
- Test with LemonSqueezy webhook tester

**4. Frontend Not Loading**
- Check CORS settings in backend
- Verify API_URL in frontend env vars
- Check browser console for errors
- Verify Cloudflare proxy settings

**5. Slow Performance**
- Enable Redis for caching
- Check database query performance
- Enable Cloudflare caching
- Monitor with Render metrics

---

## 🎯 Next Steps After Launch

### Week 1
- Monitor error rates and fix bugs
- Respond to all support inquiries
- Collect user feedback
- Share customer wins on social media

### Week 2-4
- Implement top feature requests
- Optimize conversion funnel
- Create case studies
- Start content marketing

### Month 2-3
- Scale marketing efforts
- Add paid acquisition channels
- Build integration partnerships
- Consider hiring support/sales

---

## 📞 Support

**Deployment Issues:**
- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs
- Cloudflare Docs: https://developers.cloudflare.com

**Service Dashboards:**
- Render: https://dashboard.render.com
- Supabase: https://app.supabase.com
- LemonSqueezy: https://app.lemonsqueezy.com
- Cloudflare: https://dash.cloudflare.com
- SendGrid: https://app.sendgrid.com

---

## ✨ Quick Reference Commands

```bash
# Generate secrets
openssl rand -base64 32

# Deploy to production
git push origin main

# View logs
# Go to Render dashboard → Your service → Logs

# Run migrations
# Render shell: npm run db:migrate

# Test API
curl https://api.qestro.app/health

# Test email
# Use SendGrid dashboard → Email Activity
```

---

**You're ready to launch! 🚀**

Remember:
- Start with MVP features
- Launch and learn from users
- Iterate based on feedback
- Celebrate small wins
- Stay persistent

Good luck! 🎉