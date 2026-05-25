package com.querylens.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.querylens.model.NlpAnalysis;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Client service for communicating with the NLP processing service
 */
@Service
public class NlpClient {

    @Value("${nlp.service.url}")
    private String nlpServiceUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Send a natural language query to the NLP service for analysis
     *
     * @param query The natural language query to analyze
     * @return The analysis results
     */
    public NlpAnalysis analyze(String query) {
        try (CloseableHttpClient client = HttpClients.createDefault()) {
            HttpPost httpPost = new HttpPost(nlpServiceUrl + "/analyze");

            Map<String, String> requestBody = Collections.singletonMap("query", query);
            StringEntity entity = new StringEntity(objectMapper.writeValueAsString(requestBody));
            httpPost.setEntity(entity);
            httpPost.setHeader("Accept", "application/json");
            httpPost.setHeader("Content-type", "application/json");

            try (CloseableHttpResponse response = client.execute(httpPost)) {
                String responseJson = EntityUtils.toString(response.getEntity());
                return objectMapper.readValue(responseJson, NlpAnalysis.class);
            }
        } catch (Exception e) {
            // In a real app, log this properly
            System.out.println("NLP service not available, using fallback analysis: " + e.getMessage());

            // Return an intelligent fallback analysis based on query text
            return fallbackAnalysis(query);
        }
    }

    /**
     * Generate a fallback NLP analysis when the external service is unavailable
     */
    private NlpAnalysis fallbackAnalysis(String text) {
        // Clean and normalize the text for matching
        String normalizedText = text.toLowerCase().trim();

        // Create a new NLP analysis with the original query
        NlpAnalysis analysis = new NlpAnalysis();
        analysis.setOriginalQuery(text);
        analysis.setEntities(new ArrayList<>());

        // Intent detection scores - we'll use the highest scoring intent
        Map<String, Integer> intentScores = new HashMap<>();
        intentScores.put("aggregation", 0);
        intentScores.put("filtering", 0);
        intentScores.put("trending", 0);
        intentScores.put("comparison", 0);
        intentScores.put("ranking", 0);
        intentScores.put("prediction", 0);
        intentScores.put("correlation", 0);

        // Pattern matching for intent detection
        // Aggregation patterns
        List<String> aggregationPatterns = Arrays.asList(
            "average", "avg", "sum", "total", "count", "how many",
            "maximum", "max", "minimum", "min"
        );

        // Filtering patterns
        List<String> filteringPatterns = Arrays.asList(
            "where", "filter", "find", "search", "show me",
            "greater than", "less than", "equal to", "between",
            "more than", "at least", "at most"
        );

        // Trending patterns
        List<String> trendingPatterns = Arrays.asList(
            "trend", "over time", "by date", "by month", "by year",
            "historical", "history", "growth", "decline", "change"
        );

        // Comparison patterns
        List<String> comparisonPatterns = Arrays.asList(
            "compare", "versus", "vs", "against", "difference",
            "higher than", "lower than", "between", "comparison"
        );

        // Ranking patterns
        List<String> rankingPatterns = Arrays.asList(
            "top", "bottom", "highest", "lowest", "rank", "ranking",
            "best", "worst", "order by", "sorted by", "leading",
            "top 5", "top 10", "bottom 3", "bottom 5", "in terms of"
        );

        // Prediction patterns
        List<String> predictionPatterns = Arrays.asList(
            "predict", "forecast", "projection", "future", "expected",
            "estimate", "anticipate", "outlook", "will be", "going to be",
            "next month", "next year", "next quarter", "future trend"
        );

        // Correlation patterns
        List<String> correlationPatterns = Arrays.asList(
            "correlation", "relationship", "related", "connection", "impact",
            "effect of", "influence", "depend", "associated", "linked",
            "analyze", "analysis", "between", "connection between"
        );

        // Check for each pattern and add to the corresponding intent score
        for (String pattern : aggregationPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("aggregation", intentScores.get("aggregation") + 1);
            }
        }

