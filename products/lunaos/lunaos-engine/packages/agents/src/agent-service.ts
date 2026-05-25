/**
 * Agent Management Service for Claude Agent Platform
 *
 * Provides comprehensive agent management with:
 * - Agent registration and configuration
 * - Agent lifecycle management
 * - Resource quota enforcement
 * - Version control and rollback
 * - Health monitoring integration
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  Agent,
  AgentConfig,
  ResourceQuota,
  AgentStatus,
  AgentVersion,
  AgentExecution,
  AgentServiceConfig
} from './interfaces';
import { HealthMonitor } from './health-monitor';
import { AgentLifecycleManager } from './agent-lifecycle';

export class AgentService extends EventEmitter {
  private prisma: PrismaClient;
  private cache: RedisCache;
  private messaging: QueueService;
  private healthMonitor: HealthMonitor;
  private lifecycleManager: AgentLifecycleManager;
  private config: AgentServiceConfig;

  constructor(
    prisma: PrismaClient,
    cache: RedisCache,
    messaging: QueueService,
    config: AgentServiceConfig
  ) {
    super();
    this.prisma = prisma;
    this.cache = cache;
    this.messaging = messaging;
    this.config = config;

    this.healthMonitor = new HealthMonitor(this.config.monitoring);
    this.lifecycleManager = new AgentLifecycleManager(this.prisma, this.messaging);

    this.setupEventHandlers();
  }

  /**
   * Register a new agent
   */
  async registerAgent(agentData: {
    name: string;
    type: string;
    description?: string;
    projectId: string;
    config: Omit<AgentConfig, 'id'>;
    resourceQuota: Omit<ResourceQuota, 'id'>;
    metadata?: Partial<Agent['metadata']>;
  }): Promise<Agent> {
    try {
      // Validate agent data
      await this.validateAgentRegistration(agentData);

      // Create resource quota
      const resourceQuota = await this.prisma.resourceQuota.create({
        data: resourceQuota,
      });

      // Create agent
      const agent = await this.prisma.agent.create({
        data: {
          name: agentData.name,
          type: agentData.type,
          description: agentData.description,
          projectId: agentData.projectId,
          config: agentData.config,
          resourceQuotaId: resourceQuota.id,
          status: AgentStatus.REGISTERED,
          capabilities: agentData.config.capabilities,
          dependencies: agentData.config.dependencies,
          metadata: {
            tags: agentData.metadata?.tags || [],
            labels: agentData.metadata?.labels || {},
            category: agentData.metadata?.category || 'general',
            owner: agentData.metadata?.owner || 'system',
            documentation: agentData.metadata?.documentation,
            icon: agentData.metadata?.icon,
            color: agentData.metadata?.color,
            version: '1.0.0',
            support: agentData.metadata?.support || {
              documentation: '',
              examples: [],
              tutorials: [],
              community: '',
              responseTime: '24h',
              availability: 'business-hours',
            },
          },
        },
        include: {
          resourceQuota: true,
        },
      });

      // Create initial version
      await this.createAgentVersion(agent.id, '1.0.0', agentData.config);

      // Initialize health monitoring
      await this.healthMonitor.registerAgent(agent.id, agent.config.healthCheck);

      // Update cache
      await this.cacheAgent(agent);

      // Emit events
      this.emit('agentRegistered', { agent });
      await this.messaging.broadcastNotification('agent.registered', {
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.type,
        projectId: agent.projectId,
      });

      return this.mapPrismaAgent(agent);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(
    agentId: string,
    config: Partial<AgentConfig>
  ): Promise<Agent> {
    try {
      // Validate configuration
      await this.validateAgentConfig(config);

      const updatedAgent = await this.prisma.agent.update({
        where: { id: agentId },
        data: {
          config: config,
          capabilities: config.capabilities,
          dependencies: config.dependencies,
          updatedAt: new Date(),
        },
        include: {
          resourceQuota: true,
        },
      });

      // Update health monitoring configuration
      if (config.healthCheck) {
        await this.healthMonitor.updateHealthCheck(agentId, config.healthCheck);
      }

      // Update cache
      await this.cacheAgent(this.mapPrismaAgent(updatedAgent));

      // Emit events
      this.emit('agentConfigUpdated', { agentId, config });
      await this.messaging.broadcastNotification('agent.config.updated', {
        agentId,
        changes: Object.keys(config),
      });

      return this.mapPrismaAgent(updatedAgent);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Update resource quota
   */
  async updateResourceQuota(
    agentId: string,
    quota: Partial<ResourceQuota>
  ): Promise<Agent> {
    try {
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        include: { resourceQuota: true },
      });

      if (!agent || !agent.resourceQuota) {
        throw new Error('Agent not found or has no resource quota');
      }

      const updatedQuota = await this.prisma.resourceQuota.update({
        where: { id: agent.resourceQuota.id },
        data: quota,
      });

      const updatedAgent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        include: { resourceQuota: true },
      });

      // Update cache
      await this.cacheAgent(this.mapPrismaAgent(updatedAgent!));

      // Emit events
      this.emit('resourceQuotaUpdated', { agentId, quota });
      await this.messaging.broadcastNotification('agent.quota.updated', {
        agentId,
        changes: Object.keys(quota),
      });

      return this.mapPrismaAgent(updatedAgent!);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      // Try cache first
      const cached = await this.cache.get<Agent>(`agent:${agentId}`);
      if (cached && cached.hit) {
        return cached.value;
      }

      // Get from database
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        include: {
          resourceQuota: true,
          tasks: {
            where: { status: 'COMPLETED' },
            orderBy: { completedAt: 'desc' },
            take: 10,
          },
        },
      });

      if (agent) {
        const mappedAgent = this.mapPrismaAgent(agent);
        await this.cacheAgent(mappedAgent);
        return mappedAgent;
      }

      return null;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * List agents with filtering
   */
  async listAgents(filters: {
    projectId?: string;
    type?: string;
    status?: AgentStatus;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ agents: Agent[]; total: number }> {
    try {
      const where: any = {};

      if (filters.projectId) {
        where.projectId = filters.projectId;
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.tags && filters.tags.length > 0) {
        where.metadata = {
          path: ['tags'],
          hasSome: filters.tags,
        };
      }

      const [agents, total] = await Promise.all([
        this.prisma.agent.findMany({
          where,
          include: {
            resourceQuota: true,
          },
          orderBy: { createdAt: 'desc' },
          take: filters.limit || 50,
          skip: filters.offset || 0,
        }),
        this.prisma.agent.count({ where }),
      ]);

      return {
        agents: agents.map(agent => this.mapPrismaAgent(agent)),
        total,
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string, force: boolean = false): Promise<boolean> {
    try {
      const agent = await this.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Check if agent can be safely deleted
      if (!force && agent.status !== AgentStatus.STOPPED) {
        throw new Error('Agent must be stopped before deletion');
      }

      // Stop agent if running
      if (agent.status !== AgentStatus.STOPPED) {
        await this.lifecycleManager.stopAgent(agentId);
      }

      // Delete from database
      await this.prisma.agent.delete({
        where: { id: agentId },
      });

      // Remove from health monitoring
      await this.healthMonitor.unregisterAgent(agentId);

      // Remove from cache
      await this.cache.delete(`agent:${agentId}`);

      // Emit events
      this.emit('agentDeleted', { agentId, agent });
      await this.messaging.broadcastNotification('agent.deleted', {
        agentId,
        agentName: agent.name,
      });

      return true;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(agentId: string): Promise<any> {
    try {
      const agent = await this.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Get health metrics
      const healthMetrics = await this.healthMonitor.getHealthMetrics(agentId);

      // Get execution metrics from database
      const executionStats = await this.getExecutionStats(agentId);

      // Get resource usage
      const resourceUsage = await this.getResourceUsage(agentId);

      return {
        agent: {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          version: agent.metadata.version,
        },
        health: healthMetrics,
        execution: executionStats,
        resources: resourceUsage,
        timestamp: new Date(),
      };
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create agent version
   */
  private async createAgentVersion(
    agentId: string,
    version: string,
    config: AgentConfig
  ): Promise<AgentVersion> {
    const agentVersion = await this.prisma.agentVersion.create({
      data: {
        version,
        agentId,
        config: config as any,
        changelog: this.generateChangelog(config),
        isActive: true,
        deploymentStatus: 'deployed',
      },
    });

    // Update active version
    await this.prisma.agentVersion.updateMany({
      where: {
        agentId,
        version: { not: version },
      },
      data: {
        isActive: false,
      },
    });

    return {
      id: agentVersion.id,
      version: agentVersion.version,
      agentId: agentVersion.agentId,
      config: agentVersion.config as AgentConfig,
      changelog: agentVersion.changelog,
      createdAt: agentVersion.createdAt,
      isActive: agentVersion.isActive,
      deploymentStatus: agentVersion.deploymentStatus as any,
    };
  }

  /**
   * Cache agent data
   */
  private async cacheAgent(agent: Agent): Promise<void> {
    await this.cache.set(`agent:${agent.id}`, agent, {
      ttl: 300000, // 5 minutes
      tags: ['agent', agent.type],
    });
  }

  /**
   * Validate agent registration data
   */
  private async validateAgentRegistration(data: any): Promise<void> {
    const schema = {
      name: { type: 'string', required: true },
      type: { type: 'string', required: true },
      projectId: { type: 'string', required: true },
      config: { type: 'object', required: true },
      resourceQuota: { type: 'object', required: true },
    };

    // Basic validation (would use a proper validation library in production)
    for (const [key, rule] of Object.entries(schema)) {
      if (rule.required && !data[key]) {
        throw new Error(`${key} is required`);
      }
      if (data[key] && typeof data[key] !== rule.type) {
        throw new Error(`${key} must be of type ${rule.type}`);
      }
    }

    // Validate project exists
    const project = await this.prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Validate agent type
    const validTypes = [
      'requirements-analyzer', 'design-architect', 'code-review', 'testing-agent',
      'deployment-agent', 'documentation-generator', 'app-generator-openai',
      'app-generator-google', 'mobile-generator-expo', 'mobile-generator-swift',
      'cloud-migration-agent', 'project-organizer', 'ai-integration-agent'
    ];

    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid agent type: ${data.type}`);
    }
  }

  /**
   * Validate agent configuration
   */
  private async validateAgentConfig(config: Partial<AgentConfig>): Promise<void> {
    // Validate runtime
    if (config.runtime) {
      const validRuntimes = ['nodejs', 'python', 'java', 'go', 'rust', 'docker'];
      if (!validRuntimes.includes(config.runtime)) {
        throw new Error(`Invalid runtime: ${config.runtime}`);
      }
    }

    // Validate timeout
    if (config.timeout && config.timeout < 1000) {
      throw new Error('Timeout must be at least 1000ms');
    }

    // Validate retry policy
    if (config.retryPolicy) {
      if (config.retryPolicy.maxAttempts < 1 || config.retryPolicy.maxAttempts > 10) {
        throw new Error('Retry attempts must be between 1 and 10');
      }
    }
  }

  /**
   * Map Prisma agent to Agent interface
   */
  private mapPrismaAgent(prismaAgent: any): Agent {
    return {
      id: prismaAgent.id,
      name: prismaAgent.name,
      type: prismaAgent.type,
      version: prismaAgent.version,
      description: prismaAgent.description,
      projectId: prismaAgent.projectId,
      config: prismaAgent.config,
      resourceQuota: prismaAgent.resourceQuota,
      health: {
        status: prismaAgent.health,
        lastCheck: new Date(),
        metrics: {
          cpu: { usage: 0, loadAverage: [0, 0, 0], cores: 1 },
          memory: { used: 0, total: 100, percentage: 0, heapUsed: 0, heapTotal: 0 },
          tasks: { total: 0, completed: 0, failed: 0, successRate: 1, avgDuration: 0 },
          network: { bytesIn: 0, bytesOut: 0, connections: 0 },
          performance: { responseTime: 0, throughput: 0, errorRate: 0 },
        },
        checks: [],
        uptime: 0,
        restartCount: 0,
        errorCount: 0,
      },
      status: prismaAgent.status,
      capabilities: prismaAgent.capabilities,
      dependencies: prismaAgent.dependencies,
      metadata: prismaAgent.metadata,
      createdAt: prismaAgent.createdAt,
      updatedAt: prismaAgent.updatedAt,
      startedAt: prismaAgent.startedAt,
      stoppedAt: prismaAgent.stoppedAt,
    };
  }

  /**
   * Generate changelog for configuration changes
   */
  private generateChangelog(config: AgentConfig): string {
    const changes = [];

    if (config.capabilities) {
      changes.push(`Updated capabilities: ${config.capabilities.join(', ')}`);
    }

    if (config.runtime) {
      changes.push(`Runtime: ${config.runtime}`);
    }

    if (config.timeout) {
      changes.push(`Timeout: ${config.timeout}ms`);
    }

    return changes.join('; ');
  }

  /**
   * Get execution statistics
   */
  private async getExecutionStats(agentId: string): Promise<any> {
    const [total, completed, failed] = await Promise.all([
      this.prisma.task.count({
        where: { agentId },
      }),
      this.prisma.task.count({
        where: { agentId, status: 'COMPLETED' },
      }),
      this.prisma.task.count({
        where: { agentId, status: 'FAILED' },
      }),
    ]);

    return {
      total,
      completed,
      failed,
      successRate: total > 0 ? completed / total : 1,
      avgDuration: 0, // Would calculate from execution data
    };
  }

  /**
   * Get resource usage information
   */
  private async getResourceUsage(agentId: string): Promise<any> {
    // This would integrate with actual resource monitoring
    return {
      cpu: { usage: 0, allocated: 100, peak: 0 },
      memory: { used: 0, allocated: 512, peak: 0 },
      disk: { used: 0, allocated: 1024 },
      network: { inbound: 0, outbound: 0 },
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.healthMonitor.on('healthChanged', (data) => {
      this.emit('agentHealthChanged', data);
      this.messaging.broadcastNotification('agent.health.changed', data);
    });

    this.lifecycleManager.on('statusChanged', (data) => {
      this.emit('agentStatusChanged', data);
      this.messaging.broadcastNotification('agent.status.changed', data);
    });
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.healthMonitor.initialize();
    await this.lifecycleManager.initialize();

    // Register existing agents with health monitoring
    const agents = await this.prisma.agent.findMany({
      where: { status: { not: AgentStatus.ARCHIVED } },
    });

    for (const agent of agents) {
      if (agent.config.healthCheck?.enabled) {
        await this.healthMonitor.registerAgent(agent.id, agent.config.healthCheck);
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.healthMonitor.cleanup();
    await this.lifecycleManager.cleanup();
    this.removeAllListeners();
  }
}
