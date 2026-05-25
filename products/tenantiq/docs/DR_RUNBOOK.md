# Disaster Recovery Runbook

> M365 Cert B5. Auditor-readable. Last reviewed: 2026-04-29.

## Targets

| Metric | Target | Notes |
|---|---|---|
| **RTO** (recovery time objective) | 4 hours | for any single failure domain |
| **RPO** (recovery point objective) | 24 hours | nightly D1 export to R2 |
| **Customer-facing SLA** | 99.9% monthly | breached if >43 min downtime/month |

## Failure domains

### FD1 — Cloudflare Worker (api.tenantiq.app)

**Symptom**: 5xx on `/api/*`, no traffic in `wrangler tail`.

**Detect**: Cloudflare Analytics 5xx alert; Sentry surge.

**Recover**:
```bash
# Roll back to last known-good version
cd apps/api
npx wrangler deployments list      # find a healthy version_id
npx wrangler rollback <version_id>
```

If rollback insufficient (Cloudflare-wide incident): see status.cloudflare.com — no DIY remediation; comms-only.

### FD2 — Cloudflare D1 (tenantiq-production)

**Symptom**: D1 query errors, "database not available".

**Detect**: structured-logger errors `[d1]`; Sentry.

**Recover** (data corruption or accidental delete):
```bash
# 1. Identify the last good R2 backup object
npx wrangler r2 object list tenantiq-exports --prefix=backups/d1/ | tail -10

# 2. Download
npx wrangler r2 object get tenantiq-exports/backups/d1/<date>.sql ./d1-restore.sql

# 3. Restore to a fresh D1 then swap binding
npx wrangler d1 create tenantiq-production-restore
npx wrangler d1 execute tenantiq-production-restore --remote --file=./d1-restore.sql
# Update wrangler.toml database_id to new id, deploy, verify, then delete old DB.
```

### FD3 — Cloudflare KV (sessions / Graph tokens)

**Symptom**: all sessions invalid (KV read errors); Graph calls 401 on token miss.

**Recover**: KV is high-durability — actual data loss is extremely rare. Path:

- Sessions are recoverable from cookie JWT (24h TTL) — users re-auth.
- Graph access tokens: deleted by us → next request triggers refresh from `refresh_token` (KV `graph:{tid}:refresh_token_v2`).
- Graph refresh tokens: lost → users must re-consent. Trigger admin email + status-page notice.

### FD4 — Cloudflare R2 (exports, snapshots, reports)

**Symptom**: download requests fail.

**Recover**: R2 has 11x9s durability. Loss is only via accidental delete or bucket policy bug. Restore not possible without a separate cross-cloud backup (currently absent — gap).

**Future**: cross-region R2 replication or weekly mirror to S3 — open item.

### FD5 — Microsoft Graph

**Symptom**: Graph 5xx / 503 / throttling cascade.

**Detect**: error rate alert on `graph-client.ts`.

**Recover**: nothing on our side. Exponential backoff already in place. Customer-facing: status page note "Microsoft Graph degradation — affects sync/scan; cached data still served".

### FD6 — Anthropic / Resend / Twilio / LemonSqueezy / Sentry

**Symptom**: per-feature degradation.

**Recover** (per vendor):
- Anthropic: fall back to cached recommendations; mark AI features as "temporarily unavailable".
- Resend: queue notifications for retry; fall back to in-app inbox only.
- Twilio: SMS suppressed; email + push still active.
- LemonSqueezy: checkout offline; existing subscriptions still valid (no impact to data plane).
- Sentry: error capture loss only; not customer-facing.

## Backups

| What | When | Where | Retention |
|---|---|---|---|
| D1 full export | nightly 02:00 UTC | R2 `backups/d1/<date>.sql` | 30 days |
| KV snapshot | not currently | — | gap — see future work |
| R2 cross-region | not currently | — | gap |
| Worker version | every deploy | Cloudflare native | last 10 |

Future: extend `runNightlyBackup` to include KV `list+get` snapshot to R2 prefix `backups/kv/<date>/`.

## Tabletop drill — quarterly

Each quarter, simulate one FD and time the recovery. Log to `.luna/tabletop/<date>.md`:

- Q1: FD1 — accidental bad deploy → rollback.
- Q2: FD2 — accidental table truncation → R2 restore.
- Q3: FD5 — Graph throttling → fallback UX.
- Q4: FD3 — KV-loss simulation → re-consent flow.

## Comms during incident

See `docs/INCIDENT_RESPONSE.md` for severity matrix + customer notification timing. Status page: status.tenantiq.app (planned — currently a static page on tenantiq.app).
