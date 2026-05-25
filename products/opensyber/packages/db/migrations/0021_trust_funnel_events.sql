-- Launch funnel attribution for public trust pages

CREATE TABLE trust_funnel_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  instance_id TEXT,
  instance_name TEXT,
  score INTEGER,
  grade TEXT,
  path TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  session_id TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  ref TEXT,
  referrer_host TEXT,
  landing_path TEXT,
  first_seen_at TEXT,
  user_agent TEXT,
  country_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_trust_funnel_events_event_created
  ON trust_funnel_events(event, created_at);

CREATE INDEX idx_trust_funnel_events_session_created
  ON trust_funnel_events(session_id, created_at);

CREATE INDEX idx_trust_funnel_events_instance_created
  ON trust_funnel_events(instance_id, created_at);
