# WORKER_CPU_LIMIT — Cloudflare Worker CPU >50ms (5m avg)

**Severity:** SEV2 (high). CPU throttling imminent → 1102 errors.

## Impact
Worker average CPU usage exceeded 50ms over 5m. Cloudflare paid-tier Workers
have a default 50ms CPU cap per invocation; sustained breach means
Cloudflare will start terminating invocations with `Error 1102`.

## Symptoms
- `finsavvy.worker.cpu_ms` averaging >50.
- Sporadic 1102 errors in CF dashboard.
- Likely co-fire with `GATEWAY_LATENCY_P95` and eventually
  `GATEWAY_ERROR_RATE`.

## Quick diagnosis
```bash
# 1. CPU per request from analytics engine.
# Datadog: avg:finsavvy.worker.cpu_ms{env:production} by {route,worker}.

# 2. Hot route identification.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep '"latency_ms":[0-9]\{4,\}'

# 3. Recent deploys — did a heavier dependency land?
wrangler deployments list --env production --name finsavvy-ai-gateway-production | head -5
```

## Mitigation
1. **Heavy synchronous work in a route:** identify and move to a queue
   (Cloudflare Queues / Durable Object) rather than inline.
2. **Tight loop / regex backtracking:** roll back immediately if recent
   deploy introduced it.
3. **Request size spike:** lower max body size temporarily via env:
   ```bash
   wrangler secret put FINSAVVY_GATEWAY_MAX_BODY_BYTES --env production \
     --name finsavvy-ai-gateway-production
   # e.g., 65536 (64KB) instead of default 256KB
   ```

## Root cause investigation
- Profile with `console.time` markers in suspect handlers (only in staging
  to avoid log noise).
- Inspect any new regex, JSON.parse over large payloads, or sync crypto
  operations in hot paths.

## Rollback procedure
```bash
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
```

## Verification
- CPU average drops below 35ms for 15 min.
- p95 latency recovers to baseline.

## Post-incident
- SEV2 → postmortem if customer-visible.
- Action: add CPU budget assertion to perf tests so regressions are caught
  in CI.
