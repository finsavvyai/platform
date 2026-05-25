# AMLIQ — High-Performance Search Strategy

> **Created**: April 10, 2026
> **Updated**: April 10, 2026 — Redesigned for 500MB RAM constraint (Render)
> **Goal**: Sub-20ms p50, sub-50ms p95 screening against 1M+ entities with 100% recall
> **Constraint**: 500MB total RAM on Render. ~430MB available for search after Go runtime + DB pool.

---

## 1. Hard Constraint: 500MB RAM Budget

```
TOTAL RAM:                   500 MB
├── Go runtime + HTTP:        10 MB
├── DB connection pool:       50 MB  (25 connections × 2MB)
├── Workers / goroutines:     10 MB
├── OS + overhead:            20 MB
└── AVAILABLE FOR SEARCH:   ~410 MB
```

**This means**: We CANNOT load all entities into memory. At 500 bytes per entity, 410MB fits only ~820K entities with zero indexes. With indexes, it's more like 50-80K entities max in memory.

**The architecture must be: PostgreSQL-first, memory-assisted.**

---

## 2. Current State Audit

### What Exists and Works

```
Tier 0: LRU Query Cache (10K entries, 5-min TTL)           ← ~10-30 MB
Tier 1: Hot In-Memory Index (50K entities, 4 sub-indexes)   ← ~150-250 MB
Tier 2: Bloom Filter (0.1% FP rate)                         ← ~1 MB
Tier 3: PostgreSQL (trigram GIN + tsvector + HNSW)          ← 0 MB (DB-side)
```

**Current memory at 50K hot entities**: ~250MB peak. Leaves ~160MB headroom. Tight but works.

### The 7 Real Problems

**P1: Hot index covers only 5% of entities.**
`hot_loader.go` loads 3 lists (OFAC, UN, NBCTF) with `LIMIT 50000`. All other entities (EU, UK, Swiss, PEP, custom, etc.) go straight to PostgreSQL on every query. This means 95% of screenings take the slow path.

**P2: PostgreSQL queries are not optimized for screening.**
`QuickSearch` does `ILIKE '%query%'` which is a prefix-wildcard scan. `FastSearch` uses `similarity()` which computes trigram similarity for every row above threshold. Neither uses the optimal query pattern.

**P3: No pre-computed search columns populated.**
Migration 037 added `soundex_code`, `name_normalized`, `name_tokens` columns — but `soundex_code` is "populated lazily on next sync" and these columns are not used by the main search path.

**P4: MinHash-LSH built but disconnected.**
Uses ~50MB for 50K entities. Not connected to the engine. And at 500MB RAM, it's too expensive for what it gives vs PostgreSQL trigram.

**P5: EnsembleScorer not in main path.**
9-feature logistic regression scorer exists but the engine uses the simpler weighted-average scorer.

**P6: PEP search is just ILIKE.**
No phonetic, no fuzzy, no trigram — just `WHERE full_name ILIKE '%query%'`.

**P7: No entity deduplication.**
Same entity on 3 lists → scored 3 times → wastes CPU and confuses results.

---

## 3. New Architecture: PostgreSQL-First, Memory-Assisted

### Design Principles

1. **PostgreSQL does candidate retrieval** — not RAM. The DB has GIN trigram indexes that handle millions of rows efficiently.
2. **RAM is only for**: result cache, bloom filter (negative check), and a small hot index for the highest-priority lists.
3. **Pre-compute everything at ingestion time** — don't compute at query time.
4. **Push scoring into SQL where possible** — reduce data transferred to Go.
5. **100% recall** — every entity must be reachable regardless of which tier serves it.

### Architecture

