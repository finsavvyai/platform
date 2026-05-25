-- TokenForge: Device-bound session security tables

-- Core session binding table
CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  device_fingerprint TEXT,
  ip_address TEXT,
  country_code TEXT,
  trust_score INTEGER DEFAULT 100,
  bound_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked INTEGER DEFAULT 0,
  revoked_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_device_sessions_session ON device_sessions(session_id);
CREATE INDEX idx_device_sessions_user ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_expires ON device_sessions(expires_at);

-- TokenForge security events (separate from main security_events table)
CREATE TABLE tf_security_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  trust_score_before INTEGER,
  trust_score_after INTEGER,
  ip_address TEXT,
  country_code TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tf_security_events_session ON tf_security_events(session_id);
CREATE INDEX idx_tf_security_events_user ON tf_security_events(user_id);
CREATE INDEX idx_tf_security_events_type ON tf_security_events(event_type);
CREATE INDEX idx_tf_security_events_created ON tf_security_events(created_at);

-- Step-up auth challenges
CREATE TABLE step_up_challenges (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  method TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX idx_step_up_session ON step_up_challenges(session_id);
