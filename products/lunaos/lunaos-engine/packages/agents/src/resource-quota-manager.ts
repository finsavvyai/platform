/**
 * Resource Quota Management System for Claude Agent Platform
 *
 * Provides comprehensive resource quota management with:
 * - Resource allocation and enforcement
 * - Real-time usage monitoring
 * - Quota violation handling
 * - Dynamic quota adjustment
 * - Resource optimization recommendations
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import {
  ResourceQuota,
  ResourceUsage,
  ResourceAlert,
  QuotaViolation,
  ResourceOptimization
} from './interfaces';
import { logger } from '@claude-agent/utils';

export interface ResourceQuotaConfig {
  monitoringInterval: number;
  alertThresholds: ResourceThresholds;
  enforcementEnabled: boolean;
  autoScalingEnabled: boolean;
  optimizationEnabled: boolean;
}

export interface ResourceThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  disk: { warning: number; critical: number };
  network: { warning: number; critical: number };
  tokens: { warning: number; critical: number };
  tasks: { warning: number; critical: number };
}

export interface ResourceMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    readOps: number;
    writeOps: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
    requests: number;
  };
  tasks: {
    running: number;
    queued: number;
    completed: number;
    failed: number;
    avgDuration: number;
  };
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    cost: number;
  };
}

export class ResourceQuotaManager extends EventEmitter {
  private prisma: PrismaClient;
  private cache: RedisCache;
  private messaging: QueueService;
  private config: ResourceQuotaConfig;
  private monitoringIntervals = new Map<string, NodeJS.Timeout>();
  private resourceUsage = new Map<string, ResourceMetrics>();
  private quotaViolations = new Map<string, QuotaViolation[]>();
  private resourceAlerts = new Map<string, ResourceAlert[]>();

  constructor(
    prisma: PrismaClient,
    cache: RedisCache,
    messaging: QueueService,
    config: ResourceQuotaConfig
  ) {
    super();
    this.prisma = prisma;
    this.cache = cache;
    this.messaging = messaging;
    this.config = config;
  }

  /**
   * Initialize resource quota manager
   */
  async initialize(): Promise<void> {
    logger.info('Initializing Resource Quota Manager');

    // Load existing quotas from database
    await this.loadQuotas();

    // Start monitoring for all active agents
    await this.startMonitoringForAllAgents();

    this.emit('initialized');
  }

  /**
   * Create or update resource quota for an agent
   */
  async setResourceQuota(
    agentId: string,
    quota: Omit<ResourceQuota, 'id'>
  ): Promise<ResourceQuota> {
    try {
      logger.debug(`Setting resource quota for agent ${agentId}`);

      // Validate quota values
      this.validateQuota(quota);

      // Create or update quota in database
      const resourceQuota = await this.prisma.resourceQuota.upsert({
        where: { id: agentId },
        update: {
          cpuCores: quota.maxCpuCores,
          memoryMB: quota.maxMemoryMb,
          diskMB: quota.maxDiskMb,
          maxConcurrentTasks: quota.maxConcurrentTasks,
          tokenLimit: quota.maxTokens,
          bandwidthMB: quota.maxBandwidthMb,
        },
        create: {
          id: agentId,
          cpuCores: quota.maxCpuCores,
          memoryMB: quota.maxMemoryMb,
          diskMB: quota.maxDiskMb,
          maxConcurrentTasks: quota.maxConcurrentTasks,
          tokenLimit: quota.maxTokens,
          bandwidthMB: quota.maxBandwidthMb,
        },
      });

      const mappedQuota: ResourceQuota = {
        id: resourceQuota.id,
        maxCpuCores: resourceQuota.cpuCores || 0,
        maxMemoryMb: resourceQuota.memoryMB || 0,
        maxDiskMb: resourceQuota.diskMB || 0,
        maxConcurrentTasks: resourceQuota.maxConcurrentTasks || 0,
        maxTokens: resourceQuota.tokenLimit || 0,
        maxBandwidthMb: resourceQuota.bandwidthMB || 0,
        maxGpuMemory: quota.maxGpuMemory,
        maxInstances: quota.maxInstances,
      };

      // Cache the quota
      await this.cache.set(`resource:quota:${agentId}`, mappedQuota, {
        ttl: 3600000, // 1 hour
        tags: ['quota', 'resource'],
      });

      // Start monitoring if not already started
      await this.startMonitoring(agentId);

      this.emit('quotaUpdated', { agentId, quota: mappedQuota });
      await this.messaging.broadcastNotification('resource.quota.updated', {
        agentId,
        quota: mappedQuota,
      });

      return mappedQuota;
    } catch (error) {
      logger.error(`Failed to set resource quota for agent ${agentId}:`, error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get resource quota for an agent
   */
  async getResourceQuota(agentId: string): Promise<ResourceQuota | null> {
    try {
      // Try cache first
      const cached = await this.cache.get<ResourceQuota>(`resource:quota:${agentId}`);
      if (cached && cached.hit) {
        return cached.value;
      }

      // Get from database
      const quota = await this.prisma.resourceQuota.findUnique({
        where: { id: agentId },
      });

      if (!quota) {
        return null;
      }

      const mappedQuota: ResourceQuota = {
        id: quota.id,
        maxCpuCores: quota.cpuCores || 0,
        maxMemoryMb: quota.memoryMB || 0,
        maxDiskMb: quota.diskMB || 0,
        maxConcurrentTasks: quota.maxConcurrentTasks || 0,
        maxTokens: quota.tokenLimit || 0,
        maxBandwidthMb: quota.bandwidthMB || 0,
      };

      // Cache the result
      await this.cache.set(`resource:quota:${agentId}`, mappedQuota, {
        ttl: 3600000,
        tags: ['quota', 'resource'],
      });

      return mappedQuota;
    } catch (error) {
      logger.error(`Failed to get resource quota for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Get current resource usage for an agent
   */
  async getResourceUsage(agentId: string): Promise<ResourceUsage | null> {
    try {
      const metrics = this.resourceUsage.get(agentId);
      if (!metrics) {
        return null;
      }

      const quota = await this.getResourceQuota(agentId);
      if (!quota) {
        return null;
      }

      const usage: ResourceUsage = {
        agentId,
        timestamp: new Date(),
        cpu: {
          used: metrics.cpu.usage,
          allocated: quota.maxCpuCores,
          percentage: quota.maxCpuCores > 0 ? (metrics.cpu.usage / quota.maxCpuCores) * 100 : 0,
        },
        memory: {
          used: metrics.memory.used,
          allocated: quota.maxMemoryMb,
          percentage: quota.maxMemoryMb > 0 ? (metrics.memory.used / quota.maxMemoryMb) * 100 : 0,
          peak: metrics.memory.heapUsed,
        },
        disk: {
          used: metrics.disk.used,
          allocated: quota.maxDiskMb,
          percentage: quota.maxDiskMb > 0 ? (metrics.disk.used / quota.maxDiskMb) * 100 : 0,
        },
        network: {
          inbound: metrics.network.bytesIn,
          outbound: metrics.network.bytesOut,
        },
        tokens: {
          used: metrics.tokens.used,
          limit: quota.maxTokens,
          remaining: Math.max(0, quota.maxTokens - metrics.tokens.used),
        },
        tasks: {
          running: metrics.tasks.running,
          maxConcurrent: quota.maxConcurrentTasks,
        },
      };

      return usage;
    } catch (error) {
      logger.error(`Failed to get resource usage for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Check if agent can perform an operation requiring resources
   */
  async checkResourceAvailability(
    agentId: string,
    requirements: {
      cpu?: number;
      memory?: number;
      disk?: number;
      tokens?: number;
      tasks?: number;
    }
  ): Promise<{ available: boolean; reason?: string; suggestions?: string[] }> {
    try {
      const usage = await this.getResourceUsage(agentId);
      if (!usage) {
        return { available: false, reason: 'Agent resource usage not available' };
      }

      const quota = await this.getResourceQuota(agentId);
      if (!quota) {
        return { available: false, reason: 'Agent resource quota not configured' };
      }

      // Check CPU availability
      if (requirements.cpu && usage.cpu.used + requirements.cpu > usage.cpu.allocated) {
        return {
          available: false,
          reason: `Insufficient CPU: need ${requirements.cpu}, have ${usage.cpu.allocated - usage.cpu.used}`,
          suggestions: ['Wait for current tasks to complete', 'Upgrade CPU quota', 'Optimize task performance'],
        };
      }

      // Check memory availability
      if (requirements.memory && usage.memory.used + requirements.memory > usage.memory.allocated) {
        return {
          available: false,
          reason: `Insufficient memory: need ${requirements.memory}MB, have ${usage.memory.allocated - usage.memory.used}MB`,
          suggestions: ['Wait for memory to be freed', 'Upgrade memory quota', 'Optimize memory usage'],
        };
      }

      // Check disk availability
      if (requirements.disk && usage.disk.used + requirements.disk > usage.disk.allocated) {
        return {
          available: false,
          reason: `Insufficient disk: need ${requirements.disk}MB, have ${usage.disk.allocated - usage.disk.used}MB`,
          suggestions: ['Clean up temporary files', 'Upgrade disk quota', 'Compress data'],
        };
      }

      // Check token availability
      if (requirements.tokens && usage.tokens.used + requirements.tokens > usage.tokens.limit) {
        return {
          available: false,
          reason: `Insufficient tokens: need ${requirements.tokens}, have ${usage.tokens.remaining}`,
          suggestions: ['Wait for token quota reset', 'Upgrade token plan', 'Optimize token usage'],
        };
      }

      // Check task concurrency
      if (requirements.tasks && usage.tasks.running + requirements.tasks > usage.tasks.maxConcurrent) {
        return {
          available: false,
          reason: `Too many concurrent tasks: running ${usage.tasks.running}, max ${usage.tasks.maxConcurrent}`,
          suggestions: ['Wait for current tasks to complete', 'Increase concurrent task limit', 'Optimize task scheduling'],
        };
      }

      return { available: true };
    } catch (error) {
      logger.error(`Failed to check resource availability for agent ${agentId}:`, error);
      return { available: false, reason: 'Error checking resource availability' };
    }
  }

  /**
   * Get resource optimization recommendations
   */
  async getOptimizationRecommendations(agentId: string): Promise<ResourceOptimization[]> {
    try {
      const usage = await this.getResourceUsage(agentId);
      if (!usage) {
        return [];
      }

      const recommendations: ResourceOptimization[] = [];

      // CPU optimization
      if (usage.cpu.percentage > this.config.alertThresholds.cpu.warning) {
        recommendations.push({
          type: 'cpu',
          severity: usage.cpu.percentage > this.config.alertThresholds.cpu.critical ? 'critical' : 'warning',
          message: `High CPU usage: ${usage.cpu.percentage.toFixed(1)}%`,
          suggestions: [
            'Optimize code performance',
            'Add CPU cores to quota',
            'Implement task queuing',
            'Profile and optimize bottlenecks',
          ],
          potentialSavings: usage.cpu.percentage > 90 ? '30-50%' : '10-20%',
        });
      }

      // Memory optimization
      if (usage.memory.percentage > this.config.alertThresholds.memory.warning) {
        recommendations.push({
          type: 'memory',
          severity: usage.memory.percentage > this.config.alertThresholds.memory.critical ? 'critical' : 'warning',
          message: `High memory usage: ${usage.memory.percentage.toFixed(1)}%`,
          suggestions: [
            'Implement memory cleanup',
            'Optimize data structures',
            'Add memory to quota',
            'Use streaming for large data',
          ],
          potentialSavings: usage.memory.percentage > 90 ? '40-60%' : '15-25%',
        });
      }

      // Disk optimization
      if (usage.disk.percentage > this.config.alertThresholds.disk.warning) {
        recommendations.push({
          type: 'disk',
          severity: usage.disk.percentage > this.config.alertThresholds.disk.critical ? 'critical' : 'warning',
          message: `High disk usage: ${usage.disk.percentage.toFixed(1)}%`,
          suggestions: [
            'Clean up temporary files',
            'Implement log rotation',
            'Compress old data',
            'Upgrade disk quota',
          ],
          potentialSavings: usage.disk.percentage > 90 ? '50-70%' : '20-30%',
        });
      }

      // Token optimization
      if (usage.tokens.used / usage.tokens.limit > this.config.alertThresholds.tokens.warning) {
        recommendations.push({
          type: 'tokens',
          severity: 'high',
          message: `High token usage: ${((usage.tokens.used / usage.tokens.limit) * 100).toFixed(1)}%`,
          suggestions: [
            'Optimize prompts',
            'Use context pruning',
            'Cache frequent responses',
            'Upgrade token plan',
          ],
          potentialSavings: '20-40%',
        });
      }

      // Task optimization
      if (usage.tasks.running / usage.tasks.maxConcurrent > this.config.alertThresholds.tasks.warning) {
        recommendations.push({
          type: 'tasks',
          severity: 'medium',
          message: `High task concurrency: ${usage.tasks.running}/${usage.tasks.maxConcurrent}`,
          suggestions: [
            'Implement task prioritization',
            'Add task timeout handling',
            'Increase concurrent task limit',
            'Optimize task scheduling',
          ],
          potentialSavings: '15-25%',
        });
      }

      return recommendations;
    } catch (error) {
      logger.error(`Failed to get optimization recommendations for agent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Start monitoring for an agent
   */
  async startMonitoring(agentId: string): Promise<void> {
    if (this.monitoringIntervals.has(agentId)) {
      return; // Already monitoring
    }

    const interval = setInterval(async () => {
      try {
        await this.collectResourceMetrics(agentId);
      } catch (error) {
        logger.error(`Failed to collect metrics for agent ${agentId}:`, error);
      }
    }, this.config.monitoringInterval);

    this.monitoringIntervals.set(agentId, interval);
    logger.debug(`Started resource monitoring for agent ${agentId}`);

    // Collect initial metrics
    await this.collectResourceMetrics(agentId);
  }

  /**
   * Stop monitoring for an agent
   */
  async stopMonitoring(agentId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(agentId);
      this.resourceUsage.delete(agentId);
      logger.debug(`Stopped resource monitoring for agent ${agentId}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up Resource Quota Manager');

    // Stop all monitoring
    for (const [agentId] of this.monitoringIntervals) {
      await this.stopMonitoring(agentId);
    }

    // Clear all data
    this.resourceUsage.clear();
    this.quotaViolations.clear();
    this.resourceAlerts.clear();
    this.removeAllListeners();

    logger.info('Resource Quota Manager cleanup complete');
  }

  /**
   * Load existing quotas from database
   */
  private async loadQuotas(): Promise<void> {
    try {
      const quotas = await this.prisma.resourceQuota.findMany();

      for (const quota of quotas) {
        const mappedQuota: ResourceQuota = {
          id: quota.id,
          maxCpuCores: quota.cpuCores || 0,
          maxMemoryMb: quota.memoryMB || 0,
          maxDiskMb: quota.diskMB || 0,
          maxConcurrentTasks: quota.maxConcurrentTasks || 0,
          maxTokens: quota.tokenLimit || 0,
          maxBandwidthMb: quota.bandwidthMB || 0,
        };

        // Cache quota
        await this.cache.set(`resource:quota:${quota.id}`, mappedQuota, {
          ttl: 3600000,
          tags: ['quota', 'resource'],
        });
      }

      logger.info(`Loaded ${quotas.length} resource quotas from database`);
    } catch (error) {
      logger.error('Failed to load quotas from database:', error);
    }
  }

  /**
   * Start monitoring for all active agents
   */
  private async startMonitoringForAllAgents(): Promise<void> {
    try {
      const agents = await this.prisma.agent.findMany({
        where: { status: 'RUNNING' },
      });

      for (const agent of agents) {
        await this.startMonitoring(agent.id);
      }

      logger.info(`Started monitoring for ${agents.length} active agents`);
    } catch (error) {
      logger.error('Failed to start monitoring for agents:', error);
    }
  }

  /**
   * Collect resource metrics for an agent
   */
  private async collectResourceMetrics(agentId: string): Promise<void> {
    try {
      const metrics = await this.gatherResourceMetrics(agentId);
      this.resourceUsage.set(agentId, metrics);

      // Check for quota violations
      if (this.config.enforcementEnabled) {
        await this.checkQuotaViolations(agentId, metrics);
      }

      // Check for alerts
      await this.checkResourceAlerts(agentId, metrics);

      // Cache metrics
      await this.cache.set(`resource:metrics:${agentId}`, metrics, {
        ttl: 300000, // 5 minutes
        tags: ['metrics', 'resource'],
      });

      // Emit metrics update
      this.emit('metricsUpdated', { agentId, metrics });

    } catch (error) {
      logger.error(`Failed to collect resource metrics for agent ${agentId}:`, error);
    }
  }

  /**
   * Gather resource metrics from system
   */
  private async gatherResourceMetrics(agentId: string): Promise<ResourceMetrics> {
    // This would integrate with actual system monitoring
    // For now, return mock data that simulates real monitoring

    const baseMetrics = this.resourceUsage.get(agentId) || this.createEmptyMetrics();

    return {
      cpu: {
        usage: Math.random() * 4, // 0-4 cores
        cores: 4,
        loadAverage: [
          Math.random() * 2,
          Math.random() * 2,
          Math.random() * 2,
        ],
      },
      memory: {
        used: baseMetrics.memory.used + (Math.random() - 0.5) * 100,
        total: 2048,
        percentage: ((baseMetrics.memory.used + (Math.random() - 0.5) * 100) / 2048) * 100,
        heapUsed: Math.random() * 512,
        heapTotal: 1024,
      },
      disk: {
        used: Math.min(baseMetrics.disk.used + Math.random() * 10, 10240),
        total: 10240,
        percentage: ((Math.min(baseMetrics.disk.used + Math.random() * 10, 10240)) / 10240) * 100,
        readOps: Math.floor(Math.random() * 1000),
        writeOps: Math.floor(Math.random() * 500),
      },
      network: {
        bytesIn: baseMetrics.network.bytesIn + Math.floor(Math.random() * 10000),
        bytesOut: baseMetrics.network.bytesOut + Math.floor(Math.random() * 8000),
        connections: Math.floor(Math.random() * 50),
        requests: Math.floor(Math.random() * 200),
      },
      tasks: {
        running: Math.max(0, baseMetrics.tasks.running + Math.floor(Math.random() * 3) - 1),
        queued: Math.max(0, Math.floor(Math.random() * 10)),
        completed: baseMetrics.tasks.completed + Math.floor(Math.random() * 5),
        failed: baseMetrics.tasks.failed + Math.floor(Math.random() * 2),
        avgDuration: 1000 + Math.random() * 2000,
      },
      tokens: {
        used: baseMetrics.tokens.used + Math.floor(Math.random() * 1000),
        limit: 100000,
        remaining: Math.max(0, 100000 - (baseMetrics.tokens.used + Math.floor(Math.random() * 1000))),
        cost: (baseMetrics.tokens.cost + Math.random() * 0.1),
      },
    };
  }

  /**
   * Check for quota violations
   */
  private async checkQuotaViolations(agentId: string, metrics: ResourceMetrics): Promise<void> {
    const quota = await this.getResourceQuota(agentId);
    if (!quota) {
      return;
    }

    const violations: QuotaViolation[] = [];

    // Check CPU violation
    if (metrics.cpu.usage > quota.maxCpuCores) {
      violations.push({
        type: 'cpu',
        severity: 'critical',
        message: `CPU usage (${metrics.cpu.usage}) exceeds quota (${quota.maxCpuCores})`,
        actual: metrics.cpu.usage,
        limit: quota.maxCpuCores,
        timestamp: new Date(),
      });
    }

    // Check memory violation
    if (metrics.memory.used > quota.maxMemoryMb) {
      violations.push({
        type: 'memory',
        severity: 'critical',
        message: `Memory usage (${metrics.memory.used}MB) exceeds quota (${quota.maxMemoryMb}MB)`,
        actual: metrics.memory.used,
        limit: quota.maxMemoryMb,
        timestamp: new Date(),
      });
    }

    // Check disk violation
    if (metrics.disk.used > quota.maxDiskMb) {
      violations.push({
        type: 'disk',
        severity: 'critical',
        message: `Disk usage (${metrics.disk.used}MB) exceeds quota (${quota.maxDiskMb}MB)`,
        actual: metrics.disk.used,
        limit: quota.maxDiskMb,
        timestamp: new Date(),
      });
    }

    // Check token violation
    if (metrics.tokens.used > quota.maxTokens) {
      violations.push({
        type: 'tokens',
        severity: 'high',
        message: `Token usage (${metrics.tokens.used}) exceeds quota (${quota.maxTokens})`,
        actual: metrics.tokens.used,
        limit: quota.maxTokens,
        timestamp: new Date(),
      });
    }

    // Check task violation
    if (metrics.tasks.running > quota.maxConcurrentTasks) {
      violations.push({
        type: 'tasks',
        severity: 'medium',
        message: `Concurrent tasks (${metrics.tasks.running}) exceeds quota (${quota.maxConcurrentTasks})`,
        actual: metrics.tasks.running,
        limit: quota.maxConcurrentTasks,
        timestamp: new Date(),
      });
    }

    // Handle violations
    if (violations.length > 0) {
      await this.handleQuotaViolations(agentId, violations);
    }
  }

  /**
   * Check for resource alerts
   */
  private async checkResourceAlerts(agentId: string, metrics: ResourceMetrics): Promise<void> {
    const quota = await this.getResourceQuota(agentId);
    if (!quota) {
      return;
    }

    const alerts: ResourceAlert[] = [];
    const thresholds = this.config.alertThresholds;

    // CPU alerts
    const cpuPercentage = quota.maxCpuCores > 0 ? (metrics.cpu.usage / quota.maxCpuCores) * 100 : 0;
    if (cpuPercentage > thresholds.cpu.critical) {
      alerts.push({
        type: 'cpu',
        severity: 'critical',
        message: `Critical CPU usage: ${cpuPercentage.toFixed(1)}%`,
        percentage: cpuPercentage,
        timestamp: new Date(),
      });
    } else if (cpuPercentage > thresholds.cpu.warning) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${cpuPercentage.toFixed(1)}%`,
        percentage: cpuPercentage,
        timestamp: new Date(),
      });
    }

    // Memory alerts
    const memoryPercentage = quota.maxMemoryMb > 0 ? (metrics.memory.used / quota.maxMemoryMb) * 100 : 0;
    if (memoryPercentage > thresholds.memory.critical) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage: ${memoryPercentage.toFixed(1)}%`,
        percentage: memoryPercentage,
        timestamp: new Date(),
      });
    } else if (memoryPercentage > thresholds.memory.warning) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${memoryPercentage.toFixed(1)}%`,
        percentage: memoryPercentage,
        timestamp: new Date(),
      });
    }

    // Handle alerts
    if (alerts.length > 0) {
      await this.handleResourceAlerts(agentId, alerts);
    }
  }

  /**
   * Handle quota violations
   */
  private async handleQuotaViolations(agentId: string, violations: QuotaViolation[]): Promise<void> {
    logger.warn(`Quota violations detected for agent ${agentId}:`, violations);

    // Store violations
    const existingViolations = this.quotaViolations.get(agentId) || [];
    existingViolations.push(...violations);
    this.quotaViolations.set(agentId, existingViolations);

    // Emit violation event
    this.emit('quotaViolation', { agentId, violations });

    // Send notification
    await this.messaging.broadcastNotification('resource.quota.violation', {
      agentId,
      violations,
      timestamp: new Date(),
    });

    // Take enforcement action if enabled
    if (this.config.enforcementEnabled) {
      await this.enforceQuotaLimits(agentId, violations);
    }
  }

  /**
   * Handle resource alerts
   */
  private async handleResourceAlerts(agentId: string, alerts: ResourceAlert[]): Promise<void> {
    logger.info(`Resource alerts for agent ${agentId}:`, alerts);

    // Store alerts
    const existingAlerts = this.resourceAlerts.get(agentId) || [];
    existingAlerts.push(...alerts);
    this.resourceAlerts.set(agentId, existingAlerts);

    // Emit alert event
    this.emit('resourceAlert', { agentId, alerts });

    // Send notification
    await this.messaging.broadcastNotification('resource.alert', {
      agentId,
      alerts,
      timestamp: new Date(),
    });
  }

  /**
   * Enforce quota limits
   */
  private async enforceQuotaLimits(agentId: string, violations: QuotaViolation[]): Promise<void> {
    for (const violation of violations) {
      switch (violation.type) {
        case 'cpu':
        case 'memory':
          // Could throttle or pause the agent
          logger.warn(`Resource enforcement: throttling agent ${agentId} due to ${violation.type} violation`);
          break;
        case 'tokens':
          // Could stop token-consuming operations
          logger.warn(`Resource enforcement: blocking token operations for agent ${agentId}`);
          break;
        case 'tasks':
          // Could queue new tasks
          logger.warn(`Resource enforcement: queuing tasks for agent ${agentId}`);
          break;
      }
    }
  }

  /**
   * Validate quota values
   */
  private validateQuota(quota: Omit<ResourceQuota, 'id'>): void {
    if (quota.maxCpuCores < 0 || quota.maxCpuCores > 64) {
      throw new Error('CPU cores must be between 0 and 64');
    }

    if (quota.maxMemoryMb < 0 || quota.maxMemoryMb > 1024000) {
      throw new Error('Memory must be between 0 and 1TB');
    }

    if (quota.maxDiskMb < 0 || quota.maxDiskMb > 10240000) {
      throw new Error('Disk must be between 0 and 10TB');
    }

    if (quota.maxConcurrentTasks < 0 || quota.maxConcurrentTasks > 1000) {
      throw new Error('Concurrent tasks must be between 0 and 1000');
    }

    if (quota.maxTokens < 0 || quota.maxTokens > 10000000) {
      throw new Error('Token limit must be between 0 and 10M');
    }
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): ResourceMetrics {
    return {
      cpu: { usage: 0, cores: 1, loadAverage: [0, 0, 0] },
      memory: { used: 0, total: 2048, percentage: 0, heapUsed: 0, heapTotal: 1024 },
      disk: { used: 0, total: 10240, percentage: 0, readOps: 0, writeOps: 0 },
      network: { bytesIn: 0, bytesOut: 0, connections: 0, requests: 0 },
      tasks: { running: 0, queued: 0, completed: 0, failed: 0, avgDuration: 0 },
      tokens: { used: 0, limit: 100000, remaining: 100000, cost: 0 },
    };
  }
}
