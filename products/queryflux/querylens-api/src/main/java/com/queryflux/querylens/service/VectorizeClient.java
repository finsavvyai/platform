package com.queryflux.querylens.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Client for Cloudflare Worker that manages Vectorize schema embeddings.
 *
 * This service communicates with the querylens-vectorize-worker deployed on
 * Cloudflare Workers to:
 * - Index database schemas (tables, columns)
 * - Search for similar schema elements using semantic search
 * - Manage vector embeddings
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VectorizeClient {

    private final RestTemplate restTemplate;

    @Value("${vectorize.worker.url:https://querylens-vectorize-worker.workers.dev}")
    private String workerUrl;

    @Value("${vectorize.ingress-secret:}")
    private String vectorizeIngressSecret;

    private void applyIngress(HttpHeaders headers) {
        if (vectorizeIngressSecret != null && !vectorizeIngressSecret.isBlank()) {
            headers.set("X-Vectorize-Ingress-Secret", vectorizeIngressSecret);
        }
    }
    public record EmbeddingItem(
        String id,
        String text,
        String type,
        Map<String, Object> metadata
    ) {
        public EmbeddingItem {
            if (metadata == null) {
                metadata = new HashMap<>();
            }
        }
    }

    /**
     * Search result match
     */
    public record Match(
        String id,
        double score,
        Map<String, Object> metadata
    ) {}

    /**
     * Search response
     */
    public record SearchResponse(
        List<Match> matches,
        String query,
        int count
    ) {}

    /**
     * Insert response
     */
    public record InsertResponse(
        boolean success,
        String mutationId,
        int count,
        String message
    ) {}

    public record DeleteResult(
        boolean success,
        int deletedCount,
        String message
    ) {}

    /**
     * Schema table definition
     */
    public record SchemaTable(
        String name,
        String description,
        List<SchemaColumn> columns
    ) {}

    /**
     * Schema column definition
     */
    public record SchemaColumn(
        String name,
        String type,
        String description
    ) {}

    /**
     * Index a complete database schema
     *
     * @param database Database name
     * @param tables List of tables with columns
     * @return Insert response with mutation ID
     */
    public InsertResponse indexSchema(String database, List<SchemaTable> tables) {
        log.info("Indexing schema for database: {} with {} tables", database, tables.size());

        Map<String, Object> request = new HashMap<>();
        request.put("database", database);
        request.put("tables", tables);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        applyIngress(headers);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

        try {
            InsertResponse response = restTemplate.postForObject(
                workerUrl + "/schema",
                entity,
                InsertResponse.class
            );

            log.info("Schema indexed: {} vectors, mutationId: {}",
                response != null ? response.count() : 0,
                response != null ? response.mutationId() : "null");

            return response != null ? response : new InsertResponse(false, "", 0, "No response");

        } catch (Exception e) {
            log.error("Failed to index schema", e);
            return new InsertResponse(false, "", 0, e.getMessage());
        }
    }

    /**
     * Insert single embedding
     *
     * @param item Embedding item with id, text, type, and metadata
     * @return Insert response
     */
    public InsertResponse insertEmbedding(EmbeddingItem item) {
        return insertEmbeddings(List.of(item));
    }

    /**
     * Insert multiple embeddings
     *
     * @param items List of embedding items
     * @return Insert response
     */
    public InsertResponse insertEmbeddings(List<EmbeddingItem> items) {
        log.debug("Inserting {} embeddings", items.size());

        Map<String, Object> request = new HashMap<>();
        request.put("items", items);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        applyIngress(headers);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

        try {
            InsertResponse response = restTemplate.postForObject(
                workerUrl + "/embeddings",
                entity,
                InsertResponse.class
            );

            return response != null ? response : new InsertResponse(false, "", 0, "No response");

        } catch (Exception e) {
            log.error("Failed to insert embeddings", e);
            return new InsertResponse(false, "", 0, e.getMessage());
        }
    }

    /**
     * Search for similar schema elements
     *
     * @param query Natural language query
     * @param topK Number of results to return (default: 5)
     * @return Search response with matches
     */
    public SearchResponse search(String query, int topK) {
        log.debug("Searching for: {} (topK: {})", query, topK);

        Map<String, Object> request = new HashMap<>();
        request.put("query", query);
        request.put("topK", topK);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        applyIngress(headers);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

        try {
            SearchResponse response = restTemplate.postForObject(
                workerUrl + "/search",
                entity,
                SearchResponse.class
            );

            return response != null ? response : new SearchResponse(List.of(), query, 0);

        } catch (Exception e) {
            log.error("Search failed for query: {}", query, e);
            return new SearchResponse(List.of(), query, 0);
        }
    }

    /**
     * Search with default topK=5
     */
    public SearchResponse search(String query) {
        return search(query, 5);
    }

    /**
     * Health check for Vectorize worker
     */
    public boolean healthCheck() {
        try {
            HttpHeaders headers = new HttpHeaders();
            applyIngress(headers);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                workerUrl + "/health",
                HttpMethod.GET,
                entity,
                Map.class
            );
            Map<?, ?> body = response.getBody();
            return body != null && "healthy".equals(body.get("status"));
        } catch (Exception e) {
            log.error("Vectorize worker health check failed", e);
            return false;
        }
    }

    /**
     * Delete all vectors for a database prefix (worker implements best-effort list + delete).
     */
    public DeleteResult deleteDatabase(String database) {
        try {
            HttpHeaders headers = new HttpHeaders();
            applyIngress(headers);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                workerUrl + "/schema/database/" + URLEncoder.encode(database, StandardCharsets.UTF_8),
                HttpMethod.DELETE,
                entity,
                Map.class
            );
            Map<?, ?> body = response.getBody();
            int deleted = body != null && body.get("deleted") instanceof Number n ? n.intValue() : 0;
            return new DeleteResult(true, deleted, body != null ? String.valueOf(body.get("message")) : "ok");
        } catch (Exception e) {
            log.error("deleteDatabase failed for {}", database, e);
            return new DeleteResult(false, 0, e.getMessage());
        }
    }

    /**
     * Get schema context for a natural language query
     * Returns relevant tables and columns based on semantic search
     */
    public SchemaContext getSchemaContext(String query, String database) {
        SearchResponse response = search(query, 10);

        List<Match> relevantTables = new ArrayList<>();
        List<Match> relevantColumns = new ArrayList<>();

        for (Match match : response.matches()) {
            String type = (String) match.metadata().get("type");

            if ("table".equals(type)) {
                relevantTables.add(match);
            } else if ("column".equals(type)) {
                relevantColumns.add(match);
            }
        }

        log.info("Found {} relevant tables, {} relevant columns for query: {}",
            relevantTables.size(), relevantColumns.size(), query);

        return new SchemaContext(query, relevantTables, relevantColumns);
    }

    /**
     * Schema context with relevant elements
     */
    public record SchemaContext(
        String query,
        List<Match> relevantTables,
        List<Match> relevantColumns
    ) {}
}
