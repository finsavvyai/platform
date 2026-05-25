# GATEWAY_ROUTE_FAIL — AI gateway route synthetic failing

**Severity:** SEV1 (critical) — model calls failing for paying customers.
**Owner team:** Platform / AI Gateway.

## Impact
Synthetic probe `gateway-route` reports `ok=false` 2+ runs in a row.
End-users cannot route requests to any provider — likely cause is a
`NoRouteError` (`AI_GATEWAY_NO_ROUTE`) or `GatewayExhaustedError`
(`AI_GATEWAY_EXHAUSTED`).

## Symptoms
- `gateway-route` synthetic red.
- Spike in 5xx (often co-fires with `GATEWAY_ERROR_RATE`).
- Logs contain `code: "AI_GATEWAY_NO_ROUTE"` or `"AI_GATEWAY_EXHAUSTED"`.

## Quick diagnosis
```bash
# 1. Hit a known route directly.
curl -fsS -X POST https://ai-gateway.finsavvy.ai/v1/route \
  -H "authorization: Bearer $FINSAVVY_TEST_TOKEN" \
  -H "content-type: application/json" \
  -d '{"prompt":"hello","model_hint":"openai:gpt-4o-mini"}'

# 2. Tail and grep for gateway error codes.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep -E "AI_GATEWAY_(NO_ROUTE|EXHAUSTED|NON_RETRYABLE|RETRYABLE)"

# 3. Check provider status pages (OpenAI, Anthropic, etc.).

# 4. Inspect the active route table (cached in KV).
wrangler kv:key get --binding=RESPONSE_CACHE_KV --env production "route:table:current"
```

## Mitigation
1. **Single provider down:** flip provider weights via env var:
   ```bash
   wrangler secret put FINSAVVY_GATEWAY_PROVIDER_WEIGHTS --env production \
     --name finsavvy-ai-gateway-production
   # paste JSON e.g. {"openai":0,"anthropic":1.0}
   ```
2. **All providers failing:** check egress (CF Worker → public internet).
   `wrangler tail` will show `RetryableProviderError` storms.
3. **Bad config push:** roll back (below).
4. **Post to `#status-finsavvy`** with affected providers + ETA.

## Root cause investigation
- Inspect last route-table change in git (`infrastructure/cloudflare/`).
- Cross-reference `finsavvy.gateway.error_rate` by `provider` label.
- Check provider rate-limit headers in worker logs.

## Rollback procedure
```bash
wrangler deployments list --env production --name finsavvy-ai-gateway-production
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
# If problem is config (KV), restore previous JSON:
wrangler kv:key put --binding=RESPONSE_CACHE_KV --env production "route:table:current" "$(cat /tmp/prev-route-table.json)"
```

## Verification
```bash
node infrastructure/synthetics/run.mjs --probe gateway-route --env production
# expect ok=true 3x consecutive.
```

## Post-incident
- SEV1 → postmortem in 48h.
- Action item: ensure at least 2 providers are healthy in the cached route
  table (no single point of failure).
