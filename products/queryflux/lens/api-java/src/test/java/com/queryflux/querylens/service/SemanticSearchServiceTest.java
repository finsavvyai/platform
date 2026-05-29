package com.queryflux.querylens.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SemanticSearchServiceTest {

    @Mock
    private VectorizeClient vectorizeClient;

    @InjectMocks
    private SemanticSearchService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "similarityThreshold", 0.78);
        ReflectionTestUtils.setField(service, "searchTopK", 10);
        ReflectionTestUtils.setField(service, "maxTables", 5);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private VectorizeClient.Match tableMatch(String table, double score) {
        return new VectorizeClient.Match(
            table + ":table",
            score,
            Map.of("type", "table", "tableName", table, "database", "mydb",
                   "columns", List.of("id", "name"))
        );
    }

    private VectorizeClient.Match columnMatch(String table, String col, double score) {
        return new VectorizeClient.Match(
            table + ":" + col + ":column",
            score,
            Map.of("type", "column", "tableName", table, "columnName", col,
                   "columnType", "VARCHAR", "database", "mydb")
        );
    }

    private VectorizeClient.SearchResponse response(VectorizeClient.Match... matches) {
        return new VectorizeClient.SearchResponse(List.of(matches), "q", matches.length);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    void returnsAvailableWhenMatchesAboveThreshold() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(tableMatch("orders", 0.92)));

        var result = service.findRelevantSchema("show me all orders");

        assertThat(result.available()).isTrue();
        assertThat(result.relevantTables()).contains("orders");
    }

    @Test
    void returnsUnavailableWhenAllMatchesBelowThreshold() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(tableMatch("orders", 0.50)));

        var result = service.findRelevantSchema("show me all orders");

        assertThat(result.available()).isFalse();
        assertThat(result.relevantTables()).isEmpty();
    }

    @Test
    void returnsUnavailableWhenNoMatches() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(new VectorizeClient.SearchResponse(List.of(), "q", 0));

        var result = service.findRelevantSchema("anything");

        assertThat(result.available()).isFalse();
    }

    @Test
    void returnsUnavailableWhenVectorizeFails() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenThrow(new RuntimeException("network error"));

        var result = service.findRelevantSchema("anything");

        assertThat(result.available()).isFalse();
        assertThat(result.schemaContext()).isBlank();
    }

    @Test
    void capsTablesAtMaxTables() {
        when(vectorizeClient.search(anyString(), anyInt())).thenReturn(response(
            tableMatch("t1", 0.99), tableMatch("t2", 0.98), tableMatch("t3", 0.97),
            tableMatch("t4", 0.96), tableMatch("t5", 0.95), tableMatch("t6", 0.94)
        ));

        var result = service.findRelevantSchema("query");

        assertThat(result.relevantTables()).hasSize(5);
    }

    @Test
    void sortsByScoreDescending() {
        when(vectorizeClient.search(anyString(), anyInt())).thenReturn(response(
            tableMatch("low", 0.80),
            tableMatch("high", 0.95),
            tableMatch("mid", 0.88)
        ));

        var result = service.findRelevantSchema("query");

        assertThat(result.relevantTables()).containsExactly("high", "mid", "low");
    }

    @Test
    void filtersOutMismatchedDatabase() {
        VectorizeClient.Match foreign = new VectorizeClient.Match(
            "other:table", 0.95,
            Map.of("type", "table", "tableName", "other", "database", "otherdb")
        );
        VectorizeClient.Match mine = tableMatch("orders", 0.90);

        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(foreign, mine));

        var result = service.findRelevantSchema("query", "mydb");

        assertThat(result.relevantTables()).containsOnly("orders");
    }

    @Test
    void includesMatchingDatabaseTable() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(tableMatch("users", 0.91)));

        var result = service.findRelevantSchema("query", "mydb");

        assertThat(result.relevantTables()).contains("users");
    }

    @Test
    void schemaContextContainsTableName() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(tableMatch("products", 0.90)));

        var result = service.findRelevantSchema("show products");

        assertThat(result.schemaContext()).contains("products");
    }

    @Test
    void schemaContextContainsColumnFromMetadata() {
        when(vectorizeClient.search(anyString(), anyInt())).thenReturn(response(
            tableMatch("orders", 0.90),
            columnMatch("orders", "total", 0.85)
        ));

        var result = service.findRelevantSchema("total revenue");

        assertThat(result.schemaContext()).contains("total");
    }

    @Test
    void noArgOverloadCallsWithNullDatabase() {
        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(tableMatch("users", 0.90)));

        var result = service.findRelevantSchema("users query");

        assertThat(result.available()).isTrue();
    }

    @Test
    void deduplicatesTablesWithSameName() {
        VectorizeClient.Match dup1 = new VectorizeClient.Match("orders:col1", 0.95,
            Map.of("type", "column", "tableName", "orders", "columnName", "id",
                   "columnType", "INT", "database", "mydb"));
        VectorizeClient.Match tbl = tableMatch("orders", 0.90);

        when(vectorizeClient.search(anyString(), anyInt()))
            .thenReturn(response(tbl, dup1));

        var result = service.findRelevantSchema("order id");

        assertThat(result.relevantTables()).containsOnlyOnce("orders");
    }
}
