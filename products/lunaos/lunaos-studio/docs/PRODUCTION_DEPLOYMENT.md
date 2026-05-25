# Production Deployment Guide

This document describes the production deployment process for Luna Studio.

## Overview

Production deployments are automated through GitHub Actions and deploy to Netlify. The process includes:
- Automated testing (lint, unit, integration, E2E)
- Production build optimization
- Automated deployment to Netlify
- Health checks and automatic rollback
- Deployment notifications

## Prerequisites

Before deploying to production, ensure:

1. ✅ All tests pass in staging
2. ✅ Code review is complete
3. ✅ Security scan is clean
4. ✅ Performance benchmarks are met
5. ✅ Documentation is updated
6. ✅ Changelog is updated
7. ✅ Stakeholders are notified

## Production Environment Setup

### 1. Create Production Site on Netlify

1. Log in to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Branch**: `main`
5. Click "Deploy site"

### 2. Configure Custom Domain (Optional)

1. Go to Site settings → Domain management
2. Add custom domain (e.g., `studio.lunaos.ai`)
3. Configure DNS:
   - Add CNAME record pointing to Netlify
   - Or use Netlify DNS
4. Enable HTTPS (automatic with Let's Encrypt)

### 3. Set Environment Variables

Go to Site settings → Environment variables and add:

```
NODE_ENV=production
VITE_API_URL=https://api.lunaos.ai
VITE_SENTRY_DSN=<your-production-sentry-dsn>
VITE_SENTRY_ENVIRONMENT=production
VITE_LOG_LEVEL=warn
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
VITE_FEATURE_AI_ASSISTANT=true
VITE_FEATURE_COLLABORATION=true
VITE_FEATURE_GAMIFICATION=true
VITE_ENABLE_SERVICE_WORKER=true
VITE_ENABLE_CODE_SPLITTING=true
VITE_MAX_CACHE_SIZE=52428800
VITE_ENABLE_CSP=true
VITE_ENABLE_HSTS=true
```

### 4. Configure Deployment Protection

1. Go to Site settings → Build & deploy → Deploy contexts
2. Enable "Lock deploys" for production branch
3. Set up deploy notifications:
   - Email notifications
   - Slack webhook (optional)
   - GitHub status checks

### 5. Set Up GitHub Environment Protection

1. Go to GitHub repository → Settings → Environments
2. Create "production" environment
3. Configure protection rules:
   - ✅ Required reviewers (at least 1)
   - ✅ Wait timer (optional, e.g., 5 minutes)
   - ✅ Deployment branches: `main` only
4. Add environment secrets:
   - `NETLIFY_SITE_ID`
   - `NETLIFY_AUTH_TOKEN`

## Deployment Process

### Automatic Deployment

Production deployments happen automatically when code is merged to `main`:

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push to GitHub
git push origin feature/my-feature

# 4. Create pull request to main
# 5. Wait for CI checks to pass
# 6. Get code review approval
# 7. Merge to main

# 8. GitHub Actions automatically:
#    - Runs all tests
#    - Builds production assets
#    - Deploys to production
#    - Runs health checks
#    - Rolls back if health checks fail
```

### Manual Deployment

For emergency deployments or hotfixes:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to production site
netlify link --id=<PRODUCTION_SITE_ID>

# Build and deploy
npm run build
netlify deploy --prod

# Verify deployment
curl -f https://studio.lunaos.ai
```

## Deployment Checklist

Before merging to main:

### Pre-Deployment
- [ ] All tests pass locally
- [ ] Code is reviewed and approved
- [ ] Staging deployment is successful
- [ ] Manual testing completed in staging
- [ ] Performance tests pass
- [ ] Security scan is clean
- [ ] Breaking changes are documented
- [ ] Migration scripts are ready (if needed)
- [ ] Rollback plan is documented

### During Deployment
- [ ] Monitor GitHub Actions workflow
- [ ] Watch for build errors
- [ ] Check deployment logs
- [ ] Monitor health check status

### Post-Deployment
- [ ] Verify site is accessible
- [ ] Run smoke tests
- [ ] Check error rates in Sentry
- [ ] Monitor performance metrics
- [ ] Verify analytics are working
- [ ] Check user-facing features
- [ ] Update status page (if applicable)
- [ ] Notify stakeholders

## Health Checks

The deployment pipeline includes automated health checks:

### 1. HTTP Status Check
```bash
curl -f https://studio.lunaos.ai
# Expected: HTTP 200
```

### 2. API Connectivity Check
```bash
curl -f https://studio.lunaos.ai/health
# Expected: {"status": "ok"}
```

### 3. Critical Path Check
- Application loads without errors
- Main navigation is functional
- Core features are accessible

### 4. Performance Check
- First Contentful Paint < 2s
- Time to Interactive < 3.5s
- No JavaScript errors in console

## Rollback Procedures

### Automatic Rollback

The deployment pipeline automatically rolls back if:
- Health checks fail
- HTTP status is not 200
- Critical errors are detected

### Manual Rollback

If you need to manually rollback:

#### Via Netlify UI
1. Go to https://app.netlify.com/sites/lunaos-studio/deploys
2. Find the last known good deployment
3. Click "Publish deploy"
4. Confirm rollback

#### Via Netlify CLI
```bash
# List recent deployments
netlify deploys:list --site-id=<PRODUCTION_SITE_ID>

# Rollback to previous deployment
netlify rollback --site-id=<PRODUCTION_SITE_ID>

# Or rollback to specific deployment
netlify deploy:publish <DEPLOY_ID> --site-id=<PRODUCTION_SITE_ID>
```

#### Via GitHub Actions
1. Go to Actions → Deploy Luna Studio
2. Find the last successful workflow run
3. Click "Re-run jobs"
4. Select "Re-run failed jobs" or "Re-run all jobs"

### Post-Rollback Actions
1. Investigate root cause
2. Fix the issue in a new branch
3. Test thoroughly in staging
4. Create new deployment
5. Document incident in postmortem

## Monitoring Production

### Real-Time Monitoring

**Netlify Dashboard**
- https://app.netlify.com/sites/lunaos-studio/deploys
- Monitor deployment status
- View build logs
- Check bandwidth usage

**Sentry**
- https://sentry.io/organizations/lunaos/projects/luna-studio/
- Monitor error rates
- Track performance issues
- View user sessions

**DataDog (if configured)**
- Monitor real user metrics
- Track performance trends
- Set up custom dashboards

### Key Metrics to Monitor

**Availability**
- Target: 99.9% uptime
- Alert if: < 99% for 5 minutes

**Performance**
- Target: P95 load time < 3s
- Alert if: P95 > 5s for 5 minutes

**Errors**
- Target: Error rate < 1%
- Alert if: Error rate > 5% for 5 minutes

**Traffic**
- Monitor daily active users
- Track page views
- Monitor API calls

## Deployment Schedule

### Regular Deployments
- **Frequency**: As needed (continuous deployment)
- **Timing**: During business hours (9 AM - 5 PM EST)
- **Blackout periods**: Avoid Fridays and holidays

### Emergency Deployments
- **Process**: Follow hotfix procedure
- **Approval**: Requires on-call engineer approval
- **Communication**: Notify team immediately

### Maintenance Windows
- **Frequency**: Monthly (first Sunday)
- **Duration**: 2 hours
- **Notification**: 1 week advance notice

## Troubleshooting

### Deployment Fails

**Symptom**: GitHub Actions workflow fails

**Solutions**:
1. Check workflow logs for errors
2. Verify all tests pass locally
3. Check environment variables
4. Verify Netlify credentials
5. Check build command and settings

### Site Not Accessible

**Symptom**: 404 or 500 errors

**Solutions**:
1. Check Netlify deploy status
2. Verify DNS settings
3. Check CDN cache
4. Clear browser cache
5. Check for CSP violations

### Health Check Fails

**Symptom**: Automatic rollback triggered

**Solutions**:
1. Check application logs
2. Verify API connectivity
3. Check for JavaScript errors
4. Verify environment variables
5. Test locally with production config

### Performance Degradation

**Symptom**: Slow load times

**Solutions**:
1. Check CDN cache hit rate
2. Verify asset compression
3. Check for large bundle sizes
4. Monitor API response times
5. Check for memory leaks

## Security Considerations

### Pre-Deployment Security Checks
- [ ] Dependencies are up to date
- [ ] No known vulnerabilities (npm audit)
- [ ] Secrets are not in code
- [ ] CSP headers are configured
- [ ] HTTPS is enforced
- [ ] Input sanitization is working

### Post-Deployment Security Verification
- [ ] Security headers are present
- [ ] HTTPS is working
- [ ] CSP is not blocking legitimate resources
- [ ] No sensitive data in logs
- [ ] Authentication is working

## Compliance and Auditing

### Deployment Logs
- All deployments are logged in GitHub Actions
- Netlify maintains deployment history
- Audit trail is available for compliance

### Change Management
- All changes require pull request
- Code review is mandatory
- Deployment approval is required
- Rollback capability is maintained

## Emergency Contacts

**On-Call Engineer**: [Contact info]
**DevOps Lead**: [Contact info]
**Product Owner**: [Contact info]
**Security Team**: [Contact info]

## Related Documentation

- [Staging Setup](./STAGING_SETUP.md)
- [Monitoring Guide](./MONITORING.md)
- [Incident Response](./INCIDENT_RESPONSE.md)
- [Architecture Overview](./ARCHITECTURE.md)

## Changelog

Document all production deployments:

```markdown
## [1.2.0] - 2024-01-15
### Added
- New workflow templates
- AI assistant integration

### Changed
- Improved canvas performance
- Updated dependencies

### Fixed
- Node connection bug
- Memory leak in workflow engine
```

## Best Practices

1. **Deploy small, deploy often** - Smaller changes are easier to rollback
2. **Test in staging first** - Always verify in staging before production
3. **Monitor after deployment** - Watch metrics for 30 minutes post-deploy
4. **Communicate changes** - Keep stakeholders informed
5. **Document everything** - Update docs with each deployment
6. **Have a rollback plan** - Know how to rollback before deploying
7. **Use feature flags** - Enable gradual rollouts
8. **Automate everything** - Reduce human error
9. **Learn from incidents** - Conduct postmortems
10. **Keep it simple** - Complexity increases risk
