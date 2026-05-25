-- White-label branding per organization
CREATE TABLE IF NOT EXISTS org_branding (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#2563eb',
  secondary_color TEXT NOT NULL DEFAULT '#7c3aed',
  company_name TEXT NOT NULL DEFAULT '',
  custom_domain TEXT,
  email_from_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_branding_org ON org_branding(org_id);
