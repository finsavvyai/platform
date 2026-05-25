# Sprint 39: Expanded Sanctions Lists

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: G5
**Depends On**: None
**Status**: Not Started

---

## Objective

Expand from 8 to 30+ sanctions lists covering 95% of global screening requirements. Build a generic parser framework so future lists can be added with <50 lines of code.

## Background

Current 8 lists: OFAC, EU FSF, UN Consolidated, UK OFSI, SECO (Swiss), OpenSanctions, Israeli MOD, Israeli NBCTF.

Missing critical lists that banks require: DFAT (Australia), MAS (Singapore), HKMA (Hong Kong), Japan, Canada, major Gulf states, major EU member states, Interpol, World Bank.

## Tasks

### T1: Generic parser framework
- [ ] Create `internal/ingestion/generic_csv.go` — configurable CSV parser with column mapping
- [ ] Create `internal/ingestion/generic_xml.go` — configurable XML parser with XPath-like field mapping
- [ ] Config struct:
  ```go
  type ListParserConfig struct {
      ListID      string
      Name        string
      URL         string
      Format      string // "csv", "xml", "json"
      Delimiter   string // for CSV
      FieldMap    map[string]string // our_field -> source_column
      EntityPath  string // XPath for XML, JSONPath for JSON
      UpdateFreq  string // "daily", "weekly"
  }
  ```
- [ ] New list = config + optional custom transform function
- [ ] **File**: `internal/ingestion/generic_csv.go` (<100 lines)
- [ ] **File**: `internal/ingestion/generic_xml.go` (<100 lines)

### T2: Tier 1 lists (10 lists — must-have)
- [ ] **DFAT** (Australia) — CSV from dfat.gov.au
- [ ] **MAS** (Singapore) — PDF/CSV from mas.gov.sg (use OpenSanctions mirror)
- [ ] **HKMA** (Hong Kong) — via OpenSanctions
- [ ] **Japan FSA/MOF** — XML from mof.go.jp
- [ ] **Canada OSFI** — CSV from international.gc.ca
- [ ] **South Korea** — via OpenSanctions
- [ ] **Brazil COAF** — via OpenSanctions
- [ ] **Mexico UIF** — via OpenSanctions
- [ ] **India MHA** — via OpenSanctions
- [ ] **Taiwan MJIB** — via OpenSanctions
- [ ] **Strategy**: Use OpenSanctions as aggregator for lists without direct API access. Add direct parsers for DFAT, Japan, Canada which have well-structured public APIs.
- [ ] **Files**: 3-4 new parser files + 6-7 config entries using generic framework

### T3: Tier 2 lists (10 lists — important)
- [ ] **UAE Central Bank** — via OpenSanctions
- [ ] **Saudi Arabia SAMA** — via OpenSanctions
- [ ] **Bahrain CBB** — via OpenSanctions
- [ ] **Qatar QCB** — via OpenSanctions
- [ ] **France Tresor** — XML from tresor.economie.gouv.fr
- [ ] **Germany BaFin sanctions** — via OpenSanctions
- [ ] **Netherlands AFM** — via OpenSanctions
- [ ] **Belgium NBB** — via OpenSanctions
- [ ] **Poland KNF** — via OpenSanctions
- [ ] **Czech CNB** — via OpenSanctions
- [ ] **Strategy**: Most available through OpenSanctions aggregation. France Tresor has direct XML API worth parsing directly.
- [ ] **Files**: 1 new parser (France) + 9 config entries

### T4: Tier 3 lists (5+ lists — completeness)
- [ ] **Interpol Red Notices** — JSON API from interpol.int
- [ ] **FBI Most Wanted** — JSON API from fbi.gov
- [ ] **Europol Most Wanted** — HTML/JSON scrape
- [ ] **World Bank Debarment** — CSV from worldbank.org
- [ ] **ADB Sanctions** — CSV from adb.org
- [ ] **Files**: `internal/ingestion/interpol.go`, `internal/ingestion/fbi.go`, `internal/ingestion/world_bank.go` (each <80 lines)

### T5: Marketplace metadata
- [ ] Each list gets marketplace entry with: name, jurisdiction, entity count, update frequency, format, description
- [ ] Tenants can enable/disable lists via `POST /api/v1/lists/marketplace/{listId}/enable`
- [ ] Default enabled lists based on plan tier:
  - Starter: OFAC, EU, UN, UK (4 lists)
  - Pro: All Tier 1 + Tier 2 (24 lists)
  - Enterprise: All lists (30+)
- [ ] **File**: `internal/ingestion/all_lists.go` (update registry)
- [ ] **File**: `api/handler_lists_marketplace.go` (verify/modify)

### T6: Sync scheduling per list
- [ ] Each list has its own sync frequency (daily, weekly, or on-demand)
- [ ] Add list-specific cron entries to worker scheduler
- [ ] Dashboard shows last sync time, next sync, entity count per list
- [ ] **File**: `cmd/worker/list_scheduler.go` (modify)

## Acceptance Criteria

- [ ] 30+ sanctions lists operational and syncing
- [ ] Generic parser framework: new list addition requires <50 lines of config/code
- [ ] Each list has marketplace metadata (jurisdiction, entity count, update frequency)
- [ ] Plan-based list access (Starter: 4, Pro: 24, Enterprise: 30+)
- [ ] All existing tests pass
- [ ] Total entity count across all lists: >500K profiles
