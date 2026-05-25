# Rollback Procedures

This document describes the rollback procedures for Luna Studio deployments.

## Overview

Rollback is the process of reverting to a previous stable deployment when issues are detected in production. Luna Studio implements both automatic and manual rollback procedures to ensure rapid recovery from deployment failures.

## Automatic Rollback

### When Automatic Rollback Triggers

The CI/CD pipeline automatically triggers rollback when:

1. **Health Check Failures**
   - HTTP status is not 200
   - Site is not accessible after 5 retries
   - Response time exceeds 10 seconds

2. **Critical Errors**
   - JavaScript errors prevent app initialization
   - API connectivity failures
   - Missing critical assets

3. **Deployment Failures**
   - Build process fails
   - Deployment to Netlify fails
   - Post-deployment verification fails

### Automatic Rollback Process

```
┌─────────────────────┐
│  Deploy to Prod     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Wait 10 seconds    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Run Health Checks  │
└──────────┬──────────┘
           │
           ▼
      ┌────┴────┐
      │ Pass?   │
      └────┬────┘
           │
    ┌──────┴──────┐
    │             │
   Yes            No
    │             │
    ▼             ▼
┌────────┐  ┌──────────┐
│Success │  │ Rollback │
└────────┘  └──────────┘
```

### Automatic Rollback Implementation

The GitHub Actions workflow includes automatic rollback:

```yaml
- name: Run health check
  id: health-check
  run: |
    ./scripts/health-check.sh ${{ steps.deploy.outputs.deploy-url }}

- name: Rollback on failure
  if: failure() && steps.health-check.outputs.health_status == 'failure'
  uses: netlify/actions/cli@master
  with:
    args: rollback
  env:
    NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
    NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

## Manual Rollback

### When to Use Manual Rollback

Use manual rollback when:

1. **Issues Detected Post-Deployment**
   - User reports of errors
   - Monitoring alerts
   - Performance degradation
   - Security vulnerabilities

2. **Automatic Rollback Failed**
   - Health checks passed but issues exist
   - Rollback script encountered errors
   - Need to rollback to specific version

3. **Emergency Situations**
   - Critical bug in production
   - Data integrity issues
   - Security breach

### Manual Rollback Methods

#### Method 1: Using Rollback Script (Recommended)

```bash
# Set environment variables
export NETLIFY_SITE_ID=<your-site-id>
export NETLIFY_AUTH_TOKEN=<your-auth-token>

# Run rollback script
./scripts/rollback.sh

# Or for staging
./scripts/rollback.sh staging
```

The script will:
1. List recent deployments
2. Identify previous stable deployment
3. Confirm rollback action
4. Perform rollback
5. Verify rollback success

#### Method 2: Using Netlify CLI

```bash
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to site
netlify link --id=<SITE_ID>

# List recent deployments
netlify deploys:list

# Rollback to previous deployment
netlify rollback

# Or rollback to specific deployment
netlify api publishDeploy --deploy-id=<DEPLOY_ID>
```

#### Method 3: Using Netlify Dashboard

1. Go to https://app.netlify.com
2. Select your site
3. Click "Deploys" tab
4. Find the last known good deployment
5. Click the three dots menu
6. Select "Publish deploy"
7. Confirm the action

#### Method 4: Using GitHub Actions

1. Go to GitHub repository
2. Navigate to Actions tab
3. Find the last successful workflow run
4. Click "Re-run jobs"
5. Select "Re-run all jobs"

### Rollback Decision Matrix

| Severity | Response Time | Method | Approval Required |
|----------|--------------|--------|-------------------|
| Critical | Immediate | Netlify Dashboard | No |
| High | < 15 minutes | Rollback Script | Team Lead |
| Medium | < 1 hour | GitHub Actions | Code Owner |
| Low | < 4 hours | Standard Process | Standard Review |

## Rollback Verification

After performing a rollback, verify the following:

### 1. Site Accessibility

```bash
# Check HTTP status
curl -I https://studio.lunaos.ai

# Expected: HTTP/2 200
```

### 2. Run Health Checks

```bash
# Run comprehensive health check
./scripts/health-check.sh https://studio.lunaos.ai
```

### 3. Verify Core Functionality

Manual testing checklist:
- [ ] Application loads without errors
- [ ] Can create new workflow
- [ ] Can add nodes to canvas
- [ ] Can connect nodes
- [ ] Can execute workflow
- [ ] Can save workflow
- [ ] Can load workflow

### 4. Check Error Rates

Monitor Sentry for:
- Error rate should decrease
- No new error types
- User sessions are successful

### 5. Check Performance Metrics

Monitor DataDog/Netlify for:
- Response times return to normal
- No performance degradation
- CDN cache hit rate is normal

## Post-Rollback Actions

### Immediate Actions (Within 1 hour)

1. **Notify Stakeholders**
   ```
   Subject: Production Rollback - Luna Studio
   
   A rollback was performed on Luna Studio production at [TIME].
   
   Reason: [BRIEF DESCRIPTION]
   Current Status: [STABLE/INVESTIGATING]
   Impact: [USER IMPACT]
   Next Steps: [ACTION ITEMS]
   ```

2. **Update Status Page**
   - Mark incident as resolved
   - Provide brief explanation
   - Set next update time

3. **Document Incident**
   - Create incident ticket
   - Record timeline
   - Note affected users
   - Document rollback steps taken

### Short-term Actions (Within 24 hours)

1. **Root Cause Analysis**
   - Identify what went wrong
   - Review logs and errors
   - Analyze deployment diff
   - Identify contributing factors

2. **Create Fix**
   - Develop fix in feature branch
   - Add tests to prevent recurrence
   - Test thoroughly in staging
   - Get code review

3. **Update Monitoring**
   - Add alerts for similar issues
   - Improve health checks
   - Update dashboards

### Long-term Actions (Within 1 week)

1. **Conduct Postmortem**
   - Schedule postmortem meeting
   - Document findings
   - Identify action items
   - Assign owners

2. **Improve Processes**
   - Update deployment checklist
   - Enhance testing procedures
   - Improve documentation
   - Update runbooks

3. **Share Learnings**
   - Share postmortem with team
   - Update training materials
   - Document best practices

## Rollback Testing

### Regular Rollback Drills

Conduct rollback drills quarterly:

1. **Schedule Drill**
   - Announce to team
   - Choose low-traffic time
   - Prepare test plan

2. **Execute Drill**
   - Deploy test version
   - Trigger rollback
   - Time the process
   - Document issues

3. **Review Results**
   - Evaluate response time
   - Identify improvements
   - Update procedures
   - Train team members

### Test Rollback Script

```bash
# Test in staging first
export NETLIFY_SITE_ID=<staging-site-id>
export NETLIFY_AUTH_TOKEN=<auth-token>

