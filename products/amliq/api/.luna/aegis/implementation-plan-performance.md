# Implementation Plan -- Performance & Audit Remediation

**Scope**: AMLIQ v2 -- High-Performance Architecture (GAP-007 through GAP-016)
**Generated**: 2026-04-01
**Agent**: Task Planning Agent (Performance Pass)
**Based on**: performance-design.md, performance-requirements.md, Content Integrity Audit Report

---

## Overview

This plan delivers 8 sprints (16 weeks) that transform AMLIQ from a PostgreSQL-only sequential screening system into a high-performance platform with Elasticsearch, Redis caching, Go goroutine parallelism, and real sanctions data. It also remediates all 18 findings from the content integrity audit.

## Implementation Phases

| Phase | Name | Tasks | Sprint | Focus |
|-------|------|-------|--------|-------|
| 1 | Audit Remediation | 1.1--1.8 | Sprint 1 | Fix all critical/high audit findings |
| 2 | Elasticsearch Integration | 2.1--2.8 | Sprint 2 | ES client, mapping, indexer, searcher |
| 3 | Goroutine Parallelism | 3.1--3.6 | Sprint 3 | Parallel matchers, sync.Pool, batch pool |
| 4 | Sanctions List Expansion | 4.1--4.9 | Sprint 4 | 8 new real lists + FATF risk |
| 5 | Redis Caching + Bloom | 5.1--5.7 | Sprint 5 | Cache layer, Bloom filter, invalidation |
| 6 | Async Workers | 6.1--6.6 | Sprint 6 | Worker pool, concurrent sync, monitoring |
| 7 | Benchmarking + Observability | 7.1--7.6 | Sprint 7 | Tracing, metrics, load tests, CI benchmarks |
| 8 | Production Hardening | 8.1--8.8 | Sprint 8 | pgxpool, partitioning, HNSW, K8s, E2E |

## Prerequisites

- [x] Go 1.22 backend compiles (go build ./...)
- [x] PostgreSQL 15+ with pgvector extension
- [x] 4-layer screening engine operational
- [x] Existing ingestion parsers for 10 list types
- [x] React 18 + TypeScript frontend builds
- [ ] Docker and docker-compose installed
- [ ] Elasticsearch 8.x available (docker or host)
- [ ] Redis 7+ available (docker or host)
- [ ] OpenAI API key for embedding generation

---

## Phase 1: Audit Remediation (Sprint 1, Weeks 1--2)

- [ ] **1.1 Remove false "40+ lists" marketing claim**
  - **Description**: Replace all "40+" occurrences with a dynamic list count. Create a ListCount() helper that returns len(MarketplaceCatalog()). Update all 4 i18n files (en/he marketing.json and auth.json). Replace hardcoded "40+" strings with interpolated count.
  - **Files**: `internal/domain/marketplace_count.go` (new, ~15 lines), `web/src/i18n/locales/en/marketing.json` (edit), `web/src/i18n/locales/en/auth.json` (edit), `web/src/i18n/locales/he/marketing.json` (edit), `web/src/i18n/locales/he/auth.json` (edit)
  - **Requirements**: FR-AUDIT-001
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] No string "40+" exists anywhere in the codebase
    - [ ] ListCount() returns actual count from MarketplaceCatalog()
    - [ ] Marketing pages display real number (currently 16)
    - [ ] File under 100 lines

- [ ] **1.2 Rename UK HMRC to UK OFSI/FCDO**
  - **Description**: Rename ListSourceHMRC to ListSourceUKOFSI in domain enum. Rename parser file hmrc.go to uk_ofsi.go and its test. Update all_lists.go source URL to new UKSL endpoint. Update GLOSSARY.md with correct UK regulatory bodies (OFSI, FCDO, FCA, NCA) and legislation (POCA 2002, MLR 2017, Terrorism Act 2000). Update marketplace entries.
  - **Files**: `internal/domain/list_source.go` (edit), `internal/ingestion/uk_ofsi.go` (rename from hmrc.go), `internal/ingestion/uk_ofsi_test.go` (rename from hmrc_test.go), `internal/ingestion/all_lists.go` (edit URL + parser type), `internal/domain/marketplace_data.go` (edit), `docs/GLOSSARY.md` (edit UK section)
  - **Requirements**: FR-AUDIT-002, FR-LIST-005
  - **Estimated Time**: L (4 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] No string "HMRC" exists in Go source code (search all .go files)
    - [ ] ListSourceUKOFSI enum value used everywhere
    - [ ] Parser registered as "uk_ofsi" in registry
    - [ ] Source URL points to gov.uk UKSL endpoint
    - [ ] GLOSSARY.md UK section references OFSI, FCDO, POCA, MLR 2017
    - [ ] All files under 100 lines

