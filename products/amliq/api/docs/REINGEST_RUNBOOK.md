# Reingest Runbook

Existing rows in the `entities` table were persisted before the parsers
were extended to emit structured name parts (`given_name`,
`family_name`, `original_script`), physical descriptors, vessel info,
topics, positions, death date, and a variety of list-specific metadata.

After deploying new parser code, run one of the commands below on the
Render shell (or locally against a production `DATABASE_URL`) to
refresh the existing data with the new enrichments.

## Full re-ingest (all 80+ lists)

```bash
# Defaults tuned for a 2GB Render pod: 4 lists in parallel,
# 2000-row batches, streaming path used when the parser supports it.
GOMEMLIMIT=1750MiB GOGC=50 \
  go run ./cmd/reingest-global --all
```

- Re-fetches every list in `AllListConfigs()` under the `__global__`
  system tenant.
- Re-parses with the current registered parsers.
- `BulkUpsert` runs **4 parallel batches** per list against Postgres.
- When the registered parser implements `StreamParser` (OpenSanctions
  nested, etc.) the **streaming fast-path** is used — fetch + parse
  pipe directly into batched upsert, peak heap bounded by batch size
  regardless of list size. Critical for the OpenSanctions 600K-row
  feed on 2GB pods.
- `runtime.GC()` runs after each list so memory returns to the OS
  before the next worker picks up its next list.
- Writes a `list_sync_audit` row per list with full field-coverage
  metrics (entities_with_dob / nat / addr / ids / aliases).
- Expected runtime on the Render starter plan: **25–45 minutes**
  (down from 2–4 hours). The improvement comes from:
  - 4x list parallelism (was 1x)
  - 4x upsert parallelism within a list (was 1x)
  - 4x larger batch size (2000 vs 500)
  - Streaming path avoids full-list buffering

### Tuning knobs

| Flag             | Default | Notes |
|------------------|---------|-------|
| `--concurrency`  | 4       | Parallel list workers. 2GB ≈ 4; 4GB ≈ 8; 8GB ≈ 12. |
| `--batch`        | 2000    | Rows per INSERT. Raise to 4000 on large pods. |
| `--timeout`      | 180s    | Per-fetch HTTP timeout. Raise for slow .gov.il sources. |
| `GOMEMLIMIT`     | —       | Set to ~85% of pod memory so Go GC runs aggressively under pressure. |
| `GOGC`           | 100     | Lower to 50 or 25 for faster GC at the cost of slightly more CPU. |

## Single-list refresh

```bash
go run ./cmd/reingest-global --list us_ofac_sdn
go run ./cmd/reingest-global --list un
go run ./cmd/reingest-global --list eu_fsf
```

Use when a single parser was updated or a single source is reporting
stale coverage.

## Dry run (parse only, no DB writes)

```bash
go run ./cmd/reingest-global --all --dry-run
```

Checks that every source still fetches and parses cleanly without
modifying any data. Useful before a big parser refactor.

## Narrow backfill — rich JSONB cols only

```bash
go run ./cmd/backfill-rich --all --batch 8000
```

Only updates `addresses`, `identifiers`, `aliases` JSONB columns via
a TEMP TABLE + single UPDATE...FROM. ~10x faster than `reingest-global`
because it skips the full 17-column upsert and every per-row index
rebuild. Use when the only change is to structured addresses /
identifiers / aliases; use `reingest-global` when scalar columns
(dob, given_name, family_name, original_script) also need updating.

## Monitoring

`list_sync_audit` now includes field-coverage columns:

```sql
SELECT list_id,
       entities_parsed,
       entities_with_dob,
       entities_with_nat,
       entities_with_addr,
       entities_with_ids,
       entities_with_aliases,
       started_at
FROM list_sync_audit
WHERE tenant_id = '__global__'
ORDER BY started_at DESC
LIMIT 20;
```

If a list goes from e.g. `entities_with_dob=60%` → `0%` after a
parser change, the parser regressed and needs investigation.

## Known ceilings and upgrade paths

### OpenSanctions PEP DOB coverage ceiling ~17%

The PEP pipeline currently consumes
`https://data.opensanctions.org/datasets/latest/peps/targets.simple.csv`.
`targets.simple.csv` is a flattened projection; it only carries a
single `birth_date` field and drops secondary dates plus the
structured nested properties. Against the full OpenSanctions corpus
only ~17% of PEPs end up with a populated DOB in our entities table
because the rest only exist in the richer schema.

Upgrade path: switch the PEP ingestor to the
`entities.ftm.json` bulk file (FollowTheMoney entities):

```
https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json
```

Work required (tracked as a separate architecture phase):

1. New streaming parser `opensanctions_ftm` that reads FTM
   JSON-per-line and hydrates the full nested property set.
2. Map FTM properties → domain.Entity fields:
   `birthDate` / `deathDate` / `nationality` / `passportNumber` /
   `idNumber` / `address` / `positionOccupancy` / `family`.
3. Update `AllListConfigs` to point `opensanctions_peps` at the
   FTM URL with the new parser type.
4. Backfill existing PEPs (re-run `reingest-global --list
   opensanctions_peps`) and re-verify DOB coverage — expected
   floor ~80% per the OpenSanctions coverage report.

Until that phase lands, 17% is a dataset ceiling, not a parser
bug. Do not attribute it to parser regressions.

### GLEIF — which path to use

There are two GLEIF ingest binaries now, for two different
situations:

- `reingest-gleif` (paginated API). Uses `api.gleif.org` with
  `page[number]`/`page[size]`. GLEIF caps global pagination at
  ~20K LEIs, so full ingest via this path requires per-country
  chunking via `--jurisdiction XX`. Good for small top-ups, per-
  country refreshes, or lookups tied to a specific filter.
- `reingest-gleif-golden` (bulk XML). Uses the LEI-CDF Golden Copy
  ZIP (~880MB) from `leidata-preview.gleif.org`. Streams through
  the `gleif_xml` parser for the full ~3.28M LEI universe with
  jurisdiction, entity category, full legal address, and
  registration status. The canonical production path.

Trigger via the existing Render cron service:

```bash
# Full universe (runs in hours even on starter; expect 2–4h)
render jobs create crn-d7gg7fl7vvec739jf8fg \
  --start-command "./reingest-gleif-golden --batch 500"

# Specific jurisdiction refresh (seconds to minutes)
render jobs create crn-d7gg7fl7vvec739jf8fg \
  --start-command "./reingest-gleif --jurisdiction IL --max-pages 100"
```
