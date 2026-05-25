-- Backup Jobs table for Exchange, SharePoint, and Teams data backups
CREATE TABLE IF NOT EXISTS backup_jobs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_count INTEGER DEFAULT 0,
  size_bytes INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_org ON backup_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant ON backup_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