# List deployments
./scripts/rollback.sh list

# Check current deployment
./scripts/rollback.sh current

# Check previous deployment
./scripts/rollback.sh previous

# Perform test rollback
./scripts/rollback.sh
```

## Rollback Metrics

Track the following metrics:

### Deployment Metrics
- **MTTR (Mean Time To Rollback)**: Target < 5 minutes
- **Rollback Success Rate**: Target > 99%
- **Rollback Frequency**: Monitor trend
- **Time to Detect Issues**: Target < 5 minutes

### Impact Metrics
- **Users Affected**: Minimize impact
- **Downtime Duration**: Target < 5 minutes
- **Data Loss**: Target zero
- **Revenue Impact**: Track and minimize

## Troubleshooting Rollback Issues

### Rollback Script Fails

**Symptom**: Script exits with error

**Solutions**:
1. Check environment variables are set
2. Verify Netlify CLI is installed
3. Check authentication token is valid
4. Verify site ID is correct
5. Check network connectivity

### Previous Deployment Not Found

**Symptom**: Cannot identify previous deployment

**Solutions**:
1. List all deployments manually
2. Identify last known good deployment
3. Use specific deployment ID
4. Check deployment history in Netlify

### Rollback Completes But Issues Persist

**Symptom**: Rollback successful but problems continue

**Solutions**:
1. Clear CDN cache
2. Check if issue is in backend
3. Verify correct deployment is active
4. Check for cached assets in browser
5. Investigate if issue existed before

### Health Checks Fail After Rollback

**Symptom**: Health checks fail on rolled-back version

**Solutions**:
1. Check if issue is environmental
2. Verify backend services are running
3. Check DNS/CDN configuration
4. Review recent infrastructure changes
5. Consider rolling back further

## Emergency Contacts

### Escalation Path

1. **On-Call Engineer**: [Contact]
2. **DevOps Lead**: [Contact]
3. **Engineering Manager**: [Contact]
4. **CTO**: [Contact]

### External Contacts

- **Netlify Support**: support@netlify.com
- **Sentry Support**: support@sentry.io
- **DataDog Support**: support@datadoghq.com

## Rollback Checklist

Use this checklist for manual rollbacks:

### Pre-Rollback
- [ ] Identify issue and severity
- [ ] Determine rollback is necessary
- [ ] Notify team of rollback decision
- [ ] Identify target deployment version
- [ ] Verify target version is stable

### During Rollback
- [ ] Execute rollback procedure
- [ ] Monitor rollback progress
- [ ] Verify rollback completion
- [ ] Run health checks
- [ ] Test core functionality

### Post-Rollback
- [ ] Notify stakeholders
- [ ] Update status page
- [ ] Document incident
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Create fix plan
- [ ] Schedule postmortem

## Best Practices

1. **Always Have a Rollback Plan** - Before deploying, know how to rollback
2. **Test Rollback Procedures** - Regular drills ensure readiness
3. **Monitor After Rollback** - Watch metrics for 30 minutes
4. **Document Everything** - Record all actions and decisions
5. **Learn from Incidents** - Conduct postmortems
6. **Automate When Possible** - Reduce human error
7. **Keep It Simple** - Complex rollbacks are error-prone
8. **Communicate Clearly** - Keep stakeholders informed
9. **Have Backups** - Multiple rollback methods available
10. **Practice, Practice, Practice** - Familiarity reduces stress

## Related Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Health Check Documentation](./HEALTH_CHECKS.md)
- [Incident Response Plan](./INCIDENT_RESPONSE.md)
- [Monitoring Guide](./MONITORING.md)

## Appendix: Rollback Script Reference

### Environment Variables

```bash
NETLIFY_SITE_ID       # Netlify site ID
NETLIFY_AUTH_TOKEN    # Netlify authentication token
CI                    # Set in CI/CD environment (skips confirmation)
```

### Script Commands

```bash
./scripts/rollback.sh              # Perform rollback
./scripts/rollback.sh list         # List recent deployments
./scripts/rollback.sh current      # Show current deployment
./scripts/rollback.sh previous     # Show previous deployment
```

### Exit Codes

- `0`: Success
- `1`: Failure (general error)
- `2`: Configuration error
- `3`: Verification failed

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial rollback procedures |
| 1.1 | 2024-01-20 | Added automatic rollback |
| 1.2 | 2024-01-25 | Enhanced health checks |
