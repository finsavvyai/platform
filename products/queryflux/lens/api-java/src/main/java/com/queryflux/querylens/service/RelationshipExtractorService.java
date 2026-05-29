package com.queryflux.querylens.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Extracts foreign-key relationships from a JSON schema and formats them
 * as a JOIN hint block for inclusion in the GPT-4 prompt.
 *
 * Schema JSON format understood:
 *   { "databases": [ { "schemas": [ { "tables": [ {
 *       "name": "orders",
 *       "columns": [ { "name": "user_id", "foreignKey": { "table": "users", "column": "id" } } ]
 *   } ] } ] } ] }
 *
 * Also handles flat format: { "tables": [...] }
 */
@Slf4j
@Service
public class RelationshipExtractorService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * A directed FK relationship: fromTable.fromColumn → toTable.toColumn
     */
    public record Relationship(
        String fromTable,
        String fromColumn,
        String toTable,
        String toColumn
    ) {
        @Override
        public String toString() {
            return fromTable + "." + fromColumn + " → " + toTable + "." + toColumn;
        }
    }

    /**
     * Extraction result.
     */
    public record RelationshipGraph(
        List<Relationship> relationships,
        String joinHints
    ) {
        public boolean hasRelationships() {
            return !relationships.isEmpty();
        }
    }

    /**
     * Parse the schema JSON and extract all FK relationships.
     *
     * @param schemaJson Raw schema JSON string
     * @return RelationshipGraph with relationships and a formatted JOIN-hint block
     */
    public RelationshipGraph extract(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) {
            return new RelationshipGraph(List.of(), "");
        }

        try {
            JsonNode root = objectMapper.readTree(schemaJson);
            List<Relationship> rels = new ArrayList<>();
            extractFromNode(root, rels);
            String hints = buildJoinHints(rels);
            log.debug("Extracted {} FK relationships from schema", rels.size());
            return new RelationshipGraph(List.copyOf(rels), hints);
        } catch (Exception e) {
            log.warn("Failed to parse schema for relationships: {}", e.getMessage());
            return new RelationshipGraph(List.of(), "");
        }
    }

    // ── Traversal ─────────────────────────────────────────────────────────────

    private void extractFromNode(JsonNode root, List<Relationship> out) {
        if (root.has("databases")) {
            for (JsonNode db : root.get("databases")) {
                if (db.has("schemas")) {
                    for (JsonNode schema : db.get("schemas")) {
                        extractFromTablesNode(schema.path("tables"), out);
                    }
                } else if (db.has("tables")) {
                    extractFromTablesNode(db.get("tables"), out);
                }
            }
        } else if (root.has("tables")) {
            extractFromTablesNode(root.get("tables"), out);
        } else if (root.isArray()) {
            extractFromTablesNode(root, out);
        }
    }

    private void extractFromTablesNode(JsonNode tables, List<Relationship> out) {
        if (tables == null || !tables.isArray()) return;

        for (JsonNode table : tables) {
            String tableName = table.path("name").asText("");
            if (tableName.isBlank()) continue;

            JsonNode columns = table.path("columns");
            if (!columns.isArray()) continue;

            for (JsonNode col : columns) {
                String colName = col.path("name").asText("");

                // Support both "foreignKey" and "references" naming conventions
                JsonNode fk = col.has("foreignKey") ? col.get("foreignKey")
                            : col.has("references") ? col.get("references")
                            : null;

                if (fk == null || fk.isMissingNode()) continue;

                String refTable = fk.path("table").asText(fk.path("tableName").asText(""));
                String refColumn = fk.path("column").asText(fk.path("columnName").asText("id"));

                if (!refTable.isBlank() && !colName.isBlank()) {
                    out.add(new Relationship(tableName, colName, refTable, refColumn));
                }
            }
        }
    }

    // ── Prompt formatting ─────────────────────────────────────────────────────

    private String buildJoinHints(List<Relationship> rels) {
        if (rels.isEmpty()) return "";

        StringBuilder sb = new StringBuilder("Table relationships (use for JOINs):\n");
        for (Relationship r : rels) {
            sb.append("  JOIN ")
              .append(r.toTable()).append(" ON ")
              .append(r.fromTable()).append(".").append(r.fromColumn())
              .append(" = ")
              .append(r.toTable()).append(".").append(r.toColumn())
              .append("\n");
        }
        return sb.toString().trim();
    }
}
