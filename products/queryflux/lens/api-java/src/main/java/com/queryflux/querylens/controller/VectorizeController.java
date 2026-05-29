package com.queryflux.querylens.controller;

import com.queryflux.querylens.dto.NlpQueryRequest;
import com.queryflux.querylens.service.SchemaIndexerService;
import com.queryflux.querylens.service.VectorizeClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Controller for Vectorize schema indexing and search
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vectorize")
@RequiredArgsConstructor
public class VectorizeController {

    private final SchemaIndexerService schemaIndexerService;
    private final VectorizeClient vectorizeClient;

    /**
     * Health check for Vectorize worker
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        boolean healthy = vectorizeClient.healthCheck();

        return ResponseEntity.ok(Map.of(
            "status", healthy ? "healthy" : "unhealthy",
            "worker", vectorizeClient.toString(),
            "timestamp", System.currentTimeMillis()
        ));
    }

    /**
     * Index a database schema
     */
    @PostMapping("/index")
    public ResponseEntity<Map<String, Object>> indexSchema(@RequestBody Map<String, Object> request) {
        String database = (String) request.get("database");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tablesData = (List<Map<String, Object>>) request.get("tables");

        if (database == null || tablesData == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "database and tables are required"
            ));
        }

        // Convert to SchemaTable list
        List<VectorizeClient.SchemaTable> tables = tablesData.stream()
            .map(tableData -> {
                String name = (String) tableData.get("name");
                String description = (String) tableData.getOrDefault("description", "");
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> columnsData = (List<Map<String, Object>>) tableData.get("columns");

                List<VectorizeClient.SchemaColumn> columns = columnsData != null
                    ? columnsData.stream()
                        .map(colData -> new VectorizeClient.SchemaColumn(
                            (String) colData.get("name"),
                            (String) colData.get("type"),
                            (String) colData.getOrDefault("description", "")
                        ))
                        .toList()
                    : List.of();

                return new VectorizeClient.SchemaTable(name, description, columns);
            })
            .toList();

        var result = vectorizeClient.indexSchema(database, tables);

        return ResponseEntity.ok(Map.of(
            "success", result.success(),
            "message", result.message(),
            "vectorCount", result.count(),
            "mutationId", result.mutationId(),
            "database", database
        ));
    }

    /**
     * Get indexed databases
     */
    @GetMapping("/indexed")
    public ResponseEntity<List<SchemaIndexerService.IndexedDatabase>> getIndexedDatabases() {
        return ResponseEntity.ok(schemaIndexerService.getIndexedDatabases());
    }

    /**
     * Search for similar schema elements
     */
    @PostMapping("/search")
    public ResponseEntity<VectorizeClient.SearchResponse> search(
            @RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");
        Integer topK = (Integer) request.getOrDefault("topK", 5);

        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(
                new VectorizeClient.SearchResponse(List.of(), "", 0)
            );
        }

        var result = vectorizeClient.search(query, topK);
        return ResponseEntity.ok(result);
    }

    /**
     * Get schema context for a query
     */
    @PostMapping("/context")
    public ResponseEntity<VectorizeClient.SchemaContext> getSchemaContext(
            @RequestBody Map<String, Object> request) {
        String query = (String) request.get("query");

        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(
                new VectorizeClient.SchemaContext("", List.of(), List.of())
            );
        }

        var context = schemaIndexerService.getRelevantSchema(query);
        return ResponseEntity.ok(context);
    }

    /**
     * Re-index a database
     */
    @PostMapping("/reindex/{database}")
    public ResponseEntity<Map<String, Object>> reindex(
            @PathVariable String database,
            @RequestBody NlpQueryRequest body) {

        if (body.getSchema() == null || body.getSchema().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", "schema is required"
            ));
        }

        var result = schemaIndexerService.reindex(database, body);

        return ResponseEntity.ok(Map.of(
            "success", result.success(),
            "message", result.message(),
            "vectorCount", result.vectorCount(),
            "database", database
        ));
    }

    /**
     * Delete all vectors for a database
     */
    @DeleteMapping("/{database}")
    public ResponseEntity<Map<String, Object>> deleteDatabase(@PathVariable String database) {
        var del = vectorizeClient.deleteDatabase(database);
        if (del.success()) {
            schemaIndexerService.forgetDatabase(database);
        }
        return ResponseEntity.ok(Map.of(
            "success", del.success(),
            "deleted", del.deletedCount(),
            "message", del.message(),
            "database", database
        ));
    }
}
