# AUTH_JWT_SPIKE — Auth failure rate spike (>50/min)

**Severity:** SEV2 (high). May indicate attack or systemic auth break.

## Impact
Auth failure rate exceeded 50/min for 5 min. Possible causes:
- JWKS rotation upstream (legit but customers locked out).
- Clock skew on worker edge.
- Credential stuffing or brute force.
- Bug in token verification (regression).

## Symptoms
- `finsavvy.auth.failures_total` rate spike.
- Customer complaints about being logged out.
- Possible co-fire with `RATE_LIMIT_SPIKE` (under attack).

## Quick diagnosis
```bash
# 1. Top failing reasons.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production \
  | grep '"event":"auth.verify.failed"' | head -50

# 2. Source IP distribution (single IP = attack, broad = systemic).

# 3. JWKS health — fetch issuer's keys.
curl -fsS https://auth.finsavvy.ai/.well-known/jwks.json | jq .

# 4. Edge clock check (CF runs UTC; just sanity).
curl -sI https://ai-gateway.finsavvy.ai/health | grep -i date
```

## Mitigation
1. **Credential stuffing (concentrated IPs):** WAF rate-limit those IPs.
2. **JWKS rotation upstream:** force-refresh JWKS cache.
   ```bash
   wrangler kv:key delete --binding=RESPONSE_CACHE_KV --env production "jwks:current"
   ```
3. **Verification regression after deploy:** roll back.
4. **Engage Security on-call** if attack pattern.

## Root cause investigation
- Cluster failures by `reason` field — `expired`, `invalid_signature`,
  `issuer_mismatch`, `audience_mismatch`.
- Check `iss` of failing tokens — multiple issuers may indicate config drift.

## Rollback procedure
```bash
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production
```
For JWKS issue: no rollback — forward fix by re-fetching keys.

## Verification
- Auth failure rate < 10/min sustained for 15 min.
- Successful sign-in from known good test account.

## Post-incident
- SEV2 → postmortem only if user-impacting >15 min.
- Action: ensure JWKS cache TTL is short enough (<= 1h) to absorb rotations.
