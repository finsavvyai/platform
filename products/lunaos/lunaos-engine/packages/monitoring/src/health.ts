/**
 * Health Check Service for Claude Agent Platform
 *
 * Provides comprehensive health monitoring with:
 * - Service health checks
 * - Infrastructure monitoring
 * - System resource monitoring
 * - Health issue tracking and alerts
 */

import { EventEmitter } from 'events';
import {
  HealthCheckResult,
  HealthCheckDetails,
  ServiceHealth,
  InfrastructureHealth,
  SystemHealth,
  HealthIssue,
  MonitoringConfig
} from './interfaces';

export class HealthCheckService extends EventEmitter {
  private services: Map<string, () => Promise<ServiceHealth>> = new Map();
  private config: MonitoringConfig['healthCheck'];
  private issues: HealthIssue[] = [];
  private lastCheck: Date | null = null;
  private isRunning = false;

  constructor(config: MonitoringConfig['healthCheck']) {
    super();
    this.config = config;
  }

  /**
   * Register a service health check
   */
  registerService(name: string, healthCheck: () => Promise<ServiceHealth>): void {
    this.services.set(name, healthCheck);
  }

  /**
   * Unregister a service health check
   */
  unregisterService(name: string): void {
    this.services.delete(name);
  }

  /**
   * Run comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const services: ServiceHealth[] = [];
    const issues: HealthIssue[] = [];
    const promises: Promise<ServiceHealth>[] = [];

    // Check all registered services
    for (const [name, healthCheck] of this.services) {
      promises.push(
        this.runServiceHealthCheck(name, healthCheck).catch(error => ({
          name,
          status: 'unhealthy' as const,
          responseTime: 0,
          lastCheck: new Date(),
          uptime: 0,
          errorRate: 1,
          throughput: 0,
          details: { error: error.message },
        }))
      );
    }

    try {
      const serviceResults = await Promise.all(promises);
      services.push(...serviceResults);

      // Check infrastructure
      const infrastructure = await this.checkInfrastructureHealth();

      // Check system resources
      const system = await this.checkSystemHealth();

      // Collect issues from all checks
      for (const service of services) {
        if (service.status !== 'healthy') {
          issues.push({
            severity: service.status === 'degraded' ? 'medium' : 'high',
            category: 'service',
            message: `Service ${service.name} is ${service.status}`,
            details: service.details,
            timestamp: service.lastCheck,
          });
        }
      }

      // Add infrastructure issues
      if (infrastructure.database.status !== 'healthy') {
        issues.push({
          severity: infrastructure.database.status === 'degraded' ? 'medium' : 'high',
          category: 'infrastructure',
          message: `Database is ${infrastructure.database.status}`,
          details: infrastructure.database.details,
          timestamp: new Date(),
        });
      }

      if (infrastructure.cache.status !== 'healthy') {
        issues.push({
          severity: infrastructure.cache.status === 'degraded' ? 'medium' : 'high',
          category: 'infrastructure',
          message: `Cache is ${infrastructure.cache.status}`,
          details: infrastructure.cache.details,
          timestamp: new Date(),
        });
      }

      if (infrastructure.messaging.status !== 'healthy') {
        issues.push({
          severity: infrastructure.messaging.status === 'degraded' ? 'medium' : 'high',
          category: 'infrastructure',
          message: `Messaging is ${infrastructure.messaging.status}`,
          details: infrastructure.messaging.details,
          timestamp: new Date(),
        });
      }

      // Add system issues
      if (system.cpu.usage > 90) {
        issues.push({
          severity: 'high',
          category: 'system',
          message: `High CPU usage: ${system.cpu.usage.toFixed(1)}%`,
          details: { cpu: system.cpu },
          timestamp: new Date(),
        });
      }

      if (system.memory.percentage > 90) {
        issues.push({
          severity: 'high',
          category: 'system',
          message: `High memory usage: ${system.memory.percentage.toFixed(1)}%`,
          details: { memory: system.memory },
          timestamp: new Date(),
        });
      }

      if (system.disk.percentage > 95) {
        issues.push({
          severity: 'critical',
          category: 'system',
          message: `Low disk space: ${system.disk.percentage.toFixed(1)}% used`,
          details: { disk: system.disk },
          timestamp: new Date(),
        });
      }

      // Determine overall status
      const criticalIssues = issues.filter(i => i.severity === 'critical');
      const highIssues = issues.filter(i => i.severity === 'high');
      const mediumIssues = issues.filter(i => i.severity === 'medium');

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (criticalIssues.length > 0) {
        status = 'unhealthy';
      } else if (highIssues.length > 0 || mediumIssues.length > 2) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      const result: HealthCheckResult = {
        status,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details: {
          services,
          infrastructure,
          system,
        },
        issues,
      };

      this.lastCheck = new Date();
      this.issues = issues;

      this.emit('healthCheck', result);

      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        details: {
          services,
          infrastructure: await this.checkInfrastructureHealth(),
          system: await this.checkSystemHealth(),
        },
        issues: [
          {
            severity: 'critical',
            category: 'system',
            message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            details: { error },
            timestamp: new Date(),
          },
        ],
      };
    }
  }

  /**
   * Start continuous health monitoring
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.runHealthCheckLoop();
  }

  /**
   * Stop continuous health monitoring
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Get last health check result
   */
  getLastCheck(): HealthCheckResult | null {
    // Return cached result or null if no check has been run
    return null; // Would need to cache the last result
  }

