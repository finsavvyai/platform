# Verification Queries — Enrichment Pipeline

Runnable SQL to confirm the state of every change shipped in commits
`ee011f9 → 7e9aa3d` and to surface the remaining gaps.

All queries are designed to run via:

```bash
render psql dpg-d73spre3jp1c738or95g-a --command "..."
```

or in an interactive `render psql` session. The queries are grouped
by the gap category they answer. Most run in under a second — the ones
that do full scans over `entities` (2.88M rows) are flagged ⚠️ and
should only run during low-traffic windows or with a `tenant_id`
filter.

---

## 1. Migrations — are the new columns actually there?

```sql
-- 1a. Which migrations are applied? Expect 066_* (2 entries) and 067_*.
SELECT version
FROM migrations_applied
WHERE version LIKE '06%'
ORDER BY version;

-- 1b. Columns added by migration 067 present on entities?
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'entities'
  AND column_name IN ('pep_tier','designation_date','delisting_date',
                      'position_title','place_of_birth','gender')
ORDER BY column_name;

-- 1c. Partial indexes created by 067?
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'entities'
  AND indexname IN ('idx_entities_pep_tier',
                    'idx_entities_designation_date');

-- 1d. list_monitors columns (from migration 066_fix_list_monitors) —
--     should be text, not varchar(20).
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'list_monitors'
  AND column_name IN ('id','tenant_id','list_source')
ORDER BY column_name;

-- 1e. __global__ tenant seeded?
SELECT id, name, display_name FROM tenants WHERE id = '__global__';
```

---

## 2. Coverage snapshot — per list, for every enrichment field

Use `cmd/enrichment-report` for a pretty version. Direct SQL for
ad-hoc filtering.

```sql
-- 2a. Per-list coverage (scope to one tenant to avoid full scan). ⚠️
SELECT list_id,
       COUNT(*)                                                             AS total,
       COUNT(dob)                                                           AS dob,
       COUNT(*) FILTER (WHERE nationalities <> '' AND nationalities IS NOT NULL) AS nat,
       COUNT(*) FILTER (WHERE addresses IS NOT NULL AND jsonb_array_length(addresses) > 0) AS addr,
       COUNT(*) FILTER (WHERE identifiers IS NOT NULL AND jsonb_array_length(identifiers) > 0) AS ids,
       COUNT(*) FILTER (WHERE aliases IS NOT NULL AND jsonb_array_length(aliases) > 0)        AS aliases,
       COUNT(*) FILTER (WHERE pep_tier IS NOT NULL AND pep_tier > 0)        AS pep_tier,
       COUNT(position_title)                                                AS pos_title,
       COUNT(place_of_birth)                                                AS place_of_birth,
       COUNT(gender)                                                        AS gender,
       COUNT(designation_date)                                              AS designation
FROM entities
WHERE tenant_id = 'tnt_54b7fd46d3d3'     -- swap to '__global__' or drop
  AND deleted_at IS NULL
GROUP BY list_id
ORDER BY total DESC;

-- 2b. Tier 2/3 columns populated anywhere in prod?
SELECT 'pep_tier'        AS col, COUNT(*) FROM entities WHERE pep_tier IS NOT NULL AND pep_tier > 0 UNION ALL
SELECT 'designation_date',        COUNT(*) FROM entities WHERE designation_date IS NOT NULL UNION ALL
SELECT 'delisting_date',          COUNT(*) FROM entities WHERE delisting_date IS NOT NULL UNION ALL
SELECT 'position_title',          COUNT(*) FROM entities WHERE position_title IS NOT NULL UNION ALL
SELECT 'place_of_birth',          COUNT(*) FROM entities WHERE place_of_birth IS NOT NULL UNION ALL
SELECT 'gender',                  COUNT(*) FROM entities WHERE gender IS NOT NULL;

-- 2c. Lists that have rows but ZERO enrichment (core AND new columns
--     all empty). Strong candidates for parser-promotion follow-ups.
SELECT list_id, COUNT(*) AS total
FROM entities
WHERE deleted_at IS NULL
  AND dob IS NULL
  AND (nationalities = '' OR nationalities IS NULL)
  AND (addresses IS NULL OR jsonb_array_length(addresses) = 0)
  AND (identifiers IS NULL OR jsonb_array_length(identifiers) = 0)
GROUP BY list_id
HAVING COUNT(*) > 50
ORDER BY total DESC
LIMIT 20;
```

---

## 3. Parser health — which reingest paths succeed vs silently skip

