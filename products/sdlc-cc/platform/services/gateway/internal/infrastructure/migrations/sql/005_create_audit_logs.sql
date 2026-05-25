-- Migration: 005_create_audit_logs
-- Description: Create audit logs table for compliance (SOC2, HIPAA, GDPR)

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    request_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'success',
    details JSONB NOT NULL DEFAULT '{}',
    changes JSONB,
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for performance at scale
-- In production, you'd create partitions automatically
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_risk_level ON audit_logs(risk_level) WHERE risk_level IN ('high', 'critical');
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN(details);

-- Audit logs are append-only — no RLS policy allows DELETE/UPDATE
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Retention: create a function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    WITH archived AS (
        DELETE FROM audit_logs
        WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING *
    )
    SELECT count(*) INTO archived_count FROM archived;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
