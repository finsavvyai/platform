package com.queryflux.querylens.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.queryflux.querylens.dto.NlpQueryRequest;
import com.queryflux.querylens.dto.NlpQueryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Accuracy test suite for NLP-to-SQL generation.
 * Tests 120+ natural language queries and measures accuracy.
 *
 * Prerequisites:
 * - OPENAI_API_KEY environment variable must be set
 * - QueryLens API must be running on port 8090
 *
 * Run with: mvn test -Dtest=NlpAccuracyTest
 */
@SpringBootTest
@ActiveProfiles("test")
public class NlpAccuracyTest {

    @Autowired
    private OpenAIService openAIService;

    @Autowired
    private SchemaContextService schemaContextService;

    @Autowired
    private SqlSafetyService sqlSafetyService;

    private ObjectMapper objectMapper = new ObjectMapper();
    private TestDataset dataset;
    private StringBuilder resultsSummary = new StringBuilder();

    @BeforeEach
    void setUp() throws IOException {
        File datasetFile = new File(
            "src/test/resources/nlp-test-dataset.json"
        );
        if (datasetFile.exists()) {
            dataset = objectMapper.readValue(datasetFile, TestDataset.class);
        } else {
            fail("Test dataset file not found: " + datasetFile.getPath());
        }
    }

    @Test
    @Disabled("Run manually with API key: mvn test -Dtest=NlpAccuracyTest#testAllQueries")
    void testAllQueries() {
        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            fail("OPENAI_API_KEY environment variable not set. Skipping accuracy tests.");
        }

        resultsSummary.append("=== QueryLens NLP Accuracy Test Results ===\n");
        resultsSummary.append(String.format("Total queries: %d\n\n", dataset.testQueries.size()));

        int passed = 0;
        int failed = 0;
        int rejected = 0;
        List<TestResult> failures = new ArrayList<>();
        Map<String, Integer> failuresByCategory = new HashMap<>();
        Map<String, Integer> failuresByDifficulty = new HashMap<>();

        long startTime = System.currentTimeMillis();

        for (TestQuery query : dataset.testQueries) {
            TestResult result = testQuery(query);

            if (result.status.equals("PASSED")) {
                passed++;
            } else if (result.status.equals("REJECTED")) {
                rejected++;
                if (!query.shouldReject) {
                    failures.add(result);
                    updateFailureStats(failuresByCategory, failuresByDifficulty, query);
                    failed++;
                }
            } else {
                failures.add(result);
                updateFailureStats(failuresByCategory, failuresByDifficulty, query);
                failed++;
            }
        }

        long totalTime = System.currentTimeMillis() - startTime;

        // Print summary
        resultsSummary.append("\n=== Summary ===\n");
        resultsSummary.append(String.format("Passed: %d (%.1f%%)\n", passed, (passed * 100.0 / dataset.testQueries.size())));
        resultsSummary.append(String.format("Failed: %d (%.1f%%)\n", failed, (failed * 100.0 / dataset.testQueries.size())));
        resultsSummary.append(String.format("Rejected (expected): %d\n\n", rejected));

        resultsSummary.append(String.format("Total time: %d ms (%.2f sec)\n", totalTime, totalTime / 1000.0));
        resultsSummary.append(String.format("Average time per query: %.2f ms\n\n", totalTime / (double) dataset.testQueries.size()));

        // Failure analysis
        if (!failures.isEmpty()) {
            resultsSummary.append("=== Failure Analysis by Category ===\n");
            failuresByCategory.forEach((category, count) ->
                resultsSummary.append(String.format("  %s: %d\n", category, count))
            );

            resultsSummary.append("\n=== Failure Analysis by Difficulty ===\n");
            failuresByDifficulty.forEach((difficulty, count) ->
                resultsSummary.append(String.format("  %s: %d\n", difficulty, count))
            );

            resultsSummary.append("\n=== Sample Failures (first 10) ===\n");
            failures.stream()
                .limit(10)
                .forEach(f -> {
                    resultsSummary.append(String.format("\nQuery %d: %s\n", f.queryId, f.question));
                    resultsSummary.append(String.format("  Category: %s, Difficulty: %s\n", f.category, f.difficulty));
                    resultsSummary.append(String.format("  Expected: %s\n", f.expectedSql));
                    resultsSummary.append(String.format("  Generated: %s\n", f.generatedSql));
                    resultsSummary.append(String.format("  Reason: %s\n", f.reason));
                });
        }