```sql
-- 3a. Recent reingest audits (what's firing + what's failing).
SELECT list_id,
       status,
       started_at::timestamp(0),
       entities_parsed,
       entities_with_dob,
       entities_with_addr,
       error
FROM list_sync_audit
WHERE started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 30;

-- 3b. Lists whose most recent sync parsed 0 entities (parser broken
--     or source unreachable).
WITH latest AS (
  SELECT DISTINCT ON (list_id) list_id, started_at, status,
         entities_parsed, source_bytes, error
  FROM list_sync_audit
  ORDER BY list_id, started_at DESC
)
SELECT list_id, started_at::date, status,
       entities_parsed, source_bytes, LEFT(error, 80) AS err
FROM latest
WHERE entities_parsed = 0
ORDER BY started_at DESC;

-- 3c. List-monitor freshness — which lists haven't synced recently.
SELECT list_source, status,
       last_synced_at::timestamp(0) AS last_sync,
       next_sync_at::timestamp(0)   AS next_sync,
       LEFT(error_message, 80)      AS err
FROM list_monitors
ORDER BY last_synced_at NULLS FIRST
LIMIT 20;
```

---

## 4. Spot-check specific gap lists

```sql
-- 4a. UK OFSI — did the 16MB CSV ever produce rows? What's the latest
--     ingest timestamp? (was 2026-04-11 before fix; newer after reingest.)
SELECT tenant_id, COUNT(*) AS n,
       MIN(created_at)::date AS first,
       MAX(updated_at)::date AS last,
       COUNT(dob) AS dob,
       COUNT(*) FILTER (WHERE addresses IS NOT NULL AND jsonb_array_length(addresses) > 0) AS addr
FROM entities
WHERE list_id = 'uk_ofsi' AND deleted_at IS NULL
GROUP BY tenant_id;

-- 4b. FBI Most Wanted — proof the 7a3d272 write path persisted new
--     rows even with new columns at NULL (parser doesn't populate).
SELECT tenant_id, COUNT(*) AS n,
       MAX(updated_at)::timestamp(0) AS last_upd,
       COUNT(pep_tier)       AS tier_set,
       COUNT(position_title) AS pos_set
FROM entities
WHERE list_id = 'fbi_most_wanted' AND deleted_at IS NULL
GROUP BY tenant_id;

-- 4c. GLEIF LEI — are any entities populated at all? If the commit
--     ee011f9 struct-expansion worked, new rows would have addresses.
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE addresses IS NOT NULL AND jsonb_array_length(addresses) > 0) AS with_addr,
       COUNT(*) FILTER (WHERE identifiers IS NOT NULL AND jsonb_array_length(identifiers) > 0) AS with_ids,
       MAX(updated_at)::date AS last
FROM entities
WHERE list_id = 'gleif_lei' AND deleted_at IS NULL;

-- 4d. ADB — promoted country to nationalities (commit ee011f9)?
SELECT COUNT(*)                                                             AS total,
       COUNT(*) FILTER (WHERE nationalities <> '' AND nationalities IS NOT NULL) AS with_nat,
       COUNT(*) FILTER (WHERE addresses IS NOT NULL AND jsonb_array_length(addresses) > 0) AS with_addr,
       MAX(updated_at)::date                                                AS last
FROM entities
WHERE list_id = 'adb_sanctions' AND deleted_at IS NULL;

-- 4e. OpenSanctions PEPs — after next reingest, pep_tier / gender /
--     position_title should start appearing (PEP parser IS promoting).
SELECT COUNT(*)                                                    AS total,
       COUNT(pep_tier)                                             AS with_tier,
       COUNT(position_title)                                       AS with_pos,
       COUNT(gender)                                               AS with_gender,
       COUNT(place_of_birth)                                       AS with_pob,
       MAX(updated_at)::timestamp(0)                               AS last_upd
FROM entities
WHERE list_id = 'opensanctions_peps' AND deleted_at IS NULL;

-- 4f. PEP tier distribution after reingest.
SELECT pep_tier, COUNT(*)
FROM entities
WHERE list_id = 'opensanctions_peps' AND pep_tier IS NOT NULL
GROUP BY pep_tier
ORDER BY pep_tier;
```

---

## 5. Pipeline health — list_monitors + monitor_alerts + security_logs

```sql
-- 5a. list_monitors populating (deploy expectation from April 16 session).
SELECT COUNT(*)                       AS total,
       COUNT(*) FILTER (WHERE status = 'synced') AS synced,
       COUNT(*) FILTER (WHERE status = 'error')  AS errors,
       MAX(last_synced_at)::timestamp(0) AS last_sync,
       MAX(updated_at)::timestamp(0)     AS last_update
FROM list_monitors;

-- 5b. MonitorWorker re-screening \u2014 any alerts yet?
SELECT alert_type, severity, COUNT(*), MAX(created_at)::timestamp(0)
FROM monitor_alerts
GROUP BY alert_type, severity;

-- 5c. security_logs is live \u2014 per-hour request volume.
SELECT date_trunc('hour', timestamp) AS hour,
       COUNT(*)                       AS n,
       COUNT(DISTINCT tenant_id)      AS tenants,
       AVG(duration_ms)::int          AS avg_ms
FROM security_logs
WHERE timestamp > NOW() - INTERVAL '6 hours'
GROUP BY 1
ORDER BY 1 DESC;

-- 5d. security_logs sanity \u2014 what paths are hit most?
SELECT path, COUNT(*), status_code
FROM security_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY path, status_code
ORDER BY COUNT(*) DESC
LIMIT 10;
```

