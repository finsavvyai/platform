/**
 * Tests for PerformanceMonitor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PerformanceMonitor, performanceMonitor } from '../metrics/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.clearMetrics();
  });

  describe('Timer Operations', () => {
    it('should start and end timers correctly', () => {
      const timerId = monitor.startTimer('test-operation');

      expect(timerId).toBeDefined();
      expect(timerId).toContain('test-operation');

      // Simulate some work
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Wait at least 10ms
      }

      const duration = monitor.endTimer(timerId);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should be less than 1 second
    });

    it('should handle non-existent timers gracefully', () => {
      const duration = monitor.endTimer('non-existent-timer');
      expect(duration).toBe(0);
    });
  });

  describe('Metric Recording', () => {
    it('should record and retrieve metrics', () => {
      monitor.recordMetric('test-metric', 100);
      monitor.recordMetric('test-metric', 200);
      monitor.recordMetric('test-metric', 150);

      const stats = monitor.getOperationMetrics('test-metric');

      expect(stats).not.toBeNull();
      expect(stats!.avg).toBe(150); // (100 + 200 + 150) / 3
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(200);
      expect(stats!.count).toBe(3);
    });

    it('should return null for non-existent metrics', () => {
      const stats = monitor.getOperationMetrics('non-existent');
      expect(stats).toBeNull();
    });

    it('should limit metric history', () => {
      // Add more than the limit (100)
      for (let i = 0; i < 150; i++) {
        monitor.recordMetric('test-metric', i);
      }

      const stats = monitor.getOperationMetrics('test-metric');
      expect(stats!.count).toBe(100); // Should be limited to 100
    });
  });

  describe('Mode Metrics', () => {
    it('should record mode-specific metrics', () => {
      monitor.recordModeMetrics('test-mode', {
        activationTime: 50,
        memoryUsage: 1024,
        apiCalls: 5,
        errorCount: 0
      });

      const modeMetrics = monitor.getModeMetrics('test-mode');

      expect(modeMetrics).not.toBeNull();
      expect(modeMetrics!.modeId).toBe('test-mode');
      expect(modeMetrics!.activationTime).toBe(50);
      expect(modeMetrics!.memoryUsage).toBe(1024);
      expect(modeMetrics!.apiCalls).toBe(5);
      expect(modeMetrics!.errorCount).toBe(0);
    });

    it('should update existing mode metrics', () => {
      monitor.recordModeMetrics('test-mode', {
        activationTime: 50,
        memoryUsage: 1024,
        apiCalls: 5,
        errorCount: 0
      });

      monitor.recordModeMetrics('test-mode', {
        apiCalls: 3,
        errorCount: 1
      });

      const modeMetrics = monitor.getModeMetrics('test-mode');

      expect(modeMetrics!.activationTime).toBe(50); // Should remain unchanged
      expect(modeMetrics!.apiCalls).toBe(3); // Should be updated
      expect(modeMetrics!.errorCount).toBe(1); // Should be updated
    });

    it('should get all mode metrics', () => {
      monitor.recordModeMetrics('mode1', { activationTime: 50, memoryUsage: 1024, apiCalls: 5, errorCount: 0 });
      monitor.recordModeMetrics('mode2', { activationTime: 75, memoryUsage: 2048, apiCalls: 3, errorCount: 1 });

      const allMetrics = monitor.getAllModeMetrics();

      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.map(m => m.modeId)).toContain('mode1');
      expect(allMetrics.map(m => m.modeId)).toContain('mode2');
    });
  });

  describe('Snapshots', () => {
    it('should record operation snapshots', () => {
      const timerId = monitor.startTimer('test-operation');

      // Simulate work
      setTimeout(() => {
        monitor.endTimer(timerId, { test: 'metadata' });
      }, 10);

      // Wait a bit for the async operation
      setTimeout(() => {
        const snapshots = monitor.getSnapshots(1);

        expect(snapshots).toHaveLength(1);
        expect(snapshots[0].operation).toBe('test-operation');
        expect(snapshots[0].duration).toBeGreaterThan(0);
        expect(snapshots[0].metadata).toEqual({ test: 'metadata' });
      }, 50);
    });

    it('should limit snapshot history', () => {
      // Create monitor with small snapshot limit
      const smallMonitor = new PerformanceMonitor();

      // Add more snapshots than the limit
      for (let i = 0; i < 1100; i++) {
        const timerId = smallMonitor.startTimer(`operation-${i}`);
        smallMonitor.endTimer(timerId);
      }

      const snapshots = smallMonitor.getSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(1000); // Default max is 1000
    });
  });

  describe('Current Metrics', () => {
    it('should provide current performance metrics', () => {
      // Add some test data
      monitor.recordMetric('graph.build', 100);
      monitor.recordMetric('mode.activation', 50);
      monitor.recordMetric('api.request', 200);

      const currentMetrics = monitor.getCurrentMetrics();

      expect(currentMetrics.graphBuildTime).toBe(100);
      expect(currentMetrics.modeActivationTime).toBe(50);
      expect(currentMetrics.apiResponseTime).toBe(200);
      expect(currentMetrics.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(currentMetrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(currentMetrics.eventProcessingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance summary', () => {
      monitor.recordMetric('graph.build', 100);
      monitor.recordMetric('mode.activation', 50);
      monitor.recordMetric('api.request', 200);

      const summary = monitor.getPerformanceSummary();

      expect(summary).toContain('Graph Build Time: 100.00ms');
      expect(summary).toContain('Mode Activation Time: 50.00ms');
      expect(summary).toContain('API Response Time: 200.00ms');
    });
  });

  describe('Clear Operations', () => {
    it('should clear all metrics', () => {
      monitor.recordMetric('test-metric', 100);
      monitor.recordModeMetrics('test-mode', { activationTime: 50, memoryUsage: 1024, apiCalls: 5, errorCount: 0 });

      expect(monitor.getOperationMetrics('test-metric')).not.toBeNull();
      expect(monitor.getModeMetrics('test-mode')).not.toBeNull();

      monitor.clearMetrics();

      expect(monitor.getOperationMetrics('test-metric')).toBeNull();
      expect(monitor.getModeMetrics('test-mode')).toBeNull();
      expect(monitor.getSnapshots()).toHaveLength(0);
    });
  });
});

describe('Global Performance Monitor', () => {
  it('should provide access to global instance', () => {
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);

    // Should be able to use global instance
    const timerId = performanceMonitor.startTimer('global-test');
    const duration = performanceMonitor.endTimer(timerId);

    expect(duration).toBeGreaterThan(0);
  });
});