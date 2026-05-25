# Environment Setup Guide

This guide explains how to configure environment variables for LunaOS Luna Studio across different deployment environments.

## Overview

Luna Studio uses environment variables to manage configuration across development, staging, and production environments. This approach ensures:

- No hardcoded secrets in source code
- Environment-specific behavior
- Easy configuration management
- Secure credential handling

## Environment Variables

All environment variables are prefixed with `VITE_` to be accessible in the Vite build process.

### Required Variables

#### `VITE_NODE_ENV`
- **Description**: Current environment
- **Options**: `development`, `staging`, `production`
- **Default**: `development`
- **Example**: `VITE_NODE_ENV=production`

#### `VITE_API_URL`
- **Description**: Backend API base URL
- **Development**: `http://localhost:8000`
- **Staging**: `https://api-staging.lunaos.ai`
- **Production**: `https://api.lunaos.ai`
- **Example**: `VITE_API_URL=https://api.lunaos.ai`

### Optional Variables

#### Monitoring and Error Tracking

##### `VITE_SENTRY_DSN`
- **Description**: Sentry Data Source Name for error tracking
- **Required for**: Production (recommended)
- **Get from**: https://sentry.io
- **Example**: `VITE_SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/123456`

##### `VITE_DATADOG_APP_ID`
- **Description**: DataDog Application ID for RUM
- **Required for**: Production (optional)
- **Get from**: https://datadoghq.com
- **Example**: `VITE_DATADOG_APP_ID=abc-123-def-456`

##### `VITE_DATADOG_CLIENT_TOKEN`
- **Description**: DataDog Client Token for RUM
- **Required for**: Production (optional)
- **Get from**: https://datadoghq.com
- **Example**: `VITE_DATADOG_CLIENT_TOKEN=pub123abc456def`

#### Feature Flags

##### `VITE_ENABLE_AI_ASSISTANT`
- **Description**: Enable AI assistant features
- **Options**: `true`, `false`
- **Default**: `true`
- **Example**: `VITE_ENABLE_AI_ASSISTANT=true`

##### `VITE_ENABLE_COLLABORATION`
- **Description**: Enable real-time collaboration
- **Options**: `true`, `false`
- **Default**: `true`
- **Example**: `VITE_ENABLE_COLLABORATION=true`

##### `VITE_ENABLE_GAMIFICATION`
- **Description**: Enable gamification features
- **Options**: `true`, `false`
- **Default**: `false`
- **Example**: `VITE_ENABLE_GAMIFICATION=false`

#### Logging and Analytics

##### `VITE_LOG_LEVEL`
- **Description**: Logging verbosity level
- **Options**: `debug`, `info`, `warn`, `error`
- **Development**: `debug`
- **Staging**: `info`
- **Production**: `warn`
- **Example**: `VITE_LOG_LEVEL=warn`

##### `VITE_ENABLE_ANALYTICS`
- **Description**: Enable usage analytics
- **Options**: `true`, `false`
- **Default**: `false` (development), `true` (production)
- **Example**: `VITE_ENABLE_ANALYTICS=true`

## Setup Instructions

### Local Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your local settings:
   ```bash
   VITE_NODE_ENV=development
   VITE_API_URL=http://localhost:8000
   VITE_LOG_LEVEL=debug
   VITE_ENABLE_ANALYTICS=false
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Staging Environment

For Netlify staging deployment:

1. Go to Netlify Dashboard → Site Settings → Environment Variables

2. Add the following variables:
   ```
   VITE_NODE_ENV=staging
   VITE_API_URL=https://api-staging.lunaos.ai
   VITE_SENTRY_DSN=<your-sentry-dsn>
   VITE_LOG_LEVEL=info
   VITE_ENABLE_ANALYTICS=true
   VITE_ENABLE_AI_ASSISTANT=true
   VITE_ENABLE_COLLABORATION=true
   VITE_ENABLE_GAMIFICATION=true
   ```

3. Redeploy the site for changes to take effect

### Production Environment

For Netlify production deployment:

1. Go to Netlify Dashboard → Site Settings → Environment Variables

2. Add the following variables:
   ```
   VITE_NODE_ENV=production
   VITE_API_URL=https://api.lunaos.ai
   VITE_SENTRY_DSN=<your-production-sentry-dsn>
   VITE_DATADOG_APP_ID=<your-datadog-app-id>
   VITE_DATADOG_CLIENT_TOKEN=<your-datadog-token>
   VITE_LOG_LEVEL=warn
   VITE_ENABLE_ANALYTICS=true
   VITE_ENABLE_AI_ASSISTANT=true
   VITE_ENABLE_COLLABORATION=true
   VITE_ENABLE_GAMIFICATION=true
   ```

3. Redeploy the site for changes to take effect

## Configuration Validation

The application automatically validates configuration on startup:

- **Errors**: Will prevent the application from starting
- **Warnings**: Will be logged but won't prevent startup

### Common Validation Errors

1. **Missing API URL**
   ```
   Error: API URL is required
   ```
   Solution: Set `VITE_API_URL` environment variable

2. **HTTP in Production**
   ```
   Error: API URL must use HTTPS in production
   ```
   Solution: Use HTTPS URL for production API

3. **HTTPS Not Enforced**
   ```
   Error: HTTPS must be enforced in production
   ```
   Solution: This is automatically enforced, check environment setting

### Common Validation Warnings

1. **Missing Sentry DSN**
   ```
   Warning: Sentry DSN not configured for production
   ```
   Solution: Add Sentry DSN for error tracking (recommended)

2. **Debug Logging in Production**
   ```
   Warning: Debug logging enabled in production
   ```
   Solution: Set `VITE_LOG_LEVEL=warn` for production

## Accessing Configuration in Code

### ES Modules

```javascript
import { config } from './config/index.js';

// Check environment
if (config.isProduction) {
  // Production-specific code
}

// Use API URL
const response = await fetch(`${config.apiUrl}/endpoint`);

// Check feature flags
if (config.featureFlags.aiAssistant) {
  // Enable AI assistant
}
```

### Global Access

```javascript
// Configuration is available globally
const apiUrl = window.appConfig.apiUrl;
const isProduction = window.appConfig.isProduction;
```

## Security Best Practices

1. **Never commit `.env` files**
   - `.env` is in `.gitignore`
   - Only commit `.env.example` with placeholder values

2. **Use different credentials per environment**
   - Separate Sentry projects for staging/production
   - Different API keys for each environment

3. **Rotate credentials regularly**
   - Update Sentry DSN periodically
   - Rotate API tokens every 90 days

4. **Limit access to production credentials**
   - Only senior team members should have access
   - Use Netlify's team permissions

5. **Monitor for exposed secrets**
   - Use GitHub secret scanning
   - Regular security audits

## Troubleshooting

### Environment variables not loading

**Problem**: Changes to environment variables don't take effect

**Solutions**:
1. Restart the development server
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Rebuild: `npm run build`

### Configuration validation fails

**Problem**: Application won't start due to validation errors

**Solutions**:
1. Check console for specific error messages
2. Verify all required variables are set
3. Ensure values match expected format
4. Check `.env` file syntax (no spaces around `=`)

### Feature flags not working

**Problem**: Features don't enable/disable as expected

**Solutions**:
1. Verify environment variable is set to `true` or `false` (lowercase)
2. Check browser console for configuration object
3. Clear browser cache and reload
4. Verify Netlify environment variables are set correctly

## Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [Sentry Setup Guide](https://docs.sentry.io/platforms/javascript/)
- [DataDog RUM Setup](https://docs.datadoghq.com/real_user_monitoring/)