- [ ] **1.3 Remove fabricated testimonials**
  - **Description**: Delete the testimonials array from marketing.json (en + he). Replace with a "Use Cases" section showing 3 clearly-labeled hypothetical scenarios (e.g., "How a compliance team might use AMLIQ for onboarding screening"). No fake names, no fake companies.
  - **Files**: `web/src/i18n/locales/en/marketing.json` (edit testimonials section), `web/src/i18n/locales/he/marketing.json` (edit)
  - **Requirements**: FR-AUDIT-001
  - **Estimated Time**: S (1 hour)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] No "testimonials" key in marketing.json
    - [ ] "use_cases" section with clearly labeled hypothetical examples
    - [ ] No fabricated company names or person names

- [ ] **1.4 Reword compliance claims to aspirational**
  - **Description**: In SECURITY.md, change "GDPR Compliance" heading to "GDPR Design Principles" and add disclaimer: "AMLIQ is designed with GDPR requirements in mind. Formal GDPR assessment is pending." Change "SOC 2 Compliance" to "SOC 2 Readiness" with disclaimer: "AMLIQ architecture aligns with SOC 2 trust service criteria. Formal SOC 2 Type II audit is planned."
  - **Files**: `docs/SECURITY.md` (edit 2 sections)
  - **Requirements**: FR-AUDIT-003
  - **Estimated Time**: S (30 min)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] No heading says "Compliance" without qualifier
    - [ ] Both sections have explicit "formal audit pending" disclaimers
    - [ ] File under 100 lines (split if needed)

- [ ] **1.5 Remove unsubstantiated FP rate and NPS comparisons**
  - **Description**: In VISION.md, replace "False Positive Rate: <5% (vs World-Check's ~95%)" with "False Positive Rate: Designed to minimize through 6-layer weighted scoring (benchmark pending)". Remove NPS comparison "vs World-Check's typically 30-40". In GLOSSARY.md metrics table, apply same fix.
  - **Files**: `docs/VISION.md` (edit KPIs section), `docs/GLOSSARY.md` (edit Metrics table)
  - **Requirements**: FR-AUDIT-003
  - **Estimated Time**: S (30 min)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] No unverified percentage claims about FP rates
    - [ ] No unverifiable competitor NPS comparisons
    - [ ] Language is aspirational ("designed to", "target") not factual

- [ ] **1.6 Update regulatory framework references**
  - **Description**: Create new docs/REGULATORY.md with verified regulatory frameworks per jurisdiction: US (BSA, USA PATRIOT Act, FinCEN CDD Rule), EU (AMLD6, AMLA), UK (POCA 2002, MLR 2017, FCDO/OFSI), International (FATF 40 Recommendations, grey/black lists). Update GLOSSARY.md: add AMLD6, AMLA, POCA, MLR 2017, STR, TFS, CPF, EDD, CDD, SDD. Move PSD2/MiFID II to "Related Regulations" subsection.
  - **Files**: `docs/REGULATORY.md` (new, ~90 lines), `docs/GLOSSARY.md` (edit regulatory + add missing terms)
  - **Requirements**: FR-AUDIT-004
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] REGULATORY.md covers US, EU, UK, International with current (April 2026) references
    - [ ] AMLD6 adoption date (May 2024) and transposition deadline (July 2027) correct
    - [ ] AMLA operational date (July 2025) and location (Frankfurt) correct
    - [ ] FATF grey list count (22) and black list (3) match February 2026 data
    - [ ] All new glossary terms defined: STR, TFS, CPF, EDD, CDD, SDD
    - [ ] All files under 100 lines

- [ ] **1.7 Make entity counts dynamic**
  - **Description**: In marketplace_data.go and marketplace_regional.go, set all EntityCount fields to 0. Create internal/ingestion/sync_count.go with function UpdateListCount(repo, listID) that queries COUNT(*) from entities table for that list and updates the marketplace metadata. Call after each successful sync in SyncService.
  - **Files**: `internal/domain/marketplace_data.go` (edit: set EntityCount to 0), `internal/domain/marketplace_regional.go` (edit: set EntityCount to 0), `internal/ingestion/sync_count.go` (new, ~30 lines), `internal/ingestion/sync_count_test.go` (new)
  - **Requirements**: FR-AUDIT-005
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] No hardcoded EntityCount > 0 in marketplace files
    - [ ] No hardcoded LastSynced timestamps in marketplace files
    - [ ] UpdateListCount queries real data and updates metadata
    - [ ] Table-driven test with mock repo

