# Rollback procedures — FinsavvyAI

> Reference. Every runbook in this directory points back here for the
> mechanical "how do I roll this back" steps. Worker names follow
> contract §5: `finsavvy-<service>-<env>`.

## 1. Cloudflare Workers — code rollback

```bash
# Step 1: list recent versions for the worker.
wrangler deployments list --env production --name finsavvy-ai-gateway-production

# Step 2: pick a known-good version-id (typically the one before the bad deploy).
wrangler rollback <VERSION_ID> --env production --name finsavvy-ai-gateway-production

# Step 3: verify within ~60s.
curl -fsS https://ai-gateway.finsavvy.ai/health | jq .status   # expect "ok"

# Step 4: re-run the relevant synthetic.
node infrastructure/synthetics/run.mjs --probe health --env production
```

Works for any worker following the naming convention:

- `finsavvy-ai-gateway-production` / `finsavvy-ai-gateway-staging`
- `finsavvy-amliq-production` / `finsavvy-amliq-staging` (planned)

### Rollback verification gate

A rollback is not "done" until **both** are true:

1. Health endpoint returns `{ status: "ok" }`.
2. The originating alert clears (in Datadog, the monitor returns to OK
   state — not just acked).

## 2. D1 — forward-only schema, code kill switches

D1 migrations are **forward-only**. We do not roll back schema. Instead:

- Every risky code path that depends on a new column/table has an env-var
  **kill switch**. Naming: `FINSAVVY_<SERVICE>_FEATURE_<NAME>_ENABLED`
  (boolean string).
- To disable a bad code path without rolling back schema:
  ```bash
  wrangler secret put FINSAVVY_GATEWAY_FEATURE_<NAME>_ENABLED --env production \
    --name finsavvy-ai-gateway-production
  # value: "false"
  ```
- Old code path must still work — that's enforced by tests.

If a migration corrupted data: stop writes immediately via the kill switch,
then restore the affected rows from the most recent D1 backup
(`wrangler d1 backup list`).

## 3. KV — clearing a poisoned cache namespace

If a poisoned value was written (e.g., bad route table, bad policy bundle):

```bash
# Delete a single poisoned key.
wrangler kv:key delete --binding=RESPONSE_CACHE_KV --env production "<KEY>"

# Or restore from backup (audit log persists every KV write).
wrangler r2 object get finsavvy-audit-production "kv-snapshots/<KEY>-<VERSION>" \
  --file /tmp/restore.json
wrangler kv:key put --binding=RESPONSE_CACHE_KV --env production "<KEY>" \
  --path /tmp/restore.json

# Wholesale namespace purge (DANGEROUS — repopulation will hit origin hard):
# Use the dashboard, not CLI, to require a second human in the loop.
```

KV namespaces in scope:
- `RATE_LIMIT_KV` — rate limit buckets. Safe to purge (regenerates).
- `RESPONSE_CACHE_KV` — response cache + route table + policy bundle.
  Selective deletes only.

## 4. R2 — audit logs (append-only)

**No rollback applies.** Audit logs in `finsavvy-audit-production` are
append-only by policy and by retention rules. If a buggy emitter wrote
malformed lines, the fix is **forward**: deploy a corrected emitter, and
note the malformed window in the postmortem.

To purge a specific object in an extreme case (legal hold, PII leak):

```bash
# Requires two-human approval — must be tracked as a security incident.
wrangler r2 object delete finsavvy-audit-production "<KEY>"
```

## 5. Frontend / CDN (planned)

When frontend lands:

```bash
# Cloudflare Pages rollback.
wrangler pages deployment list --project-name finsavvy-app
wrangler pages deployment retry <DEPLOYMENT_ID>  # promotes prior build

# Force-purge CDN cache after rollback.
# (Use dashboard API or `wrangler cf-api` once available; placeholder.)
```

## 6. Dependency outages — when nothing local works

If `wrangler rollback` doesn't help and code is known-good:

1. Check https://www.cloudflarestatus.com.
2. Check provider status pages (OpenAI, Anthropic, Stripe, LemonSqueezy).
3. If CF is the issue: enable provider failover via route table flip
   (`GATEWAY_ROUTE_FAIL.md` step 1).
4. If a payment provider is down: queue webhooks via D1 and replay when
   the provider recovers (idempotency keys keep this safe).

## 7. Pre-deploy "panic button" sequence

For any urgent rollback during an active incident:

```bash
# One-liner — paste in war room and execute (after confirming version-id).
SERVICE=finsavvy-ai-gateway-production VERSION=<VERSION_ID> ENV=production
wrangler rollback "$VERSION" --env "$ENV" --name "$SERVICE" \
  && curl -fsS https://ai-gateway.finsavvy.ai/health | jq .status \
  && node infrastructure/synthetics/run.mjs --probe health --env production
```

If any step fails: escalate to secondary on-call immediately; do not loop
on the same rollback.
