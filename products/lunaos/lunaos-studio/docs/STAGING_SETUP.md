# Staging Environment Setup

This document describes how to set up and configure the staging environment for Luna Studio.

## Overview

The staging environment is a pre-production environment that mirrors production as closely as possible. It's used for:
- Testing new features before production deployment
- Integration testing with backend services
- Performance testing under production-like conditions
- User acceptance testing (UAT)

## Netlify Staging Site Setup

### 1. Create Staging Site

1. Log in to [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Branch**: `develop`
5. Click "Deploy site"

### 2. Configure Site Settings

1. Go to Site settings → General
2. Change site name to something like `lunaos-studio-staging`
3. Note the Site ID (you'll need this for GitHub Actions)

### 3. Set Environment Variables

Go to Site settings → Environment variables and add:

```
NODE_ENV=staging
VITE_API_URL=https://api-staging.lunaos.ai
VITE_SENTRY_DSN=<your-staging-sentry-dsn>
VITE_SENTRY_ENVIRONMENT=staging
VITE_LOG_LEVEL=info
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
VITE_FEATURE_AI_ASSISTANT=true
VITE_FEATURE_COLLABORATION=true
VITE_FEATURE_GAMIFICATION=true
VITE_ENABLE_SERVICE_WORKER=true
VITE_ENABLE_CODE_SPLITTING=true
VITE_MAX_CACHE_SIZE=52428800
```

### 4. Configure Deploy Contexts

The `netlify.toml` file already includes staging context configuration:
- `develop` branch deploys to staging
- Deploy previews use staging configuration
- Branch deploys use staging configuration

## GitHub Secrets Setup

Add the following secrets to your GitHub repository:

1. Go to Settings → Secrets and variables → Actions
2. Add the following secrets:

### Required Secrets

- `NETLIFY_AUTH_TOKEN`: Your Netlify personal access token
  - Get from: Netlify → User settings → Applications → Personal access tokens
  
- `NETLIFY_STAGING_SITE_ID`: Your staging site ID
  - Get from: Netlify → Site settings → General → Site details → API ID

- `NETLIFY_SITE_ID`: Your production site ID (for production deployments)

### Optional Secrets

- `SENTRY_DSN`: Sentry DSN for error tracking
- `LHCI_GITHUB_APP_TOKEN`: Lighthouse CI GitHub app token

## Deployment Workflow

### Automatic Deployments

Staging deployments happen automatically when:
1. Code is pushed to the `develop` branch
2. Pull requests are created (deploy previews)

### Manual Deployment

To manually deploy to staging:

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to staging site
netlify link --id=<STAGING_SITE_ID>

# Deploy
npm run build
netlify deploy --prod
```

## Testing Staging Deployment

After deployment, verify the staging environment:

### 1. Smoke Tests

```bash
# Check if site is accessible
curl -f https://lunaos-studio-staging.netlify.app

# Check API connectivity
curl -f https://lunaos-studio-staging.netlify.app/health
```

### 2. Manual Testing Checklist

- [ ] Application loads without errors
- [ ] Can create a new workflow
- [ ] Can add nodes to canvas
- [ ] Can connect nodes
- [ ] Can execute workflow
- [ ] Can save workflow
- [ ] Can load workflow
- [ ] Error tracking is working (check Sentry)
- [ ] Analytics are being collected

### 3. Performance Testing

```bash
# Run Lighthouse CI against staging
npm run test:performance -- --url=https://lunaos-studio-staging.netlify.app
```

## Monitoring Staging

### Netlify Dashboard

Monitor deployments at:
- https://app.netlify.com/sites/lunaos-studio-staging/deploys

### Sentry

Monitor errors at:
- https://sentry.io/organizations/lunaos/projects/luna-studio-staging/

### Logs

View deployment logs:
```bash
netlify logs --site-id=<STAGING_SITE_ID>
```

## Troubleshooting

### Deployment Fails

1. Check GitHub Actions logs
2. Verify environment variables are set correctly
3. Check Netlify build logs
4. Ensure all dependencies are in package.json

### Site Not Loading

1. Check Netlify deploy status
2. Verify DNS/domain settings
3. Check browser console for errors
4. Verify CSP headers aren't blocking resources

### API Connection Issues

1. Verify VITE_API_URL is correct
2. Check CORS settings on backend
3. Verify API is accessible from staging domain
4. Check network tab in browser dev tools

## Staging vs Production Differences

| Feature | Staging | Production |
|---------|---------|------------|
| Branch | `develop` | `main` |
| API URL | api-staging.lunaos.ai | api.lunaos.ai |
| Log Level | info | warn |
| Debug Mode | Enabled | Disabled |
| Analytics | Enabled | Enabled |
| Error Tracking | Separate project | Separate project |
| Cache Duration | Shorter | Longer |

## Rollback Procedure

If staging deployment has issues:

### Via Netlify UI
1. Go to Deploys
2. Find previous successful deploy
3. Click "Publish deploy"

### Via CLI
```bash
netlify rollback --site-id=<STAGING_SITE_ID>
```

## Best Practices

1. **Always test in staging first** before merging to main
2. **Keep staging in sync** with production configuration
3. **Monitor staging errors** to catch issues early
4. **Use feature flags** to test features in staging
5. **Run full test suite** before promoting to production
6. **Document any staging-specific quirks** or limitations

## Next Steps

After staging is set up and working:
1. Configure production environment (see DEPLOYMENT.md)
2. Set up monitoring and alerting
3. Create runbooks for common issues
4. Train team on deployment process
