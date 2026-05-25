# AMLIQ_DECISION_FAIL — AMLIQ decision synthetic failing

**Severity:** SEV2 (high). AMLIQ decision pipeline degraded.

## Impact
Synthetic `amliq-decision` reports `ok=false` for 2 consecutive runs. AML/KYC
decisioning for new transactions may be returning errors or wrong outcomes.

> NOTE: probe `amliq-decision` is **planned, not yet shipped** (see
> rules.yaml note). SYNTHETICS agent owes the script under
> `infrastructure/synthetics/probes/amliq-decision.mjs`. Until then, this
> alert is dormant.

## Symptoms
- `amliq-decision` synthetic red.
- Logs in `finsavvy-amliq-production` worker show errors from the decision
  engine.

## Quick diagnosis
```bash
# 1. Tail the AMLIQ worker.
wrangler tail --env production --format pretty finsavvy-amliq-production

# 2. Manual decision call.
curl -fsS -X POST https://amliq.finsavvy.ai/v1/decide \
  -H "authorization: Bearer $FINSAVVY_AMLIQ_TEST_TOKEN" \
  -H "content-type: application/json" \
  -d '{"customer_id":"test","amount_minor":1000,"currency":"USD"}'

# 3. Check upstream sanction-list/source data freshness.
wrangler kv:key get --binding=AMLIQ_LISTS_KV --env production "lists:meta"
```

## Mitigation
1. **Stale sanctions list:** refresh manually.
   ```bash
   curl -fsS -X POST https://amliq.finsavvy.ai/v1/admin/refresh-lists \
     -H "authorization: Bearer $FINSAVVY_AMLIQ_ADMIN_TOKEN"
   ```
2. **Decision-engine regression:** roll back.
3. **Default-deny applies**: if uncertain, AMLIQ returns DENY (safer than
   false-allow). Do not relax.

## Root cause investigation
- Last deploy of `finsavvy-amliq-production`.
- Last lists update timestamp.
- Provider (sanctions data feed) status.

## Rollback procedure
```bash
wrangler deployments list --env production --name finsavvy-amliq-production
wrangler rollback <VERSION_ID> --env production --name finsavvy-amliq-production
```

## Verification
```bash
node infrastructure/synthetics/run.mjs --probe amliq-decision --env production
# expect ok=true 3x consecutive.
```

## Post-incident
- SEV2 → postmortem if customer-impacting.
- File ticket if `amliq-decision` probe doesn't yet exist (handoff to
  SYNTHETICS agent).
