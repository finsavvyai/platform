# Enrichment & Sync Gap Audit — April 18, 2026

Comprehensive audit across every list config + the sync process flow.
Builds on docs/deploy-verification-2026-04-17.md + the Tier 1–4
commits landed today (`ee011f9 → 7e9aa3d`).

## Scope

Inventoried code:
- `internal/ingestion/all_lists.go`
- `internal/ingestion/list_sources.go`
- `internal/ingestion/enforcement_debarment.go`
- `internal/ingestion/country_direct_feeds.go`
- `internal/ingestion/ofac_secondary_lists.go`
- `internal/ingestion/corporate_registries.go`
- `internal/ingestion/pep_sources_extended.go`
- `internal/ingestion/regulatory_actions.go`
- `internal/ingestion/israeli_property_lists.go`
- `internal/ingestion/registry_init*.go`
- Cross-referenced with `list_sync_audit` (last 3 days) + entity counts.

Total surface: **89 unique list configs**, **44 registered parser types**.

---

## A. Per-list data-completeness gaps

### A1. Parser type doesn't exist (silent-skip)

Two lists reference parser types that aren't in `registry_init*.go`. Every
sync skips with `no parser registered for type: X` and produces 0 entities.
Neither is flagged as a `failed` status — they're counted as `ok` or `skipped`.

| list_id | parser_type | file |
|---|---|---|
| `us-bis-entity` | `generic_csv` | ofac_secondary_lists.go:26 |
| `fr-tresor-direct` | `generic_xml` | country_direct_feeds.go:26 |

**Fix**: choose a registered parser. `us-bis-entity` URL is an HTML
landing page anyway — either migrate to the OS mirror
(`us_bis_entity/targets.simple.csv`) with parser `opensanctions_bulk`,
or disable the config. `fr-tresor-direct` should use `opensanctions_bulk`
against `fr_dgtresor_sanctions/targets.simple.csv`.

### A2. Parser returns 0 entities but status is "ok" (silent-0-parse)

From `list_sync_audit` (last 3 days). Big fetches producing nothing:

| list_id | bytes fetched | parsed | diagnosis |
|---|---|---|---|
| `uk_ofsi` | 16.6 MB (new URL) | 0 | Real CSV now retrieved, `Name 1`/`Name 6` column anchor no longer matches the 2025+ UK OFSI schema |
| `us-bis-denied` | 166 KB | 0 | `bis_denied` parser expects a specific column layout that doesn't match the live `dpl.txt` |

**Fix**: re-read a sample of each feed, update parser column anchors, add
a golden-file test from the real feed so regressions surface in CI.

### A3. Parser gets wrong content type

| list_id | bytes fetched | result | diagnosis |
|---|---|---|---|
| `seco` | 38.7 MB | `parse error on line 1, column 15: bare " in non-quoted-field` | `swiss` parser reads CSV but the SECO URL serves XML (Swiss SESAM) |
| `israeli_mod` | 212 B | `parse error on line 3, column 12: bare " in non-quoted-field` | Incapsula-protected landing page returns HTML; list is disabled but still scheduled |

**Fix**: for SECO, either switch the URL to the OpenSanctions mirror
(`ch_seco_sanctions/targets.simple.csv` with `opensanctions_bulk`) or
plumb an XML parser for the SESAM SpreadsheetML format. For
`israeli_mod`, it's already `SyncEnabled: false` but audit rows still
exist — confirm it's being filtered out of scheduled paths too.

### A4. Source URL is 4xx/5xx (fetch-fails)

| list_id | error | status after today |
|---|---|---|
| `worldbank-debar` | http 404 | **Fixed** — commit switched to `os+worldbank_debarred/targets.simple.csv` |
| `us-sam-exclusions` | http 500 | **Fixed** — commit switched to `os+us_sam_exclusions/targets.simple.csv` |
| `au-dfat-direct` | connection reset | **Fixed** — commit switched to `os+au_dfat_sanctions/targets.simple.csv` |

All three will succeed on the next reingest. Pattern going forward:
**prefer the OpenSanctions mirror** over direct government URLs — the
mirror is stable, normalized, and `opensanctions_bulk` already emits
every enrichment field we care about.

### A5. Upsert failure — duplicate IDs in a single batch

One `israeli_treasury` audit row showed:

```
upsert: batch upsert [0:8]: ERROR: ON CONFLICT DO UPDATE
command cannot affect row a second time
```

Classic "two rows with the same `id` in one `INSERT ... ON CONFLICT`".
Our `bulkUpsert` batches 2000 rows/request; if the parser produces
duplicate entity IDs inside that window the whole batch fails.

**Fix**: either (a) dedupe `[]Entity` by ID before `BulkUpsert`, or (b)
parser-level dedupe in `israeli_treasury.go`. (a) is the defensive move
that benefits every parser.

### A6. Parsers emit enrichment to metadata only

Tier 2+3 (migration 067) landed first-class columns `pep_tier`,
`designation_date`, `delisting_date`, `position_title`, `place_of_birth`,
`gender`. Of the 44 parsers, only **two** promote metadata to these
columns today:

- `opensanctions_pep_enrich_props.go` — full promotion
- `uk_ofsi_fields.go` — partial (position + place of birth)

Parsers that have the data sitting in metadata but haven't been
promoted yet (prioritized by row volume):

| parser | list_ids | approx rows | fields sitting in metadata |
|---|---|---|---|
| `opensanctions_bulk` | ~55 lists | largest share | `pep_tier` (string), `position`, `gender`, `birth_place`, `listing_date`, `first_seen`, `last_seen` |
| `opensanctions_nested` | `opensanctions_default` | ~555K | same |
| `un` | `un` | ~1K | `gender`, `birth_place`, `listing_date`, `position` |
| `eu` | `eu_fsf` | ~5.7K | `gender`, `birth_place`, `listing_date` |
| `ofac` / `ofac_advanced` | all ofac-* | varies | `programs`, `listing_date` |
| `israeli_treasury` | 1 | varies | `listing_date` |
| `fbi_wanted` | `fbi-wanted` | ~50 | `birth_place`, `gender`, `listing_date` |
| `gleif` | `gleif-lei` | ~10K | `legal_form`, `registration_status` |
| `dev_banks` | `adb-debar`, `ebrd-debar` | ~1-5K | `listing_date`, `delisting_date` (needs date parse) |
| `swiss`/`seco` | `seco` | broken | — |
| remaining 32 parsers | various | small | `listing_date`, `position`, `programs` |

**Fix**: centralize. Add a `promoteMetadataToColumns(*Entity)` helper
in `internal/ingestion/enrich_common.go` and call it from every
parser's final enrichment step. That way one function maps:

- `metadata.position` → `PositionTitle`
- `metadata.birth_place` → `PlaceOfBirth`
- `metadata.gender` → `Gender`
- `metadata.listing_date` → `DesignationDate` (with date parse)
- `metadata.delisting_date` → `DelistingDate`

Then every parser gets Tier 2+3 columns for free on the next reingest.

### A7. Orphaned lists — data in prod but not in `AllListConfigs`

From yesterday's queries: `gleif_lei`, `adb_sanctions`, and legacy `fbi-wanted`
rows exist in entities but no `AllListConfigs` entry targets those ids.
They were loaded via a different path (`cmd/seed` or ad-hoc) and will
never auto-refresh.

**Fix**:
- `gleif_lei` is registered in `pep_sources_extended.go:61` as `gleif-lei`
  (hyphen). Prod data is keyed `gleif_lei` (underscore). Either migrate
  prod ids or alias the parser.
- `adb_sanctions` has prod data; config is `adb-debar` (OS mirror, different
  id). Recommend: keep `adb-debar` live, migrate the 1,302 orphan rows to
  `adb-debar` and drop the orphan id.
- `fbi-wanted` in `tnt_54b7fd46d3d3` has 20 rows keyed that id — those
  are stale from before the `fbi-wanted` cron started writing to
  `__global__`. Same migration choice.

---

## B. Process-flow gaps in the sync

These are systemic — they affect every parser, not just the ones above.

### B1. 0-entity parses are "ok", not alerted

`list_sync_audit` records `status='ok'` whenever the HTTP fetch and
parse call both return without an error — even if the parser yielded
zero rows on 16 MB of input. That's silent data rot.

**Fix** — `internal/ingestion/sync_recorder.go`:

```
// If status == ok but entities_parsed == 0 AND source_bytes > 10KB,
// mark status as "suspect" and raise an alert via recorder.Alert().
```

