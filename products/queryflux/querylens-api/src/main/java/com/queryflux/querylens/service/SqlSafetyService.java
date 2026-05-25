package com.queryflux.querylens.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.regex.Pattern;

@Service
public class SqlSafetyService {

    private static final List<String> BLOCKED_KEYWORDS = List.of(
        "DROP", "TRUNCATE", "ALTER", "CREATE", "GRANT",
        "REVOKE", "EXEC", "EXECUTE", "xp_", "sp_"
    );

    private static final Pattern MULTI_STATEMENT =
        Pattern.compile(";\\s*\\S", Pattern.CASE_INSENSITIVE);

    private static final Pattern UPDATE_WITHOUT_WHERE =
        Pattern.compile("^\\s*UPDATE\\s+.*(?<!WHERE.*)$",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern DELETE_WITHOUT_WHERE =
        Pattern.compile("^\\s*DELETE\\s+.*(?<!WHERE.*)$",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final int MAX_QUERY_LENGTH = 5000;

    public ValidationResult validate(String sql) {
        if (sql == null || sql.isBlank()) {
            return ValidationResult.rejected("SQL query is empty");
        }

        String trimmed = sql.trim();

        if (trimmed.length() > MAX_QUERY_LENGTH) {
            return ValidationResult.rejected(
                "Query exceeds maximum length of " + MAX_QUERY_LENGTH);
        }

        String upper = trimmed.toUpperCase();

        for (String keyword : BLOCKED_KEYWORDS) {
            if (containsKeyword(upper, keyword)) {
                return ValidationResult.rejected(
                    "Forbidden operation: " + keyword);
            }
        }

        if (MULTI_STATEMENT.matcher(trimmed).find()) {
            return ValidationResult.rejected(
                "Multiple statements not allowed");
        }

        if (upper.startsWith("DELETE") && !upper.contains("WHERE")) {
            return ValidationResult.rejected(
                "DELETE without WHERE clause is not allowed");
        }

        if (upper.startsWith("UPDATE") && !upper.contains("WHERE")) {
            return ValidationResult.rejected(
                "UPDATE without WHERE clause is not allowed");
        }

        return ValidationResult.accepted(ensureLimit(trimmed));
    }

    private boolean containsKeyword(String upper, String keyword) {
        int idx = upper.indexOf(keyword);
        if (idx < 0) return false;

        boolean startOk = idx == 0
            || !Character.isLetterOrDigit(upper.charAt(idx - 1));
        int endIdx = idx + keyword.length();
        boolean endOk = endIdx >= upper.length()
            || !Character.isLetterOrDigit(upper.charAt(endIdx));

        return startOk && endOk;
    }

    String ensureLimit(String sql) {
        if (sql.toUpperCase().contains("LIMIT")) {
            return sql;
        }

        String trimmed = sql.endsWith(";")
            ? sql.substring(0, sql.length() - 1).trim()
            : sql;

        return trimmed + " LIMIT 100";
    }

    public record ValidationResult(boolean valid, String sql, String reason) {

        static ValidationResult accepted(String sql) {
            return new ValidationResult(true, sql, null);
        }

        static ValidationResult rejected(String reason) {
            return new ValidationResult(false, null, reason);
        }
    }
}
