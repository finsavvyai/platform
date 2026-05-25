package com.querylens.api;

import com.querylens.model.Datasource;
import com.querylens.service.DatasourceService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Controller for testing database connections
 */
@RestController
@RequestMapping("/api/test")
public class TestController {

    private final DatasourceService datasourceService;

    public TestController(DatasourceService datasourceService) {
        this.datasourceService = datasourceService;
    }

    /**
     * Test a datasource connection
     *
     * @param id The datasource ID to test
     * @return Connection status
     */
    @GetMapping("/connection/{id}")
    public ResponseEntity<Map<String, Object>> testConnection(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        long startTime = System.currentTimeMillis();
        
        // Get datasource
        Optional<Datasource> datasourceOpt = datasourceService.getDatasourceById(id);
        if (datasourceOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Datasource not found");
            result.put("executionTimeMs", System.currentTimeMillis() - startTime);
            return ResponseEntity.ok(result);
        }

        Datasource datasource = datasourceOpt.get();
        result.put("datasource", datasource);
        
        try {
            // Create a database connection with default credentials for H2 if not specified
            DriverManagerDataSource dataSource = new DriverManagerDataSource();
            dataSource.setDriverClassName(datasource.getDriverClassName());
            dataSource.setUrl(datasource.getUrl());
            
            // Use default credentials for H2 if not provided
            if (datasource.getUrl().contains("h2") && 
                (datasource.getUsername() == null || datasource.getUsername().isEmpty())) {
                dataSource.setUsername("sa");
                dataSource.setPassword("");
                result.put("note", "Using default H2 credentials: sa/\"\"");
            } else {
                dataSource.setUsername(datasource.getUsername());
                dataSource.setPassword(datasource.getPassword());
            }

            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            
            // Test the connection by executing a simple query
            String testQuery = "SELECT 1 as test";
            List<Map<String, Object>> results = jdbcTemplate.queryForList(testQuery);
            
            result.put("success", true);
            result.put("message", "Connection successful");
            result.put("query", testQuery);
            result.put("queryResult", results);
            
            // Try to get table information
            try {
                List<Map<String, Object>> tables = jdbcTemplate.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'"
                );
                result.put("tables", tables);
            } catch (Exception e) {
                result.put("tablesError", e.getMessage());
            }
            
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getClass().getName());
            
