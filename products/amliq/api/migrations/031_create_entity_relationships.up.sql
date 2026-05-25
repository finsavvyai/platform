CREATE TABLE entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity_id VARCHAR(20) NOT NULL REFERENCES entities(id),
    target_entity_id VARCHAR(20) NOT NULL REFERENCES entities(id),
    relationship_type TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.0,
    source_list TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX idx_rel_source ON entity_relationships(source_entity_id);
CREATE INDEX idx_rel_target ON entity_relationships(target_entity_id);
CREATE INDEX idx_rel_type ON entity_relationships(relationship_type);
