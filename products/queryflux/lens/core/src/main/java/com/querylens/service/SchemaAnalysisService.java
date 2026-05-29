package com.querylens.service;

import com.querylens.model.Datasource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

import java.sql.*;
import java.util.*;

/**
 * Service for analyzing database schemas and providing intelligence for better query generation
 */
@Service
@Slf4j
public class SchemaAnalysisService {

    /**
     * Analyze a datasource and extract comprehensive schema information
     */
    public Map<String, Object> analyzeDatasource(Datasource datasource) {
        Map<String, Object> analysis = new HashMap<>();
        
        try {
            DriverManagerDataSource dataSource = createDataSource(datasource);
            
            // Get basic database info
            analysis.put("databaseInfo", getDatabaseInfo(dataSource));
            
            // Get table analysis
            analysis.put("tables", analyzeAllTables(dataSource));
            
            // Get relationships
            analysis.put("relationships", analyzeRelationships(dataSource));
            
            // Get indexes
            analysis.put("indexes", analyzeIndexes(dataSource));
            
            // Generate recommendations
            analysis.put("recommendations", generateRecommendations(analysis));
            
            log.info("Successfully analyzed datasource: {}", datasource.getName());
            
        } catch (Exception e) {
            log.error("Failed to analyze datasource: {}", datasource.getName(), e);
            analysis.put("error", e.getMessage());
        }
        
        return analysis;
    }

    /**
     * Get database metadata information
     */
    private Map<String, Object> getDatabaseInfo(DriverManagerDataSource dataSource) throws SQLException {
        Map<String, Object> info = new HashMap<>();
        
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            info.put("databaseProduct", metaData.getDatabaseProductName());
            info.put("databaseVersion", metaData.getDatabaseProductVersion());
            info.put("driverName", metaData.getDriverName());
            info.put("driverVersion", metaData.getDriverVersion());
            info.put("maxConnections", metaData.getMaxConnections());
            info.put("supportsTransactions", metaData.supportsTransactions());
            info.put("catalog", conn.getCatalog());
            info.put("schema", conn.getSchema());
        }
        
