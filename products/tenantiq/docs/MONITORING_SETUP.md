# TenantIQ Monitoring Setup

Last updated: 2026-03-26

## Health Check Endpoints

| Endpoint | Purpose | Auth | Response Time |
|----------|---------|------|---------------|
| `/health/ping` | Ultra-fast liveness probe | None | < 5ms |
| `/health/detailed` | D1 + KV + R2 connectivity | None | < 500ms |
| `/health` | Basic DB health check | None | < 100ms |
| `/metrics` | Performance and rate limit stats | Admin | < 200ms |

## Option 1: Cloudflare Health Checks (Recommended)

1. Go to **Cloudflare Dashboard > Notifications > Health Checks**
2. Create a new Health Check:
   - **URL**: `https://api.tenantiq.app/health/ping`
   - **Method**: GET
   - **Expected status**: 200
   - **Check interval**: 60 seconds
   - **Retries before alert**: 3
   - **Timeout**: 10 seconds
3. Create notification policy:
   - **Alert type**: Health Check failure
   - **Channels**: Email, Slack webhook, PagerDuty
4. Create a second check for the detailed endpoint:
   - **URL**: `https://api.tenantiq.app/health/detailed`
   - **Expected body contains**: `"healthy"`
   - **Check interval**: 300 seconds (5 minutes)

## Option 2: Better Uptime / Checkly

### Better Uptime Setup

1. Sign up at [betteruptime.com](https://betteruptime.com)
2. Add monitors:
   - **Ping monitor**: `https://api.tenantiq.app/health/ping`
     - Interval: 60 seconds
     - Expected: HTTP 200
   - **Keyword monitor**: `https://api.tenantiq.app/health/detailed`
     - Interval: 300 seconds
     - Expected: HTTP 200, body contains `"healthy"`
3. Configure alerting:
   - Email to ops team
   - Slack channel `#tenantiq-alerts`
4. Create a status page at `status.tenantiq.app`

### Checkly Setup

1. Sign up at [checklyhq.com](https://www.checklyhq.com)
2. Create API checks:
   - **Health ping**: GET `https://api.tenantiq.app/health/ping`
   - **Health detailed**: GET `https://api.tenantiq.app/health/detailed`
   - Assert `response.status === 200`
   - Assert `response.jsonBody.status === 'healthy'`
3. Run from multiple regions (US-East, EU-West, APAC)
4. Set alert channels: email, Slack, PagerDuty

## Sentry Error Tracking

- **API**: `@sentry/cloudflare` SDK integrated in `apps/api/src/lib/sentry.ts`
- **Web**: Lightweight envelope client in `apps/web/src/lib/sentry-client.ts`
- Set `SENTRY_DSN` in wrangler.toml secrets
- Set `PUBLIC_SENTRY_DSN` in web environment variables

## Performance Monitoring

- Every API response includes `X-Response-Time` header
- Slow requests (>1000ms) logged as warnings
- p50/p95 latency summary stored in KV (`perf:api:summary`)
- View at `/metrics` endpoint

## Alert Escalation Policy

| Severity | Trigger | Response Time | Channel |
|----------|---------|---------------|---------|
| Critical | API down > 3 checks | 5 minutes | PagerDuty + Slack |
| High | 5xx rate > 1% | 15 minutes | Slack + Email |
| Medium | p95 latency > 2s | 1 hour | Slack |
| Low | Degraded health | 4 hours | Email |
