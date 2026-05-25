# Postgres + pgvector — Disaster Recovery

**RPO:** ≤ 15 minutes — at most 15 min of writes are at risk in a region-loss event.
**RTO:** ≤ 1 hour — staging and prod must be back online within 60 min.

This runbook is rehearsed weekly via `.github/workflows/dr-drill.yml`
and tested in production form during the quarterly DR exercise.

## Why pgBackRest, not pg_dump

`pg_dump` produces a logical snapshot — for the platform's
multi-tenant, RLS-enforced corpus that's safe but takes hours and
loses fine-grained PITR. We use **pgBackRest** with a 15-minute WAL
archive cadence so any second within the retention window is
recoverable.

## Topology

```
                ┌──────────────────┐
                │  primary (RW)    │
                │  postgres+pgvec  │
                └─────────┬────────┘
                          │ streaming WAL
                ┌─────────┴────────┐
                │  hot standby     │
                └─────────┬────────┘
                          │ WAL archive (every 15m)
                ┌─────────┴────────┐
                │  S3 (Object Lock)│  ← 90-day governance retention
                └──────────────────┘
```

S3 Object Lock **governance mode** with 90-day retention prevents
malicious or accidental deletion during the window. Cross-region
replication mirrors the bucket to a second region within 5 minutes.

## Backup cadence

| Type | Frequency | Retention |
| --- | --- | --- |
| Full | Sunday 02:00 UTC | 4 weeks |
| Differential | Daily 02:00 UTC | 14 days |
| WAL archive | every 15 min | 90 days |

Backups land in `s3://sdlc-pg-backups-prod/` (and the EU mirror
bucket); the structure is enforced by the `pgbackrest.conf` shipped
in `deployments/scripts/pgbackrest.conf`.

## Manual backup

Use only when the scheduled job has been muted intentionally — the
weekly drill verifies the scheduler is healthy.

```bash
# from the primary host, as the postgres user
bash deployments/scripts/backup.sh --type full
# bash deployments/scripts/backup.sh --type diff   # default
```

The script verifies the backup completed (`pgbackrest info`),
publishes a Prometheus `last_pgbackrest_run_seconds` gauge, and
exits non-zero if anything failed.

## Restore — staging

For weekly drills + ad-hoc developer recovery.

```bash
# Default: restore latest, verify pgvector + RLS
bash deployments/scripts/restore.sh staging

# Point-in-time:
bash deployments/scripts/restore.sh staging --target "2026-04-25 14:30:00 UTC"
```

The script:

1. Stops the staging Postgres container.
2. Wipes its data dir.
3. `pgbackrest restore --target=...` with the requested timestamp.
4. Starts Postgres and waits for `pg_isready`.
5. Re-creates the `pgvector` extension if missing.
6. Probes RLS by attempting a cross-tenant SELECT and asserting it returns 0 rows.
7. Posts the result (success / failure / duration) to the `#sdlc-dr` Slack channel.

## Restore — production

**Approval gate**: an incident commander + the on-call DBA must both
approve the destructive restore. The script enforces this by
requiring two `--ack-incident=<id>` flags from distinct users.

```bash
bash deployments/scripts/restore.sh prod \
  --target "2026-04-25 14:30:00 UTC" \
  --ack-incident=INC-1234 \
  --ack-secondary=INC-1234
```

After restore, run the post-restore checklist:

- [ ] `pg_isready` returns 0
- [ ] `SELECT extname FROM pg_extension` includes `vector`
- [ ] `SELECT count(*) FROM pg_policies` matches the migration baseline
- [ ] Run `services/gateway/scripts/check-rls.sh` — must pass
- [ ] Verify a known fixture row exists with the expected `tenant_id`
- [ ] Restart the gateway and replay the last 1000 audit events against the live API to confirm responses match
- [ ] Update the `restored_at` ts in the runbook log at the bottom

## RPO ≤ 15 min — how it's enforced

- WAL archive cadence: `archive_timeout = 15min` in
  `postgresql.conf`. If a 15-minute window passes without a WAL
  segment fill, Postgres force-rotates and ships it.
- The drill script checks the most-recent S3 object's
  LastModified is within 16 minutes of `now()` and fails if not.
- Prometheus alert `PgWALArchiveStale` fires when no new archive
  appears for 30 minutes — pages on-call.

## RTO ≤ 1 hr — how it's enforced

The weekly drill writes the elapsed restore time to
`docs/runbooks/rto-rpo-drill-log.md`. If any drill exceeds 60
minutes the runbook owner files a `dr-rto-regression` incident.

## Failure modes + countermeasures

| Failure | Detection | Mitigation |
| --- | --- | --- |
| WAL archive stalls | `PgWALArchiveStale` alert | Manual `pgbackrest archive-push`; investigate disk I/O on primary |
| pgBackRest cannot reach S3 | scheduler exit code | Switch to local-disk staging until S3 access restored |
| Region-wide S3 outage | CloudWatch + observation | Restore from EU mirror bucket via `--repo=eu` flag |
| Corruption in latest full | `pgbackrest verify` mismatch | Restore from prior full + replay diff + WAL |
| pgvector index lost on restore | post-restore probe fails | `REINDEX DATABASE sdlc` — adds ~10 min for a 1M-vector corpus |

## Quarterly exercise — checklist

- [ ] Stand up an isolated VPC in a clean region.
- [ ] Restore most recent full backup.
- [ ] Replay 24h of WAL.
- [ ] Verify a fixture document survives the round-trip via the gateway API.
- [ ] Time the elapsed minutes; record in the drill log.
- [ ] Tear down the practice VPC.
- [ ] Update this runbook with anything that surprised the team.

## Drill log

See `docs/runbooks/rto-rpo-drill-log.md` — kept separate so the
runbook itself stays stable and the log can grow without merge churn.
