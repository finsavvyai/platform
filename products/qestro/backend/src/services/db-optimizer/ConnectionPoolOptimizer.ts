/**
 * Connection Pool Optimizer - Database Connection Management
 *
 * Optimizes connection pool configuration based on system resources,
 * monitors pool health, and alerts on exhaustion or timeout issues.
 */

import { logger } from '../../utils/logger.js';
import type { PoolMetrics, PoolHealth, PoolAlert, ConnectionPoolConfig } from './types.js';

export class ConnectionPoolOptimizer {
  private metrics: PoolMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalSize: 0,
    utilizationPercent: 0,
    avgWaitTimeMs: 0,
    maxWaitTimeMs: 0,
    timeoutCount: 0,
    timeoutRate: 0,
    createdConnections: 0,
    failedConnections: 0,
  };

  private waitTimes: number[] = [];
  private maxWaitTimeHistorySize = 1000;

  /**
   * Get optimal pool size based on CPU cores and typical workload
   */
  getOptimalPoolSize(): number {
    const cpuCount = require('os').cpus().length;

    // Formula: (core_count × 2) + effective_spindle_count
    // For cloud/SSD: 2-3x CPU cores
    // Typical range: 10-20 connections for single server
    const baseSize = cpuCount * 2;
    return Math.min(Math.max(baseSize, 10), 50);
  }

  /**
   * Record connection acquisition wait time
   */
  recordWaitTime(waitMs: number): void {
    this.waitTimes.push(waitMs);

    if (this.waitTimes.length > this.maxWaitTimeHistorySize) {
      this.waitTimes.shift();
    }

    // Update average
    if (this.waitTimes.length > 0) {
      this.metrics.avgWaitTimeMs =
        Math.round(this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length * 100) / 100;
      this.metrics.maxWaitTimeMs = Math.max(...this.waitTimes);
    }
  }

  /**
   * Record connection timeout
   */
  recordTimeout(): void {
    this.metrics.timeoutCount++;
    this.updateTimeoutRate();
  }

  /**
   * Record failed connection attempt
   */
  recordFailedConnection(): void {
    this.metrics.failedConnections++;
  }

  /**
   * Record successful connection creation
   */
  recordConnectionCreated(): void {
    this.metrics.createdConnections++;
  }

  /**
   * Update current pool state
   */
  updatePoolState(active: number, idle: number, waiting: number, size: number): void {
    this.metrics.activeConnections = active;
    this.metrics.idleConnections = idle;
    this.metrics.waitingRequests = waiting;
    this.metrics.totalSize = size;

    if (size > 0) {
      this.metrics.utilizationPercent = Math.round((active / size) * 100);
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Get pool health status with alerts
   */
  getPoolHealth(): PoolHealth {
    const alerts: PoolAlert[] = [];

    // Check utilization
    if (this.metrics.utilizationPercent > 90) {
      alerts.push({
        severity: 'critical',
        message: 'Pool utilization critically high',
        metric: 'utilizationPercent',
        value: this.metrics.utilizationPercent,
        threshold: 90,
        suggestedAction: 'Increase pool size or optimize queries',
      });
    } else if (this.metrics.utilizationPercent > 75) {
      alerts.push({
        severity: 'warning',
        message: 'Pool utilization elevated',
        metric: 'utilizationPercent',
        value: this.metrics.utilizationPercent,
        threshold: 75,
        suggestedAction: 'Monitor pool usage and consider scaling',
      });
    }

    // Check wait times
    if (this.metrics.avgWaitTimeMs > 500) {
      alerts.push({
        severity: 'critical',
        message: 'High average connection wait time',
        metric: 'avgWaitTimeMs',
        value: this.metrics.avgWaitTimeMs,
        threshold: 500,
        suggestedAction: 'Increase pool size or reduce query duration',
      });
    }

    // Check timeout rate
    if (this.metrics.timeoutRate > 0.05) {
      alerts.push({
        severity: 'critical',
        message: 'High connection timeout rate',
        metric: 'timeoutRate',
        value: this.metrics.timeoutRate,
        threshold: 0.05,
        suggestedAction: 'Increase timeout duration or pool size',
      });
    }

    // Check failure rate
    if (this.metrics.createdConnections > 0) {
      const failureRate = this.metrics.failedConnections / this.metrics.createdConnections;
      if (failureRate > 0.1) {
        alerts.push({
          severity: 'critical',
          message: 'High connection failure rate',
          metric: 'failureRate',
          value: failureRate,
          threshold: 0.1,
          suggestedAction: 'Check database connectivity and credentials',
        });
      }
    }

    // Check waiting requests
    if (this.metrics.waitingRequests > this.metrics.totalSize) {
      alerts.push({
        severity: 'critical',
        message: 'Requests waiting exceeds pool size',
        metric: 'waitingRequests',
        value: this.metrics.waitingRequests,
        threshold: this.metrics.totalSize,
        suggestedAction: 'Pool is exhausted, increase size immediately',
      });
    }

    const recommendations = this.generateRecommendations();

    return {
      isHealthy: alerts.filter((a) => a.severity === 'critical').length === 0,
      utilizationPercent: this.metrics.utilizationPercent,
      avgWaitTimeMs: this.metrics.avgWaitTimeMs,
      timeoutRate: this.metrics.timeoutRate,
      alerts,
      recommendations,
    };
  }

  /**
   * Get recommended configuration based on current metrics
   */
  getRecommendedConfig(): Partial<ConnectionPoolConfig> {
    const currentSize = this.metrics.totalSize;
    const optimalSize = this.getOptimalPoolSize();

    let recommendedSize = currentSize;

    // Scale up if utilization is high
    if (this.metrics.utilizationPercent > 80) {
      recommendedSize = Math.min(Math.ceil(currentSize * 1.5), 100);
    }

    // Scale down if utilization is very low
    if (this.metrics.utilizationPercent < 30 && currentSize > optimalSize) {
      recommendedSize = Math.max(Math.floor(currentSize * 0.8), optimalSize);
    }

    return {
      min: Math.floor(optimalSize * 0.5),
      max: recommendedSize,
      idleTimeoutMs: 30 * 60 * 1000, // 30 minutes
      acquireTimeoutMs: 30 * 1000, // 30 seconds
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalSize: 0,
      utilizationPercent: 0,
      avgWaitTimeMs: 0,
      maxWaitTimeMs: 0,
      timeoutCount: 0,
      timeoutRate: 0,
      createdConnections: 0,
      failedConnections: 0,
    };
    this.waitTimes = [];
  }

  // Private helpers

  private updateTimeoutRate(): void {
    if (this.metrics.createdConnections === 0) {
      this.metrics.timeoutRate = 0;
    } else {
      this.metrics.timeoutRate = this.metrics.timeoutCount / this.metrics.createdConnections;
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Pool size recommendations
    if (this.metrics.utilizationPercent > 85) {
      recommendations.push(
        `Increase pool max size from ${this.metrics.totalSize} to ${Math.ceil(this.metrics.totalSize * 1.3)}`
      );
    }

    // Query optimization
    if (this.metrics.avgWaitTimeMs > 100) {
      recommendations.push('Optimize slow queries to release connections faster');
    }

    // Timeout handling
    if (this.metrics.timeoutCount > 0) {
      recommendations.push('Review and possibly increase connection acquire timeout');
    }

    // Idle connection cleanup
    if (this.metrics.idleConnections > this.metrics.totalSize * 0.5) {
      recommendations.push('Reduce idle connection timeout to free up resources');
    }

    // Database connection check
    if (this.metrics.failedConnections > 0) {
      recommendations.push('Verify database server is accessible and has available connections');
    }

    return recommendations;
  }
}

export default ConnectionPoolOptimizer;
