# Deployment Guide

This guide covers the complete deployment process for MCPOverflow, including development, staging, and production environments.

## 🎯 Deployment Overview

MCPOverflow consists of multiple components that need to be deployed and configured:

- **Frontend Application** (React/Vite)
- **Backend Services** (Supabase)
- **Database** (PostgreSQL)
- **Edge Functions** (Job processing)
- **Static Assets** (CDN)
- **Monitoring** (Analytics and logging)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN/Static    │    │   Frontend      │    │   Supabase      │
│   (Vercel)       │◄──►│   (Vercel)       │◄──►│   (Supabase)    │
│                 │    │                 │    │                 │
│ • Assets        │    │ • React App     │    │ • Database      │
│ • Images        │    │ • API Client    │    │ • Auth Service  │
│ • Fonts         │    │ • Routing       │    │ • Edge Functions │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Deployment

### 1. Prerequisites

#### Required Accounts

- **Vercel** (for frontend hosting)
- **Supabase** (for backend services)
- **GitHub** (for source control)
- **Cloudflare** (optional, for edge deployment)

#### Required Tools

- **Node.js** 18+ and npm
- **Git** for version control
- **Supabase CLI** for database management

### 2. Supabase Setup

#### Create Supabase Project

1. **Sign up for Supabase** at [supabase.com](https://supabase.com)
2. **Create new project**:
   - Project name: `MCPOverflow Production`
   - Database password: Generate strong password
   - Region: Choose nearest region

3. **Get project credentials**:

   ```bash
   # Install Supabase CLI
   npm install -g @supabase/cli

   # Link to your project
   supabase link --project-ref YOUR_PROJECT_REF
   ```

#### Configure Database

```bash
# Apply database schema
supabase db push

# Create storage buckets
supabase storage create buckets

# Set up CORS policies
supabase cors enable
```

#### Environment Variables

```bash
# Get Supabase credentials
supabase status

# Add to your environment
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### 3. Frontend Deployment

#### Deploy to Vercel

1. **Install Vercel CLI**:

   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Deploy project**:

   ```bash
   # From project root
   vercel

   # Follow prompts to configure:
   # - Project name
   # - Framework (Vite)
   # - Build settings
   ```

4. **Configure environment variables**:
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   ```

#### Vercel Configuration

Create `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key"
  },
  "functions": {
    "src/app/api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
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

### 4. Edge Functions Deployment

#### Deploy Supabase Edge Functions

```bash
# Create edge functions directory
mkdir supabase/functions

# Deploy functions
supabase functions deploy

# List deployed functions
supabase functions list
```

#### Function Examples

**Generation Job Processor** (`supabase/functions/generate-job/index.ts`):

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async req => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data, error } = await supabaseClient
      .from('jobs')
      .select('*')
      .eq('id', req.url.split('/').pop())
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 })
    }

    // Process job logic here
    const result = await processGenerationJob(data)

    return new Response(JSON.stringify({ success: true, result }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

### 5. Custom Domain Setup

#### Vercel Custom Domain

1. **Add custom domain** in Vercel dashboard
2. **Configure DNS records**:

   ```
   A    @     76.76.21.21
   CNAME www    cname.vercel-dns.com
   ```

3. **SSL certificate** is automatically provisioned

#### Supabase Custom Domain

```bash
# Add custom domain in Supabase dashboard
# Configure DNS records
# Verify domain ownership
```

## 🌍 Environment Management

### Development Environment

#### Local Setup

```bash
# Clone repository
git clone https://github.com/mcpoverflow/mcpoverflow.git
cd mcpoverflow

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Start development server
npm run dev
```

#### Development Database

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db push

# View logs
supabase logs
```

### Staging Environment

#### Branch Deployment Strategy

```bash
# Deploy staging branch
git checkout develop
git push origin develop

# Vercel will automatically deploy preview URLs
```

#### Staging Configuration

Create `.env.staging`:

```env
VITE_SUPABASE_URL=https://your-staging-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-staging-anon-key
VITE_APP_ENV=staging
```

### Production Environment

#### Production Checklist

- [ ] Database backups configured
- [ ] SSL certificates installed
- [ ] Monitoring and alerting set up
- [ ] Environment variables secured
- [ ] Rate limiting configured
- [ ] Security headers applied
- [ ] Performance testing completed
- [ ] DNS records configured
- [ ] CDN caching rules set

## 🔒 Security Configuration

### Environment Variables Management

#### Supabase Secrets

```bash
# Set production secrets
supabase secrets set JWT_SECRET=your-jwt-secret
supabase secrets set DATABASE_URL=your-database-url
supabase secrets set REDIS_URL=your-redis-url
```

#### Vercel Environment Variables

```bash
# Set production environment variables
vercel env add VITE_SUPABASE_URL --environment production
vercel env add VITE_SUPABASE_ANON_KEY --environment production
```

### SSL/TLS Configuration

#### Automatic SSL

- Vercel provides automatic SSL certificates
- Supabase provides automatic database encryption
- Edge functions use HTTPS by default

#### Manual SSL (if needed)

```bash
# Generate SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout private.key -out certificate.crt

# Upload to your hosting provider
```

### Security Headers

#### Application Headers

```typescript
// security-headers.ts
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
```

#### Vercel Configuration

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

## 📊 Monitoring and Logging

### Application Monitoring

#### Error Tracking

```typescript
// error-tracking.ts
export const trackError = (error: Error, context: any) => {
  // Send to error tracking service
  console.error('Application Error:', error, context)

  // Example: Send to Sentry
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error, { extra: context })
  }
}
```

#### Performance Monitoring

```typescript
// performance-monitoring.ts
export const trackPageLoad = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as any
    const loadTime = navigation.loadEventEnd - navigation.fetchStart

    // Send to analytics
    console.log('Page load time:', loadTime)
  }
}
```

### Database Monitoring

#### Query Performance

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Monitor slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### Connection Monitoring

```sql
-- Check active connections
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state;

-- Check connection limits
SELECT max_connections, current_setting('max_connections');
```

### Infrastructure Monitoring

#### Health Checks

```typescript
// health-check.ts
export const healthCheck = async () => {
  const checks = {
    database: await checkDatabase(),
    storage: await checkStorage(),
    functions: await checkFunctions(),
  }

  const isHealthy = Object.values(checks).every(check => check.status === 'healthy')

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString(),
  }
}
```

#### Health Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const health = await healthCheck()

  return Response.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
  })
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions

