# Questro Deployment Guide

This guide covers all deployment options for the Questro project, including individual component deployments and full-stack deployments.

## 🚀 Quick Start

### Deploy Everything (Recommended)
```bash
./scripts/deploy-all.sh
```

### Deploy Individual Components
```bash
# Marketing site (questro.io)
./scripts/deploy-questro-io.sh

# Product site (questro.app)
./scripts/deploy-questro-app.sh

# Backend API
./scripts/deploy-backend.sh
```

## 📋 Deployment Scripts Overview

### 1. `deploy-all.sh` - Full-Stack Deployment
**Purpose:** Deploy all Questro components together
**Features:**
- Builds all components (questro.io, questro.app, backend)
- Multiple deployment options (Render, Multi-platform, AWS)
- Comprehensive logging and reporting
- Preflight checks and validation

**Options:**
1. **Render (Recommended)** - Full-stack with database
2. **Multi-Platform** - Backend: Render+Railway, Frontends: Netlify+Vercel
3. **AWS Enterprise** - ECS + RDS + CloudFront
4. **Custom** - Choose components individually

### 2. `deploy-questro-io.sh` - Marketing Site
**Purpose:** Deploy the enterprise marketing site (questro.io)
**Features:**
- Enterprise-focused messaging and CTAs
- Case studies and testimonials
- Marketing conversion optimization

**Platforms:**
- Render (Recommended)
- Netlify
- Vercel
- AWS S3 + CloudFront

### 3. `deploy-questro-app.sh` - Product Site
**Purpose:** Deploy the developer product site (questro.app)
**Features:**
- Developer-focused features and demos
- Interactive playgrounds
- Signup conversion optimization

**Platforms:**
- Render (Recommended)
- Netlify
- Vercel
- AWS S3 + CloudFront

### 4. `deploy-backend.sh` - Backend API
**Purpose:** Deploy the Node.js backend API
**Features:**
- JWT authentication
- PostgreSQL database integration
- Redis caching
- Health check endpoints

**Platforms:**
- Render (Recommended)
- Railway
- Heroku
- AWS ECS
- DigitalOcean App Platform

## 🌐 Deployment Platforms

### Render (Recommended)
**Best for:** Full-stack applications with databases
**Pros:**
- Free tier available
- PostgreSQL and Redis included
- Automatic deployments from Git
- Custom domains with SSL
- Health checks and monitoring

**Setup:**
1. Connect GitHub repository
2. Configure environment variables
3. Add custom domains

### Multi-Platform Strategy
**Best for:** Optimized performance and cost
**Architecture:**
- Backend: Render + Railway (redundancy)
- questro.io: Netlify (marketing optimization)
- questro.app: Vercel (developer experience)

### AWS Enterprise
**Best for:** Enterprise applications with high scalability
**Components:**
- ECS for containerized services
- RDS for PostgreSQL database
- CloudFront for CDN
- Route 53 for DNS
- Certificate Manager for SSL

## 🔧 Configuration

### Environment Variables

#### Backend API
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-secret-key
CORS_ORIGIN=https://questro.app
API_VERSION=v1
```

#### Frontend Sites
```bash
NODE_ENV=production
SITE_TYPE=marketing|product
VITE_API_URL=https://api.questro.app
```

### DNS Configuration

#### questro.io
```
Type: A Record
Host: @
Value: [Your hosting provider IP]

Type: CNAME Record  
Host: www
Value: [Your hosting provider URL]
```

#### questro.app
```
Type: A Record
Host: @
Value: [Your hosting provider IP]

Type: CNAME Record  
Host: www
Value: [Your hosting provider URL]
```

#### api.questro.app
```
Type: CNAME Record
Host: api
Value: [Your backend service URL]
```

## 📊 Monitoring & Analytics

### Marketing Site (questro.io)
- Google Analytics for marketing metrics
- Conversion tracking for demo requests
- Enterprise-focused goals

### Product Site (questro.app)
- Google Analytics for product metrics
- Conversion tracking for signups
- Feature usage tracking

### Backend API
- Application performance monitoring
- Error tracking and logging
- Database performance metrics

## 🔒 Security Checklist

- [ ] SSL certificates configured
- [ ] CORS properly configured
- [ ] JWT_SECRET is secure
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] SQL injection protection
- [ ] XSS protection headers

## 🚨 Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check Node.js version
node --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Deployment Failures
```bash
# Check deployment logs
cat deployment-*.log

# Verify environment variables
echo $DATABASE_URL
echo $JWT_SECRET

# Test local build
npm run build
```

#### DNS Issues
```bash
# Check DNS propagation
dig questro.io
dig questro.app
dig api.questro.app

# Use online tools
# https://whatsmydns.net/
```

### Health Checks

#### Backend API
```bash
curl https://api.questro.app/health
curl https://api.questro.app/health/detailed
```

#### Frontend Sites
```bash
curl -I https://questro.io
curl -I https://questro.app
```

## 📈 Performance Optimization

### Frontend
- Enable gzip compression
- Configure CDN caching
- Optimize images and assets
- Implement lazy loading

### Backend
- Enable Redis caching
- Optimize database queries
- Implement rate limiting
- Use connection pooling

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
name: Deploy Questro
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: ./scripts/deploy-all.sh
```

## 📞 Support

### Deployment Reports
Each deployment generates a detailed report:
- `questro-io-deployment-report.md`
- `questro-app-deployment-report.md`
- `backend-deployment-report.md`
- `questro-full-deployment-report-{ID}.md`

### Logs
- Deployment logs: `deployment-{ID}.log`
- Platform-specific logs in hosting dashboards

### Getting Help
1. Check the deployment reports
2. Review the logs
3. Test health check endpoints
4. Verify environment variables
5. Check DNS configuration

---

**Last Updated:** $(date)
**Version:** 1.0.0
