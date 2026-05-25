-- Migration 005: Implement Row-Level Security
-- Version: 1.0.0
-- Description: Enable row-level security for multi-tenant data isolation
-- Dependencies: 004_create_views_and_materialized_views.sql
-- Rollback: Disable RLS and drop policies

BEGIN;

-- Enable row-level security on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlp_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vector_search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Create application role for database access
CREATE ROLE app_user WITH NOLOGIN;

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
GRANT INSERT ON ALL TABLES IN SCHEMA public TO app_user;
GRANT UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Grant permissions on extensions
GRANT USAGE ON SCHEMA vector TO app_user;
GRANT USAGE ON SCHEMA pgcrypto TO app_user;

-- Tenant isolation policies
CREATE POLICY tenant_isolation_tenants ON tenants
    FOR ALL TO app_user
    USING (id = current_setting('app.current_tenant_id', true)::UUID OR current_setting('app.current_tenant_id', true) = 'system');

CREATE POLICY tenant_isolation_users ON users
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_api_keys ON api_keys
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_user_sessions ON user_sessions
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_documents ON documents
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_document_chunks ON document_chunks
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_policies ON policies
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_isolation_policy_evaluations ON policy_evaluations
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_dlp_scans ON dlp_scans
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_token_usage ON token_usage
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_document_processing_jobs ON document_processing_jobs
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_vector_search_logs ON vector_search_logs
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_embedding_jobs ON embedding_jobs
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_document_access_log ON document_access_log
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_tenant_quotas ON tenant_quotas
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_compliance_reports ON compliance_reports
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- User access control policies
CREATE POLICY user_self_access ON users
    FOR SELECT TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND id = current_setting('app.current_user_id', true)::UUID
    );

CREATE POLICY user_self_update ON users
    FOR UPDATE TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND id = current_setting('app.current_user_id', true)::UUID
    );

-- Session access policies
CREATE POLICY user_session_access ON user_sessions
    FOR ALL TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND user_id = current_setting('app.current_user_id', true)::UUID
    );

-- API key access policies
CREATE POLICY user_api_key_access ON api_keys
    FOR ALL TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND user_id = current_setting('app.current_user_id', true)::UUID
    );

-- Document access control policies
CREATE POLICY document_owner_access ON documents
    FOR ALL TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND created_by = current_setting('app.current_user_id', true)::UUID
    );

-- Document chunk access inherits from document access
CREATE POLICY document_chunk_access ON document_chunks
    FOR SELECT TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND EXISTS (
            SELECT 1 FROM documents d
            WHERE d.id = document_chunks.document_id
            AND d.created_by = current_setting('app.current_user_id', true)::UUID
        )
    );

-- Admin access policies (super admin can see all)
CREATE POLICY admin_full_access ON tenants FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

CREATE POLICY admin_full_access_users ON users FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

CREATE POLICY admin_full_access_api_keys ON api_keys FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

CREATE POLICY admin_full_access_sessions ON user_sessions FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

CREATE POLICY admin_full_access_documents ON documents FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

CREATE POLICY admin_full_access_chunks ON document_chunks FOR ALL TO app_user
    USING (current_setting('app.current_user_role', true) IN ('super_admin'));

-- Tenant admin policies (can access all within their tenant)
CREATE POLICY tenant_admin_full_access ON users FOR ALL TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND current_setting('app.current_user_role', true) IN ('tenant_admin')
    );

