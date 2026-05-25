# 🔐 Security Implementation Guide

**Date:** October 3, 2025
**Priority:** 🔥 **CRITICAL**
**Status:** ✅ Ready to implement

---

## 📋 Generated Secrets (SECURE THESE!)

**⚠️ NEVER commit these secrets to git! ⚠️**

### Production Secrets (Generated with crypto.randomBytes(32))

```bash
# Copy these to Render.com environment variables
JWT_SECRET=a3b30048ed02c9b0f1525a5707ed8b39259039a8c8c99587f4f12467b61007f2
JWT_REFRESH_SECRET=eb2266be18d856a20cc974e7a20e456cd40c4957b0910aebac64e3c296b22731
SESSION_SECRET=d35cd54e2acc45e80d0215e394fa3f34f6c08c76214b41bc3e9b98c147e6718f
```

**How to regenerate (if needed):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 Render.com Secret Configuration

### Step 1: Add Secrets to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your `questro-api` service
3. Navigate to **Environment** tab
4. Add the following secrets:

#### Core Secrets (REQUIRED)
```
JWT_SECRET=a3b30048ed02c9b0f1525a5707ed8b39259039a8c8c99587f4f12467b61007f2
JWT_REFRESH_SECRET=eb2266be18d856a20cc974e7a20e456cd40c4957b0910aebac64e3c296b22731
SESSION_SECRET=d35cd54e2acc45e80d0215e394fa3f34f6c08c76214b41bc3e9b98c147e6718f
```

#### Database (REQUIRED - from Supabase)
```
DATABASE_URL=[Get from Supabase dashboard]
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

#### Security Settings (REQUIRED)
```
NODE_ENV=production
ENABLE_HELMET=true
ENABLE_RATE_LIMITING=true
TRUST_PROXY=true
```

#### Frontend URLs (REQUIRED)
```
FRONTEND_URL=https://app.qestro.io
CORS_ORIGIN=https://qestro.io,https://app.qestro.io,https://www.qestro.io
DOMAIN=qestro.io
```

#### Email (Recommended)
```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[Your email]
SMTP_PASSWORD=[App password - not regular password!]
FROM_EMAIL=noreply@qestro.io
SUPPORT_EMAIL=support@qestro.io
```

#### Payment (When ready)
```
LEMONSQUEEZY_API_KEY=[From LemonSqueezy dashboard]
LEMONSQUEEZY_STORE_ID=[From LemonSqueezy dashboard]
LEMONSQUEEZY_WEBHOOK_SECRET=[From LemonSqueezy dashboard]
```

#### Monitoring (Recommended)
```
SENTRY_DSN=[From Sentry dashboard]
SENTRY_ENVIRONMENT=production
ENABLE_SENTRY=true
```

---

## ✅ Security Checklist

### Pre-Deployment Security (Do before going live)

#### 1. Secrets Management ✅
- [ ] Generate strong secrets (completed above)
- [ ] Add secrets to Render environment variables
- [ ] Remove all secrets from .env files
- [ ] Add .env.production to .gitignore
- [ ] Verify no secrets in git history

#### 2. Database Security 🔥
- [ ] Enable SSL connections (`DB_SSL=true`)
- [ ] Use Supabase or properly secured PostgreSQL
- [ ] Enable Row Level Security (RLS) in Supabase
- [ ] Configure connection encryption
- [ ] Set up automated backups (daily minimum)
- [ ] Configure database firewall rules

#### 3. API Security ✅
- [x] Helmet.js installed (version 7.2.0)
- [ ] Helmet middleware enabled in production
- [ ] Rate limiting verified and active
- [ ] CORS properly configured for production domains
- [ ] Input validation on all endpoints
- [ ] Request size limits enforced

#### 4. Authentication Security ⚠️
- [ ] JWT secrets strong and unique
- [ ] Refresh token rotation implemented
- [ ] Session management configured
- [ ] Account lockout after failed attempts
- [ ] Password complexity enforced (12+ chars, mixed case, numbers, symbols)

#### 5. HTTPS/TLS 🌐
- [ ] SSL certificates active (Render auto-manages)
- [ ] HSTS headers enabled (via Helmet)
- [ ] All HTTP redirected to HTTPS
- [ ] Secure cookies (secure flag in production)

---

## 🛠️ Implementation Steps

### Step 1: Update render.yaml (15 minutes)

Edit `/qestro/render.yaml`:

```yaml
services:
  - type: web
    name: questro-api
    env: node
    region: oregon
    plan: starter
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    healthCheckPath: /health

    # Auto-scaling configuration
    autoscaling:
      minInstances: 1
      maxInstances: 3
      targetCPUPercent: 70
      targetMemoryPercent: 80

    # Resource limits
    disk:
      name: questro-api-disk
      mountPath: /var/data
      sizeGB: 10

    envVars:
      # Environment
      - key: NODE_ENV
        value: production

      # Server
      - key: PORT
        value: 10000

      # Security
      - key: ENABLE_HELMET
        value: true
      - key: ENABLE_RATE_LIMITING
        value: true
      - key: TRUST_PROXY
        value: true

      # Frontend
      - key: FRONTEND_URL
        value: https://app.qestro.io
      - key: CORS_ORIGIN
        value: https://qestro.io,https://app.qestro.io,https://www.qestro.io
      - key: DOMAIN
        value: qestro.io

      # Database (from Render secret storage)
      - key: DATABASE_URL
        sync: false  # Load from Render secrets
      - key: DB_SSL
        value: true
      - key: USE_SUPABASE
        value: true

      # Secrets (from Render secret storage)
      - key: JWT_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      - key: SESSION_SECRET
        sync: false

      # Email (from Render secret storage)
      - key: SMTP_USER
        sync: false
      - key: SMTP_PASSWORD
        sync: false

      # Monitoring (from Render secret storage)
      - key: SENTRY_DSN
        sync: false
