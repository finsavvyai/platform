# Questro Deployment Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. Backend API Issues

#### ❌ Error: "Application failed to start"
**Symptoms:** Render deployment fails with build errors

**Solutions:**
```bash
# Check build logs in Render dashboard
# Common fixes:

# 1. Ensure package.json has correct scripts
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}

# 2. Check Node.js version compatibility
"engines": {
  "node": ">=18.0.0"
}

# 3. Verify all dependencies are in package.json
npm install --save missing-package
```

#### ❌ Error: "Database connection failed"
**Symptoms:** API returns 500 errors, logs show database connection issues

**Solutions:**
1. **Verify DATABASE_URL format:**
   ```bash
   # Correct format:
   DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres
   
   # Check for:
   - Correct password (from Supabase creation)
   - Correct project reference
   - No special characters needing encoding
   ```

2. **Test connection manually:**
   ```bash
   # Install postgres client
   npm install -g pg
   
   # Test connection
   psql "postgresql://postgres:PASSWORD@db.PROJECT-REF.supabase.co:5432/postgres"
   ```

3. **Check Supabase project status:**
   - Go to Supabase dashboard
   - Verify project is active
   - Check database health in Settings → Database

#### ❌ Error: "CORS policy blocked"
**Symptoms:** Frontend can't connect to API, CORS errors in browser

**Solutions:**
```bash
# 1. Update CORS_ORIGIN in Render environment variables
CORS_ORIGIN=https://questro.io,https://app.questro.io,https://www.questro.io

# 2. Check frontend API URL
VITE_API_BASE_URL=https://api.questro.io

# 3. Redeploy both frontend and backend after changes
```

#### ❌ Error: "JWT token invalid"
**Symptoms:** Authentication fails, token errors

**Solutions:**
```bash
# 1. Generate new JWT secrets (must be consistent)
openssl rand -base64 48

# 2. Update both JWT_SECRET and JWT_REFRESH_SECRET in Render

# 3. Clear browser localStorage and try again
# In browser console:
localStorage.clear()
```

### 2. Frontend Issues

#### ❌ Error: "Build failed - TypeScript errors"
**Symptoms:** Netlify build fails with TS errors

**Solutions:**
```bash
# 1. Fix TypeScript errors locally first
cd frontend
npm run type-check

# 2. Update tsconfig.json if needed
{
  "compilerOptions": {
    "strict": false,  // Temporary fix
    "skipLibCheck": true
  }
}

# 3. Or disable type checking in build (not recommended)
# In package.json:
"build": "vite build --mode production"
```

#### ❌ Error: "Environment variables not defined"
**Symptoms:** App loads but API calls fail, config errors

**Solutions:**
1. **Check Netlify environment variables:**
   - Go to Site settings → Environment variables
   - Verify all VITE_ prefixed variables are set
   - Redeploy after adding variables

2. **Test environment variables:**
   ```javascript
   // Add to frontend temporarily
   console.log('API URL:', import.meta.env.VITE_API_BASE_URL);
   console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
   ```

#### ❌ Error: "Page not found (404) on refresh"
**Symptoms:** Direct URLs return 404, routing broken

**Solutions:**
```toml
# Ensure netlify.toml has SPA fallback:
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3. DNS and Domain Issues

#### ❌ Error: "DNS_PROBE_FINISHED_NXDOMAIN"
**Symptoms:** Domains don't resolve

**Solutions:**
1. **Check DNS records:**
   ```bash
   # Test DNS resolution
   nslookup questro.io
   nslookup app.questro.io
   nslookup api.questro.io
   
   # Should return the correct CNAME targets
   ```

2. **Verify CNAME records:**
   ```dns
   # Correct format:
   CNAME  questro.io      xyz.netlify.app
   CNAME  app.questro.io  abc.netlify.app  
   CNAME  api.questro.io  def.onrender.com
   ```

3. **Wait for propagation:**
   - DNS changes can take 24-48 hours
   - Use [whatsmydns.net](https://whatsmydns.net) to check propagation

#### ❌ Error: "SSL certificate invalid"
**Symptoms:** HTTPS shows security warnings

**Solutions:**
1. **Wait for automatic SSL:**
   - Netlify: Usually 1-2 hours after DNS
   - Render: Usually 1-2 hours after DNS

2. **Force SSL renewal:**
   - Netlify: Site settings → Domain management → Renew certificate
   - Render: Settings → Custom domains → Refresh

3. **Check domain verification:**
   - Ensure DNS points to correct targets
   - Remove and re-add custom domain if needed

### 4. Supabase Issues

#### ❌ Error: "Row Level Security violation"
**Symptoms:** Database queries fail with RLS errors

**Solutions:**
```sql
-- 1. Check RLS policies in Supabase SQL Editor
SELECT * FROM pg_policies WHERE tablename = 'users';

