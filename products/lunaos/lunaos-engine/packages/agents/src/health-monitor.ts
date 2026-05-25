/**
 * Health Monitoring System for Claude Agent Platform
 *
 * Provides comprehensive health monitoring with:
 * - Real-time health checks
 * - Custom health check configurations
 * - Health metrics collection
 * - Alerting and notifications
 * - Health status persistence
 */

import { EventEmitter } from 'events';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import {
  AgentHealth,
  HealthCheck,
  HealthMetrics,
  HealthMonitorConfig,
  HealthThresholds,
  AlertingConfig,
  HealthCheckDefinition,
  HealthCheckType
} from './interfaces';
import * as cron from 'node-cron';

export class HealthMonitor extends EventEmitter {
  private cache: RedisCache;
  private messaging: QueueService;
  private config: HealthMonitorConfig;
  private registeredAgents: Map<string, AgentHealthConfig> = new Map();
  private healthChecks: Map<string, cron.ScheduledTask> = new Map();
  private healthHistory: Map<string, AgentHealth[]> = new Map();
  private alerts: Map<string, number> = new Map(); // cooldown tracking

  constructor(config: HealthMonitorConfig) {
    super();
    this.cache = cache;
    this.messaging = messaging;
    this.config = config;
  }

  /**
   * Register an agent for health monitoring
   */
  async registerAgent(agentId: string, healthConfig: AgentHealthConfig): Promise<void> {
    try {
      // Validate health configuration
      this.validateHealthConfig(healthConfig);

      // Store agent configuration
      this.registeredAgents.set(agentId, healthConfig);

      // Initialize health record
      const initialHealth: AgentHealth = {
        status: 'unknown',
        lastCheck: new Date(),
        metrics: this.createEmptyMetrics(),
        checks: [],
        uptime: 0,
        restartCount: 0,
        errorCount: 0,
      };

      this.healthHistory.set(agentId, [initialHealth]);

      // Save to cache
      await this.saveAgentHealth(agentId, initialHealth);

      // Start health checks
      if (healthConfig.enabled) {
        await this.startHealthChecks(agentId, healthConfig);
      }

      this.emit('agentRegistered', { agentId, config: healthConfig });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Unregister an agent from health monitoring
   */
  async unregisterAgent(agentId: string): Promise<void> {
    try {
      // Stop health checks
      await this.stopHealthChecks(agentId);

      // Remove from registry
      this.registeredAgents.delete(agentId);
      this.healthHistory.delete(agentId);
      this.alerts.delete(agentId);

      // Remove from cache
      await this.cache.delete(`agent:health:${agentId}`);

      this.emit('agentUnregistered', { agentId });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get agent health status
   */
  async getAgentHealth(agentId: string): Promise<AgentHealth | null> {
    try {
      // Try cache first
      const cached = await this.cache.get<AgentHealth>(`agent:health:${agentId}`);
      if (cached && cached.hit) {
        return cached.value;
      }

      // Get from history
      const history = this.healthHistory.get(agentId);
      if (history && history.length > 0) {
        return history[history.length - 1];
      }

      return null;
    } catch (error) {
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Get health metrics for an agent
   */
  async getHealthMetrics(agentId: string): Promise<HealthMetrics> {
    try {
      const health = await this.getAgentHealth(agentId);
      return health ? health.metrics : this.createEmptyMetrics();
    } catch (error) {
      this.emit('error', error);
      return this.createEmptyMetrics();
    }
  }

  /**
   * Update health check configuration
   */
  async updateHealthCheck(agentId: string, healthConfig: AgentHealthConfig): Promise<void> {
    try {
      const isRegistered = this.registeredAgents.has(agentId);
      if (!isRegistered) {
        throw new Error('Agent not registered for health monitoring');
      }

      // Stop existing checks
      await this.stopHealthChecks(agentId);

      // Update configuration
      this.registeredAgents.set(agentId, healthConfig);

      // Start new checks if enabled
      if (healthConfig.enabled) {
        await this.startHealthChecks(agentId, healthConfig);
      }

      this.emit('healthCheckUpdated', { agentId, config: healthConfig });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Manually trigger health check for an agent
   */
  async triggerHealthCheck(agentId: string): Promise<AgentHealth> {
    try {
      const config = this.registeredAgents.get(agentId);
      if (!config) {
        throw new Error('Agent not registered for health monitoring');
      }

      const health = await this.performHealthCheck(agentId, config);

      // Update history
      await this.updateHealthHistory(agentId, health);

      return health;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get health summary for all registered agents
   */
  async getHealthSummary(): Promise<{
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    agents: Array<{
      id: string;
      status: string;
      lastCheck: Date;
      uptime: number;
      errorCount: number;
    }>;
  }> {
    try {
      const agents = Array.from(this.registeredAgents.keys());
      const agentHealthPromises = agents.map(async (agentId) => {
        const health = await this.getAgentHealth(agentId);
        return {
          id: agentId,
          status: health?.status || 'unknown',
          lastCheck: health?.lastCheck || new Date(),
          uptime: health?.uptime || 0,
          errorCount: health?.errorCount || 0,
        };
      });

      const agentHealth = await Promise.all(agentHealthPromises);

      const summary = {
        total: agentHealth.length,
        healthy: agentHealth.filter(a => a.status === 'healthy').length,
        degraded: agentHealth.filter(a => a.status === 'degraded').length,
        unhealthy: agentHealth.filter(a => a.status === 'unhealthy').length,
        unknown: agentHealth.filter(a => a.status === 'unknown').length,
        agents: agentHealth,
      };

      return summary;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Initialize the health monitor
   */
  async initialize(): Promise<void> {
    // Restore health history from cache if enabled
    if (this.config.persistence) {
      await this.restoreHealthHistory();
    }

    this.emit('initialized');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Stop all health checks
    for (const [agentId] of this.healthChecks) {
      await this.stopHealthChecks(agentId);
    }

    // Clear all data
    this.registeredAgents.clear();
    this.healthChecks.clear();
    this.healthHistory.clear();
    this.alerts.clear();

    this.removeAllListeners();
  }

  /**
   * Start health checks for an agent
   */
  private async startHealthChecks(agentId: string, config: AgentHealthConfig): Promise<void> {
    const interval = config.interval || this.config.interval;
    const cronExpression = `*/${Math.floor(interval / 60000)} * * * * *`; // Convert to minutes

    const task = cron.schedule(cronExpression, async () => {
      try {
        await this.performHealthCheck(agentId, config);
      } catch (error) {
        console.error(`Health check failed for agent ${agentId}:`, error);
      }
    }, {
      scheduled: false, // Don't run immediately on creation
      timezone: 'UTC',
    });

    this.healthChecks.set(agentId, task);
    task.start();

    this.emit('healthChecksStarted', { agentId, interval });
  }

  /**
   * Stop health checks for an agent
   */
  private async stopHealthChecks(agentId: string): Promise<void> {
    const task = this.healthChecks.get(agentId);
    if (task) {
      task.stop();
      this.healthChecks.delete(agentId);
      this.emit('healthChecksStopped', { agentId });
    }
  }

  /**
   * Perform comprehensive health check for an agent
   */
  private async performHealthCheck(agentId: string, config: AgentHealthConfig): Promise<AgentHealth> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    try {
      // Get previous health record
      const previousHealth = this.healthHistory.get(agentId);
      const lastHealth = previousHealth ? previousHealth[previousHealth.length - 1] : null;

      // Perform configured health checks
      for (const checkConfig of config.checks) {
        const check = await this.performSingleHealthCheck(agentId, checkConfig);
        checks.push(check);
      }

      // Determine overall health status
      const overallStatus = this.determineHealthStatus(checks);

      // Calculate metrics
      const metrics = await this.calculateMetrics(agentId, checks);

      // Update health record
      const health: AgentHealth = {
        status: overallStatus,
        lastCheck: new Date(),
        metrics,
        checks,
        uptime: lastHealth ? lastHealth.uptime + (Date.now() - startTime) : 0,
        restartCount: lastHealth ? lastHealth.restartCount : 0,
        errorCount: lastHealth ?
          lastHealth.errorCount + checks.filter(c => c.status === 'fail').length :
          checks.filter(c => c.status === 'fail').length,
        lastError: checks.find(c => c.status === 'fail') ? {
          code: 'HEALTH_CHECK_FAILED',
          message: checks.find(c => c.status === 'fail')?.message,
          timestamp: checks.find(c => c.status === 'fail')?.timestamp || new Date(),
        } : undefined,
      };

      // Save health record
      await this.saveAgentHealth(agentId, health);
      await this.updateHealthHistory(agentId, health);

      // Check for status changes
      if (lastHealth && lastHealth.status !== overallStatus) {
        await this.handleStatusChange(agentId, lastHealth.status, overallStatus, health);
      }

      // Check for alerts
      await this.checkAlerts(agentId, health, config);

      return health;
    } catch (error) {
      const errorHealth: AgentHealth = {
        status: 'unhealthy',
        lastCheck: new Date(),
        metrics: this.createEmptyMetrics(),
        checks: [{
          name: 'system',
          type: 'system',
          status: 'fail',
          message: `Health check error: ${error.message}`,
          timestamp: new Date(),
          timeout: 0,
          interval: 0,
        }],
        uptime: 0,
        restartCount: 0,
        errorCount: 1,
        lastError: {
          code: 'SYSTEM_ERROR',
          message: error.message,
          timestamp: new Date(),
        },
      };

      await this.saveAgentHealth(agentId, errorHealth);
      await this.updateHealthHistory(agentId, errorHealth);

      return errorHealth;
    }
  }

  /**
   * Perform a single health check
   */
  private async performSingleHealthCheck(
    agentId: string,
    checkConfig: HealthCheckDefinition
  ): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      let result: any;
      let success = false;

      switch (checkConfig.type) {
        case 'memory':
          result = await this.checkMemoryUsage(agentId, checkConfig);
          break;
        case 'cpu':
          result = await this.checkCPUUsage(agentId, checkConfig);
          break;
        case 'disk':
          result = await this.checkDiskUsage(agentId, checkConfig);
          break;
        case 'network':
          result = await this.checkNetworkConnectivity(agentId, checkConfig);
          break;
        case 'api':
          result = await this.checkAPIHealth(agentId, checkConfig);
          break;
        case 'database':
          result = await this.checkDatabaseHealth(agentId, checkConfig);
          break;
        case 'cache':
          result = await this.checkCacheHealth(agentId, checkConfig);
          break;
        case 'messaging':
          result = await this.checkMessagingHealth(agentId, checkConfig);
          break;
        case 'custom':
          result = await this.performCustomHealthCheck(agentId, checkConfig);
          break;
        default:
          throw new Error(`Unsupported health check type: ${checkConfig.type}`);
      }

      const check: HealthCheck = {
        name: checkConfig.name,
        type: checkConfig.type,
        status: result.success ? 'pass' : 'fail',
        message: result.message,
        timestamp: new Date(),
        timeout: checkConfig.timeout,
        interval: 0, // Would be configured at agent level
        details: result.details,
      };

      return check;
    } catch (error) {
      return {
        name: checkConfig.name,
        type: checkConfig.type,
        status: 'fail',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date(),
        timeout: checkConfig.timeout,
        interval: 0,
        details: { error: error.message },
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // This would integrate with actual agent monitoring
    // For now, return mock data
    const memoryUsage = Math.random() * 100;
    const success = memoryUsage < config.threshold;

    return {
      success,
      message: success ? 'Memory usage is normal' : `Memory usage is high: ${memoryUsage.toFixed(2)}%`,
      details: { usage: memoryUsage, threshold: config.threshold },
    };
  }

  /**
   * Check CPU usage
   */
  private async checkCPUUsage(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Mock implementation
    const cpuUsage = Math.random() * 100;
    const success = cpuUsage < config.threshold;

    return {
      success,
      message: success ? 'CPU usage is normal' : `CPU usage is high: ${cpuUsage.toFixed(2)}%`,
      details: { usage: cpuUsage, threshold: config.threshold },
    };
  }

  /**
   * Check disk usage
   */
  private async checkDiskUsage(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Mock implementation
    const diskUsage = Math.random() * 100;
    const success = diskUsage < config.threshold;

    return {
      success,
      message: success ? 'Disk usage is normal' : `Disk usage is high: ${diskUsage.toFixed(2)}%`,
      details: { usage: diskUsage, threshold: config.threshold },
    };
  }

  /**
   * Check network connectivity
   */
  private async checkNetworkConnectivity(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Mock implementation
    const latency = Math.random() * 1000;
    const success = latency < config.threshold;

    return {
      success,
      message: success ? 'Network connectivity is good' : `Network latency is high: ${latency.toFixed(2)}ms`,
      details: { latency, threshold: config.threshold },
    };
  }

  /**
   * Check API health endpoint
   */
  private async checkAPIHealth(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // This would make HTTP request to agent's health endpoint
    const responseTime = Math.random() * 500;
    const success = responseTime < (config.timeout || 1000);

    return {
      success,
      message: success ? 'API endpoint is responsive' : `API endpoint is slow: ${responseTime.toFixed(2)}ms`,
      details: { responseTime, timeout: config.timeout || 1000 },
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseHealth(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Mock implementation
    const connectionTime = Math.random() * 200;
    const success = connectionTime < 100;

    return {
      success,
      message: success ? 'Database connection is healthy' : `Database connection is slow: ${connectionTime.toFixed(2)}ms`,
      details: { connectionTime },
    };
  }

  /**
   * Check cache connectivity
   */
  private async checkCacheHealth(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Mock implementation
    const cacheResponseTime = Math.random() * 50;
    const success = cacheResponseTime < 50;

    return {
      success,
      message: success ? 'Cache is responsive' : `Cache is slow: ${cacheResponseTime.toFixed(2)}ms`,
      details: { responseTime: cacheResponseTime },
    };
  }

  /**
   * Check messaging system health
   */
  private async checkMessagingHealth(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Mock implementation
    const queueHealth = Math.random();
    const success = queueHealth > 0.8;

    return {
      success,
      message: success ? 'Messaging system is healthy' : 'Messaging system has issues',
      details: { healthScore: queueHealth },
    };
  }

  /**
   * Perform custom health check
   */
  private async performCustomHealthCheck(agentId: string, config: HealthCheckDefinition): Promise<any> {
    // Execute custom script or make custom request
    // This would be highly configurable based on agent needs
    return {
      success: true,
      message: 'Custom health check passed',
      details: { type: config.type },
    };
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (checks.length === 0) {
      return 'unknown';
    }

    const criticalChecks = checks.filter(c => c.critical);
    const failedChecks = checks.filter(c => c.status === 'fail');
    const warningChecks = checks.filter(c => c.status === 'warn');

    if (criticalChecks.length > 0 || failedChecks.length > 0) {
      return 'unhealthy';
    }

    if (warningChecks.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Calculate health metrics
   */
  private async calculateMetrics(agentId: string, checks: HealthCheck[]): Promise<HealthMetrics> {
    // Mock metrics calculation - would integrate with actual monitoring systems
    return {
      cpu: {
        usage: Math.random() * 100,
        loadAverage: [Math.random() * 2, Math.random() * 2, Math.random() * 2],
        cores: 4,
      },
      memory: {
        used: Math.random() * 1000,
        total: 2000,
        percentage: (Math.random() * 50),
        heapUsed: Math.random() * 500,
        heapTotal: 1000,
      },
      tasks: {
        total: Math.floor(Math.random() * 100),
        completed: Math.floor(Math.random() * 80),
        failed: Math.floor(Math.random() * 5),
        successRate: 0.95 + Math.random() * 0.05,
        avgDuration: 1000 + Math.random() * 2000,
      },
      network: {
        bytesIn: Math.random() * 1000000,
        bytesOut: Math.random() * 1000000,
        connections: Math.floor(Math.random() * 50),
      },
      performance: {
        responseTime: 100 + Math.random() * 900,
        throughput: Math.random() * 1000,
        errorRate: Math.random() * 0.05,
      },
    };
  }

  /**
   * Save agent health to cache
   */
  private async saveAgentHealth(agentId: string, health: AgentHealth): Promise<void> {
    await this.cache.set(`agent:health:${agentId}`, health, {
      ttl: 3600000, // 1 hour
      tags: ['health', 'agent'],
    });
  }

  /**
   * Update health history
   */
  private async updateHealthHistory(agentId: string, health: AgentHealth): Promise<void> {
    const history = this.healthHistory.get(agentId) || [];
    history.push(health);

    // Keep only last 100 records
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.healthHistory.set(agentId, history);

    // Persist to cache if enabled
    if (this.config.persistence) {
      await this.cache.set(`agent:health:history:${agentId}`, history, {
        ttl: 86400000, // 24 hours
        tags: ['health', 'history', 'agent'],
      });
    }
  }

  /**
   * Handle health status changes
   */
  private async handleStatusChange(
    agentId: string,
    oldStatus: string,
    newStatus: string,
    health: AgentHealth
  ): Promise<void> {
    this.emit('healthChanged', {
      agentId,
      oldStatus,
      newStatus,
      health,
      timestamp: new Date(),
    });

    // Send notification
    await this.messaging.broadcastNotification('agent.health.changed', {
      agentId,
      oldStatus,
      newStatus,
      timestamp: health.lastCheck,
      metrics: health.metrics,
      checks: health.checks,
    });

    // Handle status-specific logic
    if (newStatus === 'unhealthy' && oldStatus !== 'unhealthy') {
      // Agent became unhealthy
      this.emit('agentUnhealthy', { agentId, health });
    } else if (newStatus === 'healthy' && oldStatus !== 'healthy') {
      // Agent recovered
      this.emit('agentRecovered', { agentId, health });
    }
  }

  /**
   * Check if alerts should be sent
   */
  private async checkAlerts(agentId: string, health: AgentHealth, config: AgentHealthConfig): Promise<void> {
    if (!this.config.alerting.enabled) {
      return;
    }

    const lastAlertTime = this.alerts.get(agentId) || 0;
    const now = Date.now();

    if (now - lastAlertTime < this.config.alerting.cooldown) {
      return; // Still in cooldown period
    }

    const shouldAlert = this.shouldSendAlert(health, this.config.alerting.severity);

    if (shouldAlert) {
      await this.sendAlert(agentId, health);
      this.alerts.set(agentId, now);
    }
  }

  /**
   * Determine if alert should be sent
   */
  private shouldSendAlert(health: AgentHealth, severity: string): boolean {
    switch (severity) {
      case 'critical':
        return health.status === 'unhealthy' || health.errorCount > 5;
      case 'high':
        return health.status === 'unhealthy' || health.status === 'degraded';
      case 'medium':
        return health.status === 'degraded' || health.errorCount > 3;
      case 'low':
        return health.errorCount > 1;
      default:
        return false;
    }
  }

  /**
   * Send alert
   */
  private async sendAlert(agentId: string, health: AgentHealth): Promise<void> {
    const alertData = {
      agentId,
      status: health.status,
      timestamp: health.lastCheck,
      metrics: health.metrics,
      issues: health.checks.filter(c => c.status !== 'pass'),
      lastError: health.lastError,
    };

    await this.messaging.broadcastNotification('agent.health.alert', alertData);
    this.emit('alert', alertData);
  }

  /**
   * Restore health history from cache
   */
  private async restoreHealthHistory(): Promise<void> {
    // This would restore health history from persistent storage
    // Implementation would depend on storage backend
  }

  /**
   * Validate health configuration
   */
  private validateHealthConfig(config: AgentHealthConfig): void {
    if (!config.interval || config.interval < 1000) {
      throw new Error('Health check interval must be at least 1000ms');
    }

    if (config.checks && config.checks.length === 0) {
      throw new Error('At least one health check must be configured');
    }

    for (const check of config.checks) {
      if (!check.name || !check.type) {
        throw new Error('Health check must have name and type');
      }
    }
  }

  /**
   * Create empty health metrics
   */
  private createEmptyMetrics(): HealthMetrics {
    return {
      cpu: { usage: 0, loadAverage: [0, 0, 0], cores: 1 },
      memory: { used: 0, total: 0, percentage: 0, heapUsed: 0, heapTotal: 0 },
      tasks: { total: 0, completed: 0, failed: 0, successRate: 1, avgDuration: 0 },
      network: { bytesIn: 0, bytesOut: 0, connections: 0 },
      performance: { responseTime: 0, throughput: 0, errorRate: 0 },
    };
  }
}