```

### Step 2: Update Backend to Use Security Config (10 minutes)

Edit `/backend/src/index.ts` to ensure helmet is active:

```typescript
import securityConfig from './config/security.js';

// Apply security middleware
if (process.env.ENABLE_HELMET !== 'false') {
  app.use(securityConfig.createSecurityMiddleware().helmet);
}

// Apply rate limiting
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
  app.use(securityConfig.createSecurityMiddleware().rateLimiter);
}

// Trust proxy (for Render)
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
```

### Step 3: Database SSL Configuration (5 minutes)

Update database connection to enforce SSL:

```typescript
// In database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
  } : false
};
```

### Step 4: Security Validation Script (5 minutes)

Create a startup security check:

```typescript
// In index.ts, before starting server
import { validateSecurityConfig } from './config/security.js';

const securityValidation = validateSecurityConfig();
if (!securityValidation.valid && process.env.NODE_ENV === 'production') {
  console.error('🚨 SECURITY CONFIGURATION ERRORS:');
  securityValidation.errors.forEach(error => console.error(`  ❌ ${error}`));
  process.exit(1);
}
```

---

## 🧪 Testing Security Configuration

### Local Security Test (Before deployment)

```bash
# 1. Set production-like environment
export NODE_ENV=production
export JWT_SECRET=test_secret_for_local_validation
export ENABLE_HELMET=true
export ENABLE_RATE_LIMITING=true

# 2. Start server
cd backend && npm start

# 3. Test security headers
curl -I http://localhost:8000/health

# Should see headers:
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - Strict-Transport-Security: ...
```

### Security Verification Checklist

After deployment, verify:

```bash
# 1. Check HTTPS is enforced
curl http://qestro.io  # Should redirect to https

# 2. Verify security headers
curl -I https://api.qestro.io/health

# 3. Test rate limiting
for i in {1..110}; do curl https://api.qestro.io/api/auth/login; done
# Should get 429 Too Many Requests after 100 requests

# 4. Test CORS
curl -H "Origin: https://malicious-site.com" https://api.qestro.io/api/health
# Should be blocked

# 5. Verify JWT validation
curl -H "Authorization: Bearer invalid_token" https://api.qestro.io/api/protected
# Should get 403 Forbidden
```

---

## 🚨 Security Incident Response

### If Secrets Are Compromised

**Immediate Actions:**
1. Rotate ALL secrets immediately
2. Invalidate all active sessions
3. Force password reset for all users
4. Review access logs for suspicious activity
5. Enable additional security measures

**How to Rotate Secrets:**
```bash
# 1. Generate new secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update in Render dashboard immediately
# 3. Deploy changes
# 4. Monitor for issues

# 5. Invalidate old tokens (if needed)
# Run database query to mark all sessions as expired
```

### Security Monitoring

**What to monitor:**
- Failed authentication attempts
- Rate limit violations
- Unusual API patterns
- Database connection errors
- Security header violations

**Tools:**
- Sentry for error tracking
- Render logs for access patterns
- Supabase logs for database activity

---

## 📊 Security Score Card

### Before Implementation
- [ ] Secrets: Weak dev secrets
- [ ] Database: No SSL
- [ ] Headers: No Helmet
- [ ] Monitoring: None
- [ ] Score: **3/10** 🔴

### After Implementation
- [x] Secrets: Strong, properly stored
- [x] Database: SSL enabled
- [x] Headers: Helmet active
- [x] Monitoring: Sentry configured
- [x] Score: **9/10** 🟢

---

## ✅ Final Security Checklist

### Critical (Must do before production)
- [ ] All secrets generated and added to Render
- [ ] Database SSL enabled
- [ ] Helmet.js active in production
- [ ] Rate limiting verified
- [ ] CORS configured for production domains
- [ ] HTTPS enforced
- [ ] Security validation in startup

### Important (Should do week 1)
- [ ] Sentry error tracking configured
- [ ] Security audit logging active
- [ ] Password complexity enforced
- [ ] Session management configured
- [ ] Automated backups enabled

### Recommended (Do within month)
- [ ] Refresh token rotation
- [ ] Account lockout mechanism
- [ ] 2FA/MFA support
- [ ] Security penetration testing
- [ ] Compliance audit (SOC2, GDPR)

---

## 🎯 Next Steps

**Immediate (Today):**
1. ✅ Secrets generated
2. [ ] Add secrets to Render dashboard
3. [ ] Update render.yaml with security config
4. [ ] Test locally with production settings
5. [ ] Deploy to staging and verify

**This Week:**
1. [ ] Set up Sentry for error tracking
2. [ ] Configure UptimeRobot for monitoring
3. [ ] Run security audit
4. [ ] Document incident response procedures
5. [ ] Train team on security practices

**Ready to proceed with adding secrets to Render!** 🔐
