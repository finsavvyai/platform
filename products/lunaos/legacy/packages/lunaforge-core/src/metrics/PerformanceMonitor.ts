/**
 * Performance monitoring and metrics collection for LunaForge
 */

export interface PerformanceMetrics {
  graphBuildTime: number;
  modeActivationTime: number;
  apiResponseTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  eventProcessingTime: number;
}

export interface MetricSnapshot {
  timestamp: number;
  operation: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface ModeMetrics {
  modeId: string;
  activationTime: number;
  memoryUsage: number;
  apiCalls: number;
  lastActivated?: number;
  errorCount: number;
}

/**
 * Performance monitor for tracking LunaForge operations
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private snapshots: MetricSnapshot[] = [];
  private modeMetrics: Map<string, ModeMetrics> = new Map();
  private startTimes: Map<string, number> = new Map();
  private maxSnapshots = 1000;

  /**
   * Start timing an operation
   */
  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.startTimes.set(timerId, Date.now());
    return timerId;
  }

  /**
   * End timing an operation and record the duration
   */
  endTimer(timerId: string, metadata?: Record<string, any>): number {
    const startTime = this.startTimes.get(timerId);
    if (!startTime) {
      console.warn(`Timer ${timerId} not found`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(timerId);

    const operation = timerId.split('_')[0];
    this.recordMetric(operation, duration);

    // Add snapshot
    this.addSnapshot({
      timestamp: Date.now(),
      operation,
      duration,
      metadata
    });

    return duration;
  }

  /**
   * Record a metric value
   */
  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const values = this.metrics.get(operation)!;
    values.push(value);

    // Keep only last 100 values per operation
    if (values.length > 100) {
      values.shift();
    }
  }

  /**
   * Record mode-specific metrics
   */
  recordModeMetrics(modeId: string, metrics: Partial<ModeMetrics>): void {
    const existing = this.modeMetrics.get(modeId) || {
      modeId,
      activationTime: 0,
      memoryUsage: 0,
      apiCalls: 0,
      errorCount: 0
    };

    this.modeMetrics.set(modeId, {
      ...existing,
      ...metrics,
      lastActivated: metrics.lastActivated || Date.now()
    });
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operation: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return null;

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const graphMetrics = this.getOperationMetrics('graph.build') || { avg: 0, min: 0, max: 0, count: 0 };
    const activationMetrics = this.getOperationMetrics('mode.activation') || { avg: 0, min: 0, max: 0, count: 0 };
    const apiMetrics = this.getOperationMetrics('api.request') || { avg: 0, min: 0, max: 0, count: 0 };

    return {
      graphBuildTime: graphMetrics.avg,
      modeActivationTime: activationMetrics.avg,
      apiResponseTime: apiMetrics.avg,
      memoryUsage: this.getMemoryUsage(),
      cacheHitRate: this.getCacheHitRate(),
      eventProcessingTime: this.getOperationMetrics('event.process')?.avg || 0
    };
  }

  /**
   * Get mode metrics
   */
  getModeMetrics(modeId: string): ModeMetrics | null {
    return this.modeMetrics.get(modeId) || null;
  }

  /**
   * Get all mode metrics
   */
  getAllModeMetrics(): ModeMetrics[] {
    return Array.from(this.modeMetrics.values());
  }

  /**
   * Get recent snapshots
   */
  getSnapshots(limit = 100): MetricSnapshot[] {
    return this.snapshots.slice(-limit);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.snapshots = [];
    this.modeMetrics.clear();
    this.startTimes.clear();
  }

  /**
   * Get memory usage (approximate)
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * Get cache hit rate (placeholder - would integrate with cache manager)
   */
  private getCacheHitRate(): number {
    // This would integrate with the actual cache manager
    return 0.85; // Placeholder value
  }

  /**
   * Add snapshot to history
   */
  private addSnapshot(snapshot: MetricSnapshot): void {
    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.maxSnapshots);
    }
  }

  /**
   * Get performance summary for debugging
   */
  getPerformanceSummary(): string {
    const metrics = this.getCurrentMetrics();
    return `
LunaForge Performance Summary:
- Graph Build Time: ${metrics.graphBuildTime.toFixed(2)}ms
- Mode Activation Time: ${metrics.modeActivationTime.toFixed(2)}ms
- API Response Time: ${metrics.apiResponseTime.toFixed(2)}ms
- Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
- Event Processing: ${metrics.eventProcessingTime.toFixed(2)}ms
    `.trim();
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();