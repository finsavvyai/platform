package com.queryflux.querylens.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Cost tracking service for OpenAI API usage.
 * Tracks token usage, calculates costs, and provides metrics.
 *
 * OpenAI GPT-4 Pricing (as of 2026):
 * - Input: $0.03 per 1K tokens
 * - Output: $0.06 per 1K tokens
 */
@Slf4j
@Service
public class CostTrackingService {

    // GPT-4 pricing per 1K tokens
    private static final double INPUT_COST_PER_1K = 0.03;
    private static final double OUTPUT_COST_PER_1K = 0.06;

    // Budget alerts
    private static final double DAILY_BUDGET_WARNING = 10.0;  // $10
    private static final double DAILY_BUDGET_LIMIT = 50.0;     // $50

    // Metrics storage
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong totalInputTokens = new AtomicLong(0);
    private final AtomicLong totalOutputTokens = new AtomicLong(0);
    private final AtomicLong totalCostCents = new AtomicLong(0);

    // Daily tracking
    private final ConcurrentHashMap<String, DailyMetrics> dailyMetrics = new ConcurrentHashMap<>();

    // Query statistics
    private final ConcurrentHashMap<String, QueryStats> queryStats = new ConcurrentHashMap<>();

    public record TokenUsage(
        long inputTokens,
        long outputTokens,
        long totalTokens,
        double cost
    ) {}

    public record DailyMetrics(
        String date,
        long requestCount,
        long inputTokens,
        long outputTokens,
        double cost
    ) {}

    public record QueryStats(
        String queryHash,
        long requestCount,
        long totalTokens,
        double totalCost
    ) {}

    public record CostSummary(
        long totalRequests,
        long totalInputTokens,
        long totalOutputTokens,
        long totalTokens,
        double totalCost,
        double averageCostPerQuery,
        DailyMetrics todayMetrics,
        boolean nearBudgetLimit,
        boolean overBudgetLimit
    ) {}

    /**
     * Record token usage for a request
     */
    public TokenUsage recordUsage(String question, long inputTokens, long outputTokens) {
        long totalTokens = inputTokens + outputTokens;
        double cost = calculateCost(inputTokens, outputTokens);

        // Update totals
        totalRequests.incrementAndGet();
        totalInputTokens.addAndGet(inputTokens);
        totalOutputTokens.addAndGet(outputTokens);
        totalCostCents.addAndGet((long) (cost * 100));

        // Update daily metrics
        String today = LocalDateTime.now().toLocalDate().toString();
        dailyMetrics.compute(today, (key, metrics) -> {
            if (metrics == null) {
                return new DailyMetrics(today, 1, inputTokens, outputTokens, cost);
            } else {
                return new DailyMetrics(
                    today,
                    metrics.requestCount + 1,
                    metrics.inputTokens + inputTokens,
                    metrics.outputTokens + outputTokens,
                    metrics.cost + cost
                );
            }
        });

        // Update query statistics (for caching analysis)
        String queryHash = hashQuery(question);
        queryStats.compute(queryHash, (key, stats) -> {
            if (stats == null) {
                return new QueryStats(queryHash, 1, totalTokens, cost);
            } else {
                return new QueryStats(
                    queryHash,
                    stats.requestCount + 1,
                    stats.totalTokens + totalTokens,
                    stats.totalCost + cost
                );
            }
        });

        log.debug("Recorded usage: {} input, {} output tokens, ${:.4f}",
            inputTokens, outputTokens, cost);

        checkBudgetAlerts(today);

        return new TokenUsage(inputTokens, outputTokens, totalTokens, cost);
    }

    /**
     * Get comprehensive cost summary
     */
    public CostSummary getCostSummary() {
        String today = LocalDateTime.now().toLocalDate().toString();
        DailyMetrics todayMetrics = dailyMetrics.getOrDefault(today,
            new DailyMetrics(today, 0, 0, 0, 0.0));

        long totalTokens = totalInputTokens.get() + totalOutputTokens.get();
        double totalCost = totalCostCents.get() / 100.0;
        double avgCost = totalRequests.get() > 0
            ? totalCost / totalRequests.get()
            : 0.0;

        return new CostSummary(
            totalRequests.get(),
            totalInputTokens.get(),
            totalOutputTokens.get(),
            totalTokens,
            totalCost,
            avgCost,
            todayMetrics,
            todayMetrics.cost >= DAILY_BUDGET_WARNING && todayMetrics.cost < DAILY_BUDGET_LIMIT,
            todayMetrics.cost >= DAILY_BUDGET_LIMIT
        );
    }