```
Query: "Mohammed Al-Rahman"
         │
         ▼
┌──────────────────────────────────┐
│  Tier 0: Ristretto Result Cache   │  ← O(1), <0.1ms, ~20MB
│  Key: hash(normalized_name+lists) │     Hit rate target: 30-50%
│  TTL: 15 minutes                  │     (many queries are repeated names)
└──────────┬───────────────────────┘
           │ miss
           ▼
┌──────────────────────────────────┐
│  Tier 1: Bloom Filter             │  ← O(1), <0.01ms, ~5MB
│  "Is this name definitely NOT     │     If false → return CLEAR immediately
│   on any sanctions list?"         │     Saves DB round-trip for 80%+ of
│  Contains: all normalized names   │     legitimate customer names
│  + all soundex codes              │
│  + all metaphone codes            │
└──────────┬───────────────────────┘
           │ bloom says "maybe"
           ▼
┌──────────────────────────────────┐
│  Tier 2: PostgreSQL Multi-Query   │  ← 5-20ms, 0 MB app memory
│                                    │
│  Run 3 queries IN PARALLEL:       │
│                                    │
│  Q1: Exact + Normalized Match     │     WHERE name_normalized = $1
│      (B-tree index, <1ms)         │     OR soundex_code = $2
│                                    │
│  Q2: Trigram Similarity           │     WHERE full_name % $1
│      (GIN trigram, 2-10ms)        │     AND similarity(full_name,$1) > 0.3
│                                    │
│  Q3: Full-Text + Phonetic         │     WHERE tsv @@ query
│      (GIN tsvector, 1-5ms)        │     OR metaphone_primary = $2
│                                    │
│  UNION ALL → deduplicate by       │
│  fingerprint → LIMIT 100          │
└──────────┬───────────────────────┘
           │ 10-100 candidate rows (full records from DB)
           ▼
┌──────────────────────────────────┐
│  Tier 3: In-Process Scoring       │  ← 2-10ms, negligible memory
│                                    │
│  For each candidate:              │
│  ┌─ Jaro-Winkler similarity      │
│  ├─ Levenshtein normalized        │
│  ├─ Soundex match (pre-computed)  │
│  ├─ Metaphone match (pre-computed)│
│  ├─ Double Metaphone match        │
│  ├─ Token Jaccard                 │
│  ├─ Trigram Jaccard               │
│  ├─ Length ratio                  │
│  └─ Word count difference         │
│                                    │
│  → EnsembleScorer (9 features)    │
│  → sigmoid(weighted_sum + bias)   │
│  → Short-circuit if score > 0.95  │
└──────────┬───────────────────────┘
           │ scored + ranked results
           ▼
┌──────────────────────────────────┐
│  Tier 4: Post-Processing          │  ← <1ms
│  Dedup by fingerprint             │
│  Apply tenant threshold           │
│  Generate explanations            │
│  Cache result in Tier 0           │
└──────────────────────────────────┘
```

### Memory Budget

| Component | Size | Notes |
|-----------|------|-------|
| Go runtime + HTTP | 10 MB | Fixed |
| DB pool (15 conns) | 30 MB | Reduced from 25→15 conns |
| Workers/goroutines | 10 MB | |
| Ristretto result cache | 20 MB | ~30K cached results |
| Bloom filter (names) | 3 MB | 2M names at 0.1% FP |
| Bloom filter (phonetic) | 2 MB | 2M phonetic codes at 0.1% FP |
| Scoring buffers | 5 MB | Per-request candidate scoring |
| OS overhead | 20 MB | |
| **Headroom** | **~400 MB used, ~100 MB free** | Safe margin |

**Optional hot index**: If RAM allows, keep 20-30K entities from OFAC/UN in memory (~80MB). This is a bonus, not a requirement — the PostgreSQL path handles everything.

---

## 4. The PostgreSQL Engine (Core of the Strategy)

### 4.1 Pre-Compute Everything at Ingestion Time

**This is the single most important change.** Instead of computing soundex, metaphone, trigrams, and normalization at QUERY time, compute them when entities are INGESTED and store them in indexed columns.

#### New Migration: `050_search_optimization.up.sql`

