# Sprint 43: Enforcement Actions Database

**Duration**: 2 weeks
**Priority**: HIGH
**Closes Gaps**: G9
**Depends On**: S-39 (generic parser framework)
**Status**: Not Started

---

## Objective

Ingest regulatory enforcement actions from major financial regulators. Banks need to screen against entities that have been fined, banned, or sanctioned by regulators — not just sanctions lists.

## Tasks

### T1: Enforcement domain model
- [ ] Define enforcement types:
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
- [ ] **Migration**: `035_create_enforcement_actions.up.sql`
- [ ] **File**: `internal/domain/enforcement.go` (new, <60 lines)

### T2: SEC EDGAR ingestion (US)
- [ ] Source: SEC EDGAR full-text search API (`https://efts.sec.gov/LATEST/search-index?q=...`)
- [ ] Parse administrative proceedings, litigation releases
- [ ] Extract: entity name, action type, fine amount, date
- [ ] **File**: `internal/ingestion/enforcement_sec.go` (new, <100 lines)
- [ ] **Test**: with fixture data

### T3: FCA Register ingestion (UK)
- [ ] Source: FCA Financial Services Register + Enforcement Outcomes
  - `https://register.fca.org.uk/`
  - Published enforcement outcomes (fines, bans)
- [ ] **File**: `internal/ingestion/enforcement_fca.go` (new, <80 lines)

### T4: Additional regulators
- [ ] **FINMA** (Switzerland) — published enforcement actions
- [ ] **BaFin** (Germany) — published administrative actions
- [ ] **ESMA** (EU) — published sanctions and measures
- [ ] **ASIC** (Australia) — enforceable undertakings
- [ ] Use generic parser framework where possible
- [ ] **Files**: 1-2 new parsers + config entries

### T5: Wire to screening
- [ ] When screening an entity, also check enforcement database
- [ ] Add enforcement evidence to match results:
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
- [ ] Enforcement hits don't block by themselves but boost confidence when combined with list matches
- [ ] **File**: `internal/screening/enforcement_checker.go` (new, <80 lines)

### T6: API endpoint
- [ ] `GET /api/v1/enforcement/entity/{id}` — enforcement history for entity
- [ ] `GET /api/v1/enforcement/search?q=name` — search enforcement database
- [ ] **File**: `api/handler_enforcement.go` (new, <80 lines)
- [ ] **File**: `api/router_compliance.go` (add routes)

## Acceptance Criteria

- [ ] Enforcement data from 4+ regulators (SEC, FCA, FINMA, BaFin) ingested and searchable
- [ ] Enforcement evidence included in screening results
- [ ] API returns enforcement history per entity
- [ ] Daily sync for enforcement databases
