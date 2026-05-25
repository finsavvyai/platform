# HEALTH_DOWN — Service health endpoint reporting down

**Severity:** SEV1 (critical) — customer-visible outage if sustained.
**Owner team:** Platform.
**Pager:** `@pagerduty-<DD_PD_SERVICE>`.

## Impact
The `/health` endpoint of an AI gateway worker returned `status != "ok"` or
non-200 for 2 consecutive synthetic runs. New requests likely failing.

## Symptoms
- Synthetic `health` shows `{ ok: false, ... }` (see contract §3).
- Dashboard tile "Health" goes red.
- Possible spillover: `GATEWAY_ERROR_RATE`, `GATEWAY_ROUTE_FAIL`.

## Quick diagnosis (5 commands)
```bash
# 1. Confirm from outside CF.
curl -fsS https://ai-gateway.finsavvy.ai/health | jq .

# 2. Confirm staging is also down (regression vs prod-only).
curl -fsS https://ai-gateway.staging.finsavvy.ai/health | jq .

# 3. Live tail the production worker logs.
wrangler tail --env production --format pretty finsavvy-ai-gateway-production

# 4. Last 5 deployments — was a deploy in the last 30 min?
wrangler deployments list --env production --name finsavvy-ai-gateway-production | head -20

# 5. Recent commits — what changed?
git log --since="1 hour ago" --oneline
```

## Mitigation (in order)
1. **If a deploy went out in the last hour:** roll back. See "Rollback" below.
2. **If no recent deploy:** check Cloudflare incident page
   (https://www.cloudflarestatus.com) — regional outage possible.
3. **If health endpoint returns 200 but `status: "degraded"`:** check the
   `checks` array in the response body — one dependency (D1/KV/R2) is down.
   Decide if you can shed load on that dependency (see TOKEN_SPEND_BUDGET +
   RATE_LIMIT_SPIKE runbooks for kill-switch envs).
4. **Post to `#status-finsavvy`** with one-line ETA + scope.

## Root cause investigation
- `wrangler tail` for stack traces; look for `code: "AI_GATEWAY_*"`.
- Cross-reference timestamps with last `wrangler deploy` and last D1 migration.
- Inspect audit log sink (R2 bucket `finsavvy-audit-production`) for
  `event: "health.check.failed"` lines.

## Rollback procedure
```bash
# List recent versions.
wrangler deployments list --env production --name finsavvy-ai-gateway-production

# Roll back to the previous good version-id.
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production

# Verify within ~60s.
curl -fsS https://ai-gateway.finsavvy.ai/health | jq .status
```

If rollback also fails: this is a dependency outage, not code. Move to
`docs/runbooks/_rollback.md` "Dependency outage" section.

## Verification
- Re-run synthetic: `node infrastructure/synthetics/run.mjs --probe health --env production`
- Synthetic result must be `{ ok: true }` for 3 consecutive runs.
- Resolve the alert in Datadog after 5 min of green.

## Post-incident
- SEV1 → mandatory postmortem within 48h (see `_oncall.md` SEV definitions).
- File ticket: `incident/<date>-health-down` with timeline, contributing
  factors, action items.
- Update this runbook if the diagnosis path missed anything.