- [ ] **1.8 Fix remaining data accuracy issues**
  - **Description**: In GLOSSARY.md, change OpenSanctions description from "Journalism NGO" to "Open-source intelligence project aggregating 328+ global sanctions datasets". In marketplace_regional.go, change CoE Assembly URL from s3.us.archive.org to data.opensanctions.org endpoint. In all_lists.go, update EU source URL to use data.europa.eu stable endpoint. Review EEAS vs EU list: add description to marketplace differentiating them (EEAS = foreign policy designations, EU FSF = financial sanctions).
  - **Files**: `docs/GLOSSARY.md` (edit), `internal/domain/marketplace_regional.go` (edit CoE URL), `internal/ingestion/all_lists.go` (edit EU URL), `internal/domain/marketplace_data.go` (edit EEAS description)
  - **Requirements**: FR-AUDIT-005
  - **Estimated Time**: S (1 hour)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] OpenSanctions described as "open-source intelligence project"
    - [ ] CoE Assembly URL uses data.opensanctions.org
    - [ ] EU URL uses stable endpoint (not europeaid path with token)
    - [ ] EEAS and EU FSF entries have distinct descriptions

---

## Phase 2: Elasticsearch Integration (Sprint 2, Weeks 3--4)

- [ ] **2.1 Create ES client wrapper**
  - **Description**: Create internal/search/es_client.go wrapping the official elasticsearch-go v8 client. Support ES_URL from config. Add connection pool, health check (Ping), and retry logic (3 retries with exponential backoff). Create es_client_test.go with table-driven tests for config parsing and health check.
  - **Files**: `internal/search/es_client.go` (new, ~60 lines), `internal/search/es_client_test.go` (new), `internal/config/config.go` (edit: add ES_URL)
  - **Requirements**: FR-ES-001
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: go get github.com/elastic/go-elasticsearch/v8
  - **Acceptance Criteria**:
    - [ ] NewESClient(cfg) returns configured client
    - [ ] Health() returns bool (calls Ping)
    - [ ] Retry with 1s/2s/4s backoff on transient failures
    - [ ] Table-driven tests

- [ ] **2.2 Define ES index mapping**
  - **Description**: Create internal/search/index_mapping.go returning the JSON mapping for sanctions entities. Must include: settings (3 shards, 1 replica, 5s refresh, phonetic_analyzer with double_metaphone, normalized_analyzer with asciifolding), mappings (name_exact keyword, name_fuzzy text, name_phonetic text/phonetic_analyzer, name_normalized text/normalized_analyzer, list_id keyword, entity_type keyword, identifiers nested, updated_at date). Test that mapping is valid JSON.
  - **Files**: `internal/search/index_mapping.go` (new, ~80 lines), `internal/search/index_mapping_test.go` (new)
  - **Requirements**: FR-ES-002
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: 2.1
  - **Acceptance Criteria**:
    - [ ] SanctionsMapping() returns valid ES mapping
    - [ ] phonetic_analyzer uses double_metaphone filter
    - [ ] normalized_analyzer uses lowercase + asciifolding
    - [ ] 4 name fields: exact, fuzzy, phonetic, normalized
    - [ ] File under 100 lines

- [ ] **2.3 Create Indexer interface and ES implementation**
  - **Description**: Create internal/search/indexer.go defining the Indexer interface (2 methods: Index, Delete). Create internal/search/es_indexer.go implementing ESIndexer using esutil.BulkIndexer with 4 workers, 5MB flush size, 30s flush interval. Map domain.Entity to ES document (extract names into all 4 fields, copy list_id, entity_type, identifiers). Handle errors: log failed items, record for manual review.
  - **Files**: `internal/search/indexer.go` (new, ~15 lines), `internal/search/es_indexer.go` (new, ~80 lines), `internal/search/es_indexer_test.go` (new)
  - **Requirements**: FR-ES-003
  - **Estimated Time**: L (4 hours)
  - **Dependencies**: 2.1, 2.2
  - **Acceptance Criteria**:
    - [ ] Indexer interface: Index(ctx, []Entity) error, Delete(ctx, []string) error
    - [ ] BulkIndexer configured: 4 workers, 5MB, 30s
    - [ ] Entity names mapped to all 4 ES fields
    - [ ] Failed items logged with entity ID and error
    - [ ] Table-driven tests with mock ES

