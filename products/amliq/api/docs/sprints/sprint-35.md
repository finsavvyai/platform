# Sprint 35: Wire Embedding Layer

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: G1
**Depends On**: None
**Status**: Complete

---

## Objective

Connect the existing embedding infrastructure to `Engine.Screen()` to enable cross-language semantic matching. The code is 90% complete — this sprint is about wiring, not building.

## Background

The embedding layer has:
- `embedding.go` (53 lines) — in-memory vector cache matcher
- `embedding_pgvec.go` (61 lines) — PostgreSQL pgvector matcher with cosine similarity
- `embed_batch.go` (46 lines) — batch embedding generator using OpenAI API
- Migration `020_add_pgvector.up.sql` — `embedding vector(384)` column with IVFFlat index
- `internal/storage/pgx/entity_embedding.go` — full repository with cosine similarity search
- `embedding_test.go` — tests with mock vectors

**What's missing**: `Engine.Screen()` in `engine.go` never instantiates or calls any embedding matcher.

## Tasks

### T1: Wire PgvectorMatcher into Engine (internal/screening/engine.go)
- [x] Add `embeddingMatcher *PgvectorMatcher` field to `Engine` struct
- [x] Accept embedding config in `NewEngine()` constructor
- [x] Add embedding matcher call after Token layer (line ~47) with guard: `if e.embeddingMatcher != nil`
- [x] Collect evidence from embedding layer into the evidence slice
- [x] **File**: `internal/screening/engine.go` (~10 lines changed)
- [x] **Test**: `internal/screening/engine_test.go` — add test case with mock embedding matcher

### T2: Auto-generate embeddings on entity ingestion (internal/ingestion/)
- [x] After `SyncService` processes new/modified entities, call `EmbeddingGenerator.GenerateBatch()`
- [x] Add embedding generation as post-sync hook in `sync_service.go`
- [x] Only generate embeddings for entities that don't already have them (check `embedding IS NULL`)
- [x] **File**: `internal/ingestion/sync_service.go` (~15 lines)
- [x] **Test**: Verify embeddings are generated after sync completes

### T3: Add embedding config to TenantConfig (internal/domain/)
- [x] Add `EmbeddingEnabled bool` and `EmbeddingModel string` to `TenantConfig`
- [x] Default: `false` for Starter plans, `true` for Pro/Enterprise
- [x] Wire config check in engine: skip embedding layer if `!config.EmbeddingEnabled`
- [x] **File**: `internal/domain/tenant_config.go` (~5 lines)
- [x] **File**: `internal/screening/engine.go` — add config guard

### T4: Configure embedding API endpoint (internal/config/)
- [x] Add env vars: `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- [x] Add fallback: if no API key, log warning and skip embedding layer (don't crash)
- [x] **File**: `internal/config/config.go` (~10 lines)

### T5: Integration tests
- [x] Test Arabic name → Latin transliteration matching via embeddings
- [x] Test Cyrillic → Latin cross-script matching
- [x] Test engine with all 5 layers active (Exact + Fuzzy + Phonetic + Token + Embedding)
- [x] Benchmark: embedding layer must add <10ms to total screening latency
- [x] **Files**: `internal/screening/engine_integration_test.go` (new file, <100 lines)

### T6: Update API response to include embedding evidence
- [x] Verify `MatchEvidence` with `Layer: MatchLayerEmbedding` appears in screening response
- [x] Verify explainer generates readable text: "Semantic similarity: 87% (cross-language match)"
- [x] **File**: `internal/screening/explainer.go` — add embedding explanation template

## Acceptance Criteria

- [x] `Engine.Screen()` calls embedding layer for tenants with `EmbeddingEnabled: true`
- [x] Cross-language name matching works (Arabic ↔ Latin, Cyrillic ↔ Latin)
- [x] Embedding layer adds <10ms to p95 latency
- [x] All existing 262 Go tests still pass
- [x] New integration tests cover embedding scenarios
- [x] Embedding generation runs automatically on list sync

## Files Modified

| File | Change |
|------|--------|
| `internal/screening/engine.go` | Wire embedding matcher call |
| `internal/screening/explainer.go` | Add embedding explanation template |
| `internal/ingestion/sync_service.go` | Post-sync embedding generation hook |
| `internal/domain/tenant_config.go` | Add EmbeddingEnabled field |
| `internal/config/config.go` | Add embedding env vars |
| `internal/screening/engine_integration_test.go` | New integration tests |
