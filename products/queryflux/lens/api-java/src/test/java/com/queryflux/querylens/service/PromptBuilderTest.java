package com.queryflux.querylens.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PromptBuilderTest {

    private PromptBuilder builder;

    @BeforeEach
    void setUp() {
        builder = new PromptBuilder();
    }

    @Test
    void shouldIncludeSchemaInPrompt() {
        String schema = "users(id INT, name VARCHAR)";
        String prompt = builder.buildSystemPrompt(schema);

        assertThat(prompt).contains("users(id INT, name VARCHAR)");
        assertThat(prompt).contains("Database Schema:");
    }

    @Test
    void shouldIncludeFewShotExamples() {
        String prompt = builder.buildSystemPrompt("test_schema");
        assertThat(prompt).contains("Examples:");
        assertThat(prompt).contains("COUNT(*)");
        assertThat(prompt).contains("GROUP BY");
        assertThat(prompt).contains("JOIN");
    }

    @Test
    void shouldHandleNullSchema() {
        String prompt = builder.buildSystemPrompt(null);
        assertThat(prompt).contains("No schema provided");
        assertThat(prompt).doesNotContain("Database Schema:");
    }

    @Test
    void shouldHandleBlankSchema() {
        String prompt = builder.buildSystemPrompt("   ");
        assertThat(prompt).contains("No schema provided");
    }

    @Test
    void shouldIncludeSafetyRules() {
        String prompt = builder.buildSystemPrompt("some_schema");
        assertThat(prompt).contains("Never use DROP");
        assertThat(prompt).contains("LIMIT 100");
        assertThat(prompt).contains("WHERE clause");
    }

    @Test
    void shouldIncludePostgreSQLInstruction() {
        String prompt = builder.buildSystemPrompt("tbl(col INT)");
        assertThat(prompt).contains("PostgreSQL");
    }
}
