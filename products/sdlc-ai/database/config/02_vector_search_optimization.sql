-- Vector Search Optimization and Configuration
-- Advanced configuration for pgvector extension and vector search performance

-- Vector search configuration
-- Configure HNSW index parameters for optimal performance
-- These settings balance between search speed and index build time/memory

-- Create vector index configuration functions
CREATE OR REPLACE FUNCTION create_optimized_vector_index(
    table_name TEXT,
    column_name TEXT,
    dimensions INTEGER DEFAULT 1536,
    m_param INTEGER DEFAULT 16,
    ef_construction INTEGER DEFAULT 64,
    ef_search INTEGER DEFAULT 40
) RETURNS void AS $$
BEGIN
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_%s_vector ON %I USING hnsw (%I vector_cosine_ops) WITH (m = %s, ef_construction = %s)',
                   table_name, column_name, table_name, column_name, m_param, ef_construction);

    -- Set search parameters
    EXECUTE 'SET hnsw.ef_search = ' || ef_search;

    -- Log index creation
    INSERT INTO audit_logs (
        tenant_id,
        action,
        resource_type,
        resource_id,
        details,
        metadata
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', -- System tenant
        'create',
        'vector_index',
        gen_random_uuid(),
        jsonb_build_object(
            'table', table_name,
            'column', column_name,
            'dimensions', dimensions,
            'm_param', m_param,
            'ef_construction', ef_construction,
            'ef_search', ef_search
        ),
        jsonb_build_object('system_operation', true, 'timestamp', NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vector search performance monitoring view
CREATE OR REPLACE VIEW vector_search_performance AS
SELECT
    'index_stats' as metric_type,
    schemaname,
    tablename,
    indexname,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE
        WHEN idx_scan = 0 THEN 'Unused'
        WHEN idx_scan < 100 THEN 'Low Usage'
        WHEN idx_scan < 1000 THEN 'Medium Usage'
        ELSE 'High Usage'
    END as usage_level
FROM pg_stat_user_indexes
WHERE indexdef LIKE '%hnsw%' OR indexdef LIKE '%vector_cosine_ops%'

UNION ALL

SELECT
    'table_stats' as metric_type,
    schemaname,
    tablename,
    'table' as indexname,
    seq_tup_read as tuples_read,
    seq_tup_fetch as tuples_fetched,
    seq_scan as table_scans,
    pg_size_pretty(pg_relation_size(oid)) as table_size,
    'N/A' as usage_level
FROM pg_stat_user_tables
WHERE tablename IN ('document_chunks', 'vector_search_logs');

-- Vector similarity search optimization function
CREATE OR REPLACE FUNCTION optimized_vector_search(
    query_vector VECTOR,
    target_table TEXT DEFAULT 'document_chunks',
    tenant_id_param UUID DEFAULT NULL,
    similarity_threshold REAL DEFAULT 0.7,
    max_results INTEGER DEFAULT 10,
    filters JSONB DEFAULT '{}'
) RETURNS TABLE(
    chunk_id UUID,
    document_id UUID,
    tenant_id UUID,
    content TEXT,
    similarity_score REAL,
    metadata JSONB,
    rank INTEGER
) AS $$
DECLARE
    sql_query TEXT;
    result RECORD;
    rank_counter INTEGER := 1;
BEGIN
    -- Build dynamic SQL query based on parameters
    sql_query := format('
        WITH vector_search AS (
            SELECT
                id,
                document_id,
                tenant_id,
                content,
                metadata,
                1 - (embedding <=> $1) as similarity_score
            FROM %I
            WHERE embedding IS NOT NULL
            AND 1 - (embedding <=> $1) >= $2
            %s
            ORDER BY embedding <=> $1
            LIMIT $3
        )
        SELECT
            id,
            document_id,
            tenant_id,
            content,
            similarity_score,
            metadata,
            ROW_NUMBER() OVER (ORDER BY similarity_score DESC) as rank
        FROM vector_search
        ORDER BY similarity_score DESC',
        target_table,
        CASE
            WHEN tenant_id_param IS NOT NULL THEN 'AND tenant_id = $4'
            ELSE ''
        END
    );

    -- Execute the query with appropriate parameters
    IF tenant_id_param IS NOT NULL THEN
        FOR result IN EXECUTE sql_query
            USING query_vector, similarity_threshold, max_results, tenant_id_param
        LOOP
            chunk_id := result.id;
            document_id := result.document_id;
            tenant_id := result.tenant_id;
            content := result.content;
            similarity_score := result.similarity_score;
            metadata := result.metadata;
            rank := result.rank;
            RETURN NEXT;
        END LOOP;
    ELSE
        FOR result IN EXECUTE sql_query
            USING query_vector, similarity_threshold, max_results
        LOOP
            chunk_id := result.id;
            document_id := result.document_id;
            tenant_id := result.tenant_id;
            content := result.content;
            similarity_score := result.similarity_score;
            metadata := result.metadata;
            rank := result.rank;
            RETURN NEXT;
        END LOOP;
    END IF;

    -- Log the search for analytics
    INSERT INTO vector_search_logs (
        tenant_id,
        user_id,
        query_text,
        query_vector_model,
        search_type,
        filters_applied,
        results_count,
        search_duration_ms,
        query_embedding,
        similarity_threshold,
        max_results,
        search_strategy,
        metadata
    ) VALUES (
        COALESCE(current_setting('app.current_tenant_id', true)::UUID, tenant_id_param),
        current_setting('app.current_user_id', true)::UUID,
        'Vector search query',
        'optimized_vector_search',
        'semantic',
        filters,
        (SELECT count(*) FROM (RETURN QUERY SELECT 1 LIMIT 1) AS subq),
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - clock_timestamp()))::INTEGER, -- This will be updated by the application
        query_vector,
        similarity_threshold,
        max_results,
        'hnsw',
        jsonb_build_object(
            'function', 'optimized_vector_search',
            'table', target_table,
            'timestamp', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Batch vector search for multiple queries
CREATE OR REPLACE FUNCTION batch_vector_search(
    query_vectors VECTOR[],
    target_table TEXT DEFAULT 'document_chunks',
    tenant_id_param UUID DEFAULT NULL,
    similarity_threshold REAL DEFAULT 0.7,
    max_results_per_query INTEGER DEFAULT 10
) RETURNS TABLE(
    query_index INTEGER,
    chunk_id UUID,
    document_id UUID,
    tenant_id UUID,
    content TEXT,
    similarity_score REAL,
    rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        q.index_number as query_index,
        vs.chunk_id,
        vs.document_id,
        vs.tenant_id,
        vs.content,
        vs.similarity_score,
        vs.rank
    FROM (
        SELECT
            generate_series(1, array_length(query_vectors, 1)) as index_number,
            unnest(query_vectors) as query_vector
    ) q
    CROSS JOIN LATERAL (
        SELECT
            dc.id as chunk_id,
            dc.document_id,
            dc.tenant_id,
            dc.content,
            1 - (dc.embedding <=> q.query_vector) as similarity_score,
            ROW_NUMBER() OVER (ORDER BY 1 - (dc.embedding <=> q.query_vector) DESC) as rank
        FROM document_chunks dc
        WHERE dc.embedding IS NOT NULL
        AND (tenant_id_param IS NULL OR dc.tenant_id = tenant_id_param)
        AND 1 - (dc.embedding <=> q.query_vector) >= similarity_threshold
        ORDER BY dc.embedding <=> q.query_vector
        LIMIT max_results_per_query
    ) vs
    WHERE vs.rank <= max_results_per_query
    ORDER BY q.index_number, vs.rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vector index maintenance function
CREATE OR REPLACE FUNCTION maintain_vector_indexes()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    index_stats RECORD;
    maintenance_actions JSONB := '[]'::JSONB;
BEGIN
    -- Check vector index health
    FOR index_stats IN
        SELECT
            schemaname,
            tablename,
            indexname,
            idx_scan,
            pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
            pg_relation_size(indexrelid) as index_size_bytes
        FROM pg_stat_user_indexes
        WHERE indexdef LIKE '%vector_cosine_ops%'
    LOOP
        -- Rebuild indexes that are getting too large or have low usage
        IF index_stats.idx_scan = 0 AND index_stats.index_size_bytes > 100 * 1024 * 1024 THEN -- 100MB
            -- Schedule index rebuild (this would typically be done during maintenance window)
            maintenance_actions := maintenance_actions || jsonb_build_object(
                'action', 'rebuild_index',
                'index', index_stats.indexname,
                'table', index_stats.tablename,
                'reason', 'Large unused index',
                'size', index_stats.index_size
            );
        END IF;
    END LOOP;

    -- Update statistics on vector tables
    ANALYZE document_chunks;
    ANALYZE vector_search_logs;

    result := jsonb_build_object(
        'timestamp', NOW(),
        'indexes_checked', (SELECT count(*) FROM pg_stat_user_indexes WHERE indexdef LIKE '%vector_cosine_ops%'),
        'tables_analyzed', 2,
        'maintenance_actions', maintenance_actions
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vector search quality metrics
CREATE OR REPLACE VIEW vector_search_quality_metrics AS
WITH search_quality AS (
    SELECT
        DATE_TRUNC('hour', created_at) as hour_bucket,
        COUNT(*) as total_searches,
        AVG(results_count) as avg_results_per_search,
        AVG(search_duration_ms) as avg_search_duration_ms,
        COUNT(CASE WHEN search_duration_ms > 1000 THEN 1 END) as slow_searches,
        COUNT(CASE WHEN results_count = 0 THEN 1 END) as zero_result_searches,
        COUNT(CASE WHEN cache_hit = true THEN 1 END) as cached_searches,
        AVG(similarity_threshold) as avg_similarity_threshold
    FROM vector_search_logs
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE_TRUNC('hour', created_at)
)
SELECT
    hour_bucket,
    total_searches,
    avg_results_per_search,
    avg_search_duration_ms,
    ROUND((slow_searches::NUMERIC / NULLIF(total_searches, 0)) * 100, 2) as slow_search_percentage,
    ROUND((zero_result_searches::NUMERIC / NULLIF(total_searches, 0)) * 100, 2) as zero_result_percentage,
    ROUND((cached_searches::NUMERIC / NULLIF(total_searches, 0)) * 100, 2) as cache_hit_rate,
    avg_similarity_threshold,
    CASE
        WHEN avg_search_duration_ms <= 100 THEN 'Excellent'
        WHEN avg_search_duration_ms <= 500 THEN 'Good'
        WHEN avg_search_duration_ms <= 1000 THEN 'Fair'
        ELSE 'Poor'
    END as performance_rating
FROM search_quality
ORDER BY hour_bucket DESC;

-- Vector embedding statistics
CREATE OR REPLACE VIEW vector_embedding_statistics AS
SELECT
    COUNT(*) as total_chunks,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as chunks_with_embeddings,
    COUNT(CASE WHEN embedding_status = 'completed' THEN 1 END) as completed_embeddings,
    COUNT(CASE WHEN embedding_status = 'pending' THEN 1 END) as pending_embeddings,
    COUNT(CASE WHEN embedding_status = 'failed' THEN 1 END) as failed_embeddings,
    COUNT(CASE WHEN embedding IS NOT NULL AND embedding_status = 'completed' THEN 1 END) as successfully_embedded,
    ROUND(
        (COUNT(CASE WHEN embedding IS NOT NULL AND embedding_status = 'completed' THEN 1 END)::NUMERIC /
         NULLIF(COUNT(*), 0)) * 100, 2
    ) as embedding_completion_percentage,
    AVG(embedding_dimensions) as avg_embedding_dimensions,
    pg_size_pretty(SUM(pg_column_size(embedding))) as total_embedding_size,
    embedding_model,
    COUNT(DISTINCT tenant_id) as tenants_with_embeddings
FROM document_chunks
WHERE deleted_at IS NULL
GROUP BY embedding_model;

-- Function to optimize vector search parameters
CREATE OR REPLACE FUNCTION optimize_vector_search_parameters()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    optimal_ef_search INTEGER;
    avg_query_time REAL;
    current_ef_search INTEGER;
BEGIN
    -- Analyze recent search performance to determine optimal ef_search parameter
    SELECT AVG(search_duration_ms) INTO avg_query_time
    FROM vector_search_logs
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    AND search_strategy = 'hnsw';

    -- Adjust ef_search based on average query time
    IF avg_query_time > 1000 THEN  -- If queries are taking more than 1 second
        optimal_ef_search := 20;  -- Reduce for speed
    ELSIF avg_query_time < 100 THEN  -- If queries are very fast
        optimal_ef_search := 60;  -- Increase for accuracy
    ELSE
        optimal_ef_search := 40;  -- Default balanced setting
    END IF;

    -- Get current setting
    current_ef_search := current_setting('hnsw.ef_search')::INTEGER;

    -- Apply new setting if different
    IF optimal_ef_search != current_ef_search THEN
        EXECUTE 'SET LOCAL hnsw.ef_search = ' || optimal_ef_search;
    END IF;

    result := jsonb_build_object(
        'avg_query_time_ms', avg_query_time,
        'current_ef_search', current_ef_search,
        'optimal_ef_search', optimal_ef_search,
        'parameter_changed', optimal_ef_search != current_ef_search,
        'timestamp', NOW()
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on vector optimization functions
GRANT EXECUTE ON FUNCTION create_optimized_vector_index(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION optimized_vector_search(VECTOR, TEXT, UUID, REAL, INTEGER, JSONB) TO app_user;
GRANT EXECUTE ON FUNCTION batch_vector_search(VECTOR[], TEXT, UUID, REAL, INTEGER) TO app_user;
GRANT EXECUTE ON FUNCTION maintain_vector_indexes() TO app_user;
GRANT EXECUTE ON FUNCTION optimize_vector_search_parameters() TO app_user;
GRANT SELECT ON vector_search_performance TO app_user;
GRANT SELECT ON vector_search_quality_metrics TO app_user;
GRANT SELECT ON vector_embedding_statistics TO app_user;

-- Create optimized vector indexes for the main document_chunks table
SELECT create_optimized_vector_index(
    'document_chunks',
    'embedding',
    1536,  -- OpenAI embedding dimensions
    16,     -- m parameter (connections per node)
    64,     -- ef_construction (build-time parameter)
    40      -- ef_search (search-time parameter)
);

-- Create vector index for search logs if they contain query embeddings
SELECT create_optimized_vector_index(
    'vector_search_logs',
    'query_embedding',
    1536,
    16,
    64,
    40
);