- [ ] **2.4 Create Searcher interface and ES implementation**
  - **Description**: Create internal/search/searcher.go defining Searcher interface (1 method: Search). Create internal/search/es_searcher.go implementing ESSearcher with multi_match bool query: should[term(name_exact boost=10), match(name_fuzzy fuzziness=AUTO boost=5), match(name_phonetic boost=3), match(name_normalized boost=2)], minimum_should_match=1, filter by tenant enabled list_ids, size=50. Parse ES response into []Candidate{EntityID, ESScore, Name}.
  - **Files**: `internal/search/searcher.go` (new, ~15 lines), `internal/search/es_searcher.go` (new, ~90 lines), `internal/search/es_searcher_test.go` (new)
  - **Requirements**: FR-ES-004
  - **Estimated Time**: L (5 hours)
  - **Dependencies**: 2.1, 2.2
  - **Acceptance Criteria**:
    - [ ] Searcher interface: Search(ctx, ScreenRequest) ([]Candidate, error)
    - [ ] Bool query with 4 should clauses and correct boosts
    - [ ] Results filtered by tenant-enabled list IDs
    - [ ] Returns top 50 candidates sorted by ES score
    - [ ] Table-driven tests for exact, fuzzy, phonetic, no-match scenarios

- [ ] **2.5 Wire ES indexing into SyncService**
  - **Description**: Create internal/ingestion/sync_es.go that wraps the existing SyncService to also index entities into ES after PostgreSQL upsert. After BulkUpsert: call indexer.Index(). After SoftDelete: call indexer.Delete(). If ES indexing fails, log error but don't fail the sync (PG is source of truth). This is a decorator/wrapper, not a modification to existing sync_service.go.
  - **Files**: `internal/ingestion/sync_es.go` (new, ~50 lines), `internal/ingestion/sync_es_test.go` (new)
  - **Requirements**: FR-ES-003
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: 2.3, existing sync_service.go
  - **Acceptance Criteria**:
    - [ ] ES indexing happens after PG upsert (not before)
    - [ ] ES failures logged but don't block sync
    - [ ] SoftDelete removes from both PG and ES
    - [ ] Table-driven test verifying both paths called

- [ ] **2.6 Create zero-downtime reindex command**
  - **Description**: Create cmd/reindex/main.go that: (1) creates new index with timestamp suffix and correct mapping, (2) queries all entities from PostgreSQL in batches of 10,000, (3) bulk-indexes into new index, (4) atomically swaps the "sanctions-entities" alias to new index, (5) deletes old index. Support --dry-run flag. Log progress every 10,000 entities. Create internal/search/reindexer.go with Reindex(ctx) method.
  - **Files**: `cmd/reindex/main.go` (new, ~40 lines), `internal/search/reindexer.go` (new, ~70 lines), `internal/search/reindexer_test.go` (new), `Makefile` (add reindex target)
  - **Requirements**: FR-ES-005
  - **Estimated Time**: L (4 hours)
  - **Dependencies**: 2.1, 2.2, 2.3
  - **Acceptance Criteria**:
    - [ ] New index created with mapping from index_mapping.go
    - [ ] All PG entities indexed in batches of 10,000
    - [ ] Alias swap is atomic (one UpdateAliases call)
    - [ ] Old index deleted after successful swap
    - [ ] --dry-run creates index and indexes but doesn't swap
    - [ ] Progress logged every 10,000 entities

- [ ] **2.7 Replace Engine candidate retrieval with ES**
  - **Description**: Modify Engine.Screen() to use ESSearcher for candidate retrieval instead of loading all entities from PostgreSQL. In engine.go (or new engine_es.go), call searcher.Search(ctx, query) to get top-50 candidates, then run matchers on those candidates only. Add fallback: if ES unavailable (health check fails), fall back to existing PG ILIKE query. Store ES availability as atomic.Bool, checked every 30s by background goroutine.
  - **Files**: `internal/screening/engine_es.go` (new, ~60 lines), `internal/screening/engine_es_test.go` (new), `internal/screening/engine.go` (edit: delegate to engine_es)
  - **Requirements**: FR-ES-001, FR-ES-004
  - **Estimated Time**: L (4 hours)
  - **Dependencies**: 2.4
  - **Acceptance Criteria**:
    - [ ] Default path: ES search -> top-50 candidates -> matchers
    - [ ] Fallback path: PG ILIKE query when ES unavailable
    - [ ] Atomic bool tracks ES availability
    - [ ] Background goroutine retries ES every 30s on failure
    - [ ] Table-driven tests for both paths

