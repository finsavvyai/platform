-- Performance indexes for common query patterns
-- Addresses missing indexes on frequently-queried columns

-- Composite index for alert filtering (tenant + status)
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status
  ON security_alerts(tenant_id, status);

-- Composite index for alert severity queries
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_severity
  ON security_alerts(tenant_id, severity);

-- Platform user azure OID lookup (for auth callbacks)
-- Note: azure_oid column may not exist yet; conditional
-- CREATE INDEX IF NOT EXISTS idx_platform_users_azure_oid
--   ON platform_users(azure_oid);

-- Composite index for user cache lookups by tenant + enabled
CREATE INDEX IF NOT EXISTS idx_users_cache_tenant_enabled
  ON users_cache(tenant_id, account_enabled);

-- Index for license cache SKU lookups
CREATE INDEX IF NOT EXISTS idx_licenses_cache_tenant_sku
  ON licenses_cache(tenant_id, sku_id);

-- Index for webhook delivery retry scheduling
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry
  ON webhook_deliveries(status, next_retry_at);

-- Index for alert time-range queries
CREATE INDEX IF NOT EXISTS idx_alerts_detected_at
  ON security_alerts(detected_at);
