package com.queryflux.querylens.service;

import com.queryflux.querylens.dto.NlpQueryResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Detects simple, well-known query patterns that do not require
 * AI processing and returns them directly.
 *
 * <p>Patterns handled:</p>
 * <ul>
 *   <li>{@code SELECT * FROM table} — passthrough</li>
 *   <li>{@code SELECT COUNT(*) FROM table} — passthrough</li>
 *   <li>{@code SHOW TABLES} — mapped to dialect equivalent</li>
 *   <li>{@code DESCRIBE table} — mapped to dialect equivalent</li>
 *   <li>Raw SQL (starts with SELECT/INSERT/UPDATE/DELETE)</li>
 * </ul>
 */
@Slf4j
@Service
public class QueryBoosterService {

    private static final Pattern SELECT_STAR = Pattern.compile(
        "(?i)^(select|get|show|fetch)\\s+(all|everything|\\*)\\s+"
        + "(from|in)\\s+([a-z_][a-z0-9_.]+)\\s*;?$");

    private static final Pattern SELECT_COUNT = Pattern.compile(
        "(?i)^(count|how many)\\s+(rows?|records?|entries?)?\\s*"
        + "(in|from|of)\\s+([a-z_][a-z0-9_.]+)\\s*;?$");

    private static final Pattern SHOW_TABLES = Pattern.compile(
        "(?i)^(show|list)\\s+(all\\s+)?(tables|collections)\\s*;?$");

    private static final Pattern DESCRIBE_TABLE = Pattern.compile(
        "(?i)^(describe|desc|show\\s+columns|"
        + "what\\s+columns|schema\\s+of|structure\\s+of)\\s+"
        + "(for\\s+|in\\s+|of\\s+)?([a-z_][a-z0-9_.]+)\\s*;?$");

    private static final Pattern RAW_SQL = Pattern.compile(
        "(?i)^\\s*(SELECT|INSERT|UPDATE|DELETE|WITH|EXPLAIN)\\s+.*",
        Pattern.DOTALL);

    /**
     * Try to resolve the question without calling AI.
     *
     * @param question Natural-language question or raw SQL
     * @param dialect  Target database dialect (postgresql, mysql)
     * @return Resolved SQL response, or empty if AI is needed
     */
    public Optional<NlpQueryResponse> tryResolve(
            String question, String dialect) {
        if (question == null || question.isBlank()) {
            return Optional.empty();
        }

        String q = question.trim();

        // Raw SQL passthrough — no AI needed
        if (RAW_SQL.matcher(q).matches()) {
            log.info("QueryBooster: raw SQL passthrough");
            return Optional.of(response(q,
                "Raw SQL passed through (no AI needed)"));
        }

        // SELECT * FROM table
        var selectStar = SELECT_STAR.matcher(q);
        if (selectStar.matches()) {
            String table = selectStar.group(4);
            String sql = "SELECT * FROM " + table + " LIMIT 100";
            log.info("QueryBooster: SELECT * FROM {}", table);
            return Optional.of(response(sql,
                "Simple select boosted (no AI needed)"));
        }

        // COUNT rows
        var countMatch = SELECT_COUNT.matcher(q);
        if (countMatch.matches()) {
            String table = countMatch.group(4);
            String sql = "SELECT COUNT(*) AS total FROM " + table;
            log.info("QueryBooster: COUNT(*) FROM {}", table);
            return Optional.of(response(sql,
                "Count query boosted (no AI needed)"));
        }

        // SHOW TABLES
        if (SHOW_TABLES.matcher(q).matches()) {
            String sql = showTablesSQL(dialect);
            log.info("QueryBooster: SHOW TABLES [{}]", dialect);
            return Optional.of(response(sql,
                "Show tables boosted (no AI needed)"));
        }

        // DESCRIBE table
        var descMatch = DESCRIBE_TABLE.matcher(q);
        if (descMatch.matches()) {
            String table = descMatch.group(3);
            String sql = describeTableSQL(table, dialect);
            log.info("QueryBooster: DESCRIBE {} [{}]",
                table, dialect);
            return Optional.of(response(sql,
                "Describe table boosted (no AI needed)"));
        }

        return Optional.empty();
    }

    private NlpQueryResponse response(String sql, String explain) {
        return NlpQueryResponse.builder()
            .sql(sql)
            .confidence(1.0)
            .explanation(explain)
            .build();
    }

    private String showTablesSQL(String dialect) {
        if (dialect == null) {
            dialect = "postgresql";
        }
        return switch (dialect.toLowerCase(Locale.ROOT)) {
            case "mysql", "mariadb" -> "SHOW TABLES";
            case "sqlite" ->
                "SELECT name FROM sqlite_master "
                + "WHERE type='table' ORDER BY name";
            default ->
                "SELECT table_name FROM information_schema.tables "
                + "WHERE table_schema = 'public' "
                + "ORDER BY table_name";
        };
    }

    private String describeTableSQL(String table, String dialect) {
        if (dialect == null) {
            dialect = "postgresql";
        }
        return switch (dialect.toLowerCase(Locale.ROOT)) {
            case "mysql", "mariadb" -> "DESCRIBE " + table;
            case "sqlite" -> "PRAGMA table_info(" + table + ")";
            default ->
                "SELECT column_name, data_type, is_nullable "
                + "FROM information_schema.columns "
                + "WHERE table_name = '" + table + "' "
                + "ORDER BY ordinal_position";
        };
    }
}
