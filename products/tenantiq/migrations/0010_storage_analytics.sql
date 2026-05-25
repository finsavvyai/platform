-- Storage Analytics table for OneDrive/SharePoint usage tracking
CREATE TABLE IF NOT EXISTS storage_analytics (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'full',
  data TEXT,
  total_used_gb REAL DEFAULT 0,
  total_allocated_gb REAL DEFAULT 0,
  top_consumers TEXT,
  recommendations TEXT,
  scanned_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_storage_analytics_org ON storage_analytics(org_id);
CREATE INDEX IF NOT EXISTS idx_storage_analytics_tenant ON storage_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storage_analytics_scan_type ON storage_analytics(scan_type);