        for (String pattern : filteringPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("filtering", intentScores.get("filtering") + 1);
            }
        }

        for (String pattern : trendingPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("trending", intentScores.get("trending") + 1);
            }
        }

        for (String pattern : comparisonPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("comparison", intentScores.get("comparison") + 1);
            }
        }

        for (String pattern : rankingPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("ranking", intentScores.get("ranking") + 1);
            }
        }

        for (String pattern : predictionPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("prediction", intentScores.get("prediction") + 1);
            }
        }

        for (String pattern : correlationPatterns) {
            if (normalizedText.contains(pattern)) {
                intentScores.put("correlation", intentScores.get("correlation") + 1);
            }
        }

        // Determine the highest scoring intent
        String highestIntent = "unknown";
        int highestScore = 0;

        for (Map.Entry<String, Integer> entry : intentScores.entrySet()) {
            if (entry.getValue() > highestScore) {
                highestScore = entry.getValue();
                highestIntent = entry.getKey();
            }
        }

        // If no clear intent is detected, default to filtering if it has any score
        if (highestScore == 0 && intentScores.get("filtering") > 0) {
            highestIntent = "filtering";
        }

        // If still no intent, use a simple default
        if (highestScore == 0) {
            highestIntent = "filtering";
        }

        analysis.setIntent(highestIntent);
        analysis.setConfidence(highestScore > 0 ? 0.7 : 0.3);

        // Enhanced entity detection for table mapping
        Map<String, String> entityTableMapping = new HashMap<>();
        entityTableMapping.put("card", "CARDS");
        entityTableMapping.put("cards", "CARDS");
        entityTableMapping.put("credit card", "CARDS");
        entityTableMapping.put("debit card", "CARDS");
        entityTableMapping.put("payment", "CARDS");
        entityTableMapping.put("user", "USERS");
        entityTableMapping.put("users", "USERS");
        entityTableMapping.put("customer", "CUSTOMERS");
        entityTableMapping.put("customers", "CUSTOMERS");
        entityTableMapping.put("client", "CUSTOMERS");
        entityTableMapping.put("order", "ORDERS");
        entityTableMapping.put("orders", "ORDERS");
        entityTableMapping.put("purchase", "ORDERS");
        entityTableMapping.put("transaction", "TRANSACTIONS");
        entityTableMapping.put("transactions", "TRANSACTIONS");
        entityTableMapping.put("product", "PRODUCTS");
        entityTableMapping.put("products", "PRODUCTS");
        entityTableMapping.put("item", "PRODUCTS");
        entityTableMapping.put("items", "PRODUCTS");
        entityTableMapping.put("inventory", "INVENTORY");
        entityTableMapping.put("stock", "INVENTORY");
        entityTableMapping.put("employee", "EMPLOYEES");
        entityTableMapping.put("employees", "EMPLOYEES");
        entityTableMapping.put("staff", "EMPLOYEES");
        entityTableMapping.put("invoice", "INVOICES");
        entityTableMapping.put("invoices", "INVOICES");
        entityTableMapping.put("bill", "INVOICES");
        entityTableMapping.put("account", "ACCOUNTS");
        entityTableMapping.put("accounts", "ACCOUNTS");
        entityTableMapping.put("sample", "SAMPLE_DATA");
        entityTableMapping.put("data", "SAMPLE_DATA");
        entityTableMapping.put("datasource", "DATASOURCES");
        entityTableMapping.put("datasources", "DATASOURCES");
        
        // Check for entity matches in the text
        String detectedTable = null;
        for (Map.Entry<String, String> entry : entityTableMapping.entrySet()) {
            if (normalizedText.contains(entry.getKey())) {
                detectedTable = entry.getValue();
                break; // Use the first match
            }
        }
        
        // Add table entity if detected
        if (detectedTable != null) {
            NlpAnalysis.Entity tableEntity = new NlpAnalysis.Entity();
            tableEntity.setType("table");
            tableEntity.setText(detectedTable);
            analysis.getEntities().add(tableEntity);
        }
        
        // Extract additional attribute entities
        Map<String, String> attributeMapping = new HashMap<>();
        attributeMapping.put("active", "status");
        attributeMapping.put("inactive", "status");
        attributeMapping.put("enabled", "status");
        attributeMapping.put("disabled", "status");
        attributeMapping.put("valid", "status");
        attributeMapping.put("invalid", "status");
        attributeMapping.put("expired", "status");
        attributeMapping.put("pending", "status");
        attributeMapping.put("approved", "status");
        attributeMapping.put("rejected", "status");
        attributeMapping.put("name", "name");
        attributeMapping.put("title", "title");
        attributeMapping.put("description", "description");
        attributeMapping.put("email", "email");
        attributeMapping.put("phone", "phone");
        attributeMapping.put("address", "address");
        attributeMapping.put("amount", "amount");
        attributeMapping.put("price", "price");
        attributeMapping.put("cost", "cost");
        attributeMapping.put("value", "value");
        attributeMapping.put("total", "total");
        attributeMapping.put("count", "count");
        attributeMapping.put("quantity", "quantity");
        attributeMapping.put("date", "date");
        attributeMapping.put("time", "time");
        attributeMapping.put("created", "created_date");
        attributeMapping.put("updated", "updated_date");
        attributeMapping.put("modified", "modified_date");
        
        // Check for attribute matches
        for (Map.Entry<String, String> entry : attributeMapping.entrySet()) {
            if (normalizedText.contains(entry.getKey())) {
                NlpAnalysis.Entity attributeEntity = new NlpAnalysis.Entity();
                attributeEntity.setType("attribute");
                attributeEntity.setText(entry.getValue());
                analysis.getEntities().add(attributeEntity);
            }
        }
        
        // Extract filter conditions for WHERE clauses
        if (normalizedText.contains("active")) {
            NlpAnalysis.Entity filterEntity = new NlpAnalysis.Entity();
            filterEntity.setType("filter");
            filterEntity.setText("status = 'active'");
            analysis.getEntities().add(filterEntity);
        } else if (normalizedText.contains("inactive")) {
            NlpAnalysis.Entity filterEntity = new NlpAnalysis.Entity();
            filterEntity.setType("filter");
            filterEntity.setText("status = 'inactive'");
            analysis.getEntities().add(filterEntity);
        }
        
        // Extract numeric filters
        Pattern numberPattern = Pattern.compile("(greater than|more than|above|over|>)\\s*(\\d+)");
        Matcher numberMatcher = numberPattern.matcher(normalizedText);
        if (numberMatcher.find()) {
            NlpAnalysis.Entity filterEntity = new NlpAnalysis.Entity();
            filterEntity.setType("filter");
            filterEntity.setText("value > " + numberMatcher.group(2));
            analysis.getEntities().add(filterEntity);
        }
        
        // Extract "all" keyword for complete selection
        if (normalizedText.contains("all ") || normalizedText.contains("find all")) {
            NlpAnalysis.Entity selectEntity = new NlpAnalysis.Entity();
            selectEntity.setType("scope");
            selectEntity.setText("all");
            analysis.getEntities().add(selectEntity);
        }

        // Entity extraction for numeric and date ranges
        // This now handles entity extraction for the new intents

        // For ranking intent, look for limit numbers
        if ("ranking".equals(analysis.getIntent())) {
            // Look for "top N" or "bottom N" patterns
            Pattern topPattern = Pattern.compile("top (\\d+)");
            Matcher topMatcher = topPattern.matcher(normalizedText);
            if (topMatcher.find()) {
                NlpAnalysis.Entity limitEntity = new NlpAnalysis.Entity();
                limitEntity.setType("limit");
                limitEntity.setText(topMatcher.group(1));
                analysis.getEntities().add(limitEntity);
                
                // Add DESC order by default for "top"
                NlpAnalysis.Entity orderEntity = new NlpAnalysis.Entity();
                orderEntity.setType("order");
                orderEntity.setText("DESC");
                analysis.getEntities().add(orderEntity);
            } else {
                // Also check just for the word "top" without a number
                if (normalizedText.contains("top") || normalizedText.contains("highest") || 
                    normalizedText.contains("best") || normalizedText.contains("most")) {
                    // Default to top 5
                    NlpAnalysis.Entity limitEntity = new NlpAnalysis.Entity();
                    limitEntity.setType("limit");
                    limitEntity.setText("5");
                    analysis.getEntities().add(limitEntity);
                    
                    // Add DESC order
                    NlpAnalysis.Entity orderEntity = new NlpAnalysis.Entity();
                    orderEntity.setType("order");
                    orderEntity.setText("DESC");
                    analysis.getEntities().add(orderEntity);
                }
            }
            
            Pattern bottomPattern = Pattern.compile("bottom (\\d+)");
            Matcher bottomMatcher = bottomPattern.matcher(normalizedText);
            if (bottomMatcher.find()) {
                NlpAnalysis.Entity limitEntity = new NlpAnalysis.Entity();
                limitEntity.setType("limit");
                limitEntity.setText(bottomMatcher.group(1));
                analysis.getEntities().add(limitEntity);
                
                // Add ASC order for "bottom"
                NlpAnalysis.Entity orderEntity = new NlpAnalysis.Entity();
                orderEntity.setType("order");
                orderEntity.setText("ASC");
                analysis.getEntities().add(orderEntity);
            } else {
                // Also check just for the word "bottom" without a number
                if (normalizedText.contains("bottom") || normalizedText.contains("lowest") || 
                    normalizedText.contains("worst") || normalizedText.contains("least")) {
                    // Default to bottom 5
                    NlpAnalysis.Entity limitEntity = new NlpAnalysis.Entity();
                    limitEntity.setType("limit");
                    limitEntity.setText("5");
                    analysis.getEntities().add(limitEntity);
                    
                    // Add ASC order
                    NlpAnalysis.Entity orderEntity = new NlpAnalysis.Entity();
                    orderEntity.setType("order");
                    orderEntity.setText("ASC");
                    analysis.getEntities().add(orderEntity);
                }
            }
            
            // Look for terms indicating a category grouping
            if (normalizedText.contains("by category") || normalizedText.contains("categories by") ||
                normalizedText.contains("per category") || normalizedText.contains("group by")) {
                NlpAnalysis.Entity categoryEntity = new NlpAnalysis.Entity();
                categoryEntity.setType("column");
                categoryEntity.setText("CATEGORY");
                analysis.getEntities().add(categoryEntity);
            }
        }

        // For prediction intent, extract time frames
        if ("prediction".equals(analysis.getIntent())) {
            Pattern timeframePattern = Pattern.compile("(next|coming|future) (\\d+) (days|weeks|months|years)");
            Matcher timeframeMatcher = timeframePattern.matcher(normalizedText);
            if (timeframeMatcher.find()) {
                NlpAnalysis.Entity timeframeEntity = new NlpAnalysis.Entity();
                timeframeEntity.setType("timeframe");
                timeframeEntity.setText(timeframeMatcher.group(0));
                analysis.getEntities().add(timeframeEntity);
            }
        }

        // For correlation intent, extract field pairs
        if ("correlation".equals(analysis.getIntent())) {
            Pattern relationshipPattern = Pattern.compile("(relationship|correlation) between ([a-z]+) and ([a-z]+)");
            Matcher relationshipMatcher = relationshipPattern.matcher(normalizedText);
            if (relationshipMatcher.find()) {
                NlpAnalysis.Entity field1Entity = new NlpAnalysis.Entity();
                field1Entity.setType("field");
                field1Entity.setText(relationshipMatcher.group(2));
                analysis.getEntities().add(field1Entity);

                NlpAnalysis.Entity field2Entity = new NlpAnalysis.Entity();
                field2Entity.setType("field");
                field2Entity.setText(relationshipMatcher.group(3));
                analysis.getEntities().add(field2Entity);
            }
        }

        return analysis;
    }
}