# Redis (cache + queue) — Disaster Recovery

**RPO:** ≤ 60 seconds — at most 60 seconds of pub/sub events or queue
state are at risk.
**RTO:** ≤ 5 minutes — failover to the standby completes within 5 min.

The platform uses Redis for three distinct workloads, each in its own
logical database to keep failure modes scoped:

| DB | Workload | Persistence | Reload tolerance |
| --- | --- | --- | --- |
| 0 | Rate-limit sliding window | RDB + AOF | Tolerable: a flush re-stamps within one window |
| 1 | RAG response cache | RDB only | Tolerable: cold cache adds ≤200ms to p95 |
| 2 | BullMQ document-processing queue | RDB + AOF | NOT tolerable — losing inflight jobs strands user uploads |

DB 2 (the queue) is the load-bearing one. The DR procedure below is
written for DB 2 explicitly; DBs 0 and 1 follow the same shape but
can accept faster, looser flushes.

## Topology

```
            ┌───────────────────┐
            │ primary (RW)      │
            │ AOF every 1s      │
            └─────────┬─────────┘
                      │ async replication
            ┌─────────┴─────────┐
            │ replica (RO)      │
            │ AOF every 1s      │
            └─────────┬─────────┘
                      │ AOF rewrite + RDB snapshot
            ┌─────────┴─────────┐
            │ S3 (Object Lock)  │  ← 30-day retention
            └───────────────────┘
```

`appendfsync everysec` keeps the worst-case write loss to ~1 second.
RDB snapshots ship to S3 every 5 minutes via a sidecar that also
copies the AOF tail.

## Failover — automatic (Sentinel)

We run 3 Redis Sentinel nodes in separate AZs.

```
sentinel monitor sdlc-cache 10.0.1.10 6379 2
sentinel down-after-milliseconds sdlc-cache 5000
sentinel parallel-syncs sdlc-cache 1
sentinel failover-timeout sdlc-cache 30000
```

Failover is automatic when 2 of 3 Sentinels agree the master is
unreachable for >5s. The platform clients (gateway, document-
processor, realtime) discover the new master via Sentinel's
`SENTINEL get-master-addr-by-name` so no manual reconfig is needed.

## Failover — manual (Sentinel itself dies)

If Sentinel is unreachable AND the primary is up but isolated:

```bash
# On a healthy replica:
redis-cli REPLICAOF NO ONE              # promote
# Update DNS / Consul to point at the new primary.
deployments/scripts/redis-promote.sh sdlc-cache replica-2
```

Update each client service's `REDIS_URL` env var (k8s ConfigMap or
SSM Parameter Store) and roll the deployments.

## Restore from backup — DB 2 only

Use when AOF + replica have BOTH been corrupted (rare; usually a
config change blast radius).

```bash
# Stop both primary + replica.
deployments/scripts/redis-restore.sh prod queue --target "2026-04-25T14:30:00Z"
```

The script:
1. Stops Redis on the target host.
2. Pulls the most recent RDB + AOF tail from S3 prior to `--target`.
3. Replaces `dump.rdb` and `appendonly.aof` in the data dir.
4. Starts Redis with `aof-load-truncated yes` so a partial AOF tail
   doesn't refuse boot.
5. Verifies the queue has the expected key shapes via
   `redis-cli KEYS "bull:*"`.
6. Posts to `#sdlc-dr` Slack.

## Cache cold-start (DB 1)

```bash
redis-cli -n 1 FLUSHDB
```

That's it — the gateway will populate as queries come in. Pre-warm if
needed via the warm-cache script:

```bash
bash deployments/scripts/redis-warm-cache.sh
```

## Quarterly exercise

- [ ] Trigger a Sentinel failover in staging by killing the primary.
- [ ] Verify clients reconnect within 30s.
- [ ] Inspect `bull:*` queue depth — must equal pre-failover snapshot ±1%.
- [ ] Time the elapsed minutes; record in `rto-rpo-drill-log.md`.

## Failure modes + countermeasures

| Failure | Detection | Mitigation |
| --- | --- | --- |
| Primary OOM | `redis_maxmemory_used_pct > 95` alert | `MAXMEMORY-POLICY` is `allkeys-lru` for DB 0+1, `noeviction` for DB 2 — DB 2 raises an error so the producer can backpressure |
| AOF corruption | startup fails with parse error | `redis-check-aof --fix appendonly.aof`; if irrecoverable, restore from S3 |
| Replication lag > 60s | `redis_replication_lag_seconds` alert | Investigate network; failover if persistent |
| Split brain | Sentinel disagreement | Manual promote of the replica with the highest `master_repl_offset` |

## Drill log

See `docs/runbooks/rto-rpo-drill-log.md`.