  /**
   * Get current health issues
   */
  getIssues(): HealthIssue[] {
    return [...this.issues];
  }

  /**
   * Resolve a health issue
   */
  resolveIssue(issueId: string): void {
    const issue = this.issues.find(i => i.message.includes(issueId));
    if (issue) {
      issue.resolved = true;
      issue.resolvedAt = new Date();
      this.emit('issueResolved', issue);
    }
  }

  private async runServiceHealthCheck(
    name: string,
    healthCheck: () => Promise<ServiceHealth>
  ): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const health = await Promise.race([
        healthCheck(),
        new Promise<ServiceHealth>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
        ) as Promise<ServiceHealth>
      ]);

      return {
        ...health,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        uptime: 0,
        errorRate: 1,
        throughput: 0,
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  private async checkInfrastructureHealth(): Promise<InfrastructureHealth> {
    const [database, cache, messaging, storage] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
      this.checkMessagingHealth(),
      this.checkStorageHealth(),
    ]);

    return {
      database: database.status === 'fulfilled' ? database.value : this.getUnhealthyDatabaseHealth(),
      cache: cache.status === 'fulfilled' ? cache.value : this.getUnhealthyCacheHealth(),
      messaging: messaging.status === 'fulfilled' ? messaging.value : this.getUnhealthyMessagingHealth(),
      storage: storage.status === 'fulfilled' ? storage.value : this.getUnhealthyStorageHealth(),
    };
  }

  private async checkDatabaseHealth(): Promise<DatabaseHealth> {
    // This would be implemented with actual database health checks
    // For now, return a mock healthy status
    return {
      status: 'healthy',
      responseTime: 10,
      connectionPool: {
        active: 2,
        idle: 8,
        total: 10,
      },
      queries: {
        total: 1000,
        slow: 5,
        failed: 0,
      },
    };
  }

  private async checkCacheHealth(): Promise<CacheHealth> {
    // This would be implemented with actual cache health checks
    return {
      status: 'healthy',
      responseTime: 5,
      hitRate: 0.85,
      memoryUsage: {
        used: 512 * 1024 * 1024, // 512MB
        total: 1024 * 1024 * 1024, // 1GB
        percentage: 50,
      },
      keyCount: 10000,
    };
  }

  private async checkMessagingHealth(): Promise<MessagingHealth> {
    // This would be implemented with actual messaging health checks
    return {
      status: 'healthy',
      connected: true,
      queues: [
        {
          name: 'tasks',
          status: 'healthy',
          messages: { ready: 10, unacknowledged: 2, total: 12 },
          consumers: 3,
          rate: 50,
        },
      ],
      connectionPool: {
        active: 1,
        idle: 4,
        total: 5,
      },
    };
  }

  private async checkStorageHealth(): Promise<StorageHealth> {
    // This would be implemented with actual storage health checks
    return {
      status: 'healthy',
      responseTime: 20,
      usage: {
        used: 10 * 1024 * 1024 * 1024, // 10GB
        total: 100 * 1024 * 1024 * 1024, // 100GB
        percentage: 10,
      },
      availability: 99.99,
    };
  }

  private async checkSystemHealth(): Promise<SystemHealth> {
    const os = require('os');
    const process = require('process');

    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
        loadAverage: os.loadavg(),
        cores: os.cpus().length,
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        heap: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        },
      },
      disk: {
        used: 0, // Would need to implement disk usage check
        total: 0,
        percentage: 0,
        readSpeed: 0,
        writeSpeed: 0,
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
      },
      uptime,
    };
  }

  private getUnhealthyDatabaseHealth(): DatabaseHealth {
    return {
      status: 'unhealthy',
      responseTime: -1,
      connectionPool: { active: 0, idle: 0, total: 0 },
      queries: { total: 0, slow: 0, failed: 0 },
    };
  }

  private getUnhealthyCacheHealth(): CacheHealth {
    return {
      status: 'unhealthy',
      responseTime: -1,
      hitRate: 0,
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      keyCount: 0,
    };
  }

  private getUnhealthyMessagingHealth(): MessagingHealth {
    return {
      status: 'unhealthy',
      connected: false,
      queues: [],
      connectionPool: { active: 0, idle: 0, total: 0 },
    };
  }

  private getUnhealthyStorageHealth(): StorageHealth {
    return {
      status: 'unhealthy',
      responseTime: -1,
      usage: { used: 0, total: 0, percentage: 0 },
      availability: 0,
    };
  }

  private async runHealthCheckLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkHealth();
        await new Promise(resolve => setTimeout(resolve, this.config.interval));
      } catch (error) {
        console.error('Health check loop error:', error);
        await new Promise(resolve => setTimeout(resolve, this.config.interval));
      }
    }
  }
}