```sql
-- ============================================================
-- SEARCH OPTIMIZATION: Pre-computed columns + composite indexes
-- ============================================================

-- 1. Pre-computed phonetic codes (computed on ingestion, not query time)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS metaphone_primary VARCHAR(20);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS metaphone_alternate VARCHAR(20);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS dbl_metaphone_primary VARCHAR(20);
ALTER TABLE entities ADD COLUMN IF NOT EXISTS dbl_metaphone_alternate VARCHAR(20);

-- 2. Entity fingerprint for cross-list deduplication
ALTER TABLE entities ADD COLUMN IF NOT EXISTS fingerprint BIGINT;

-- 3. Pre-computed token array (for token-based matching)
-- name_tokens already exists from migration 037 but may not be populated
-- Ensure it's populated:
-- UPDATE entities SET name_tokens = regexp_split_to_array(lower(full_name), '\s+')
--   WHERE name_tokens IS NULL;

-- 4. Composite search index: the SINGLE most important index
-- Covers: trigram similarity search filtered by active + tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_search_trgm
  ON entities USING gin (full_name gin_trgm_ops)
  WHERE deleted_at IS NULL AND removed_at IS NULL;

-- 5. Phonetic lookup indexes (B-tree, O(log n) lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_soundex
  ON entities (soundex_code)
  WHERE soundex_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_metaphone
  ON entities (metaphone_primary)
  WHERE metaphone_primary IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_dbl_metaphone
  ON entities (dbl_metaphone_primary)
  WHERE dbl_metaphone_primary IS NOT NULL AND deleted_at IS NULL;

-- 6. Normalized name index (exact match after normalization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_norm_active
  ON entities (name_normalized)
  WHERE name_normalized IS NOT NULL AND deleted_at IS NULL;

-- 7. Fingerprint index for deduplication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_fingerprint
  ON entities (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- 8. List + active composite (for tenant-filtered searches)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_list_active
  ON entities (list_id)
  WHERE deleted_at IS NULL AND removed_at IS NULL;

-- 9. Optimize pg_trgm settings for screening workload
-- Lower threshold = more candidates = better recall = slightly slower
ALTER DATABASE current SET pg_trgm.similarity_threshold = 0.2;

-- 10. tsvector index with 'simple' config (no stemming, better for names)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_entities_tsv_simple
  ON entities USING gin (to_tsvector('simple', full_name))
  WHERE deleted_at IS NULL;
```

#### Ingestion-Time Pre-Computation

```go
// internal/ingestion/entity_enricher.go (NEW)
//
// Called for every entity during list sync, BEFORE writing to DB.
// Computes all search columns so queries never compute at runtime.

func EnrichEntity(e *domain.Entity) {
    name := e.FullName

    // 1. Normalize: lowercase, strip accents (NFD), strip punctuation, collapse spaces
    e.NameNormalized = normalize(name)

    // 2. Soundex: first word's soundex code
    words := strings.Fields(e.NameNormalized)
    if len(words) > 0 {
        e.SoundexCode = soundex(words[0])
    }

    // 3. Metaphone: primary + alternate for first two words
    if len(words) > 0 {
        e.MetaphonePrimary, e.MetaphoneAlternate = doubleMetaphone(words[0])
    }
    if len(words) > 1 {
        e.DblMetaphonePrimary, e.DblMetaphoneAlternate = doubleMetaphone(words[1])
    }

    // 4. Tokens: lowercased word array
    e.NameTokens = words

    // 5. Fingerprint: stable hash for deduplication
    //    Sort tokens for order-independence: "John Smith" == "Smith John"
    sorted := make([]string, len(words))
    copy(sorted, words)
    sort.Strings(sorted)
    e.Fingerprint = xxhash(strings.Join(sorted, " ") + "|" + e.DOB + "|" + e.Type)
}
```

### 4.2 The Three Parallel Queries

When a screening request comes in, fire 3 queries to PostgreSQL **concurrently** using goroutines. Each targets a different index and finds different types of matches:

```go
// internal/screening/pg_searcher.go (NEW — replaces entity_search.go, entity_quick_search.go)

func (s *PGSearcher) FindCandidates(ctx context.Context, query string, tenantLists []string, limit int) ([]CandidateRow, error) {
    normalized := normalize(query)
    words := strings.Fields(normalized)
    sc := soundex(words[0])
    mp, _ := doubleMetaphone(words[0])

    // Fire 3 queries in parallel
    g, ctx := errgroup.WithContext(ctx)
    var q1, q2, q3 []CandidateRow

    // Q1: Exact normalized + soundex (B-tree, <1ms)
    g.Go(func() error {
        q1, _ = s.queryExactPhonetic(ctx, normalized, sc, mp, tenantLists, limit)
        return nil
    })

    // Q2: Trigram similarity (GIN, 2-10ms)
    g.Go(func() error {
        q2, _ = s.queryTrigram(ctx, query, tenantLists, limit)
        return nil
    })

    // Q3: Full-text search (GIN tsvector, 1-5ms)
    g.Go(func() error {
        q3, _ = s.queryFullText(ctx, query, tenantLists, limit)
        return nil
    })

    g.Wait()

    // Merge + deduplicate by fingerprint
    return deduplicateByFingerprint(merge(q1, q2, q3), limit), nil
}
```

