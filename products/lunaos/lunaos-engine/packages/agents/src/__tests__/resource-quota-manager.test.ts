/**
 * Unit Tests for Resource Quota Manager
 */

import { ResourceQuotaManager } from '../resource-quota-manager';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import { PrismaClient } from '@prisma/client';
import {
  ResourceQuota,
  ResourceUsage,
  ResourceAlert,
  QuotaViolation
} from '../interfaces';

// Mock dependencies
jest.mock('@claude-agent/cache');
jest.mock('@claude-agent/messaging');
jest.mock('@prisma/client');

describe('ResourceQuotaManager', () => {
  let resourceQuotaManager: ResourceQuotaManager;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockCache: jest.Mocked<RedisCache>;
  let mockMessaging: jest.Mocked<QueueService>;

  const mockConfig = {
    monitoringInterval: 30000,
    alertThresholds: {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      network: { warning: 1000, critical: 2000 },
      tokens: { warning: 0.8, critical: 0.95 },
      tasks: { warning: 0.8, critical: 0.95 }
    },
    enforcementEnabled: true,
    autoScalingEnabled: false,
    optimizationEnabled: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    mockCache = new RedisCache() as jest.Mocked<RedisCache>;
    mockMessaging = new QueueService() as jest.Mocked<QueueService>;

    // Mock Prisma client methods
    mockPrisma.resourceQuota = {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn()
    } as any;

    mockPrisma.agent = {
      findMany: jest.fn()
    } as any;

    // Mock cache methods
    mockCache.get = jest.fn();
    mockCache.set = jest.fn();
    mockCache.delete = jest.fn();

    // Mock messaging methods
    mockMessaging.broadcastNotification = jest.fn();

    // Create resource quota manager instance
    resourceQuotaManager = new ResourceQuotaManager(
      mockPrisma,
      mockCache,
      mockMessaging,
      mockConfig
    );

    // Replace internal instances with mocks
    (resourceQuotaManager as any).cache = mockCache;
    (resourceQuotaManager as any).messaging = mockMessaging;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setResourceQuota', () => {
    const agentId = 'test-agent-id';
    const quota: Omit<ResourceQuota, 'id'> = {
      maxCpuCores: 4,
      maxMemoryMb: 2048,
      maxDiskMb: 4096,
      maxConcurrentTasks: 10,
      maxTokens: 100000,
      maxBandwidthMb: 500,
      maxGpuMemory: 8,
      maxInstances: 3
    };

    it('should successfully set resource quota for new agent', async () => {
      // Arrange
      const mockResourceQuota = {
        id: 'quota-id',
        cpuCores: 4,
        memoryMB: 2048,
        diskMB: 4096,
        maxConcurrentTasks: 10,
        tokenLimit: 100000,
        bandwidthMB: 500
      };
      mockPrisma.resourceQuota.upsert.mockResolvedValue(mockResourceQuota);
      mockCache.set.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);

      // Act
      const result = await resourceQuotaManager.setResourceQuota(agentId, quota);

      // Assert
      expect(mockPrisma.resourceQuota.upsert).toHaveBeenCalledWith({
        where: { id: agentId },
        update: {
          cpuCores: quota.maxCpuCores,
          memoryMB: quota.maxMemoryMb,
          diskMB: quota.maxDiskMb,
          maxConcurrentTasks: quota.maxConcurrentTasks,
          tokenLimit: quota.maxTokens,
          bandwidthMB: quota.maxBandwidthMb
        },
        create: {
          id: agentId,
          cpuCores: quota.maxCpuCores,
          memoryMB: quota.maxMemoryMb,
          diskMB: quota.maxDiskMb,
          maxConcurrentTasks: quota.maxConcurrentTasks,
          tokenLimit: quota.maxTokens,
          bandwidthMB: quota.maxBandwidthMb
        }
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        `resource:quota:${agentId}`,
        expect.objectContaining({
          id: 'quota-id',
          maxCpuCores: quota.maxCpuCores,
          maxMemoryMb: quota.maxMemoryMb,
          maxDiskMb: quota.maxDiskMb,
          maxConcurrentTasks: quota.maxConcurrentTasks,
          maxTokens: quota.maxTokens,
          maxBandwidthMb: quota.maxBandwidthMb
        }),
        { ttl: 3600000, tags: ['quota', 'resource'] }
      );

      expect(mockMessaging.broadcastNotification).toHaveBeenCalledWith(
        'resource.quota.updated',
        expect.objectContaining({
          agentId,
          quota: expect.any(Object)
        })
      );

      expect(result).toEqual(expect.objectContaining({
        id: 'quota-id',
        maxCpuCores: quota.maxCpuCores,
        maxMemoryMb: quota.maxMemoryMb
      }));
    });

    it('should validate quota values', async () => {
      // Arrange
      const invalidQuota = {
        ...quota,
        maxCpuCores: 100 // Exceeds limit
      };

      // Act & Assert
      await expect(resourceQuotaManager.setResourceQuota(agentId, invalidQuota))
        .rejects.toThrow('CPU cores must be between 0 and 64');
    });

    it('should validate memory limits', async () => {
      // Arrange
      const invalidQuota = {
        ...quota,
        maxMemoryMb: -100 // Negative value
      };

      // Act & Assert
      await expect(resourceQuotaManager.setResourceQuota(agentId, invalidQuota))
        .rejects.toThrow('Memory must be between 0 and 1TB');
    });

    it('should validate concurrent tasks limit', async () => {
      // Arrange
      const invalidQuota = {
        ...quota,
        maxConcurrentTasks: 2000 // Exceeds limit
      };

      // Act & Assert
      await expect(resourceQuotaManager.setResourceQuota(agentId, invalidQuota))
        .rejects.toThrow('Concurrent tasks must be between 0 and 1000');
    });
  });

  describe('getResourceQuota', () => {
    const agentId = 'test-agent-id';
    const mockResourceQuota = {
      id: 'quota-id',
      cpuCores: 4,
      memoryMB: 2048,
      diskMB: 4096,
      maxConcurrentTasks: 10,
      tokenLimit: 100000,
      bandwidthMB: 500
    };

    it('should return resource quota from cache', async () => {
      // Arrange
      const expectedQuota: ResourceQuota = {
        id: 'quota-id',
        maxCpuCores: 4,
        maxMemoryMb: 2048,
        maxDiskMb: 4096,
        maxConcurrentTasks: 10,
        maxTokens: 100000,
        maxBandwidthMb: 500
      };
      mockCache.get.mockResolvedValue({ hit: true, value: expectedQuota });

      // Act
      const result = await resourceQuotaManager.getResourceQuota(agentId);

      // Assert
      expect(mockCache.get).toHaveBeenCalledWith(`resource:quota:${agentId}`);
      expect(result).toEqual(expectedQuota);
      expect(mockPrisma.resourceQuota.findUnique).not.toHaveBeenCalled();
    });

    it('should return resource quota from database if not in cache', async () => {
      // Arrange
      const expectedQuota: ResourceQuota = {
        id: 'quota-id',
        maxCpuCores: 4,
        maxMemoryMb: 2048,
        maxDiskMb: 4096,
        maxConcurrentTasks: 10,
        maxTokens: 100000,
        maxBandwidthMb: 500
      };
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.resourceQuota.findUnique.mockResolvedValue(mockResourceQuota);
      mockCache.set.mockResolvedValue(undefined);

      // Act
      const result = await resourceQuotaManager.getResourceQuota(agentId);

      // Assert
      expect(mockPrisma.resourceQuota.findUnique).toHaveBeenCalledWith({
        where: { id: agentId }
      });
      expect(mockCache.set).toHaveBeenCalledWith(
        `resource:quota:${agentId}`,
        expectedQuota,
        { ttl: 3600000, tags: ['quota', 'resource'] }
      );
      expect(result).toEqual(expectedQuota);
    });

    it('should return null if quota not found', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.resourceQuota.findUnique.mockResolvedValue(null);

      // Act
      const result = await resourceQuotaManager.getResourceQuota(agentId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getResourceUsage', () => {
    const agentId = 'test-agent-id';
    const mockQuota: ResourceQuota = {
      id: 'quota-id',
      maxCpuCores: 4,
      maxMemoryMb: 2048,
      maxDiskMb: 4096,
      maxConcurrentTasks: 10,
      maxTokens: 100000,
      maxBandwidthMb: 500
    };
    const mockMetrics = {
      cpu: { usage: 2, cores: 4, loadAverage: [0.5, 0.6, 0.7] },
      memory: { used: 1024, total: 2048, percentage: 50, heapUsed: 512, heapTotal: 1024 },
      disk: { used: 2048, total: 4096, percentage: 50, readOps: 100, writeOps: 50 },
      network: { bytesIn: 10000, bytesOut: 5000, connections: 5, requests: 100 },
      tasks: { running: 3, queued: 2, completed: 50, failed: 2, avgDuration: 2000 },
      tokens: { used: 10000, limit: 100000, remaining: 90000, cost: 0.5 }
    };

    it('should return current resource usage', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      (resourceQuotaManager as any).resourceUsage.set(agentId, mockMetrics);

      // Act
      const result = await resourceQuotaManager.getResourceUsage(agentId);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        agentId,
        timestamp: expect.any(Date),
        cpu: {
          used: 2,
          allocated: 4,
          percentage: 50
        },
        memory: {
          used: 1024,
          allocated: 2048,
          percentage: 50,
          peak: 512
        },
        disk: {
          used: 2048,
          allocated: 4096,
          percentage: 50
        },
        network: {
          inbound: 10000,
          outbound: 5000
        },
        tokens: {
          used: 10000,
          limit: 100000,
          remaining: 90000
        },
        tasks: {
          running: 3,
          maxConcurrent: 10
        }
      }));
    });

    it('should return null if metrics not available', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      // Don't set metrics for the agent

      // Act
      const result = await resourceQuotaManager.getResourceUsage(agentId);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null if quota not found', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.resourceQuota.findUnique.mockResolvedValue(null);

      // Act
      const result = await resourceQuotaManager.getResourceUsage(agentId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('checkResourceAvailability', () => {
    const agentId = 'test-agent-id';
    const mockQuota: ResourceQuota = {
      id: 'quota-id',
      maxCpuCores: 4,
      maxMemoryMb: 2048,
      maxDiskMb: 4096,
      maxConcurrentTasks: 10,
      maxTokens: 100000,
      maxBandwidthMb: 500
    };
    const mockUsage: ResourceUsage = {
      agentId,
      timestamp: new Date(),
      cpu: { used: 2, allocated: 4, percentage: 50 },
      memory: { used: 1024, allocated: 2048, percentage: 50 },
      disk: { used: 2048, allocated: 4096, percentage: 50 },
      network: { inbound: 10000, outbound: 5000 },
      tokens: { used: 10000, limit: 100000, remaining: 90000 },
      tasks: { running: 3, maxConcurrent: 10 }
    };

    beforeEach(() => {
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      (resourceQuotaManager as any).resourceUsage.set(agentId, {
        cpu: { usage: 2, cores: 4 },
        memory: { used: 1024, total: 2048 },
        disk: { used: 2048, total: 4096 },
        tokens: { used: 10000, limit: 100000 },
        tasks: { running: 3 }
      });
    });

    it('should allow resources when within quota', async () => {
      // Arrange
      const requirements = {
        cpu: 1,
        memory: 512,
        tokens: 1000
      };

      // Act
      const result = await resourceQuotaManager.checkResourceAvailability(agentId, requirements);

      // Assert
      expect(result).toEqual({
        available: true
      });
    });

    it('should deny CPU when over quota', async () => {
      // Arrange
      const requirements = {
        cpu: 3, // Needs 3, only 2 available
        memory: 512
      };

      // Act
      const result = await resourceQuotaManager.checkResourceAvailability(agentId, requirements);

      // Assert
      expect(result).toEqual({
        available: false,
        reason: 'Insufficient CPU: need 3, have 2',
        suggestions: ['Wait for current tasks to complete', 'Upgrade CPU quota', 'Optimize task performance']
      });
    });

    it('should deny memory when over quota', async () => {
      // Arrange
      const requirements = {
        cpu: 1,
        memory: 2048 // Needs all available memory
      };

      // Act
      const result = await resourceQuotaManager.checkResourceAvailability(agentId, requirements);

      // Assert
      expect(result).toEqual({
        available: false,
        reason: 'Insufficient memory: need 2048MB, have 1024MB',
        suggestions: ['Wait for memory to be freed', 'Upgrade memory quota', 'Optimize memory usage']
      });
    });

    it('should deny tokens when over quota', async () => {
      // Arrange
      const requirements = {
        tokens: 95000 // Exceeds remaining tokens
      };

      // Act
      const result = await resourceQuotaManager.checkResourceAvailability(agentId, requirements);

      // Assert
      expect(result).toEqual({
        available: false,
        reason: 'Insufficient tokens: need 95000, have 90000',
        suggestions: ['Wait for token quota reset', 'Upgrade token plan', 'Optimize token usage']
      });
    });

    it('should deny tasks when exceeding concurrency limit', async () => {
      // Arrange
      const requirements = {
        tasks: 8 // Would exceed max concurrent of 10
      };

      // Act
      const result = await resourceQuotaManager.checkResourceAvailability(agentId, requirements);

      // Assert
      expect(result).toEqual({
        available: false,
        reason: 'Too many concurrent tasks: running 3, max 10',
        suggestions: ['Wait for current tasks to complete', 'Increase concurrent task limit', 'Optimize task scheduling']
      });
    });

    it('should return unavailable when quota not configured', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });
      mockPrisma.resourceQuota.findUnique.mockResolvedValue(null);

      // Act
      const result = await resourceQuotaManager.checkResourceAvailability(agentId, { cpu: 1 });

      // Assert
      expect(result).toEqual({
        available: false,
        reason: 'Agent resource quota not configured'
      });
    });
  });

  describe('getOptimizationRecommendations', () => {
    const agentId = 'test-agent-id';
    const mockQuota: ResourceQuota = {
      id: 'quota-id',
      maxCpuCores: 4,
      maxMemoryMb: 2048,
      maxDiskMb: 4096,
      maxConcurrentTasks: 10,
      maxTokens: 100000,
      maxBandwidthMb: 500
    };

    it('should return CPU optimization recommendations for high usage', async () => {
      // Arrange
      const highCpuMetrics = {
        cpu: { usage: 3.8, cores: 4 }, // 95% usage
        memory: { used: 1024, total: 2048 },
        disk: { used: 2048, total: 4096 },
        tokens: { used: 10000, limit: 100000 },
        tasks: { running: 3 }
      };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      (resourceQuotaManager as any).resourceUsage.set(agentId, highCpuMetrics);

      // Act
      const recommendations = await resourceQuotaManager.getOptimizationRecommendations(agentId);

      // Assert
      expect(recommendations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'cpu',
          severity: 'critical',
          message: 'Critical CPU usage: 95.0%',
          suggestions: expect.arrayContaining([
            'Optimize code performance',
            'Add CPU cores to quota'
          ]),
          potentialSavings: '30-50%'
        })
      ]));
    });

    it('should return memory optimization recommendations for high usage', async () => {
      // Arrange
      const highMemoryMetrics = {
        cpu: { usage: 1, cores: 4 },
        memory: { used: 1946, total: 2048 }, // 95% usage
        disk: { used: 2048, total: 4096 },
        tokens: { used: 10000, limit: 100000 },
        tasks: { running: 3 }
      };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      (resourceQuotaManager as any).resourceUsage.set(agentId, highMemoryMetrics);

      // Act
      const recommendations = await resourceQuotaManager.getOptimizationRecommendations(agentId);

      // Assert
      expect(recommendations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'memory',
          severity: 'critical',
          message: 'Critical memory usage: 95.0%',
          suggestions: expect.arrayContaining([
            'Implement memory cleanup',
            'Optimize data structures'
          ]),
          potentialSavings: '40-60%'
        })
      ]));
    });

    it('should return disk optimization recommendations for high usage', async () => {
      // Arrange
      const highDiskMetrics = {
        cpu: { usage: 1, cores: 4 },
        memory: { used: 1024, total: 2048 },
        disk: { used: 3890, total: 4096 }, // 95% usage
        tokens: { used: 10000, limit: 100000 },
        tasks: { running: 3 }
      };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      (resourceQuotaManager as any).resourceUsage.set(agentId, highDiskMetrics);

      // Act
      const recommendations = await resourceQuotaManager.getOptimizationRecommendations(agentId);

      // Assert
      expect(recommendations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'disk',
          severity: 'critical',
          message: 'High disk usage: 95.0%',
          suggestions: expect.arrayContaining([
            'Clean up temporary files',
            'Implement log rotation'
          ]),
          potentialSavings: '50-70%'
        })
      ]));
    });

    it('should return empty recommendations for normal usage', async () => {
      // Arrange
      const normalMetrics = {
        cpu: { usage: 1, cores: 4 },
        memory: { used: 512, total: 2048 },
        disk: { used: 1024, total: 4096 },
        tokens: { used: 10000, limit: 100000 },
        tasks: { running: 3 }
      };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      (resourceQuotaManager as any).resourceUsage.set(agentId, normalMetrics);

      // Act
      const recommendations = await resourceQuotaManager.getOptimizationRecommendations(agentId);

      // Assert
      expect(recommendations).toEqual([]);
    });

    it('should return empty recommendations when usage not available', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      // Don't set metrics

      // Act
      const recommendations = await resourceQuotaManager.getOptimizationRecommendations(agentId);

      // Assert
      expect(recommendations).toEqual([]);
    });
  });

  describe('startMonitoring', () => {
    const agentId = 'test-agent-id';

    it('should start monitoring for an agent', async () => {
      // Arrange
      const mockQuota = { maxCpuCores: 4, maxMemoryMb: 2048 };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      jest.spyOn(global, 'setInterval').mockReturnValue(jest.fn() as any);

      // Act
      await resourceQuotaManager.startMonitoring(agentId);

      // Assert
      const monitoringIntervals = (resourceQuotaManager as any).monitoringIntervals;
      expect(monitoringIntervals.has(agentId)).toBe(true);
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        mockConfig.monitoringInterval
      );
    });

    it('should not start monitoring if already monitoring', async () => {
      // Arrange
      const mockQuota = { maxCpuCores: 4, maxMemoryMb: 2048 };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      jest.spyOn(global, 'setInterval').mockReturnValue(jest.fn() as any);

      // Act
      await resourceQuotaManager.startMonitoring(agentId);
      await resourceQuotaManager.startMonitoring(agentId); // Second call

      // Assert
      const monitoringIntervals = (resourceQuotaManager as any).monitoringIntervals;
      expect(monitoringIntervals.get(agentId)).toBeDefined();
      expect(setInterval).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopMonitoring', () => {
    const agentId = 'test-agent-id';
    const mockInterval = { unref: jest.fn() } as any;

    beforeEach(async () => {
      const mockQuota = { maxCpuCores: 4, maxMemoryMb: 2048 };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      jest.spyOn(global, 'setInterval').mockReturnValue(mockInterval);
      jest.spyOn(global, 'clearInterval').mockImplementation();

      await resourceQuotaManager.startMonitoring(agentId);
    });

    it('should stop monitoring for an agent', async () => {
      // Act
      await resourceQuotaManager.stopMonitoring(agentId);

      // Assert
      const monitoringIntervals = (resourceQuotaManager as any).monitoringIntervals;
      expect(monitoringIntervals.has(agentId)).toBe(false);
      expect(clearInterval).toHaveBeenCalledWith(mockInterval);
    });
  });

  describe('initialize', () => {
    it('should load existing quotas and start monitoring for active agents', async () => {
      // Arrange
      const mockQuotas = [
        { id: 'agent-1', cpuCores: 2, memoryMB: 1024 },
        { id: 'agent-2', cpuCores: 4, memoryMB: 2048 }
      ];
      const mockAgents = [
        { id: 'agent-1', status: 'RUNNING' },
        { id: 'agent-2', status: 'RUNNING' }
      ];
      mockPrisma.resourceQuota.findMany.mockResolvedValue(mockQuotas);
      mockPrisma.agent.findMany.mockResolvedValue(mockAgents);
      mockCache.set.mockResolvedValue(undefined);
      jest.spyOn(global, 'setInterval').mockReturnValue(jest.fn() as any);

      // Act
      await resourceQuotaManager.initialize();

      // Assert
      expect(mockPrisma.resourceQuota.findMany).toHaveBeenCalled();
      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith({
        where: { status: 'RUNNING' }
      });
      expect(mockCache.set).toHaveBeenCalledTimes(2); // Cache both quotas
      expect(setInterval).toHaveBeenCalledTimes(2); // Start monitoring for both agents
    });
  });

  describe('cleanup', () => {
    const agents = ['agent-1', 'agent-2'];

    beforeEach(async () => {
      for (const agentId of agents) {
        const mockQuota = { maxCpuCores: 4, maxMemoryMb: 2048 };
        mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
        jest.spyOn(global, 'setInterval').mockReturnValue(jest.fn() as any);
        await resourceQuotaManager.startMonitoring(agentId);
      }
    });

    it('should cleanup all resources', async () => {
      // Arrange
      jest.spyOn(global, 'clearInterval').mockImplementation();

      // Act
      await resourceQuotaManager.cleanup();

      // Assert
      const monitoringIntervals = (resourceQuotaManager as any).monitoringIntervals;
      expect(monitoringIntervals.size).toBe(0);
      expect((resourceQuotaManager as any).resourceUsage.size).toBe(0);
      expect((resourceQuotaManager as any).quotaViolations.size).toBe(0);
      expect((resourceQuotaManager as any).resourceAlerts.size).toBe(0);
    });
  });

  describe('collectResourceMetrics', () => {
    const agentId = 'test-agent-id';

    it('should collect and store resource metrics', async () => {
      // Arrange
      const mockQuota = { maxCpuCores: 4, maxMemoryMb: 2048 };
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Consistent random values

      // Act
      await (resourceQuotaManager as any).collectResourceMetrics(agentId);

      // Assert
      const resourceUsage = (resourceQuotaManager as any).resourceUsage;
      expect(resourceUsage.has(agentId)).toBe(true);

      const metrics = resourceUsage.get(agentId);
      expect(metrics).toEqual(expect.objectContaining({
        cpu: expect.objectContaining({
          usage: expect.any(Number),
          cores: 4,
          loadAverage: expect.arrayOfLength(3)
        }),
        memory: expect.objectContaining({
          used: expect.any(Number),
          total: 2048,
          percentage: expect.any(Number)
        }),
        disk: expect.objectContaining({
          used: expect.any(Number),
          total: 10240,
          percentage: expect.any(Number)
        }),
        network: expect.objectContaining({
          bytesIn: expect.any(Number),
          bytesOut: expect.any(Number),
          connections: expect.any(Number),
          requests: expect.any(Number)
        }),
        tasks: expect.objectContaining({
          running: expect.any(Number),
          queued: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number)
        }),
        tokens: expect.objectContaining({
          used: expect.any(Number),
          limit: 100000,
          remaining: expect.any(Number),
          cost: expect.any(Number)
        })
      }));
    });
  });

  describe('checkQuotaViolations', () => {
    const agentId = 'test-agent-id';
    const mockQuota: ResourceQuota = {
      id: 'quota-id',
      maxCpuCores: 4,
      maxMemoryMb: 2048,
      maxDiskMb: 4096,
      maxConcurrentTasks: 10,
      maxTokens: 100000,
      maxBandwidthMb: 500
    };
    const violatingMetrics = {
      cpu: { usage: 5 }, // Exceeds quota
      memory: { used: 2048 }, // Exactly at quota
      tokens: { used: 150000 }, // Exceeds quota
      tasks: { running: 15 } // Exceeds quota
    };

    it('should detect and handle quota violations', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: true, value: mockQuota });
      jest.spyOn(resourceQuotaManager as any, 'handleQuotaViolations').mockResolvedValue(undefined);

      // Act
      await (resourceQuotaManager as any).checkQuotaViolations(agentId, violatingMetrics);

      // Assert
      const violations = (resourceQuotaManager as any).quotaViolations.get(agentId);
      expect(violations).toHaveLength(4); // cpu, memory, tokens, tasks violations

      expect(violations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'cpu',
          severity: 'critical',
          actual: 5,
          limit: 4
        }),
        expect.objectContaining({
          type: 'tokens',
          severity: 'high',
          actual: 150000,
          limit: 100000
        }),
        expect.objectContaining({
          type: 'tasks',
          severity: 'medium',
          actual: 15,
          limit: 10
        })
      ]));
    });
  });
});