- [ ] **2.8 Add ES to Docker infrastructure**
  - **Description**: Add Elasticsearch 8.13.0 service to docker-compose.yml with single-node discovery, security disabled (dev), 1GB heap, persistent volume. Add health check. Update Makefile docker-up target. Update cmd/api/init_deps.go to initialize ES client.
  - **Files**: `docker-compose.yml` (edit: add elasticsearch service), `Makefile` (edit), `cmd/api/init_deps.go` (edit: add ES client init), `api/deps.go` (edit: add Searcher, Indexer fields)
  - **Requirements**: FR-ES-001
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: 2.1
  - **Acceptance Criteria**:
    - [ ] docker-compose up starts ES on port 9200
    - [ ] Health check: curl http://localhost:9200/_cluster/health
    - [ ] ES client injected into Dependencies struct
    - [ ] make docker-up includes ES

---

## Phase 3: Goroutine Parallelism (Sprint 3, Weeks 5--6)

- [ ] **3.1 Create sync.Pool for ScreeningContext**
  - **Description**: Create internal/screening/context_pool.go with ScreeningContext struct (pre-allocated evidence slice cap 6, name buffer cap 256, score accumulator float64). Implement sync.Pool with New func, AcquireContext() and ReleaseContext() helpers, and Reset() method that zeroes state without deallocation.
  - **Files**: `internal/screening/context_pool.go` (new, ~40 lines), `internal/screening/context_pool_test.go` (new)
  - **Requirements**: FR-CONC-003
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] sync.Pool manages ScreeningContext lifecycle
    - [ ] Reset() zeroes slices (length=0, capacity preserved)
    - [ ] Benchmark: 0 allocs/op for Acquire/Use/Release cycle
    - [ ] Table-driven tests

- [ ] **3.2 Implement parallel Engine.ScreenParallel()**
  - **Description**: Create internal/screening/engine_parallel.go with ScreenParallel() method. For each candidate: create errgroup with context (100ms timeout), launch goroutine per matcher (6 total), collect evidence via mutex-protected slice, call g.Wait(), then score. Soft failure: individual matcher errors logged but don't fail screening. Use ScreeningContext from pool.
  - **Files**: `internal/screening/engine_parallel.go` (new, ~70 lines), `internal/screening/engine_parallel_test.go` (new)
  - **Requirements**: FR-CONC-001
  - **Estimated Time**: L (5 hours)
  - **Dependencies**: 3.1, go get golang.org/x/sync
  - **Acceptance Criteria**:
    - [ ] 6 goroutines launched per candidate (one per matcher)
    - [ ] errgroup.WithContext with 100ms timeout
    - [ ] Mutex protects evidence slice
    - [ ] Individual matcher failures don't fail screening
    - [ ] Table-driven tests for: all succeed, some fail, timeout

- [ ] **3.3 Implement early termination**
  - **Description**: Create internal/screening/engine_shortcircuit.go. Enhance parallel screening: if any matcher produces score > tenant threshold, cancel context (which cancels remaining goroutines). Record "short_circuited: true" in match evidence for audit. Benchmark: measure latency savings on high-confidence matches.
  - **Files**: `internal/screening/engine_shortcircuit.go` (new, ~50 lines), `internal/screening/engine_shortcircuit_test.go` (new)
  - **Requirements**: FR-CONC-002
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: 3.2
  - **Acceptance Criteria**:
    - [ ] Context cancelled when any matcher exceeds threshold
    - [ ] Cancelled matchers return partial results (not errors)
    - [ ] Short-circuit flag recorded in evidence
    - [ ] Benchmark proves 40%+ latency savings on high-confidence

- [ ] **3.4 Create BatchScreener with worker pool**
  - **Description**: Create internal/screening/batch_pool.go with BatchScreener struct. Configurable concurrency (default 16). Buffered input channel (cap 1000). N worker goroutines read entities from input, call ScreenParallel(), send results to output channel. Result collector aggregates into []ScreenResponse. Progress callback called every 100 entities.
  - **Files**: `internal/screening/batch_pool.go` (new, ~80 lines), `internal/screening/batch_pool_test.go` (new)
  - **Requirements**: FR-CONC-004
  - **Estimated Time**: L (4 hours)
  - **Dependencies**: 3.2
  - **Acceptance Criteria**:
    - [ ] 16 worker goroutines by default
    - [ ] Buffered channels for input and output
    - [ ] Progress callback every 100 entities
    - [ ] 1000 entities in < 5 seconds (benchmarked)
    - [ ] Table-driven test with 10, 100, 1000 entity batches

