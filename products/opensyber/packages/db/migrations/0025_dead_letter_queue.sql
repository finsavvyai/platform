-- Dead Letter Queue for webhook resilience
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  eventType TEXT NOT NULL,
  payload TEXT NOT NULL,
  errorMessage TEXT NOT NULL,
  retryCount INTEGER DEFAULT 0,
  maxRetries INTEGER DEFAULT 3,
  nextRetryAt TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  createdAt TEXT NOT NULL,
  lastAttemptAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_dlq_status_retry ON dead_letter_queue(status, nextRetryAt);
