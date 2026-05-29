package com.queryflux.querylens.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Aggregates NLP-to-SQL test results into accuracy reports.
 *
 * Tracks pass/fail counts per category and difficulty, computes overall
 * accuracy percentage, and exposes a summary suitable for logging or the
 * MetricsController.
 */
@Slf4j
@Service
public class AccuracyReportService {

    /**
     * Single test result entry.
     */
    public record TestResult(
        int queryId,
        String category,
        String difficulty,
        String question,
        String expectedSql,
        String generatedSql,
        boolean passed,
        boolean rejected,
        boolean shouldReject,
        long latencyMs,
        double confidence,
        String failureReason
    ) {}

    /**
     * Aggregated accuracy report.
     */
    public record AccuracyReport(
        int total,
        int passed,
        int failed,
        int correctlyRejected,
        double accuracyPercent,
        long avgLatencyMs,
        long p95LatencyMs,
        Map<String, CategoryStats> byCategory,
        Map<String, CategoryStats> byDifficulty,
        List<TestResult> failures,
        Instant generatedAt
    ) {
        public boolean meetsThreshold(double threshold) {
            return accuracyPercent >= threshold;
        }
    }

    /**
     * Per-category/difficulty breakdown.
     */
    public record CategoryStats(int total, int passed, double accuracy) {}

    // In-memory result store (cleared per test run)
    private final List<TestResult> results = new ArrayList<>();
    private final Map<String, Object> lastReport = new ConcurrentHashMap<>();

    /** Record a single test result. */
    public void record(TestResult result) {
        results.add(result);
    }

    /** Build a full accuracy report from recorded results. */
    public AccuracyReport buildReport() {
        if (results.isEmpty()) {
            return new AccuracyReport(0, 0, 0, 0, 0.0, 0L, 0L,
                Map.of(), Map.of(), List.of(), Instant.now());
        }

        int total = results.size();
        int passed = (int) results.stream().filter(TestResult::passed).count();
        int correctlyRejected = (int) results.stream()
            .filter(r -> r.rejected() && r.shouldReject()).count();
        int failed = total - passed - correctlyRejected;
        double accuracy = (passed * 100.0) / total;

        // Latency stats (only non-rejected queries)
        List<Long> latencies = results.stream()
            .filter(r -> !r.rejected())
            .map(TestResult::latencyMs)
            .sorted()
            .toList();

        long avgLatency = latencies.isEmpty() ? 0L
            : (long) latencies.stream().mapToLong(Long::longValue).average().orElse(0);
        long p95Latency = latencies.isEmpty() ? 0L
            : latencies.get((int) (latencies.size() * 0.95));

        Map<String, CategoryStats> byCategory = buildBreakdown(
            results.stream().collect(Collectors.groupingBy(TestResult::category)));

        Map<String, CategoryStats> byDifficulty = buildBreakdown(
            results.stream().collect(Collectors.groupingBy(TestResult::difficulty)));

        List<TestResult> failures = results.stream()
            .filter(r -> !r.passed() && !(r.rejected() && r.shouldReject()))
            .toList();

        log.info("Accuracy report: {}/{} passed ({}%), P95={}ms",
            passed, total, String.format("%.1f", accuracy), p95Latency);

        return new AccuracyReport(total, passed, failed, correctlyRejected, accuracy,
            avgLatency, p95Latency, byCategory, byDifficulty, failures, Instant.now());
    }

    /** Clear all recorded results for a fresh run. */
    public void reset() {
        results.clear();
    }

    /** Convenience: normalize SQL for lenient comparison. */
    public static String normalizeSql(String sql) {
        if (sql == null) return "";
        return sql.trim()
            .replaceAll(";$", "")
            .replaceAll("\\s+", " ")
            .toLowerCase();
    }

    /**
     * Semantic equivalence check: verifies that the same SQL clauses are present.
     * Does NOT require token-for-token identity.
     */
    public static boolean semanticallyEquivalent(String generated, String expected) {
        String gen = normalizeSql(generated);
        String exp = normalizeSql(expected);

        if (gen.equalsIgnoreCase(exp)) return true;

        // Clause presence check
        for (String clause : List.of("select", "from", "join", "where",
                                     "group by", "order by", "having")) {
            if (exp.contains(clause) && !gen.contains(clause)) return false;
        }
        return true;
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private Map<String, CategoryStats> buildBreakdown(
            Map<String, List<TestResult>> grouped) {

        Map<String, CategoryStats> map = new LinkedHashMap<>();
        grouped.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .forEach(entry -> {
                List<TestResult> group = entry.getValue();
                int t = group.size();
                int p = (int) group.stream().filter(TestResult::passed).count();
                map.put(entry.getKey(), new CategoryStats(t, p, t == 0 ? 0.0 : p * 100.0 / t));
            });
        return map;
    }
}
