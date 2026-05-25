package com.queryflux.querylens.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class SqlSafetyServiceTest {

    private SqlSafetyService service;

    @BeforeEach
    void setUp() {
        service = new SqlSafetyService();
    }

    @Test
    void shouldAcceptSimpleSelect() {
        var result = service.validate("SELECT * FROM users");
        assertThat(result.valid()).isTrue();
        assertThat(result.sql()).contains("LIMIT 100");
    }

    @Test
    void shouldAcceptSelectWithExistingLimit() {
        var result = service.validate("SELECT * FROM users LIMIT 50");
        assertThat(result.valid()).isTrue();
        assertThat(result.sql()).isEqualTo("SELECT * FROM users LIMIT 50");
    }

    @Test
    void shouldRejectNull() {
        var result = service.validate(null);
        assertThat(result.valid()).isFalse();
        assertThat(result.reason()).contains("empty");
    }

    @Test
    void shouldRejectBlank() {
        var result = service.validate("   ");
        assertThat(result.valid()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "DROP TABLE users",
        "TRUNCATE users",
        "ALTER TABLE users ADD col INT",
        "CREATE TABLE evil(id INT)",
        "GRANT ALL ON users TO hacker",
        "REVOKE SELECT ON users FROM app"
    })
    void shouldRejectDangerousKeywords(String sql) {
        var result = service.validate(sql);
        assertThat(result.valid()).isFalse();
        assertThat(result.reason()).contains("Forbidden");
    }

    @Test
    void shouldNotRejectKeywordsInsideNames() {
        var result = service.validate(
            "SELECT dropship_count FROM created_orders");
        assertThat(result.valid()).isTrue();
    }

    @Test
    void shouldRejectMultipleStatements() {
        var result = service.validate("SELECT 1; SELECT 2");
        assertThat(result.valid()).isFalse();
        assertThat(result.reason()).contains("Multiple statements");
    }

    @Test
    void shouldRejectDeleteWithoutWhere() {
        var result = service.validate("DELETE FROM users");
        assertThat(result.valid()).isFalse();
        assertThat(result.reason()).contains("WHERE");
    }

    @Test
    void shouldAcceptDeleteWithWhere() {
        var result = service.validate(
            "DELETE FROM users WHERE id = 1");
        assertThat(result.valid()).isTrue();
    }

    @Test
    void shouldRejectUpdateWithoutWhere() {
        var result = service.validate(
            "UPDATE users SET name = 'x'");
        assertThat(result.valid()).isFalse();
        assertThat(result.reason()).contains("WHERE");
    }

    @Test
    void shouldAcceptUpdateWithWhere() {
        var result = service.validate(
            "UPDATE users SET name = 'x' WHERE id = 1");
        assertThat(result.valid()).isTrue();
    }

    @Test
    void shouldRejectTooLongQuery() {
        String longQuery = "SELECT " + "a".repeat(5001);
        var result = service.validate(longQuery);
        assertThat(result.valid()).isFalse();
        assertThat(result.reason()).contains("maximum length");
    }

    @Test
    void shouldStripSemicolonBeforeAddingLimit() {
        var result = service.validate("SELECT * FROM users;");
        assertThat(result.valid()).isTrue();
        assertThat(result.sql()).endsWith("LIMIT 100");
        assertThat(result.sql()).doesNotContain(";");
    }

    @Test
    void ensureLimitPreservesExistingLimit() {
        String sql = service.ensureLimit("SELECT * FROM users LIMIT 25");
        assertThat(sql).isEqualTo("SELECT * FROM users LIMIT 25");
    }
}
