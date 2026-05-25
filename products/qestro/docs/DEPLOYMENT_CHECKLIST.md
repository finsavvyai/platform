# Questro Production Deployment Checklist

## ✅ Pre-Deployment Setup

### 1. Supabase Configuration
- [ ] Create Supabase project at [supabase.com](https://supabase.com)
- [ ] Configure database and enable RLS
- [ ] Copy project URL and API keys
- [ ] Run database migrations: `supabase db push`
- [ ] Set up authentication providers (Google, GitHub)

### 2. Environment Variables
Create these environment variables in your deployment platforms:

#### Backend (Render)
```bash
NODE_ENV=production
PORT=8000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
JWT_SECRET=your-256-bit-secret-key
JWT_REFRESH_SECRET=your-256-bit-refresh-key
CORS_ORIGIN=https://questro.io,https://app.questro.io
```

#### Frontend (Netlify)
```bash
VITE_APP_ENV=production
VITE_API_BASE_URL=https://api.questro.io
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_MIXPANEL_TOKEN=your-mixpanel-token
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
```

## 🚀 Deployment Steps

### 1. Deploy Backend to Render
- [ ] Connect GitHub repository to Render
- [ ] Use `render.yaml` for configuration
- [ ] Set environment variables in Render dashboard
- [ ] Deploy and verify health endpoint: `/health`
- [ ] Test API endpoints with Postman/curl

### 2. Deploy Frontend to Netlify
- [ ] Connect GitHub repository to Netlify
- [ ] Configure build settings:
  - Build command: `cd frontend && npm run build`
  - Publish directory: `frontend/dist`
- [ ] Set environment variables
- [ ] Deploy and test functionality

### 3. Deploy Landing Page to Netlify
- [ ] Create separate Netlify site for landing page
- [ ] Connect to `landing/` directory
- [ ] Configure redirects in `netlify.toml`
- [ ] Deploy and test

### 4. Configure Custom Domains

#### DNS Configuration
Set these DNS records at your domain registrar:

```
Type    Name              Value                           TTL
CNAME   questro.io        questro-landing.netlify.app    300
CNAME   app.questro.io    questro-app.netlify.app        300  
CNAME   api.questro.io    questro-api.onrender.com       300
CNAME   www.questro.io    questro.io                     300
```

#### Platform Configuration
- [ ] Add `questro.io` as custom domain in Netlify (landing site)
- [ ] Add `app.questro.io` as custom domain in Netlify (app site)
- [ ] Add `api.questro.io` as custom domain in Render (backend)
- [ ] Enable automatic SSL certificates
- [ ] Test all domains with SSL

### 5. Set Up Monitoring
- [ ] Configure Google Analytics 4
- [ ] Set up Mixpanel for product analytics
- [ ] Configure Sentry for error monitoring
- [ ] Set up Better Uptime for monitoring
- [ ] Create status page at status.questro.io

## 🔧 Post-Deployment Configuration

### 1. Test Core Functionality
- [ ] User registration and login
- [ ] Test recording (mock/demo mode)
- [ ] Dashboard navigation
- [ ] API endpoints
- [ ] Agent download links

### 2. SEO and Analytics
- [ ] Submit sitemap to Google Search Console
- [ ] Verify Google Analytics tracking
- [ ] Set up Google Tag Manager (optional)
- [ ] Configure social media meta tags
- [ ] Test page speed with PageSpeed Insights

### 3. Security Hardening
- [ ] Enable security headers (already in netlify.toml)
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Test authentication flows

### 4. Performance Optimization
- [ ] Enable CDN (automatic with Netlify)
- [ ] Optimize images and assets
- [ ] Configure caching headers
- [ ] Test mobile responsiveness
- [ ] Verify Core Web Vitals

## 📊 Business Setup

### 1. Customer Support
- [ ] Set up support email (support@questro.io)
- [ ] Create help documentation
- [ ] Set up customer support platform (Intercom/Zendesk)
- [ ] Create onboarding flow

### 2. Legal and Compliance
- [ ] Privacy Policy (privacy.questro.io)
- [ ] Terms of Service (terms.questro.io)
- [ ] Cookie Policy
- [ ] GDPR compliance measures
- [ ] Security audit (if handling sensitive data)

### 3. Marketing Setup
- [ ] Social media accounts
- [ ] Google Ads account
- [ ] Email marketing setup (Mailchimp/ConvertKit)
- [ ] Content marketing plan
- [ ] SEO strategy

## 🎯 Launch Checklist

### Pre-Launch (48 hours before)
- [ ] Full system test in production
- [ ] Load testing with synthetic traffic
- [ ] Backup and disaster recovery test
- [ ] Team access and permissions review
- [ ] Marketing materials ready

### Launch Day
- [ ] Monitor all systems
- [ ] Check error rates and performance
- [ ] Respond to user feedback
- [ ] Monitor social media mentions
- [ ] Track key metrics

### Post-Launch (Week 1)
- [ ] Daily performance reviews
- [ ] User feedback collection
- [ ] Bug fixes and optimizations
- [ ] Marketing campaign execution
- [ ] Growth metric tracking

## 🔍 Monitoring Dashboards

### Key URLs to Monitor
- ✅ https://questro.io (Landing page)
- ✅ https://app.questro.io (Dashboard)
- ✅ https://api.questro.io/health (API health)
- ✅ https://docs.questro.io (Documentation)
- ✅ https://status.questro.io (Status page)

### Key Metrics to Track
- [ ] Page load times < 3 seconds
- [ ] API response times < 500ms
- [ ] Uptime > 99.9%
- [ ] Error rate < 1%
- [ ] User registration conversion > 2%

## 🆘 Emergency Contacts

### Platform Support
- **Render Support**: support@render.com
- **Netlify Support**: support@netlify.com  
- **Supabase Support**: support@supabase.io
- **Domain Registrar**: Your domain provider

### Key Team Members
- **Technical Lead**: [Your email]
- **DevOps**: [DevOps email]
- **Marketing**: [Marketing email]
- **Customer Success**: support@questro.io

## 📈 Success Metrics (First 30 Days)

### Technical Metrics
- [ ] 99.9% uptime
- [ ] < 3 second page load times
- [ ] < 1% error rate
- [ ] 100% API endpoint availability

### Business Metrics
- [ ] 100+ user registrations
- [ ] 50+ active users
- [ ] 20+ test recordings created
- [ ] 10+ agent downloads
- [ ] 90%+ user satisfaction score

---

**Ready to launch Questro? 🚀**

Follow this checklist step by step, and you'll have a production-ready SaaS platform that can scale with your business!

For support during deployment, contact: enterprise@questro.io