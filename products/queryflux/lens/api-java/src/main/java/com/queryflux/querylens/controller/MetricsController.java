package com.queryflux.querylens.controller;

import com.queryflux.querylens.service.CostTrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Metrics and monitoring endpoints for QueryLens
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/metrics")
@RequiredArgsConstructor
public class MetricsController {

    private final CostTrackingService costTrackingService;

    @GetMapping
    public ResponseEntity<CostTrackingService.CostSummary> getMetrics() {
        return ResponseEntity.ok(costTrackingService.getCostSummary());
    }

    @GetMapping("/daily/{date}")
    public ResponseEntity<CostTrackingService.DailyMetrics> getDailyMetrics(
            @PathVariable String date) {
        return ResponseEntity.ok(costTrackingService.getDailyMetrics(date));
    }

    @GetMapping("/top-queries")
    public ResponseEntity<Map<String, Long>> getTopQueries(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(costTrackingService.getTopQueries(limit));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<Map<String, Object>> getRecommendations() {
        var summary = costTrackingService.getCostSummary();
        var recommendations = costTrackingService.getOptimizationRecommendations();

        return ResponseEntity.ok(Map.of(
            "summary", summary,
            "recommendations", recommendations,
            "timestamp", LocalDate.now().toString()
        ));
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> resetMetrics() {
        costTrackingService.resetMetrics();
        log.warn("Metrics reset via API");
        return ResponseEntity.ok(Map.of(
            "status", "reset",
            "message", "All metrics have been reset"
        ));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        var summary = costTrackingService.getCostSummary();
        var health = Map.<String, Object>of(
            "status", summary.overBudgetLimit() ? "warning" : "healthy",
            "budgetStatus", summary.overBudgetLimit() ? "exceeded" :
                          summary.nearBudgetLimit() ? "warning" : "ok",
            "todayCost", String.format("$%.2f", summary.todayMetrics().cost()),
            "dailyBudgetLimit", "$50.00",
            "timestamp", System.currentTimeMillis()
        );
        return ResponseEntity.ok(health);
    }
}
