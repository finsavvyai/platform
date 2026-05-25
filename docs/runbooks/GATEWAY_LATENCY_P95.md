# GATEWAY_LATENCY_P95 — p95 latency >500ms over 10min

**Severity:** SEV2 (high). User-perceptible slowdown but not outage.

## Impact
95th-percentile gateway latency over 500ms. Streamed responses still work, but
synchronous callers (CLI/CI) start timing out.

## Symptoms
- `finsavvy.gateway.latency_ms_p95 > 500` for 10m.
- Logs show longer `latency_ms` in audit lines.
- Worker CPU climbing (may precede `WORKER_CPU_LIMIT`).

## Quick diagnosis
```bash
# 1. Latency by provider.
# Datadog: graph finsavvy.gateway.latency_ms_p95 by provider.

# 2. Sample slow requests.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep -E '"latency_ms":[0-9]{4,}' | head -20

# 3. KV cache hit rate.
node infrastructure/synthetics/run.mjs --probe gateway-cache-hit --env production

# 4. D1 query latency (if D1 backs metering / entitlements).
wrangler d1 execute finsavvy-ai-gateway-production --command "SELECT 1" --remote
```

## Mitigation
1. **Cache hit rate dropped:** check if `RESPONSE_CACHE_KV` namespace was
   purged or hit a region issue. See `_rollback.md` "KV poisoning" if a bad
   value was written.
2. **One provider slow:** weight shift (see `GATEWAY_ROUTE_FAIL.md`).
3. **Pattern of large prompts:** identify the noisy tenant via
   `finsavvy.gateway.tokens_in by tenant_id`; engage them out-of-band.
4. **D1 slow:** check Cloudflare D1 dashboard for read replica lag.

## Root cause investigation
- Compare current p95 to baseline by hour-of-day.
- Check whether recent deploy added a synchronous downstream call.
- Profile slow paths with `console.time` in dev → port findings forward.

## Rollback procedure
```bash
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
```
If no deploy correlation: mitigate forward; no rollback needed.

## Verification
- p95 < 350ms for 15 consecutive minutes.

## Post-incident
- Capture trend in weekly perf review.
- Open ticket if a tenant pattern emerges → rate-limit tuning.
