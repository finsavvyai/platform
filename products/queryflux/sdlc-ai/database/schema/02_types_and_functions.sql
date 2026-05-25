-- Custom Types and Functions
-- Define custom data types and utility functions for SDLC.ai

-- Custom ENUM types
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'deleted');
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'data_scientist', 'analyst', 'viewer', 'user');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'archived');
CREATE TYPE policy_type AS ENUM ('auth', 'data_access', 'dlp', 'cost', 'compliance');
CREATE TYPE encryption_algorithm AS ENUM ('aes-256-gcm', 'chacha20-poly1305');
CREATE TYPE data_classification AS ENUM ('public', 'internal', 'confidential', 'restricted');
CREATE type audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'access_denied');

-- JSONB helper functions
CREATE OR REPLACE FUNCTION jsonb_merge_deep(a jsonb, b jsonb)
RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_build_object(
        SELECT key,
        CASE
            WHEN jsonb_typeof(a_val) = 'object' AND jsonb_typeof(b_val) = 'object'
            THEN jsonb_merge_deep(a_val, b_val)
            ELSE COALESCE(b_val, a_val)
        END
        FROM jsonb_each(a) a(key, a_val)
        LEFT JOIN jsonb_each(b) b(key, b_val) USING(key)
        UNION ALL
        SELECT key, b_val FROM jsonb_each(b) b(key, b_val)
        WHERE NOT EXISTS (SELECT 1 FROM jsonb_each(a) a(key, a_val) WHERE a.key = b.key)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Tenant context functions
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULL; -- Will be set by RLS policies
END;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::TEXT, true);
END;
$$ LANGUAGE sql;

-- Encryption utilities
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key_id TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, key_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data BYTEA, key_id TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_data, key_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Token counting functions
CREATE OR REPLACE FUNCTION count_tokens(text_content TEXT)
RETURNS INTEGER AS $$
BEGIN
    -- Simple token approximation (roughly 4 characters per token)
    -- In production, integrate with actual tokenizer
    RETURN CEIL(LENGTH(text_content) / 4.0)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vector utility functions
CREATE OR REPLACE FUNCTION normalize_vector(vec vector)
RETURNS vector AS $$
DECLARE
    magnitude REAL;
BEGIN
    magnitude := sqrt(array_to_string(array(select (vec[x])^2 for x in 1..vector_dims(vec)), ','));
    IF magnitude = 0 THEN
        RETURN vec;
    END IF;
    RETURN vec / magnitude;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Search ranking functions
CREATE OR REPLACE FUNCTION calculate_relevance_score(
    semantic_score REAL,
    keyword_score REAL,
    recency_weight REAL DEFAULT 0.1,
    semantic_weight REAL DEFAULT 0.7,
    keyword_weight REAL DEFAULT 0.2
) RETURNS REAL AS $$
BEGIN
    RETURN (semantic_score * semantic_weight) + (keyword_score * keyword_weight) + (recency_weight * recency_weight);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Data retention functions
CREATE OR REPLACE FUNCTION should_retain_data(created_at TIMESTAMPTZ, retention_days INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN created_at > (NOW() - (retention_days || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Audit logging helper
CREATE OR REPLACE FUNCTION log_audit_event(
    tenant_id UUID,
    user_id UUID,
    action audit_action,
    resource_type TEXT,
    resource_id UUID,
    details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id, user_id, action, resource_type, resource_id, details
    ) VALUES (
        tenant_id, user_id, action, resource_type, resource_id, details
    ) RETURNING id INTO audit_id;

    RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Performance monitoring functions
CREATE OR REPLACE FUNCTION get_database_metrics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'active_connections', count(*) FROM pg_stat_activity WHERE state = 'active',
        'cache_hit_ratio', ROUND((sum(heap_blks_hit)::NUMERIC / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100, 2) FROM pg_statio_user_tables,
        'index_usage', ROUND((sum(idx_scan)::NUMERIC / NULLIF(sum(idx_scan + seq_scan), 0)) * 100, 2) FROM pg_stat_user_tables
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
