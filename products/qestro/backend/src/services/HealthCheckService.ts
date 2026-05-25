import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { checkDatabaseHealth } from '../lib/db.js';
import Redis from 'redis';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  details?: any;
  timestamp: Date;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  services: HealthCheckResult[];
  uptime: number;
  version: string;
  environment: string;
  timestamp: Date;
}

export class HealthCheckService extends EventEmitter {
  private healthChecks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private lastHealthStatus: SystemHealthStatus | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private redisClient: any = null;

  constructor() {
    super();
    this.setupDefaultHealthChecks();
  }

  /**
   * Setup default health checks for core services
   */
  private setupDefaultHealthChecks(): void {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // Database health check
    this.registerHealthCheck('database', async () => {
      const startTime = Date.now();
      try {
        const isHealthy = await checkDatabaseHealth();
        const responseTime = Date.now() - startTime;

        return {
          service: 'database',
          status: isHealthy ? 'healthy' : (isDevelopment ? 'degraded' : 'unhealthy'),
          responseTime,
          details: {
            connectionPool: isHealthy ? 'active' : 'unavailable',
            queryTime: responseTime,
            environment: isDevelopment ? 'development' : 'production'
          },
          timestamp: new Date()
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        if (!isDevelopment) {
          logger.error('Database health check failed:', error);
        }

        // In development, database failure is degraded, not unhealthy
        return {
          service: 'database',
          status: isDevelopment ? 'degraded' : 'unhealthy',
          responseTime,
          details: {
            error: error.message,
            connectionPool: 'failed',
            note: isDevelopment ? 'Database not required for local development' : undefined
          },
          timestamp: new Date()
        };
      }
    });

    // Redis health check
    this.registerHealthCheck('redis', async () => {
      const startTime = Date.now();
      try {
        const redisUrl = process.env.REDIS_URL;

        // In development without Redis URL, just mark as degraded (not required)
        if (!redisUrl) {
          return {
            service: 'redis',
            status: isDevelopment ? 'degraded' : 'unhealthy',
            responseTime: Date.now() - startTime,
            details: {
              configured: false,
              message: isDevelopment
                ? 'Redis not configured - optional for local development'
                : 'Redis URL not configured'
            },
            timestamp: new Date()
          };
        }

        if (!this.redisClient) {
          this.redisClient = Redis.createClient({ url: redisUrl });
          await this.redisClient.connect();
        }

        const pong = await this.redisClient.ping();
        const responseTime = Date.now() - startTime;

        return {
          service: 'redis',
          status: pong === 'PONG' ? 'healthy' : 'unhealthy',
          responseTime,
          details: {
            response: pong,
            connected: this.redisClient.isReady
          },
          timestamp: new Date()
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        if (!isDevelopment) {
          logger.error('Redis health check failed:', error);
        }

        return {
          service: 'redis',
          status: isDevelopment ? 'degraded' : 'unhealthy',
          responseTime,
          details: {
            error: error.message,
            connected: false,
            note: isDevelopment ? 'Redis not required for local development' : undefined
          },
          timestamp: new Date()
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const startTime = Date.now();
      try {
        const memUsage = process.memoryUsage();
        const totalMem = memUsage.heapTotal;
        const usedMem = memUsage.heapUsed;
        const memoryUsagePercent = (usedMem / totalMem) * 100;
        const responseTime = Date.now() - startTime;

        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        if (memoryUsagePercent > 90) {
          status = 'unhealthy';
        } else if (memoryUsagePercent > 75) {
          status = 'degraded';
        }

        return {
          service: 'memory',
          status,
          responseTime,
          details: {
            heapUsed: Math.round(usedMem / 1024 / 1024),
            heapTotal: Math.round(totalMem / 1024 / 1024),
            usagePercent: Math.round(memoryUsagePercent),
            external: Math.round(memUsage.external / 1024 / 1024),
            rss: Math.round(memUsage.rss / 1024 / 1024)
          },
          timestamp: new Date()
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error('Memory health check failed:', error);

        return {
          service: 'memory',
          status: 'unhealthy',
          responseTime,
          details: {
            error: error.message
          },
          timestamp: new Date()
        };
      }
    });

    // External API health check (OpenAI)
    this.registerHealthCheck('openai', async () => {
      const startTime = Date.now();
      try {
        if (!process.env.OPENAI_API_KEY) {
          return {
            service: 'openai',
            status: 'degraded',
            responseTime: Date.now() - startTime,
            details: {
              configured: false,
              message: 'API key not configured'
            },
            timestamp: new Date()
          };
        }

        // Simple API check - just verify the key format
        const apiKey = process.env.OPENAI_API_KEY;
        const isValidFormat = apiKey.startsWith('sk-') && apiKey.length > 20;
        const responseTime = Date.now() - startTime;

        return {
          service: 'openai',
          status: isValidFormat ? 'healthy' : 'degraded',
          responseTime,
          details: {
            configured: true,
            keyFormat: isValidFormat ? 'valid' : 'invalid'
          },
          timestamp: new Date()
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error('OpenAI health check failed:', error);

        return {
          service: 'openai',
          status: 'unhealthy',
          responseTime,
          details: {
            error: error.message
          },
          timestamp: new Date()
        };
      }
    });

    // File system health check
    this.registerHealthCheck('filesystem', async () => {
      const startTime = Date.now();
      try {
        const fs = await import('fs/promises');
        const path = await import('path');

        // Check if we can write to temp directory
        const tempFile = path.join('/tmp', `health-check-${Date.now()}.txt`);
        await fs.writeFile(tempFile, 'health check');
        await fs.unlink(tempFile);

        const responseTime = Date.now() - startTime;

        return {
          service: 'filesystem',
          status: 'healthy',
          responseTime,
          details: {
            writable: true,
            tempDir: '/tmp'
          },
          timestamp: new Date()
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error('Filesystem health check failed:', error);

        return {
          service: 'filesystem',
          status: 'unhealthy',
          responseTime,
          details: {
            error: error.message,
            writable: false
          },
          timestamp: new Date()
        };
      }
    });
  }

  /**
   * Register a custom health check
   */
  public registerHealthCheck(
    name: string,
    checkFunction: () => Promise<HealthCheckResult>
  ): void {
    this.healthChecks.set(name, checkFunction);
    logger.info(`Health check registered: ${name}`);
  }

  /**
   * Remove a health check
   */
  public unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    logger.info(`Health check unregistered: ${name}`);
  }

  /**
   * Run all health checks and return system status
   */
  public async checkSystemHealth(): Promise<SystemHealthStatus> {
    const startTime = Date.now();
    const results: HealthCheckResult[] = [];

    // Run all health checks in parallel
    const healthCheckPromises = Array.from(this.healthChecks.entries()).map(
      async ([name, checkFn]) => {
        try {
          return await checkFn();
        } catch (error) {
          logger.error(`Health check ${name} threw an error:`, error);
          return {
            service: name,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            details: {
              error: error.message
            },
            timestamp: new Date()
          };
        }
      }
    );

    const healthResults = await Promise.all(healthCheckPromises);
    results.push(...healthResults);

    // Determine overall system health
    const unhealthyServices = results.filter(r => r.status === 'unhealthy');
    const degradedServices = results.filter(r => r.status === 'degraded');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const systemHealth: SystemHealthStatus = {
      overall: overallStatus,
      services: results,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date()
    };

    this.lastHealthStatus = systemHealth;

    // Emit health status change events
    if (overallStatus !== 'healthy') {
      this.emit('healthStatusChanged', systemHealth);
      if (overallStatus === 'unhealthy') {
        this.emit('systemUnhealthy', systemHealth);
      }
    }

    return systemHealth;
  }

  /**
   * Get the last health check result
   */
  public getLastHealthStatus(): SystemHealthStatus | null {
    return this.lastHealthStatus;
  }

  /**
   * Start periodic health monitoring
   */
  public startHealthMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkSystemHealth();
      } catch (error) {
        logger.error('Periodic health check failed:', error);
      }
    }, intervalMs);

    logger.info(`Health monitoring started with ${intervalMs}ms interval`);
  }

  /**
   * Stop periodic health monitoring
   */
  public stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Health monitoring stopped');
    }
  }

  /**
   * Get health check for a specific service
   */
  public async checkServiceHealth(serviceName: string): Promise<HealthCheckResult | null> {
    const checkFn = this.healthChecks.get(serviceName);
    if (!checkFn) {
      return null;
    }

    try {
      return await checkFn();
    } catch (error) {
      logger.error(`Health check for ${serviceName} failed:`, error);
      return {
        service: serviceName,
        status: 'unhealthy',
        responseTime: 0,
        details: {
          error: error.message
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    this.stopHealthMonitoring();

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch (error) {
        logger.error('Error closing Redis connection:', error);
      }
    }
  }

  /**
   * Check if overall system is healthy
   */
  public async isHealthy(): Promise<boolean> {
    const status = await this.checkSystemHealth();
    return status.overall === 'healthy';
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();