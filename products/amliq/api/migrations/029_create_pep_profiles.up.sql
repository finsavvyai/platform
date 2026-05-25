CREATE TABLE pep_profiles (
    entity_id TEXT PRIMARY KEY,
    tier INT NOT NULL DEFAULT 0,
    position TEXT NOT NULL,
    country TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    active_from TEXT,
    active_to TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pep_country ON pep_profiles(country);
CREATE INDEX idx_pep_tier ON pep_profiles(tier);

CREATE TABLE rca_relations (
    pep_entity_id TEXT NOT NULL REFERENCES pep_profiles(entity_id),
    related_entity_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (pep_entity_id, related_entity_id)
);
CREATE INDEX idx_rca_related ON rca_relations(related_entity_id);
