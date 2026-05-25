/**
 * Comprehensive Unit Tests for Agent Service
 */

import { AgentService } from '../agent-service';
import { HealthMonitor } from '../health-monitor';
import { AgentLifecycleManager } from '../agent-lifecycle';
import { ResourceQuotaManager } from '../resource-quota-manager';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import { PrismaClient } from '@prisma/client';
import {
  Agent,
  AgentType,
  AgentStatus,
  AgentConfig,
  ResourceQuota,
  AgentHealth
} from '../interfaces';

// Mock dependencies
jest.mock('@claude-agent/cache');
jest.mock('@claude-agent/messaging');
jest.mock('../health-monitor');
jest.mock('../agent-lifecycle');
jest.mock('../resource-quota-manager');
jest.mock('@prisma/client');

describe('AgentService', () => {
  let agentService: AgentService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockCache: jest.Mocked<RedisCache>;
  let mockMessaging: jest.Mocked<QueueService>;
  let mockHealthMonitor: jest.Mocked<HealthMonitor>;
  let mockLifecycleManager: jest.Mocked<AgentLifecycleManager>;
  let mockResourceQuotaManager: jest.Mocked<ResourceQuotaManager>;

  const mockConfig = {
    database: { url: 'postgresql://localhost/test', poolSize: 10 },
    cache: { enabled: true, ttl: 300000 },
    messaging: { enabled: true, exchange: 'test', queue: 'test' },
    monitoring: { enabled: true, interval: 30000, retention: 90 },
    security: { encryption: true, audit: true }
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockCache = new RedisCache() as jest.Mocked<RedisCache>;
    mockMessaging = new QueueService() as jest.Mocked<QueueService>;
    mockHealthMonitor = new HealthMonitor({} as any) as jest.Mocked<HealthMonitor>;
    mockLifecycleManager = new AgentLifecycleManager({}) as jest.Mocked<AgentLifecycleManager>;
    mockResourceQuotaManager = new ResourceQuotaManager(
      mockPrisma,
      mockCache,
      mockMessaging,
      {} as any
    ) as jest.Mocked<ResourceQuotaManager>;

    // Mock Prisma client methods
    mockPrisma.agent = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    mockPrisma.resourceQuota = {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    } as any;

    mockPrisma.project = {
      findUnique: jest.fn(),
    } as any;

    mockPrisma.task = {
      count: jest.fn(),
      findMany: jest.fn(),
    } as any;

    // Mock cache methods
    mockCache.get = jest.fn();
    mockCache.set = jest.fn();
    mockCache.delete = jest.fn();

    // Mock messaging methods
    mockMessaging.broadcastNotification = jest.fn();

    // Mock health monitor methods
    mockHealthMonitor.registerAgent = jest.fn();
    mockHealthMonitor.updateHealthCheck = jest.fn();
    mockHealthMonitor.initialize = jest.fn();
    mockHealthMonitor.cleanup = jest.fn();

    // Mock lifecycle manager methods
    mockLifecycleManager.initialize = jest.fn();
    mockLifecycleManager.cleanup = jest.fn();

    // Create agent service instance
    agentService = new AgentService(
      mockPrisma,
      mockCache,
      mockMessaging,
      mockConfig
    );

    // Replace internal instances with mocks
    (agentService as any).healthMonitor = mockHealthMonitor;
    (agentService as any).lifecycleManager = mockLifecycleManager;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerAgent', () => {
    const validAgentData = {
      name: 'Test Agent',
      type: 'code-review',
      description: 'A test agent for code review',
      projectId: 'test-project-id',
      config: {
        runtime: 'nodejs',
        timeout: 30000,
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          initialDelay: 1000,
          maxDelay: 10000,
          retryableErrors: ['TIMEOUT', 'NETWORK_ERROR']
        },
        environment: { NODE_ENV: 'test' },
        capabilities: ['code-analysis', 'security-check'],
        dependencies: [],
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          checks: []
        },
        scaling: {
          enabled: false,
          minInstances: 1,
          maxInstances: 3,
          targetCPUUtilization: 70,
          targetMemoryUtilization: 80,
          scaleUpCooldown: 300000,
          scaleDownCooldown: 600000,
          autoScaling: false
        },
        security: {
          enabled: true,
          sandboxed: true,
          networkPolicy: { inbound: [], outbound: [], isolated: true },
          resourceLimits: {
            maxFileSize: 10485760,
            maxExecutionTime: 300000,
            maxMemoryUsage: 512,
            maxNetworkRequests: 100,
            maxFileOperations: 50
          },
          permissions: ['read', 'write'],
          allowedDomains: ['api.example.com'],
          encryption: {
            dataAtRest: true,
            dataInTransit: true,
            algorithm: 'AES-256',
            keyRotation: true
          }
        }
      },
      resourceQuota: {
        maxCpuCores: 2,
        maxMemoryMb: 1024,
        maxDiskMb: 2048,
        maxConcurrentTasks: 5,
        maxTokens: 10000,
        maxBandwidthMb: 100
      },
      metadata: {
        tags: ['test', 'code-review'],
        labels: { team: 'platform' },
        category: 'development',
        owner: 'test-user'
      }
    };

    it('should successfully register a new agent', async () => {
      // Arrange
      const mockProject = { id: 'test-project-id', name: 'Test Project' };
      const mockResourceQuota = {
        id: 'quota-id',
        cpuCores: 2,
        memoryMB: 1024,
        diskMB: 2048,
        maxConcurrentTasks: 5,
        tokenLimit: 10000,
        bandwidthMB: 100
      };
      const mockAgent = {
        id: 'agent-id',
        name: 'Test Agent',
        type: 'code-review',
        description: 'A test agent for code review',
        projectId: 'test-project-id',
        config: validAgentData.config,
        resourceQuotaId: 'quota-id',
        status: AgentStatus.REGISTERED,
        capabilities: ['code-analysis', 'security-check'],
        dependencies: [],
        metadata: validAgentData.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
        resourceQuota: mockResourceQuota
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);
      mockPrisma.resourceQuota.create.mockResolvedValue(mockResourceQuota);
      mockPrisma.agent.create.mockResolvedValue(mockAgent);
      mockCache.set.mockResolvedValue(undefined);
      mockHealthMonitor.registerAgent.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);

      // Act
      const result = await agentService.registerAgent(validAgentData);

      // Assert
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-project-id' }
      });
      expect(mockPrisma.resourceQuota.create).toHaveBeenCalledWith({
        data: validAgentData.resourceQuota
      });
      expect(mockPrisma.agent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: validAgentData.name,
          type: validAgentData.type,
          description: validAgentData.description,
          projectId: validAgentData.projectId,
          config: validAgentData.config,
          resourceQuotaId: 'quota-id',
          status: AgentStatus.REGISTERED,
          capabilities: validAgentData.config.capabilities,
          dependencies: validAgentData.config.dependencies,
          metadata: expect.objectContaining({
            tags: validAgentData.metadata.tags,
            labels: validAgentData.metadata.labels,
            category: validAgentData.metadata.category,
            owner: validAgentData.metadata.owner,
            version: '1.0.0'
          })
        }),
        include: { resourceQuota: true }
      });
      expect(mockHealthMonitor.registerAgent).toHaveBeenCalledWith(
        'agent-id',
        validAgentData.config.healthCheck
      );
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockMessaging.broadcastNotification).toHaveBeenCalledWith(
        'agent.registered',
        expect.objectContaining({
          agentId: 'agent-id',
          agentName: 'Test Agent',
          agentType: 'code-review',
          projectId: 'test-project-id'
        })
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'agent-id',
          name: 'Test Agent',
          type: 'code-review',
          status: AgentStatus.REGISTERED
        })
      );
    });

    it('should throw error if project does not exist', async () => {
      // Arrange
      mockPrisma.project.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(agentService.registerAgent(validAgentData))
        .rejects.toThrow('Project not found');
    });

    it('should throw error if agent type is invalid', async () => {
      // Arrange
      const invalidAgentData = {
        ...validAgentData,
        type: 'invalid-type'
      };
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'test-project-id' });

      // Act & Assert
      await expect(agentService.registerAgent(invalidAgentData))
        .rejects.toThrow('Invalid agent type: invalid-type');
    });

    it('should throw error if required fields are missing', async () => {
      // Arrange
      const invalidAgentData = {
        ...validAgentData,
        name: '' // Empty name
      };

      // Act & Assert
      await expect(agentService.registerAgent(invalidAgentData))
        .rejects.toThrow('name is required');
    });
  });

  describe('updateAgentConfig', () => {
    const agentId = 'test-agent-id';
    const configUpdate = {
      timeout: 60000,
      capabilities: ['new-capability']
    };

    it('should successfully update agent configuration', async () => {
      // Arrange
      const mockAgent = {
        id: agentId,
        name: 'Test Agent',
        config: { runtime: 'nodejs', timeout: 30000 },
        resourceQuota: { id: 'quota-id' }
      };
      const updatedAgent = {
        ...mockAgent,
        config: { ...mockAgent.config, ...configUpdate },
        capabilities: configUpdate.capabilities,
        updatedAt: new Date()
      };

      mockPrisma.agent.update.mockResolvedValue(updatedAgent);
      mockCache.set.mockResolvedValue(undefined);
      mockHealthMonitor.updateHealthCheck.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);

      // Act
      const result = await agentService.updateAgentConfig(agentId, configUpdate);

      // Assert
      expect(mockPrisma.agent.update).toHaveBeenCalledWith({
        where: { id: agentId },
        data: expect.objectContaining({
          config: configUpdate,
          capabilities: configUpdate.capabilities,
          dependencies: undefined,
          updatedAt: expect.any(Date)
        }),
        include: { resourceQuota: true }
      });
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockMessaging.broadcastNotification).toHaveBeenCalledWith(
        'agent.config.updated',
        expect.objectContaining({
          agentId,
          changes: Object.keys(configUpdate)
        })
      );
      expect(result).toEqual(expect.objectContaining(configUpdate));
    });

    it('should throw error for invalid runtime', async () => {
      // Arrange
      const invalidConfig = { runtime: 'invalid-runtime' };

      // Act & Assert
      await expect(agentService.updateAgentConfig(agentId, invalidConfig))
        .rejects.toThrow('Invalid runtime: invalid-runtime');
    });

    it('should throw error for timeout too low', async () => {
      // Arrange
      const invalidConfig = { timeout: 500 };

      // Act & Assert
      await expect(agentService.updateAgentConfig(agentId, invalidConfig))
        .rejects.toThrow('Timeout must be at least 1000ms');
    });
  });

  describe('getAgent', () => {
    const agentId = 'test-agent-id';

    it('should return agent from cache if available', async () => {
      // Arrange
      const mockAgent = {
        id: agentId,
        name: 'Test Agent',
        type: 'code-review'
      };
      mockCache.get.mockResolvedValue({ hit: true, value: mockAgent });

      // Act
      const result = await agentService.getAgent(agentId);

      // Assert
      expect(mockCache.get).toHaveBeenCalledWith(`agent:${agentId}`);
      expect(result).toEqual(mockAgent);
      expect(mockPrisma.agent.findUnique).not.toHaveBeenCalled();
    });

    it('should return agent from database if not in cache', async () => {
      // Arrange
      const mockAgent = {
        id: agentId,
        name: 'Test Agent',
        type: 'code-review',
        resourceQuota: { id: 'quota-id' },
        tasks: []
      };
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockCache.set.mockResolvedValue(undefined);

      // Act
      const result = await agentService.getAgent(agentId);

      // Assert
      expect(mockPrisma.agent.findUnique).toHaveBeenCalledWith({
        where: { id: agentId },
        include: {
          resourceQuota: true,
          tasks: expect.any(Object)
        }
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        `agent:${agentId}`,
        expect.any(Object),
        { ttl: 300000, tags: ['agent', 'code-review'] }
      );
      expect(result).toEqual(expect.objectContaining({
        id: agentId,
        name: 'Test Agent'
      }));
    });

    it('should return null if agent not found', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act
      const result = await agentService.getAgent(agentId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('listAgents', () => {
    it('should return filtered list of agents', async () => {
      // Arrange
      const filters = {
        projectId: 'project-1',
        type: 'code-review',
        status: AgentStatus.RUNNING,
        limit: 10,
        offset: 0
      };
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1', type: 'code-review', status: AgentStatus.RUNNING },
        { id: 'agent-2', name: 'Agent 2', type: 'code-review', status: AgentStatus.RUNNING }
      ];
      mockPrisma.agent.findMany.mockResolvedValue(mockAgents);
      mockPrisma.agent.count.mockResolvedValue(2);

      // Act
      const result = await agentService.listAgents(filters);

      // Assert
      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          projectId: 'project-1',
          type: 'code-review',
          status: AgentStatus.RUNNING
        }),
        include: { resourceQuota: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0
      });
      expect(mockPrisma.agent.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          projectId: 'project-1',
          type: 'code-review',
          status: AgentStatus.RUNNING
        })
      });
      expect(result).toEqual({
        agents: expect.arrayContaining([
          expect.objectContaining({ id: 'agent-1' }),
          expect.objectContaining({ id: 'agent-2' })
        ]),
        total: 2
      });
    });

    it('should return all agents when no filters provided', async () => {
      // Arrange
      const mockAgents = [
        { id: 'agent-1', name: 'Agent 1' },
        { id: 'agent-2', name: 'Agent 2' }
      ];
      mockPrisma.agent.findMany.mockResolvedValue(mockAgents);
      mockPrisma.agent.count.mockResolvedValue(2);

      // Act
      const result = await agentService.listAgents();

      // Assert
      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith({
        where: {},
        include: { resourceQuota: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0
      });
      expect(result).toEqual({
        agents: expect.any(Array),
        total: 2
      });
    });
  });

  describe('deleteAgent', () => {
    const agentId = 'test-agent-id';
    const mockAgent = {
      id: agentId,
      name: 'Test Agent',
      status: AgentStatus.STOPPED
    };

    it('should successfully delete a stopped agent', async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.agent.delete.mockResolvedValue(undefined);
      mockHealthMonitor.unregisterAgent.mockResolvedValue(undefined);
      mockCache.delete.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);

      // Act
      const result = await agentService.deleteAgent(agentId);

      // Assert
      expect(mockPrisma.agent.delete).toHaveBeenCalledWith({
        where: { id: agentId }
      });
      expect(mockHealthMonitor.unregisterAgent).toHaveBeenCalledWith(agentId);
      expect(mockCache.delete).toHaveBeenCalledWith(`agent:${agentId}`);
      expect(mockMessaging.broadcastNotification).toHaveBeenCalledWith(
        'agent.deleted',
        expect.objectContaining({
          agentId,
          agentName: 'Test Agent'
        })
      );
      expect(result).toBe(true);
    });

    it('should throw error if agent is running', async () => {
      // Arrange
      const runningAgent = { ...mockAgent, status: AgentStatus.RUNNING };
      mockPrisma.agent.findUnique.mockResolvedValue(runningAgent);

      // Act & Assert
      await expect(agentService.deleteAgent(agentId))
        .rejects.toThrow('Agent must be stopped before deletion');
    });

    it('should force delete running agent when force=true', async () => {
      // Arrange
      const runningAgent = { ...mockAgent, status: AgentStatus.RUNNING };
      mockPrisma.agent.findUnique.mockResolvedValue(runningAgent);
      mockLifecycleManager.stopAgent.mockResolvedValue(undefined);
      mockPrisma.agent.delete.mockResolvedValue(undefined);
      mockHealthMonitor.unregisterAgent.mockResolvedValue(undefined);
      mockCache.delete.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);

      // Act
      const result = await agentService.deleteAgent(agentId, true);

      // Assert
      expect(mockLifecycleManager.stopAgent).toHaveBeenCalledWith(agentId);
      expect(mockPrisma.agent.delete).toHaveBeenCalledWith({
        where: { id: agentId }
      });
      expect(result).toBe(true);
    });

    it('should throw error if agent not found', async () => {
      // Arrange
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(agentService.deleteAgent(agentId))
        .rejects.toThrow('Agent not found');
    });
  });

  describe('getAgentMetrics', () => {
    const agentId = 'test-agent-id';
    const mockAgent = {
      id: agentId,
      name: 'Test Agent',
      type: 'code-review',
      status: AgentStatus.RUNNING,
      metadata: { version: '1.0.0' }
    };

    it('should return comprehensive agent metrics', async () => {
      // Arrange
      const mockHealthMetrics = {
        status: 'healthy',
        lastCheck: new Date(),
        metrics: {
          cpu: { usage: 50, loadAverage: [0.5, 0.6, 0.7], cores: 4 },
          memory: { used: 512, total: 1024, percentage: 50, heapUsed: 256, heapTotal: 512 },
          tasks: { total: 10, completed: 8, failed: 1, successRate: 0.8, avgDuration: 2000 },
          network: { bytesIn: 1000, bytesOut: 500, connections: 5 },
          performance: { responseTime: 100, throughput: 10, errorRate: 0.1 }
        }
      };
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockCache.get.mockResolvedValue({ hit: true, value: mockAgent });
      mockHealthMonitor.getHealthMetrics.mockResolvedValue(mockHealthMetrics);
      mockPrisma.task.count.mockResolvedValue(10);

      // Act
      const result = await agentService.getAgentMetrics(agentId);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        agent: expect.objectContaining({
          id: agentId,
          name: 'Test Agent',
          type: 'code-review',
          status: AgentStatus.RUNNING,
          version: '1.0.0'
        }),
        health: mockHealthMetrics,
        execution: expect.any(Object),
        resources: expect.any(Object),
        timestamp: expect.any(Date)
      }));
    });

    it('should throw error if agent not found', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(agentService.getAgentMetrics(agentId))
        .rejects.toThrow('Agent not found');
    });
  });

  describe('updateResourceQuota', () => {
    const agentId = 'test-agent-id';
    const quotaUpdate = {
      maxCpuCores: 4,
      maxMemoryMb: 2048
    };

    it('should successfully update resource quota', async () => {
      // Arrange
      const mockResourceQuota = {
        id: 'quota-id',
        cpuCores: 2,
        memoryMB: 1024,
        diskMB: 2048,
        maxConcurrentTasks: 5,
        tokenLimit: 10000,
        bandwidthMB: 100
      };
      const mockAgent = {
        id: agentId,
        resourceQuota: mockResourceQuota
      };
      const updatedQuota = {
        ...mockResourceQuota,
        ...quotaUpdate
      };
      const updatedAgent = {
        ...mockAgent,
        resourceQuota: updatedQuota
      };

      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.resourceQuota.update.mockResolvedValue(updatedQuota);
      mockPrisma.agent.findUnique.mockResolvedValue(updatedAgent);
      mockCache.set.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);

      // Act
      const result = await agentService.updateResourceQuota(agentId, quotaUpdate);

      // Assert
      expect(mockPrisma.resourceQuota.update).toHaveBeenCalledWith({
        where: { id: 'quota-id' },
        data: quotaUpdate
      });
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockMessaging.broadcastNotification).toHaveBeenCalledWith(
        'agent.quota.updated',
        expect.objectContaining({
          agentId,
          changes: Object.keys(quotaUpdate)
        })
      );
      expect(result).toEqual(expect.objectContaining({
        resourceQuota: expect.objectContaining(quotaUpdate)
      }));
    });

    it('should throw error if agent has no resource quota', async () => {
      // Arrange
      const mockAgent = {
        id: agentId,
        resourceQuota: null
      };
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);

      // Act & Assert
      await expect(agentService.updateResourceQuota(agentId, quotaUpdate))
        .rejects.toThrow('Agent not found or has no resource quota');
    });
  });

  describe('initialize', () => {
    it('should initialize all components', async () => {
      // Arrange
      const mockAgents = [
        { id: 'agent-1', config: { healthCheck: { enabled: true } } },
        { id: 'agent-2', config: { healthCheck: { enabled: false } } }
      ];
      mockPrisma.agent.findMany.mockResolvedValue(mockAgents);
      mockHealthMonitor.initialize.mockResolvedValue(undefined);
      mockLifecycleManager.initialize.mockResolvedValue(undefined);
      mockHealthMonitor.registerAgent.mockResolvedValue(undefined);

      // Act
      await agentService.initialize();

      // Assert
      expect(mockHealthMonitor.initialize).toHaveBeenCalled();
      expect(mockLifecycleManager.initialize).toHaveBeenCalled();
      expect(mockHealthMonitor.registerAgent).toHaveBeenCalledWith(
        'agent-1',
        mockAgents[0].config.healthCheck
      );
      expect(mockHealthMonitor.registerAgent).not.toHaveBeenCalledWith(
        'agent-2',
        mockAgents[1].config.healthCheck
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      // Arrange
      mockHealthMonitor.cleanup.mockResolvedValue(undefined);
      mockLifecycleManager.cleanup.mockResolvedValue(undefined);

      // Act
      await agentService.cleanup();

      // Assert
      expect(mockHealthMonitor.cleanup).toHaveBeenCalled();
      expect(mockLifecycleManager.cleanup).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should emit error events when operations fail', async () => {
      // Arrange
      const validAgentData = {
        name: 'Test Agent',
        type: 'code-review',
        projectId: 'test-project-id',
        config: { runtime: 'nodejs' },
        resourceQuota: { maxCpuCores: 1 }
      };
      const error = new Error('Database error');

      mockPrisma.project.findUnique.mockResolvedValue({ id: 'test-project-id' });
      mockPrisma.resourceQuota.create.mockRejectedValue(error);

      // Spy on emit method
      const emitSpy = jest.spyOn(agentService, 'emit');

      // Act & Assert
      await expect(agentService.registerAgent(validAgentData))
        .rejects.toThrow('Database error');

      expect(emitSpy).toHaveBeenCalledWith('error', error);
    });
  });
});
