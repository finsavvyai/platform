CREATE TABLE batch_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    entity_count INTEGER NOT NULL DEFAULT 0,
    processed_at INTEGER NOT NULL DEFAULT 0,
    match_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    format TEXT NOT NULL DEFAULT 'csv',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_batch_jobs_tenant ON batch_jobs(tenant_id);
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);

CREATE TABLE batch_results (
    id SERIAL PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batch_jobs(id),
    entity_name TEXT NOT NULL,
    match_count INTEGER NOT NULL DEFAULT 0,
    top_match TEXT,
    confidence DOUBLE PRECISION DEFAULT 0,
    list_id TEXT,
    CONSTRAINT fk_batch FOREIGN KEY (batch_id) REFERENCES batch_jobs(id)
);

CREATE INDEX idx_batch_results_batch ON batch_results(batch_id);
