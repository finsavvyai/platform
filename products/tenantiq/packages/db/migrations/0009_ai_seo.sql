-- AI SEO Optimizer & Publisher tables
-- Supports domain auditing, content generation, and citation tracking

CREATE TABLE IF NOT EXISTS seo_audits (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  overall_score INTEGER,
  ai_visibility_score INTEGER,
  content_score INTEGER,
  structured_data_score INTEGER,
  citation_score INTEGER,
  findings TEXT,
  competitors TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_audits_org ON seo_audits(org_id);
CREATE INDEX IF NOT EXISTS idx_seo_audits_domain ON seo_audits(domain);
CREATE INDEX IF NOT EXISTS idx_seo_audits_status ON seo_audits(status);

CREATE TABLE IF NOT EXISTS seo_content (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  audit_id TEXT,
  domain TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  published_to TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_content_org ON seo_content(org_id);
CREATE INDEX IF NOT EXISTS idx_seo_content_domain ON seo_content(domain);
CREATE INDEX IF NOT EXISTS idx_seo_content_type ON seo_content(content_type);
CREATE INDEX IF NOT EXISTS idx_seo_content_status ON seo_content(status);

CREATE TABLE IF NOT EXISTS seo_citations (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  ai_agent TEXT NOT NULL,
  prompt TEXT NOT NULL,
  mentioned INTEGER NOT NULL DEFAULT 0,
  context TEXT,
  sentiment TEXT,
  competitor_mentions TEXT,
  checked_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seo_citations_org ON seo_citations(org_id);
CREATE INDEX IF NOT EXISTS idx_seo_citations_domain ON seo_citations(domain);
CREATE INDEX IF NOT EXISTS idx_seo_citations_agent ON seo_citations(ai_agent);
