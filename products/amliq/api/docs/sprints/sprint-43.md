# Sprint 43: Enforcement Actions Database

**Duration**: 2 weeks
**Priority**: HIGH
**Closes Gaps**: G9
**Depends On**: S-39 (generic parser framework)
**Status**: Complete

---

## Objective

Ingest regulatory enforcement actions from major financial regulators. Banks need to screen against entities that have been fined, banned, or sanctioned by regulators — not just sanctions lists.

## Tasks

### T1: Enforcement domain model
- [x] Define enforcement types:
  ```go
  type EnforcementAction struct {
      ID          string
      EntityName  string
      EntityType  string // individual, firm
      Regulator   string // SEC, FCA, FINMA, BaFin, etc.
      ActionType  string // fine, ban, warning, license_revocation, cease_desist
      Amount      *float64 // fine amount if applicable
      Currency    string
      Date        time.Time
      Description string
      URL         string // link to official notice
      Jurisdiction string
  }
  ```
- [x] **Migration**: `035_create_enforcement_actions.up.sql`
- [x] **File**: `internal/domain/enforcement.go` (new, <60 lines)

### T2: SEC EDGAR ingestion (US)
- [x] Source: SEC EDGAR full-text search API (`https://efts.sec.gov/LATEST/search-index?q=...`)
- [x] Parse administrative proceedings, litigation releases
- [x] Extract: entity name, action type, fine amount, date
- [x] **File**: `internal/ingestion/enforcement_sec.go` (new, <100 lines)
- [x] **Test**: with fixture data

### T3: FCA Register ingestion (UK)
- [x] Source: FCA Financial Services Register + Enforcement Outcomes
  - `https://register.fca.org.uk/`
  - Published enforcement outcomes (fines, bans)
- [x] **File**: `internal/ingestion/enforcement_fca.go` (new, <80 lines)

### T4: Additional regulators
- [x] **FINMA** (Switzerland) — published enforcement actions
- [x] **BaFin** (Germany) — published administrative actions
- [x] **ESMA** (EU) — published sanctions and measures
- [x] **ASIC** (Australia) — enforceable undertakings
- [x] Use generic parser framework where possible
- [x] **Files**: 1-2 new parsers + config entries

### T5: Wire to screening
- [x] When screening an entity, also check enforcement database
- [x] Add enforcement evidence to match results:
  ```json
  {
      "layer": "ENFORCEMENT",
      "regulator": "SEC",
      "action_type": "fine",
      "amount": 2500000,
      "date": "2024-08-15",
      "description": "Settlement for market manipulation",
      "url": "https://sec.gov/..."
  }
  ```
- [x] Enforcement hits don't block by themselves but boost confidence when combined with list matches
- [x] **File**: `internal/screening/enforcement_checker.go` (new, <80 lines)

### T6: API endpoint
- [x] `GET /api/v1/enforcement/entity/{id}` — enforcement history for entity
- [x] `GET /api/v1/enforcement/search?q=name` — search enforcement database
- [x] **File**: `api/handler_enforcement.go` (new, <80 lines)
- [x] **File**: `api/router_compliance.go` (add routes)

## Acceptance Criteria

- [x] Enforcement data from 4+ regulators (SEC, FCA, FINMA, BaFin) ingested and searchable
- [x] Enforcement evidence included in screening results
- [x] API returns enforcement history per entity
- [x] Daily sync for enforcement databases
