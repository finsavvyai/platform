# RATE_LIMIT_SPIKE — Rate-limit rejections >100/min

**Severity:** SEV3 (medium). Possible attack OR runaway client.

## Impact
> 100 rate-limit rejections per minute over 5 min. Most legitimate users
unaffected, but: (a) an attacker may be probing, or (b) a single tenant
client may be in a retry loop costing them money.

## Symptoms
- `finsavvy.gateway.rate_limit_rejected_total` rate climbing.
- `RATE_LIMIT_KV` worker binding shows high read/write volume.

## Quick diagnosis
```bash
# 1. Group rejections by tenant.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep '"event":"rate_limit.rejected"' | head -100

# 2. Source IP distribution.

# 3. Inspect a specific tenant's bucket.
wrangler kv:key get --binding=RATE_LIMIT_KV --env production \
  "rl:tenant:<TENANT_ID>:1m"
```

## Mitigation
1. **Single tenant in retry loop:** contact them (#support); optionally
   tighten their tenant-level cap temporarily.
2. **Distributed attack:** WAF rule + CF Bot Fight Mode.
3. **Legitimate burst (launch/marketing):** raise per-tenant cap
   ephemerally:
   ```bash
   wrangler secret put FINSAVVY_GATEWAY_TENANT_RPS_OVERRIDE --env production \
     --name finsavvy-ai-gateway-production
   # JSON: {"<tenant_id>": 100}
   ```

## Root cause investigation
- Compare to baseline by hour-of-day.
- Check whether a new tenant onboarded recently without quota config.

## Rollback procedure
- If a deploy changed rate-limit logic, roll back:
  ```bash
  wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
  ```
- Otherwise: no rollback needed; mitigate forward.

## Verification
- Rate-limit rejections < 30/min sustained for 10 min.
- Affected tenant reports normal operation.

## Post-incident
- SEV3 → no postmortem unless customer-visible.
- Ticket: review whether default per-tenant cap is too low for current
  growth.
