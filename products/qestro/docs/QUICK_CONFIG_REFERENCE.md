# Questro Quick Configuration Reference

Quick reference for the most common configuration tasks after deployment.

## 🚀 Essential Setup (Do First)

### 1. DNS Configuration (Namecheap)

**questro.io:**
```
CNAME | www | your-render-questro-io-service.onrender.com
A     | @   | 76.76.19.19
CNAME | *   | questro.io
```

**questro.app:**
```
CNAME | www | your-render-questro-app-service.onrender.com
A     | @   | 76.76.19.19
CNAME | *   | questro.app
```

**api.questro.app:**
```
CNAME | api | your-backend-service.onrender.com
```

### 2. Environment Variables (Backend)

**Render Dashboard → Environment Variables:**
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-super-secure-jwt-secret-key-here
CORS_ORIGIN=https://questro.app
API_VERSION=v1
REDIS_URL=redis://your-redis-url:port
```

### 3. Custom Domains (Render)

**For each service:**
1. Settings → Custom Domains
2. Add: `questro.io`, `www.questro.io`
3. Add: `questro.app`, `www.questro.app`
4. Add: `api.questro.app`

## 🔍 Health Checks

### Test All Endpoints
```bash
# Frontend sites
curl -I https://questro.io
curl -I https://questro.app

# Backend API
curl https://api.questro.app/health
curl https://api.questro.app/health/detailed
```

### DNS Verification
```bash
dig questro.io
dig questro.app
dig api.questro.app
```

## 📊 Analytics Setup

### Google Analytics 4
1. Create GA4 property for each site
2. Get Measurement ID (G-XXXXXXXXXX)
3. Add to respective `index.html`:

**questro.io:**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**questro.app:**
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YYYYYYYYYY"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YYYYYYYYYY');
</script>
```

## 🔒 Security Headers

### Add to Frontend index.html
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data: https:;
               connect-src 'self' https://api.questro.app;">
```

## 📧 Email Setup

### SendGrid Configuration
```javascript
// Backend environment variable
SENDGRID_API_KEY=your-sendgrid-api-key

// Email templates needed:
// - Welcome email
// - Password reset
// - Email verification
// - Demo request (questro.io)
// - Marketing newsletter
```

## 🔄 CI/CD Setup

### GitHub Secrets Required
```
RENDER_TOKEN=your-render-token
NETLIFY_TOKEN=your-netlify-token
VERCEL_TOKEN=your-vercel-token
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

## 🚨 Common Issues & Fixes

### DNS Not Working
```bash
# Check propagation
dig +short questro.io
dig @8.8.8.8 questro.io

# Wait 15-48 hours for full propagation
```

### SSL Certificate Issues
```bash
# Check certificate
openssl s_client -connect questro.io:443 -servername questro.io

# Render/Vercel/Netlify: SSL is automatic
# Wait 5-10 minutes after adding custom domain
```

### Environment Variables Not Loading
```bash
# Check in Render dashboard
# Restart service if needed
# Verify no typos in variable names
```

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check DATABASE_URL format:
# postgresql://user:password@host:port/database
```

## 📞 Quick Commands

### Check Deployment Status
```bash
# View deployment logs
cat deployment-*.log

# Check build outputs
ls -la questro-io/dist/
ls -la questro-app/dist/
ls -la backend/dist/
```

### Test Local Builds
```bash
# Frontend sites
cd questro-io && npm run build
cd questro-app && npm run build

# Backend
cd backend && npm run build
```

### Monitor Services
```bash
# Health checks
curl https://api.questro.app/health

# Uptime monitoring (set up in UptimeRobot)
# URLs to monitor:
# - https://questro.io
# - https://questro.app
# - https://api.questro.app/health
```

## ✅ Post-Setup Checklist

- [ ] DNS configured and propagated
- [ ] SSL certificates active
- [ ] Environment variables set
- [ ] Custom domains working
- [ ] Health checks passing
- [ ] Analytics tracking
- [ ] Email templates created
- [ ] Monitoring alerts set up
- [ ] Security headers configured
- [ ] Performance optimized

## 🆘 Emergency Contacts

- **Render Support:** [render.com/support](https://render.com/support)
- **Namecheap Support:** [namecheap.com/support](https://namecheap.com/support)
- **Google Analytics:** [analytics.google.com](https://analytics.google.com)
- **SendGrid Support:** [sendgrid.com/support](https://sendgrid.com/support)

---

**For detailed instructions, see:** `docs/WEBSITE_CONFIGURATION_GUIDE.md`