CREATE POLICY tenant_admin_full_access_documents ON documents FOR ALL TO app_user
    USING (
        tenant_id = current_setting('app.current_tenant_id', true)::UUID
        AND current_setting('app.current_user_role', true) IN ('tenant_admin')
    );

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID, user_uuid UUID, user_role TEXT)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::TEXT, true);
    PERFORM set_config('app.current_user_id', user_uuid::TEXT, true);
    PERFORM set_config('app.current_user_role', user_role, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear tenant context
CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', '', true);
    PERFORM set_config('app.current_user_id', '', true);
    PERFORM set_config('app.current_user_role', '', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check tenant access
CREATE OR REPLACE FUNCTION check_tenant_access(tenant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_tenant UUID;
    current_role TEXT;
BEGIN
    current_tenant := current_setting('app.current_tenant_id', true)::UUID;
    current_role := current_setting('app.current_user_role', true);

    -- Super admin can access any tenant
    IF current_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Users can only access their own tenant
    RETURN current_tenant = tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user access
CREATE OR REPLACE FUNCTION check_user_access(user_uuid UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_tenant UUID;
    current_user UUID;
    current_role TEXT;
BEGIN
    current_tenant := current_setting('app.current_tenant_id', true)::UUID;
    current_user := current_setting('app.current_user_id', true)::UUID;
    current_role := current_setting('app.current_user_role', true);

    -- Super admin can access any user
    IF current_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Users can only access themselves
    IF current_user = user_uuid THEN
        RETURN current_tenant = tenant_uuid;
    END IF;

    -- Tenant admin can access users in their tenant
    IF current_role = 'tenant_admin' AND current_tenant = tenant_uuid THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check document access
CREATE OR REPLACE FUNCTION check_document_access(document_uuid UUID, tenant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_tenant UUID;
    current_user UUID;
    current_role TEXT;
    doc_created_by UUID;
BEGIN
    current_tenant := current_setting('app.current_tenant_id', true)::UUID;
    current_user := current_setting('app.current_user_id', true)::UUID;
    current_role := current_setting('app.current_user_role', true);

    -- Super admin can access any document
    IF current_role = 'super_admin' THEN
        RETURN true;
    END IF;

    -- Check tenant access first
    IF current_tenant != tenant_uuid THEN
        RETURN false;
    END IF;

    -- Get document owner
    SELECT created_by INTO doc_created_by
    FROM documents
    WHERE id = document_uuid AND tenant_id = tenant_uuid;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Document owner can access
    IF current_user = doc_created_by THEN
        RETURN true;
    END IF;

    -- Tenant admin can access all documents in their tenant
    IF current_role = 'tenant_admin' THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record migration
INSERT INTO schema_migrations (version, description, checksum, rollback_script) VALUES (
    '005',
    'Implement Row-Level Security',
    md5('005_implement_row_level_security.sql'),
    $rollback$
    DROP FUNCTION IF EXISTS check_document_access(UUID, UUID);
    DROP FUNCTION IF EXISTS check_user_access(UUID, UUID);
    DROP FUNCTION IF EXISTS check_tenant_access(UUID);
    DROP FUNCTION IF EXISTS clear_tenant_context();
    DROP FUNCTION IF EXISTS set_tenant_context(UUID, UUID, TEXT);
    DROP POLICY IF EXISTS tenant_admin_full_access_documents ON documents;
    DROP POLICY IF EXISTS tenant_admin_full_access ON users;
    DROP POLICY IF EXISTS admin_full_access_chunks ON document_chunks;
    DROP POLICY IF EXISTS admin_full_access_documents ON documents;
    DROP POLICY IF EXISTS admin_full_access_sessions ON user_sessions;
    DROP POLICY IF EXISTS admin_full_access_api_keys ON api_keys;
    DROP POLICY IF EXISTS admin_full_access_users ON users;
    DROP POLICY IF EXISTS admin_full_access ON tenants;
    DROP POLICY IF EXISTS document_chunk_access ON document_chunks;
    DROP POLICY IF EXISTS document_owner_access ON documents;
    DROP POLICY IF EXISTS user_api_key_access ON api_keys;
    DROP POLICY IF EXISTS user_session_access ON user_sessions;
    DROP POLICY IF EXISTS user_self_update ON users;
    DROP POLICY IF EXISTS user_self_access ON users;
    DROP POLICY IF EXISTS tenant_isolation_document_access_log ON document_access_log;
    DROP POLICY IF EXISTS tenant_isolation_embedding_jobs ON embedding_jobs;
    DROP POLICY IF EXISTS tenant_isolation_vector_search_logs ON vector_search_logs;
    DROP POLICY IF EXISTS tenant_isolation_document_processing_jobs ON document_processing_jobs;
    DROP POLICY IF EXISTS tenant_isolation_token_usage ON token_usage;
    DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
    DROP POLICY IF EXISTS tenant_isolation_dlp_scans ON dlp_scans;
    DROP POLICY IF EXISTS tenant_isolation_policy_evaluations ON policy_evaluations;
    DROP POLICY IF EXISTS tenant_isolation_policies ON policies;
    DROP POLICY IF EXISTS tenant_isolation_document_chunks ON document_chunks;
    DROP POLICY IF EXISTS tenant_isolation_documents ON documents;
    DROP POLICY IF EXISTS tenant_isolation_user_sessions ON user_sessions;
    DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
    DROP POLICY IF EXISTS tenant_isolation_users ON users;
    DROP POLICY IF EXISTS tenant_isolation_tenants ON tenants;
    ALTER TABLE document_access_log DISABLE ROW LEVEL SECURITY;
    ALTER TABLE embedding_jobs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE vector_search_logs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE document_processing_jobs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE token_usage DISABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE dlp_scans DISABLE ROW LEVEL SECURITY;
    ALTER TABLE policy_evaluations DISABLE ROW LEVEL SECURITY;
    ALTER TABLE policies DISABLE ROW LEVEL SECURITY;
    ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;
    ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
    ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE api_keys DISABLE ROW LEVEL SECURITY;
    ALTER TABLE users DISABLE ROW LEVEL SECURITY;
    ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
    DROP ROLE IF EXISTS app_user;
    $rollback$
);

COMMIT;
