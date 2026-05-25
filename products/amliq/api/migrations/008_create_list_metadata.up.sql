CREATE TABLE list_metadata (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    url TEXT,
    format VARCHAR(50),
    entity_count INT NOT NULL DEFAULT 0,
    checksum VARCHAR(64),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_list_metadata_source ON list_metadata(source);
CREATE INDEX idx_list_metadata_name ON list_metadata(name);
