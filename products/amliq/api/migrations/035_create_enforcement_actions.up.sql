CREATE TABLE enforcement_actions (
    id TEXT PRIMARY KEY,
    entity_name TEXT NOT NULL,
    entity_type TEXT DEFAULT 'individual',
    regulator TEXT NOT NULL,
    action_type TEXT NOT NULL,
    amount NUMERIC,
    currency TEXT,
    action_date DATE NOT NULL,
    description TEXT,
    url TEXT,
    jurisdiction TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enforcement_entity ON enforcement_actions(entity_name);
CREATE INDEX idx_enforcement_regulator ON enforcement_actions(regulator);
CREATE INDEX idx_enforcement_date ON enforcement_actions(action_date);
