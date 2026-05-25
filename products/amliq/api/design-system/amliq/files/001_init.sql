-- amliq audit and screening log schema
-- Watchman handles matching in-memory; this is the audit trail only

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS screens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  input_name    TEXT NOT NULL,
  normalized    TEXT NOT NULL,
  score         NUMERIC(5,4),
  status        TEXT NOT NULL CHECK (status IN ('clean','monitor','alert','block')),
  matched_id    TEXT,
  matched_name  TEXT,
  list_source   TEXT,
  dob           DATE,
  nationality   CHAR(2),
  source        TEXT DEFAULT 'api',  -- 'api' | 'batch' | 'monitoring'
  customer_ref  TEXT,
  metadata      JSONB
);

CREATE INDEX idx_screens_normalized ON screens(normalized);
CREATE INDEX idx_screens_created_at ON screens(created_at DESC);
CREATE INDEX idx_screens_status ON screens(status) WHERE status IN ('alert','block');
CREATE INDEX idx_screens_customer_ref ON screens(customer_ref) WHERE customer_ref IS NOT NULL;

-- False positive whitelist — operator-confirmed mismatches
CREATE TABLE IF NOT EXISTS fp_whitelist (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  normalized   TEXT NOT NULL UNIQUE,
  matched_id   TEXT,
  reason       TEXT,
  operator     TEXT
);

CREATE INDEX idx_fp_normalized ON fp_whitelist(normalized);

-- List version tracking — used to invalidate KV negative cache
CREATE TABLE IF NOT EXISTS list_versions (
  list_source  TEXT PRIMARY KEY,
  version      TEXT NOT NULL,
  record_count INTEGER,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