- [ ] **3.5 Add graceful shutdown to worker pool**
  - **Description**: Create internal/screening/pool_shutdown.go. On context cancellation: (1) close input channel (no new work), (2) wait for in-flight goroutines to complete (up to 30s), (3) force-exit if timeout. Wire into cmd/api/main.go server shutdown: cancel pool context on SIGTERM/SIGINT.
  - **Files**: `internal/screening/pool_shutdown.go` (new, ~40 lines), `cmd/api/shutdown.go` (new, ~30 lines)
  - **Requirements**: FR-CONC-004
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: 3.4
  - **Acceptance Criteria**:
    - [ ] Graceful: in-flight work completes before shutdown
    - [ ] Timeout: force-exit after 30s
    - [ ] SIGTERM/SIGINT trigger shutdown
    - [ ] No goroutine leaks (verify with -race flag)

- [ ] **3.6 Create performance benchmarks**
  - **Description**: Create internal/screening/bench_test.go with Go benchmarks: BenchmarkExactMatch, BenchmarkFuzzyMatch, BenchmarkPhoneticMatch, BenchmarkFullScreenSequential, BenchmarkFullScreenParallel, BenchmarkBatch100, BenchmarkBatch1000. Use b.ResetTimer() and b.ReportAllocs(). Assert parallel is >3x faster than sequential for 50+ candidates.
  - **Files**: `internal/screening/bench_test.go` (new, ~90 lines)
  - **Requirements**: FR-CONC-001
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: 3.2, 3.4
  - **Acceptance Criteria**:
    - [ ] 7 benchmark functions covering all matchers + engine
    - [ ] b.ReportAllocs() on all benchmarks
    - [ ] Parallel benchmark >3x faster than sequential
    - [ ] sync.Pool benchmark achieves 0 allocs/op

---

## Phase 4: Sanctions List Expansion (Sprint 4, Weeks 7--8)

- [ ] **4.1 Add OFAC extended list source enums and marketplace entries**
  - **Description**: Add ListSourceOFACNonSDN, ListSourceOFACSSI, ListSourceOFACFSE to domain/list_source.go. Create internal/domain/marketplace_ofac.go with marketplace entries for all 3 new OFAC lists using VERIFIED URLs from treasury.gov. These share the existing OFAC CSV parser format.
  - **Files**: `internal/domain/list_source.go` (edit: add 3 enums), `internal/domain/marketplace_ofac.go` (new, ~40 lines)
  - **Requirements**: FR-LIST-001
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: Phase 1 complete
  - **Acceptance Criteria**:
    - [ ] 3 new ListSource enums with String() methods
    - [ ] URLs verified against treasury.gov (must be real, working URLs)
    - [ ] Marketplace entries categorized as "Global" sanctions

- [ ] **4.2 Create OFAC XML parser**
  - **Description**: Create internal/ingestion/ofac_xml.go that parses the OFAC Sanctions List Service XML format (based on UN sanctions data model). Handle SDN entries, Non-SDN entries, SSI entries, FSE entries. Extract: entity name (all aliases), entity type (individual/entity/vessel), identifiers (DOB, passport, address), list classification. This is a new parser alongside the existing CSV parser.
  - **Files**: `internal/ingestion/ofac_xml.go` (new, ~90 lines), `internal/ingestion/ofac_xml_test.go` (new)
  - **Requirements**: FR-LIST-001
  - **Estimated Time**: L (5 hours)
  - **Dependencies**: 4.1
  - **Acceptance Criteria**:
    - [ ] Parses OFAC XML sanctions_list.xml format
    - [ ] Extracts all name aliases per entity
    - [ ] Handles all entity types (individual, entity, vessel, aircraft)
    - [ ] Table-driven tests with sample XML from each OFAC list
    - [ ] File under 100 lines

