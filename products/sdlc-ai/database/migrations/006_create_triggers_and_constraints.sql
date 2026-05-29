-- Migration 006: Create Triggers and Advanced Constraints
-- Version: 1.0.0
-- Description: Create database triggers, advanced constraints, and automated data management
-- Dependencies: 005_implement_row_level_security.sql
-- Rollback: Drop all triggers and constraints
-- Tags: triggers,constraints,automation,validation

BEGIN;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_chunks_updated_at
    BEFORE UPDATE ON document_chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at
    BEFORE UPDATE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_quotas_updated_at
    BEFORE UPDATE ON tenant_quotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compliance_reports_updated_at
    BEFORE UPDATE ON compliance_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Audit logging trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    audit_action audit_action;
    resource_type TEXT;
BEGIN
    -- Determine action type
    IF TG_OP = 'INSERT' THEN
        audit_action := 'create';
        resource_type := TG_TABLE_NAME;
        PERFORM log_audit_event(
            NEW.tenant_id,
            current_setting('app.current_user_id', true)::UUID,
            audit_action,
            resource_type,
            NEW.id,
            jsonb_build_object('operation', TG_OP, 'new_values', to_jsonb(NEW))
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        audit_action := 'update';
        resource_type := TG_TABLE_NAME;
        PERFORM log_audit_event(
            NEW.tenant_id,
            current_setting('app.current_user_id', true)::UUID,
            audit_action,
            resource_type,
            NEW.id,
            jsonb_build_object(
                'operation', TG_OP,
                'old_values', to_jsonb(OLD),
                'new_values', to_jsonb(NEW),
                'changed_fields', (
                    SELECT jsonb_agg(key)
                    FROM jsonb_object_keys(to_jsonb(NEW)) key
                    WHERE to_jsonb(NEW)->key != to_jsonb(OLD)->key
                )
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        audit_action := 'delete';
        resource_type := TG_TABLE_NAME;
        PERFORM log_audit_event(
            OLD.tenant_id,
            current_setting('app.current_user_id', true)::UUID,
            audit_action,
            resource_type,
            OLD.id,
            jsonb_build_object('operation', TG_OP, 'old_values', to_jsonb(OLD))
        );
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_users_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_documents_trigger
    AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_api_keys_trigger
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_policies_trigger
    AFTER INSERT OR UPDATE OR DELETE ON policies
    FOR EACH ROW
    EXECUTE FUNCTION audit_trigger_function();

-- Document access logging trigger
CREATE OR REPLACE FUNCTION log_document_access()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'SELECT' THEN
        INSERT INTO document_access_log (
            document_id,
            tenant_id,
            user_id,
            action,
            access_reason,
            ip_address,
            created_at,
            request_id,
            access_granted
        ) VALUES (
            OLD.id,
            OLD.tenant_id,
            current_setting('app.current_user_id', true)::UUID,
            'read',
            'Document accessed via query',
            inet_client_addr(),
            NOW(),
            gen_random_uuid(),
            true
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- API key usage tracking trigger
CREATE OR REPLACE FUNCTION update_api_key_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE api_keys
    SET
        last_used = NOW(),
        usage_count = usage_count + 1,
        last_ip_address = inet_client_addr()
    WHERE id = NEW.api_key_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_api_key_usage_trigger
    AFTER INSERT ON token_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_api_key_usage();

-- Quota enforcement trigger
CREATE OR REPLACE FUNCTION check_and_update_quota()
RETURNS TRIGGER AS $$
DECLARE
    quota_record tenant_quotas%ROWTYPE;
    usage_percentage NUMERIC;
BEGIN
    -- Get quota record for tokens
    SELECT * INTO quota_record
    FROM tenant_quotas
    WHERE tenant_id = NEW.tenant_id AND quota_type = 'tokens_per_month';

    IF FOUND THEN
        -- Check if quota needs reset (monthly reset)
        IF quota_record.next_reset_at <= NOW() THEN
            UPDATE tenant_quotas
            SET
                current_usage = 0,
                last_reset_at = NOW(),
                next_reset_at = NOW() + INTERVAL '1 month'
            WHERE id = quota_record.id;

            -- Reset the quota_record for this check
            quota_record.current_usage := 0;
        END IF;

        -- Check quota limits
        usage_percentage := (quota_record.current_usage::NUMERIC / quota_record.current_limit) * 100;

        IF quota_record.hard_limit AND usage_percentage >= 100 THEN
            RAISE EXCEPTION 'Token quota exceeded for tenant %: %/% tokens used',
                NEW.tenant_id, quota_record.current_usage, quota_record.current_limit;
        END IF;

        -- Update usage
        UPDATE tenant_quotas
        SET current_usage = current_usage + NEW.tokens_used
        WHERE id = quota_record.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_token_quota_trigger
    BEFORE INSERT ON token_usage
    FOR EACH ROW
    EXECUTE FUNCTION check_and_update_quota();

-- Storage quota enforcement trigger
CREATE OR REPLACE FUNCTION check_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
    quota_record tenant_quotas%ROWTYPE;
    current_storage BIGINT;
    new_total_storage BIGINT;
BEGIN
    -- Get storage quota
    SELECT * INTO quota_record
    FROM tenant_quotas
    WHERE tenant_id = NEW.tenant_id AND quota_type = 'storage_gb';

    IF FOUND THEN
        -- Calculate current storage usage
        SELECT COALESCE(SUM(file_size), 0) INTO current_storage
        FROM documents
        WHERE tenant_id = NEW.tenant_id AND deleted_at IS NULL;

        -- Convert GB quota to bytes
        new_total_storage := current_storage + NEW.file_size;

        IF new_total_storage > (quota_record.current_limit * 1024 * 1024 * 1024) THEN
            RAISE EXCEPTION 'Storage quota exceeded for tenant %: Current: % GB, Limit: % GB',
                NEW.tenant_id,
                ROUND(current_storage::NUMERIC / 1024 / 1024 / 1024, 2),
                quota_record.current_limit;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_storage_quota_trigger
    BEFORE INSERT ON documents
    FOR EACH ROW
    EXECUTE FUNCTION check_storage_quota();

-- Document processing job creation trigger
CREATE OR REPLACE FUNCTION create_document_processing_jobs()
RETURNS TRIGGER AS $$
BEGIN
    -- Create text extraction job
    INSERT INTO document_processing_jobs (
        document_id,
        tenant_id,
        job_type,
        status,
        priority,
        queue_name,
        metadata
    ) VALUES (
        NEW.id,
        NEW.tenant_id,
        'text_extraction',
        'pending',
        100,
        'extraction',
        jsonb_build_object('content_type', NEW.content_type, 'file_size', NEW.file_size)
    );

    -- Create DLP scan job
    INSERT INTO document_processing_jobs (
        document_id,
        tenant_id,
        job_type,
        status,
        priority,
        queue_name,
        metadata
    ) VALUES (
        NEW.id,
        NEW.tenant_id,
        'dlp_scan',
        'pending',
        200,
        'security',
        jsonb_build_object('classification', NEW.classification, 'access_level', NEW.access_level)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_processing_jobs_trigger
    AFTER INSERT ON documents
    FOR EACH ROW
    EXECUTE FUNCTION create_document_processing_jobs();

-- User session cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE user_sessions
    SET is_active = false
    WHERE is_active = true
    AND expires_at <= NOW();

    GET DIAGNOSTICS cleaned_count = ROW_COUNT;

    -- Log cleanup
    INSERT INTO audit_logs (
        tenant_id,
        action,
        resource_type,
        details,
        metadata
    ) SELECT
        tenant_id,
        'cleanup',
        'user_sessions',
        jsonb_build_object('expired_sessions_cleaned', cleaned_count),
        jsonb_build_object('cleanup_type', 'expired_sessions', 'timestamp', NOW())
    FROM (
        SELECT DISTINCT tenant_id FROM user_sessions WHERE is_active = false AND expires_at <= NOW()
    ) AS distinct_tenants;

    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Document chunks embedding job creation trigger
CREATE OR REPLACE FUNCTION create_embedding_jobs_for_chunks()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Create embedding job for new chunk
        INSERT INTO embedding_jobs (
            chunk_id,
            tenant_id,
            status,
            model_name,
            provider,
            metadata
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            'pending',
            'text-embedding-ada-002', -- Default model
            'openai', -- Default provider
            jsonb_build_object('content_length', NEW.content_length, 'language', NEW.language)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If content changed, create new embedding job
        IF OLD.content != NEW.content OR OLD.content_length != NEW.content_length THEN
            INSERT INTO embedding_jobs (
                chunk_id,
                tenant_id,
                status,
                model_name,
                provider,
                metadata
            ) VALUES (
                NEW.id,
                NEW.tenant_id,
                'pending',
                'text-embedding-ada-002',
                'openai',
                jsonb_build_object('reason', 'content_updated', 'content_length', NEW.content_length, 'language', NEW.language)
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_embedding_jobs_trigger
    AFTER INSERT OR UPDATE ON document_chunks
    FOR EACH ROW
    EXECUTE FUNCTION create_embedding_jobs_for_chunks();

-- Password security constraint trigger
CREATE OR REPLACE FUNCTION validate_password_security()
RETURNS TRIGGER AS $$
BEGIN
    -- Basic password validation
    IF LENGTH(NEW.password_hash) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters long';
    END IF;

    -- Log password change for security audit
    IF TG_OP = 'UPDATE' AND OLD.password_hash != NEW.password_hash THEN
        INSERT INTO audit_logs (
            tenant_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details,
            ip_address,
            metadata
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            'update',
            'user_password',
            NEW.id,
            jsonb_build_object('operation', 'password_change'),
            inet_client_addr(),
            jsonb_build_object('security_event', true, 'timestamp', NOW())
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_password_security_trigger
    BEFORE INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_password_security();

-- Advanced constraints for data integrity

-- Check tenant subscription limits
ALTER TABLE tenants ADD CONSTRAINT chk_trial_limit
    CHECK (
        subscription_tier != 'trial' OR
        (resource_limits->>'users')::INTEGER <= 5
    );

-- Check user email uniqueness across all tenants for super_admins
ALTER TABLE users ADD CONSTRAINT chk_super_admin_email_unique
    CHECK (
        role != 'super_admin' OR
        NOT EXISTS (
            SELECT 1 FROM users u2
            WHERE u2.email = users.email
            AND u2.role = 'super_admin'
            AND u2.id != users.id
            AND u2.deleted_at IS NULL
        )
    );

-- Check document file size limits based on subscription tier
ALTER TABLE documents ADD CONSTRAINT chk_file_size_subscription_limit
    CHECK (
        file_size <= CASE
            WHEN (SELECT subscription_tier FROM tenants WHERE id = documents.tenant_id) = 'basic' THEN 50 * 1024 * 1024 -- 50MB
            WHEN (SELECT subscription_tier FROM tenants WHERE id = documents.tenant_id) = 'pro' THEN 500 * 1024 * 1024 -- 500MB
            ELSE 5 * 1024 * 1024 * 1024 -- 5GB for enterprise
        END
    );

-- Check API key permissions validity
ALTER TABLE api_keys ADD CONSTRAINT chk_permissions_valid_json
    CHECK (jsonb_typeof(permissions) = 'object');

-- Check policy evaluation performance
ALTER TABLE policy_evaluations ADD CONSTRAINT chk_execution_performance
    CHECK (execution_time_ms <= 5000); -- Max 5 seconds per evaluation

-- Create indexes for trigger performance
CREATE INDEX idx_audit_logs_tenant_action ON audit_logs(tenant_id, action, created_at);
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action, created_at);
CREATE INDEX idx_document_processing_jobs_queue_priority ON document_processing_jobs(queue_name, priority, created_at);
CREATE INDEX idx_embedding_jobs_status_created ON embedding_jobs(status, created_at);
CREATE INDEX idx_token_usage_tenant_created ON token_usage(tenant_id, created_at);

-- Create scheduled cleanup function
CREATE OR REPLACE FUNCTION perform_maintenance_tasks()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    sessions_cleaned INTEGER;
    old_jobs_count INTEGER;
BEGIN
    -- Clean expired sessions
    sessions_cleaned := cleanup_expired_sessions();

    -- Clean old failed processing jobs (older than 30 days)
    UPDATE document_processing_jobs
    SET deleted_at = NOW()
    WHERE status = 'failed'
    AND created_at < NOW() - INTERVAL '30 days'
    AND deleted_at IS NULL;

    GET DIAGNOSTICS old_jobs_count = ROW_COUNT;

    -- Refresh materialized views (this will be called by external scheduler)
    -- PERFORM refresh_materialized_views();

    result := jsonb_build_object(
        'sessions_cleaned', sessions_cleaned,
        'old_jobs_cleaned', old_jobs_count,
        'timestamp', NOW()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on maintenance functions
GRANT EXECUTE ON FUNCTION perform_maintenance_tasks() TO app_user;

-- Record migration
INSERT INTO schema_migrations (
    version,
    description,
    filename,
    checksum,
    rollback_script,
    dependencies,
    tags,
    metadata
) VALUES (
    '006',
    'Create Triggers and Advanced Constraints',
    '006_create_triggers_and_constraints.sql',
    md5('006_create_triggers_and_constraints.sql'),
    $rollback$
    DROP TRIGGER IF EXISTS validate_password_security_trigger ON users;
    DROP TRIGGER IF EXISTS create_embedding_jobs_trigger ON document_chunks;
    DROP TRIGGER IF EXISTS create_processing_jobs_trigger ON documents;
    DROP TRIGGER IF EXISTS check_storage_quota_trigger ON documents;
    DROP TRIGGER IF EXISTS check_token_quota_trigger ON token_usage;
    DROP TRIGGER IF EXISTS update_api_key_usage_trigger ON token_usage;
    DROP TRIGGER IF EXISTS audit_policies_trigger ON policies;
    DROP TRIGGER IF EXISTS audit_api_keys_trigger ON api_keys;
    DROP TRIGGER IF EXISTS audit_documents_trigger ON documents;
    DROP TRIGGER IF EXISTS audit_users_trigger ON users;
    DROP TRIGGER IF EXISTS update_compliance_reports_updated_at ON compliance_reports;
    DROP TRIGGER IF EXISTS update_tenant_quotas_updated_at ON tenant_quotas;
    DROP TRIGGER IF EXISTS update_document_chunks_updated_at ON document_chunks;
    DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
    DROP FUNCTION IF EXISTS perform_maintenance_tasks();
    DROP FUNCTION IF EXISTS validate_password_security();
    DROP FUNCTION IF EXISTS create_embedding_jobs_for_chunks();
    DROP FUNCTION IF EXISTS create_document_processing_jobs();
    DROP FUNCTION IF EXISTS check_storage_quota();
    DROP FUNCTION IF EXISTS check_and_update_quota();
    DROP FUNCTION IF EXISTS update_api_key_usage();
    DROP FUNCTION IF EXISTS cleanup_expired_sessions();
    DROP FUNCTION IF EXISTS log_document_access();
    DROP FUNCTION IF EXISTS audit_trigger_function();
    DROP FUNCTION IF EXISTS update_updated_at_column();
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS chk_file_size_subscription_limit;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_super_admin_email_unique;
    ALTER TABLE tenants DROP CONSTRAINT IF EXISTS chk_trial_limit;
    ALTER TABLE policy_evaluations DROP CONSTRAINT IF EXISTS chk_execution_performance;
    ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS chk_permissions_valid_json;
    $rollback$,
    '{005}',
    '{triggers,constraints,automation,validation}',
    '{"required": true, "automation": true, "security": true}'
);

COMMIT;
