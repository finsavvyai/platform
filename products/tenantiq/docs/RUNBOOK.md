# TenantIQ Operational Runbook

## Common Tasks

### Deploy API (Cloudflare Workers)

```bash
cd apps/api
npm run deploy                # Deploy to production
wrangler deployments list     # View deployment history
wrangler tail                 # Stream live logs
```

### Deploy Web (Cloudflare Pages)

```bash
cd apps/web
npm run build                 # Build SvelteKit for Cloudflare Pages
npm run deploy:web            # Deploy to Cloudflare Pages
```

Pages deployments are also triggered automatically on `git push` to `main`.

### Run Database Migrations

```bash
npm run db:generate                                    # Generate migration from schema changes
npm run db:migrate:local                               # Apply to local dev D1
npx wrangler d1 migrations apply tenantiq-production   # Apply to production D1
```

### Check Health

```bash
curl https://api.tenantiq.app/health
# Expected: {"status":"ok","timestamp":"..."}
```

### View Production Logs

```bash
wrangler tail --format pretty    # Real-time log stream
wrangler tail --filter error     # Filter to errors only
```

## Incident Response

### API Down (5xx errors)

1. Check Cloudflare dashboard for Worker status and error rates.
2. Run `wrangler tail --filter error` to see recent errors.
3. Check Sentry for error details and stack traces.
4. If caused by a bad deploy, rollback: `wrangler rollback`.
5. If D1 is unavailable, check Cloudflare status page.
6. Notify stakeholders via Slack/PagerDuty.

### Authentication Failures

1. Check if Clerk is operational: [status.clerk.com](https://status.clerk.com).
2. Verify JWT_SECRET env var is set: `wrangler secret list`.
3. Check KV for session data: `wrangler kv key list --namespace-id <id>`.
4. Review auth error logs in Sentry.
5. If Azure AD is down, check [status.azure.com](https://status.azure.com).

### D1 Database Issues

1. Check Cloudflare D1 metrics in dashboard.
2. Run a simple query to verify connectivity:
   ```bash
   npx wrangler d1 execute tenantiq-production --remote --command "SELECT 1"
   ```
3. If migrations failed, check migration status:
   ```bash
   npx wrangler d1 migrations list tenantiq-production
   ```
4. For data corruption, use point-in-time restore (see Rollback section).

### Queue Backup (Jobs Not Processing)

1. Check queue metrics in Cloudflare dashboard.
2. Verify consumer Worker is deployed and running.
3. Check dead-letter queue for failed messages.
4. If queue is stalled, redeploy the consumer Worker.
5. For stuck jobs, manually drain and reprocess:
   ```bash
   wrangler queues consumer pause tenantiq-scan-queue
   # Fix the issue
   wrangler queues consumer resume tenantiq-scan-queue
   ```

### Graph API Rate Limiting

1. Check for 429 responses in API logs.
2. Review sync frequency — reduce if hitting limits.
3. Implement exponential backoff (already in graph-client.ts).
4. Contact Microsoft support if limits are persistently exceeded.

## Monitoring

### Sentry

- Dashboard: [tenantiq.sentry.io](https://tenantiq.sentry.io)
- Alerts configured for: error spike, new issue, regression.
- Source maps uploaded on each deploy for readable stack traces.

### Health Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | API liveness check | `{"status":"ok"}` |
| `GET /health/db` | D1 connectivity | `{"status":"ok","latencyMs":...}` |

### Cloudflare Dashboard

- **Workers Analytics**: request count, CPU time, errors.
- **D1 Analytics**: query count, rows read/written, storage.
- **KV Analytics**: read/write operations, storage.
- **Pages Analytics**: page views, build status.

### Uptime Monitoring

Configured via Cloudflare Health Checks:
- Endpoint: `https://api.tenantiq.app/health`
- Interval: 60 seconds
- Alerting: PagerDuty + Slack on failure.

## Rollback

### Workers Rollback

```bash
wrangler deployments list                    # List recent deployments
wrangler rollback                            # Rollback to previous version
wrangler rollback --version-id <version>     # Rollback to specific version
```

### Pages Rollback

1. Go to Cloudflare dashboard > Pages > tenantiq-web.
2. Click **Deployments** tab.
3. Find the last known-good deployment.
4. Click **Rollback to this deployment**.

### D1 Point-in-Time Restore

```bash
npx wrangler d1 time-travel restore tenantiq-production --timestamp <ISO-8601>
```

D1 supports point-in-time restore up to 30 days for paid plans.

### KV Data

KV does not support rollback. Data is additive and eventually consistent.
If bad data was written, delete the affected keys manually:

```bash
wrangler kv key delete --namespace-id <id> <key>
```

## Database Operations

### Query Production D1

```bash
npx wrangler d1 execute tenantiq-production --remote --command "SELECT COUNT(*) FROM tenants"
npx wrangler d1 execute tenantiq-production --remote --command "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10"
```

### Backup D1

D1 backups are automatic (point-in-time restore). For manual export:

```bash
npx wrangler d1 export tenantiq-production --remote --output backup.sql
```

### Clean Up Old Data

```bash
# Delete alerts older than 90 days
npx wrangler d1 execute tenantiq-production --remote \
  --command "DELETE FROM alerts WHERE created_at < datetime('now', '-90 days')"
```

## Contacts

| Role | Contact |
|------|---------|
| On-call engineer | PagerDuty rotation |
| Platform lead | platform@tenantiq.app |
| Security incidents | security@tenantiq.app |
| Customer support | support@tenantiq.app |