Threshold should be per-list (some small feeds legitimately have 0–5
entries). A simple heuristic: suspect if `parsed == 0` and the last
successful sync had `parsed > 0`.

### B2. Normal sync path skips `list_sync_audit` entirely

From yesterday's finding: only `RefreshService.refreshTenant` and
`cmd/reingest-global` emit audit rows. The 10-minute
`SyncWorker.RunLoop` ticker calls `SyncService.SyncList` directly and
writes nothing to the audit table. Result: **most syncs leave no trace**.

Options:
1. Route `SyncWorker` through `RefreshService` (loses the per-tenant
   ticker semantics).
2. Give `SyncService` its own optional recorder (like `lmHook`) so
   every `SyncList` call can record a minimal audit row.
3. Emit audit rows only when `delta != 0` (change detected) — limits
   volume while still catching silent-0 regressions.

**Recommended**: option 3. Implementation: in `SyncService.SyncList`,
after `DeltaEngine.Diff` returns, call `recorder.Record(...)` only if
the delta is non-zero OR the coverage changed by > 5%.

### B3. `ListMonitorHook` also skips the normal sync path

Same code path issue: the ticker sync doesn't fire the hook. That's
why `list_monitors` only populates from `RefreshService` +
`cmd/reingest-global`. Same fix as B2 — feed the hook from
`SyncService` too, not just the outer loops.

### B4. `cmd/reingest-global` bypasses the audit for the "parsed 0" signal

`reingest_one.go` does log `parsed 0 entities` to stdout but doesn't
set `status='failed'` on that case. The audit row ends up `ok`,
hiding the problem.

**Fix** — in `cmd/reingest-global/reingest_one.go`, when
`len(parsed) == 0 && sourceBytes > someThreshold` treat as a
failure and return an error so the cron exit code is non-zero.
That also feeds the Render cron's `notifyOnFail` settings.

### B5. No golden-file tests for real-world feeds

Every "parser returns 0 entities" bug we found today (UK OFSI, US BIS
Denied, SECO, Israeli MoD) would have been caught by running the
parser against a saved real feed in `samples/`. We have
`samples/README.md` and a few fixture files but no parser-vs-fixture
tests for the 15 critical lists.

**Fix**: check real feeds into `samples/<list_id>.csv` (scrubbed if
needed), add table-driven tests that parse them and assert
`len(entities) > 0` and coverage thresholds. Update fixtures on a
quarterly cadence.

### B6. No schema validation on parser output

There's no enforcement that, e.g., a "PEP" list parser actually
produces entities with `type=Individual` + `pep_tier != 0`, or that
a corporate registry parser produces `type=Company` rows. Right now
an empty parser signature (all names but no enrichment) passes.

**Fix**: add per-parser validator hooks in `registry_type.go`. When
`RegisterType(name, parser, WithValidator(v))` is present, post-parse,
validate a sample of entities and fail the sync if the contract
doesn't hold (e.g., "PEP parser emitted 0 rows with pep_tier set").
Low-cost safety net.

### B7. `list_monitors` retry schedule is static per-sync

A failed sync sets `next_sync_at` to `nextCronRun(schedule)` — same as
a successful one. A list that 404s daily will keep re-fetching on the
same schedule with no exponential backoff.

**Fix**: when `status='error'` for N consecutive syncs, push
`next_sync_at` out by `2^N * schedule_interval` capped at 24h. Stored
in `list_monitors` (already has `error_message` + `status` columns).

### B8. Postgres memory / heavy-query posture

The enrichment-report queries (`SELECT list_id, max(updated_at) ... GROUP BY list_id`)
crashed the prod Postgres twice today. Render's standard plan on pg16
has limited shared buffers and our entities table is 2.88M rows
without stats tuned for this kind of aggregate. Each crash triggers
a ~30–60s recovery during which syncs and API writes fail.

**Fix**: three options, in order of value:
1. `CREATE INDEX CONCURRENTLY idx_entities_list_updated ON entities(list_id, updated_at DESC);`
   — covers `max(updated_at) GROUP BY list_id`, collapses the scan to an index scan.
2. Partition `entities` by `list_id` (Postgres 18 native partitioning).
   Heavier but pays off at 5M+ rows.
