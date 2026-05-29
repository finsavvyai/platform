-- PostgreSQL Extensions Setup
-- Enable required extensions for SDLC.ai platform

-- Enable pgvector for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable timestamp handling
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enable full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable additional string functions
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Create custom vector similarity operators
CREATE OR REPLACE FUNCTION vector_cosine_similarity(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN 1 - (vec1 <=> vec2);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Create vector distance function
CREATE OR REPLACE FUNCTION vector_distance(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN vec1 <=> vec2;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Create vector aggregation functions for batch operations
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

-- Grant usage of extensions to application role
GRANT USAGE ON SCHEMA vector TO app_user;
GRANT USAGE ON SCHEMA pgcrypto TO app_user;
