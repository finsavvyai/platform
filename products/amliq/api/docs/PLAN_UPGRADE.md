# Render plan upgrade — what, why, how

## Why

The starter Postgres plan (1GB RAM, shared CPU) goes into recovery
mode under sustained bulk upsert load. Observed failures during
reingest-global runs of large lists:

- `us-sam-exclusions` (127K entities)
- `opensanctions_peps` via FTM JSON (707K entities)
- `gleif_lei` via api.gleif.org (3.28M entities total)

The cron plan (starter, 512MB) is also near the limit for the
opensanctions_peps FTM feed (800MB download).

## What to upgrade

### 1. Postgres — Render dashboard

- Database: **amliq** (id `dpg-d73spre3jp1c738or95g-a`)
- **Current**: Starter — 1GB RAM, 1 shared CPU
- **Recommended**: Standard — 4GB RAM, 1 dedicated CPU

Path: Render dashboard → amliq database → **Change Plan** → Standard.
Render performs a rolling upgrade; the primary takes a short
maintenance window but connections reconnect automatically.

### 2. Cron — `amliq-reingest-israeli-treasury`

- Service: `crn-d7gg7fl7vvec739jf8fg`
- **Current**: Starter — 512MB RAM
- **Recommended**: Standard — 2GB RAM (room for 800MB FTM + Go runtime)

Path: Render dashboard → amliq-reingest-israeli-treasury → Settings
→ **Instance Type** → Standard.

## After upgrade — revert conservative settings

Once the larger plan is live, un-throttle:

1. `internal/storage/pgx/entity_bulk.go`

   ```go
   const (
       batchSize       = 2000  // was 200
       bulkParallelism = 4     // was 1
       interBatchPause = 0     // was 40 * time.Millisecond
   )
   ```

2. `cmd/reingest-global/main.go`

   ```go
   timeout = flag.Duration("timeout", 10*time.Minute, ...)
   ```

Commit + deploy. Re-run large lists:

```bash
for L in us-sam-exclusions opensanctions_peps; do
  render jobs create crn-d7gg7fl7vvec739jf8fg \
    --start-command "./reingest-global --list $L" --confirm
done
```

## Cost impact

- Postgres Standard: ~$95/mo (up from ~$19/mo starter)
- Cron Standard: ~$25/mo per instance (up from ~$7/mo starter)
- **Total delta**: ~$94/mo

If the budget bar is lower, keep the throttled config and run
reingests off-peak; they'll succeed, just slower.
