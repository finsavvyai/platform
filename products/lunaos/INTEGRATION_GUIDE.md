# Integration Guide — Production Hardening Features

This guide shows how to integrate the three new production hardening modules into LunaOS Engine routes.

---

## 1. Enable Tenant Rate Limiting

### Step 1: Add middleware to worker.ts

```typescript
// lunaos-engine/packages/api/src/worker.ts

import { tenantRateLimit } from './middleware/tenant-rate-limiter';

// Add after auth middleware (around line 127)
app.use('*', logger());
app.use('*', corsMiddleware);
app.use('*', securityHeaders);
app.use('*', trackMetrics);
app.use('/api/*', tenantRateLimit);  // NEW: Tenant-aware rate limiting
```

### Step 2: Ensure auth middleware sets tenantId

In your auth middleware (e.g., `src/middleware/auth.ts`), set the tenant context:

```typescript
// This should already be set by auth middleware
c.set('tenantId', user.orgId);     // Required for rate limiter
c.set('userTier', user.tier);      // Required (free|pro|enterprise)
```

### Step 3: Protect expensive endpoints (optional)

For costly operations, add stricter per-endpoint limits:

```typescript
import { endpointRateLimit } from './middleware/tenant-rate-limiter';

// In routes/expensive-operation.ts
router.post(
  '/api/export-large-dataset',
  endpointRateLimit(5, 3600),  // 5 requests per hour per tenant
  async (c) => {
    // Handler
  }
);

router.post(
  '/api/train-model',
  endpointRateLimit(2, 86400),  // 2 requests per day
  async (c) => {
    // Handler
  }
);
```

### Verify it's working

```bash
# Make rapid requests
for i in {1..150}; do
  curl -H "Authorization: Bearer TOKEN" \
    -H "X-Tenant-ID: org-123" \
    https://api.lunaos.ai/api/workflows
done

# Should start seeing 429 responses after limit
# Response headers should include:
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 987
# Retry-After: 60
```

---

## 2. Enable Audit Webhooks

### Step 1: Run database migration

```bash
# Local development
wrangler d1 migrations apply lunaos-engine-db --local

# Production
wrangler d1 migrations apply lunaos-engine-db --remote
```

### Step 2: Create webhook routes

```typescript
// In routes/audit-webhooks.ts (new file)
import { Hono } from 'hono';
import { createAuditWebhook, listAuditWebhooks, deleteAuditWebhook } from '../services/audit-webhook-sender';
import type { Env } from '../worker';

const router = new Hono<{ Bindings: Env }>();

// Create webhook
router.post('/webhooks', async (c) => {
  const { url, events } = await c.req.json();
  const orgId = c.get('tenantId');

  const { id, secret } = await createAuditWebhook(
    c.env.DB,
    orgId,
    url,
    events
  );

  // Return secret ONLY on creation (never again)
  return c.json({
    id,
    secret,
    message: 'Save this secret securely. You won\'t see it again.',
  });
});

// List webhooks
router.get('/webhooks', async (c) => {
  const orgId = c.get('tenantId');
  const webhooks = await listAuditWebhooks(c.env.DB, orgId);
  return c.json({ data: webhooks });
});

// Delete webhook
router.delete('/webhooks/:id', async (c) => {
  const { id } = c.req.param();
  await deleteAuditWebhook(c.env.DB, id);
  return c.json({ success: true });
});

export const auditWebhookRoutes = router;
```

### Step 3: Mount webhook routes in worker.ts

```typescript
// lunaos-engine/packages/api/src/worker.ts
import { auditWebhookRoutes } from './routes/audit-webhooks';

// Add to route mounting section (around line 130)
app.route('/audit', auditWebhookRoutes);
```

### Step 4: Send webhook events on sensitive actions

Add to any route that needs audit logging:

```typescript
import { logAuditEvent } from '../services/audit-logger';
import { sendAuditWebhooks } from '../services/audit-webhook-sender';

// Example: auth route
router.post('/login', async (c) => {
  // ... authentication logic ...

  const user = { id: 'user-123', orgId: 'org-456' };

  // Log to audit table (existing)
  await logAuditEvent(c.env.DB, {
    action: 'auth.login',
    userId: user.id,
    ipAddress: c.req.header('CF-Connecting-IP'),
  });

  // Send to webhooks (NEW - non-blocking)
  const payload = {
    id: crypto.randomUUID(),
    action: 'auth.login',
    userId: user.id,
    timestamp: new Date().toISOString(),
    orgId: user.orgId,
    metadata: { loginMethod: 'oauth', provider: 'github' },
  };

  c.executionCtx?.waitUntil?.(
    sendAuditWebhooks(c.env, user.orgId, payload)
  );

  return c.json({ token: '...' });
});
```

### Test webhook integration

