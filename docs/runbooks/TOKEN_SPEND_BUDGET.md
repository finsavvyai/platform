# TOKEN_SPEND_BUDGET — Per-tenant token spend over hourly budget

**Severity:** SEV2 (high). Direct revenue/cost exposure.

## Impact
A single tenant's token cost exceeded the placeholder threshold of $50/hour.
Either (a) legitimate burst that should be billed, (b) buggy client looping,
or (c) compromised API key being abused.

> **Threshold $50/h/tenant is a placeholder.** Update once finance signs off
> on per-plan budgets.

## Symptoms
- Datadog grouping by `tenant_id` shows one or more tenants > $50/h.
- Possible co-fire: `RATE_LIMIT_SPIKE` (same tenant).

## Quick diagnosis
```bash
# 1. Top-N spending tenants in the last hour.
# Datadog: top(sum:finsavvy.gateway.token_cost_usd_total{env:production} by {tenant_id}.as_rate(), 10, 'sum', 'desc')

# 2. Per-request cost distribution for that tenant.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep "\"tenant_id\":\"<TENANT_ID>\"" | grep "token_cost_usd"

# 3. Recent provisioning: did tenant upgrade plan? (billing system check)
```

## Mitigation
1. **Likely abuse (key compromised):** revoke their API key + force rotate.
   ```bash
   wrangler d1 execute finsavvy-ai-gateway-production \
     --command "UPDATE api_keys SET revoked=1 WHERE tenant_id='<TENANT_ID>'" --remote
   ```
2. **Legitimate burst:** notify customer (#support); confirm they're aware
   of cost; consider higher quota tier.
3. **Buggy retry loop (their bug):** contact them; offer a temporary
   per-tenant rate cap.
4. **Always engage `@slack-<SLACK_FINANCE>`** so the spend isn't a
   surprise on the next invoice.

## Root cause investigation
- Inspect request shape: prompt size, model selected, retry pattern.
- Check if `BillingEntitlementMissingError`
  (`billing.entitlement.missing`) was raised pre-spike — caller may have
  bypassed entitlement check.

## Rollback procedure
- No code rollback typically applies.
- Forward: revoke key (above) and/or enable tenant kill switch:
  ```bash
  wrangler secret put FINSAVVY_GATEWAY_TENANT_BLOCKLIST --env production \
    --name finsavvy-ai-gateway-production
  # JSON: ["<tenant_id>"]
  ```

## Verification
- Tenant's spend drops to ~0 within 5 min of revoke/block.
- No further alert fires for that tenant in next 1h.

## Post-incident
- SEV2 → postmortem if compromise confirmed.
- File ticket: replace placeholder threshold with per-plan budgets once
  finance signs off.
