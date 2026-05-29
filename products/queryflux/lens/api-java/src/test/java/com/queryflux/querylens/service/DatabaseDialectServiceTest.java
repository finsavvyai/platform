package com.queryflux.querylens.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class DatabaseDialectServiceTest {

    private final DatabaseDialectService service = new DatabaseDialectService();

    // ── Dialect resolution ────────────────────────────────────────────────────

    @ParameterizedTest
    @CsvSource({
        "postgresql, POSTGRESQL",
        "POSTGRESQL, POSTGRESQL",
        "mysql,      MYSQL",
        "mariadb,    MYSQL",
        "MongoDB,    MONGODB",
        "mongo,      MONGODB",
        "duckdb,     DUCKDB",
        "sqlite,     SQLITE",
        "unknown,    POSTGRESQL",
        "'',         POSTGRESQL"
    })
    void resolvesDialectFromString(String input, String expectedDialect) {
        var ctx = service.getContext(input);
        assertThat(ctx.dialect().name()).isEqualTo(expectedDialect);
    }

    @Test
    void nullDialectDefaultsToPostgresql() {
        var ctx = service.getContext((String) null);
        assertThat(ctx.dialect()).isEqualTo(DatabaseDialectService.Dialect.POSTGRESQL);
    }

    // ── Context content ───────────────────────────────────────────────────────

    @Test
    void postgresqlContextHasCastSyntax() {
        var ctx = service.getContext("postgresql");
        assertThat(ctx.syntaxNote()).contains("::");
    }

    @Test
    void postgresqlSupportsWindowFunctions() {
        var ctx = service.getContext("postgresql");
        assertThat(ctx.supportsWindowFunctions()).isTrue();
    }

    @Test
    void postgresqlSupportsArrays() {
        var ctx = service.getContext("postgresql");
        assertThat(ctx.supportsArrays()).isTrue();
    }

    @Test
    void mysqlContextAvoidsCastDoubleColon() {
        var ctx = service.getContext("mysql");
        assertThat(ctx.syntaxNote()).doesNotContain("::");
    }

    @Test
    void mysqlContextHasDateFormat() {
        var ctx = service.getContext("mysql");
        assertThat(ctx.dateFunction()).containsIgnoringCase("DATE_FORMAT");
    }

    @Test
    void mysqlDoesNotSupportArrays() {
        var ctx = service.getContext("mysql");
        assertThat(ctx.supportsArrays()).isFalse();
    }

    @Test
    void mongodbContextMentionsPipeline() {
        var ctx = service.getContext("mongodb");
        assertThat(ctx.syntaxNote()).containsIgnoringCase("pipeline");
    }

    @Test
    void mongodbDoesNotSupportWindowFunctions() {
        var ctx = service.getContext("mongodb");
        assertThat(ctx.supportsWindowFunctions()).isFalse();
    }

    @Test
    void duckdbContextMentionsStrftime() {
        var ctx = service.getContext("duckdb");
        assertThat(ctx.dateFunction()).containsIgnoringCase("strftime");
    }

    @Test
    void sqliteContextMentionsStrftime() {
        var ctx = service.getContext("sqlite");
        assertThat(ctx.dateFunction()).containsIgnoringCase("strftime");
    }

    @Test
    void sqliteDoesNotSupportWindowFunctions() {
        var ctx = service.getContext("sqlite");
        assertThat(ctx.supportsWindowFunctions()).isFalse();
    }

    // ── toPromptSection() ────────────────────────────────────────────────────

    @Test
    void promptSectionContainsDialectName() {
        var ctx = service.getContext("mysql");
        assertThat(ctx.toPromptSection()).containsIgnoringCase("MYSQL");
    }

    @Test
    void promptSectionContainsSyntaxNote() {
        var ctx = service.getContext("postgresql");
        assertThat(ctx.toPromptSection()).contains(ctx.syntaxNote());
    }

    @Test
    void promptSectionContainsLimitClause() {
        var ctx = service.getContext("postgresql");
        assertThat(ctx.toPromptSection()).contains("LIMIT");
    }

    // ── requiresNonSqlOutput() ────────────────────────────────────────────────

    @Test
    void mongodbRequiresNonSqlOutput() {
        assertThat(service.requiresNonSqlOutput("mongodb")).isTrue();
    }

    @Test
    void postgresqlDoesNotRequireNonSqlOutput() {
        assertThat(service.requiresNonSqlOutput("postgresql")).isFalse();
    }

    @Test
    void mysqlDoesNotRequireNonSqlOutput() {
        assertThat(service.requiresNonSqlOutput("mysql")).isFalse();
    }

    // ── getContext(Dialect) overload ──────────────────────────────────────────

    @Test
    void enumOverloadReturnsCorrectContext() {
        var ctx = service.getContext(DatabaseDialectService.Dialect.DUCKDB);
        assertThat(ctx.dialect()).isEqualTo(DatabaseDialectService.Dialect.DUCKDB);
    }
}