```bash
# 1. Create a test webhook
curl -X POST https://api.lunaos.ai/audit/webhooks \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/unique-id",
    "events": ["auth.login", "api_key.created"]
  }'

# Returns: { id: "hook-123", secret: "abc123..." }

# 2. Trigger an auth.login event
curl -X POST https://api.lunaos.ai/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "..."}'

# 3. Check webhook.site for received payload
# Should have header: X-Luna-Signature: <hmac-sha256>
```

---

## 3. Load Testing & Validation

### Run load tests

```bash
cd lunaos-engine/packages/api
npm run test -- load.benchmark

# Output includes:
# ✓ should handle 100 concurrent workflows
# ✓ should handle 1000 concurrent workflows
# ✓ should handle burst load (5000 requests)
# ✓ should handle 10000 skill runs (daily volume)
# ✓ should maintain consistent latency across skill types
# ✓ should gracefully handle 5% error rate
# ✓ should handle cascading failures gracefully
# ✓ should handle concurrent database queries
# ✓ should handle contention on shared resources
# ✓ should enforce rate limits without impacting throughput
```

### Run all tests with coverage

```bash
npm run test -- --coverage

# Generates coverage report. No baseline percentages have
# been captured yet — run this command to produce the first one.
```

### Performance profiling (optional)

```bash
# Profile with detailed metrics
npm run test -- load.benchmark --reporter=verbose

# Capture metrics for:
# - p50 (median) latency
# - p95, p99 (tail) latencies
# - error rates under load
# - throughput (req/s)
```

---

## 4. Monitoring & Alerts

### Key Metrics to Track

**Rate Limiting:**
```
- Rate limit hits per tenant (429 responses)
- Tier distribution (free vs pro vs enterprise)
- Fallback usage (KV errors → memory fallback)
- Retry-After compliance
```

**Audit Webhooks:**
```
- Webhook delivery success rate
- Average delivery latency
- Retry counts (should be <5% of events)
- Event volume per org
- Secret rotation frequency (if applicable)
```

**Load Performance:**
```
- Concurrent request handling
- P95/P99 latency percentiles
- Error rates under surge
- Database query performance
- Memory usage under sustained load
```

### Cloudflare Analytics (recommended)

```
// In wrangler.toml
[analytics_engine]
enabled = true

// In routes, track custom metrics:
if (c.get('rateLimited')) {
  c.env.ANALYTICS_ENGINE?.writeDataPoint({
    indexes: ['rate_limit_hit', c.get('userTier')],
    blobs: [user_id, org_id],
    doubles: [1],
  });
}
```

---

## 5. Configuration Options

### Rate Limiter Tiers

Edit `src/middleware/tenant-rate-limiter.ts` to adjust limits:

```typescript
export const TENANT_RATE_LIMITS = {
  free: { statedLimit: 100, kvLimit: 70 },      // 100 req/min
  pro: { statedLimit: 1000, kvLimit: 700 },     // 1000 req/min
  enterprise: { statedLimit: 10000, kvLimit: 7000 }, // 10000 req/min
};
```

### Window size

Edit `WINDOW_SECONDS` (default: 60 seconds per minute):

```typescript
export const WINDOW_SECONDS = 60;  // Change if needed
```

### Cleanup interval (memory fallback)

```typescript
const CLEANUP_INTERVAL_MS = 30_000;  // Cleanup every 30 seconds
```

---

## 6. Troubleshooting

### Rate limiter not working?

**Check 1**: Ensure `tenantId` is set by auth middleware
```typescript
console.log(c.get('tenantId'));  // Should not be null
```

**Check 2**: Verify Cloudflare KV is configured
```bash
wrangler kv:namespace list
```

**Check 3**: Check response headers
```bash
curl -v https://api.lunaos.ai/api/test

# Should see:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
```

### Webhooks not delivering?

**Check 1**: Verify webhook URL is reachable
```bash
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Check 2**: Check secret hash in database
```sql
SELECT id, url, failure_count, last_delivered_at
FROM audit_webhooks
WHERE org_id = 'your-org-id';
```

**Check 3**: Verify signature calculation
```typescript
const sig = generateWebhookSignature(payload, secret);
console.log('Signature:', sig);
```

---

## 7. Next Steps

1. **Deploy to staging**: Test all three features in staging environment
2. **Load test with production data**: Run benchmarks against realistic data
3. **Monitor for 24 hours**: Check KV performance, webhook delivery, error rates
4. **Gradual rollout**: Enable rate limiting for free tier first, then pro/enterprise
5. **Collect metrics**: Use Cloudflare Analytics to track adoption & issues

---

## Support

For issues or questions:
1. Check test files: `src/**/*.test.ts` for usage examples
2. Review inline JSDoc comments
3. Check Cloudflare documentation: https://developers.cloudflare.com
4. File an issue in the project repo
