-- Tier-1 leverage quick wins: custom properties, sessions, cost refinement.
-- Ported from Helicone (properties, sessions) and LiteLLM (spend log safety).

ALTER TABLE requests ADD COLUMN properties TEXT;            -- JSON blob keyed by x-clawpipe-property-*
ALTER TABLE requests ADD COLUMN session_id TEXT;            -- x-clawpipe-session-id
ALTER TABLE requests ADD COLUMN parent_session_id TEXT;     -- x-clawpipe-parent-session-id
ALTER TABLE requests ADD COLUMN cache_status TEXT;          -- HIT|SEMANTIC_HIT|MISS|REFRESH|DISABLED
ALTER TABLE requests ADD COLUMN tags TEXT;                  -- JSON array from x-clawpipe-tag

CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(project_id, session_id);
CREATE INDEX IF NOT EXISTS idx_requests_properties ON requests(project_id, properties);
CREATE INDEX IF NOT EXISTS idx_requests_cache_status ON requests(project_id, cache_status);