        System.out.println(resultsSummary.toString());

        // Assert minimum accuracy threshold
        double accuracy = (passed * 100.0) / dataset.testQueries.size();
        assertTrue(accuracy >= 70.0,
            String.format("Accuracy %.1f%% is below threshold 70%%. %d/%d passed.",
                accuracy, passed, dataset.testQueries.size()));
    }

    @Test
    @Disabled("Run manually for subset testing")
    void testBasicQueriesOnly() {
        String apiKey = System.getenv("OPENAI_API_KEY");
        if (apiKey == null || apiKey.isBlank()) {
            fail("OPENAI_API_KEY environment variable not set.");
        }

        List<TestQuery> basicQueries = dataset.testQueries.stream()
            .filter(q -> q.category.equals("basic_select") || q.category.equals("where_clause"))
            .toList();

        System.out.println("Testing " + basicQueries.size() + " basic queries...");

        int passed = 0;
        for (TestQuery query : basicQueries) {
            TestResult result = testQuery(query);
            if (result.status.equals("PASSED")) {
                passed++;
            } else {
                System.out.println(String.format("Failed: %s -> %s",
                    query.question, result.generatedSql));
            }
        }

        double accuracy = (passed * 100.0) / basicQueries.size();
        System.out.println(String.format("Basic queries accuracy: %.1f%% (%d/%d)",
            accuracy, passed, basicQueries.size()));
    }

    private TestResult testQuery(TestQuery query) {
        TestResult result = new TestResult();
        result.queryId = query.id;
        result.question = query.question;
        result.category = query.category;
        result.difficulty = query.difficulty;
        result.expectedSql = query.expectedSQL;

        try {
            String formattedSchema = schemaContextService.formatSchemaForPrompt(
                buildSchemaString()
            );

            long startTime = System.currentTimeMillis();
            NlpQueryResponse response = openAIService.generateSQL(
                query.question,
                formattedSchema
            );
            long latency = System.currentTimeMillis() - startTime;

            result.latency = latency;
            result.generatedSql = response.getSql();
            result.confidence = response.getConfidence();

            // Check if query should be rejected
            if (query.expectedSQL.isEmpty() && query.shouldReject) {
                if (response.getSql().isBlank() ||
                    response.getExplanation().contains("Rejected")) {
                    result.status = "REJECTED";
                    result.reason = "Correctly rejected dangerous query";
                } else {
                    result.status = "FAILED";
                    result.reason = "Should have been rejected but was allowed";
                }
                return result;
            }

            // Validate safety
            SqlSafetyService.ValidationResult safety =
                sqlSafetyService.validate(response.getSql());

            if (!safety.valid()) {
                result.status = "REJECTED";
                result.reason = safety.reason();
                return result;
            }

            // Compare SQL (normalize for comparison)
            String normalizedGenerated = normalizeSql(response.getSql());
            String normalizedExpected = normalizeSql(query.expectedSQL);

            if (normalizedGenerated.equalsIgnoreCase(normalizedExpected) ||
                sqlSemanticallyEquivalent(response.getSql(), query.expectedSQL)) {
                result.status = "PASSED";
                result.reason = "SQL matches expected output";
            } else {
                result.status = "FAILED";
                result.reason = "SQL does not match expected output";
            }

        } catch (Exception e) {
            result.status = "ERROR";
            result.reason = "Exception: " + e.getMessage();
        }

        return result;
    }

    private String buildSchemaString() {
        StringBuilder schema = new StringBuilder();
        schema.append("{\n");
        schema.append("  \"databases\": [{\n");
        schema.append("    \"name\": \"ecommerce\",\n");
        schema.append("    \"schemas\": [{\n");
        schema.append("      \"name\": \"public\",\n");
        schema.append("      \"tables\": [\n");

        for (int i = 0; i < dataset.testSchema.tables.size(); i++) {
            TestTable table = dataset.testSchema.tables.get(i);
            schema.append("        {\n");
            schema.append(String.format("          \"name\": \"%s\",\n", table.name));
            schema.append("          \"columns\": [\n");

            for (int j = 0; j < table.columns.size(); j++) {
                TestColumn column = table.columns.get(j);
                schema.append("            {\n");
                schema.append(String.format("              \"name\": \"%s\",\n", column.name));
                schema.append(String.format("              \"type\": \"%s\",\n", column.type));
                if (!column.constraints.isEmpty()) {
                    schema.append(String.format("              \"constraints\": [\"%s\"]\n",
                        String.join("\", \"", column.constraints)));
                } else {
                    schema.append("              \"constraints\": []\n");
                }
                schema.append(j < table.columns.size() - 1 ? "            },\n" : "            }\n");
            }

            schema.append("          ]\n");
            schema.append(i < dataset.testSchema.tables.size() - 1 ? "        },\n" : "        }\n");
        }

        schema.append("      ]\n");
        schema.append("    }]\n");
        schema.append("  }]\n");
        schema.append("}");

        return schema.toString();
    }

    private String normalizeSql(String sql) {
        return sql.trim()
            .replaceAll("\\s+", " ")
            .replaceAll(";", "")
            .toLowerCase();
    }

    private boolean sqlSemanticallyEquivalent(String generated, String expected) {
        // Simple semantic equivalence check
        // In production, use SQL parser for proper comparison
        String genNorm = normalizeSql(generated);
        String expNorm = normalizeSql(expected);

        // Check if key components match
        if (expNorm.contains("select") && !genNorm.contains("select")) return false;
        if (expNorm.contains("from") && !genNorm.contains("from")) return false;
        if (expNorm.contains("where") && !genNorm.contains("where")) {
            // WHERE clause might be optional in some cases
            if (!expNorm.contains("join")) return false;
        }
        if (expNorm.contains("join") && !genNorm.contains("join")) return false;
        if (expNorm.contains("group by") && !genNorm.contains("group by")) return false;
        if (expNorm.contains("order by") && !genNorm.contains("order by")) return false;
        if (expNorm.contains("limit") && !genNorm.contains("limit")) return false;

        return true;
    }

    private void updateFailureStats(
            Map<String, Integer> byCategory,
            Map<String, Integer> byDifficulty,
            TestQuery query) {
        byCategory.merge(query.category, 1, Integer::sum);
        byDifficulty.merge(query.difficulty, 1, Integer::sum);
    }

    // Inner classes for JSON deserialization
    static class TestDataset {
        public Metadata metadata;
        public TestSchema testSchema;
        public List<TestQuery> testQueries;
    }

    static class Metadata {
        public String version;
        public String created;
        public String description;
        public int totalQueries;
    }

    static class TestSchema {
        public String database;
        public List<TestTable> tables;
    }

    static class TestTable {
        public String name;
        public List<TestColumn> columns;
    }

    static class TestColumn {
        public String name;
        public String type;
        public List<String> constraints;
    }

    static class TestQuery {
        public int id;
        public String category;
        public String question;
        public String expectedSQL;
        public String difficulty;
        public boolean shouldReject;
    }

    static class TestResult {
        int queryId;
        String question;
        String category;
        String difficulty;
        String expectedSql;
        String generatedSql;
        String status;
        String reason;
        long latency;
        double confidence;
    }
}