- [ ] **4.3 Add Australia DFAT parser**
  - **Description**: Create internal/ingestion/au_dfat.go parsing the DFAT consolidated list CSV. Fields: Reference, Name Type, Name, Date of Birth, Place of Birth, Citizenship, Address, Additional Info, Listing Information, Committees. Create marketplace entry in new internal/domain/marketplace_apac.go. Source: dfat.gov.au/international-relations/security/sanctions/consolidated-list.
  - **Files**: `internal/ingestion/au_dfat.go` (new, ~60 lines), `internal/ingestion/au_dfat_test.go` (new), `internal/domain/marketplace_apac.go` (new, ~30 lines)
  - **Requirements**: FR-LIST-002
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] Parses DFAT CSV format with all key fields
    - [ ] Marketplace entry with Region: "Asia-Pacific"
    - [ ] Source URL verified against dfat.gov.au
    - [ ] Table-driven tests with sample DFAT data

- [ ] **4.4 Add Canada SEMA parser**
  - **Description**: Create internal/ingestion/ca_sema.go parsing Global Affairs Canada SEMA sanctions XML. Extract: entity name, aliases, identification documents, country. Register in registry.go as "ca_sema" parser type.
  - **Files**: `internal/ingestion/ca_sema.go` (new, ~70 lines), `internal/ingestion/ca_sema_test.go` (new)
  - **Requirements**: FR-LIST-003
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] Parses Canada SEMA XML format
    - [ ] Handles aliases and identification documents
    - [ ] Registered as "ca_sema" parser type
    - [ ] Table-driven tests with sample data

- [ ] **4.5 Add Japan MOF parser (OpenSanctions format)**
  - **Description**: Create internal/ingestion/jp_mof.go using the existing OpenSanctions CSV parser pattern. Source: data.opensanctions.org/datasets/latest/jp_mof_sanctions/targets.simple.csv. This follows the same format as other OpenSanctions datasets already in the codebase. Add marketplace entry in marketplace_apac.go.
  - **Files**: `internal/ingestion/jp_mof.go` (new, ~30 lines), `internal/ingestion/jp_mof_test.go` (new), `internal/domain/marketplace_apac.go` (edit: add Japan entry)
  - **Requirements**: FR-LIST-002
  - **Estimated Time**: S (1 hour)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] Uses existing OpenSanctions CSV parsing pattern
    - [ ] Source URL uses data.opensanctions.org
    - [ ] Marketplace entry with Region: "Asia-Pacific"

- [ ] **4.6 Add US BIS Entity List parser**
  - **Description**: Create internal/ingestion/us_bis_entity.go parsing the BIS Entity List CSV. Fields: Entity Name, Country, License Requirement, License Policy, Federal Register Citation. Distinct from existing us_bis_denied parser (different list, different fields).
  - **Files**: `internal/ingestion/us_bis_entity.go` (new, ~60 lines), `internal/ingestion/us_bis_entity_test.go` (new)
  - **Requirements**: FR-LIST-003
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] Parses BIS Entity List CSV (distinct from Denied Persons)
    - [ ] Extracts all key fields including license policy
    - [ ] Registered as "bis_entity" parser type
    - [ ] Table-driven tests

- [ ] **4.7 Create FATF country risk provider**
  - **Description**: Create internal/screening/fatf_risk.go with FATFRiskProvider struct. Contains grey list (22 countries as of Feb 2026) and black list (3 countries: DPRK, Iran, Myanmar) as map[string]bool keyed by ISO country code. RiskLevel(code) returns HighRisk/ElevatedRisk/StandardRisk. Create internal/domain/country_risk.go with CountryRisk enum. Integrate into scorer as weight modifier: HighRisk +15% confidence, ElevatedRisk +5%.
  - **Files**: `internal/screening/fatf_risk.go` (new, ~60 lines), `internal/screening/fatf_risk_test.go` (new), `internal/domain/country_risk.go` (new, ~20 lines)
  - **Requirements**: FR-LIST-004
  - **Estimated Time**: M (3 hours)
  - **Dependencies**: None
  - **Acceptance Criteria**:
    - [ ] Grey list: 22 countries from February 2026 FATF plenary
    - [ ] Black list: North Korea (KP), Iran (IR), Myanmar (MM)
    - [ ] RiskLevel returns correct enum for each category
    - [ ] Scorer applies +15% for HighRisk, +5% for ElevatedRisk
    - [ ] Table-driven tests for all 3 risk levels

