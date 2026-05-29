// File: src/main/java/com/querylens/api/DatasourceController.java
package com.querylens.api;

import com.querylens.model.Datasource;
import com.querylens.service.DatasourceService;
import com.querylens.service.SchemaAnalysisService;
import com.querylens.service.McpServerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Map;

/**
 * Enhanced controller for managing datasource connections with analysis capabilities
 */
@RestController
@RequestMapping("/api/datasources")
@Slf4j
public class DatasourceController {

    private final DatasourceService datasourceService;
    private final SchemaAnalysisService schemaAnalysisService;
    private final McpServerService mcpServerService;

    public DatasourceController(DatasourceService datasourceService, 
                               SchemaAnalysisService schemaAnalysisService,
                               McpServerService mcpServerService) {
        this.datasourceService = datasourceService;
        this.schemaAnalysisService = schemaAnalysisService;
        this.mcpServerService = mcpServerService;
    }

    /**
     * Get all datasources
     *
     * @return List of all datasources
     */
    @GetMapping
    public ResponseEntity<List<Datasource>> getAllDatasources() {
        return ResponseEntity.ok(datasourceService.getAllDatasources());
    }

    /**
     * Get a datasource by ID
     *
     * @param id The datasource ID
     * @return The datasource if found
     */
    @GetMapping("/{id}")
    public ResponseEntity<Datasource> getDatasourceById(@PathVariable Long id) {
        return datasourceService.getDatasourceById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new datasource
     *
     * @param datasource The datasource to create
     * @return The ID of the created datasource
     */
    @PostMapping
    public ResponseEntity<Long> createDatasource(@RequestBody Datasource datasource) {
        Long id = datasourceService.saveDatasource(datasource);
        return ResponseEntity.ok(id);
    }

    /**
     * Update an existing datasource
     *
     * @param id The ID of the datasource to update
     * @param datasource The updated datasource data
     * @return 200 OK if successful
     */
    @PutMapping("/{id}")
    public ResponseEntity<Void> updateDatasource(@PathVariable Long id, @RequestBody Datasource datasource) {
        datasource.setId(id);
        datasourceService.saveDatasource(datasource);
        return ResponseEntity.ok().build();
    }

    /**
     * Test connection to a datasource
     *
     * @param datasource The datasource to test (can be existing or new)
     * @return Connection test results
     */
    @PostMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection(@RequestBody Datasource datasource) {
        log.info("Testing connection to datasource: {}", datasource.getName());
        Map<String, Object> result = schemaAnalysisService.testConnection(datasource);
        return ResponseEntity.ok(result);
    }

    /**
     * Analyze a datasource schema comprehensively
     *
     * @param id The datasource ID to analyze
     * @return Comprehensive schema analysis including tables, relationships, and recommendations
     */
    @PostMapping("/{id}/analyze")
    public ResponseEntity<Map<String, Object>> analyzeDatasource(@PathVariable Long id) {
        return datasourceService.getDatasourceById(id)
            .map(datasource -> {
                log.info("Analyzing datasource: {}", datasource.getName());
                
                // Get basic analysis
                Map<String, Object> basicAnalysis = schemaAnalysisService.analyzeDatasource(datasource);
                
                // Enhance with MCP server if available
                String databaseType = extractDatabaseType(datasource);
                Map<String, Object> enhancedAnalysis = mcpServerService.getEnhancedSchemaAnalysis(basicAnalysis, databaseType);
                
                return ResponseEntity.ok(enhancedAnalysis);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get intelligent query suggestions for a datasource
     *
     * @param id The datasource ID
     * @param query The natural language query to get suggestions for
     * @return List of intelligent query suggestions
     */
    @GetMapping("/{id}/suggestions")
    public ResponseEntity<Map<String, Object>> getQuerySuggestions(
            @PathVariable Long id, 
            @RequestParam String query) {
        
        return datasourceService.getDatasourceById(id)
            .map(datasource -> {
                log.debug("Getting query suggestions for: {}", query);
                
                // Get schema context
                Map<String, Object> schemaContext = schemaAnalysisService.analyzeDatasource(datasource);
                
                // Get suggestions from MCP server
                List<String> suggestions = mcpServerService.getIntelligentQuerySuggestions(query, schemaContext);
                
                Map<String, Object> result = Map.of(
                    "query", query,
                    "suggestions", suggestions,
                    "datasource", datasource.getName()
                );
                
                return ResponseEntity.ok(result);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get database health insights
     *
     * @param id The datasource ID
     * @return Health insights and recommendations
     */
    @GetMapping("/{id}/health")
    public ResponseEntity<Map<String, Object>> getDatabaseHealth(@PathVariable Long id) {
        return datasourceService.getDatasourceById(id)
            .map(datasource -> {
                log.info("Getting health insights for datasource: {}", datasource.getName());
                
                // Get database metrics through analysis
                Map<String, Object> analysis = schemaAnalysisService.analyzeDatasource(datasource);
                
                // Get health insights from MCP server
                Map<String, Object> healthInsights = mcpServerService.getDatabaseHealthInsights(analysis);
                
                return ResponseEntity.ok(healthInsights);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get MCP server status and capabilities
     *
     * @return MCP server status information
     */
    @GetMapping("/mcp-status")
    public ResponseEntity<Map<String, Object>> getMcpStatus() {
        Map<String, Object> status = mcpServerService.getMcpServerStatus();
        return ResponseEntity.ok(status);
    }

    /**
     * Get enhanced schema summary for a datasource
     *
     * @param id The datasource ID
     * @return Schema summary with AI insights
     */
    @GetMapping("/{id}/schema-summary")
    public ResponseEntity<Map<String, Object>> getSchemaSummary(@PathVariable Long id) {
        return datasourceService.getDatasourceById(id)
            .map(datasource -> {
                Map<String, Object> analysis = schemaAnalysisService.analyzeDatasource(datasource);
                
                // Extract summary information
                Map<String, Object> summary = extractSchemaSummary(analysis);
                
                return ResponseEntity.ok(summary);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Onboard a new datasource with guided setup
     *
     * @param onboardingRequest Contains datasource info and setup preferences
     * @return Onboarding results with analysis and recommendations
     */
    @PostMapping("/onboard")
    public ResponseEntity<Map<String, Object>> onboardDatasource(@RequestBody Map<String, Object> onboardingRequest) {
        try {
            // Extract datasource from request
            @SuppressWarnings("unchecked")
            Map<String, Object> dsData = (Map<String, Object>) onboardingRequest.get("datasource");
            
            Datasource datasource = new Datasource();
            datasource.setName((String) dsData.get("name"));
            datasource.setDescription((String) dsData.get("description"));
            datasource.setUrl((String) dsData.get("url"));
            datasource.setUsername((String) dsData.get("username"));
            datasource.setPassword((String) dsData.get("password"));
            datasource.setDriverClassName((String) dsData.get("driverClassName"));
            
            // Test connection first
            Map<String, Object> connectionTest = schemaAnalysisService.testConnection(datasource);
            
            if (!Boolean.TRUE.equals(connectionTest.get("success"))) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", "Connection test failed: " + connectionTest.get("message")
                ));
            }
            
            // Save datasource
            Long datasourceId = datasourceService.saveDatasource(datasource);
            datasource.setId(datasourceId);
            
            // Perform analysis
            Map<String, Object> analysis = schemaAnalysisService.analyzeDatasource(datasource);
            
            // Enhance with MCP server
            String databaseType = extractDatabaseType(datasource);
            Map<String, Object> enhancedAnalysis = mcpServerService.getEnhancedSchemaAnalysis(analysis, databaseType);
            
            Map<String, Object> result = Map.of(
                "success", true,
                "datasourceId", datasourceId,
                "connectionTest", connectionTest,
                "analysis", enhancedAnalysis,
                "recommendations", extractOnboardingRecommendations(enhancedAnalysis)
            );
            
            log.info("Successfully onboarded datasource: {} (ID: {})", datasource.getName(), datasourceId);
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            log.error("Failed to onboard datasource", e);
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }

    // Helper methods

    private String extractDatabaseType(Datasource datasource) {
        String driver = datasource.getDriverClassName().toLowerCase();
        if (driver.contains("postgres")) return "postgresql";
        if (driver.contains("mysql")) return "mysql";
        if (driver.contains("h2")) return "h2";
        if (driver.contains("oracle")) return "oracle";
        if (driver.contains("sqlserver")) return "sqlserver";
        if (driver.contains("duckdb")) return "duckdb";
        return "unknown";
    }

    private Map<String, Object> extractSchemaSummary(Map<String, Object> analysis) {
        Map<String, Object> summary = Map.of(
            "tableCount", getTableCount(analysis),
            "relationshipCount", getRelationshipCount(analysis),
            "indexCount", getIndexCount(analysis),
            "databaseInfo", analysis.get("databaseInfo"),
            "keyInsights", extractKeyInsights(analysis)
        );
        return summary;
    }

    private int getTableCount(Map<String, Object> analysis) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tables = (List<Map<String, Object>>) analysis.get("tables");
        return tables != null ? tables.size() : 0;
    }

    private int getRelationshipCount(Map<String, Object> analysis) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> relationships = (List<Map<String, Object>>) analysis.get("relationships");
        return relationships != null ? relationships.size() : 0;
    }

    private int getIndexCount(Map<String, Object> analysis) {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> indexes = (List<Map<String, Object>>) analysis.get("indexes");
        return indexes != null ? indexes.size() : 0;
    }

    private List<String> extractKeyInsights(Map<String, Object> analysis) {
        List<String> insights = List.of(
            "Schema analysis completed successfully",
            "Ready for natural language queries",
            "Database structure detected and catalogued"
        );
        return insights;
    }

    private List<String> extractOnboardingRecommendations(Map<String, Object> analysis) {
        List<String> recommendations = List.of(
            "Database successfully analyzed and ready for use",
            "Try natural language queries like 'Show all records' or 'Count by category'",
            "Check the dashboard for common query patterns",
            "Review the schema analysis for optimization suggestions"
        );
        return recommendations;
    }
}