#### Q1: Exact + Phonetic (B-tree, <1ms)

```sql
-- Catches: exact matches, soundex matches, metaphone matches
-- Uses: idx_entities_norm_active, idx_entities_soundex, idx_entities_metaphone
SELECT id, full_name, list_id, type, dob, name_normalized,
       soundex_code, metaphone_primary, fingerprint,
       1.0 AS retrieval_score
FROM entities
WHERE deleted_at IS NULL
  AND removed_at IS NULL
  AND list_id = ANY($4)
  AND (
    name_normalized = $1           -- exact normalized match
    OR soundex_code = $2           -- soundex match
    OR metaphone_primary = $3      -- metaphone match
  )
LIMIT $5;
-- $1=normalized, $2=soundex, $3=metaphone, $4=tenant_lists, $5=limit
```

**Why this is fast**: B-tree index lookups are O(log n). Three OR conditions on indexed columns. PostgreSQL uses BitmapOr to combine index scans.

#### Q2: Trigram Similarity (GIN, 2-10ms)

```sql
-- Catches: typos, transliterations, partial matches
-- Uses: idx_entities_search_trgm (GIN trigram)
SELECT id, full_name, list_id, type, dob, name_normalized,
       soundex_code, metaphone_primary, fingerprint,
       similarity(full_name, $1) AS retrieval_score
FROM entities
WHERE deleted_at IS NULL
  AND removed_at IS NULL
  AND list_id = ANY($3)
  AND full_name % $1                -- trigram similarity > pg_trgm.similarity_threshold (0.2)
ORDER BY similarity(full_name, $1) DESC
LIMIT $4;
-- $1=query, $3=tenant_lists, $4=limit
```

**Why this is fast**: The `%` operator uses the GIN trigram index. PostgreSQL extracts trigrams from the query, looks up matching rows in the inverted index, then computes exact similarity only for those rows.

#### Q3: Full-Text + Secondary Phonetic (GIN tsvector, 1-5ms)

```sql
-- Catches: word-level matches regardless of order, secondary phonetic
-- Uses: idx_entities_tsv_simple
SELECT id, full_name, list_id, type, dob, name_normalized,
       soundex_code, metaphone_primary, fingerprint,
       ts_rank(to_tsvector('simple', full_name),
               plainto_tsquery('simple', $1)) AS retrieval_score
FROM entities
WHERE deleted_at IS NULL
  AND removed_at IS NULL
  AND list_id = ANY($3)
  AND (
    to_tsvector('simple', full_name) @@ plainto_tsquery('simple', $1)
    OR dbl_metaphone_primary = $2   -- double metaphone on 2nd word
  )
ORDER BY retrieval_score DESC
LIMIT $4;
-- $1=query, $2=dbl_metaphone of second word, $3=tenant_lists, $4=limit
```

**Why this is fast**: GIN tsvector index provides O(1) lookup per query term. `plainto_tsquery('simple', ...)` splits query into words and ANDs them.

### 4.3 Why 3 Parallel Queries Instead of 1 Big Query

1. **Each query uses a DIFFERENT index type** — PostgreSQL can only use one index per scan. One big OR query would force a sequential scan.
2. **Parallel execution** — 3 queries running simultaneously on different index paths. Total latency = max(Q1, Q2, Q3), not sum.
3. **Different recall patterns**:
   - Q1 catches exact matches and phonetic equivalents (Smith = Smyth)
   - Q2 catches typos and transliterations (Mohammed = Muhammad)
   - Q3 catches word reordering (John Smith = Smith John)
4. **Each query returns quickly** because it has a tight LIMIT and uses the right index.

---

## 5. Bloom Filter Strategy (Save 80% of DB Round-Trips)