3. Materialized summary table — `entity_coverage_stats` refreshed hourly
   by a cron job, queried instead of live `entities`.

---

## C. Priority fix order

| Priority | Fix | Commit scope | Impact |
|---|---|---|---|
| P0 | B5 — golden-file tests for UK OFSI, US BIS Denied, SECO, Israeli MoD | 4 fixture files + 4 test cases | Stops silent-parse-0 regressions for the 4 known-broken parsers |
| P0 | A5 — dedupe by ID in `bulkUpsert` | 10 LOC in entity_bulk.go | Unblocks `israeli_treasury` reingest |
| P0 | B8 (1) — index on `(list_id, updated_at DESC)` | one migration | Stops prod DB from crashing under enrichment-report load |
| P1 | A6 — `promoteMetadataToColumns` helper + call from every parser | new enrich_common.go + ~25 parser edits | Populates Tier 2+3 columns across the full 55+ list footprint |
| P1 | B1 — "suspect" status for 0-parse with bytes | 15 LOC in sync_recorder | Surfaces broken parsers as alerts, not "ok" |
| P1 | A1 — fix `us-bis-entity` (generic_csv) + `fr-tresor-direct` (generic_xml) | 2 config lines | Closes last 2 silent-skip configs |
| P2 | A2 — rewrite `uk_ofsi` + `bis_denied` parsers for current schemas | ~50 LOC each + tests | Recovers the actual enrichment data |
| P2 | B2/B3 — audit + hook from `SyncService.SyncList` when delta!=0 | ~30 LOC in sync_service.go | Closes the 10-minute ticker blind spot |
| P2 | A7 — migrate orphan `gleif_lei`, `adb_sanctions`, `fbi-wanted` ids | one migration script | Consolidates to single live id per list |
| P3 | B7 — exponential backoff in `list_monitors.next_sync_at` | 15 LOC | Politer to failing upstream sources |
| P3 | B6 — post-parse validator hooks | ~100 LOC + per-parser wire | Contract enforcement; catches parser drift |
| P3 | A3 — `seco` XML handling or OS mirror swap | URL change or new parser | Recovers 4.6K rows |

---

## D. Suggested sync process flow (after fixes)

```
┌─────────────────────────────────────────────────────────────┐
│ SyncService.SyncList(tenant, listCfg)                       │
│                                                             │
│  1. fetch(url)                     [B1: record bytes even   │
│                                       on fetch failure]    │
│  2. parser.Parse(bytes)                                     │
│  3. validate(parsed)              [B6: contract check]      │
│  4. dedupeByID(parsed)            [A5: one-batch safety]    │
│  5. promoteMetadataToColumns(ent) [A6: Tier 2+3 auto]       │
│  6. diff vs existing                                        │
│  7. upsert batch                                            │
│  8. IF delta!=0 OR coverage_delta>5%:                       │
│       recorder.Record(audit)      [B2: close ticker gap]    │
│       lmHook.AfterSync(...)       [B3: list_monitors]       │
│  9. IF parsed==0 AND bytes>10KB:                            │
│       recorder.Alert("suspect")   [B1: silent-0-parse]      │
│ 10. IF error:                                               │
│       list_monitors.next_sync_at += backoff   [B7]          │
└─────────────────────────────────────────────────────────────┘
```

Steps 3–5 + 8–10 are the new behavior. Today we only do 1, 2, 6, 7
on the ticker path.

---

## E. What's already shipped (reference)

From commits `ee011f9 → 7e9aa3d` today:

- GLEIF `headquartersAddress` + `legalAddress` now decoded and pushed to `Addresses`
- ADB promotes `country` to `Nationalities` + captures `delisting_date` metadata
- 5 `generic_csv` parser typos fixed (fbi-wanted, worldbank-debar, us-bis-denied, au-dfat-direct, us-sam-exclusions) — plus `worldbank-debar` + `us-sam-exclusions` + `au-dfat-direct` URLs swapped to OpenSanctions mirrors
- `uk_ofsi` URL changed from HTML landing page to CSV blob
- Migration 067: `pep_tier`, `designation_date`, `delisting_date`, `position_title`, `place_of_birth`, `gender` as first-class nullable columns with partial indexes
- `domain.Entity` extended with the 6 fields
- `pgx.upsertOne` and `bulkUpsert` write all 23 columns
- OpenSanctions PEP enricher + UK OFSI enricher promote metadata → columns
- `cmd/enrichment-report` CLI for on-demand coverage audits
- Migration 067 made idempotent (`ADD COLUMN IF NOT EXISTS`)

