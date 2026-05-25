# Sprint 35: Wire Embedding Layer

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: G1
**Depends On**: None
**Status**: Not Started

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
- [ ] Add `embeddingMatcher *PgvectorMatcher` field to `Engine` struct
- [ ] Accept embedding config in `NewEngine()` constructor
- [ ] Add embedding matcher call after Token layer (line ~47) with guard: `if e.embeddingMatcher != nil`
- [ ] Collect evidence from embedding layer into the evidence slice
- [ ] **File**: `internal/screening/engine.go` (~10 lines changed)
- [ ] **Test**: `internal/screening/engine_test.go` — add test case with mock embedding matcher

### T2: Auto-generate embeddings on entity ingestion (internal/ingestion/)
- [ ] After `SyncService` processes new/modified entities, call `EmbeddingGenerator.GenerateBatch()`
- [ ] Add embedding generation as post-sync hook in `sync_service.go`
- [ ] Only generate embeddings for entities that don't already have them (check `embedding IS NULL`)
- [ ] **File**: `internal/ingestion/sync_service.go` (~15 lines)
- [ ] **Test**: Verify embeddings are generated after sync completes

### T3: Add embedding config to TenantConfig (internal/domain/)
- [ ] Add `EmbeddingEnabled bool` and `EmbeddingModel string` to `TenantConfig`
- [ ] Default: `false` for Starter plans, `true` for Pro/Enterprise
- [ ] Wire config check in engine: skip embedding layer if `!config.EmbeddingEnabled`
- [ ] **File**: `internal/domain/tenant_config.go` (~5 lines)
- [ ] **File**: `internal/screening/engine.go` — add config guard

### T4: Configure embedding API endpoint (internal/config/)
- [ ] Add env vars: `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- [ ] Add fallback: if no API key, log warning and skip embedding layer (don't crash)
- [ ] **File**: `internal/config/config.go` (~10 lines)

### T5: Integration tests
- [ ] Test Arabic name → Latin transliteration matching via embeddings
- [ ] Test Cyrillic → Latin cross-script matching
- [ ] Test engine with all 5 layers active (Exact + Fuzzy + Phonetic + Token + Embedding)
- [ ] Benchmark: embedding layer must add <10ms to total screening latency
- [ ] **Files**: `internal/screening/engine_integration_test.go` (new file, <100 lines)

### T6: Update API response to include embedding evidence
- [ ] Verify `MatchEvidence` with `Layer: MatchLayerEmbedding` appears in screening response
- [ ] Verify explainer generates readable text: "Semantic similarity: 87% (cross-language match)"
- [ ] **File**: `internal/screening/explainer.go` — add embedding explanation template

## Acceptance Criteria

- [ ] `Engine.Screen()` calls embedding layer for tenants with `EmbeddingEnabled: true`
- [ ] Cross-language name matching works (Arabic ↔ Latin, Cyrillic ↔ Latin)
- [ ] Embedding layer adds <10ms to p95 latency
- [ ] All existing 262 Go tests still pass
- [ ] New integration tests cover embedding scenarios
- [ ] Embedding generation runs automatically on list sync

## Files Modified

| File | Change |
|------|--------|
| `internal/screening/engine.go` | Wire embedding matcher call |
| `internal/screening/explainer.go` | Add embedding explanation template |
| `internal/ingestion/sync_service.go` | Post-sync embedding generation hook |
| `internal/domain/tenant_config.go` | Add EmbeddingEnabled field |
| `internal/config/config.go` | Add embedding env vars |
| `internal/screening/engine_integration_test.go` | New integration tests |
