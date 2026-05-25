/**
 * Sample Project 7: Health Score & Monitoring
 *
 * Simulates: Computing tenant health scores from infrastructure
 * metrics across different profiles — healthy production, degraded
 * performance, and critical outage scenarios.
 */
import { describe, it, expect } from 'vitest';
import {
	calculateHealthScore,
	calculateComponentScore,
	getHealthTrend,
	identifyRisks,
	normalizeMetrics,
	applyWeights,
	aggregateScores,
	detectAnomalies,
	predictHealthDegradation,
} from '../../apps/api/src/services/health-score';

// ── Metric profiles ──────────────────────────────────────────────

const healthyMetrics = {
	uptime: 99.99, cpu: 25, memory: 40, disk: 35,
	latency: 45, errorRate: 0.001, throughput: 8000, responseTime: 80,
};

const degradedMetrics = {
	uptime: 98.5, cpu: 82, memory: 78, disk: 65,
	latency: 800, errorRate: 0.05, throughput: 2000, responseTime: 1200,
};

const criticalMetrics = {
	uptime: 85.0, cpu: 98, memory: 95, disk: 92,
	latency: 5000, errorRate: 0.3, throughput: 100, responseTime: 8000,
};

const partialMetrics = { uptime: 99.0, cpu: 50 };

