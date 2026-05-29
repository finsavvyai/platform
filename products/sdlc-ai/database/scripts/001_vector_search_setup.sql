-- Vector Search Configuration Script
-- Advanced pgvector setup for optimal vector search performance

BEGIN;

-- Enhanced vector similarity search functions
CREATE OR REPLACE FUNCTION vector_cosine_similarity_l2(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN 1 - (vec1 <=> vec2);
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION vector_l2_distance(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN vec1 <-> vec2;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION vector_inner_product(vec1 vector, vec2 vector)
RETURNS REAL AS $$
BEGIN
    RETURN vec1 <#> vec2;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Batch vector similarity search function
CREATE OR REPLACE FUNCTION batch_vector_similarity(
    query_vector vector,
    target_vectors vector[],
    distance_type TEXT DEFAULT 'cosine'
) RETURNS TABLE(idx INTEGER, similarity REAL, distance REAL) AS $$
DECLARE
    i INTEGER;
    vec vector;
    dist REAL;
    sim REAL;
BEGIN
    FOR i IN 1..array_length(target_vectors, 1) LOOP
        vec := target_vectors[i];

        CASE distance_type
            WHEN 'cosine' THEN
                dist := vec <=> query_vector;
                sim := 1 - dist;
            WHEN 'l2' THEN
                dist := (vec <-> query_vector);
                sim := 1 / (1 + dist); -- Convert to similarity
            WHEN 'inner_product' THEN
                dist := vec <#> query_vector;
                sim := -dist; -- Inner product (negative for distance)
            ELSE
                RAISE EXCEPTION 'Unknown distance type: %', distance_type;
        END CASE;

        idx := i;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Advanced vector search with filters
CREATE OR REPLACE FUNCTION search_documents_with_vector(
    query_vector vector,
    tenant_id_param UUID,
    search_filters JSONB DEFAULT '{}',
    limit_count INTEGER DEFAULT 10,
    distance_type TEXT DEFAULT 'cosine',
    similarity_threshold REAL DEFAULT 0.7
) RETURNS TABLE(
    document_id UUID,
    chunk_id UUID,
    content TEXT,
    similarity_score REAL,
    distance REAL,
    metadata JSONB
) AS $$
DECLARE
    distance_sql TEXT;
BEGIN
    -- Build distance query based on type
    CASE distance_type
        WHEN 'cosine' THEN
            distance_sql := 'embedding <=> query_vector';
        WHEN 'l2' THEN
            distance_sql := 'embedding <-> query_vector';
        WHEN 'inner_product' THEN
            distance_sql := 'embedding <#> query_vector';
        ELSE
            RAISE EXCEPTION 'Unknown distance type: %', distance_type;
    END CASE;

    -- Build dynamic query
    RETURN QUERY EXECUTE format('
        SELECT
            dc.document_id,
            dc.id as chunk_id,
            dc.content,
            (1 - (%s)) as similarity_score,
            (%s) as distance,
            dc.metadata
        FROM document_chunks dc
        WHERE dc.tenant_id = %L
        AND dc.embedding_status = ''completed''
        AND dc.embedding IS NOT NULL
        AND (1 - (%s)) >= %s
        %s
        ORDER BY (%s)
        LIMIT %s
    ',
        distance_sql,
        distance_sql,
        tenant_id_param,
        distance_sql,
        similarity_threshold,
        CASE
            WHEN search_filters IS NOT NULL AND jsonb_typeof(search_filters) = 'object'
            THEN format('AND (metadata @> %L OR dc.metadata @> %L)', search_filters, search_filters)
            ELSE ''
        END,
        distance_sql,
        limit_count
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hybrid search combining vector similarity and keyword search
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_text TEXT,
    query_vector vector,
    tenant_id_param UUID,
    vector_weight REAL DEFAULT 0.7,
    keyword_weight REAL DEFAULT 0.2,
    recency_weight REAL DEFAULT 0.1,
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE(
    document_id UUID,
    chunk_id UUID,
    content TEXT,
    vector_score REAL,
    keyword_score REAL,
    recency_score REAL,
    final_score REAL,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            dc.id,
            dc.document_id,
            dc.content,
            dc.metadata,
            dc.created_at,
            (1 - (dc.embedding <=> query_vector)) as vector_similarity
        FROM document_chunks dc
        WHERE dc.tenant_id = tenant_id_param
        AND dc.embedding_status = 'completed'
        AND dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> query_vector
        LIMIT limit_count * 2
    ),
    keyword_search AS (
        SELECT
            dc.id,
            (CASE
                WHEN dc.content ILIKE '%' || query_text || '%' THEN 1.0
                WHEN to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text) THEN 0.8
                ELSE 0.0
            END) as keyword_score
        FROM document_chunks dc
        WHERE dc.tenant_id = tenant_id_param
        AND (dc.content ILIKE '%' || query_text || '%' OR to_tsvector('english', dc.content) @@ plainto_tsquery('english', query_text))
    ),
    recency_scores AS (
        SELECT
            vs.id,
            EXTRACT(EPOCH FROM (NOW() - vs.created_at)) / (30 * 24 * 3600) as days_ago,
            CASE
                WHEN vs.created_at > NOW() - INTERVAL '7 days' THEN 1.0
                WHEN vs.created_at > NOW() - INTERVAL '30 days' THEN 0.7
                WHEN vs.created_at > NOW() - INTERVAL '90 days' THEN 0.4
                ELSE 0.1
            END as recency_score
        FROM vector_search vs
    )
    SELECT
        vs.document_id,
        vs.id as chunk_id,
        vs.content,
        vs.vector_similarity as vector_score,
        COALESCE(ks.keyword_score, 0.0) as keyword_score,
        rs.recency_score,
        (vs.vector_similarity * vector_weight +
         COALESCE(ks.keyword_score, 0.0) * keyword_weight +
         rs.recency_score * recency_weight) as final_score,
        vs.metadata
    FROM vector_search vs
    LEFT JOIN keyword_search ks ON vs.id = ks.id
    LEFT JOIN recency_scores rs ON vs.id = rs.id
    ORDER BY final_score DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vector aggregation for clustering
CREATE OR REPLACE FUNCTION cluster_vectors(
    vectors vector[],
    num_clusters INTEGER DEFAULT 5
) RETURNS TABLE(cluster_id INTEGER, vector vector, members INTEGER[]) AS $$
DECLARE
    i INTEGER;
    j INTEGER;
    current_vector vector;
    min_distance REAL;
    best_cluster INTEGER;
    cluster_centers vector[];
    cluster_assignments INTEGER[];
    iterations INTEGER := 10;
BEGIN
    -- Initialize random cluster centers
    cluster_centers := ARRAY[
        vectors[1], -- First vector as first center
        vectors[CEIL(array_length(vectors, 1) / 2)::INTEGER], -- Middle vector
        vectors[array_length(vectors, 1)] -- Last vector
    ];

    -- K-means clustering (simplified)
    FOR iteration IN 1..iterations LOOP
        cluster_assignments := '{}';

        -- Assign each vector to nearest cluster
        FOR i IN 1..array_length(vectors, 1) LOOP
            current_vector := vectors[i];
            min_distance := 999999;
            best_cluster := 1;

            FOR j IN 1..array_length(cluster_centers, 1) LOOP
                IF (current_vector <=> cluster_centers[j]) < min_distance THEN
                    min_distance := current_vector <=> cluster_centers[j];
                    best_cluster := j;
                END IF;
            END LOOP;

            cluster_assignments := array_append(cluster_assignments, best_cluster);
        END LOOP;

        -- Update cluster centers (simplified - would need proper averaging in production)
        -- This is a placeholder implementation
    END LOOP;

    -- Return results
    FOR j IN 1..array_length(cluster_centers, 1) LOOP
        cluster_id := j;
        vector := cluster_centers[j];
        members := '{}';

        -- Find all vectors in this cluster
        FOR i IN 1..array_length(cluster_assignments, 1) LOOP
            IF cluster_assignments[i] = j THEN
                members := array_append(members, i);
            END IF;
        END LOOP;

        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Vector index maintenance function
CREATE OR REPLACE FUNCTION maintain_vector_indexes()
RETURNS void AS $$
DECLARE
    index_name TEXT;
    index_size BIGINT;
    total_rows BIGINT;
BEGIN
    -- Check vector index health
    FOR index_name IN
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'document_chunks'
        AND indexname LIKE '%embedding%'
    LOOP
        -- Get index statistics
        SELECT pg_relation_size(indexname::regclass) INTO index_size;
        SELECT COUNT(*) INTO total_rows FROM document_chunks;

        IF index_size > 0 THEN
            RAISE NOTICE 'Vector index %: Size=% MB, Rows=%, Efficiency=%.2f rows/MB',
                index_name,
                ROUND(index_size / 1024.0 / 1024.0, 2),
                total_rows,
                CASE WHEN index_size > 0 THEN total_rows::REAL / (index_size / 1024.0 / 1024.0) ELSE 0 END;
        END IF;
    END LOOP;

    -- Trigger ANALYZE to update statistics
    ANALYZE document_chunks;
END;
$$ LANGUAGE plpgsql;

-- Vector search performance monitoring
CREATE OR REPLACE FUNCTION monitor_vector_search_performance()
RETURNS TABLE(
    search_type TEXT,
    avg_duration_ms REAL,
    total_searches BIGINT,
    slow_searches BIGINT,
    avg_result_count REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        'vector_semantic'::TEXT,
        AVG(search_duration_ms)::REAL,
        COUNT(*)::BIGINT,
        COUNT(CASE WHEN search_duration_ms > 1000 THEN 1 END)::BIGINT,
        AVG(results_count)::REAL
    FROM vector_search_logs
    WHERE search_type = 'semantic'
    AND created_at > NOW() - INTERVAL '24 hours'

    UNION ALL

    SELECT
        'vector_keyword'::TEXT,
        AVG(search_duration_ms)::REAL,
        COUNT(*)::BIGINT,
        COUNT(CASE WHEN search_duration_ms > 1000 THEN 1 END)::BIGINT,
        AVG(results_count)::REAL
    FROM vector_search_logs
    WHERE search_type = 'keyword'
    AND created_at > NOW() - INTERVAL '24 hours'

    UNION ALL

    SELECT
        'vector_hybrid'::TEXT,
        AVG(search_duration_ms)::REAL,
        COUNT(*)::BIGINT,
        COUNT(CASE WHEN search_duration_ms > 1000 THEN 1 END)::BIGINT,
        AVG(results_count)::REAL
    FROM vector_search_logs
    WHERE search_type = 'hybrid'
    AND created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create view for vector search monitoring
CREATE VIEW vector_search_metrics AS
SELECT * FROM monitor_vector_search_performance();

-- Create function to optimize vector search parameters
CREATE OR REPLACE FUNCTION optimize_vector_search_parameters()
RETURNS TABLE(
    parameter TEXT,
    current_value TEXT,
    recommended_value TEXT,
    reason TEXT
) AS $$
DECLARE
    avg_search_time REAL;
    total_searches BIGINT;
    index_efficiency REAL;
BEGIN
    -- Get current performance metrics
    SELECT AVG(search_duration_ms), COUNT(*) INTO avg_search_time, total_searches
    FROM vector_search_logs
    WHERE created_at > NOW() - INTERVAL '24 hours';

    -- Analyze and provide recommendations
    IF avg_search_time > 500 THEN
        RETURN QUERY SELECT
            'hnsw_ef_search'::TEXT,
            'default'::TEXT,
            '128'::TEXT,
            'High search latency detected. Increase ef_search for better recall at cost of speed.'::TEXT;
    END IF;

    IF total_searches > 10000 THEN
        RETURN QUERY SELECT
            'hnsw_m'::TEXT,
            '16'::TEXT,
            '32'::TEXT,
            'High search volume detected. Increase m for better index quality.'::TEXT;
    END IF;

    -- Add more optimization logic based on actual usage patterns
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_documents_with_vector(vector, UUID, JSONB, INTEGER, TEXT, REAL) TO app_user;
GRANT EXECUTE ON FUNCTION hybrid_search_documents(TEXT, vector, UUID, REAL, REAL, REAL, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION batch_vector_similarity(vector, vector[], TEXT) TO app_user;
GRANT EXECUTE ON FUNCTION maintain_vector_indexes() TO app_user;
GRANT SELECT ON vector_search_metrics TO app_user;
GRANT SELECT ON optimize_vector_search_parameters() TO app_user;

COMMIT;
