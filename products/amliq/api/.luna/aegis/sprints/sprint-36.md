# Sprint 36: Graph Matching v1

**Duration**: 2 weeks
**Priority**: CRITICAL
**Closes Gaps**: G2
**Depends On**: None (can run parallel with S-35)
**Status**: Not Started

---

## Objective

Replace the no-op Graph layer with a functional relationship matcher using PostgreSQL JSONB. Enable detection of sanctioned networks (family members, business associates, shell companies).

## Background

Current state of `graph.go`:
```go
func (gm *GraphMatcher) Match(query domain.Name, candidates []domain.Name) []domain.MatchEvidence {
    var evidence []domain.MatchEvidence
    return evidence  // NO-OP
}
```

`MatchByID()` has basic relation lookup logic but is never called by the engine. No graph DB backend exists.

## Tasks

### T1: Design and create relationships schema
- [ ] New migration: `031_create_relationships.up.sql`
  ```sql
  CREATE TABLE entity_relationships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_entity_id UUID NOT NULL REFERENCES entities(id),
      target_entity_id UUID NOT NULL REFERENCES entities(id),
      relationship_type TEXT NOT NULL, -- FAMILY, BUSINESS, ALIAS, ASSOCIATE, SHELL_COMPANY
      confidence REAL NOT NULL DEFAULT 0.0,
      source_list TEXT NOT NULL, -- which sanctions list provided this
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source_entity_id, target_entity_id, relationship_type)
  );
  CREATE INDEX idx_rel_source ON entity_relationships(source_entity_id);
  CREATE INDEX idx_rel_target ON entity_relationships(target_entity_id);
  CREATE INDEX idx_rel_type ON entity_relationships(relationship_type);
  ```
- [ ] **File**: `migrations/031_create_relationships.up.sql` (<30 lines)
- [ ] **File**: `migrations/031_create_relationships.down.sql`

### T2: Implement relationship repository
- [ ] Create `internal/storage/pgx/relationship_repo.go`
- [ ] Methods: `Store(rel)`, `FindByEntity(entityID)`, `FindByEntityWithDepth(entityID, maxDepth int)`, `BulkStore(rels []Relationship)`
- [ ] `FindByEntityWithDepth` does recursive CTE for 2-hop traversal:
  ```sql
  WITH RECURSIVE rel_chain AS (
      SELECT target_entity_id, relationship_type, 1 as depth
      FROM entity_relationships WHERE source_entity_id = $1
      UNION ALL
      SELECT er.target_entity_id, er.relationship_type, rc.depth + 1
      FROM entity_relationships er
      JOIN rel_chain rc ON er.source_entity_id = rc.target_entity_id
      WHERE rc.depth < $2
  )
  SELECT * FROM rel_chain;
  ```
- [ ] **File**: `internal/storage/pgx/relationship_repo.go` (<100 lines)
- [ ] **Test**: `internal/storage/pgx/relationship_repo_test.go`

### T3: Implement real GraphMatcher.Match()
- [ ] Replace no-op `Match()` with:
  1. Screen query name against candidates (using existing layers)
  2. For each near-miss (score 0.3-0.7), check if candidate has sanctioned relations
  3. If entity has 1st-degree sanctioned relation → boost score by 0.3
  4. If entity has 2nd-degree sanctioned relation → boost score by 0.15
  5. Return evidence with relationship chain explanation
- [ ] **File**: `internal/screening/graph.go` (rewrite, <100 lines)
- [ ] **Test**: `internal/screening/graph_test.go` (rewrite)

### T4: Wire GraphMatcher into Engine.Screen()
- [ ] Add `graphMatcher *GraphMatcher` field to `Engine` struct
- [ ] Call after embedding layer (or after token if embedding disabled)
- [ ] Guard: `if e.graphMatcher != nil && config.GraphEnabled`
- [ ] Add `GraphEnabled bool` to `TenantConfig` (default: false, Pro/Enterprise only)
- [ ] **File**: `internal/screening/engine.go` (~10 lines)

### T5: Ingest relationship data from OpenSanctions
- [ ] OpenSanctions includes `associates` and `family` relationship data
- [ ] Parse relationships during ingestion in `opensanctions.go`
- [ ] Store via `RelationshipRepository.BulkStore()`
- [ ] Also parse OFAC alt names as ALIAS relationships
- [ ] **File**: `internal/ingestion/opensanctions.go` (~20 lines added)
- [ ] **File**: `internal/ingestion/ofac.go` (~10 lines added)

### T6: Add graph evidence to explainer
- [ ] Template: "Related to [SANCTIONED_NAME] via [RELATIONSHIP_TYPE] (1st degree). Source: [LIST]."
- [ ] Template for 2-hop: "Connected to [SANCTIONED_NAME] through [INTERMEDIARY] via [TYPE1] → [TYPE2]."
- [ ] **File**: `internal/screening/explainer.go` (~15 lines)

## Acceptance Criteria

- [ ] `GraphMatcher.Match()` returns real evidence for entities with known associations
- [ ] 1-hop and 2-hop relationship traversal works correctly
- [ ] Relationship data ingested from OpenSanctions and OFAC alt names
- [ ] Graph layer adds <20ms to p95 latency
- [ ] All existing tests pass + new graph-specific tests
- [ ] With S-35, AMLIQ now truthfully claims 6-layer cascade

## Files Created/Modified

| File | Action |
|------|--------|
| `migrations/031_create_relationships.up.sql` | CREATE |
| `migrations/031_create_relationships.down.sql` | CREATE |
| `internal/storage/pgx/relationship_repo.go` | CREATE |
| `internal/storage/pgx/relationship_repo_test.go` | CREATE |
| `internal/screening/graph.go` | REWRITE |
| `internal/screening/graph_test.go` | REWRITE |
| `internal/screening/engine.go` | MODIFY |
| `internal/screening/explainer.go` | MODIFY |
| `internal/ingestion/opensanctions.go` | MODIFY |
| `internal/ingestion/ofac.go` | MODIFY |
| `internal/domain/tenant_config.go` | MODIFY |
