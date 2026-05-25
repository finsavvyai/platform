-- test_run_recordings: video artifact metadata for a test run.
-- One recording per run (run_id PK). The actual WEBM bytes live in R2
-- at `runs/{run_id}/recording.webm` (binding RECORDINGS, bucket
-- qestro-recordings). Written by POST /api/recordings/:runId/upload;
-- streamed by GET /api/recordings/:runId with Range support.

CREATE TABLE IF NOT EXISTS test_run_recordings (
    run_id TEXT PRIMARY KEY NOT NULL,
    r2_key TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    content_type TEXT NOT NULL DEFAULT 'video/webm',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS test_run_recordings_created_at_idx
    ON test_run_recordings(created_at);
