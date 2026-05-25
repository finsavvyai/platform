# Deployment Protection Rules

This document describes how to configure deployment protection rules for Luna Studio.

## GitHub Environment Protection

### Setting Up Production Environment

1. Go to your GitHub repository
2. Navigate to **Settings** → **Environments**
3. Click **New environment**
4. Name it `production`
5. Configure the following protection rules:

#### Required Reviewers
- Enable "Required reviewers"
- Add at least 1 reviewer
- Recommended: Add 2+ reviewers for critical deployments

#### Wait Timer (Optional)
- Enable "Wait timer"
- Set to 5-10 minutes
- Allows time to cancel deployment if needed

#### Deployment Branches
- Select "Selected branches"
- Add rule: `main`
- This ensures only main branch can deploy to production

### Setting Up Staging Environment

1. Create another environment named `staging`
2. Configure protection rules:
   - No required reviewers (for faster iteration)
   - Deployment branches: `develop`

### Environment Secrets

Add the following secrets to each environment:

#### Production Environment Secrets
```
NETLIFY_SITE_ID=<production-site-id>
NETLIFY_AUTH_TOKEN=<netlify-auth-token>
SENTRY_DSN=<production-sentry-dsn>
DATADOG_APP_ID=<production-datadog-app-id>
DATADOG_CLIENT_TOKEN=<production-datadog-token>
```

#### Staging Environment Secrets
```
NETLIFY_STAGING_SITE_ID=<staging-site-id>
NETLIFY_AUTH_TOKEN=<netlify-auth-token>
SENTRY_DSN=<staging-sentry-dsn>
DATADOG_APP_ID=<staging-datadog-app-id>
DATADOG_CLIENT_TOKEN=<staging-datadog-token>
```

## Branch Protection Rules

### Main Branch Protection

1. Go to **Settings** → **Branches**
2. Add rule for `main` branch
3. Enable the following:

#### Required Status Checks
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- Select required checks:
  - `lint`
  - `test`
  - `e2e`
  - `build`

#### Pull Request Reviews
- ✅ Require pull request reviews before merging
- Required approving reviews: 1 (or 2 for stricter control)
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (if CODEOWNERS file exists)

#### Additional Settings
- ✅ Require conversation resolution before merging
- ✅ Require signed commits (optional, for higher security)
- ✅ Include administrators (enforce rules for admins too)
- ✅ Restrict who can push to matching branches
- ✅ Allow force pushes: Disabled
- ✅ Allow deletions: Disabled

### Develop Branch Protection

1. Add rule for `develop` branch
2. Enable:
   - ✅ Require status checks to pass before merging
   - Required checks: `lint`, `test`, `e2e`, `build`
   - ✅ Require pull request reviews (1 reviewer)
   - ✅ Require conversation resolution

## Netlify Deploy Contexts

The `netlify.toml` file configures different contexts:

```toml
# Production context (main branch)
[context.production]
  environment = { NODE_ENV = "production" }

# Staging context (develop branch)
[context.develop]
  environment = { NODE_ENV = "staging" }

# Deploy previews (pull requests)
[context.deploy-preview]
  environment = { NODE_ENV = "staging" }

# Branch deploys (other branches)
[context.branch-deploy]
  environment = { NODE_ENV = "staging" }
```

## Deployment Approval Workflow

### For Production Deployments

1. Developer creates feature branch
2. Developer opens PR to `main`
3. CI runs all checks (lint, test, e2e, build)
4. Code review is conducted
5. PR is approved by required reviewers
6. PR is merged to `main`
7. GitHub Actions workflow starts
8. Deployment waits for environment approval (if configured)
9. Reviewer approves deployment
10. Deployment proceeds to production
11. Health checks run automatically
12. If health checks fail, automatic rollback occurs

### For Staging Deployments

1. Developer creates feature branch
2. Developer opens PR to `develop`
3. CI runs all checks
4. PR is merged to `develop`
5. Automatic deployment to staging
6. No approval required (faster iteration)

## Deployment Notifications

### Slack Notifications (Optional)

Add Slack webhook to GitHub Actions:

```yaml
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Production deployment ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Email Notifications

Configure in Netlify:
1. Go to Site settings → Build & deploy → Deploy notifications
2. Add email notification for:
   - Deploy started
   - Deploy succeeded
   - Deploy failed

### GitHub Status Checks

Automatically posted to:
- Pull request status
- Commit status
- Deployment status

## Emergency Bypass Procedures

### When to Use Emergency Bypass

- Critical security vulnerability
- Production outage
- Data loss prevention
- Regulatory compliance issue

### How to Bypass Protection Rules

1. **Temporary Admin Override**
   - Admin can temporarily disable branch protection
   - Deploy emergency fix
   - Re-enable protection immediately after

2. **Hotfix Branch**
   - Create hotfix branch from main
   - Apply minimal fix
   - Fast-track review process
   - Merge with expedited approval

3. **Manual Deployment**
   - Use Netlify CLI for direct deployment
   - Document reason in incident log
   - Create follow-up PR for audit trail

### Post-Emergency Actions

1. Document incident
2. Conduct postmortem
3. Update runbooks
4. Improve monitoring
5. Add tests to prevent recurrence

## Monitoring Deployment Protection

### Audit Logs

Review regularly:
- GitHub audit log (Settings → Audit log)
- Netlify deployment history
- GitHub Actions workflow runs

### Metrics to Track

- Deployment frequency
- Deployment success rate
- Time to deploy
- Rollback frequency
- Failed deployment reasons

### Regular Reviews

- Monthly: Review protection rules
- Quarterly: Update approval requirements
- Annually: Audit access controls

## Best Practices

1. **Least Privilege**: Only grant deployment access to necessary personnel
2. **Separation of Duties**: Different people for code review and deployment approval
3. **Audit Trail**: Maintain complete deployment history
4. **Regular Testing**: Test rollback procedures regularly
5. **Documentation**: Keep deployment docs up to date
6. **Automation**: Automate as much as possible
7. **Monitoring**: Monitor all deployments
8. **Communication**: Keep team informed of deployments

## Troubleshooting

### Deployment Blocked by Protection Rules

**Issue**: Cannot deploy due to missing approvals

**Solution**:
1. Ensure all required reviewers have approved
2. Check that all status checks pass
3. Verify branch is up to date with base branch
4. Check environment protection rules

### Status Checks Not Running

**Issue**: Required checks don't appear

**Solution**:
1. Verify GitHub Actions workflow is configured
2. Check workflow file syntax
3. Ensure workflow runs on correct branches
4. Check GitHub Actions permissions

### Environment Secrets Not Available

**Issue**: Deployment fails due to missing secrets

**Solution**:
1. Verify secrets are added to correct environment
2. Check secret names match workflow file
3. Ensure environment name matches workflow
4. Verify repository has access to secrets

## Related Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT.md)
- [Staging Setup Guide](./STAGING_SETUP.md)
- [Incident Response Plan](./INCIDENT_RESPONSE.md)