### The Insight

Most people screened by banks are NOT on any sanctions list. If 95% of queries are for clean names, the bloom filter returns "definitely not on any list" and we skip the DB entirely.

### Two Bloom Filters

```go
// bloom_screening.go

type ScreeningBloom struct {
    nameBloom     *bloom.BloomFilter  // normalized names (~3MB for 2M entries)
    phoneticBloom *bloom.BloomFilter  // all phonetic codes (~2MB for 2M codes)
}

// QuickCheck returns false if the name is DEFINITELY NOT on any list.
// Returns true if the name MIGHT be on a list (proceed to DB).
func (sb *ScreeningBloom) QuickCheck(name string) bool {
    normalized := normalize(name)

    // Check 1: Is the normalized name in any list?
    if sb.nameBloom.TestString(normalized) {
        return true // maybe — check DB
    }

    // Check 2: Does any word's soundex code match?
    for _, word := range strings.Fields(normalized) {
        if sb.phoneticBloom.TestString(soundex(word)) {
            return true // maybe — check DB
        }
    }

    // Neither name nor any phonetic code matches → DEFINITELY CLEAN
    return false
}
```

**Memory**: ~5MB total for both bloom filters at 2M entities and 0.1% false positive rate.

**Building**: Load all normalized names and phonetic codes from DB on startup. Takes ~5-10 seconds for 2M entities. Incremental update when lists sync (add new names to bloom — bloom filters only grow, never shrink; periodic full rebuild every 6 hours).

### Impact on Latency

```
Before bloom filter:
  Every query → PostgreSQL → 5-20ms

After bloom filter:
  95% of queries → bloom says "clean" → <0.1ms → done
  5% of queries → bloom says "maybe" → PostgreSQL → 5-20ms

  Average latency: 0.95 × 0.1ms + 0.05 × 15ms = ~0.85ms
```

---

## 6. Result Cache (Ristretto)

### Why Ristretto Instead of LRU

The current `lru_cache.go` (10K entries, mutex-locked) is fine for low traffic. At high throughput, the mutex becomes a bottleneck. Ristretto is lock-free and handles 10M+ ops/sec.

```go
// cache_ristretto.go (already built — WIRE IT)

cache, _ := ristretto.NewCache(&ristretto.Config{
    NumCounters: 300_000,    // 10× expected items
    MaxCost:     20_000_000, // 20MB max
    BufferItems: 64,
})

// Key: hash of normalized name + DOB + sorted tenant list IDs
// Value: []ScoredCandidate (scoring results)
// TTL: 15 minutes
```

**Memory**: 20MB max (hard cap). Stores ~30K results at ~700 bytes average.

**Hit rate**: For repeat screening (same customer re-checked), expect 30-50% hit rate. Each hit saves the full PostgreSQL round-trip + scoring.

---

## 7. Scoring: Wire the EnsembleScorer

### Current Problem

`engine.go` uses `scorer.go` which does a simple weighted average of layer scores. The 9-feature `ensemble_scorer.go` with logistic regression is built but not used.

### Change

Replace `scorer.go` in the engine with `ensemble_scorer.go`:

```go
// In engine.go, replace:
//   score := s.scorer.Score(evidence)
// With:
//   score := s.ensembleScorer.Score(query, candidate)

// The ensemble computes 9 features in a SINGLE PASS per candidate:
// 1. Jaro-Winkler      (weight: 2.5)
// 2. Levenshtein norm   (weight: 1.8)
// 3. Soundex match      (weight: 0.9)  ← pre-computed, just compare
// 4. Metaphone match    (weight: 1.1)  ← pre-computed, just compare
// 5. Dbl Metaphone      (weight: 1.4)  ← pre-computed, just compare
// 6. Token Jaccard      (weight: 1.6)
// 7. Trigram Jaccard     (weight: 1.2)
// 8. Length ratio        (weight: 0.5)
// 9. Word count diff     (weight: -0.8)
// Bias: -3.0
//
// Output: sigmoid(sum) → probability [0, 1]
```

**Key optimization**: Features 3, 4, 5 (soundex, metaphone, double metaphone) are now pre-computed columns returned by the SQL queries. No runtime computation needed — just string comparison.