            // Add more debug information
            Throwable cause = e.getCause();
            if (cause != null) {
                result.put("rootCause", cause.getMessage());
                result.put("rootCauseType", cause.getClass().getName());
            }
        }
        
        result.put("executionTimeMs", System.currentTimeMillis() - startTime);
        return ResponseEntity.ok(result);
    }
    
    /**
     * Execute a direct SQL query against a datasource (for testing only)
     *
     * @param id The datasource ID
     * @param sql The SQL to execute
     * @return Query results
     */
    @PostMapping(value = "/query/{id}", consumes = "text/plain")
    public ResponseEntity<Map<String, Object>> executeRawQuery(
            @PathVariable Long id, 
            @RequestBody String sql) {
        Map<String, Object> result = new HashMap<>();
        long startTime = System.currentTimeMillis();
        
        // Get datasource
        Optional<Datasource> datasourceOpt = datasourceService.getDatasourceById(id);
        if (datasourceOpt.isEmpty()) {
            result.put("success", false);
            result.put("error", "Datasource not found");
            result.put("executionTimeMs", System.currentTimeMillis() - startTime);
            return ResponseEntity.ok(result);
        }

        Datasource datasource = datasourceOpt.get();
        
        try {
            // Create a database connection with proper credentials
            DriverManagerDataSource dataSource = new DriverManagerDataSource();
            dataSource.setDriverClassName(datasource.getDriverClassName());
            dataSource.setUrl(datasource.getUrl());
            
            // Use default credentials for H2 if not provided
            if (datasource.getUrl().contains("h2") && 
                (datasource.getUsername() == null || datasource.getUsername().isEmpty())) {
                dataSource.setUsername("sa");
                dataSource.setPassword("");
                result.put("note", "Using default H2 credentials: sa/\"\"");
            } else {
                dataSource.setUsername(datasource.getUsername());
                dataSource.setPassword(datasource.getPassword());
            }

            JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);
            


            // Clean up SQL query
            sql = cleanSqlQuery(sql);
            
            // Store original SQL for debugging
            String originalSql = sql;
            
            System.out.println("Executing SQL query: " + sql);
            
            // For "CREATE TABLE" statements
            if (sql.toUpperCase().startsWith("CREATE TABLE")) {
                // Execute as-is
                jdbcTemplate.execute(sql);
                
                result.put("success", true);
                result.put("originalSql", originalSql);
                result.put("executedSql", sql);
                result.put("message", "Table created successfully");
                
                result.put("executionTimeMs", System.currentTimeMillis() - startTime);
                return ResponseEntity.ok(result);
            }
            
            // For "INSERT INTO" statements
            if (sql.toUpperCase().startsWith("INSERT INTO")) {
                // Execute as-is
                int rowsAffected = jdbcTemplate.update(sql);
                
                result.put("success", true);
                result.put("originalSql", originalSql);
                result.put("executedSql", sql);
                result.put("rowsAffected", rowsAffected);
                result.put("message", rowsAffected + " row(s) inserted");
                
                result.put("executionTimeMs", System.currentTimeMillis() - startTime);
                return ResponseEntity.ok(result);
            }
            
            // For other statements, try to execute as-is
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            result.put("success", true);
            result.put("originalSql", originalSql);
            result.put("executedSql", sql);
            result.put("results", results);
            result.put("rowCount", results.size());
            
            if (!results.isEmpty()) {
                result.put("columns", results.get(0).keySet());
            }
            
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
            result.put("errorType", e.getClass().getName());
            result.put("originalSql", sql); // Include the SQL that failed
            
            // Add more debug information
            Throwable cause = e.getCause();
            if (cause != null) {
                result.put("rootCause", cause.getMessage());
                result.put("rootCauseType", cause.getClass().getName());
            }
        }
        
        result.put("executionTimeMs", System.currentTimeMillis() - startTime);
        return ResponseEntity.ok(result);
    }
    
    /**
     * Clean up SQL query to handle common issues
     */
    private String cleanSqlQuery(String sql) {
        if (sql == null || sql.trim().isEmpty()) {
            return "";
        }
        
        String originalSql = sql;
        String normalizedSql = sql.trim().toUpperCase();
        
        System.out.println("Executing SQL query: " + sql);
        
        // Most direct approach - check for exact SQL patterns we care about
        if (normalizedSql.contains("SELECT") && normalizedSql.contains("FROM DATASOURCES")) {
            // Special case for "SELECT * FROM DATASOURCES"
            if (normalizedSql.contains("SELECT * FROM DATASOURCES")) {
                return "SELECT * FROM DATASOURCES";
            }
            
            // Extract just the SQL part - this handles directory listing in SQL
            int fromIndex = normalizedSql.indexOf("FROM DATASOURCES");
            if (fromIndex > 0) {
                int selectIndex = normalizedSql.indexOf("SELECT");
                if (selectIndex >= 0 && selectIndex < fromIndex) {
                    // Get the columns part between SELECT and FROM
                    String columnsText = sql.substring(
                            selectIndex + "SELECT".length(), 
                            sql.indexOf("FROM DATASOURCES", fromIndex - 10)
                    ).trim();
                    
                    // If the columns part is too long, it probably has file listing, so just use *
                    if (columnsText.length() > 100) {
                        return "SELECT * FROM DATASOURCES";
                    } else {
                        return "SELECT " + columnsText + " FROM DATASOURCES";
                    }
                }
            }
        }
        
        // Handle SAMPLE_DATA table queries specifically
        if (normalizedSql.contains("SELECT") && normalizedSql.contains("FROM SAMPLE_DATA")) {
            // Special case for "SELECT * FROM SAMPLE_DATA"
            if (normalizedSql.contains("SELECT * FROM SAMPLE_DATA")) {
                return "SELECT * FROM SAMPLE_DATA";
            }
            
            // Extract just the SQL part
            int fromIndex = normalizedSql.indexOf("FROM SAMPLE_DATA");
            if (fromIndex > 0) {
                int selectIndex = normalizedSql.indexOf("SELECT");
                if (selectIndex >= 0 && selectIndex < fromIndex) {
                    // Get the columns part between SELECT and FROM
                    String columnsText = sql.substring(
                            selectIndex + "SELECT".length(), 
                            sql.indexOf("FROM SAMPLE_DATA", fromIndex - 10)
                    ).trim();
                    
                    // If the columns part is too long, it probably has file listing, so just use *
                    if (columnsText.length() > 100) {
                        return "SELECT * FROM SAMPLE_DATA";
                    } else {
                        return "SELECT " + columnsText + " FROM SAMPLE_DATA";
                    }
                }
            }
        }
        
        // Fall through case - if query is a DDL statement, return as is
        if (normalizedSql.startsWith("CREATE") || 
            normalizedSql.startsWith("INSERT") || 
            normalizedSql.startsWith("UPDATE") || 
            normalizedSql.startsWith("DELETE") ||
            normalizedSql.startsWith("DROP")) {
            return sql;
        }
        
        // For any other SELECT that has a FROM, try to clean it up
        if (normalizedSql.contains("SELECT") && normalizedSql.contains("FROM")) {
            int selectIndex = normalizedSql.indexOf("SELECT");
            int fromIndex = normalizedSql.indexOf("FROM", selectIndex);
            
            if (selectIndex >= 0 && fromIndex > selectIndex) {
                // Extract the table name after FROM
                String restOfSql = sql.substring(fromIndex + "FROM".length()).trim();
                String tableName = restOfSql.split("\\s+")[0];
                
                // Get columns part
                String columnsText = sql.substring(
                        selectIndex + "SELECT".length(), 
                        fromIndex
                ).trim();
                
                // If columns part is too long, use *
                if (columnsText.length() > 100) {
                    return "SELECT * FROM " + tableName + 
                           (restOfSql.length() > tableName.length() ? 
                            " " + restOfSql.substring(tableName.length()).trim() : "");
                } else {
                    return "SELECT " + columnsText + " FROM " + tableName +
                           (restOfSql.length() > tableName.length() ? 
                            " " + restOfSql.substring(tableName.length()).trim() : "");
                }
            }
        }
        
        return sql;
    }
    
    /**
     * Extract table name from SQL query
     * This handles both "SELECT * FROM TABLE" and "SELECT col FROM TABLE" patterns
     */
    private String extractTableName(String sql) {
        if (sql == null) {
            return null;
        }
        
        // Extract table name after FROM keyword
        Pattern pattern = Pattern.compile("(?i)\\s+FROM\\s+(\\w+)");
        Matcher matcher = pattern.matcher(sql);
        
        if (matcher.find()) {
            return matcher.group(1);
        }
        
        return null;
    }
}
