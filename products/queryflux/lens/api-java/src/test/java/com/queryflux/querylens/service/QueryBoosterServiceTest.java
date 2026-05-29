package com.queryflux.querylens.service;

import com.queryflux.querylens.dto.NlpQueryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class QueryBoosterServiceTest {

    private QueryBoosterService service;

    @BeforeEach
    void setUp() {
        service = new QueryBoosterService();
    }

    @Test
    void shouldPassthroughRawSQL() {
        var result = service.tryResolve(
            "SELECT id, name FROM users WHERE active = true",
            "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .startsWith("SELECT id, name FROM users");
        assertThat(result.get().getConfidence()).isEqualTo(1.0);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "SELECT * FROM orders",
        "select * from orders",
        "SELECT COUNT(*) FROM users"
    })
    void shouldPassthroughVariousRawSQL(String sql) {
        var result = service.tryResolve(sql, "postgresql");
        assertThat(result).isPresent();
    }

    @Test
    void shouldBoostSelectAllFromTable() {
        var result = service.tryResolve(
            "get all from users", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .isEqualTo("SELECT * FROM users LIMIT 100");
    }

    @Test
    void shouldBoostSelectEverythingFromTable() {
        var result = service.tryResolve(
            "fetch everything from orders", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .contains("SELECT * FROM orders");
    }

    @Test
    void shouldBoostCountRows() {
        var result = service.tryResolve(
            "count rows in users", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .isEqualTo("SELECT COUNT(*) AS total FROM users");
    }

    @Test
    void shouldBoostHowManyRecords() {
        var result = service.tryResolve(
            "how many records in orders", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .contains("COUNT(*)");
    }

    @Test
    void shouldBoostShowTablesPostgres() {
        var result = service.tryResolve(
            "show tables", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .contains("information_schema.tables");
    }

    @Test
    void shouldBoostShowTablesMySQL() {
        var result = service.tryResolve(
            "show tables", "mysql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .isEqualTo("SHOW TABLES");
    }

    @Test
    void shouldBoostShowTablesSQLite() {
        var result = service.tryResolve(
            "list tables", "sqlite");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .contains("sqlite_master");
    }

    @Test
    void shouldBoostDescribeTablePostgres() {
        var result = service.tryResolve(
            "describe users", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .contains("information_schema.columns");
    }

    @Test
    void shouldBoostDescribeTableMySQL() {
        var result = service.tryResolve(
            "describe users", "mysql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .isEqualTo("DESCRIBE users");
    }

    @Test
    void shouldBoostSchemaOfTable() {
        var result = service.tryResolve(
            "schema of products", "postgresql");
        assertThat(result).isPresent();
        assertThat(result.get().getSql())
            .contains("information_schema.columns");
        assertThat(result.get().getSql())
            .contains("products");
    }

    @Test
    void shouldReturnEmptyForComplexQuestions() {
        var result = service.tryResolve(
            "which users have the highest order totals this month",
            "postgresql");
        assertThat(result).isEmpty();
    }

    @Test
    void shouldReturnEmptyForNull() {
        assertThat(service.tryResolve(null, "postgresql")).isEmpty();
    }

    @Test
    void shouldReturnEmptyForBlank() {
        assertThat(service.tryResolve("  ", "postgresql")).isEmpty();
    }

    @Test
    void shouldBoostWithExplainPrefix() {
        var result = service.tryResolve(
            "EXPLAIN SELECT * FROM users", "postgresql");
        assertThat(result).isPresent();
    }

    @Test
    void shouldBoostWithStatement() {
        var result = service.tryResolve(
            "WITH cte AS (SELECT 1) SELECT * FROM cte",
            "postgresql");
        assertThat(result).isPresent();
    }
}
