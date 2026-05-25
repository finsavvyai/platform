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
-- Deep-merge two JSONB objects. For keys in both, object values are
-- recursively merged; non-object values take b's value. Keys only in
-- a or only in b pass through. Marked STABLE because recursive calls
-- to a plpgsql function disqualify IMMUTABLE in PG14+.
CREATE OR REPLACE FUNCTION jsonb_merge_deep(a jsonb, b jsonb)
RETURNS jsonb AS $$
DECLARE
    result jsonb := COALESCE(a, '{}'::jsonb);
    k text;
    v_a jsonb;
    v_b jsonb;
BEGIN
    IF b IS NULL OR jsonb_typeof(b) <> 'object' THEN
        RETURN result;
    END IF;
    FOR k, v_b IN SELECT key, value FROM jsonb_each(b) LOOP
        v_a := result -> k;
        IF jsonb_typeof(v_a) = 'object' AND jsonb_typeof(v_b) = 'object' THEN
            result := jsonb_set(result, ARRAY[k], jsonb_merge_deep(v_a, v_b));
        ELSE
            result := jsonb_set(result, ARRAY[k], v_b, true);
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Tenant context functions
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_uuid::TEXT, true);
END;
$$ LANGUAGE plpgsql;

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

-- L2-normalise a vector. The original used Python-style comprehension
-- syntax inside SQL; this is a clean plpgsql loop that works on any
-- pgvector version (no reliance on vector_norm(), which moved between
-- pgvector 0.4 and 0.5).
CREATE OR REPLACE FUNCTION normalize_vector(vec vector)
RETURNS vector AS $$
DECLARE
    arr double precision[];
    s   double precision := 0;
    i   integer;
    n   integer;
    mag double precision;
BEGIN
    IF vec IS NULL THEN
        RETURN NULL;
    END IF;
    arr := vec::double precision[];
    n := array_length(arr, 1);
    IF n IS NULL OR n = 0 THEN
        RETURN vec;
    END IF;
    FOR i IN 1..n LOOP
        s := s + arr[i] * arr[i];
    END LOOP;
    mag := sqrt(s);
    IF mag = 0 THEN
        RETURN vec;
    END IF;
    RETURN (vec::real[] / mag::real)::vector;
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

-- Performance monitoring. Each metric is its own scalar subquery so
-- the function call doesn't try to share a single FROM clause across
-- unrelated source tables.
CREATE OR REPLACE FUNCTION get_database_metrics()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'active_connections',
            (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
        'cache_hit_ratio',
            (SELECT ROUND(
                (sum(heap_blks_hit)::NUMERIC
                  / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100, 2)
             FROM pg_statio_user_tables),
        'index_usage',
            (SELECT ROUND(
                (sum(idx_scan)::NUMERIC
                  / NULLIF(sum(idx_scan + seq_scan), 0)) * 100, 2)
             FROM pg_stat_user_tables)
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
