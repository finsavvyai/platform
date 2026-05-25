import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateHealthScore,
  calculateComponentScore,
  getHealthTrend,
  identifyRisks,
  getHealthHistory,
  normalizeMetrics,
  applyWeights,
  aggregateScores,
  detectAnomalies,
  predictHealthDegradation
} from '../../apps/api/src/services/health-score';

describe('Health Score Service', () => {
  const mockMetrics = {
    uptime: 99.9,
    cpu: 45,
    memory: 60,
    disk: 70,
    latency: 120,
    errorRate: 0.005,
    throughput: 1000,
    responseTime: 150
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateHealthScore', () => {
    it('should calculate overall health score', () => {
      const score = calculateHealthScore(mockMetrics);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return high score for perfect metrics', () => {
      const perfect = {
        uptime: 100,
        cpu: 0,
        memory: 0,
        disk: 0,
        latency: 0,
        errorRate: 0,
        throughput: 10000,
        responseTime: 0
      };
      const score = calculateHealthScore(perfect);
      expect(score).toBeGreaterThan(70);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return low score for degraded metrics', () => {
      const degraded = {
        uptime: 50,
        cpu: 95,
        memory: 95,
        disk: 95,
        latency: 5000,
        errorRate: 0.5,
        throughput: 10,
        responseTime: 5000
      };
      const score = calculateHealthScore(degraded);
      expect(score).toBeLessThan(50);
    });

    it('should handle missing metrics gracefully', () => {
      const partial = { uptime: 99.5, cpu: 50 };
      const score = calculateHealthScore(partial as any);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should weight uptime heavily', () => {
      const good = { ...mockMetrics, uptime: 99.9 };
      const poor = { ...mockMetrics, uptime: 80 };
      const scoreGood = calculateHealthScore(good);
      const scorePoor = calculateHealthScore(poor);
      expect(scoreGood).toBeGreaterThan(scorePoor);
    });
  });

  describe('calculateComponentScore', () => {
    it('should calculate availability component', () => {
      const score = calculateComponentScore('availability', { uptime: 99.9 });
      expect(score).toBeGreaterThan(95);
    });

    it('should calculate performance component', () => {
      const score = calculateComponentScore('performance', {
        cpu: 30,
        memory: 40,
        latency: 100
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should calculate reliability component', () => {
      const score = calculateComponentScore('reliability', {
        errorRate: 0.001,
        responseTime: 200
      });
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should calculate capacity component', () => {
      const score = calculateComponentScore('capacity', {
        cpu: 60,
        memory: 70,
        disk: 50
      });
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('getHealthTrend', () => {
    it('should identify improving trend', () => {
      const scores = [60, 70, 80, 90];
      const trend = getHealthTrend(scores);
      expect(trend.direction).toBe('improving');
      expect(trend.rate).toBeGreaterThan(0);
    });

    it('should identify degrading trend', () => {
      const scores = [90, 80, 70, 60];
      const trend = getHealthTrend(scores);
      expect(trend.direction).toBe('degrading');
      expect(trend.rate).toBeLessThan(0);
    });

    it('should identify stable trend', () => {
      const scores = [75, 75, 76, 74];
      const trend = getHealthTrend(scores);
      expect(trend.direction).toBe('stable');
      expect(Math.abs(trend.rate)).toBeLessThan(5);
    });

    it('should handle single score', () => {
      const trend = getHealthTrend([75]);
      expect(trend).toBeDefined();
    });
  });

  describe('identifyRisks', () => {
    it('should identify high CPU risk', () => {
      const metrics = { ...mockMetrics, cpu: 95 };
      const risks = identifyRisks(metrics);
      expect(risks.some(r => r.component === 'cpu')).toBe(true);
    });

    it('should identify disk space risk', () => {
      const metrics = { ...mockMetrics, disk: 95 };
      const risks = identifyRisks(metrics);
      expect(risks.some(r => r.component === 'disk')).toBe(true);
    });

    it('should identify high error rate risk', () => {
      const metrics = { ...mockMetrics, errorRate: 0.25 };
      const risks = identifyRisks(metrics);
      expect(risks.some(r => r.component === 'errorRate')).toBe(true);
    });

    it('should return empty array for healthy metrics', () => {
      const healthy = {
        uptime: 99.9,
        cpu: 20,
        memory: 30,
        disk: 40,
        latency: 80,
        errorRate: 0.001,
        throughput: 5000,
        responseTime: 100
      };
      const risks = identifyRisks(healthy);
      expect(risks.length).toBe(0);
    });

    it('should prioritize risks by severity', () => {
      const metrics = { ...mockMetrics, uptime: 50, cpu: 90, memory: 95 };
      const risks = identifyRisks(metrics);
      expect(risks[0].severity).toMatch(/critical|high/);
    });
  });

  describe('getHealthHistory', () => {
    it('should retrieve health score history', () => {
      const history = getHealthHistory('tenant-123', { days: 7 });
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeLessThanOrEqual(8);
    });

    it('should support time range filtering', () => {
      const now = new Date();
      const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const history = getHealthHistory('tenant-123', { from: week, to: now });
      expect(Array.isArray(history)).toBe(true);
    });

    it('should include timestamps', () => {
      const history = getHealthHistory('tenant-123', { days: 1 });
      history.forEach(h => {
        expect(h.timestamp).toBeDefined();
        expect(h.score).toBeDefined();
      });
    });
  });

  describe('normalizeMetrics', () => {
    it('should normalize uptime to 0-100 scale', () => {
      const normalized = normalizeMetrics({ uptime: 99.5 });
      expect(normalized.uptime).toBeGreaterThanOrEqual(0);
      expect(normalized.uptime).toBeLessThanOrEqual(100);
    });

    it('should invert resource utilization', () => {
      const normalized = normalizeMetrics({ cpu: 80 });
      expect(normalized.cpu).toBeLessThan(30);
    });

    it('should handle percentages and raw values', () => {
      const normalized = normalizeMetrics({ uptime: 99, cpu: 80 });
      expect(normalized.uptime).toBeGreaterThan(90);
      expect(normalized.cpu).toBeLessThan(30);
    });
  });

  describe('applyWeights', () => {
    it('should apply default weights', () => {
      const components = {
        availability: 95,
        performance: 85,
        reliability: 90,
        capacity: 80
      };
      const weighted = applyWeights(components);
      expect(weighted).toBeGreaterThan(0);
      expect(weighted).toBeLessThanOrEqual(100);
    });

    it('should apply custom weights', () => {
      const components = {
        availability: 100,
        performance: 0,
        reliability: 0,
        capacity: 0
      };
      const weighted = applyWeights(components, {
        availability: 0.4,
        performance: 0.2,
        reliability: 0.2,
        capacity: 0.2
      });
      expect(weighted).toBe(40);
    });

    it('should normalize weights to 100%', () => {
      const components = {
        availability: 80,
        performance: 80
      };
      const weighted = applyWeights(components);
      expect(weighted).toBeDefined();
    });
  });

  describe('aggregateScores', () => {
    it('should aggregate multiple scores', () => {
      const scores = [80, 85, 90, 75];
      const aggregated = aggregateScores(scores);
      expect(aggregated).toBeGreaterThan(75);
      expect(aggregated).toBeLessThan(90);
    });

    it('should support weighted aggregation', () => {
      const scores = [100, 0];
      const aggregated = aggregateScores(scores, [0.8, 0.2]);
      expect(aggregated).toBeGreaterThan(70);
    });

    it('should handle empty array', () => {
      const aggregated = aggregateScores([]);
      expect(aggregated).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies in metrics', () => {
      const historical = [50, 52, 51, 49, 51];
      const current = 95;
      const anomalies = detectAnomalies(historical, current);
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('should use statistical methods', () => {
      const historical = [80, 81, 79, 82, 80];
      const current = 82;
      const anomalies = detectAnomalies(historical, current);
      expect(anomalies.length).toBe(0);
    });

    it('should return anomaly severity', () => {
      const historical = [50, 50, 50, 50];
      const current = 100;
      const anomalies = detectAnomalies(historical, current);
      expect(anomalies[0]?.severity).toBeDefined();
    });
  });

  describe('predictHealthDegradation', () => {
    it('should predict future health score', () => {
      const history = [90, 89, 87, 85, 82, 80];
      const prediction = predictHealthDegradation(history);
      expect(prediction.score).toBeDefined();
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it('should include confidence intervals', () => {
      const history = [85, 85, 85, 85, 85];
      const prediction = predictHealthDegradation(history);
      expect(prediction.lower).toBeDefined();
      expect(prediction.upper).toBeDefined();
    });

    it('should warn of critical degradation', () => {
      const history = [100, 90, 70, 40, 10];
      const prediction = predictHealthDegradation(history);
      expect(prediction.risk).toBe('critical');
    });
  });
});
