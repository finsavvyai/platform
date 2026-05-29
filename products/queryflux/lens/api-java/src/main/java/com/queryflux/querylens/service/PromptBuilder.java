package com.queryflux.querylens.service;

import org.springframework.stereotype.Component;

@Component
public class PromptBuilder {

    private static final String SYSTEM_PROMPT_TEMPLATE = """
        You are an expert SQL generator. Given a database schema and a \
        natural language question, generate a valid PostgreSQL query.

        Rules:
        1. Return ONLY the SQL query, no explanations
        2. Use proper PostgreSQL syntax
        3. Include WHERE, JOIN, GROUP BY, ORDER BY as needed
        4. Limit results to 100 rows max (add LIMIT 100)
        5. Use table and column names exactly as in the schema
        6. For aggregations, use GROUP BY
        7. Only reference tables and columns present in the schema
        8. Never use DROP, TRUNCATE, ALTER, or other DDL statements
        9. For DELETE or UPDATE, always include a WHERE clause

        %s

        %s

        Return only the SQL query.
        """;

    private static final String FEW_SHOT_EXAMPLES = """
        Examples:

        Schema: users(id INT, name VARCHAR, email VARCHAR, created_at TIMESTAMP)
        Question: How many users signed up last month?
        SQL: SELECT COUNT(*) AS user_count FROM users \
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') \
        AND created_at < DATE_TRUNC('month', CURRENT_DATE);

        Schema: orders(id INT, user_id INT, total DECIMAL, status VARCHAR, created_at TIMESTAMP)
        Question: What is the average order total by status?
        SQL: SELECT status, AVG(total) AS avg_total FROM orders \
        GROUP BY status ORDER BY avg_total DESC;

        Schema: products(id INT, name VARCHAR, price DECIMAL, category VARCHAR)
        Question: Show the top 5 most expensive products
        SQL: SELECT name, price, category FROM products \
        ORDER BY price DESC LIMIT 5;

        Schema: orders(id, user_id, total, created_at), users(id, name, email)
        Question: Which users have spent more than 1000 in total?
        SQL: SELECT u.name, u.email, SUM(o.total) AS total_spent \
        FROM users u JOIN orders o ON u.id = o.user_id \
        GROUP BY u.id, u.name, u.email HAVING SUM(o.total) > 1000 \
        ORDER BY total_spent DESC LIMIT 100;

        Schema: employees(id, name, department, salary, hired_at)
        Question: Count employees per department
        SQL: SELECT department, COUNT(*) AS employee_count \
        FROM employees GROUP BY department ORDER BY employee_count DESC;
        """;

    public String buildSystemPrompt(String schema) {
        String schemaSection = schema != null && !schema.isBlank()
            ? "Database Schema:\n" + schema
            : "No schema provided — generate a generic query.";

        return SYSTEM_PROMPT_TEMPLATE.formatted(schemaSection, FEW_SHOT_EXAMPLES);
    }

    /**
     * Build prompt for a specific database dialect (MySQL, MongoDB, etc.).
     *
     * @param schema         Formatted schema string
     * @param dialectContext Dialect-specific syntax notes from DatabaseDialectService
     */
    public String buildSystemPromptForDialect(
            String schema,
            DatabaseDialectService.DialectContext dialectContext) {

        String schemaSection = schema != null && !schema.isBlank()
            ? "Database Schema:\n" + schema
            : "No schema provided — generate a generic query.";

        String dialectSection = dialectContext != null
            ? dialectContext.toPromptSection()
            : "";

        return SYSTEM_PROMPT_TEMPLATE.formatted(
            schemaSection + (dialectSection.isBlank() ? "" : "\n\n" + dialectSection),
            FEW_SHOT_EXAMPLES);
    }

    /**
     * Build prompt with semantic context, JOIN hints, and dialect instructions.
     */
    public String buildSystemPromptFull(
            String semanticContext,
            String joinHints,
            String fullSchema,
            DatabaseDialectService.DialectContext dialectContext) {

        StringBuilder schemaSection = new StringBuilder();

        if (semanticContext != null && !semanticContext.isBlank()) {
            schemaSection.append("Database Schema (semantically relevant tables):\n")
                         .append(semanticContext);
        } else if (fullSchema != null && !fullSchema.isBlank()) {
            schemaSection.append("Database Schema:\n").append(fullSchema);
        } else {
            schemaSection.append("No schema provided — generate a generic query.");
        }

        if (joinHints != null && !joinHints.isBlank()) {
            schemaSection.append("\n\n").append(joinHints);
        }

        if (dialectContext != null) {
            schemaSection.append("\n\n").append(dialectContext.toPromptSection());
        }

        return SYSTEM_PROMPT_TEMPLATE.formatted(schemaSection.toString(), FEW_SHOT_EXAMPLES);
    }

    public String buildSystemPromptWithContext(
            String semanticContext,
            String joinHints,
            String fullSchema) {

        StringBuilder schemaSection = new StringBuilder();

        if (semanticContext != null && !semanticContext.isBlank()) {
            schemaSection.append("Database Schema (semantically relevant tables):\n")
                         .append(semanticContext);
        } else if (fullSchema != null && !fullSchema.isBlank()) {
            schemaSection.append("Database Schema:\n").append(fullSchema);
        } else {
            schemaSection.append("No schema provided — generate a generic query.");
        }

        if (joinHints != null && !joinHints.isBlank()) {
            schemaSection.append("\n\n").append(joinHints);
        }

        return SYSTEM_PROMPT_TEMPLATE.formatted(schemaSection.toString(), FEW_SHOT_EXAMPLES);
    }
}
