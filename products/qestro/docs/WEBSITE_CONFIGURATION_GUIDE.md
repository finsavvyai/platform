# Questro Website Configuration Guide

Complete guide for configuring your Questro websites after deployment, including DNS setup, SSL certificates, environment variables, and monitoring.

## 🎯 Overview

This guide covers the configuration of your dual-domain Questro setup:
- **questro.io** - Enterprise marketing site
- **questro.app** - Developer product site  
- **api.questro.app** - Backend API

## 📋 Pre-Configuration Checklist

Before starting configuration, ensure you have:
- [ ] Deployed all components using the deployment scripts
- [ ] Access to your domain registrar (Namecheap)
- [ ] Access to your hosting platform dashboards
- [ ] SSL certificates ready (or auto-provisioning enabled)
- [ ] Environment variables prepared

## 🌐 DNS Configuration

### Namecheap DNS Setup

#### 1. Log into Namecheap
1. Go to [namecheap.com](https://namecheap.com)
2. Click "Sign In" and enter your credentials
3. Navigate to "Domain List"

#### 2. Configure questro.io

**For Render Deployment:**
```
Type: CNAME Record
Host: www
Value: your-render-questro-io-service.onrender.com
TTL: Automatic

Type: A Record
Host: @
Value: 76.76.19.19
TTL: Automatic

Type: CNAME Record
Host: *
Value: questro.io
TTL: Automatic
```

**For Netlify Deployment:**
```
Type: CNAME Record
Host: www
Value: your-site-name.netlify.app
TTL: Automatic

Type: A Record
Host: @
Value: 75.2.60.5
TTL: Automatic
```

#### 3. Configure questro.app

**For Render Deployment:**
```
Type: CNAME Record
Host: www
Value: your-render-questro-app-service.onrender.com
TTL: Automatic

Type: A Record
Host: @
Value: 76.76.19.19
TTL: Automatic

Type: CNAME Record
Host: *
Value: questro.app
TTL: Automatic
```

**For Vercel Deployment:**
```
Type: CNAME Record
Host: www
Value: cname.vercel-dns.com
TTL: Automatic

Type: A Record
Host: @
Value: 76.76.19.19
TTL: Automatic
```

#### 4. Configure api.questro.app

**For Backend API:**
```
Type: CNAME Record
Host: api
Value: your-backend-service.onrender.com
TTL: Automatic
```

### DNS Verification

After configuring DNS, verify propagation:

```bash
# Check DNS propagation
dig questro.io
dig questro.app
dig api.questro.app

# Use online tools
# https://whatsmydns.net/
# https://dnschecker.org/
```

**Expected Results:**
- A records should point to your hosting provider's IP
- CNAME records should resolve to your service URLs
- Propagation typically takes 15 minutes to 48 hours

## 🔒 SSL Certificate Configuration

### Automatic SSL (Recommended)

Most modern hosting platforms provide automatic SSL certificates:

#### Render
1. Go to your service dashboard
2. Navigate to "Settings" → "Custom Domains"
3. Add your domains (questro.io, www.questro.io, etc.)
4. SSL certificates are automatically provisioned

#### Netlify
1. Go to "Site settings" → "Domain management"
2. Add custom domain
3. SSL certificate is automatically provisioned

#### Vercel
1. Go to "Settings" → "Domains"
2. Add your domain
3. SSL certificate is automatically provisioned

### Manual SSL Certificate

If you need to configure SSL manually:

#### Let's Encrypt (Free)
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --webroot -w /var/www/html -d questro.io -d www.questro.io

# Certificate files location:
# /etc/letsencrypt/live/questro.io/fullchain.pem
# /etc/letsencrypt/live/questro.io/privkey.pem
```

#### Commercial SSL Certificate
1. Purchase certificate from provider (DigiCert, GlobalSign, etc.)
2. Generate CSR (Certificate Signing Request)
3. Install certificate files on your server
4. Configure web server (nginx/Apache)

## ⚙️ Environment Variables Configuration

### Backend API Environment Variables

#### Render Dashboard
1. Go to your backend service
2. Navigate to "Environment" → "Environment Variables"
3. Add the following variables:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-super-secure-jwt-secret-key-here
CORS_ORIGIN=https://questro.app
API_VERSION=v1
REDIS_URL=redis://your-redis-url:port
LOG_LEVEL=info
```

#### Railway Dashboard
1. Go to your project
2. Navigate to "Variables" tab
3. Add the same environment variables as above

#### Heroku Dashboard
1. Go to your app
2. Navigate to "Settings" → "Config Vars"
3. Add the environment variables

### Frontend Environment Variables

#### questro.io (Marketing Site)
```bash
NODE_ENV=production
SITE_TYPE=marketing
VITE_API_URL=https://api.questro.app
VITE_GA_TRACKING_ID=GA_MEASUREMENT_ID
VITE_HOTJAR_ID=HOTJAR_ID
```

#### questro.app (Product Site)
```bash
NODE_ENV=production
SITE_TYPE=product
VITE_API_URL=https://api.questro.app
VITE_GA_TRACKING_ID=GA_MEASUREMENT_ID
VITE_ANALYTICS_ID=ANALYTICS_ID
```

## 📊 Analytics & Tracking Setup

### Google Analytics 4

#### 1. Create GA4 Property
1. Go to [Google Analytics](https://analytics.google.com)
2. Create new property for each site
3. Get Measurement ID (G-XXXXXXXXXX)

#### 2. Configure questro.io Analytics
```javascript
// Add to questro.io index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    page_title: 'Questro.io - Enterprise AI Solutions',
    custom_map: {
      'custom_parameter_1': 'demo_request',
      'custom_parameter_2': 'enterprise_contact'
    }
  });
</script>
```

#### 3. Configure questro.app Analytics
```javascript
// Add to questro.app index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YYYYYYYYYY"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YYYYYYYYYY', {
    page_title: 'Questro.app - AI Development Platform',
    custom_map: {
      'custom_parameter_1': 'signup',
      'custom_parameter_2': 'feature_usage'
    }
  });
</script>
```

### Conversion Tracking

#### questro.io (Marketing Goals)
```javascript
// Demo request tracking
gtag('event', 'conversion', {
  'send_to': 'G-XXXXXXXXXX/demo_request',
  'value': 1.0,
  'currency': 'USD'
});

// Enterprise contact tracking
gtag('event', 'conversion', {
  'send_to': 'G-XXXXXXXXXX/enterprise_contact',
  'value': 5.0,
  'currency': 'USD'
});
```

#### questro.app (Product Goals)
```javascript
// Signup tracking
gtag('event', 'conversion', {
  'send_to': 'G-YYYYYYYYYY/signup',
  'value': 1.0,
  'currency': 'USD'
});

// Feature usage tracking
gtag('event', 'conversion', {
  'send_to': 'G-YYYYYYYYYY/feature_usage',
  'value': 2.0,
  'currency': 'USD'
});
```

## 🔍 Monitoring & Health Checks

### Health Check Endpoints

#### Backend API Health Checks
```bash
# Basic health check
curl https://api.questro.app/health

# Detailed health check
curl https://api.questro.app/health/detailed

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-08-30T22:38:03Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

#### Frontend Health Checks
```bash
# Marketing site
curl -I https://questro.io

# Product site
curl -I https://questro.app

# Expected response: HTTP/2 200
```

### Uptime Monitoring

#### UptimeRobot (Free)
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create account and add monitors:

**Backend API Monitor:**
- URL: https://api.questro.app/health
- Type: HTTP(s)
- Interval: 5 minutes
- Alert: Email/SMS

**Frontend Monitors:**
- URL: https://questro.io
- URL: https://questro.app
- Type: HTTP(s)
- Interval: 5 minutes

#### Pingdom (Paid)
1. Create monitors for all endpoints
2. Set up alerting for downtime
3. Configure performance monitoring

## 🚀 Performance Optimization

### Frontend Optimization

#### 1. Enable Compression
**Netlify (automatic):**
```toml
# netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

**Vercel (automatic):**
```json
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

#### 2. Image Optimization
```bash
# Optimize images before deployment
npm install -g imagemin-cli

# Optimize all images
imagemin images/* --out-dir=optimized-images
```

#### 3. Bundle Optimization
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash', 'axios']
        }
      }
    }
  }
}
```

### Backend Optimization

#### 1. Database Optimization
```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);

-- Enable query logging for optimization
SET log_statement = 'all';
```

#### 2. Redis Caching
```javascript
// Cache frequently accessed data
const cacheKey = `user:${userId}:profile`;
const cachedData = await redis.get(cacheKey);

if (!cachedData) {
  const userData = await getUserFromDatabase(userId);
  await redis.setex(cacheKey, 3600, JSON.stringify(userData));
  return userData;
}

return JSON.parse(cachedData);
```

#### 3. Rate Limiting
```javascript
// Implement rate limiting
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', apiLimiter);
```

## 🔒 Security Configuration

### Security Headers

#### 1. Content Security Policy (CSP)
```html
<!-- Add to index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline' https://www.googletagmanager.com;
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data: https:;
               connect-src 'self' https://api.questro.app;">
```

#### 2. Security Headers (Backend)
```javascript
// Add security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.questro.app"]
    }
  }
}));
```

### Authentication & Authorization

#### 1. JWT Configuration
```javascript
// JWT settings
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: '24h',
  issuer: 'questro.app',
  audience: 'questro-users'
};

// Token generation
const token = jwt.sign(payload, jwtConfig.secret, {
  expiresIn: jwtConfig.expiresIn,
  issuer: jwtConfig.issuer,
  audience: jwtConfig.audience
});
```

#### 2. CORS Configuration
```javascript
// CORS settings
const corsOptions = {
  origin: [
    'https://questro.io',
    'https://www.questro.io',
    'https://questro.app',
    'https://www.questro.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

## 📧 Email Configuration

### Transactional Email Setup

#### 1. SendGrid Configuration
```javascript
// Backend email configuration
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendWelcomeEmail = async (userEmail, userName) => {
  const msg = {
    to: userEmail,
    from: 'welcome@questro.app',
    subject: 'Welcome to Questro!',
    templateId: 'd-welcome-template-id',
    dynamicTemplateData: {
      name: userName,
      loginUrl: 'https://questro.app/login'
    }
  };
  
  await sgMail.send(msg);
};
```

#### 2. Email Templates
Create email templates for:
- Welcome emails
- Password reset
- Email verification
- Marketing newsletters
- Enterprise demo requests

## 🔄 CI/CD Pipeline Configuration

### GitHub Actions Workflow

#### 1. Create `.github/workflows/deploy.yml`
```yaml
name: Deploy Questro

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: ./scripts/deploy-all.sh
        env:
          RENDER_TOKEN: ${{ secrets.RENDER_TOKEN }}
          NETLIFY_TOKEN: ${{ secrets.NETLIFY_TOKEN }}
```

#### 2. Configure Secrets
Add these secrets to your GitHub repository:
- `RENDER_TOKEN`
- `NETLIFY_TOKEN`
- `VERCEL_TOKEN`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## 🚨 Troubleshooting

### Common Issues

#### 1. DNS Not Propagating
```bash
# Check DNS propagation
dig +short questro.io
dig +short questro.app
dig +short api.questro.app

# Use multiple DNS servers
dig @8.8.8.8 questro.io
dig @1.1.1.1 questro.io
```

#### 2. SSL Certificate Issues
```bash
# Check SSL certificate
openssl s_client -connect questro.io:443 -servername questro.io

# Test SSL configuration
curl -I https://questro.io
```

#### 3. Environment Variables Not Loading
```bash
# Check environment variables
echo $NODE_ENV
echo $DATABASE_URL

# Restart services after changing env vars
# Render: Automatic restart
# Railway: Manual restart required
# Heroku: heroku restart
```

#### 4. Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection pool
# Monitor connection limits
# Verify SSL requirements
```

### Debug Commands

#### Frontend Debugging
```bash
# Check build output
ls -la questro-io/dist/
ls -la questro-app/dist/

# Test local build
cd questro-io && npm run build
cd questro-app && npm run build
```

#### Backend Debugging
```bash
# Check logs
tail -f deployment-*.log

# Test API endpoints
curl -X GET https://api.questro.app/health
curl -X POST https://api.questro.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks

#### Weekly
- [ ] Check uptime monitoring reports
- [ ] Review error logs
- [ ] Monitor performance metrics
- [ ] Update dependencies

#### Monthly
- [ ] Review analytics reports
- [ ] Check SSL certificate expiration
- [ ] Update security patches
- [ ] Backup database

#### Quarterly
- [ ] Performance audit
- [ ] Security audit
- [ ] Update deployment scripts
- [ ] Review and update documentation

### Support Resources

- **Deployment Logs:** `deployment-*.log`
- **Platform Dashboards:** Render, Netlify, Vercel
- **Monitoring:** UptimeRobot, Pingdom
- **Analytics:** Google Analytics, Hotjar
- **Documentation:** This guide and deployment reports

---

**Last Updated:** $(date)
**Version:** 1.0.0
**Next Review:** 3 months
