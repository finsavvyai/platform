package com.queryflux.querylens.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@Slf4j
@Service
public class SchemaContextService {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public String formatSchemaForPrompt(String schemaJson) {
        if (schemaJson == null || schemaJson.isBlank()) {
            return "No schema available";
        }

        try {
            JsonNode root = objectMapper.readTree(schemaJson);
            return formatNode(root);
        } catch (Exception e) {
            log.warn("Could not parse schema JSON, using raw: {}", e.getMessage());
            return schemaJson;
        }
    }

    private String formatNode(JsonNode root) {
        List<String> lines = new ArrayList<>();

        if (root.isArray()) {
            formatTablesArray(root, lines);
        } else if (root.has("tables")) {
            formatTablesArray(root.get("tables"), lines);
        } else if (root.has("schemas")) {
            formatSchemasNode(root.get("schemas"), lines);
        } else if (root.has("databases")) {
            formatDatabasesNode(root.get("databases"), lines);
        }

        return String.join("\n", lines);
    }

    private void formatDatabasesNode(JsonNode databases, List<String> lines) {
        for (JsonNode db : databases) {
            String dbName = db.has("name") ? db.get("name").asText() : "default";
            lines.add("Database: " + dbName);

            if (db.has("schemas")) {
                formatSchemasNode(db.get("schemas"), lines);
            }
        }
    }

    private void formatSchemasNode(JsonNode schemas, List<String> lines) {
        for (JsonNode schema : schemas) {
            String schemaName = schema.has("name")
                ? schema.get("name").asText() : "public";
            lines.add("Schema: " + schemaName);

            if (schema.has("tables")) {
                formatTablesArray(schema.get("tables"), lines);
            }
        }
    }

    private void formatTablesArray(JsonNode tables, List<String> lines) {
        for (JsonNode table : tables) {
            String tableName = table.has("name")
                ? table.get("name").asText() : "unknown";
            List<String> cols = new ArrayList<>();

            JsonNode columns = table.has("columns")
                ? table.get("columns") : null;
            if (columns != null && columns.isArray()) {
                for (JsonNode col : columns) {
                    cols.add(formatColumn(col));
                }
            }

            lines.add("  " + tableName + "(" + String.join(", ", cols) + ")");
        }
    }

    private String formatColumn(JsonNode col) {
        String name = col.has("name") ? col.get("name").asText() : "?";
        String type = col.has("type") ? col.get("type").asText() : "";

        StringBuilder sb = new StringBuilder(name);
        if (!type.isEmpty()) {
            sb.append(" ").append(type.toUpperCase());
        }

        if (col.has("isPrimaryKey") && col.get("isPrimaryKey").asBoolean()) {
            sb.append(" PK");
        }

        if (col.has("nullable") && !col.get("nullable").asBoolean()) {
            sb.append(" NOT NULL");
        }

        return sb.toString();
    }
}
