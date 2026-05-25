CREATE TABLE case_events (
    id BIGSERIAL PRIMARY KEY,
    case_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_case_events_case ON case_events(case_id);
CREATE INDEX idx_case_events_type ON case_events(event_type);
