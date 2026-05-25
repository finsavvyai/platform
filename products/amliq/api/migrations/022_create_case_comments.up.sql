CREATE TABLE case_comments (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL REFERENCES compliance_cases(id),
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_case_comments_case ON case_comments(case_id);
