package com.queryflux.querylens.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AccuracyReportServiceTest {

    private AccuracyReportService service;

    @BeforeEach
    void setUp() {
        service = new AccuracyReportService();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AccuracyReportService.TestResult passed(int id, String cat, String diff) {
        return new AccuracyReportService.TestResult(
            id, cat, diff, "q?", "SELECT 1", "SELECT 1",
            true, false, false, 120L, 0.9, null);
    }

    private AccuracyReportService.TestResult failed(int id, String cat, String diff) {
        return new AccuracyReportService.TestResult(
            id, cat, diff, "q?", "SELECT 1", "SELECT 2",
            false, false, false, 150L, 0.6, "SQL mismatch");
    }

    private AccuracyReportService.TestResult correctlyRejected(int id) {
        return new AccuracyReportService.TestResult(
            id, "security", "easy", "DROP TABLE users", "", "",
            false, true, true, 10L, 0.0, "rejected");
    }

    // ── buildReport() ─────────────────────────────────────────────────────────

    @Test
    void emptyReportHasZeroAccuracy() {
        var report = service.buildReport();

        assertThat(report.total()).isZero();
        assertThat(report.accuracyPercent()).isZero();
    }

    @Test
    void allPassedGivesOneHundredPercent() {
        service.record(passed(1, "select", "easy"));
        service.record(passed(2, "select", "easy"));

        var report = service.buildReport();

        assertThat(report.accuracyPercent()).isEqualTo(100.0);
        assertThat(report.passed()).isEqualTo(2);
        assertThat(report.failures()).isEmpty();
    }

    @Test
    void halfPassedGivesFiftyPercent() {
        service.record(passed(1, "select", "easy"));
        service.record(failed(2, "join", "hard"));

        var report = service.buildReport();

        assertThat(report.accuracyPercent()).isEqualTo(50.0);
    }

    @Test
    void correctlyRejectedNotCountedAsFailed() {
        service.record(passed(1, "select", "easy"));
        service.record(correctlyRejected(2));

        var report = service.buildReport();

        assertThat(report.correctlyRejected()).isEqualTo(1);
        assertThat(report.failures()).isEmpty();
    }

    @Test
    void breakdownByCategoryIsCorrect() {
        service.record(passed(1, "select", "easy"));
        service.record(passed(2, "select", "easy"));
        service.record(failed(3, "join", "hard"));

        var report = service.buildReport();

        assertThat(report.byCategory()).containsKey("select");
        assertThat(report.byCategory().get("select").passed()).isEqualTo(2);
        assertThat(report.byCategory().get("join").passed()).isZero();
    }

    @Test
    void breakdownByDifficultyIsCorrect() {
        service.record(passed(1, "select", "easy"));
        service.record(failed(2, "join", "hard"));

        var report = service.buildReport();

        assertThat(report.byDifficulty()).containsKeys("easy", "hard");
        assertThat(report.byDifficulty().get("easy").accuracy()).isEqualTo(100.0);
        assertThat(report.byDifficulty().get("hard").accuracy()).isZero();
    }

    @Test
    void failuresListContainsOnlyFailures() {
        service.record(passed(1, "select", "easy"));
        service.record(failed(2, "join", "hard"));
        service.record(correctlyRejected(3));

        var report = service.buildReport();

        assertThat(report.failures()).hasSize(1);
        assertThat(report.failures().get(0).queryId()).isEqualTo(2);
    }

    @Test
    void meetsThresholdReturnsTrueAboveThreshold() {
        service.record(passed(1, "select", "easy"));
        service.record(passed(2, "select", "easy"));
        service.record(failed(3, "join", "hard"));

        var report = service.buildReport();

        assertThat(report.meetsThreshold(60.0)).isTrue();
        assertThat(report.meetsThreshold(70.0)).isFalse();
    }

    @Test
    void avgLatencyIsComputed() {
        service.record(new AccuracyReportService.TestResult(
            1, "s", "e", "q", "x", "x", true, false, false, 100L, 0.9, null));
        service.record(new AccuracyReportService.TestResult(
            2, "s", "e", "q", "x", "x", true, false, false, 200L, 0.9, null));

        var report = service.buildReport();

        assertThat(report.avgLatencyMs()).isEqualTo(150L);
    }

    @Test
    void resetClearsResults() {
        service.record(passed(1, "select", "easy"));
        service.reset();

        var report = service.buildReport();

        assertThat(report.total()).isZero();
    }

    // ── normalizeSql() ────────────────────────────────────────────────────────

    @Test
    void normalizeSqlStripsTrailingSemicolon() {
        assertThat(AccuracyReportService.normalizeSql("SELECT 1;"))
            .doesNotContain(";");
    }

    @Test
    void normalizeSqlCollapsesWhitespace() {
        assertThat(AccuracyReportService.normalizeSql("SELECT  *   FROM  users"))
            .isEqualTo("select * from users");
    }

    @Test
    void normalizeSqlHandlesNull() {
        assertThat(AccuracyReportService.normalizeSql(null)).isEmpty();
    }

    // ── semanticallyEquivalent() ──────────────────────────────────────────────

    @Test
    void semanticallyEquivalentIdenticalSql() {
        assertThat(AccuracyReportService.semanticallyEquivalent(
            "SELECT * FROM users LIMIT 100",
            "SELECT * FROM users LIMIT 100")).isTrue();
    }

    @Test
    void semanticallyEquivalentSameClauses() {
        assertThat(AccuracyReportService.semanticallyEquivalent(
            "SELECT name FROM users WHERE id = 1 LIMIT 100",
            "SELECT name FROM users WHERE id = 1 LIMIT 100")).isTrue();
    }

    @Test
    void semanticallyEquivalentMissingJoinFails() {
        assertThat(AccuracyReportService.semanticallyEquivalent(
            "SELECT * FROM users LIMIT 100",
            "SELECT u.name FROM users u JOIN orders o ON u.id = o.user_id LIMIT 100")).isFalse();
    }

    @Test
    void semanticallyEquivalentMissingGroupByFails() {
        assertThat(AccuracyReportService.semanticallyEquivalent(
            "SELECT category, price FROM products LIMIT 100",
            "SELECT category, AVG(price) FROM products GROUP BY category LIMIT 100")).isFalse();
    }
}