This doc addresses what **remains** after those commits.

---

## Update — 2026-04-20: post-fix reingest coverage

Landed commits `7db7777 → 7b2b738` close the April 18 gaps and add
the bigger-lift follow-ups (FTM ingest, GLEIF Golden Copy, public
latency + explainability). Measured state under `__global__` tenant:

### Sanctions & enforcement lists (reingested today)

| list_id | rows | DOB | pos | POB | notes |
|---------|-----:|----:|----:|----:|-------|
| uk_ofsi | 3,725 | 70% | 68% | 65% | header-detect bug fixed |
| us-bis-denied | 884 | — | — | — | company data |
| worldbank-debar | 201 | — | — | — | OS mirror path |
| us-sam-exclusions | 126,988 | — | — | — | fetch-to-disk + h1 unlocked |
| au-dfat-direct | 4,947 | 11% | — | — | OS mirror |
| adb_sanctions | 1,473 | — | — | — | renamed from adb-debar |
| fbi_most_wanted | 50 | — | — | — | renamed from fbi-wanted |
| us_fbi_lazarus_crypto | 33 | — | — | — | new config |
| opensanctions_peps | 1,404,163 | 17.9% | 12.7% | 0.9% | FTM (+86K gender, +178K pos vs simple.csv) |

### GLEIF (LEI registry)

- **Paginated sweep across 20 top jurisdictions**: 169 distinct
  jurisdictions represented, 206,796 rows total. Top buckets cap
  at the 10K pagination ceiling per filter (expected — GLEIF
  sorts by date and returns only the latest N):

  | Top 5 | Rows |
  |-------|-----:|
  | SE | 10,432 |
  | DE | 10,245 |
  | GB | 10,171 |
  | US | 10,116 |
  | KY | 10,058 |

- **Golden Copy smoke (10,000 records)**: 9 min on starter plan,
  100% jurisdiction + address coverage (the pagination path
  carries neither cleanly). Confirms the `reingest-gleif-golden`
  path is ready for a full 3.28M pull once the Postgres plan is
  upgraded.

### Infrastructure fixes landed

- `entities.tenant_id` is now included in the `ON CONFLICT` update
  clause (`7fd7f16`) — reingest-global can reclaim rows stranded
  under legacy tenants for `__global__`.
- Bulk upsert throttled to `batchSize=200 / parallelism=1 /
  interBatchPause=40ms` (`8ea3a79` + `e2bed7c`) to stop starter
  Postgres entering recovery mode during large-list ingests.
- `FetchToDisk` + HTTP/1.1 fallback (`92b1918` + `cc2f445`) so
  throttled upsert pacing can't trigger upstream `PROTOCOL_ERROR`
  stream resets on 100MB+ downloads.
- `--timeout 30m` default on reingest-global (`15fd211`) —
  streaming downloads on large lists now clear cleanly.
- Dedicated `reingest-gleif` + `reingest-gleif-golden` binaries
  bundled into the existing cron image; docs/REINGEST_RUNBOOK.md
  specifies when to use which.

### Explainability + latency wedges (competitive proof points)

- `POST /api/v1/screen` response now carries per-layer `layers[]`
  with `layer / algorithm / score / weight / matched / explanation`
  plus the aggregated `ExplainChain` — the primary wedge vs.
  World-Check's single-score black box.
- `GET /health/latency` public no-auth snapshot: rolling
  p50/p95/p99, throughput, totals.
- `GET /status` Apple-HIG HTML page polling `/health/latency`
  every 5s. Linkable from marketing immediately.

### Remaining gaps (post this update)

1. **Plan upgrade still required** before running the full GLEIF
   Golden Copy (3.28M rows) or re-running `us-sam-exclusions` with
   headroom for the wider OS feeds.
2. **Brand assets** — generated via `docs/BRAND_PROMPTS.md`
   pipeline, but the web source tree is outside this repo so the
   embed is blocked on the marketing-site repo.
3. **ComplyAdvantage parity on transaction monitoring** — 2027
   roadmap per `docs/COMPETITIVE_LANDSCAPE.md`.
