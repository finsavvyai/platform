# Security Stack Drift Monitoring Integration Guide

This document explains how to integrate the new drift monitoring feature into TenantIQ's existing codebase.

## Architecture Overview

The drift monitoring system consists of:

1. **Monitoring Service** (`security-stack-monitor.ts`) - Captures security configuration snapshots and detects changes
2. **Cron Job** (`security-stack-scan.ts`) - Runs hourly to scan all active tenants
3. **API Routes** (`security-stack-monitor.ts`) - Exposes endpoints for manual scans and baseline management
4. **UI Components** (`DriftAlert.svelte`) - Displays detected drifts to users
5. **Database Tables** - Already defined in `schema-d1.ts`: `configSnapshots`, `configDrifts`

## Step 1: Mount API Routes

In `apps/api/src/routes/index.ts` (or your main router file), add:

```typescript
import securityStackMonitorRouter from './tenants/security-stack-monitor';

// Mount the security stack monitor routes
app.route('/api/tenants', securityStackMonitorRouter);
```

## Step 2: Register Cron Job

In `apps/api/src/cron/index.ts` (or your Cloudflare Workers cron handler), add:

```typescript
import { scanSecurityStack } from './security-stack-scan';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run security stack scan every hour
    if (event.cron === '0 * * * *') {
      ctx.waitUntil(scanSecurityStack({
        db,
        graph: (tenantId) => new GraphClient(tenantId, env)
      }));
    }
  }
};
```

## Step 3: Update wrangler.toml

Add cron trigger to `apps/api/wrangler.toml`:

```toml
[env.production]
triggers = { crons = ["0 * * * *"] }
```

## Step 4: Add Security Stack Page Route

Create `apps/web/src/routes/security/stack/+page.svelte`. This page should:

- Display last scan timestamp
- Show count of active drifts
- List critical issues prominently
- Allow triggering manual scans
- Allow acknowledging drifts
- Allow setting current state as new baseline

See example template in this directory.

## Step 5: Update Navigation

Add a link to the Security Stack Monitor page in your main navigation:

```svelte
<a href="/security/stack">Security Stack Monitor</a>
```

## Step 6: Add Types to Shared Package

Import from `packages/shared/src/types/security-drift.ts`:

```typescript
import type { SecurityDrift, SecurityStackSnapshot } from '$lib/types/security-drift';
```

## API Endpoints

### Get Monitor Status
```
GET /api/tenants/:tenantId/security/stack/monitor
Response: { lastScan, drifts, snapshot }
```

### Trigger Manual Scan
```
POST /api/tenants/:tenantId/security/stack/monitor/scan
Response: { success, scannedAt }
```

### Set New Baseline
```
POST /api/tenants/:tenantId/security/stack/monitor/baseline
Response: { baseline, message }
```

### Acknowledge Drift
```
PATCH /api/tenants/:tenantId/security/stack/monitor/drifts/:driftId/acknowledge
Response: { success }
```

## Security Considerations

1. **Access Control**: Routes require tenant context from auth middleware
2. **Data Scoping**: All queries scope to current org/tenant
3. **Audit Logging**: All manual scans and baseline changes should be logged to `auditLogs` table
4. **Sensitive Data**: Graph API calls require Graph.Reader permissions

## Graph API Methods Required

The `GraphClient` must implement these methods:

- `listConditionalAccessPolicies()` - CA policies
- `listDLPPolicies()` - DLP rules
- `listLabels()` - Retention/sensitivity labels
- `getRiskDetectionPolicies()` - Identity protection policies
- `listRiskyUsers()` - Risky user list
- `getMFACoverage()` - MFA enrollment stats
- `getEmailSecuritySettings()` - Advanced threat protection status

## Testing

Run unit tests:
```bash
npm run test -- security-stack-monitor.test.ts
```

Run integration tests with real D1:
```bash
npm run test:integration
```

Run E2E tests:
```bash
npx playwright test e2e/security-stack.e2e.test.ts
```

## Severity Levels

- **Critical**: Security features disabled (MFA, anti-phishing)
- **High**: Policy counts changed, legacy auth handling
- **Medium**: Coverage metrics declined
- **Low**: Non-critical changes

## Future Enhancements

1. Webhook notifications to Slack/Teams for drift alerts
2. Auto-remediation workflows for common drifts
3. Configuration comparison UI (diff viewer)
4. Scheduled reports with drift trends
5. Integration with SIEM platforms
6. ML-based anomaly detection for suspicious patterns
