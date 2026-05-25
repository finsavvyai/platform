# Deployment Scripts

This directory contains scripts for deployment, health checks, and rollback procedures.

## Scripts Overview

### health-check.sh

Performs comprehensive health checks on a deployed application.

**Usage:**
```bash
./scripts/health-check.sh <URL>
```

**Example:**
```bash
# Check production
./scripts/health-check.sh https://studio.lunaos.ai

# Check staging
./scripts/health-check.sh https://lunaos-studio-staging.netlify.app

# Check local development
./scripts/health-check.sh http://localhost:5173
```

**Health Checks Performed:**
1. HTTP Status Check (200 OK)
2. Response Time Check (< 5s)
3. Content Check (expected content present)
4. JavaScript Loading Check
5. CSS Loading Check
6. Security Headers Check
7. HTTPS Check
8. Asset Loading Check
9. Favicon Check
10. Compression Check

**Exit Codes:**
- `0`: All health checks passed
- `1`: One or more critical health checks failed

### rollback.sh

Performs rollback to a previous deployment on Netlify.

**Prerequisites:**
- Netlify CLI installed: `npm install -g netlify-cli`
- Environment variables set:
  - `NETLIFY_SITE_ID`: Your Netlify site ID
  - `NETLIFY_AUTH_TOKEN`: Your Netlify authentication token

**Usage:**
```bash
# Perform rollback
./scripts/rollback.sh

# List recent deployments
./scripts/rollback.sh list

# Show current deployment
./scripts/rollback.sh current

# Show previous deployment
./scripts/rollback.sh previous
```

**Example:**
```bash
# Set environment variables
export NETLIFY_SITE_ID=abc123def456
export NETLIFY_AUTH_TOKEN=your-token-here

# Perform rollback
./scripts/rollback.sh
```

**Rollback Process:**
1. Fetches deployment information
2. Identifies previous stable deployment
3. Confirms rollback action (unless in CI)
4. Performs rollback via Netlify API
5. Verifies rollback success with health checks

**Exit Codes:**
- `0`: Rollback successful
- `1`: Rollback failed

### test-rollback.sh

Tests rollback procedures and verifies configuration.

**Usage:**
```bash
./scripts/test-rollback.sh
```

**Tests Performed:**
1. Rollback script existence
2. Rollback script permissions
3. Health check script existence
4. Health check script permissions
5. Netlify CLI installation
6. Environment variables documentation
7. Rollback documentation
8. GitHub Actions rollback configuration
9. Health check integration
10. Rollback script syntax validation
11. Health check script syntax validation
12. jq installation (required for rollback)
13. curl installation (required for health checks)
14. Health check functionality
15. Deployment protection documentation

**Exit Codes:**
- `0`: All tests passed
- `1`: One or more tests failed

## Environment Variables

### Required for Rollback

```bash
# Production site
export NETLIFY_SITE_ID=your-production-site-id
export NETLIFY_AUTH_TOKEN=your-netlify-auth-token

# Staging site (optional)
export NETLIFY_STAGING_SITE_ID=your-staging-site-id
```

### Getting Netlify Credentials

**Site ID:**
1. Go to https://app.netlify.com
2. Select your site
3. Go to Site settings → General
4. Find "API ID" under Site details

**Auth Token:**
1. Go to https://app.netlify.com
2. Click your avatar → User settings
3. Go to Applications → Personal access tokens
4. Click "New access token"
5. Give it a name and create

## Dependencies

### Required

- **bash**: Shell interpreter (pre-installed on macOS/Linux)
- **curl**: HTTP client (pre-installed on macOS/Linux)
- **Netlify CLI**: `npm install -g netlify-cli`

### Optional but Recommended

- **jq**: JSON processor (required for rollback script)
  - macOS: `brew install jq`
  - Linux: `apt-get install jq` or `yum install jq`
- **bc**: Calculator (for response time calculations)
  - Usually pre-installed on macOS/Linux

## Usage in CI/CD

### GitHub Actions

The scripts are integrated into the GitHub Actions workflow:

```yaml
# Health check after deployment
- name: Run health check
  run: ./scripts/health-check.sh ${{ steps.deploy.outputs.deploy-url }}

# Automatic rollback on failure
- name: Rollback on failure
  if: failure()
  run: ./scripts/rollback.sh
  env:
    NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

### Manual Deployment

```bash
# 1. Build the application
npm run build

# 2. Deploy to Netlify
netlify deploy --prod --dir=dist

# 3. Run health check
./scripts/health-check.sh https://studio.lunaos.ai

# 4. If issues detected, rollback
./scripts/rollback.sh
```

## Troubleshooting

### Health Check Fails

**Issue**: Health check script exits with error

**Solutions:**
1. Verify URL is correct and accessible
2. Check if site is actually deployed
3. Verify network connectivity
4. Check if site requires authentication
5. Review specific failed checks in output

### Rollback Script Fails

**Issue**: Rollback script exits with error

**Solutions:**
1. Verify environment variables are set:
   ```bash
   echo $NETLIFY_SITE_ID
   echo $NETLIFY_AUTH_TOKEN
   ```
2. Check Netlify CLI is installed:
   ```bash
   netlify --version
   ```
3. Verify authentication:
   ```bash
   netlify status
   ```
4. Check if jq is installed:
   ```bash
   jq --version
   ```

### Permission Denied

**Issue**: Cannot execute scripts

**Solution:**
```bash
chmod +x scripts/*.sh
```

### Command Not Found

**Issue**: Script dependencies not found

**Solutions:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Install jq (macOS)
brew install jq

# Install jq (Linux)
sudo apt-get install jq
```

## Best Practices

1. **Test in Staging First**
   - Always test scripts in staging before production
   - Verify health checks work with your deployment

2. **Regular Testing**
   - Run `test-rollback.sh` regularly
   - Conduct rollback drills quarterly
   - Keep scripts updated

3. **Monitor After Deployment**
   - Run health checks after every deployment
   - Monitor for 30 minutes post-deployment
   - Keep rollback ready

4. **Document Changes**
   - Update scripts when deployment process changes
   - Document any environment-specific modifications
   - Keep README up to date

5. **Security**
   - Never commit auth tokens to git
   - Use environment variables for secrets
   - Rotate tokens regularly
   - Use least-privilege access

## Script Maintenance

### Updating Scripts

When updating scripts:
1. Test changes locally first
2. Validate syntax: `bash -n script.sh`
3. Test in staging environment
4. Update documentation
5. Commit changes with clear message

### Adding New Checks

To add new health checks:
1. Add check function to `health-check.sh`
2. Follow existing pattern
3. Update documentation
4. Test thoroughly
5. Update test script if needed

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial scripts |
| 1.1 | 2024-01-20 | Added rollback script |
| 1.2 | 2024-01-25 | Enhanced health checks |

## Related Documentation

- [Production Deployment Guide](../docs/PRODUCTION_DEPLOYMENT.md)
- [Rollback Procedures](../docs/ROLLBACK_PROCEDURES.md)
- [Staging Setup](../docs/STAGING_SETUP.md)
- [Deployment Protection](../.github/DEPLOYMENT_PROTECTION.md)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review related documentation
3. Check GitHub Actions logs
4. Contact DevOps team
5. Create issue in repository

## Contributing

When contributing to scripts:
1. Follow existing code style
2. Add comments for complex logic
3. Update documentation
4. Test thoroughly
5. Submit pull request with description
