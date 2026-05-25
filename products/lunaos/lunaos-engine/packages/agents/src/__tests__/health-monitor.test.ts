/**
 * Unit Tests for Health Monitor Service
 */

import { HealthMonitor } from '../health-monitor';
import { RedisCache } from '@claude-agent/cache';
import { QueueService } from '@claude-agent/messaging';
import {
  AgentHealthConfig,
  HealthCheckDefinition,
  AgentHealth,
  HealthMetrics
} from '../interfaces';

// Mock dependencies
jest.mock('@claude-agent/cache');
jest.mock('@claude-agent/messaging');

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let mockCache: jest.Mocked<RedisCache>;
  let mockMessaging: jest.Mocked<QueueService>;

  const mockConfig = {
    interval: 30000,
    timeout: 5000,
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      responseTime: 1000,
      errorRate: 5,
      uptime: 95
    },
    alerting: {
      enabled: true,
      channels: [
        { type: 'email', config: { to: 'admin@example.com' }, enabled: true },
        { type: 'slack', config: { webhook: 'https://hooks.slack.com/...' }, enabled: true }
      ],
      severity: 'high',
      cooldown: 300000
    },
    persistence: true
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instances
    mockCache = new RedisCache() as jest.Mocked<RedisCache>;
    mockMessaging = new QueueService() as jest.Mocked<QueueService>;

    // Mock cache methods
    mockCache.get = jest.fn();
    mockCache.set = jest.fn();
    mockCache.delete = jest.fn();

    // Mock messaging methods
    mockMessaging.broadcastNotification = jest.fn();

    // Create health monitor instance
    healthMonitor = new HealthMonitor(mockConfig);
    (healthMonitor as any).cache = mockCache;
    (healthMonitor as any).messaging = mockMessaging;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('registerAgent', () => {
    const agentId = 'test-agent-id';
    const healthConfig: AgentHealthConfig = {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      checks: [
        {
          name: 'memory',
          type: 'memory',
          threshold: 80,
          critical: true,
          timeout: 5000
        },
        {
          name: 'cpu',
          type: 'cpu',
          threshold: 70,
          critical: false,
          timeout: 3000
        }
      ]
    };

    it('should successfully register an agent', async () => {
      // Arrange
      mockCache.set.mockResolvedValue(undefined);

      // Act
      await healthMonitor.registerAgent(agentId, healthConfig);

      // Assert
      const registeredAgents = (healthMonitor as any).registeredAgents;
      expect(registeredAgents.has(agentId)).toBe(true);
      expect(registeredAgents.get(agentId)).toEqual(healthConfig);

      const healthHistory = (healthMonitor as any).healthHistory;
      expect(healthHistory.has(agentId)).toBe(true);
      expect(healthHistory.get(agentId)).toHaveLength(1);

      const initialHealth = healthHistory.get(agentId)[0];
      expect(initialHealth).toEqual(expect.objectContaining({
        status: 'unknown',
        lastCheck: expect.any(Date),
        metrics: expect.objectContaining({
          cpu: expect.any(Object),
          memory: expect.any(Object),
          tasks: expect.any(Object),
          network: expect.any(Object),
          performance: expect.any(Object)
        }),
        checks: [],
        uptime: 0,
        restartCount: 0,
        errorCount: 0
      }));

      expect(mockCache.set).toHaveBeenCalledWith(
        `agent:health:${agentId}`,
        expect.any(Object),
        { ttl: 3600000, tags: ['health', 'agent'] }
      );
    });

    it('should throw error for invalid health config', async () => {
      // Arrange
      const invalidConfig = {
        enabled: true,
        interval: 500, // Too low
        timeout: 5000,
        checks: []
      };

      // Act & Assert
      await expect(healthMonitor.registerAgent(agentId, invalidConfig))
        .rejects.toThrow('Health check interval must be at least 1000ms');
    });

    it('should throw error for empty checks array', async () => {
      // Arrange
      const invalidConfig = {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        checks: []
      };

      // Act & Assert
      await expect(healthMonitor.registerAgent(agentId, invalidConfig))
        .rejects.toThrow('At least one health check must be configured');
    });

    it('should throw error for incomplete check definition', async () => {
      // Arrange
      const invalidConfig = {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        checks: [
          {
            name: '',
            type: 'memory',
            threshold: 80,
            critical: true
          }
        ]
      };

      // Act & Assert
      await expect(healthMonitor.registerAgent(agentId, invalidConfig))
        .rejects.toThrow('Health check must have name and type');
    });
  });

  describe('unregisterAgent', () => {
    const agentId = 'test-agent-id';

    beforeEach(async () => {
      const healthConfig: AgentHealthConfig = {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        checks: [
          {
            name: 'memory',
            type: 'memory',
            threshold: 80,
            critical: true,
            timeout: 5000
          }
        ]
      };
      await healthMonitor.registerAgent(agentId, healthConfig);
    });

    it('should successfully unregister an agent', async () => {
      // Arrange
      mockCache.delete.mockResolvedValue(undefined);

      // Act
      await healthMonitor.unregisterAgent(agentId);

      // Assert
      const registeredAgents = (healthMonitor as any).registeredAgents;
      expect(registeredAgents.has(agentId)).toBe(false);

      const healthHistory = (healthMonitor as any).healthHistory;
      expect(healthHistory.has(agentId)).toBe(false);

      const alerts = (healthMonitor as any).alerts;
      expect(alerts.has(agentId)).toBe(false);

      expect(mockCache.delete).toHaveBeenCalledWith(`agent:health:${agentId}`);
    });
  });

  describe('getAgentHealth', () => {
    const agentId = 'test-agent-id';
    const mockHealth: AgentHealth = {
      status: 'healthy',
      lastCheck: new Date(),
      metrics: {
        cpu: { usage: 50, loadAverage: [0.5, 0.6, 0.7], cores: 4 },
        memory: { used: 512, total: 1024, percentage: 50, heapUsed: 256, heapTotal: 512 },
        tasks: { total: 10, completed: 8, failed: 1, successRate: 0.8, avgDuration: 2000 },
        network: { bytesIn: 1000, bytesOut: 500, connections: 5 },
        performance: { responseTime: 100, throughput: 10, errorRate: 0.1 }
      },
      checks: [
        {
          name: 'memory',
          type: 'memory',
          status: 'pass',
          message: 'Memory usage is normal',
          timestamp: new Date(),
          timeout: 5000,
          interval: 30000,
          details: { usage: 50, threshold: 80 }
        }
      ],
      uptime: 3600000,
      restartCount: 0,
      errorCount: 0
    };

    it('should return agent health from cache', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: true, value: mockHealth });

      // Act
      const result = await healthMonitor.getAgentHealth(agentId);

      // Assert
      expect(mockCache.get).toHaveBeenCalledWith(`agent:health:${agentId}`);
      expect(result).toEqual(mockHealth);
    });

    it('should return agent health from history if not in cache', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });
      await healthMonitor.registerAgent(agentId, {
        enabled: true,
        interval: 30000,
        timeout: 5000,
        checks: []
      });
      (healthMonitor as any).healthHistory.get(agentId)[0] = mockHealth;

      // Act
      const result = await healthMonitor.getAgentHealth(agentId);

      // Assert
      expect(result).toEqual(mockHealth);
    });

    it('should return null if no health data exists', async () => {
      // Arrange
      mockCache.get.mockResolvedValue({ hit: false });

      // Act
      const result = await healthMonitor.getAgentHealth(agentId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getHealthSummary', () => {
    const agents = ['agent-1', 'agent-2', 'agent-3'];

    beforeEach(async () => {
      // Register multiple agents with different health statuses
      for (const agentId of agents) {
        await healthMonitor.registerAgent(agentId, {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          checks: [
            {
              name: 'memory',
              type: 'memory',
              threshold: 80,
              critical: true,
              timeout: 5000
            }
          ]
        });
      }

      // Set different health statuses
      const healthHistory = (healthMonitor as any).healthHistory;
      healthHistory.get('agent-1')[0].status = 'healthy';
      healthHistory.get('agent-2')[0].status = 'degraded';
      healthHistory.get('agent-3')[0].status = 'unhealthy';
    });

    it('should return comprehensive health summary', async () => {
      // Act
      const summary = await healthMonitor.getHealthSummary();

      // Assert
      expect(summary).toEqual({
        total: 3,
        healthy: 1,
        degraded: 1,
        unhealthy: 1,
        unknown: 0,
        agents: expect.arrayContaining([
          expect.objectContaining({ id: 'agent-1', status: 'healthy' }),
          expect.objectContaining({ id: 'agent-2', status: 'degraded' }),
          expect.objectContaining({ id: 'agent-3', status: 'unhealthy' })
        ])
      });
    });

    it('should return empty summary when no agents registered', async () => {
      // Arrange
      (healthMonitor as any).registeredAgents.clear();

      // Act
      const summary = await healthMonitor.getHealthSummary();

      // Assert
      expect(summary).toEqual({
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0,
        agents: []
      });
    });
  });

  describe('triggerHealthCheck', () => {
    const agentId = 'test-agent-id';
    const healthConfig: AgentHealthConfig = {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      checks: [
        {
          name: 'memory',
          type: 'memory',
          threshold: 80,
          critical: true,
          timeout: 5000
        },
        {
          name: 'cpu',
          type: 'cpu',
          threshold: 70,
          critical: false,
          timeout: 3000
        }
      ]
    };

    beforeEach(async () => {
      await healthMonitor.registerAgent(agentId, healthConfig);
      mockCache.set.mockResolvedValue(undefined);
      mockMessaging.broadcastNotification.mockResolvedValue(undefined);
    });

    it('should perform health check and return updated health', async () => {
      // Act
      const result = await healthMonitor.triggerHealthCheck(agentId);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        status: expect.any(String),
        lastCheck: expect.any(Date),
        metrics: expect.any(Object),
        checks: expect.arrayContaining([
          expect.objectContaining({
            name: 'memory',
            type: 'memory',
            status: expect.any(String),
            message: expect.any(String),
            timestamp: expect.any(Date),
            timeout: 5000
          }),
          expect.objectContaining({
            name: 'cpu',
            type: 'cpu',
            status: expect.any(String),
            message: expect.any(String),
            timestamp: expect.any(Date),
            timeout: 3000
          })
        ]),
        uptime: expect.any(Number),
        restartCount: 0,
        errorCount: expect.any(Number)
      }));
    });

    it('should throw error if agent not registered', async () => {
      // Act & Assert
      await expect(healthMonitor.triggerHealthCheck('unknown-agent'))
        .rejects.toThrow('Agent not registered for health monitoring');
    });

    it('should handle health check failures gracefully', async () => {
      // Arrange
      const failingConfig = {
        enabled: true,
        interval: 30000,
        timeout: 1, // Very short timeout to trigger failure
        checks: [
          {
            name: 'api',
            type: 'api',
            threshold: 1000,
            critical: true,
            timeout: 1
          }
        ]
      };
      await healthMonitor.registerAgent('failing-agent', failingConfig);

      // Act
      const result = await healthMonitor.triggerHealthCheck('failing-agent');

      // Assert
      expect(result.status).toBe('unhealthy');
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].status).toBe('fail');
      expect(result.checks[0].message).toContain('failed');
    });
  });

  describe('updateHealthCheck', () => {
    const agentId = 'test-agent-id';
    const originalConfig: AgentHealthConfig = {
      enabled: true,
      interval: 30000,
      timeout: 5000,
      checks: [
        {
          name: 'memory',
          type: 'memory',
          threshold: 80,
          critical: true,
          timeout: 5000
        }
      ]
    };

    const updatedConfig: AgentHealthConfig = {
      enabled: true,
      interval: 60000, // Updated interval
      timeout: 10000, // Updated timeout
      checks: [
        {
          name: 'memory',
          type: 'memory',
          threshold: 90, // Updated threshold
          critical: true,
          timeout: 10000
        },
        {
          name: 'cpu', // New check
          type: 'cpu',
          threshold: 70,
          critical: false,
          timeout: 5000
        }
      ]
    };

    beforeEach(async () => {
      await healthMonitor.registerAgent(agentId, originalConfig);
    });

    it('should successfully update health check configuration', async () => {
      // Act
      await healthMonitor.updateHealthCheck(agentId, updatedConfig);

      // Assert
      const registeredAgents = (healthMonitor as any).registeredAgents;
      expect(registeredAgents.get(agentId)).toEqual(updatedConfig);
    });

    it('should throw error if agent not registered', async () => {
      // Act & Assert
      await expect(healthMonitor.updateHealthCheck('unknown-agent', updatedConfig))
        .rejects.toThrow('Agent not registered for health monitoring');
    });
  });

  describe('determineHealthStatus', () => {
    it('should return healthy when all checks pass', () => {
      // Arrange
      const checks = [
        { status: 'pass', critical: true },
        { status: 'pass', critical: false },
        { status: 'pass', critical: false }
      ];

      // Act
      const result = (healthMonitor as any).determineHealthStatus(checks);

      // Assert
      expect(result).toBe('healthy');
    });

    it('should return unhealthy when critical checks fail', () => {
      // Arrange
      const checks = [
        { status: 'pass', critical: true },
        { status: 'fail', critical: true }, // Critical failure
        { status: 'pass', critical: false }
      ];

      // Act
      const result = (healthMonitor as any).determineHealthStatus(checks);

      // Assert
      expect(result).toBe('unhealthy');
    });

    it('should return degraded when non-critical checks fail', () => {
      // Arrange
      const checks = [
        { status: 'pass', critical: true },
        { status: 'warn', critical: false }, // Warning
        { status: 'pass', critical: false }
      ];

      // Act
      const result = (healthMonitor as any).determineHealthStatus(checks);

      // Assert
      expect(result).toBe('degraded');
    });

    it('should return unknown when no checks exist', () => {
      // Arrange
      const checks = [];

      // Act
      const result = (healthMonitor as any).determineHealthStatus(checks);

      // Assert
      expect(result).toBe('unknown');
    });
  });

  describe('calculateMetrics', () => {
    const agentId = 'test-agent-id';

    it('should calculate comprehensive health metrics', async () => {
      // Arrange
      const checks = [
        { name: 'memory', type: 'memory', status: 'pass' },
        { name: 'cpu', type: 'cpu', status: 'pass' }
      ];

      // Act
      const metrics = await (healthMonitor as any).calculateMetrics(agentId, checks);

      // Assert
      expect(metrics).toEqual(expect.objectContaining({
        cpu: expect.objectContaining({
          usage: expect.any(Number),
          loadAverage: expect.arrayOfLength(3),
          cores: expect.any(Number)
        }),
        memory: expect.objectContaining({
          used: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number)
        }),
        tasks: expect.objectContaining({
          total: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number),
          successRate: expect.any(Number),
          avgDuration: expect.any(Number)
        }),
        network: expect.objectContaining({
          bytesIn: expect.any(Number),
          bytesOut: expect.any(Number),
          connections: expect.any(Number)
        }),
        performance: expect.objectContaining({
          responseTime: expect.any(Number),
          throughput: expect.any(Number),
          errorRate: expect.any(Number)
        })
      }));
    });
  });

  describe('checkMemoryUsage', () => {
    const agentId = 'test-agent-id';
    const config: HealthCheckDefinition = {
      name: 'memory',
      type: 'memory',
      threshold: 80,
      critical: true,
      timeout: 5000
    };

    it('should pass when memory usage is below threshold', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% usage

      // Act
      const result = await (healthMonitor as any).checkMemoryUsage(agentId, config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Memory usage is normal');
      expect(result.details).toEqual({
        usage: 50,
        threshold: 80
      });
    });

    it('should fail when memory usage exceeds threshold', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // 90% usage

      // Act
      const result = await (healthMonitor as any).checkMemoryUsage(agentId, config);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Memory usage is high: 90.00%');
      expect(result.details).toEqual({
        usage: 90,
        threshold: 80
      });
    });
  });

  describe('checkCPUUsage', () => {
    const agentId = 'test-agent-id';
    const config: HealthCheckDefinition = {
      name: 'cpu',
      type: 'cpu',
      threshold: 70,
      critical: false,
      timeout: 3000
    };

    it('should pass when CPU usage is below threshold', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% usage

      // Act
      const result = await (healthMonitor as any).checkCPUUsage(agentId, config);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('CPU usage is normal');
      expect(result.details).toEqual({
        usage: 50,
        threshold: 70
      });
    });

    it('should fail when CPU usage exceeds threshold', async () => {
      // Arrange
      jest.spyOn(Math, 'random').mockReturnValue(0.8); // 80% usage

      // Act
      const result = await (healthMonitor as any).checkCPUUsage(agentId, config);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('CPU usage is high: 80.00%');
      expect(result.details).toEqual({
        usage: 80,
        threshold: 70
      });
    });
  });

  describe('cleanup', () => {
    const agents = ['agent-1', 'agent-2'];

    beforeEach(async () => {
      for (const agentId of agents) {
        await healthMonitor.registerAgent(agentId, {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          checks: [
            {
              name: 'memory',
              type: 'memory',
              threshold: 80,
              critical: true,
              timeout: 5000
            }
          ]
        });
      }
    });

    it('should cleanup all resources', async () => {
      // Act
      await healthMonitor.cleanup();

      // Assert
      expect((healthMonitor as any).registeredAgents.size).toBe(0);
      expect((healthMonitor as any).healthChecks.size).toBe(0);
      expect((healthMonitor as any).healthHistory.size).toBe(0);
      expect((healthMonitor as any).alerts.size).toBe(0);
    });
  });
});