#### Workflow Configuration

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy MCPOverflow

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Run type checking
        run: npm run typecheck

      - name: Run linting
        run: npm run lint

  deploy-preview:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Preview
        uses: vercel/action@v1
        with:
          alias: pr-${{ github.event.number }}.mcpoverflow.vercel.app

  deploy-production:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Production
        uses: vercel/action@v1
        with:
          prod: true
          alias: mcpoverflow.com
```

### Database Migrations

#### Automated Migration

```bash
# GitHub Actions step
- name: Deploy Database Changes
  run: |
    supabase db push
    supabase functions deploy
```

#### Migration Testing

```bash
# Test migrations on staging
- name: Test Database Migrations
  run: |
    supabase db reset
    supabase db push
    npm run test:db
```

## 🔧 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear build cache
rm -rf node_modules/.vite
rm -rf dist

# Reinstall dependencies
npm install

# Check for TypeScript errors
npm run typecheck
```

#### Database Connection Issues

```bash
# Check Supabase status
supabase status

# Test database connection
supabase db shell

# Check migration status
SELECT * FROM public.schema_migrations;
```

#### Deployment Failures

```bash
# Check Vercel logs
vercel logs

# Check environment variables
vercel env ls

# Test build locally
npm run build
npm run preview
```

### Performance Issues

#### Slow Queries

```sql
-- Identify slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- Add missing indexes
CREATE INDEX CONCURRENTLY index_name ON table_name (column_name);
```

#### Memory Issues

```bash
# Check Node.js memory usage
node --max-old-space-size=4096

# Monitor memory in production
node --inspect
```

## 📋 Maintenance

### Regular Tasks

#### Daily

- [ ] Monitor error rates
- [ ] Check system health
- [ ] Review performance metrics

#### Weekly

- [ ] Update dependencies
- [ ] Review security logs
- [ ] Check storage usage

#### Monthly

- [ ] Database maintenance
- [ ] SSL certificate renewal
- [ ] Performance optimization
- [ ] Security audit

### Backup Procedures

#### Database Backup

```bash
# Create backup
pg_dump -h localhost -U postgres -d mcpoverflow > backup.sql

# Schedule regular backups
0 2 * * * pg_dump -h localhost -U postgres -d mcpoverflow > /backups/$(date +\%Y\%m\%d).sql
```

#### Application Backup

```bash
# Backup source code
git archive --format=tar.gz --prefix=mcpoverflow/ HEAD > source-backup.tar.gz

# Backup configuration
cp .env.local .env.backup
```

### Recovery Procedures

#### Database Recovery

```bash
# Restore from backup
psql -h localhost -U postgres -d mcpoverflow < backup.sql

# Point-in-time recovery (if using WAL)
pg_basebackup -h localhost -D /backup/base -U postgres -v -P
```

#### Application Recovery

```bash
# Rollback deployment
vercel rollback

# Restore from git
git checkout <commit-hash>
vercel --prod
```

---

For detailed monitoring and alerting procedures, see the [Monitoring Guide](./monitoring.md).
