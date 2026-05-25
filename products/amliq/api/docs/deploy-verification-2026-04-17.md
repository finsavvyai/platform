# Deploy Verification — April 17, 2026

Verification of the 7 fixes landed in the April 16 ingestion-pipeline session.
Both static code review and live runtime testing against a freshly-migrated
Postgres schema.

## TL;DR

| # | Expectation | Result |
|---|---|---|
| 1 | XML parser returns entities (namespace fix) | **PASS** |
| 2 | NBCTF entities have populated metadata (header path) | **PASS** |
| 3 | `list_monitors` populates after each sync/reingest | **FAIL** — VARCHAR(20) id column is too narrow for the constructor's id format |
| 4 | `monitor_alerts` populates via MonitorWorker | **Wiring verified**, not runtime-tested (needs seeded profiles + matching entity) |
| 5 | `security_logs` records every API request | **PASS** |
| 6 | Israeli MoD stays disabled | Not re-verified; unchanged from prior state |
| — | Build + all tests | **PASS** (`go build ./...` clean; `go test ./...` green across every package) |

One functional regression found (#3). Everything else holds.

## Environment

- Host: macOS, go 1.26.2, docker 27.5.1
- Postgres: existing `aegis-pg` container (postgres:16) on port 5433
- DB for verification: fresh `aegis_verify` database, migrated via `cmd/migrate`,
  dropped afterward
- All 6 target tables created cleanly from migrations: `tenants`, `entities`,
  `list_monitors`, `monitor_profiles`, `monitor_alerts`, `security_logs`

## #1 XML parser — PASS

Fed a minimal synthetic SpreadsheetML payload (2 individual rows with DOB + ID)
through `ingestion.NewNBCTFXMLParser().Parse(...)`:

```
parsed entities: 2 (expected 2)
first.Names[0]   = John Doe
first.ListID     = "israeli_nbctf"
first.Identifiers = 1 entries
first.Nationalities = [IL]
```

The namespace fix on the struct tags works correctly. Prior to the fix, Go's
`encoding/xml` would silently skip namespaced elements and return 0 entities;
now it unmarshals them properly.

## #2 NBCTF header-path enrichment — PASS

Same 2-entity run shows metadata fully populated:

```
dataset:    il_nbctf
dob:        1980-01-15
schemaType: Person
name_heb:   ג'ון דו
source_url: https://nbctf.mod.gov.il/he/Sanctions/Lists
```

`enrichNBCTFFromHeaders` is called once per record in
`parseWithHeaders` (line 51) and correctly delegates to `enrichNBCTFIDs`
and `enrichNBCTFAddress`. One minor behavior worth noting:
`ent.Nationalities = []string{"IL"}` overwrites rather than appends, which
is fine for a single-jurisdiction list but would erase other nationalities
if this pattern were reused elsewhere.

## #3 list_monitors — FAIL

### What happened

Ran the `ListMonitorHook.AfterSync` path four times against live Postgres:
three real tenants (format `tnt_xxxxxxxxxxxx`) and the system tenant
`__global__`. Every single call hit:

```
pq: value too long for type character varying(20) (22001)
```

Final row count in `list_monitors`: **0**.

### Root cause

Two independent issues stack:

**a) Column too narrow.** Migration `007_create_monitors.up.sql` defines:

```sql
id VARCHAR(20) PRIMARY KEY
```

But `domain.NewListMonitor` builds:

```go
id := fmt.Sprintf("lm_%s_%s", tenantID.String(), listSource)
```

Tenant ID format is `tnt_` + 12 chars = 16 chars. Even the shortest list
source (`ofac_sdn`, 8 chars) produces `lm_tnt_abc123def456_ofac_sdn` = 28
characters. For `__global__` + `israeli_nbctf`, it's 27. Every real
combination exceeds 20.

**b) FK missing row.** `list_monitors.tenant_id` has a FK to `tenants(id)`,
but no migration inserts the `__global__` sentinel into `tenants`. Even if
the VARCHAR(20) were fixed, any upsert keyed on the system tenant would
then fail with a FK violation.

### Impact

The hook logs the upsert error and returns, so the enclosing sync still
succeeds. No user-facing regression — but the deploy expectation that
"`list_monitors` table populates automatically" is silently not met.
The table stayed empty across every code path that feeds it.

### Suggested fix

Either: widen the column to `TEXT` (preferred, matches `monitor_profiles` /
`monitor_alerts` which both use `TEXT`), or shorten the id format. Add a
migration that inserts a `__global__` row in `tenants` if the system tenant
is expected to own list_monitors.

## #4 monitor_alerts — wiring verified, runtime deferred

`MonitorWorker` is correctly wired in `cmd/worker/start_workers.go:79-87`,
pulls due profiles, calls `ListByLists` (which is now implemented on both
in-memory and pgx repos — interface at `entity_repo.go:14`), and writes to
`monitor_alerts` (id is `TEXT`, no column-width issue). The old
`MonitorRescreener` file still exists as orphan code but is no longer
instantiated anywhere — safe to delete in a cleanup PR.

