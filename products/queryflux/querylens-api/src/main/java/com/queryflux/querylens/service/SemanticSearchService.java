package com.queryflux.querylens.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Semantic schema discovery via Cloudflare Vectorize.
 *
 * Filters raw vector matches by a cosine-similarity threshold and returns
 * the top-N most relevant tables to include in the GPT-4 prompt. When the
 * Vectorize worker is unavailable the service falls back to the full schema
 * supplied in the request.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SemanticSearchService {

    private final VectorizeClient vectorizeClient;

    @Value("${vectorize.similarity.threshold:0.78}")
    private double similarityThreshold;

    @Value("${vectorize.search.topK:10}")
    private int searchTopK;

    @Value("${vectorize.search.maxTables:5}")
    private int maxTables;

    /**
     * Result of a semantic schema lookup.
     *
     * @param available     Whether vectorize returned any usable matches
     * @param relevantTables Distinct table names above the threshold, ordered by score
     * @param schemaContext  Human-readable schema snippet ready for GPT-4
     */
    public record SemanticContext(
        boolean available,
        List<String> relevantTables,
        String schemaContext
    ) {}

    /**
     * Discover the most relevant tables for a natural-language question.
     *
     * @param question   The user's NL question
     * @param database   Optional database identifier for namespace filtering
     * @return SemanticContext with relevant tables and formatted schema string
     */
    public SemanticContext findRelevantSchema(String question, String database) {
        log.debug("Semantic search for: '{}' (db={})", question, database);

        VectorizeClient.SearchResponse response;
        try {
            response = vectorizeClient.search(question, searchTopK);
        } catch (Exception e) {
            log.warn("Vectorize search failed, falling back to full schema: {}", e.getMessage());
            return new SemanticContext(false, List.of(), "");
        }

        if (response == null || response.matches() == null || response.matches().isEmpty()) {
            log.debug("No vector matches returned");
            return new SemanticContext(false, List.of(), "");
        }

        // Collect unique tables above threshold, capped at maxTables
        Map<String, Double> tableScores = new LinkedHashMap<>();
        List<VectorizeClient.Match> columnMatches = new ArrayList<>();

        for (VectorizeClient.Match match : response.matches()) {
            if (match.score() < similarityThreshold) {
                continue;
            }
            String type = (String) match.metadata().getOrDefault("type", "");
            String matchDb = (String) match.metadata().getOrDefault("database", "");

            // Namespace filter: skip mismatched database if one is specified
            if (database != null && !database.isBlank()
                    && !matchDb.isBlank() && !matchDb.equals(database)) {
                continue;
            }

            if ("table".equals(type)) {
                String tableName = (String) match.metadata().getOrDefault("tableName", "");
                if (!tableName.isBlank()) {
                    tableScores.merge(tableName, match.score(), Math::max);
                }
            } else if ("column".equals(type)) {
                columnMatches.add(match);
            }
        }

        if (tableScores.isEmpty()) {
            log.debug("No tables above threshold {}", similarityThreshold);
            return new SemanticContext(false, List.of(), "");
        }

        // Sort by score desc, cap at maxTables
        List<String> relevantTables = tableScores.entrySet().stream()
            .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
            .limit(maxTables)
            .map(Map.Entry::getKey)
            .toList();

        String context = buildSchemaContext(relevantTables, columnMatches, response.matches());

        log.info("Semantic search found {} relevant tables for '{}': {}",
            relevantTables.size(), question, relevantTables);

        return new SemanticContext(true, relevantTables, context);
    }

    /**
     * Convenience overload without database scoping.
     */
    public SemanticContext findRelevantSchema(String question) {
        return findRelevantSchema(question, null);
    }

    /**
     * Build a compact schema description from vector metadata.
     */
    private String buildSchemaContext(
            List<String> relevantTables,
            List<VectorizeClient.Match> columnMatches,
            List<VectorizeClient.Match> allMatches) {

        // Group columns by table name
        Map<String, List<String>> colsByTable = new LinkedHashMap<>();
        for (String table : relevantTables) {
            colsByTable.put(table, new ArrayList<>());
        }

        for (VectorizeClient.Match match : columnMatches) {
            String table = (String) match.metadata().getOrDefault("tableName", "");
            String col   = (String) match.metadata().getOrDefault("columnName", "");
            String type  = (String) match.metadata().getOrDefault("columnType", "");
            if (colsByTable.containsKey(table) && !col.isBlank()) {
                colsByTable.get(table).add(col + (type.isBlank() ? "" : " " + type));
            }
        }

        // Also pull columns listed in table-level metadata
        for (VectorizeClient.Match match : allMatches) {
            String mType = (String) match.metadata().getOrDefault("type", "");
            if (!"table".equals(mType)) continue;
            String table = (String) match.metadata().getOrDefault("tableName", "");
            if (!colsByTable.containsKey(table)) continue;
            Object cols = match.metadata().get("columns");
            if (cols instanceof List<?> list) {
                for (Object c : list) {
                    String colName = c.toString();
                    if (colsByTable.get(table).stream().noneMatch(e -> e.startsWith(colName))) {
                        colsByTable.get(table).add(colName);
                    }
                }
            }
        }

        // Format
        StringBuilder sb = new StringBuilder("Relevant tables (semantic match):\n");
        for (Map.Entry<String, List<String>> entry : colsByTable.entrySet()) {
            String cols = entry.getValue().isEmpty() ? "..." : String.join(", ", entry.getValue());
            sb.append("  ").append(entry.getKey()).append("(").append(cols).append(")\n");
        }
        return sb.toString().trim();
    }
}
