// File: src/main/java/com/querylens/api/QueryController.java
package com.querylens.api;

import com.querylens.model.Datasource;
import com.querylens.model.NaturalQuery;
import com.querylens.model.NlpAnalysis;
import com.querylens.model.QueryResult;
import com.querylens.service.DatasourceService;
import com.querylens.service.NlpClient;
import com.querylens.service.QueryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller for handling query requests - both natural language and direct SQL
 */
@RestController
@RequestMapping("/api/query")
public class QueryController {

    private final QueryService queryService;
    private final NlpClient nlpClient;
    private final DatasourceService datasourceService;
    private final JdbcTemplate jdbcTemplate;

    @Autowired
    public QueryController(
            QueryService queryService,
            NlpClient nlpClient,
            DatasourceService datasourceService,
            JdbcTemplate jdbcTemplate) {
        this.queryService = queryService;
        this.nlpClient = nlpClient;
        this.datasourceService = datasourceService;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Execute a natural language query
     *
     * @param query The natural language query to execute
     * @return The query results
     */
    @PostMapping("/execute")
    public ResponseEntity<QueryResult> executeQuery(@Valid @RequestBody NaturalQuery query) {
        // Process query through NLP
        NlpAnalysis analysis = nlpClient.analyze(query.getText());

        // Generate and execute query
        QueryResult result = queryService.executeQuery(analysis, query.getDatasourceId());

        return ResponseEntity.ok(result);
    }

    /**
     * Execute a raw SQL query directly
     *
     * @param sql The SQL query to execute
     * @param datasourceId The ID of the datasource to use
     * @return The query results
     */
    @PostMapping("/execute-sql")
    public ResponseEntity<QueryResult> executeSql(
            @RequestBody String sql,
            @RequestParam Long datasourceId) {

        QueryResult result = queryService.executeRawSql(sql, datasourceId);
        return ResponseEntity.ok(result);
    }

    /**
     * List tables in the current datasource
     *
     * @param datasourceId The ID of the datasource
     * @return List of tables
     */
    @GetMapping("/tables")
    public ResponseEntity<List<Map<String, Object>>> listTables(@RequestParam Long datasourceId) {
        String sql = "SELECT table_name FROM information_schema.tables WHERE table_schema='public'";

        // For DuckDB, adjust if needed
        if (isDuckDB(datasourceId)) {
            sql = "SELECT name as table_name FROM sqlite_master WHERE type='table'";
        }

        List<Map<String, Object>> tables = queryService.executeRawSql(sql, datasourceId).getData();
        return ResponseEntity.ok(tables);
    }

    /**
     * Get schema information for a specific table
     *
     * @param tableName The name of the table
     * @param datasourceId The ID of the datasource
     * @return Table schema information
     */
    @GetMapping("/schema/{tableName}")
    public ResponseEntity<List<Map<String, Object>>> getTableSchema(
            @PathVariable String tableName,
            @RequestParam Long datasourceId) {

        String sql = "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '" + tableName + "'";

        // For DuckDB, adjust if needed
        if (isDuckDB(datasourceId)) {
            sql = "PRAGMA table_info('" + tableName + "')";
        }

        List<Map<String, Object>> schema = queryService.executeRawSql(sql, datasourceId).getData();
        return ResponseEntity.ok(schema);
    }

    /**
     * Check if a datasource is DuckDB
     */
    private boolean isDuckDB(Long datasourceId) {
        return datasourceService.getDatasourceById(datasourceId)
                .map(ds -> ds.getDriverClassName().contains("duckdb"))
                .orElse(false);
    }

    /**
     * Get database information
     */
    @GetMapping("/db-info")
    public ResponseEntity<Map<String, Object>> getDatabaseInfo(@RequestParam Long datasourceId) {
        Map<String, Object> info = new HashMap<>();

        // Get datasource info
        datasourceService.getDatasourceById(datasourceId).ifPresent(ds -> {
            info.put("name", ds.getName());
            info.put("type", getDbType(ds));

            // Get version based on db type
            try {
                if (isDuckDB(datasourceId)) {
                    info.put("version", jdbcTemplate.queryForObject("SELECT version()", String.class));
                } else {
                    // Generic approach for most databases
                    info.put("version", jdbcTemplate.queryForObject("SELECT version()", String.class));
                }
            } catch (Exception e) {
                info.put("error", e.getMessage());
            }
        });

        return ResponseEntity.ok(info);
    }

    private String getDbType(Datasource datasource) {
        String driver = datasource.getDriverClassName().toLowerCase();
        if (driver.contains("duckdb")) return "DuckDB";
        if (driver.contains("postgres")) return "PostgreSQL";
        if (driver.contains("h2")) return "H2";
        return "Unknown";
    }
}