    /**
     * Get metrics for specific date
     */
    public DailyMetrics getDailyMetrics(String date) {
        return dailyMetrics.getOrDefault(date,
            new DailyMetrics(date, 0, 0, 0, 0.0));
    }

    /**
     * Get most common queries (for caching optimization)
     */
    public java.util.Map<String, Long> getTopQueries(int limit) {
        return queryStats.entrySet().stream()
            .sorted((e1, e2) -> Long.compare(e2.getValue().requestCount(), e1.getValue().requestCount()))
            .limit(limit)
            .collect(java.util.stream.Collectors.toMap(
                java.util.Map.Entry::getKey,
                e -> e.getValue().requestCount()
            ));
    }

    /**
     * Reset all metrics (use with caution)
     */
    public void resetMetrics() {
        log.warn("Resetting all cost tracking metrics");
        totalRequests.set(0);
        totalInputTokens.set(0);
        totalOutputTokens.set(0);
        totalCostCents.set(0);
        dailyMetrics.clear();
        queryStats.clear();
    }

    /**
     * Calculate cost from token counts
     */
    private double calculateCost(long inputTokens, long outputTokens) {
        double inputCost = (inputTokens / 1000.0) * INPUT_COST_PER_1K;
        double outputCost = (outputTokens / 1000.0) * OUTPUT_COST_PER_1K;
        return inputCost + outputCost;
    }

    /**
     * Check budget alerts and log warnings
     */
    private void checkBudgetAlerts(String date) {
        DailyMetrics metrics = dailyMetrics.get(date);
        if (metrics == null) return;

        if (metrics.cost >= DAILY_BUDGET_LIMIT) {
            log.error("🚨 BUDGET EXCEEDED: Daily cost ${:.2f} exceeds limit ${:.2f}",
                metrics.cost, DAILY_BUDGET_LIMIT);
        } else if (metrics.cost >= DAILY_BUDGET_WARNING) {
            log.warn("⚠️  BUDGET WARNING: Daily cost ${:.2f} approaching limit ${:.2f}",
                metrics.cost, DAILY_BUDGET_LIMIT);
        }
    }

    /**
     * Hash query for statistics tracking
     */
    private String hashQuery(String query) {
        return String.valueOf(query.hashCode());
    }

    /**
     * Estimate cost before making request (for preview)
     */
    public double estimateCost(long estimatedInputTokens) {
        // Assume output tokens will be similar to input for SQL generation
        long estimatedOutputTokens = Math.max(100, estimatedInputTokens / 2);
        return calculateCost(estimatedInputTokens, estimatedOutputTokens);
    }

    /**
     * Get cost optimization recommendations
     */
    public java.util.List<String> getOptimizationRecommendations() {
        java.util.List<String> recommendations = new java.util.ArrayList<>();

        CostSummary summary = getCostSummary();
        DailyMetrics today = summary.todayMetrics();

        // Check for repeat queries
        var repeatQueries = queryStats.entrySet().stream()
            .filter(e -> e.getValue().requestCount() > 3)
            .toList();

        if (!repeatQueries.isEmpty()) {
            recommendations.add(String.format(
                "Found %d queries requested 3+ times. Implement caching to save ~$%.2f/day",
                repeatQueries.size(),
                repeatQueries.stream()
                    .mapToDouble(e -> e.getValue().totalCost() * (e.getValue().requestCount() - 1))
                    .sum()
            ));
        }

        // Check token efficiency
        double avgTokensPerQuery = summary.totalTokens() > 0
            ? (double) summary.totalTokens() / summary.totalRequests()
            : 0;

        if (avgTokensPerQuery > 1000) {
            recommendations.add(String.format(
                "Average %.0f tokens/query. Consider prompt optimization to reduce costs.",
                avgTokensPerQuery
            ));
        }

        // Budget recommendations
        if (today.cost() > DAILY_BUDGET_WARNING * 0.5) {
            recommendations.add(String.format(
                "Daily cost $%.2f is 50%% of warning threshold. Consider usage limits.",
                today.cost()
            ));
        }

        return recommendations;
    }
}