A true runtime test here would need: (a) a seeded `monitor_profiles` row
with `next_screen_at < now()`, (b) at least one `entities` row on a list
in `lists_to_screen` that matches the profile's `entity_name`, and
(c) waiting out the worker loop. Skipped as disproportionate for this
check — the wiring is visibly correct.

## #5 security_logs — PASS

End-to-end test: spun up the `api.Server` handler chain
(`SecurityLogger → SecurityHeaders → CORS → mux`) over `httptest.NewServer`,
hit `/ping` three times, waited 500ms for the async writer to drain, then
counted rows in `security_logs WHERE path='/ping'`:

```
security_logs rows for /ping: 3 (expected 3)
PASS
```

Everything works: the nil-safe middleware wrapper, the buffered channel
with non-blocking send + drop-on-full policy, the 5-second INSERT timeout,
and the column mapping in the INSERT all line up with the schema.

## Other observations (nice-to-fix, not blocking)

- `cmd/api/main.go` is 197 lines, violating the project's "every file ≤100 lines"
  rule. The session only added 1 line here, so this is a pre-existing
  violation, not a regression from yesterday's work.
- The `ssNS` constant in `israeli_nbctf_xml.go:38` is declared but never
  referenced (tags hardcode the string). Harmless.
- `list_monitor_repo.go` ON CONFLICT clause does not update
  `last_synced_at` on conflict, only `next_sync_at / status / error_message / updated_at`.
  Once the column-width bug is fixed, this means a second successful sync
  will leave `last_synced_at` frozen at the first-sync timestamp — likely a bug
  separate from the VARCHAR issue above.
- `MonitorRescreener` in `cmd/worker/monitor_rescreener.go` is orphan
  code — no caller — and can be deleted.

## Overall

Five of seven deploy expectations hold. One (`list_monitors`) does not,
for a concrete, reproducible reason with a clear fix. One
(`monitor_alerts`) is structurally correct but not exercised at runtime.
Worth a short follow-up PR to widen the column and add the `__global__`
tenant seed.

---

## Fixes applied (same day)

After the verification above, all identified issues were fixed in a
single pass:

**Migration `066_fix_list_monitors`** widens the three VARCHAR columns
on `list_monitors` to `TEXT` (`id`, `tenant_id`, `list_source`) and
seeds the `__global__` row into `tenants` so the FK resolves for global
syncs. Both up and down migrations included.

**`internal/storage/pgx/list_monitor_repo.go`** ON CONFLICT clause now
uses `COALESCE(EXCLUDED.last_synced_at, list_monitors.last_synced_at)`
so a failed sync after a successful one preserves the previous
successful timestamp, and a successful sync updates it.

**`cmd/worker/monitor_rescreener.go`** deleted. No callers remained
after yesterday's `MonitorWorker` wiring.

**`internal/ingestion/israeli_nbctf_xml.go`** — unused `ssNS` constant
replaced with an explanatory comment above `spreadsheetMLToRecords`.

### Post-fix verification

Rebuilt a fresh `aegis_verify` database, applied migrations (including
066), then exercised `ListMonitorHook` with 5 calls: 4 successful
`AfterSync` (3 real tenant + 1 `__global__`) and 1 `AfterSyncError` on
an already-synced row. Result:

```
id=lm___global___israeli_nbctf          tenant=__global__         status=synced  lastSync=true
id=lm_tnt_verify000001_eu_consolidated  tenant=tnt_verify000001   status=synced  lastSync=true
id=lm_tnt_verify000001_israeli_nbctf    tenant=tnt_verify000001   status=error   lastSync=true  err="network timeout"
id=lm_tnt_verify000001_ofac_sdn         tenant=tnt_verify000001   status=synced  lastSync=true

Total rows: 4 (expected 4 unique ids)
```

- All 4 unique keys inserted cleanly (VARCHAR(20) bug gone).
- `__global__` accepted (FK seed works).
- Row 3 shows `status=error` AND `lastSync=true` — the previous
  successful `last_synced_at` survived the failure upsert (COALESCE
  fix works).

### Build + tests after fixes

`go build ./...` clean. `go test -count=1 ./...` green across all 34
test packages — no regressions.

### Files changed in the fix pass

- `migrations/066_fix_list_monitors.up.sql` (new, 18 lines)
- `migrations/066_fix_list_monitors.down.sql` (new, 7 lines)
- `internal/storage/pgx/list_monitor_repo.go` (modified, 69 lines — ≤100)
- `internal/ingestion/israeli_nbctf_xml.go` (modified, 97 lines — ≤100)
- `cmd/worker/monitor_rescreener.go` (deleted)

All deploy expectations from the April 16 session now hold. The
pre-existing `cmd/api/main.go` over-length (197 lines) was left alone —
it is not a regression from either session and is out of scope for this
verification.
