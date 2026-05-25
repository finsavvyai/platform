# GitHub App Marketplace Submission Checklist

## Prerequisites

- [ ] GitHub App created at https://github.com/settings/apps
- [ ] App slug set (e.g. `pipewarden`)
- [ ] App logo uploaded (≥200×200px, no alpha, PNG or SVG)
- [ ] App description filled in
- [ ] Homepage URL set: `https://pipewarden.com`
- [ ] Callback URL set: `https://app.pipewarden.com/auth/github/callback`
- [ ] Webhook URL set: `https://app.pipewarden.com/api/v1/oauth/github/webhook`
- [ ] Webhook secret configured
- [ ] Permissions configured (see `.github/app-manifest.json`)
- [ ] Events subscribed: push, pull_request, workflow_run, check_run, check_suite

## Pricing

Set up in GitHub Marketplace after publishing. Match LemonSqueezy tiers:

| Plan | Price | Description |
|------|-------|-------------|
| Free | $0 | 1 connection, 10 scans/day, heuristic only |
| Starter | $29/mo | 5 connections, 100 scans/day, Claude AI analysis |
| Pro | $79/mo | 20 connections, unlimited scans, DLP + OPA + SARIF |
| Enterprise | $299/mo | Unlimited everything, SSO, SLA |

## Listing Content

### Tagline (100 chars max)
```
AI-powered CI/CD pipeline security scanner for GitHub Actions
```

### Short Description (160 chars max)
```
Detect hardcoded secrets, vulnerable dependencies, and dangerous permissions in GitHub Actions workflows — with AI-powered remediation via Claude.
```

### Full Description
Use content from `.github/marketplace.yml` + expand with:
- Screenshot 1: Dashboard overview with findings
- Screenshot 2: Security finding detail with remediation
- Screenshot 3: SARIF results in GitHub Security tab
- Screenshot 4: DLP scan results
- Screenshot 5: Onboarding wizard

### Categories
- Security
- Code Quality
- Continuous Integration

## Technical Requirements

- [ ] HTTPS only for all URLs
- [ ] Webhook validation (HMAC-SHA256) — implemented in `HandleGitHubWebhook`
- [ ] OAuth state parameter (CSRF protection) — implemented in `InstallGitHubApp`
- [ ] Installation token rotation — `GitHubApp.GenerateInstallationToken` handles expiry
- [ ] Uninstall cleanup — `deleteGitHubInstallation` removes connections on `installation.deleted`
- [ ] Privacy policy at `https://pipewarden.com/privacy`
- [ ] Terms of service at `https://pipewarden.com/terms`

## Submission Steps

1. Publish app (make it public) at: https://github.com/settings/apps/YOUR_APP_SLUG
2. Click "List in Marketplace"
3. Choose pricing model: "Free and paid plans"
4. Fill in listing content
5. Add screenshots
6. Submit for review (GitHub reviews within 1-2 weeks)
7. Respond to review feedback if any

## One-Click Install URL

```
https://github.com/apps/pipewarden/installations/new
```

Use this in the marketing site's CTA buttons.

## Post-Approval

- Update `website/index.html` CTA to use GitHub Marketplace install URL
- Add "Available on GitHub Marketplace" badge to README
- Announce on HN, Product Hunt, Twitter/X

## Monitoring After Launch

- GitHub Marketplace analytics: installations, revenue, churn
- `GET /api/v1/oauth/github/installations` for active installation count
- Audit log: watch for `installation.deleted` events (churn signal)
