# AMLIQ v2 -- High-Performance Architecture Design

**Scope**: Elasticsearch + Go Goroutines + Redis Caching + Production Hardening
**Generated**: 2026-04-01
**Agent**: Design Architect Agent (Performance Pass)
**Based on**: performance-requirements.md, Content Integrity Audit Report

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Elasticsearch Design](#2-elasticsearch-design)
3. [Goroutine Concurrency Design](#3-goroutine-concurrency-design)
4. [Caching Layer Design](#4-caching-layer-design)
5. [Sanctions List Expansion Design](#5-sanctions-list-expansion-design)
6. [Database Optimization Design](#6-database-optimization-design)
7. [Observability Design](#7-observability-design)
8. [Infrastructure Design](#8-infrastructure-design)

---

## 1. Architecture Overview

### 1.1 Current vs Target Data Flow

**Current (Sequential, PostgreSQL only)**:
```
Request -> Handler -> Engine.Screen() [sequential loop]
  -> for each candidate: Exact -> Fuzzy -> Phonetic -> Token -> Embed -> Graph
  -> PostgreSQL ILIKE query (full table scan on 100k+ entities)
  -> Single goroutine, no caching, no pre-filtering
  -> Response (~200-500ms for large lists)
```

**Target (Parallel, ES + Redis + Goroutines)**:
```
Request -> Handler -> Bloom Filter (instant negative, <0.01ms)
  -> Redis Cache HIT? -> Return cached result (<1ms)
  -> MISS -> Elasticsearch multi-field query (<15ms)
    -> Returns top-50 candidates with ES scores
  -> Fan-out to 6 goroutines via errgroup
    -> Exact | Fuzzy | Phonetic | Token | Embedding | Graph [parallel]
    -> errgroup.Wait() -> collect all evidence (<20ms)
  -> WeightedScorer -> Confidence + Explanation
  -> Redis Cache SET -> Response (<35ms p95)
```

### 1.2 New Package Structure

```
internal/
  search/                   # NEW: Elasticsearch integration
    es_client.go            # Client wrapper, pool, health check
    es_client_test.go
    index_mapping.go        # Sanctions entity index definition
    index_mapping_test.go
    indexer.go              # Indexer interface
    es_indexer.go           # BulkIndexer implementation
    es_indexer_test.go
    searcher.go             # Searcher interface
    es_searcher.go          # Multi-field query implementation
    es_searcher_test.go
    reindexer.go            # Zero-downtime reindex
    reindexer_test.go
  cache/                    # NEW: Redis caching layer
    redis_client.go         # Client wrapper, pool, TLS
    redis_client_test.go
    screen_cache.go         # ScreenCache interface
    redis_screen_cache.go   # Redis implementation
    redis_screen_cache_test.go
    bloom_filter.go         # Bloom filter for negative lookups
    bloom_builder.go        # Build/rebuild from entity data
    bloom_filter_test.go
  worker/                   # NEW: Concurrent worker infrastructure
    pool.go                 # Generic worker pool
    pool_test.go
    batch_worker.go         # Batch screening with pool
    batch_worker_test.go
    sync_orchestrator.go    # Concurrent list sync
    sync_orchestrator_test.go
  telemetry/                # NEW: Observability
    tracer.go               # OpenTelemetry init
    tracer_init.go          # Provider setup
    metrics.go              # Prometheus metrics
    metrics_screening.go    # Screening-specific metrics
```

### 1.3 Performance Targets

| Metric | Current | Target | Implementation |
|--------|---------|--------|----------------|
| Single screening p95 | 200-500ms | <35ms | ES + parallel matchers + cache |
| Batch 1000 entities | ~60s | <5s | 16-goroutine worker pool |
| Cache hit ratio | 0% | >80% | Redis + Bloom pre-filter |
| Throughput (req/sec) | ~100 | 5,000+ | Connection pooling + caching |
| Entity index size | 100k | 5M+ | ES sharding + PG partitioning |
| Memory per screening | Unknown | 0 allocs/op | sync.Pool reuse |

---

## 2. Elasticsearch Design

### 2.1 Index Mapping Specification

**Index name pattern**: `sanctions-entities-v{timestamp}`
**Alias**: `sanctions-entities` (always points to current index)

**Analyzers**:

| Analyzer | Tokenizer | Filters | Purpose |
|----------|-----------|---------|---------|
| standard (default) | standard | lowercase | Fuzzy text matching |
| phonetic_analyzer | standard | lowercase, double_metaphone | Cross-language phonetic matching |
| normalized_analyzer | standard | lowercase, asciifolding | Diacritics/accent removal |

**Field Mapping**:

| Field | ES Type | Analyzer | Boost | Purpose |
|-------|---------|----------|-------|---------|
| name_exact | keyword | none | 10 | Exact match lookup |
| name_fuzzy | text | standard | 5 | Fuzzy matching with fuzziness: AUTO |
| name_phonetic | text | phonetic_analyzer | 3 | Sound-alike matching |
| name_normalized | text | normalized_analyzer | 2 | Accent-insensitive matching |
| list_id | keyword | none | - | Filter by enabled lists |
| entity_type | keyword | none | - | Filter by entity type |
| identifiers | nested | none | - | DOB, passport, etc. |
| updated_at | date | none | - | Freshness tracking |

**Cluster Settings**:
- Shards: 3 (one per data node)
- Replicas: 1 (for HA)
- Refresh interval: 5s (tradeoff: near-real-time, not instant)
- Heap: 16GB per node (50% of system RAM)
- Nodes: 3 data + 1 master (production)

### 2.2 Query Design

```go
// Multi-field query with boosted scoring
// File: internal/search/es_searcher.go
//
// Query structure:
// bool.should[
//   term(name_exact, boost=10)       -- exact keyword match
//   match(name_fuzzy, fuzz=AUTO, boost=5) -- typo tolerance
//   match(name_phonetic, boost=3)    -- sound-alike
//   match(name_normalized, boost=2)  -- accent-folded
// ]
// bool.filter[
//   terms(list_id, [...enabled_lists])
// ]
// size: 50
```

**Candidate Scoring**: ES `_score` used only for ranking candidates. Final confidence score computed by the 6-layer engine from AMLIQ's own matchers.

### 2.3 Indexing Pipeline

```
SyncService.applyAndRecord()
  -> PostgreSQL BulkUpsert (source of truth)
  -> ESIndexer.Index(entities)         # async, non-blocking
      -> esutil.BulkIndexer
          -> 4 worker goroutines
          -> 5MB flush threshold
          -> 30s flush interval
  -> On SoftDelete: ESIndexer.Delete(ids)
```

### 2.4 Fallback Strategy

If Elasticsearch is unavailable:
1. Health check detects ES down (3 consecutive failures)
2. Set `esAvailable = false` (atomic bool)
3. Engine.Screen() falls back to PostgreSQL ILIKE query
4. Background goroutine retries ES connection every 30s
5. On recovery, trigger full reindex from PostgreSQL

---

## 3. Goroutine Concurrency Design

### 3.1 Parallel Matcher Architecture

```
Engine.ScreenParallel(ctx, query, candidates)
  |
  for each candidate:
  |
  +-> errgroup.WithContext(ctx)
  |     |
  |     +-> go ExactMatcher.Match(ctx, query, cand)    -- goroutine 1
  |     +-> go FuzzyMatcher.Match(ctx, query, cand)    -- goroutine 2
  |     +-> go PhoneticMatcher.Match(ctx, query, cand) -- goroutine 3
  |     +-> go TokenMatcher.Match(ctx, query, cand)    -- goroutine 4
  |     +-> go EmbedMatcher.Match(ctx, query, cand)    -- goroutine 5
  |     +-> go GraphMatcher.Match(ctx, query, cand)    -- goroutine 6
  |     |
  |     +-> g.Wait() -- barrier: all 6 complete or timeout
  |
  +-> mu.Lock() -> append evidence -> mu.Unlock()
  +-> scorer.Score(evidence) -> Confidence
  +-> explainer.Explain(evidence) -> Reasoning
```

### 3.2 Early Termination Design

```go
// Short-circuit when confidence exceeds threshold
// File: internal/screening/engine_shortcircuit.go

ctx, cancel := context.WithCancel(parentCtx)
earlyResult := make(chan MatchEvidence, 6)

for _, m := range matchers {
    go func(m Matcher) {
        ev, _ := m.Match(ctx, query, cand)
        if ev.Score > tenant.Threshold {
            earlyResult <- ev  // signal early termination
            cancel()           // cancel remaining matchers
        }
    }(m)
}
```

### 3.3 sync.Pool Design

```go
// File: internal/screening/context_pool.go

type ScreeningContext struct {
    Evidence   []MatchEvidence  // pre-allocated cap 6
    NameBuf    []byte           // reusable name normalization buffer
    ScoreAcc   float64          // score accumulator
}

var ctxPool = sync.Pool{
    New: func() interface{} {
        return &ScreeningContext{
            Evidence: make([]MatchEvidence, 0, 6),
            NameBuf:  make([]byte, 0, 256),
        }
    },
}

func AcquireContext() *ScreeningContext {
    ctx := ctxPool.Get().(*ScreeningContext)
    ctx.Reset()
    return ctx
}

func ReleaseContext(ctx *ScreeningContext) {
    ctxPool.Put(ctx)
}
```

### 3.4 Batch Worker Pool Design

```
BatchScreener(concurrency=16)
  |
  +-> inputCh (buffered, cap=1000)
  |     |
  |     +-> worker-1 -> screen(entity) -> resultCh
  |     +-> worker-2 -> screen(entity) -> resultCh
  |     +-> ...
  |     +-> worker-16 -> screen(entity) -> resultCh
  |
  +-> resultCollector goroutine
        -> aggregate results
        -> update progress (processed/total)
        -> write to batch record
```

---

## 4. Caching Layer Design

### 4.1 Cache Architecture

```
Screening Request
  |
  +-> Bloom Filter Check (in-memory via Redis)
  |     |
  |     +-> NOT IN BLOOM -> return empty (instant negative)
  |     +-> IN BLOOM -> proceed to cache check
  |
  +-> Redis Cache Check
  |     |
  |     +-> HIT -> return cached ScreenResponse (<1ms)
  |     +-> MISS -> proceed to ES + Engine
  |
  +-> ES Search -> Engine.ScreenParallel()
  |
  +-> Redis Cache SET (async, TTL=24h)
  |
  +-> Return response
```

### 4.2 Cache Key Design

```
Key format: screen:{tenant_id}:{sha256(canonical_input)}
Canonical input: lowercase(name) + "|" + sorted(list_ids).join(",")
TTL: 24 hours
Serialization: JSON (ScreenResponse)
```

### 4.3 Invalidation Strategy

| Event | Invalidation Action |
|-------|-------------------|
| List sync completes | SCAN + DEL keys matching `screen:*:{list_id}:*` |
| Tenant config changes | DEL all keys for `screen:{tenant_id}:*` |
| Manual purge | DEL all keys matching `screen:*` |

### 4.4 Bloom Filter Specification

| Parameter | Value |
|-----------|-------|
| Expected elements | 2,000,000 (all entity names) |
| False positive rate | 0.01 (1%) |
| Bit array size | ~19.2 MB |
| Hash functions | 7 |
| Storage | Redis key: `bloom:entities:{version}` |
| Rebuild trigger | After any list sync |

---

## 5. Sanctions List Expansion Design

### 5.1 New Lists to Add

**Priority 1 (Sprint 4)**:

| List | Source URL | Parser | Format |
|------|-----------|--------|--------|
| OFAC Non-SDN | treasury.gov/ofac/downloads/consolidated/cons_prim.csv | ofac_csv | CSV |
| OFAC SSI | treasury.gov/ofac/downloads/ssi/ssilist.csv | ofac_csv | CSV |
| OFAC FSE | treasury.gov/ofac/downloads/fse/fse_final.csv | ofac_csv | CSV |
| US BIS Entity List | bis.doc.gov exports | bis_csv | CSV |
| Australia DFAT | dfat.gov.au consolidated list | au_dfat | CSV |
| Canada SEMA | Global Affairs Canada | ca_sema | XML |
| Japan MOF | data.opensanctions.org/datasets/latest/jp_mof_sanctions | opensanctions | CSV |
| FATF Grey/Black | Manual + opensanctions.org | fatf_risk | JSON |

### 5.2 Parser Interface

All parsers implement the same interface:

```go
// File: internal/ingestion/parser.go (existing)
type Parser interface {
    Parse(ctx context.Context, data io.Reader) ([]domain.Entity, error)
}
```

New parsers follow the existing CSV/XML patterns. Register in registry.go.

### 5.3 FATF Risk Provider Design

```go
// File: internal/screening/fatf_risk.go
type FATFRiskProvider struct {
    greyList  map[string]bool  // country code -> true
    blackList map[string]bool
    mu        sync.RWMutex
}

func (f *FATFRiskProvider) RiskLevel(countryCode string) FATFRisk {
    if f.blackList[countryCode] { return HighRisk }
    if f.greyList[countryCode] { return ElevatedRisk }
    return StandardRisk
}
```

Integrated into scorer as a weight modifier: HighRisk entities get +15% confidence boost, ElevatedRisk +5%.

---

## 6. Database Optimization Design

### 6.1 pgxpool Configuration

```go
// File: internal/storage/pgx/pool.go (refactored)
config, _ := pgxpool.ParseConfig(databaseURL)
config.MaxConns = 50
config.MinConns = 10
config.MaxConnLifetime = 15 * time.Minute
config.MaxConnIdleTime = 5 * time.Minute
config.HealthCheckPeriod = 30 * time.Second
```

### 6.2 Entities Table Partitioning

```sql
-- Migration: partition_entities.up.sql
CREATE TABLE entities_new (LIKE entities INCLUDING ALL)
  PARTITION BY HASH (list_id);

CREATE TABLE entities_p0 PARTITION OF entities_new
  FOR VALUES WITH (MODULUS 8, REMAINDER 0);
-- ... repeat for p1 through p7

-- Backfill and swap
INSERT INTO entities_new SELECT * FROM entities;
ALTER TABLE entities RENAME TO entities_old;
ALTER TABLE entities_new RENAME TO entities;
```

### 6.3 pgvector HNSW Index

```sql
-- Migration: hnsw_index.up.sql
DROP INDEX IF EXISTS idx_entity_embeddings_ivfflat;
CREATE INDEX idx_entity_embeddings_hnsw
  ON entity_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 256);

-- At query time (set per session):
SET hnsw.ef_search = 100;
```

---

## 7. Observability Design

### 7.1 Tracing Architecture

```
HTTP Request
  -> [span: http.request]
     -> [span: cache.check]
     -> [span: bloom.check]
     -> [span: es.search]
     -> [span: engine.screen]
        -> [span: matcher.exact]
        -> [span: matcher.fuzzy]
        -> [span: matcher.phonetic]
        -> [span: matcher.token]
        -> [span: matcher.embedding]
        -> [span: matcher.graph]
     -> [span: cache.set]
```

### 7.2 Metrics Specification

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| screening_duration_seconds | histogram | layer, tenant_id | Per-layer screening latency |
| screening_requests_total | counter | status, tenant_id | Total screening requests |
| screening_cache_hits_total | counter | tenant_id | Cache hit count |
| screening_cache_misses_total | counter | tenant_id | Cache miss count |
| es_query_duration_seconds | histogram | index | ES query latency |
| bloom_checks_total | counter | result (hit/miss) | Bloom filter check count |
| active_goroutines | gauge | pool_name | Current active workers |
| entity_index_size | gauge | list_id | Entities per list |

---

## 8. Infrastructure Design

### 8.1 Docker Compose (Development)

```yaml
services:
  api:
    build: .
    ports: ["8080:8080"]
    depends_on: [postgres, elasticsearch, redis]
    environment:
      DATABASE_URL: postgres://aegis:aegis@postgres:5432/aegis
      ES_URL: http://elasticsearch:9200
      REDIS_URL: redis://redis:6379

  postgres:
    image: pgvector/pgvector:pg15
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    ports: ["9200:9200"]
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: "-Xms1g -Xmx1g"
    volumes: [esdata:/usr/share/elasticsearch/data]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redisdata:/data]
```

### 8.2 Kubernetes Architecture (Production)

```
[Ingress] -> [API Service (3 replicas, HPA)]
                -> [PostgreSQL StatefulSet (1 primary + 1 replica)]
                -> [Elasticsearch StatefulSet (3 data nodes)]
                -> [Redis Deployment (1 replica, PV)]

[Worker Deployment (2 replicas)]
    -> [PostgreSQL]
    -> [Elasticsearch]
    -> [Redis]
```

---

**End of Performance Design Document**

Cross-reference: performance-requirements.md, implementation-plan-performance.md
