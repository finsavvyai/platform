package com.querylens.model;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class NlpAnalysis {
    private String intent;
    private double confidence;
    private List<Entity> entities;
    private String originalQuery;
    
    @Data
    public static class Entity {
        private String text;
        private String type;
        private Map<String, Object> metadata;
    }
}
