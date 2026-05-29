package com.querylens.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Service for communicating with MCP (Model Context Protocol) servers
 * that provide advanced database analysis capabilities
 */
@Service
@Slf4j
public class McpServerService {

    @Value("${mcp.server.url:http://localhost:3000}")
    private String mcpServerUrl;

    @Value("${mcp.server.enabled:false}")
    private boolean mcpServerEnabled;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Get enhanced schema analysis from MCP server
     */
    public Map<String, Object> getEnhancedSchemaAnalysis(Map<String, Object> basicAnalysis, String databaseType) {
        if (!mcpServerEnabled) {
            log.debug("MCP server integration is disabled");
            return enhanceAnalysisLocally(basicAnalysis);
        }

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("method", "analyze_schema");
            request.put("params", Map.of(
                "schema_data", basicAnalysis,
                "database_type", databaseType,
                "analysis_level", "comprehensive"
            ));

            Map<String, Object> response = callMcpServer("/analyze", request);
            
            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) response.get("result");
                log.info("Successfully received enhanced analysis from MCP server");
                return result;
            } else {
                log.warn("MCP server returned error or no result, falling back to local analysis");
                return enhanceAnalysisLocally(basicAnalysis);
            }

        } catch (Exception e) {
            log.error("Failed to communicate with MCP server, falling back to local analysis", e);
            return enhanceAnalysisLocally(basicAnalysis);
        }
    }

    /**
     * Get intelligent query suggestions from MCP server
     */
    public List<String> getIntelligentQuerySuggestions(String naturalLanguageQuery, Map<String, Object> schemaContext) {
        if (!mcpServerEnabled) {
            return generateLocalQuerySuggestions(naturalLanguageQuery, schemaContext);
        }

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("method", "suggest_queries");
            request.put("params", Map.of(
                "query", naturalLanguageQuery,
                "schema_context", schemaContext,
                "max_suggestions", 5
            ));

            Map<String, Object> response = callMcpServer("/suggest", request);
            
            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                @SuppressWarnings("unchecked")
                List<String> suggestions = (List<String>) response.get("suggestions");
                log.debug("Received {} query suggestions from MCP server", suggestions.size());
                return suggestions;
            }

        } catch (Exception e) {
            log.error("Failed to get query suggestions from MCP server", e);
        }

        return generateLocalQuerySuggestions(naturalLanguageQuery, schemaContext);
    }

    /**
     * Get optimized SQL query from MCP server
     */
    public Map<String, Object> getOptimizedQuery(String naturalLanguageQuery, Map<String, Object> schemaContext, String databaseType) {
        if (!mcpServerEnabled) {
            return generateLocalOptimizedQuery(naturalLanguageQuery, schemaContext);
        }

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("method", "optimize_query");
            request.put("params", Map.of(
                "natural_query", naturalLanguageQuery,
                "schema_context", schemaContext,
                "database_type", databaseType,
                "optimization_level", "balanced"
            ));

            Map<String, Object> response = callMcpServer("/optimize", request);
            
            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) response.get("result");
                log.debug("Received optimized query from MCP server");
                return result;
            }

        } catch (Exception e) {
            log.error("Failed to get optimized query from MCP server", e);
        }

        return generateLocalOptimizedQuery(naturalLanguageQuery, schemaContext);
    }

    /**
     * Get database health insights from MCP server
     */
    public Map<String, Object> getDatabaseHealthInsights(Map<String, Object> databaseMetrics) {
        if (!mcpServerEnabled) {
            return generateLocalHealthInsights(databaseMetrics);
        }

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("method", "health_insights");
            request.put("params", Map.of(
                "metrics", databaseMetrics,
                "insight_types", Arrays.asList("performance", "optimization", "security")
            ));

            Map<String, Object> response = callMcpServer("/health", request);
            
            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> insights = (Map<String, Object>) response.get("insights");
                log.debug("Received health insights from MCP server");
                return insights;
            }

        } catch (Exception e) {
            log.error("Failed to get health insights from MCP server", e);
        }

        return generateLocalHealthInsights(databaseMetrics);
    }

    /**
     * Check if MCP server is available and get capabilities
     */
    public Map<String, Object> getMcpServerStatus() {
        Map<String, Object> status = new HashMap<>();
        status.put("enabled", mcpServerEnabled);
        status.put("url", mcpServerUrl);

        if (!mcpServerEnabled) {
            status.put("available", false);
            status.put("message", "MCP server integration is disabled");
            return status;
        }

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("method", "get_capabilities");
            request.put("params", Map.of());

            Map<String, Object> response = callMcpServer("/status", request);
            
            if (response != null) {
                status.put("available", true);
                status.put("capabilities", response.get("capabilities"));
                status.put("version", response.get("version"));
                status.put("message", "MCP server is available");
            } else {
                status.put("available", false);
                status.put("message", "MCP server did not respond");
            }

        } catch (Exception e) {
            status.put("available", false);
            status.put("message", "MCP server connection failed: " + e.getMessage());
            log.debug("MCP server not available: {}", e.getMessage());
        }

        return status;
    }

    /**
     * Call MCP server with the given request
     */
    private Map<String, Object> callMcpServer(String endpoint, Map<String, Object> request) throws Exception {
        try (CloseableHttpClient client = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(mcpServerUrl + endpoint);

            StringEntity entity = new StringEntity(objectMapper.writeValueAsString(request));
            httpPost.setEntity(entity);
            httpPost.setHeader("Accept", "application/json");
            httpPost.setHeader("Content-type", "application/json");

            try (CloseableHttpResponse response = client.execute(httpPost)) {
                if (response.getStatusLine().getStatusCode() == 200) {
                    String responseJson = EntityUtils.toString(response.getEntity());
                    return objectMapper.readValue(responseJson, Map.class);
                } else {
                    log.warn("MCP server returned status code: {}", response.getStatusLine().getStatusCode());
                    return null;
                }
            }
        }
    }

    // Fallback methods when MCP server is not available

    /**
     * Local enhancement of schema analysis (fallback)
     */
    private Map<String, Object> enhanceAnalysisLocally(Map<String, Object> basicAnalysis) {
        Map<String, Object> enhanced = new HashMap<>(basicAnalysis);
        
        // Add local enhancements
        enhanced.put("enhancementSource", "local");
        enhanced.put("aiInsights", generateLocalAIInsights(basicAnalysis));
        enhanced.put("queryOptimizationTips", generateLocalOptimizationTips(basicAnalysis));
        
        return enhanced;
    }

    /**
     * Generate local AI insights (fallback)
     */
    private Map<String, Object> generateLocalAIInsights(Map<String, Object> analysis) {
        Map<String, Object> insights = new HashMap<>();
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tables = (List<Map<String, Object>>) analysis.get("tables");
        
        if (tables != null) {
            List<String> patterns = new ArrayList<>();
            List<String> recommendations = new ArrayList<>();
            
            for (Map<String, Object> table : tables) {
                String tableName = (String) table.get("name");
                Long rowCount = (Long) table.get("estimatedRowCount");
                
                if (rowCount != null && rowCount > 100000) {
                    recommendations.add("Large table detected: " + tableName + " (" + rowCount + " rows). Consider partitioning.");
                }
                
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> columns = (List<Map<String, Object>>) table.get("columns");
                if (columns != null) {
                    boolean hasTimestamp = columns.stream()
                        .anyMatch(col -> "timestamp".equals(col.get("semanticType")));
                    
                    if (hasTimestamp) {
                        patterns.add("Time-series data detected in " + tableName + " - good for trend analysis");
                    }
                }
            }
            
            insights.put("detectedPatterns", patterns);
            insights.put("recommendations", recommendations);
        }
        
        return insights;
    }

    /**
     * Generate local optimization tips (fallback)
     */
    private List<String> generateLocalOptimizationTips(Map<String, Object> analysis) {
        List<String> tips = new ArrayList<>();
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tables = (List<Map<String, Object>>) analysis.get("tables");
        
        if (tables != null && tables.size() > 10) {
            tips.add("Consider database normalization - " + tables.size() + " tables detected");
        }
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> relationships = (List<Map<String, Object>>) analysis.get("relationships");
        
        if (relationships != null && relationships.isEmpty() && tables != null && tables.size() > 1) {
            tips.add("No foreign key relationships detected - consider adding referential integrity");
        }
        
        tips.add("Enable query logging to monitor performance");
        tips.add("Consider adding indexes on frequently queried columns");
        
        return tips;
    }

    /**
     * Generate local query suggestions (fallback)
     */
    private List<String> generateLocalQuerySuggestions(String query, Map<String, Object> schemaContext) {
        List<String> suggestions = new ArrayList<>();
        
        // Basic pattern matching for common queries
        String lowerQuery = query.toLowerCase();
        
        if (lowerQuery.contains("count")) {
            suggestions.add("Try: 'Count all records in [table_name]'");
            suggestions.add("Try: 'Count records by category'");
        }
        
        if (lowerQuery.contains("top") || lowerQuery.contains("best")) {
            suggestions.add("Try: 'Show top 10 records by value'");
            suggestions.add("Try: 'Find highest performing items'");
        }
        
        if (lowerQuery.contains("date") || lowerQuery.contains("time")) {
            suggestions.add("Try: 'Show records from last month'");
            suggestions.add("Try: 'Group results by date'");
        }
        
        return suggestions;
    }

    /**
     * Generate local optimized query (fallback)
     */
    private Map<String, Object> generateLocalOptimizedQuery(String query, Map<String, Object> schemaContext) {
        Map<String, Object> result = new HashMap<>();
        
        result.put("optimizedQuery", "SELECT * FROM your_table LIMIT 100");
        result.put("explanation", "Local fallback - basic query structure");
        result.put("optimizationApplied", Arrays.asList("Added LIMIT clause", "Used standard SQL syntax"));
        result.put("source", "local");
        
        return result;
    }

    /**
     * Generate local health insights (fallback)
     */
    private Map<String, Object> generateLocalHealthInsights(Map<String, Object> metrics) {
        Map<String, Object> insights = new HashMap<>();
        
        insights.put("overallHealth", "good");
        insights.put("recommendations", Arrays.asList(
            "Monitor query performance regularly",
            "Keep database statistics up to date",
            "Consider periodic maintenance tasks"
        ));
        insights.put("source", "local");
        
        return insights;
    }
}