---

## 6. Hunt the remaining source-side gaps

```sql
-- 6a. Lists not in AllListConfigs but have rows in prod (orphaned
--     seeds that won't auto-refresh). Compares distinct list_ids in
--     entities vs a hardcoded expected set from AllListConfigs. Run
--     with fresh output and cross-check against internal/ingestion/
--     list_sources.go + all_lists.go.
SELECT list_id, COUNT(*) AS n, MAX(updated_at)::date AS last_upd
FROM entities
WHERE deleted_at IS NULL
GROUP BY list_id
ORDER BY n DESC;

-- 6b. Which lists had their most recent sync succeed but parsed 0?
--     These are the parser-format bugs (UK OFSI, US BIS Denied).
SELECT list_id, source_bytes, entities_parsed,
       started_at::timestamp(0)
FROM list_sync_audit
WHERE entities_parsed = 0
  AND source_bytes > 10000
  AND started_at > NOW() - INTERVAL '24 hours'
ORDER BY source_bytes DESC;

-- 6c. Lists that errored on fetch (4xx/5xx/connection) \u2014 source-side,
--     not parser. Cross-ref with AllListConfigs URL to know which
--     need a new URL.
SELECT list_id, LEFT(error, 120) AS err, started_at::timestamp(0)
FROM list_sync_audit
WHERE status = 'error'
  AND started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC
LIMIT 20;
```

---

## 7. Quick sanity checks

```sql
-- 7a. Any entity with every enrichment column populated? Picks one
--     "gold standard" row per list to eyeball the shape.
SELECT list_id, full_name, dob, pep_tier, position_title,
       place_of_birth, gender, jsonb_array_length(addresses) AS naddr
FROM entities
WHERE pep_tier IS NOT NULL
  AND position_title IS NOT NULL
  AND addresses IS NOT NULL AND jsonb_array_length(addresses) > 0
LIMIT 5;

-- 7b. Row-count delta \u2014 quick proof the reingest jobs wrote new rows.
SELECT list_id, COUNT(*) AS n,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '2 hours') AS new_today
FROM entities
WHERE deleted_at IS NULL
GROUP BY list_id
HAVING COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '2 hours') > 0
ORDER BY new_today DESC;

-- 7c. Metadata keys still holding enrichment that should be on
--     first-class columns (tells us which parsers to promote next).
SELECT list_id,
       COUNT(*) FILTER (WHERE metadata ? 'pep_tier'    AND pep_tier IS NULL)  AS unpromoted_tier,
       COUNT(*) FILTER (WHERE metadata ? 'position'    AND position_title IS NULL) AS unpromoted_pos,
       COUNT(*) FILTER (WHERE metadata ? 'birth_place' AND place_of_birth IS NULL) AS unpromoted_pob,
       COUNT(*) FILTER (WHERE metadata ? 'gender'      AND gender IS NULL)    AS unpromoted_gender
FROM entities
WHERE deleted_at IS NULL
GROUP BY list_id
HAVING COUNT(*) FILTER (WHERE metadata ? 'pep_tier'    AND pep_tier IS NULL) > 0
    OR COUNT(*) FILTER (WHERE metadata ? 'position'    AND position_title IS NULL) > 0
    OR COUNT(*) FILTER (WHERE metadata ? 'birth_place' AND place_of_birth IS NULL) > 0
    OR COUNT(*) FILTER (WHERE metadata ? 'gender'      AND gender IS NULL) > 0
ORDER BY list_id;
```

---

## What each query proves (at a glance)

| Query | If this passes, it proves… |
|---|---|
| 1a-1e | Migrations 066 + 067 shipped; schema matches code |
| 2a | Per-list coverage snapshot (baseline for before/after comparisons) |
| 2b | At least one row exists with each Tier 2/3 column populated — end-to-end write path works |
| 2c | Lists that are dead-empty on enrichment (strongest promotion candidates) |
| 3a-3c | Reingest cron is firing; list_monitors is up to date |
| 4a-4f | Targeted spot checks for the four "fixed today" lists + PEPs |
| 5a-5d | Pipeline tables from yesterday's session are still working |
| 6a-6c | Source-side issues (bad URL, wrong parser format) surface cleanly |
| 7a-7c | Gold-standard row visible; recent writes visible; unpromoted metadata counted |

---

## Recommended run order

1. **1a–1e** — confirm schema (30s)
2. **2b** — confirm any row has new columns populated (30s)
3. **3a–3b** — see what reingest is doing (30s)
4. **6b–6c** — see which specific lists need attention (30s)
5. **4a–4f** — targeted spot-checks on gap lists (2 min)
6. **7c** — prioritize which parsers to promote next (1 min)

Only run **2a** and **6a** with `--tenant` scope or during a quiet
window — they're full scans over 2.88M rows and caused a postgres
recovery event earlier today when run unscoped under load.