        return info;
    }

    /**
     * Analyze all tables in the database
     */
    private List<Map<String, Object>> analyzeAllTables(DriverManagerDataSource dataSource) throws SQLException {
        List<Map<String, Object>> tables = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Get all tables
            try (ResultSet rs = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    
                    Map<String, Object> tableInfo = new HashMap<>();
                    tableInfo.put("name", tableName);
                    tableInfo.put("type", rs.getString("TABLE_TYPE"));
                    tableInfo.put("remarks", rs.getString("REMARKS"));
                    
                    // Get columns for this table
                    tableInfo.put("columns", analyzeTableColumns(metaData, tableName));
                    
                    // Get primary keys
                    tableInfo.put("primaryKeys", getPrimaryKeys(metaData, tableName));
                    
                    // Get foreign keys
                    tableInfo.put("foreignKeys", getForeignKeys(metaData, tableName));
                    
                    // Estimate row count (basic approach)
                    tableInfo.put("estimatedRowCount", estimateRowCount(conn, tableName));
                    
                    // Analyze column patterns and suggest entity types
                    tableInfo.put("suggestions", generateTableSuggestions(tableInfo));
                    
                    tables.add(tableInfo);
                }
            }
        }
        
        return tables;
    }

    /**
     * Analyze columns for a specific table
     */
    private List<Map<String, Object>> analyzeTableColumns(DatabaseMetaData metaData, String tableName) throws SQLException {
        List<Map<String, Object>> columns = new ArrayList<>();
        
        try (ResultSet rs = metaData.getColumns(null, null, tableName, "%")) {
            while (rs.next()) {
                Map<String, Object> column = new HashMap<>();
                column.put("name", rs.getString("COLUMN_NAME"));
                column.put("type", rs.getString("TYPE_NAME"));
                column.put("size", rs.getInt("COLUMN_SIZE"));
                column.put("nullable", rs.getBoolean("NULLABLE"));
                column.put("defaultValue", rs.getString("COLUMN_DEF"));
                column.put("autoIncrement", rs.getBoolean("IS_AUTOINCREMENT"));
                column.put("position", rs.getInt("ORDINAL_POSITION"));
                
                // Analyze column semantics
                column.put("semanticType", inferColumnSemanticType(rs.getString("COLUMN_NAME"), rs.getString("TYPE_NAME")));
                
                columns.add(column);
            }
        }
        
        return columns;
    }

    /**
     * Infer semantic type from column name and SQL type
     */
    private String inferColumnSemanticType(String columnName, String sqlType) {
        String lowerName = columnName.toLowerCase();
        
        // Primary key detection
        if (lowerName.equals("id") || lowerName.endsWith("_id")) {
            return "primary_key_or_foreign_key";
        }
        
        // Timestamp fields
        if (lowerName.contains("created") || lowerName.contains("updated") || 
            lowerName.contains("date") || lowerName.contains("time")) {
            return "timestamp";
        }
        
        // Status fields
        if (lowerName.contains("status") || lowerName.contains("state")) {
            return "status";
        }
        
        // Name fields
        if (lowerName.contains("name") || lowerName.contains("title")) {
            return "name";
        }
        
        // Email fields
        if (lowerName.contains("email")) {
            return "email";
        }
        
        // Phone fields
        if (lowerName.contains("phone") || lowerName.contains("mobile")) {
            return "phone";
        }
        
        // Address fields
        if (lowerName.contains("address") || lowerName.contains("street") || 
            lowerName.contains("city") || lowerName.contains("zip")) {
            return "address";
        }
        
        // Monetary fields
        if (lowerName.contains("price") || lowerName.contains("amount") || 
            lowerName.contains("cost") || lowerName.contains("revenue")) {
            return "monetary";
        }
        
        // Quantity fields
        if (lowerName.contains("count") || lowerName.contains("quantity") || 
            lowerName.contains("qty")) {
            return "quantity";
        }
        
        // Boolean fields
        if (sqlType.toLowerCase().contains("bool") || lowerName.startsWith("is_") || 
            lowerName.startsWith("has_")) {
            return "boolean";
        }
        
        return "general";
    }

    /**
     * Get primary keys for a table
     */
    private List<String> getPrimaryKeys(DatabaseMetaData metaData, String tableName) throws SQLException {
        List<String> primaryKeys = new ArrayList<>();
        
        try (ResultSet rs = metaData.getPrimaryKeys(null, null, tableName)) {
            while (rs.next()) {
                primaryKeys.add(rs.getString("COLUMN_NAME"));
            }
        }
        
        return primaryKeys;
    }

    /**
     * Get foreign keys for a table
     */
    private List<Map<String, Object>> getForeignKeys(DatabaseMetaData metaData, String tableName) throws SQLException {
        List<Map<String, Object>> foreignKeys = new ArrayList<>();
        
        try (ResultSet rs = metaData.getImportedKeys(null, null, tableName)) {
            while (rs.next()) {
                Map<String, Object> fk = new HashMap<>();
                fk.put("columnName", rs.getString("FKCOLUMN_NAME"));
                fk.put("referencedTable", rs.getString("PKTABLE_NAME"));
                fk.put("referencedColumn", rs.getString("PKCOLUMN_NAME"));
                fk.put("keyName", rs.getString("FK_NAME"));
                foreignKeys.add(fk);
            }
        }
        
        return foreignKeys;
    }

    /**
     * Estimate row count for a table
     */
    private long estimateRowCount(Connection conn, String tableName) {
        try {
            JdbcTemplate jdbcTemplate = new JdbcTemplate();
            jdbcTemplate.setDataSource(new DriverManagerDataSource() {{
                setUrl(conn.getMetaData().getURL());
            }});
            
            return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + tableName, Long.class);
        } catch (Exception e) {
            log.debug("Could not estimate row count for table {}: {}", tableName, e.getMessage());
            return -1;
        }
    }

    /**
     * Analyze relationships between tables
     */
    private List<Map<String, Object>> analyzeRelationships(DriverManagerDataSource dataSource) throws SQLException {
        List<Map<String, Object>> relationships = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Get all tables first
            Set<String> tables = new HashSet<>();
            try (ResultSet rs = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    tables.add(rs.getString("TABLE_NAME"));
                }
            }
            
            // For each table, get its foreign keys
            for (String tableName : tables) {
                try (ResultSet rs = metaData.getImportedKeys(null, null, tableName)) {
                    while (rs.next()) {
                        Map<String, Object> relationship = new HashMap<>();
                        relationship.put("fromTable", tableName);
                        relationship.put("fromColumn", rs.getString("FKCOLUMN_NAME"));
                        relationship.put("toTable", rs.getString("PKTABLE_NAME"));
                        relationship.put("toColumn", rs.getString("PKCOLUMN_NAME"));
                        relationship.put("relationshipName", rs.getString("FK_NAME"));
                        relationships.add(relationship);
                    }
                }
            }
        }
        
        return relationships;
    }

    /**
     * Analyze indexes
     */
    private List<Map<String, Object>> analyzeIndexes(DriverManagerDataSource dataSource) throws SQLException {
        List<Map<String, Object>> indexes = new ArrayList<>();
        
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            
            // Get all tables first
            try (ResultSet tables = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
                while (tables.next()) {
                    String tableName = tables.getString("TABLE_NAME");
                    
                    // Get indexes for this table
                    try (ResultSet rs = metaData.getIndexInfo(null, null, tableName, false, false)) {
                        while (rs.next()) {
                            if (rs.getString("INDEX_NAME") != null) {
                                Map<String, Object> index = new HashMap<>();
                                index.put("tableName", tableName);
                                index.put("indexName", rs.getString("INDEX_NAME"));
                                index.put("columnName", rs.getString("COLUMN_NAME"));
                                index.put("unique", !rs.getBoolean("NON_UNIQUE"));
                                index.put("ordinalPosition", rs.getInt("ORDINAL_POSITION"));
                                indexes.add(index);
                            }
                        }
                    }
                }
            }
        }
        
        return indexes;
    }

    /**
     * Generate table suggestions based on analysis
     */
    private Map<String, Object> generateTableSuggestions(Map<String, Object> tableInfo) {
        Map<String, Object> suggestions = new HashMap<>();
        String tableName = (String) tableInfo.get("name");
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> columns = (List<Map<String, Object>>) tableInfo.get("columns");
        
        // Suggest common query patterns
        List<String> queryPatterns = new ArrayList<>();
        
        // Check for status columns
        boolean hasStatus = columns.stream()
            .anyMatch(col -> ((String) col.get("name")).toLowerCase().contains("status"));
        if (hasStatus) {
            queryPatterns.add("Find all active " + tableName.toLowerCase());
            queryPatterns.add("Show inactive " + tableName.toLowerCase());
        }
        
        // Check for date columns
        boolean hasDateColumn = columns.stream()
            .anyMatch(col -> "timestamp".equals(col.get("semanticType")));
        if (hasDateColumn) {
            queryPatterns.add("Show " + tableName.toLowerCase() + " from last month");
            queryPatterns.add("Count " + tableName.toLowerCase() + " by date");
        }
        
        // Check for monetary columns
        boolean hasMonetaryColumn = columns.stream()
            .anyMatch(col -> "monetary".equals(col.get("semanticType")));
        if (hasMonetaryColumn) {
            queryPatterns.add("Top 10 " + tableName.toLowerCase() + " by value");
            queryPatterns.add("Sum of all " + tableName.toLowerCase() + " amounts");
        }
        
        suggestions.put("recommendedQueries", queryPatterns);
        suggestions.put("entityType", inferEntityType(tableName, columns));
        
        return suggestions;
    }

    /**
     * Infer what type of entity this table represents
     */
    private String inferEntityType(String tableName, List<Map<String, Object>> columns) {
        String lowerName = tableName.toLowerCase();
        
        if (lowerName.contains("user") || lowerName.contains("customer") || lowerName.contains("client")) {
            return "people";
        }
        if (lowerName.contains("order") || lowerName.contains("purchase") || lowerName.contains("transaction")) {
            return "transactions";
        }
        if (lowerName.contains("product") || lowerName.contains("item") || lowerName.contains("inventory")) {
            return "items";
        }
        if (lowerName.contains("log") || lowerName.contains("audit") || lowerName.contains("event")) {
            return "events";
        }
        
        return "entity";
    }

    /**
     * Generate recommendations based on the analysis
     */
    private Map<String, Object> generateRecommendations(Map<String, Object> analysis) {
        Map<String, Object> recommendations = new HashMap<>();
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tables = (List<Map<String, Object>>) analysis.get("tables");
        
        if (tables != null) {
            // Suggest indexes for frequently queried columns
            List<String> indexRecommendations = new ArrayList<>();
            
            // Suggest common query patterns
            List<String> queryPatterns = new ArrayList<>();
            
            for (Map<String, Object> table : tables) {
                String tableName = (String) table.get("name");
                
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> columns = (List<Map<String, Object>>) table.get("columns");
                
                // Look for columns that would benefit from indexes
                for (Map<String, Object> column : columns) {
                    String semanticType = (String) column.get("semanticType");
                    String columnName = (String) column.get("name");
                    
                    if ("status".equals(semanticType) || "timestamp".equals(semanticType)) {
                        indexRecommendations.add("Consider adding index on " + tableName + "." + columnName);
                    }
                }
                
                // Extract query patterns from table suggestions
                @SuppressWarnings("unchecked")
                Map<String, Object> suggestions = (Map<String, Object>) table.get("suggestions");
                if (suggestions != null) {
                    @SuppressWarnings("unchecked")
                    List<String> patterns = (List<String>) suggestions.get("recommendedQueries");
                    if (patterns != null) {
                        queryPatterns.addAll(patterns);
                    }
                }
            }
            
            recommendations.put("indexRecommendations", indexRecommendations);
            recommendations.put("commonQueryPatterns", queryPatterns);
        }
        
        return recommendations;
    }

    /**
     * Create a data source from datasource configuration
     */
    private DriverManagerDataSource createDataSource(Datasource datasource) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName(datasource.getDriverClassName());
        dataSource.setUrl(datasource.getUrl());
        
        // Use default credentials for H2 if not provided
        if (datasource.getUrl().contains("h2") && 
            (datasource.getUsername() == null || datasource.getUsername().isEmpty())) {
            dataSource.setUsername("sa");
            dataSource.setPassword("");
        } else {
            dataSource.setUsername(datasource.getUsername());
            dataSource.setPassword(datasource.getPassword());
        }
        
        return dataSource;
    }

    /**
     * Test datasource connection
     */
    public Map<String, Object> testConnection(Datasource datasource) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            DriverManagerDataSource dataSource = createDataSource(datasource);
            
            try (Connection conn = dataSource.getConnection()) {
                DatabaseMetaData metaData = conn.getMetaData();
                
                result.put("success", true);
                result.put("message", "Connection successful");
                result.put("databaseProduct", metaData.getDatabaseProductName());
                result.put("databaseVersion", metaData.getDatabaseProductVersion());
                
                // Quick table count
                int tableCount = 0;
                try (ResultSet rs = metaData.getTables(null, null, "%", new String[]{"TABLE"})) {
                    while (rs.next()) {
                        tableCount++;
                    }
                }
                result.put("tableCount", tableCount);
                
                log.info("Successfully tested connection to: {}", datasource.getName());
            }
            
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Connection failed: " + e.getMessage());
            log.error("Failed to test connection to: {}", datasource.getName(), e);
        }
        
        return result;
    }
}