describe('Health Monitoring — Tenant Health Profiles', () => {
	describe('Healthy Production Environment', () => {
		it('should score above 70 for healthy metrics', () => {
			const score = calculateHealthScore(healthyMetrics);
			expect(score).toBeGreaterThan(70);
			expect(score).toBeLessThanOrEqual(100);
		});

		it('should have high availability component', () => {
			const avail = calculateComponentScore('availability', { uptime: 99.99 });
			expect(avail).toBeGreaterThan(95);
		});

		it('should have positive performance component', () => {
			const perf = calculateComponentScore('performance', {
				cpu: 25, memory: 40, latency: 45,
			});
			expect(perf).toBeGreaterThan(0);
		});

		it('should have high reliability', () => {
			const rel = calculateComponentScore('reliability', {
				errorRate: 0.001, responseTime: 80,
			});
			expect(rel).toBeGreaterThan(50);
		});

		it('should identify zero risks', () => {
			const risks = identifyRisks(healthyMetrics);
			expect(risks.length).toBe(0);
		});
	});

	describe('Degraded Performance Environment', () => {
		it('should score lower than healthy metrics', () => {
			const healthyScore = calculateHealthScore(healthyMetrics);
			const degradedScore = calculateHealthScore(degradedMetrics);
			expect(degradedScore).toBeLessThan(healthyScore);
		});

		it('should identify CPU risk', () => {
			const risks = identifyRisks(degradedMetrics);
			expect(risks.some((r) => r.component === 'cpu')).toBe(true);
		});

		it('should identify memory risk', () => {
			const risks = identifyRisks(degradedMetrics);
			expect(risks.some((r) => r.component === 'memory')).toBe(true);
		});
	});

	describe('Critical Outage Environment', () => {
		it('should score below 40 for critical metrics', () => {
			const score = calculateHealthScore(criticalMetrics);
			expect(score).toBeLessThan(40);
		});

		it('should identify multiple risks', () => {
			const risks = identifyRisks(criticalMetrics);
			expect(risks.length).toBeGreaterThanOrEqual(2);
		});

		it('should flag highest severity risks first', () => {
			const risks = identifyRisks(criticalMetrics);
			if (risks.length >= 2) {
				expect(risks[0].severity).toMatch(/critical|high/);
			}
		});

		it('should identify disk space risk', () => {
			const risks = identifyRisks(criticalMetrics);
			expect(risks.some((r) => r.component === 'disk')).toBe(true);
		});

		it('should identify error rate risk', () => {
			const risks = identifyRisks(criticalMetrics);
			expect(risks.some((r) => r.component === 'errorRate')).toBe(true);
		});
	});

	describe('Partial Metrics (Graceful Degradation)', () => {
		it('should handle missing metrics without crashing', () => {
			const score = calculateHealthScore(partialMetrics as any);
			expect(score).toBeGreaterThan(0);
			expect(score).toBeLessThanOrEqual(100);
		});
	});

	describe('Health Trends', () => {
		it('should detect improving trend', () => {
			const trend = getHealthTrend([50, 60, 70, 80, 90]);
			expect(trend.direction).toBe('improving');
			expect(trend.rate).toBeGreaterThan(0);
		});

		it('should detect degrading trend', () => {
			const trend = getHealthTrend([95, 85, 75, 65, 55]);
			expect(trend.direction).toBe('degrading');
			expect(trend.rate).toBeLessThan(0);
		});

		it('should detect stable trend', () => {
			const trend = getHealthTrend([80, 81, 79, 80, 80]);
			expect(trend.direction).toBe('stable');
		});

		it('should handle single data point', () => {
			const trend = getHealthTrend([75]);
			expect(trend).toBeDefined();
		});

		it('should handle empty array', () => {
			const trend = getHealthTrend([]);
			expect(trend).toBeDefined();
		});
	});

	describe('Metric Normalization', () => {
		it('should normalize uptime to 0-100', () => {
			const normalized = normalizeMetrics({ uptime: 99.5 });
			expect(normalized.uptime).toBeGreaterThanOrEqual(0);
			expect(normalized.uptime).toBeLessThanOrEqual(100);
		});

		it('should invert CPU utilization (high CPU = low score)', () => {
			const normalized = normalizeMetrics({ cpu: 90 });
			expect(normalized.cpu).toBeLessThan(20);
		});

		it('should handle edge case: 100% uptime', () => {
			const normalized = normalizeMetrics({ uptime: 100 });
			expect(normalized.uptime).toBe(100);
		});

		it('should handle edge case: 0% CPU', () => {
			const normalized = normalizeMetrics({ cpu: 0 });
			expect(normalized.cpu).toBe(100);
		});
	});

	describe('Score Aggregation & Weighting', () => {
		it('should aggregate scores with equal weights', () => {
			const result = aggregateScores([80, 80, 80, 80]);
			expect(result).toBe(80);
		});

		it('should aggregate with custom weights', () => {
			const result = aggregateScores([100, 0], [0.8, 0.2]);
			expect(result).toBeGreaterThan(70);
		});

		it('should return 0 for empty scores', () => {
			expect(aggregateScores([])).toBe(0);
		});

		it('should apply component weights', () => {
			const weighted = applyWeights({
				availability: 100, performance: 50,
				reliability: 75, capacity: 60,
			});
			expect(weighted).toBeGreaterThan(0);
			expect(weighted).toBeLessThanOrEqual(100);
		});

		it('should weight availability higher than capacity', () => {
			const highAvail = applyWeights({
				availability: 100, performance: 0, reliability: 0, capacity: 0,
			});
			const highCapacity = applyWeights({
				availability: 0, performance: 0, reliability: 0, capacity: 100,
			});
			expect(highAvail).toBeGreaterThan(highCapacity);
		});
	});

	describe('Anomaly Detection', () => {
		it('should detect sudden spike as anomaly', () => {
			const history = [50, 52, 48, 51, 49];
			const anomalies = detectAnomalies(history, 95);
			expect(anomalies.length).toBeGreaterThan(0);
		});

		it('should not flag normal variation', () => {
			const history = [80, 82, 78, 81, 79];
			const anomalies = detectAnomalies(history, 81);
			expect(anomalies.length).toBe(0);
		});

		it('should assign severity to anomalies', () => {
			const anomalies = detectAnomalies([50, 50, 50], 99);
			if (anomalies.length > 0) {
				expect(anomalies[0].severity).toBeDefined();
			}
		});
	});

	describe('Predictive Health Degradation', () => {
		it('should predict declining health', () => {
			const pred = predictHealthDegradation([95, 90, 85, 80, 75, 70]);
			expect(pred.score).toBeDefined();
			expect(pred.confidence).toBeGreaterThan(0);
		});

		it('should include confidence intervals', () => {
			const pred = predictHealthDegradation([85, 85, 85, 85]);
			expect(pred.lower).toBeDefined();
			expect(pred.upper).toBeDefined();
		});

		it('should flag critical degradation pattern', () => {
			const pred = predictHealthDegradation([100, 80, 60, 40, 20]);
			expect(pred.risk).toBe('critical');
		});

		it('should be calm for stable history', () => {
			const pred = predictHealthDegradation([85, 86, 84, 85, 85]);
			expect(pred.risk).not.toBe('critical');
		});
	});
});
