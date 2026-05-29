package com.queryflux.querylens.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.queryflux.querylens.dto.NlpQueryRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for indexing database schemas into Vectorize.
 *
 * This service extracts schema information from connected databases
 * and generates embeddings for semantic search.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaIndexerService {

    private final VectorizeClient vectorizeClient;
    private final SchemaContextService schemaContextService;
    private final ObjectMapper objectMapper;

    // Track indexed databases
    private final Map<String, IndexedDatabase> indexedDatabases = new ConcurrentHashMap<>();

    public record IndexedDatabase(
        String name,
        int tableCount,
        int vectorCount,
        long indexedAt
    ) {}

    /**
     * Index a database schema from NlpQueryRequest
     *
     * @param request Request containing schema JSON
     * @return Indexing result
     */
    public IndexResult indexFromRequest(NlpQueryRequest request) {
        if (request.getSchema() == null || request.getSchema().isBlank()) {
            return new IndexResult(false, "No schema provided", 0, null);
        }

        try {
            // Parse schema JSON
            var schemaData = parseSchema(request.getSchema());

            // Extract database name
            String database = extractDatabaseName(schemaData);
            if (database == null) {
                database = "default";
            }

            // Convert to SchemaTable list
            List<VectorizeClient.SchemaTable> tables = extractTables(schemaData);

            // Index in Vectorize
            var response = vectorizeClient.indexSchema(database, tables);

            if (response.success()) {
                // Track indexed database
                indexedDatabases.put(database, new IndexedDatabase(
                    database,
                    tables.size(),
                    response.count(),
                    System.currentTimeMillis()
                ));

                log.info("Indexed schema: {} with {} tables, {} vectors",
                    database, tables.size(), response.count());

                return new IndexResult(
                    true,
                    response.message(),
                    response.count(),
                    response.mutationId()
                );
            } else {
                log.error("Failed to index schema: {}", response.message());
                return new IndexResult(false, response.message(), 0, null);
            }

        } catch (Exception e) {
            log.error("Error indexing schema", e);
            return new IndexResult(false, e.getMessage(), 0, null);
        }
    }

    /**
     * Get relevant schema context for a query using Vectorize search
     *
     * @param query Natural language query
     * @return Schema context with relevant tables and columns
     */
    public VectorizeClient.SchemaContext getRelevantSchema(String query) {
        return vectorizeClient.getSchemaContext(query, "default");
    }

    /**
     * Check if a database is indexed
     */
    public boolean isIndexed(String database) {
        return indexedDatabases.containsKey(database);
    }

    /**
     * Get all indexed databases
     */
    public List<IndexedDatabase> getIndexedDatabases() {
        return new ArrayList<>(indexedDatabases.values());
    }

    /**
     * Re-index a database (update embeddings)
     */
    public IndexResult reindex(String database, NlpQueryRequest request) {
        log.info("Re-indexing database: {}", database);
        indexedDatabases.remove(database);
        return indexFromRequest(request);
    }

    /**
     * Parse schema JSON string
     */
    private Map<String, Object> parseSchema(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(schemaJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse schema JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    /**
     * Extract database name from schema
     */
    private String extractDatabaseName(Map<String, Object> schema) {
        // Extract from schema structure
        Object databases = schema.get("databases");
        if (databases instanceof List<?> list && !list.isEmpty()) {
            Object firstDb = list.get(0);
            if (firstDb instanceof Map<?, ?> map) {
                return (String) map.get("name");
            }
        }
        return "default";
    }

    /**
     * Extract tables from schema
     */
    private List<VectorizeClient.SchemaTable> extractTables(Map<String, Object> schema) {
        List<VectorizeClient.SchemaTable> tables = new ArrayList<>();

        Object databases = schema.get("databases");
        if (databases instanceof List<?> dbs) {
            for (Object dbObj : dbs) {
                if (dbObj instanceof Map<?, ?> db) {
                    Object schemas = db.get("schemas");
                    if (schemas instanceof List<?> schemaList) {
                        for (Object schemaObj : schemaList) {
                            if (schemaObj instanceof Map<?, ?> sch) {
                                Object tableList = sch.get("tables");
                                if (tableList instanceof List<?> tbls) {
                                    for (Object tblObj : tbls) {
                                        if (tblObj instanceof Map<?, ?> tbl) {
                                            String tableName = (String) tbl.get("name");
                                            Object cols = tbl.get("columns");

                                            List<VectorizeClient.SchemaColumn> columns = new ArrayList<>();
                                            if (cols instanceof List<?> colList) {
                                                for (Object colObj : colList) {
                                                    if (colObj instanceof Map<?, ?> col) {
                                                        columns.add(new VectorizeClient.SchemaColumn(
                                                            (String) col.get("name"),
                                                            (String) col.get("type"),
                                                            "" // description - could add from metadata
                                                        ));
                                                    }
                                                }
                                            }

                                            tables.add(new VectorizeClient.SchemaTable(
                                                tableName,
                                                "", // description - could add from metadata
                                                columns
                                            ));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        return tables;
    }

    public void forgetDatabase(String database) {
        indexedDatabases.remove(database);
    }

    /**
     * Indexing result
     */
    public record IndexResult(
        boolean success,
        String message,
        int vectorCount,
        String mutationId
    ) {}
}
