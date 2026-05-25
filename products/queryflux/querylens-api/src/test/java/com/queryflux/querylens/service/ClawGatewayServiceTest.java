package com.queryflux.querylens.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ClawGatewayServiceTest {

    private ClawGatewayService service;

    @BeforeEach
    void setUp() {
        service = new ClawGatewayService(
            null, "gpt-4o", "test-project", false,
            new PromptBuilder());
    }

    @Test
    void shouldExtractSQLFromMarkdownCodeBlock() {
        String sql = service.extractSQL(
            "```sql\nSELECT * FROM users\n```");
        assertThat(sql).isEqualTo("SELECT * FROM users");
    }

    @Test
    void shouldExtractSQLFromPlainCodeBlock() {
        String sql = service.extractSQL("```\nSELECT 1\n```");
        assertThat(sql).isEqualTo("SELECT 1");
    }

    @Test
    void shouldHandlePlainSQLText() {
        String sql = service.extractSQL(
            "SELECT * FROM users WHERE id = 1");
        assertThat(sql)
            .isEqualTo("SELECT * FROM users WHERE id = 1");
    }

    @Test
    void shouldTrimWhitespace() {
        String sql = service.extractSQL("  SELECT 1  ");
        assertThat(sql).isEqualTo("SELECT 1");
    }

    @Test
    void shouldHandleEmptyString() {
        String sql = service.extractSQL("  ");
        assertThat(sql).isEmpty();
    }

    @Test
    void shouldReportEnabledState() {
        ClawGatewayService enabled = new ClawGatewayService(
            null, "gpt-4o", "proj", true, new PromptBuilder());
        assertThat(enabled.isEnabled()).isTrue();

        ClawGatewayService disabled = new ClawGatewayService(
            null, "gpt-4o", "proj", false, new PromptBuilder());
        assertThat(disabled.isEnabled()).isFalse();
    }

    @Test
    void shouldHandleMultilineSQL() {
        String input = """
            ```sql
            SELECT u.name, COUNT(o.id)
            FROM users u
            JOIN orders o ON u.id = o.user_id
            GROUP BY u.name
            ```""";
        String sql = service.extractSQL(input);
        assertThat(sql).contains("SELECT u.name");
        assertThat(sql).contains("GROUP BY");
    }
}
