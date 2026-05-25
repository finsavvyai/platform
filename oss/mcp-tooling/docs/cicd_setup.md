# CI/CD Setup & Configuration Guide

## Overview
This guide details the configuration required to fully enable the GitHub Actions CI/CD pipeline (`.github/workflows/deploy.yml` and `test.yml`).

## 1. GitHub Secrets
Navigate to **Settings** > **Secrets and variables** > **Actions** and add the following:

### Infrastructure & Deployment
- `CLOUDFLARE_API_TOKEN`: Token with permissions to deploy Pages and Workers.
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.
- `DO_SSH_KEY`: (If deplying to DigitalOcean) SSH Private Key.
- `DO_HOST`: Target server IP.
- `DO_USER`: Target server user (e.g., `root`).

### Database (Supabase / Postgres)
- `SUPABASE_PROJECT_REF`: Project ID.
- `SUPABASE_DB_PASSWORD`: Database password.
- `DB_DSN`: Full connection string (e.g., `postgres://user:pass@host:5432/db`).

### Services
- `SENTRY_AUTH_TOKEN`: For uploading source maps.
- `SNYK_TOKEN`: For security vulnerability scanning.
- `SLACK_WEBHOOK_URL`: For deployment notifications.
- `CODECOV_TOKEN`: For uploading coverage reports.

## 2. Branch Protection Rules
Protect the `main` branch to ensure stability.

**Go to**: Settings > Branches > Add rule > `main`

**Check the following:**
- [x] **Require a pull request before merging**
  - [x] Require approvals (Recommend: 1)
- [x] **Require status checks to pass before merging**
  - Search for and select: `test-backend`, `test-frontend`, `lint`, `security-scan`
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings**

## 3. Workflow Triggers
- **Pull Requests**: Triggers `test.yml` (Unit tests, Linting, Security Scan).
- **Push to Main**: Triggers `deploy.yml` (Build, Deploy, Migration).