---

## 8. Entity Deduplication

### Problem

"VLADIMIR PUTIN" appears on OFAC, EU, UN, UK, Swiss lists. Without dedup, the engine scores him 5 times and returns 5 results for the same person.

### Solution: Fingerprint at Ingestion

```go
// Fingerprint: order-independent hash of normalized name + DOB + type
// "Vladimir Putin" and "PUTIN, Vladimir" get the same fingerprint

func ComputeFingerprint(name, dob, entityType string) int64 {
    tokens := strings.Fields(normalize(name))
    sort.Strings(tokens) // order-independent
    canonical := strings.Join(tokens, " ") + "|" + dob + "|" + entityType
    return int64(xxhash.Sum64String(canonical))
}
```

**At query time**: After the 3 parallel queries return candidates, deduplicate:

```go
seen := make(map[int64]bool)
var deduped []CandidateRow
for _, c := range candidates {
    if c.Fingerprint != 0 && seen[c.Fingerprint] {
        // Same entity from different list — keep highest retrieval_score
        continue
    }
    seen[c.Fingerprint] = true
    deduped = append(deduped, c)
}
```

**Memory**: Zero — fingerprint is a DB column, dedup happens on the small candidate set (10-100 rows).

---

## 9. PEP Search: Unified Path

### Current Problem

PEP search in `handler_pep.go` does:
```sql
SELECT ... FROM pep_profiles p JOIN entities e ON e.id = p.entity_id
WHERE e.full_name ILIKE '%query%'
```

This is a sequential scan. No trigram, no phonetic, no fuzzy.

### Solution

PEP entities are ALREADY in the `entities` table (they have a `list_id` like `pep-opensanctions`). Just include PEP list IDs in the tenant's enabled lists, and the same 3-query parallel search finds them.

```go
// When tenant has PEP screening enabled, add PEP list IDs to their search scope:
tenantLists := getTenantEnabledLists(tenantID) // ["ofac-sdn", "eu-fsf", ...]
if tenantConfig.PEPScreeningEnabled {
    tenantLists = append(tenantLists, "pep-opensanctions", "pep-everypolitician")
}
// Now the same FindCandidates() function searches PEPs too
```

After scoring, enrich PEP results:
```go
for i, result := range results {
    if pep, ok := pepEnrichmentCache[result.EntityID]; ok {
        results[i].IsPEP = true
        results[i].PEPTier = pep.Tier
        results[i].Position = pep.Position
        results[i].Country = pep.Country
    }
}
```

**PEP enrichment cache**: ~2MB for 100K PEP profiles (just tier + position + country, not full entities).

---

## 10. Latency Analysis (500MB Constraint)

### Per-Query Budget

```
Step                          p50       p95       Notes
────────────────────────────  ────      ────      ─────────────────────────
Cache check (Ristretto)       0.01ms    0.05ms    Lock-free, O(1)
Bloom filter check            0.01ms    0.02ms    Two bloom checks
  → If clean (95% of queries): DONE in <0.1ms
  → If maybe (5% of queries): continue ↓
Q1: Exact+Phonetic (B-tree)   0.5ms     2ms       3 index lookups, BitmapOr
Q2: Trigram (GIN)              3ms       8ms       GIN scan + similarity()
Q3: Full-text (GIN tsvector)   1ms       4ms       tsvector @@ query
  → Parallel: max(Q1,Q2,Q3)   3ms       8ms
Merge + dedup                  0.1ms     0.3ms     On 50-100 candidates
Ensemble scoring (50 cands)    2ms       5ms       9 features × 50 candidates
Post-process + explain         0.5ms     1ms       Generate explanations
Cache store                    0.01ms    0.05ms    Async, non-blocking
────────────────────────────  ────      ────
TOTAL (cache hit)              0.01ms    0.05ms
TOTAL (bloom clean)            0.02ms    0.07ms
TOTAL (full screening)         6ms       15ms
WEIGHTED AVERAGE               ~0.5ms    ~1.5ms    (95% bloom-clean)
```

### Throughput

