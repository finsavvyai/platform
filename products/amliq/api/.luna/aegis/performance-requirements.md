# AMLIQ v2 -- Performance & Audit Remediation Requirements

**Project**: AMLIQ (AI-Enhanced Global Intelligence Screening)
**Version**: 2.1
**Generated**: 2026-04-01
**Scope**: High-Performance Architecture + Content Audit Fixes
**Agent**: Requirements Agent (Performance Pass)
**Based on**: Content Integrity Audit Report, Performance Research

---

## Table of Contents

1. [Audit Remediation Requirements](#1-audit-remediation-requirements)
2. [Elasticsearch Requirements](#2-elasticsearch-requirements)
3. [Concurrency Requirements](#3-concurrency-requirements)
4. [Caching Requirements](#4-caching-requirements)
5. [Sanctions List Expansion Requirements](#5-sanctions-list-expansion-requirements)
6. [Observability Requirements](#6-observability-requirements)
7. [Production Hardening Requirements](#7-production-hardening-requirements)
8. [Gap Analysis](#8-gap-analysis)

---

## 1. Audit Remediation Requirements

### FR-AUDIT-001: Remove False Marketing Claims
**Priority**: Critical
**Status**: Not Started

All marketing materials must reflect only real, verifiable data.

**Acceptance Criteria**:
- [ ] "40+ sanctions lists" replaced with dynamic count from MarketplaceCatalog()
- [ ] Fabricated testimonials removed entirely from marketing.json
- [ ] ListCount() helper returns actual count from marketplace entries
- [ ] All 6 occurrences in marketing.json, auth.json (en + he) updated
- [ ] No hardcoded list counts anywhere in frontend code

### FR-AUDIT-002: Correct UK Sanctions Attribution
**Priority**: Critical
**Status**: Not Started

All references to "UK HMRC" must be corrected to UK OFSI/FCDO.

**Acceptance Criteria**:
- [ ] ListSourceHMRC renamed to ListSourceUKOFSI in domain/list_source.go
- [ ] Parser file renamed: hmrc.go -> uk_ofsi.go, hmrc_test.go -> uk_ofsi_test.go
- [ ] GLOSSARY.md UK section references OFSI, FCDO, POCA 2002, MLR 2017
- [ ] Source URL updated to UKSL endpoint (gov.uk/government/publications/the-uk-sanctions-list)
- [ ] All marketplace entries updated with correct attribution

### FR-AUDIT-003: Remove Unsubstantiated Claims
**Priority**: High
**Status**: Not Started

Remove all unverifiable performance comparisons and compliance claims.

**Acceptance Criteria**:
- [ ] FP rate "<5% vs World-Check 95%" removed from VISION.md, GLOSSARY.md
- [ ] SOC 2 section in SECURITY.md reworded to "SOC 2 Readiness"
- [ ] GDPR section reworded to "GDPR Design Principles"
- [ ] NPS comparison with World-Check removed from VISION.md
- [ ] No language implies achieved certification without actual cert

### FR-AUDIT-004: Update Regulatory Framework
**Priority**: High
**Status**: Not Started

All regulatory references must reflect current (April 2026) reality.

**Acceptance Criteria**:
- [ ] AMLD6 added as current EU AML directive (adopted May 2024)
- [ ] EU AMLA referenced (operational July 2025, Frankfurt)
- [ ] FATF 40 Recommendations referenced (updated November 2023, includes CPF)
- [ ] UK POCA 2002 and MLR 2017 added to glossary
- [ ] Missing terms added: STR, TFS, CPF, EDD, CDD, SDD
- [ ] New file docs/REGULATORY.md with verified framework per jurisdiction

### FR-AUDIT-005: Fix Data Accuracy
**Priority**: High
**Status**: Not Started

Eliminate all hardcoded/fabricated data in the codebase.

**Acceptance Criteria**:
- [ ] EntityCount fields in marketplace_data.go set to 0 (populated dynamically on sync)
- [ ] LastSynced timestamps populated from actual sync operations only
- [ ] OpenSanctions described as "open-source intelligence project" (not "Journalism NGO")
- [ ] EU source URL uses data.europa.eu stable endpoint
- [ ] CoE Parliamentary Assembly uses data.opensanctions.org (not archive.org)
- [ ] EEAS/EU list redundancy resolved with clear differentiation

---

## 2. Elasticsearch Requirements

### FR-ES-001: Elasticsearch Client Integration
**Priority**: Critical
**Status**: Not Started

The system shall use Elasticsearch as the primary candidate retrieval engine.

**Acceptance Criteria**:
- [ ] ES client wrapper in internal/search/es_client.go
- [ ] Uses official elasticsearch-go v8 client
- [ ] Connection pool with configurable max connections
- [ ] Health check endpoint (/api/v1/health includes ES status)
- [ ] ES_URL configurable via environment variable
- [ ] Retry logic with exponential backoff (3 retries, 1s/2s/4s)
- [ ] Graceful fallback to PostgreSQL ILIKE if ES unavailable

### FR-ES-002: Sanctions Entity Index Mapping
**Priority**: Critical
**Status**: Not Started

The ES index must support multi-field name matching with phonetic analysis.

**Acceptance Criteria**:
- [ ] Index mapping in internal/search/index_mapping.go
- [ ] Fields: name_exact (keyword), name_fuzzy (text/standard), name_phonetic (text/double_metaphone), name_normalized (text/lowercase+asciifolding)
- [ ] Additional fields: list_id (keyword), entity_type (keyword), identifiers (nested), updated_at (date)
- [ ] Settings: 3 shards, 1 replica, 5s refresh interval
- [ ] Custom phonetic_analyzer with double_metaphone filter
- [ ] Custom normalized_analyzer with asciifolding filter
- [ ] File under 100 lines

### FR-ES-003: Bulk Indexing Pipeline
**Priority**: Critical
**Status**: Not Started

Entities must be bulk-indexed into ES on sync with zero data loss.

**Acceptance Criteria**:
- [ ] Indexer interface: Index(ctx, entities []Entity) error, Delete(ctx, ids []string) error
- [ ] Implementation uses esutil.BulkIndexer (4 workers, 5MB flush, 30s interval)
- [ ] Wired into SyncService: after PostgreSQL upsert, index into ES
- [ ] On SoftDelete, also remove from ES
- [ ] Error handling: failed items logged, retried once, then recorded for manual review
- [ ] Index operations are idempotent (upsert semantics)

### FR-ES-004: Multi-Field Search Query
**Priority**: Critical
**Status**: Not Started

Screening must query ES with boosted multi-field matching.

**Acceptance Criteria**:
- [ ] Searcher interface: Search(ctx, query ScreenRequest) ([]Candidate, error)
- [ ] Query: bool/should with exact (boost 10), fuzzy (boost 5, fuzziness AUTO), phonetic (boost 3), normalized (boost 2)
- [ ] minimum_should_match: 1
- [ ] Returns top 50 candidates with ES scores
- [ ] Filters by tenant-enabled list IDs
- [ ] Query latency < 15ms p95 on 2M entity index

### FR-ES-005: Zero-Downtime Reindexing
**Priority**: High
**Status**: Not Started

Full reindex must complete without service interruption.

**Acceptance Criteria**:
- [ ] cmd/reindex/main.go creates new index with timestamp suffix
- [ ] Bulk-reindexes all entities from PostgreSQL to new index
- [ ] Atomically swaps index alias to new index
- [ ] Deletes old index after successful swap
- [ ] Supports --dry-run flag for validation
- [ ] Logs progress every 10,000 entities

---

## 3. Concurrency Requirements

### FR-CONC-001: Parallel Matcher Execution
**Priority**: Critical
**Status**: Not Started

All 6 matching layers must execute in parallel goroutines.

**Acceptance Criteria**:
- [ ] Engine.ScreenParallel() launches goroutine per matcher via errgroup
- [ ] Each matcher receives independent context with 100ms timeout
- [ ] Results collected via mutex-protected evidence slice
- [ ] errgroup.Wait() aggregates all results before scoring
- [ ] Soft failure: individual matcher errors logged but don't fail screening
- [ ] Benchmark proves >3x speedup vs sequential for 50+ candidates

### FR-CONC-002: Early Termination
**Priority**: High
**Status**: Not Started

Screening must short-circuit when confidence exceeds threshold.

**Acceptance Criteria**:
- [ ] If any matcher produces score > tenant threshold, cancel remaining via context
- [ ] Cancelled matchers return partial results (not errors)
- [ ] Short-circuit saves 40-60% latency on high-confidence matches (benchmarked)
- [ ] Early termination recorded in match evidence for audit trail

### FR-CONC-003: sync.Pool for Hot Path
**Priority**: High
**Status**: Not Started

Screening context objects must be pooled to eliminate GC pressure.

**Acceptance Criteria**:
- [ ] ScreeningContext struct with pre-allocated evidence slice (cap 6), name buffers, score accumulators
- [ ] sync.Pool manages ScreeningContext lifecycle
- [ ] Reset() method clears state without deallocation
- [ ] Benchmark achieves 0 allocs/op on hot screening path

### FR-CONC-004: Batch Worker Pool
**Priority**: High
**Status**: Not Started

Batch screening must use configurable worker pool.

**Acceptance Criteria**:
- [ ] BatchScreener with N configurable goroutines (default 16)
- [ ] Buffered input channel (capacity 1000)
- [ ] Result collector with progress callback
- [ ] Graceful shutdown: context cancellation drains in-flight, waits 30s
- [ ] Batch of 1000 entities completes in < 5 seconds (benchmarked)

---

## 4. Caching Requirements

### FR-CACHE-001: Redis Screening Cache
**Priority**: High
**Status**: Not Started

Repeated screenings must be served from cache.

**Acceptance Criteria**:
- [ ] ScreenCache interface: Get/Set/Invalidate
- [ ] Redis implementation with 24-hour TTL
- [ ] Cache key = SHA256(normalized_name + sorted_list_ids + tenant_id)
- [ ] Cache hit returns result in < 1ms
- [ ] Cache miss triggers full screening, then caches result
- [ ] REDIS_URL configurable with TLS support

### FR-CACHE-002: Cache Invalidation on Sync
**Priority**: High
**Status**: Not Started

Cache must be invalidated when sanctions lists are updated.

**Acceptance Criteria**:
- [ ] After SyncService updates a list, invalidate all cache entries for that list
- [ ] Pattern-based invalidation: SCAN for keys matching list ID
- [ ] Invalidation is asynchronous (does not block sync operation)
- [ ] Logged: "Invalidated N cache entries for list X"

### FR-CACHE-003: Bloom Filter Pre-Check
**Priority**: Medium
**Status**: Not Started

Names not in any sanctions list must be rejected instantly.

**Acceptance Criteria**:
- [ ] Bloom filter populated with all normalized entity names
- [ ] Check before ES query: if name NOT in Bloom, return empty result
- [ ] False positive rate < 1% (acceptable: may proceed to ES unnecessarily)
- [ ] Zero false negatives (never skip a real match)
- [ ] Rebuilt after each list sync (full rebuild, not incremental)
- [ ] Stored in Redis as binary blob

---

## 5. Sanctions List Expansion Requirements

### FR-LIST-001: OFAC Consolidated Coverage
**Priority**: Critical
**Status**: Not Started

All OFAC sub-lists must be supported.

**Acceptance Criteria**:
- [ ] OFAC SDN (existing) -- verify URL: treasury.gov/ofac/downloads/sdn.csv
- [ ] OFAC Non-SDN Consolidated List -- new parser
- [ ] OFAC Sectoral Sanctions (SSI) -- new parser
- [ ] OFAC Foreign Sanctions Evaders (FSE) -- new parser
- [ ] All use OFAC XML parser (sanctions_list.xml from Sanctions List Service)
- [ ] Marketplace entries with verified real URLs

### FR-LIST-002: APAC Jurisdiction Coverage
**Priority**: Critical
**Status**: Not Started

Platform must support major Asia-Pacific sanctions lists.

**Acceptance Criteria**:
- [ ] Australia DFAT Consolidated List: dfat.gov.au source, CSV parser
- [ ] Japan MOF Sanctions: via OpenSanctions jp_mof_sanctions dataset
- [ ] Added to marketplace with correct Region: "Asia-Pacific"
- [ ] Table-driven tests with sample data from each list

### FR-LIST-003: Americas Extended Coverage
**Priority**: High
**Status**: Not Started

US extended lists and Canada must be supported.

**Acceptance Criteria**:
- [ ] US BIS Entity List: bis.doc.gov source, CSV parser
- [ ] Canada SEMA: Global Affairs Canada source, XML parser
- [ ] Added to marketplace with correct Region: "Americas"

### FR-LIST-004: FATF Country Risk Integration
**Priority**: High
**Status**: Not Started

Screening must incorporate FATF jurisdictional risk data.

**Acceptance Criteria**:
- [ ] FATFRiskProvider with grey list (22 jurisdictions) and black list (3 jurisdictions)
- [ ] Country risk enhances screening confidence for entities from high-risk jurisdictions
- [ ] Data updated after each FATF plenary (February, June, October)
- [ ] Integrated into scoring as CountryRiskEnhancer bonus weight
- [ ] Current data as of February 2026: Grey list includes Albania, Botswana, Bulgaria, Cambodia, Cayman Islands, Croatia, DRC, Ghana, Haiti, Jamaica, Kenya, Kuwait, Lebanon, Monaco, Namibia, Nepal, Papua New Guinea, South Sudan, Syria, Venezuela, Vietnam, Virgin Islands (UK), Yemen. Black list: North Korea, Iran, Myanmar.

### FR-LIST-005: UK Sanctions List Update
**Priority**: Critical
**Status**: Not Started

UK parser must use the new unified UKSL format.

**Acceptance Criteria**:
- [ ] Parser updated for UKSL format (replaced OFSI ConList January 28, 2026)
- [ ] Source URL: gov.uk/government/publications/the-uk-sanctions-list
- [ ] All "HMRC" naming removed (see FR-AUDIT-002)
- [ ] Attribution: FCDO / OFSI

---

## 6. Observability Requirements

### FR-OBS-001: Distributed Tracing
**Priority**: Medium
**Status**: Not Started

Every screening request must produce a trace with per-layer spans.

**Acceptance Criteria**:
- [ ] OpenTelemetry integration in internal/telemetry/
- [ ] Root span: "screen.request" with trace_id
- [ ] Child spans: "matcher.exact", "matcher.fuzzy", "matcher.phonetic", "matcher.token", "matcher.embedding", "matcher.graph"
- [ ] Span attributes: candidate_count, match_count, confidence, cache_hit
- [ ] Export to Jaeger (dev) or OTLP collector (prod)
- [ ] trace_id included in all log lines

### FR-OBS-002: Prometheus Metrics
**Priority**: Medium
**Status**: Not Started

System must export latency, throughput, and error metrics.

**Acceptance Criteria**:
- [ ] screening_duration_seconds histogram with labels: layer, tenant_id
- [ ] screening_requests_total counter with labels: status, tenant_id
- [ ] cache_hit_ratio gauge
- [ ] es_query_duration_seconds histogram
- [ ] active_goroutines gauge
- [ ] /metrics endpoint on separate port (9090)

---

## 7. Production Hardening Requirements

### FR-PROD-001: Connection Pool Optimization
**Priority**: High
**Status**: Not Started

Database connections must use pgxpool with production tuning.

**Acceptance Criteria**:
- [ ] Replace database/sql with pgx/v5 pgxpool
- [ ] MaxConns=50, MinConns=10, MaxConnLifetime=15m, MaxConnIdleTime=5m
- [ ] Health check ping every 30s
- [ ] Connection metrics exported to Prometheus

### FR-PROD-002: Table Partitioning
**Priority**: Medium
**Status**: Not Started

Entities table must be partitioned for large-scale performance.

**Acceptance Criteria**:
- [ ] HASH partition on list_id (8 partitions)
- [ ] Per-partition indexes for common queries
- [ ] Migration with backfill from existing table
- [ ] Query planner uses partition pruning (verified via EXPLAIN ANALYZE)

### FR-PROD-003: pgvector HNSW Index
**Priority**: High
**Status**: Not Started

Embedding search must use HNSW index for production performance.

**Acceptance Criteria**:
- [ ] Migration: CREATE INDEX USING hnsw WITH (m=16, ef_construction=256)
- [ ] Query-time: SET hnsw.ef_search = 100
- [ ] Benchmark: embedding search < 30ms on 1M vectors

### FR-PROD-004: Kubernetes Deployment
**Priority**: Medium
**Status**: Not Started

System must be deployable to Kubernetes.

**Acceptance Criteria**:
- [ ] API Deployment: 3 replicas, HPA (CPU 70%), resource limits
- [ ] Worker Deployment: 2 replicas, resource limits
- [ ] ES StatefulSet: 3 nodes, persistent volumes
- [ ] Redis Deployment: 1 replica, persistent volume
- [ ] PostgreSQL StatefulSet: 1 primary + 1 read replica
- [ ] Liveness and readiness probes on all pods
- [ ] ConfigMap for environment variables, Secret for credentials

---

## 8. Gap Analysis

### New Gaps Identified (Performance Pass)

| Gap ID | Description | Severity | Sprint |
|--------|-------------|----------|--------|
| GAP-007 | No Elasticsearch integration -- screening uses PG ILIKE scan | Critical | Sprint 2 |
| GAP-008 | Sequential matcher execution -- no goroutine parallelism | Critical | Sprint 3 |
| GAP-009 | No caching layer -- every screening hits database | High | Sprint 5 |
| GAP-010 | Missing 8+ major sanctions lists (OFAC Non-SDN, AU, CA, JP) | Critical | Sprint 4 |
| GAP-011 | No FATF country risk integration | High | Sprint 4 |
| GAP-012 | No distributed tracing or metrics | Medium | Sprint 7 |
| GAP-013 | No performance benchmarks or load tests | Medium | Sprint 7 |
| GAP-014 | PostgreSQL not tuned (no partitioning, no pgxpool) | High | Sprint 8 |
| GAP-015 | No Kubernetes manifests | Medium | Sprint 8 |
| GAP-016 | 18 audit findings (4 critical, 5 high) in content | Critical | Sprint 1 |

### Existing Gaps Still Open

| Gap ID | Description | Status |
|--------|-------------|--------|
| GAP-001 | Embedding matcher not wired into engine | From requirements.md -- addressed in Sprint 3 |
| GAP-002 | Graph matcher stub implementation | From requirements.md -- addressed in Sprint 3 |
| GAP-003 | Short-circuit optimization missing | From requirements.md -- addressed in Sprint 3 |
| GAP-004 | Per-list confidence thresholds not wired | From requirements.md -- addressed in Sprint 3 |
| GAP-005 | RBAC role expansion incomplete | From requirements.md -- separate sprint |

---

**End of Performance Requirements Document**

Cross-reference: Content Integrity Audit Report (AMLIQ_Content_Integrity_Audit.docx), Sprint Plan (AMLIQ_Sprint_Plan.docx)