-- 2. Create missing policies
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Temporarily disable RLS for testing (NOT for production)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
```

#### ❌ Error: "Supabase project paused"
**Symptoms:** All database operations fail

**Solutions:**
1. **Check project status:**
   - Go to Supabase dashboard
   - Look for "Project paused" message
   - Unpause project (may require upgrade)

2. **Check project limits:**
   - Free tier has usage limits
   - Upgrade to paid plan if needed

### 5. Build and Deployment Issues

#### ❌ Error: "Module not found"
**Symptoms:** Import errors in production

**Solutions:**
```bash
# 1. Check file path casing (case-sensitive in production)
# Wrong: import Component from './component'
# Right: import Component from './Component'

# 2. Verify dependencies are installed
npm install missing-dependency

# 3. Check relative imports
# Wrong: import '../../../component'
# Better: import '@/components/Component'
```

#### ❌ Error: "Out of memory during build"
**Symptoms:** Build fails with memory errors

**Solutions:**
```bash
# 1. Increase Node.js memory limit
"scripts": {
  "build": "NODE_OPTIONS='--max-old-space-size=4096' vite build"
}

# 2. Optimize bundle size
# Remove unused dependencies
npm prune

# 3. Use production build only
NODE_ENV=production npm run build
```

### 6. Performance Issues

#### ❌ Issue: "Slow page load times"
**Symptoms:** Pages take >5 seconds to load

**Solutions:**
1. **Optimize images:**
   ```bash
   # Compress images before deployment
   # Use WebP format when possible
   # Implement lazy loading
   ```

2. **Enable CDN:**
   - Netlify automatically provides CDN
   - Verify assets are served from CDN

3. **Check bundle size:**
   ```bash
   cd frontend
   npm run build
   # Check dist/ folder size
   # Should be <10MB total
   ```

#### ❌ Issue: "API responses slow"
**Symptoms:** API calls take >2 seconds

**Solutions:**
1. **Check database queries:**
   ```sql
   -- Add indexes for commonly queried fields
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_projects_user_id ON projects(user_id);
   ```

2. **Monitor Render metrics:**
   - Check CPU and memory usage
   - Upgrade plan if consistently high

3. **Implement caching:**
   ```javascript
   // Add Redis caching for frequent queries
   const cached = await redis.get(key);
   if (cached) return JSON.parse(cached);
   ```

## 🔧 Debug Tools and Commands

### Check Service Health
```bash
# Test all endpoints
curl -I https://questro.io
curl -I https://app.questro.io  
curl https://api.questro.io/health

# Test with verbose output
curl -v https://api.questro.io/health
```

### Check DNS Resolution
```bash
# Check DNS from different locations
dig questro.io
dig app.questro.io
dig api.questro.io

# Check DNS propagation
nslookup questro.io 8.8.8.8
nslookup questro.io 1.1.1.1
```

### Monitor Logs
```bash
# Render logs (in dashboard)
# Look for: "Logs" tab in service dashboard

# Netlify logs (in dashboard) 
# Look for: "Functions" tab, then "View logs"

# Browser console logs
# Check for JavaScript errors and network failures
```

### Test API Manually
```bash
# Test API endpoints
curl -X POST https://api.questro.io/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.questro.io/api/projects
```

## 📞 Getting Help

### 1. Platform Support
- **Render**: [render.com/docs](https://render.com/docs)
- **Netlify**: [docs.netlify.com](https://docs.netlify.com)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)

### 2. Community Resources
- **Stack Overflow**: Tag questions with platform names
- **Discord Communities**: Join platform Discord servers
- **GitHub Issues**: Check platform GitHub repositories

### 3. Log Collection
When asking for help, include:
```bash
# System information
node --version
npm --version
git --version

# Error messages (exact text)
# Browser console errors
# Platform dashboard logs
# Build/deployment logs
```

### 4. Emergency Rollback
If deployment breaks production:
```bash
# Rollback to previous deployment
# Netlify: Dashboard → Deploys → Previous version → Publish
# Render: Dashboard → Events → Previous deployment → Deploy

# Rollback DNS (if needed)
# Change DNS records back to previous values
```

## ✅ Prevention Checklist

Before each deployment:
- [ ] Test locally with production environment variables
- [ ] Run all tests and linting
- [ ] Check for TypeScript errors
- [ ] Verify environment variables are set
- [ ] Test API endpoints manually
- [ ] Check database connections
- [ ] Verify CORS configuration
- [ ] Test authentication flows
- [ ] Check DNS records are correct
- [ ] Monitor performance metrics

**Remember**: Always test changes in a staging environment first!