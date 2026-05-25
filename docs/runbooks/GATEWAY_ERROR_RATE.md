# GATEWAY_ERROR_RATE — Gateway 5xx rate >1% over 5min

**Severity:** SEV2 (high) — degraded experience for ~1% of users.

## Impact
1% of API responses are 5xx. Below the SEV1 line but trending; left alone it
typically becomes `GATEWAY_ROUTE_FAIL` within 10–30 minutes.

## Symptoms
- `finsavvy.gateway.error_rate > 0.01` for 5m.
- Mixed `AI_GATEWAY_RETRYABLE` / `AI_GATEWAY_NON_RETRYABLE` codes in logs.
- Possible co-fire with `GATEWAY_LATENCY_P95` (slowness preceding failure).

## Quick diagnosis
```bash
# 1. Error rate by provider.
# Datadog: graph finsavvy.gateway.error_rate by provider.

# 2. Most common failing route.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep '"status":5' | head -50

# 3. Provider-side status (check OpenAI/Anthropic status pages).

# 4. Recent deploy?
wrangler deployments list --env production --name finsavvy-ai-gateway-production | head -5
```

## Mitigation
1. **If one provider dominates the errors:** shift weights (see
   `GATEWAY_ROUTE_FAIL.md` step 1).
2. **If errors are 502/504 from CF itself:** check Cloudflare incident page.
3. **If the deploy is fresh:** roll back.
4. **If retries are exhausting budgets:** temporarily lower
   `FINSAVVY_GATEWAY_MAX_RETRIES` (env var) from default to 1 to shed load:
   ```bash
   wrangler secret put FINSAVVY_GATEWAY_MAX_RETRIES --env production \
     --name finsavvy-ai-gateway-production
   ```

## Root cause investigation
- Sample 10 failing request IDs from logs; trace each through audit log.
- Check if errors cluster by tenant (single tenant DOS) vs. spread (provider
  issue).
- Inspect retry budgets and circuit-breaker state.

## Rollback procedure
```bash
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
```
If no recent deploy: no rollback applies — mitigate forward with retry/weight
knobs above.

## Verification
- Error rate < 0.5% for 10 consecutive minutes.
- Re-run `gateway-route` probe; must be `ok=true`.

## Post-incident
- SEV2 → postmortem only if user-impacting >15min.
- Ticket: investigate whether circuit breaker thresholds need tuning.
