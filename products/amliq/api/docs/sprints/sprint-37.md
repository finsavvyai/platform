# Sprint 37: PEP Data & Screening

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: G3
**Depends On**: S-36 (relationship repo for RCA mapping)
**Status**: Complete

---

## Objective

Add Politically Exposed Persons screening — the single most important missing feature for bank sales. Every financial institution is legally required to screen for PEPs.

## Background

Current state:
- API endpoints exist: `POST /api/v1/pep/screen`, `GET /api/v1/pep`, `POST /api/v1/pep/public-search`
- Frontend page exists: `/compliance/pep`
- Database table exists: `pep_profiles`
- **But no PEP data source is ingested.** Endpoints return empty results.

## Tasks

### T1: PEP data source integration
- [x] Primary source: **OpenSanctions PEP dataset** (free, covers 200+ countries, includes RCA)
  - URL: `https://data.opensanctions.org/datasets/latest/peps/entities.ftm.json`
  - Format: FollowTheMoney JSON
  - Entities include: name, position, country, political party, dates, relatives, associates
- [x] Secondary source: **EveryPolitician** (Wikidata-sourced, current officeholders)
- [x] **File**: `internal/ingestion/pep_opensanctions.go` (new, <100 lines)
- [x] **File**: `internal/ingestion/pep_everypolitician.go` (new, <100 lines)
- [x] **Test**: Both parsers with fixture data

### T2: PEP entity model and classification
- [x] Define PEP domain types in `internal/domain/pep.go`:
  ```go
  type PEPTier int
  const (
      PEPTier1 PEPTier = 1 // Heads of state, cabinet ministers, supreme court judges
      PEPTier2 PEPTier = 2 // Senior officials, military leaders, ambassadors
      PEPTier3 PEPTier = 3 // Regional/local officials, state governors
      PEPTier4 PEPTier = 4 // Relatives & Close Associates (RCA) of Tier 1-3
  )

  type PEPProfile struct {
      EntityID    EntityID
      Name        Name
      Country     string
      Position    string
      Tier        PEPTier
      StartDate   *time.Time
      EndDate     *time.Time  // nil = currently active
      Party       string
      Source      string
  }
  ```
- [x] Classification rules: auto-assign tier based on position keywords
- [x] **File**: `internal/domain/pep.go` (new, <80 lines)
- [x] **Test**: `internal/domain/pep_test.go`

### T3: RCA (Relatives & Close Associates) mapping
- [x] OpenSanctions PEP data includes `family` and `associate` relationships
- [x] Parse into `entity_relationships` table (created in S-36) with type `PEP_FAMILY` or `PEP_ASSOCIATE`
- [x] When screening finds a PEP match, also return their RCA network
- [x] RCA entities get classified as Tier 4
- [x] **File**: `internal/ingestion/pep_opensanctions.go` (relationship parsing section)
- [x] **File**: `internal/screening/pep_matcher.go` (new, <100 lines)

### T4: PEP screening logic
- [x] Create `PEPMatcher` that:
  1. Runs the standard 4-6 layer cascade against PEP entities
  2. Checks RCA relationships for near-misses
  3. Returns PEP-specific evidence: tier, position, country, active/former status
  4. Higher weight for active PEPs vs former (configurable decay period, default 5 years)
- [x] Wire to existing `POST /api/v1/pep/screen` handler
- [x] **File**: `internal/screening/pep_matcher.go`
- [x] **File**: `api/handler_pep.go` (modify to use real matcher)

### T5: PEP storage repository
- [x] Create `internal/storage/pgx/pep_repo.go`
- [x] Methods: `StorePEP(profile)`, `BulkStorePEPs(profiles)`, `FindByCountry(country)`, `FindByName(name)`, `SearchPEPs(query, filters)`
- [x] Use existing `pep_profiles` table
- [x] **File**: `internal/storage/pgx/pep_repo.go` (<100 lines)
- [x] **Test**: `internal/storage/pgx/pep_repo_test.go`

### T6: PEP sync scheduler
- [x] Add PEP list sync to the existing cron/scheduler
- [x] Daily sync for OpenSanctions PEP dataset
- [x] Weekly sync for EveryPolitician
- [x] Delta computation: detect new PEPs, position changes, delistings
- [x] **File**: `cmd/worker/pep_sync.go` (new, <80 lines)

### T7: Wire frontend PEP page
- [x] Existing PEP page at `/compliance/pep` — verify it works with real data
- [x] Ensure PEP screening results display: tier badge, position, country flag, RCA network
- [x] **File**: `web/src/pages/compliance/PEPScreening.tsx` (verify/modify)

## Acceptance Criteria

- [x] PEP screening returns matches with classification tier (1-4), position, country
- [x] RCA relationships displayed for matched PEPs (family, associates)
- [x] Coverage: 100+ countries via OpenSanctions
- [x] Active vs former PEP distinction with configurable decay period
- [x] `POST /api/v1/pep/screen` returns real, structured PEP results
- [x] PEP data syncs daily from OpenSanctions
- [x] All existing tests pass

## Files Created/Modified

| File | Action |
|------|--------|
| `internal/domain/pep.go` | CREATE |
| `internal/domain/pep_test.go` | CREATE |
| `internal/ingestion/pep_opensanctions.go` | CREATE |
| `internal/ingestion/pep_everypolitician.go` | CREATE |
| `internal/screening/pep_matcher.go` | CREATE |
| `internal/storage/pgx/pep_repo.go` | CREATE |
| `internal/storage/pgx/pep_repo_test.go` | CREATE |
| `cmd/worker/pep_sync.go` | CREATE |
| `api/handler_pep.go` | MODIFY |
| `web/src/pages/compliance/PEPScreening.tsx` | VERIFY |
