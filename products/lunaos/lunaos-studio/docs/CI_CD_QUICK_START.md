# CI/CD Quick Start Guide

Quick reference for using the Luna Studio CI/CD pipeline.

## 🚀 Quick Commands

### Deploy to Staging
```bash
git checkout develop
git pull
git merge feature/my-feature
git push origin develop
# Automatic deployment to staging
```

### Deploy to Production
```bash
git checkout main
git pull
git merge develop
git push origin main
# Automatic deployment to production (requires approval)
```

### Run Health Check
```bash
./scripts/health-check.sh https://studio.lunaos.ai
```

### Rollback Production
```bash
export NETLIFY_SITE_ID=<your-site-id>
export NETLIFY_AUTH_TOKEN=<your-token>
./scripts/rollback.sh
```

### Test Rollback Setup
```bash
./scripts/test-rollback.sh
```

## 📋 Pre-Deployment Checklist

- [ ] All tests pass locally
- [ ] Code is reviewed and approved
- [ ] Staging deployment successful
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Breaking changes documented

## 🔍 Monitoring After Deployment

1. **Check GitHub Actions**: Verify workflow completed
2. **Run Health Check**: `./scripts/health-check.sh <URL>`
3. **Monitor Errors**: Check Sentry dashboard
4. **Watch Metrics**: Monitor for 30 minutes
5. **Test Features**: Verify core functionality

## 🔄 Rollback Decision Tree

```
Issue Detected?
    ├─ Critical (data loss, security) → Rollback immediately
    ├─ High (major features broken) → Rollback within 15 min
    ├─ Medium (minor features broken) → Evaluate, rollback if needed
    └─ Low (cosmetic issues) → Fix forward
```

## 🆘 Emergency Contacts

- **On-Call Engineer**: [Contact]
- **DevOps Lead**: [Contact]
- **Engineering Manager**: [Contact]

## 📚 Full Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Staging Setup](./STAGING_SETUP.md)
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Deployment Protection](../.github/DEPLOYMENT_PROTECTION.md)
- [Scripts Documentation](../scripts/README.md)

## 🔐 Required Secrets

### GitHub Secrets
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- `NETLIFY_STAGING_SITE_ID`

### Environment Variables
- `VITE_API_URL`
- `VITE_SENTRY_DSN`
- `VITE_DATADOG_APP_ID`
- `VITE_DATADOG_CLIENT_TOKEN`

## ⚡ Common Issues

### Deployment Fails
```bash
# Check logs
gh run view --log

# Retry deployment
gh run rerun <run-id>
```

### Health Check Fails
```bash
# Check site status
curl -I https://studio.lunaos.ai

# Check detailed health
./scripts/health-check.sh https://studio.lunaos.ai
```

### Rollback Needed
```bash
# Quick rollback
./scripts/rollback.sh

# Or via Netlify
netlify rollback
```

## 📊 Key Metrics

- **Deployment Time**: ~10 minutes
- **Rollback Time**: ~5 minutes
- **Health Check Time**: ~30 seconds
- **Test Suite Time**: ~5 minutes

## 🎯 Best Practices

1. **Deploy small changes** - Easier to rollback
2. **Test in staging first** - Catch issues early
3. **Monitor after deploy** - Watch for 30 minutes
4. **Have rollback ready** - Know how to rollback
5. **Communicate changes** - Keep team informed

## 🔧 Troubleshooting

### "Tests Failed"
- Check test output in GitHub Actions
- Run tests locally: `npm test`
- Fix issues and push again

### "Build Failed"
- Check build logs
- Verify dependencies: `npm ci`
- Check for syntax errors: `npm run lint`

### "Deployment Failed"
- Check Netlify logs
- Verify environment variables
- Check Netlify status page

### "Health Check Failed"
- Wait 1 minute and retry
- Check site manually
- Review error logs
- Consider rollback

## 📞 Getting Help

1. Check this guide
2. Review full documentation
3. Check GitHub Actions logs
4. Check Netlify dashboard
5. Contact DevOps team

---

**Last Updated**: November 19, 2024
**Version**: 1.0
