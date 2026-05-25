-- Migration 001: Create Extensions and Custom Types
-- Version: 1.0.0
-- Description: Enable required PostgreSQL extensions and create custom data types
-- Dependencies: 000_schema_migrations_table.sql
-- Rollback: Drop extensions and custom types
-- Tags: core,setup,extensions

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Create custom ENUM types
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'deleted');
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'data_scientist', 'analyst', 'viewer', 'user');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'archived');
CREATE TYPE policy_type AS ENUM ('auth', 'data_access', 'dlp', 'cost', 'compliance');
CREATE TYPE encryption_algorithm AS ENUM ('aes-256-gcm', 'chacha20-poly1305');
CREATE TYPE data_classification AS ENUM ('public', 'internal', 'confidential', 'restricted');
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'access_denied');
CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'enterprise', 'custom');
CREATE TYPE storage_provider AS ENUM ('r2', 's3', 'gcs', 'azure');
CREATE TYPE embedding_provider AS ENUM ('openai', 'anthropic', 'cohere', 'local');

-- Custom vector similarity functions
CREATE OR REPLACE FUNCTION vector_cosine_similarity(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN 1 - (vec1 <=> vec2);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION vector_distance(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN vec1 <=> vec2;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION vector_avg(vectors vector[])
RETURNS vector AS $$
DECLARE
    result vector;
    dims INTEGER;
    i INTEGER;
BEGIN
    IF array_length(vectors, 1) IS NULL OR array_length(vectors, 1) = 0 THEN
        RETURN NULL;
    END IF;

    dims := vector_dims(vectors[1]);
    result := vector_fill(0, dims);

    FOR i IN 1..array_length(vectors, 1) LOOP
        result := result + vectors[i];
    END LOOP;

    RETURN result / array_length(vectors, 1)::REAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
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

-- Token counting and utility functions
CREATE OR REPLACE FUNCTION count_tokens(text_content TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CEIL(LENGTH(text_content) / 4.0)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

-- Performance monitoring
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
    '001',
    'Create Extensions and Custom Types',
    '001_create_extensions_and_types.sql',
    md5('001_create_extensions_and_types.sql'),
    $rollback$
    DROP FUNCTION IF EXISTS get_database_metrics();
    DROP FUNCTION IF EXISTS log_audit_event(UUID, UUID, audit_action, TEXT, UUID, JSONB);
    DROP FUNCTION IF EXISTS calculate_relevance_score(REAL, REAL, REAL, REAL, REAL);
    DROP FUNCTION IF EXISTS normalize_vector(vector);
    DROP FUNCTION IF EXISTS count_tokens(TEXT);
    DROP FUNCTION IF EXISTS decrypt_sensitive_data(BYTEA, TEXT);
    DROP FUNCTION IF EXISTS encrypt_sensitive_data(TEXT, TEXT);
    DROP FUNCTION IF EXISTS set_tenant_context(UUID);
    DROP FUNCTION IF EXISTS current_tenant_id();
    DROP FUNCTION IF EXISTS jsonb_merge_deep(jsonb, jsonb);
    DROP FUNCTION IF EXISTS vector_avg(vector[]);
    DROP FUNCTION IF EXISTS vector_distance(vector, vector);
    DROP FUNCTION IF EXISTS vector_cosine_similarity(vector, vector);
    DROP TYPE IF EXISTS embedding_provider;
    DROP TYPE IF EXISTS storage_provider;
    DROP TYPE IF EXISTS subscription_tier;
    DROP TYPE IF EXISTS audit_action;
    DROP TYPE IF EXISTS data_classification;
    DROP TYPE IF EXISTS encryption_algorithm;
    DROP TYPE IF EXISTS policy_type;
    DROP TYPE IF EXISTS document_status;
    DROP TYPE IF EXISTS user_role;
    DROP TYPE IF EXISTS tenant_status;
    DROP EXTENSION IF EXISTS fuzzystrmatch;
    DROP EXTENSION IF EXISTS pg_trgm;
    DROP EXTENSION IF EXISTS btree_gist;
    DROP EXTENSION IF EXISTS pgcrypto;
    DROP EXTENSION IF EXISTS "uuid-ossp";
    DROP EXTENSION IF EXISTS vector;
    $rollback$,
    '{000}',
    '{core,setup,extensions}',
    '{"required": true, "critical": true}'
);

COMMIT;
