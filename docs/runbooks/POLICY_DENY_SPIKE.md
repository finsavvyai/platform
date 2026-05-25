# POLICY_DENY_SPIKE — Policy engine denial / error spike

**Severity:** SEV2 (high). Either legitimate policy enforcement OR config break.

## Impact
> 20 `PolicyError` events in 5 min. Stable codes (from
`packages/policy-engine/src/`):
- `policy.malformed` — policy JSON is invalid.
- `policy.missing_id` — required id field absent.
- `policy.rule.malformed` — a rule entry is malformed.
- `policy.statement.malformed` — statement structure invalid.

A spike usually means: a new policy was just pushed and is invalid, or a
caller is sending malformed input that hits validation.

## Symptoms
- `finsavvy.audit.code.policy_*` count climbing.
- Customers report 403/denied actions in app.
- Co-fire with `AUTH_JWT_SPIKE` possible (cascading auth/authz break).

## Quick diagnosis
```bash
# 1. Break down by code.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep -E "\"code\":\"policy\." | head -50

# 2. Was a policy just published? (admin audit log)
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep '"event":"policy.published"'

# 3. Validate the current policy bundle.
wrangler kv:key get --binding=RESPONSE_CACHE_KV --env production "policy:bundle:current" \
  | jq .  # should parse cleanly
```

## Mitigation
1. **Malformed policy pushed:** revert to previous bundle.
   ```bash
   # Pull previous from R2 backups (audit logs are append-only — backups in R2).
   wrangler r2 object get finsavvy-audit-production policies/bundle-<PREV_VERSION>.json \
     --file /tmp/prev.json
   wrangler kv:key put --binding=RESPONSE_CACHE_KV --env production \
     "policy:bundle:current" --path /tmp/prev.json
   ```
2. **Caller sending bad input (no recent policy change):** likely an
   integration broke. Engage owner team of the misbehaving caller.
3. **Default-deny in effect**: do NOT relax policy enforcement to "fix"
   the alert.

## Root cause investigation
- Diff the policy bundle pre/post spike.
- Identify the caller(s) producing `policy.rule.malformed` — a downstream
  service may be constructing rules dynamically.

## Rollback procedure
- KV revert above is the rollback for a bad policy publish.
- For code regressions in the engine itself:
  ```bash
  wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
  ```

## Verification
- Policy error rate < 2/min for 15 min.
- Test policy decision via gateway returns expected ALLOW/DENY.

## Post-incident
- SEV2 → postmortem only if customer-visible >15 min.
- Action: enforce schema validation in the policy publish endpoint so a bad
  bundle can't be persisted.
