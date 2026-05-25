# TenantIQ Deployment Notes

## Infrastructure Overview

| Resource | Binding | ID/Name |
|----------|---------|---------|
| D1 Database | `DB` | `tenantiq-production` (`039e58ce-ed35-4efd-9e1d-ef060b46c632`) |
| KV Namespace | `KV` | `076f621177dc42aeb922218782abf3e3` |
| R2 Bucket | `R2` | `tenantiq-exports` |
| Queue (scan) | `SCAN_QUEUE` | `scan-results` |
| Queue (remediation) | `REMEDIATION_QUEUE` | `remediation-jobs` |
| Queue (notifications) | `NOTIFICATION_QUEUE` | `notifications` |
| Durable Object | `TENANT_EVENTS` | `TenantEvents` |
| Service Binding | `AI_ENGINE` | `tenantiq-ai-engine` |
| Domain | Route | `api.tenantiq.app/*` |

## Required D1 Migrations

After deploying, run pending D1 migrations for new tables:

```bash
# Generate migrations from schema changes
npm run db:generate

# Apply migrations to production
npx wrangler d1 migrations apply tenantiq-production --remote
```

### New Tables (Recent Features)

- `sso_connections` — SAML/OIDC provider configs per org
- `copilot_assessments` — Copilot readiness assessment results
- `config_snapshots` — M365 configuration snapshot manifests
- `config_drifts` — Detected configuration drift records
- `storage_analytics` — Storage scan results
- `workspace_inventory` — SharePoint/Teams workspace data
- `lifecycle_templates` — User lifecycle automation templates
- `lifecycle_executions` — Lifecycle execution records
- `subscriptions` — LemonSqueezy subscription records

## Environment Variables (Secrets)

Set via `wrangler secret put <NAME>`:

```bash
# Core Auth
wrangler secret put JWT_SECRET
wrangler secret put AZURE_CLIENT_ID
wrangler secret put AZURE_CLIENT_SECRET

# AI
wrangler secret put ANTHROPIC_API_KEY

# Billing
wrangler secret put LEMONSQUEEZY_API_KEY
wrangler secret put LEMONSQUEEZY_STORE_ID
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
wrangler secret put LEMONSQUEEZY_VARIANT_STARTER
wrangler secret put LEMONSQUEEZY_VARIANT_PROFESSIONAL
wrangler secret put LEMONSQUEEZY_VARIANT_ENTERPRISE

# Marketplace (optional)
wrangler secret put MARKETPLACE_WEBHOOK_SECRET

# OpenClaw (optional)
wrangler secret put OPENCLAW_URL
wrangler secret put OPENCLAW_API_KEY

# Monitoring
wrangler secret put SENTRY_DSN
```

### Non-Secret Variables

Set in `wrangler.toml` `[vars]` section:

| Variable | Value | Purpose |
|----------|-------|---------|
| `ENVIRONMENT` | `production` | Runtime environment |
| `APP_VERSION` | `0.0.0-dev` | Version tag for health checks |
| `FRONTEND_URL` | `https://app.tenantiq.app` | Frontend URL for redirects |

## Cron Triggers

Configured in `wrangler.toml`:

| Schedule | Purpose |
|----------|---------|
| `0 */6 * * *` | User and license sync (every 6h) |
| `0 * * * *` | Security scan (hourly) |
| `0 2 * * *` | Nightly backup (2am UTC) |
| `0 3 * * *` | Compliance scan (3am UTC) |
| `*/15 * * * *` | Workflow trigger check (every 15min) |
| `*/5 * * * *` | Webhook delivery retries (every 5min) |

## KV Namespace Keys

Key patterns used in KV (no namespace creation needed):

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `auth:state:*` | OAuth state tokens | 5min |
| `session:*` | User sessions | 24h |
| `graph:*:access_token` | Graph API tokens | 1h |
| `graph:*:refresh_token` | Graph refresh tokens | persistent |
| `cis:*:latest` | CIS scan results | 1h |
| `copilot:*:latest` | Copilot readiness results | 2h |
| `copilot-usage:*` | Copilot usage data | 1h |
| `copilot-security:*:latest` | Copilot security posture | 2h |
| `storage:*:full` | Storage scan results | 1h |
| `snapshot:*` | Config snapshot data | persistent |
| `drift:*` | Drift detection results | persistent |
| `webhook:*` | Webhook configs | persistent |
| `after-hours:*:config` | Business hours config | persistent |
| `rotation:*:state` | Credential rotation state | 24h |
| `federated:*:latest` | Federated identity audit | 2h |
| `marketplace-sub:*` | Marketplace subscriptions | persistent |
| `shared:conversation:*` | Shared conversation links | 7d |
| `approval:*` | Approval requests | persistent |

## Deploy Commands

```bash
# API (Cloudflare Workers)
cd apps/api
npm run deploy

# Web (Cloudflare Pages)
cd apps/web
npm run build
npm run deploy:web
# Or from root:
npm run deploy:web
```

## Pre-Deploy Checklist

- [ ] Run `npx tsc --noEmit` to verify no type errors
- [ ] Run `npm run test` to pass unit tests
- [ ] Run `npm run db:generate` if schema changed
- [ ] Apply D1 migrations: `npx wrangler d1 migrations apply tenantiq-production --remote`
- [ ] Verify all secrets are set: `wrangler secret list`
- [ ] Deploy API: `cd apps/api && npm run deploy`
- [ ] Deploy Web: `npm run deploy:web`
- [ ] Verify health: `curl https://api.tenantiq.app/health/detailed`
- [ ] Verify auth flow: test login at `https://app.tenantiq.app`

## Rollback

```bash
# List recent deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback
```
