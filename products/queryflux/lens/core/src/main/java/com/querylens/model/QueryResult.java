package com.querylens.model;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class QueryResult {
    private String originalQuery;
    private String generatedSql;
    private List<Map<String, Object>> data;
    private List<String> columns;
    private String error;
    private boolean success;
    private long executionTimeMs;
    private Map<String, Object> debug;
}
