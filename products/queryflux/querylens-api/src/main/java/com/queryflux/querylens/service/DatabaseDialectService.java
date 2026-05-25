package com.queryflux.querylens.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Provides database-dialect-specific SQL generation hints.
 *
 * Supported dialects: postgresql (default), mysql, mongodb, duckdb, sqlite.
 * The returned {@link DialectContext} is injected into the GPT-4 system prompt
 * so the model generates syntax valid for the target database.
 */
@Slf4j
@Service
public class DatabaseDialectService {

    public enum Dialect {
        POSTGRESQL,
        MYSQL,
        MONGODB,
        DUCKDB,
        SQLITE;

        public static Dialect fromString(String value) {
            if (value == null || value.isBlank()) return POSTGRESQL;
            return switch (value.trim().toLowerCase()) {
                case "mysql", "mariadb"    -> MYSQL;
                case "mongodb", "mongo"    -> MONGODB;
                case "duckdb"              -> DUCKDB;
                case "sqlite"              -> SQLITE;
                default                    -> POSTGRESQL;
            };
        }
    }

    /**
     * Dialect-specific context injected into the GPT-4 system prompt.
     */
    public record DialectContext(
        Dialect dialect,
        String syntaxNote,
        String dateFunction,
        String limitClause,
        String stringConcat,
        String regexOperator,
        boolean supportsWindowFunctions,
        boolean supportsArrays
    ) {
        /** Format as a compact prompt section. */
        public String toPromptSection() {
            return String.format("""
                Target Database: %s
                Syntax notes: %s
                Date truncation: %s
                Limit syntax: %s
                """,
                dialect.name(), syntaxNote, dateFunction, limitClause).trim();
        }
    }

    private static final Map<Dialect, DialectContext> CONTEXTS = Map.of(
        Dialect.POSTGRESQL, new DialectContext(
            Dialect.POSTGRESQL,
            "Use PostgreSQL syntax. Use :: for casting (e.g. value::INT). Use ILIKE for case-insensitive matching.",
            "DATE_TRUNC('month', col) or EXTRACT(YEAR FROM col)",
            "LIMIT n OFFSET m",
            "|| for concatenation or CONCAT()",
            "~ for regex match",
            true, true
        ),
        Dialect.MYSQL, new DialectContext(
            Dialect.MYSQL,
            "Use MySQL syntax. Use CAST(val AS SIGNED) for casting. Use backticks for identifiers with spaces. " +
            "Use IFNULL() instead of COALESCE() where possible. Avoid PostgreSQL-style double-colon type casts; use CAST(... AS type) instead.",
            "DATE_FORMAT(col, '%Y-%m') or YEAR(col), MONTH(col)",
            "LIMIT n, m  (or LIMIT n OFFSET m)",
            "CONCAT(a, b) — avoid || operator",
            "REGEXP or RLIKE",
            true, false
        ),
        Dialect.MONGODB, new DialectContext(
            Dialect.MONGODB,
            "Generate a MongoDB aggregation pipeline as a JSON array. " +
            "Use $match, $group, $sort, $limit, $lookup for JOINs, $project for field selection. " +
            "Return ONLY the pipeline array, not a full db.collection.aggregate() call.",
            "$dateToString: { format: '%Y-%m', date: '$col' }",
            "{ $limit: n }",
            "{ $concat: ['$a', '$b'] }",
            "{ $regexMatch: { input: '$field', regex: 'pattern' } }",
            false, true
        ),
        Dialect.DUCKDB, new DialectContext(
            Dialect.DUCKDB,
            "Use DuckDB SQL syntax. Supports most PostgreSQL syntax. " +
            "Use strftime('%Y-%m', col) for date formatting. Supports PIVOT and UNPIVOT.",
            "date_trunc('month', col) or strftime('%Y', col::DATE)",
            "LIMIT n OFFSET m",
            "|| or concat()",
            "~ for regex",
            true, true
        ),
        Dialect.SQLITE, new DialectContext(
            Dialect.SQLITE,
            "Use SQLite syntax. No DATE_TRUNC — use strftime(). No FULL OUTER JOIN. " +
            "Use CAST(val AS INTEGER) for casting. No SERIAL — use INTEGER PRIMARY KEY AUTOINCREMENT.",
            "strftime('%Y-%m', col)",
            "LIMIT n OFFSET m",
            "|| for concatenation",
            "REGEXP (requires extension)",
            false, false
        )
    );

    /**
     * Resolve dialect context by name string.
     */
    public DialectContext getContext(String dialectName) {
        Dialect dialect = Dialect.fromString(dialectName);
        DialectContext ctx = CONTEXTS.get(dialect);
        log.debug("Resolved dialect: {} → {}", dialectName, dialect);
        return ctx;
    }

    /**
     * Resolve dialect context by enum.
     */
    public DialectContext getContext(Dialect dialect) {
        return CONTEXTS.getOrDefault(dialect, CONTEXTS.get(Dialect.POSTGRESQL));
    }

    /**
     * Returns true when the dialect requires non-SQL output (e.g. MongoDB pipeline JSON).
     */
    public boolean requiresNonSqlOutput(String dialectName) {
        return Dialect.fromString(dialectName) == Dialect.MONGODB;
    }
}
