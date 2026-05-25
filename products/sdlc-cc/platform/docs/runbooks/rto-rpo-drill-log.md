# RTO/RPO Drill Log

Record actual RTO and RPO from rollback and DR drills. See [WORKDAY_PLAN_PRODUCTION.md](../../WORKDAY_PLAN_PRODUCTION.md) Day 7 and [rollback-procedures.md](./rollback-procedures.md).

---

## Target objectives

| Metric | Target | Source |
|--------|--------|--------|
| **RTO** (Recovery Time Objective) | &lt; 1 hour (production) | WORKDAY_PLAN_PRODUCTION |
| **RPO** (Recovery Point Objective) | &lt; 5 minutes | WORKDAY_PLAN_PRODUCTION |
| **DR RTO** (full platform) | 30 min | [DISASTER_RECOVERY_PLAN.md](../../deployments/cloudflare/docs/DISASTER_RECOVERY_PLAN.md) |
| **DR RPO** | 1 min (data), 5 min (config) | Same |

---

## Drill log (fill after each drill)

| Date | Scope | RTO achieved | RPO (data loss window) | Notes |
|------|--------|--------------|--------------------------|-------|
| _e.g. 2026-03-15_ | _Gateway rollback_ | _2 min_ | _N/A_ | _kubectl rollout undo_ |
| | | | | |
| | | | | |

**How to run a rollback drill:**

1. Pick one critical service (e.g. Gateway). Note revision before drill.
2. Simulate “bad” deploy (e.g. scale to 0 or deploy a known-bad image) or use a staging env.
3. Execute rollback: `kubectl rollout undo deployment/<service>` (see [rollback-procedures.md](./rollback-procedures.md)).
4. Measure time from “go” to “health checks green” → record as RTO.
5. If data was involved, record worst-case data loss window → RPO.
6. Update this table and [DISASTER_RECOVERY_PLAN.md](../../deployments/cloudflare/docs/DISASTER_RECOVERY_PLAN.md) if targets change.

---

*Last updated: 2026-03-06.*
