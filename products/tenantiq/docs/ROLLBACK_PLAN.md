# TenantIQ Rollback Plan

## Workers (API)

```bash
wrangler deployments list                    # List recent deployments
wrangler rollback                            # Rollback to previous version
wrangler rollback --version-id <version>     # Rollback to specific version
```

Workers maintain version history. Rollback is instant and does not affect D1 data.

## Pages (Web Frontend)

1. Go to **Cloudflare Dashboard > Pages > tenantiq-web > Deployments**.
2. Find the last known-good deployment.
3. Click **Rollback to this deployment**.
4. The rollback takes effect within seconds at the edge.

Alternatively, re-deploy from a known-good commit:

```bash
git checkout <commit-hash>
cd apps/web && npm run build && npm run deploy:web
```

## D1 Database

D1 supports point-in-time restore for up to 30 days (paid plans):

```bash
npx wrangler d1 time-travel restore tenantiq-production --timestamp "2026-03-25T12:00:00Z"
```

For migration rollback, apply a reverse migration manually:

```bash
npx wrangler d1 execute tenantiq-production --remote --command "<reverse SQL>"
```

## KV (Key-Value Store)

KV does not support bulk rollback. Data is additive.

- Delete specific bad keys: `wrangler kv key delete --namespace-id <id> <key>`
- For cache corruption, keys expire naturally via TTL.
- For session invalidation, delete `session:*` keys.

## R2 (Object Storage)

R2 object versioning is not enabled by default.

- Snapshots and reports are immutable once written.
- If bad data was uploaded, delete and regenerate.

## Queues

- Pause the consumer: `wrangler queues consumer pause <queue-name>`
- Fix the root cause.
- Resume: `wrangler queues consumer resume <queue-name>`
- Failed messages go to the dead-letter queue for manual reprocessing.

## Decision Matrix

| Symptom | Action |
|---------|--------|
| API returning 500s after deploy | `wrangler rollback` |
| UI broken after deploy | Pages rollback via dashboard |
| Bad data in D1 | D1 time-travel restore |
| Stale cache causing issues | Delete affected KV keys |
| Queue jobs failing | Pause consumer, fix, resume |

## Communication

1. Post in `#tenantiq-incidents` Slack channel.
2. Update status page at [status.tenantiq.app](https://status.tenantiq.app).
3. Notify affected customers if downtime exceeds 5 minutes.