With 15 DB connections and each screening query taking ~8ms of DB time (3 parallel queries, each ~8ms, sharing 3 connections):
- Per-screening DB connections used: 3
- Max concurrent screenings: 15 / 3 = 5 concurrent
- Throughput: 5 × (1000/8) = ~625 screenings/sec from DB
- With 95% bloom-clean: effective ~12,500 screenings/sec

---

## 11. Implementation Plan

### Phase 1: Pre-Compute Search Columns (3 days)

| Task | File | Detail |
|------|------|--------|
| Create migration | `migrations/050_search_optimization.up.sql` | Add metaphone, dbl_metaphone, fingerprint columns + all indexes |
| Entity enricher | `internal/ingestion/entity_enricher.go` (NEW) | Compute soundex, metaphone, dbl_metaphone, normalized, tokens, fingerprint on ingestion |
| Backfill existing | `cmd/worker/backfill_search.go` (NEW) | One-time script to populate pre-computed columns for all existing entities |
| Wire enricher | All parsers in `internal/ingestion/` | Call `EnrichEntity()` before DB write in each parser |

**Verification**: `SELECT count(*) FROM entities WHERE soundex_code IS NULL AND deleted_at IS NULL` should return 0.

### Phase 2: New PostgreSQL Searcher (3 days)

| Task | File | Detail |
|------|------|--------|
| 3-query parallel searcher | `internal/screening/pg_searcher.go` (NEW) | Replace `entity_search.go` and `entity_quick_search.go` with 3 parallel queries |
| Wire to engine | `internal/screening/engine.go` | Replace candidate retrieval with `PGSearcher.FindCandidates()` |
| Dedup by fingerprint | `internal/screening/dedup.go` (NEW) | Post-query deduplication |
| Tenant list filtering | `internal/screening/tenant_lists.go` (NEW) | Get tenant's enabled list IDs for query filtering |

**Verification**: Screen "Vladimir Putin" → should return 1 result (deduped), not 5.

### Phase 3: Bloom Filter for Early Exit (2 days)

| Task | File | Detail |
|------|------|--------|
| Screening bloom | `internal/screening/bloom_screening.go` (NEW) | Two bloom filters: names + phonetic codes |
| Build on startup | `cmd/api/main.go` | Load all normalized names + soundex codes from DB into bloom |
| Incremental update | `internal/ingestion/sync_service.go` | Add new names to bloom after list sync |
| Wire to engine | `internal/screening/engine.go` | Check bloom before DB queries; if clean, return immediately |

**Verification**: Screen "John Q. Normalcitizen" → bloom returns false → 0 DB queries.

### Phase 4: Wire Ristretto + EnsembleScorer (2 days)

| Task | File | Detail |
|------|------|--------|
| Replace LRU with Ristretto | `internal/screening/tiered_index.go` | Swap `NewLRUCache` with Ristretto (already built in `ristretto_cache.go`) |
| Wire ensemble scorer | `internal/screening/engine.go` | Replace `scorer.go` weighted average with `ensemble_scorer.go` 9-feature logistic regression |
| Pre-computed feature pass-through | `internal/screening/ensemble_scorer.go` | Accept pre-computed soundex/metaphone from DB row instead of recomputing |

### Phase 5: Unified PEP Search (1 day)

| Task | File | Detail |
|------|------|--------|
| Add PEP list IDs to tenant scope | `internal/screening/tenant_lists.go` | When PEP screening enabled, include PEP list IDs in search |
| PEP enrichment cache | `internal/screening/pep_cache.go` (NEW) | On startup, load PEP tier/position/country into small map (~2MB) |
| Enrich results | `internal/screening/engine.go` | After scoring, add PEP metadata to matched entities |
| Remove ILIKE PEP handler | `api/handler_pep.go` | Route PEP screening through main screening engine |

### Phase 6: Reduce Memory Footprint (1 day)

| Task | File | Detail |
|------|------|--------|
| Reduce DB pool | `internal/config/config.go` | Default MaxConns: 25→15. Each conn saves ~2MB. |
| Reduce hot index | `internal/screening/hot_loader.go` | Reduce to 20K entities (from 50K). DB path is now fast enough. Saves ~100MB. |
| Disable MinHash-LSH | — | Don't load at 500MB. Saves ~50MB. |
| Disable in-memory trigram index | — | PostgreSQL GIN trigram is equivalent. Saves ~40-60MB. |
| Cap LRU/Ristretto | — | Hard cap at 20MB. |