- [ ] **4.8 Update UK OFSI parser for UKSL format**
  - **Description**: Update the uk_ofsi.go parser (renamed in Phase 1) to handle the new unified UK Sanctions List format introduced January 28, 2026. The UKSL replaces the old OFSI Consolidated List and includes financial, immigration, trade, and transport sanctions in one file. Update source URL in all_lists.go.
  - **Files**: `internal/ingestion/uk_ofsi.go` (edit for new format), `internal/ingestion/uk_ofsi_test.go` (edit), `internal/ingestion/all_lists.go` (edit URL)
  - **Requirements**: FR-LIST-005
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: 1.2 (UK rename complete)
  - **Acceptance Criteria**:
    - [ ] Parses UKSL format correctly
    - [ ] Source URL: gov.uk/government/publications/the-uk-sanctions-list
    - [ ] Handles all sanction types (financial, immigration, trade, transport)
    - [ ] Table-driven tests with sample UKSL data

- [ ] **4.9 Register all new lists and update auto-loader**
  - **Description**: Add all new lists to AllMajorLists() in all_lists.go. Update MarketplaceCatalog() in marketplace_data.go to include marketplace_ofac.go and marketplace_apac.go entries. Register new parsers in registry.go. Ensure auto_load.go seeds all new lists on startup.
  - **Files**: `internal/ingestion/all_lists.go` (edit: add 8 new list configs), `internal/ingestion/registry.go` (edit: register new parsers), `internal/ingestion/auto_load.go` (edit if needed), `internal/domain/marketplace_data.go` (edit: call new marketplace funcs)
  - **Requirements**: FR-LIST-001, FR-LIST-002, FR-LIST-003
  - **Estimated Time**: M (2 hours)
  - **Dependencies**: 4.1--4.8
  - **Acceptance Criteria**:
    - [ ] AllMajorLists() returns all original + 8 new lists
    - [ ] MarketplaceCatalog() includes all marketplace entries
    - [ ] All new parsers registered in registry
    - [ ] auto_load seeds new lists for all tenants
    - [ ] Total list count is 24+ (verifiable via ListCount())

---

## Phase 5: Redis Caching + Bloom (Sprint 5, Weeks 9--10)

Tasks 5.1--5.7 as specified in performance-requirements.md FR-CACHE-001 through FR-CACHE-003.

Key files: internal/cache/redis_client.go, redis_screen_cache.go, bloom_filter.go, bloom_builder.go, internal/ingestion/sync_cache_invalidate.go, api/handler_screen_cached.go.

---

## Phase 6: Async Workers (Sprint 6, Weeks 11--12)

Tasks 6.1--6.6 as specified in performance-requirements.md FR-CONC-004.

Key files: internal/worker/pool.go, batch_worker.go, sync_orchestrator.go, daily_refresh_parallel.go, ongoing_monitor_worker.go, cmd/worker/task_scheduler.go.

---

## Phase 7: Benchmarking + Observability (Sprint 7, Weeks 13--14)

Tasks 7.1--7.6 as specified in performance-requirements.md FR-OBS-001, FR-OBS-002.

Key files: internal/telemetry/tracer.go, metrics.go, tests/load/k6_screening.js, api/middleware_metrics.go, .github/workflows/benchmark.yml.

---

## Phase 8: Production Hardening (Sprint 8, Weeks 15--16)

Tasks 8.1--8.8 as specified in performance-requirements.md FR-PROD-001 through FR-PROD-004.

Key files: internal/storage/pgx/pool.go, migrations/033-035, deploy/k8s/*.yaml, tests/e2e/smoke_test.go, docs/ARCHITECTURE.md.

---

## Definition of Done (All Phases)

Every task must meet ALL criteria:

- [ ] Code compiles: `go build ./...` with zero warnings
- [ ] Tests pass: `go test ./... -race` all green
- [ ] Table-driven tests: `tests := []struct{...}` pattern used
- [ ] File limit: every file <= 100 lines (wc -l)
- [ ] No panic(): `grep -r "panic(" --include="*.go"` returns 0 in non-test files
- [ ] Context propagation: first param is `ctx context.Context` on all public funcs
- [ ] No hardcoded data: all URLs verified, all counts dynamic
- [ ] Interfaces <= 3 methods: prefer composition
- [ ] Value objects: `NewXxx() returns (Xxx, error)`
- [ ] Benchmarks: exist for performance-critical paths
- [ ] Docker builds: `docker build -t aegis-api .` succeeds
- [ ] Documentation: relevant docs/*.md files updated

---

**End of Implementation Plan**

Cross-reference: performance-requirements.md, performance-design.md, Content Integrity Audit Report
