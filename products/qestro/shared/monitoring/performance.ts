import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from '../utils';
import { telemetry, trackMetric, trackPerformance } from './index';

export interface PerformanceMeasurement {
  name: string;
  type: 'mark' | 'measure' | 'navigation' | 'resource' | 'paint';
  startTime: number;
  duration?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceMark {
  name: string;
  startTime: number;
  timestamp: Date;
}

export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    heap: {
      total: number;
      used: number;
      limit: number;
    };
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
    memory: NodeJS.MemoryUsage;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    connections: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
}

export interface PerformanceAlert {
  id: string;
  type: 'cpu' | 'memory' | 'response_time' | 'error_rate' | 'throughput';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  threshold: number;
  actual: number;
  timestamp: Date;
  resolved?: boolean;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private eventEmitter: EventEmitter;
  private observer: PerformanceObserver;
  private marks: Map<string, PerformanceMark> = new Map();
  private entries: PerformanceEntry[] = [];
  private alerts: Map<string, PerformanceAlert> = new Map();
  private systemMetricsHistory: SystemMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private thresholds = {
    cpuUsage: 80,
    memoryUsage: 85,
    responseTime: 5000,
    errorRate: 0.05,
    throughput: 100
  };

  private constructor() {
    this.eventEmitter = new EventEmitter();
    this.setupPerformanceObserver();
    this.startSystemMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private setupPerformanceObserver(): void {
    // Setup Node.js performance observer
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.handlePerformanceEntry(entry);
      }
    });

    // Observe different types of performance entries
    this.observer.observe({ entryTypes: ['measure', 'mark', 'navigation', 'resource'] });
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    const performanceEntry: PerformanceEntry = {
      name: entry.name,
      entryType: entry.entryType,
      startTime: entry.startTime,
      duration: entry.duration,
      timestamp: new Date()
    };

    this.entries.push(performanceEntry);

    // Keep only last 1000 entries
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000);
    }

    // Emit event for real-time processing
    this.eventEmitter.emit('performance.entry', performanceEntry);

    // Track metrics
    trackMetric(`performance_${entry.entryType}`, entry.duration, 'histogram', {
      labels: { name: entry.name },
      unit: 'milliseconds'
    });

    // Check for performance alerts
    this.checkPerformanceAlerts(performanceEntry);
  }

  // Performance measurement methods
  mark(name: string, metadata?: Record<string, any>): void {
    const timestamp = performance.now();
    performance.mark(name);

    const mark: PerformanceMark = {
      name,
      startTime: timestamp,
      timestamp: new Date()
    };

    this.marks.set(name, mark);

    this.eventEmitter.emit('performance.mark', mark);
  }

  measure(name: string, startMark: string, endMark?: string, metadata?: Record<string, any>): number {
    try {
      // Use performance marks if provided
      if (startMark && endMark) {
        performance.measure(name, startMark, endMark);
      } else if (startMark) {
        performance.measure(name, startMark);
      }

      const measure = performance.getEntriesByName(name, 'measure').pop();
      if (!measure) {
        throw new Error(`Measure '${name}' not found`);
      }

      const duration = measure.duration;

      // Clean up marks to avoid memory leaks
      if (startMark && this.marks.has(startMark)) {
        this.marks.delete(startMark);
      }
      if (endMark && this.marks.has(endMark)) {
        this.marks.delete(endMark);
      }

      // Clean up the measure
      performance.clearMarks(name);

      trackPerformance(name, duration, { metadata });

      return duration;
    } catch (error) {
      console.error(`Error measuring ${name}:`, error);
      return 0;
    }
  }

  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startMark = `${name}_start`;
    const endMark = `${name}_end`;

    this.mark(startMark, { type: 'async_start', ...metadata });

    try {
      const result = await fn();
      this.mark(endMark, { type: 'async_end', ...metadata });
      this.measure(name, startMark, endMark, metadata);
      return result;
    } catch (error) {
      this.mark(endMark, { type: 'async_error', error: (error as Error).message });
      this.measure(name, startMark, endMark, metadata);
      throw error;
    }
  }

  measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const startMark = `${name}_start`;
    const endMark = `${name}_end`;

    this.mark(startMark, { type: 'sync_start', ...metadata });

    try {
      const result = fn();
      this.mark(endMark, { type: 'sync_end', ...metadata });
      this.measure(name, startMark, endMark, metadata);
      return result;
    } catch (error) {
      this.mark(endMark, { type: 'sync_error', error: (error as Error).message });
      this.measure(name, startMark, endMark, metadata);
      throw error;
    }
  }

  // System monitoring
  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds
  }

  private collectSystemMetrics(): void {
    const metrics: SystemMetrics = {
      cpu: this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      process: this.getProcessMetrics(),
      network: this.getNetworkMetrics(),
      disk: this.getDiskMetrics()
    };

    this.systemMetricsHistory.push(metrics);

    // Keep only last 1000 data points
    if (this.systemMetricsHistory.length > 1000) {
      this.systemMetricsHistory = this.systemMetricsHistory.slice(-1000);
    }

    // Track system metrics
    trackMetric('system_cpu_usage', metrics.cpu.usage, 'gauge', { unit: 'percent' });
    trackMetric('system_memory_usage', metrics.memory.usage, 'gauge', { unit: 'percent' });
    trackMetric('process_memory_heap_used', metrics.process.memory.heapUsed, 'gauge', { unit: 'bytes' });

    // Check for system alerts
    this.checkSystemAlerts(metrics);

    this.eventEmitter.emit('system.metrics', metrics);
  }

  private getCpuMetrics(): SystemMetrics['cpu'] {
    const cpus = require('os').cpus();
    const loadAverage = require('os').loadavg();

    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (idle / total * 100);

    return {
      usage,
      loadAverage,
      cores: cpus.length
    };
  }

  private getMemoryMetrics(): SystemMetrics['memory'] {
    const os = require('os');
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usage = (used / total) * 100;

    const processMemory = process.memoryUsage();

    return {
      total,
      used,
      free,
      usage,
      heap: {
        total: processMemory.heapTotal,
        used: processMemory.heapUsed,
        limit: processMemory.heapUsed * 1.5 // Rough estimate
      }
    };
  }

  private getProcessMetrics(): SystemMetrics['process'] {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      memory: process.memoryUsage()
    };
  }

  private getNetworkMetrics(): SystemMetrics['network'] {
    // This would integrate with actual network monitoring
    // For now, return placeholder values
    return {
      bytesReceived: 0,
      bytesSent: 0,
      connections: 0
    };
  }

  private getDiskMetrics(): SystemMetrics['disk'] {
    // This would integrate with actual disk monitoring
    // For now, return placeholder values
    const total = 1024 * 1024 * 1024 * 100; // 100GB
    const used = total * 0.5; // 50GB used

    return {
      total,
      used,
      free: total - used,
      usage: (used / total) * 100
    };
  }

  // Alert checking
  private checkPerformanceAlerts(entry: PerformanceEntry): void {
    if (entry.duration > this.thresholds.responseTime) {
      this.createPerformanceAlert({
        id: `slow_response_${entry.name}_${Date.now()}`,
        type: 'response_time',
        severity: 'warning',
        message: `Slow response time for ${entry.name}: ${entry.duration.toFixed(2)}ms`,
        threshold: this.thresholds.responseTime,
        actual: entry.duration,
        timestamp: new Date()
      });
    }
  }

  private checkSystemAlerts(metrics: SystemMetrics): void {
    // CPU usage alert
    if (metrics.cpu.usage > this.thresholds.cpuUsage) {
      this.createPerformanceAlert({
        id: `high_cpu_${Date.now()}`,
        type: 'cpu',
        severity: metrics.cpu.usage > 95 ? 'critical' : 'warning',
        message: `High CPU usage: ${metrics.cpu.usage.toFixed(2)}%`,
        threshold: this.thresholds.cpuUsage,
        actual: metrics.cpu.usage,
        timestamp: new Date()
      });
    }

    // Memory usage alert
    if (metrics.memory.usage > this.thresholds.memoryUsage) {
      this.createPerformanceAlert({
        id: `high_memory_${Date.now()}`,
        type: 'memory',
        severity: metrics.memory.usage > 95 ? 'critical' : 'warning',
        message: `High memory usage: ${metrics.memory.usage.toFixed(2)}%`,
        threshold: this.thresholds.memoryUsage,
        actual: metrics.memory.usage,
        timestamp: new Date()
      });
    }
  }

  private createPerformanceAlert(alert: PerformanceAlert): void {
    this.alerts.set(alert.id, alert);
    this.eventEmitter.emit('performance.alert', alert);

    // Send to telemetry
    telemetry.trackEvent('performance_alert', {
      type: alert.type,
      severity: alert.severity,
      threshold: alert.threshold,
      actual: alert.actual
    }, {
      category: 'performance',
      metadata: { alertId: alert.id }
    });
  }

  // Public API methods
  public getMeasurements(filter?: {
    name?: string;
    type?: string;
    startTime?: Date;
    endTime?: Date;
  }): PerformanceEntry[] {
    let entries = this.entries;

    if (filter) {
      if (filter.name) {
        entries = entries.filter(e => e.name === filter.name);
      }
      if (filter.type) {
        entries = entries.filter(e => e.entryType === filter.type);
      }
      if (filter.startTime) {
        entries = entries.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        entries = entries.filter(e => e.timestamp <= filter.endTime!);
      }
    }

    return entries;
  }

  public getSystemMetrics(limit?: number): SystemMetrics[] {
    if (limit) {
      return this.systemMetricsHistory.slice(-limit);
    }
    return this.systemMetricsHistory;
  }

  public getCurrentMetrics(): SystemMetrics | null {
    return this.systemMetricsHistory.length > 0
      ? this.systemMetricsHistory[this.systemMetricsHistory.length - 1]
      : null;
  }

  public getAlerts(resolved?: boolean): PerformanceAlert[] {
    const alerts = Array.from(this.alerts.values());
    return resolved !== undefined
      ? alerts.filter(alert => alert.resolved === resolved)
      : alerts;
  }

  public resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.eventEmitter.emit('performance.alert.resolved', alert);
    }
  }

  public setThreshold(type: keyof typeof PerformanceMonitor.prototype.thresholds, value: number): void {
    this.thresholds[type] = value;
  }

  public getThresholds(): typeof PerformanceMonitor.prototype.thresholds {
    return { ...this.thresholds };
  }

  // Decorator for measuring function performance
  public measure<T extends any[], R>(
    name?: string,
    metadata?: Record<string, any>
  ) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      const measureName = name || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = function (...args: T): R {
        const startMark = `${measureName}_start`;
        const endMark = `${measureName}_end`;

        PerformanceMonitor.getInstance().mark(startMark, {
          type: 'method_start',
          className: target.constructor.name,
          methodName: propertyKey,
          ...metadata
        });

        try {
          const result = originalMethod.apply(this, args);

          if (result && typeof result.then === 'function') {
            // Async method
            return result
              .then((value: R) => {
                PerformanceMonitor.getInstance().mark(endMark, {
                  type: 'method_end',
                  className: target.constructor.name,
                  methodName: propertyKey
                });
                PerformanceMonitor.getInstance().measure(measureName, startMark, endMark, metadata);
                return value;
              })
              .catch((error: any) => {
                PerformanceMonitor.getInstance().mark(endMark, {
                  type: 'method_error',
                  className: target.constructor.name,
                  methodName: propertyKey,
                  error: error.message
                });
                PerformanceMonitor.getInstance().measure(measureName, startMark, endMark, metadata);
                throw error;
              });
          } else {
            // Sync method
            PerformanceMonitor.getInstance().mark(endMark, {
              type: 'method_end',
              className: target.constructor.name,
              methodName: propertyKey
            });
            PerformanceMonitor.getInstance().measure(measureName, startMark, endMark, metadata);
            return result;
          }
        } catch (error) {
          PerformanceMonitor.getInstance().mark(endMark, {
            type: 'method_error',
            className: target.constructor.name,
            methodName: propertyKey,
            error: (error as Error).message
          });
          PerformanceMonitor.getInstance().measure(measureName, startMark, endMark, metadata);
          throw error;
        }
      };

      return descriptor;
    };
  }

  // Event subscription
  public onMeasurement(callback: (entry: PerformanceEntry) => void): void {
    this.eventEmitter.on('performance.entry', callback);
  }

  public onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.eventEmitter.on('performance.alert', callback);
  }

  public onAlertResolved(callback: (alert: PerformanceAlert) => void): void {
    this.eventEmitter.on('performance.alert.resolved', callback);
  }

  public onSystemMetrics(callback: (metrics: SystemMetrics) => void): void {
    this.eventEmitter.on('system.metrics', callback);
  }

  // Cleanup
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Export convenience functions and decorator
export const measure = performanceMonitor.measure.bind(performanceMonitor);
export const mark = (name: string, metadata?: any) => performanceMonitor.mark(name, metadata);
export const measureAsync = <T>(name: string, fn: () => Promise<T>, metadata?: any) =>
  performanceMonitor.measureAsync(name, fn, metadata);
export const measureSync = <T>(name: string, fn: () => T, metadata?: any) =>
  performanceMonitor.measureSync(name, fn, metadata);

// Performance measurement middleware for Express
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const startMark = `req_${req.id}_start`;
  mark(startMark, {
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });

  const originalSend = res.send;
  res.send = function (body: any) {
    const endMark = `req_${req.id}_end`;
    mark(endMark, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    });

    performanceMonitor.measure(`http_request`, startMark, endMark, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode
    });

    return originalSend.call(this, body);
  };

  next();
};

export default performanceMonitor;