**Final memory target**:

| Component | Size |
|-----------|------|
| Go runtime + HTTP | 10 MB |
| DB pool (15 conns) | 30 MB |
| Workers | 10 MB |
| Hot index (20K entities, exact+phonetic only) | 40 MB |
| Bloom filters (2M entities) | 5 MB |
| Ristretto cache | 20 MB |
| PEP enrichment cache | 2 MB |
| Scoring buffers | 5 MB |
| OS overhead | 20 MB |
| **TOTAL** | **~142 MB** |
| **Headroom** | **~358 MB free** |

---

## 12. What We Lose vs the 2.6GB Strategy

| Feature | 2.6GB (all in RAM) | 500MB (PostgreSQL-first) |
|---------|-------------------|--------------------------|
| Best-case latency | <1ms (all in memory) | <0.1ms (bloom clean) |
| Typical latency | ~12ms | ~6ms (bloom filters most queries) |
| Worst-case latency | ~25ms | ~15ms (DB query) |
| MinHash-LSH | Yes (O(1) approx NN) | No (too expensive in RAM) |
| Full trigram index | In-memory (~300MB) | PostgreSQL GIN (0 app RAM) |
| Candidate retrieval | Hash map O(1) | DB query O(log n) via index |
| Memory usage | 2.6 GB | ~142 MB |
| **Fits in 500MB?** | **NO** | **YES, with 358MB headroom** |

**Key insight**: The bloom filter + parallel DB queries actually achieve BETTER average latency than the all-in-memory approach, because 95% of queries are answered in <0.1ms by the bloom filter without touching the DB at all. The all-in-memory approach processes every query through 4 sub-indexes even for clean names.

---

## 13. File Index

```
NEW FILES:
  internal/ingestion/entity_enricher.go       ← Pre-compute search columns
  internal/screening/pg_searcher.go           ← 3 parallel PostgreSQL queries
  internal/screening/bloom_screening.go       ← Name + phonetic bloom filters
  internal/screening/dedup.go                 ← Fingerprint deduplication
  internal/screening/tenant_lists.go          ← Tenant list scope resolution
  internal/screening/pep_cache.go             ← PEP enrichment mini-cache
  cmd/worker/backfill_search.go               ← One-time column backfill
  migrations/050_search_optimization.up.sql   ← Columns + indexes

MODIFY:
  internal/screening/engine.go                ← New search + scoring path
  internal/screening/tiered_index.go          ← Ristretto, reduced tiers
  internal/screening/hot_loader.go            ← Reduce to 20K entities
  internal/ingestion/sync_service.go          ← Call enricher + bloom update
  internal/ingestion/ofac.go                  ← Call EnrichEntity()
  internal/ingestion/eu.go                    ← Call EnrichEntity()
  internal/ingestion/un.go                    ← Call EnrichEntity()
  (... all other parsers ...)
  api/handler_pep.go                          ← Route through main engine
  cmd/api/main.go                             ← Build bloom on startup

WIRE (already built, just connect):
  internal/screening/ensemble_scorer.go       ← Replace scorer.go in engine
  internal/screening/ristretto_cache.go       ← Replace LRU cache

DISABLE (save RAM):
  internal/screening/minhash_lsh.go           ← Don't load at 500MB
  internal/screening/index_trigram.go          ← PostgreSQL GIN replaces this
  internal/screening/index_token.go            ← PostgreSQL tsvector replaces this
```

---

## 14. Scaling Path

When AMLIQ outgrows 500MB Render:

| RAM | What to Enable | Benefit |
|-----|---------------|---------|
| 500 MB | This strategy (PostgreSQL-first) | <0.1ms bloom, ~6ms DB |
| 1 GB | Add 50K hot index + token index | ~2ms for OFAC/UN hits |
| 2 GB | Add MinHash-LSH + full trigram index | ~1ms all queries |
| 4 GB | Full in-memory (previous strategy) | <1ms everything |

The architecture is designed to **gracefully upgrade** — add more memory, enable more in-memory tiers. No code rewrite needed, just config changes.
