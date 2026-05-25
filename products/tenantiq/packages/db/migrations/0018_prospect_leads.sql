-- T2.4: prospect_leads — captures prospect emails from the public domain-scan
-- landing page. Hashed IP only (16 hex chars of sha256), no full IP retained.

CREATE TABLE IF NOT EXISTS prospect_leads (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  email           TEXT NOT NULL,
  score           INTEGER NOT NULL,
  findings_count  INTEGER NOT NULL,
  scanned_at      TEXT NOT NULL,
  ip_hash         TEXT,
  contacted_at    TEXT,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_prospect_leads_email ON prospect_leads (email);
CREATE INDEX IF NOT EXISTS idx_prospect_leads_scanned_at ON prospect_leads (scanned_at);
