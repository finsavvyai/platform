import { logger } from '../utils/logger.js';

export interface ScalingConfig {
  horizontal: {
    enabled: boolean;
    minInstances: number;
    maxInstances: number;
    targetCPUPercent: number;
    targetMemoryPercent: number;
    scaleUpCooldown: number;
    scaleDownCooldown: number;
  };
  loadBalancing: {
    algorithm: 'round-robin' | 'least-connections' | 'ip-hash';
    healthCheckInterval: number;
    healthCheckTimeout: number;
    maxRetries: number;
    retryDelay: number;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringWindow: number;
  };
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
}

export class ScalingManager {
  private config: ScalingConfig;
  private currentInstances = 1;
  private lastScaleAction = 0;
  private circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor() {
    this.config = this.loadScalingConfig();
    this.logScalingConfig();
  }

  private loadScalingConfig(): ScalingConfig {
    return {
      horizontal: {
        enabled: process.env.HORIZONTAL_SCALING_ENABLED === 'true',
        minInstances: parseInt(process.env.MIN_INSTANCES || '1'),
        maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
        targetCPUPercent: parseInt(process.env.TARGET_CPU_PERCENT || '70'),
        targetMemoryPercent: parseInt(process.env.TARGET_MEMORY_PERCENT || '80'),
        scaleUpCooldown: parseInt(process.env.SCALE_UP_COOLDOWN || '300000'), // 5 minutes
        scaleDownCooldown: parseInt(process.env.SCALE_DOWN_COOLDOWN || '600000') // 10 minutes
      },
      loadBalancing: {
        algorithm: (process.env.LOAD_BALANCING_ALGORITHM as any) || 'round-robin',
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
        healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '10000'),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.RETRY_DELAY || '1000')
      },
      circuitBreaker: {
        enabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
        failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
        recoveryTimeout: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT || '60000'),
        monitoringWindow: parseInt(process.env.CIRCUIT_BREAKER_MONITORING_WINDOW || '300000')
      },
      rateLimiting: {
        enabled: process.env.RATE_LIMITING_ENABLED !== 'false', // Enabled by default
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '1000'),
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
        skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
      }
    };
  }

  /**
   * Get current scaling configuration
   */
  getConfig(): ScalingConfig {
    return { ...this.config };
  }

  /**
   * Check if scaling should occur based on current metrics
   */
  shouldScale(metrics: {
    cpuPercent: number;
    memoryPercent: number;
    requestRate: number;
    errorRate: number;
  }): 'up' | 'down' | 'none' {
    if (!this.config.horizontal.enabled) {
      return 'none';
    }

    const now = Date.now();
    const { horizontal } = this.config;

    // Check cooldown periods
    const timeSinceLastScale = now - this.lastScaleAction;
    
    // Scale up conditions
    const shouldScaleUp = (
      metrics.cpuPercent > horizontal.targetCPUPercent ||
      metrics.memoryPercent > horizontal.targetMemoryPercent
    ) && this.currentInstances < horizontal.maxInstances;

    if (shouldScaleUp && timeSinceLastScale > horizontal.scaleUpCooldown) {
      return 'up';
    }

    // Scale down conditions
    const shouldScaleDown = (
      metrics.cpuPercent < horizontal.targetCPUPercent * 0.5 &&
      metrics.memoryPercent < horizontal.targetMemoryPercent * 0.5 &&
      metrics.errorRate < 1 // Low error rate
    ) && this.currentInstances > horizontal.minInstances;

    if (shouldScaleDown && timeSinceLastScale > horizontal.scaleDownCooldown) {
      return 'down';
    }

    return 'none';
  }

  /**
   * Execute scaling action
   */
  async executeScaling(action: 'up' | 'down'): Promise<boolean> {
    try {
      const previousInstances = this.currentInstances;

      if (action === 'up' && this.currentInstances < this.config.horizontal.maxInstances) {
        this.currentInstances++;
        logger.info(`Scaling up: ${previousInstances} -> ${this.currentInstances} instances`);
      } else if (action === 'down' && this.currentInstances > this.config.horizontal.minInstances) {
        this.currentInstances--;
        logger.info(`Scaling down: ${previousInstances} -> ${this.currentInstances} instances`);
      } else {
        return false;
      }

      this.lastScaleAction = Date.now();

      // In a real implementation, this would trigger actual scaling
      // For Render, this would be handled by their auto-scaling features
      // This is more for monitoring and decision making

      return true;
    } catch (error) {
      logger.error('Failed to execute scaling action:', error);
      return false;
    }
  }

  /**
   * Get rate limiting configuration for Express
   */
  getRateLimitConfig() {
    if (!this.config.rateLimiting.enabled) {
      return null;
    }

    return {
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      skipSuccessfulRequests: this.config.rateLimiting.skipSuccessfulRequests,
      skipFailedRequests: this.config.rateLimiting.skipFailedRequests,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(this.config.rateLimiting.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false
    };
  }

  /**
   * Circuit breaker check
   */
  isCircuitBreakerOpen(): boolean {
    if (!this.config.circuitBreaker.enabled) {
      return false;
    }

    const now = Date.now();
    const { circuitBreaker } = this.config;

    switch (this.circuitBreakerState) {
      case 'closed':
        return false;

      case 'open':
        // Check if recovery timeout has passed
        if (now - this.lastFailureTime > circuitBreaker.recoveryTimeout) {
          this.circuitBreakerState = 'half-open';
          logger.info('Circuit breaker moved to half-open state');
          return false;
        }
        return true;

      case 'half-open':
        return false;

      default:
        return false;
    }
  }

  /**
   * Record a failure for circuit breaker
   */
  recordFailure(): void {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    const now = Date.now();
    const { circuitBreaker } = this.config;

    this.failureCount++;
    this.lastFailureTime = now;

    // Reset failure count if outside monitoring window
    if (now - this.lastFailureTime > circuitBreaker.monitoringWindow) {
      this.failureCount = 1;
    }

    // Open circuit breaker if failure threshold exceeded
    if (this.failureCount >= circuitBreaker.failureThreshold) {
      this.circuitBreakerState = 'open';
      logger.warn(`Circuit breaker opened after ${this.failureCount} failures`);
    }
  }

  /**
   * Record a success for circuit breaker
   */
  recordSuccess(): void {
    if (!this.config.circuitBreaker.enabled) {
      return;
    }

    if (this.circuitBreakerState === 'half-open') {
      this.circuitBreakerState = 'closed';
      this.failureCount = 0;
      logger.info('Circuit breaker closed after successful request');
    }
  }

  /**
   * Get current scaling status
   */
  getScalingStatus() {
    return {
      currentInstances: this.currentInstances,
      minInstances: this.config.horizontal.minInstances,
      maxInstances: this.config.horizontal.maxInstances,
      lastScaleAction: this.lastScaleAction,
      circuitBreakerState: this.circuitBreakerState,
      failureCount: this.failureCount,
      scalingEnabled: this.config.horizontal.enabled,
      rateLimitingEnabled: this.config.rateLimiting.enabled,
      circuitBreakerEnabled: this.config.circuitBreaker.enabled
    };
  }

  /**
   * Create middleware for circuit breaker
   */
  createCircuitBreakerMiddleware() {
    return (req: any, res: any, next: any) => {
      if (this.isCircuitBreakerOpen()) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          message: 'Circuit breaker is open. Please try again later.',
          retryAfter: Math.ceil(this.config.circuitBreaker.recoveryTimeout / 1000)
        });
      }

      // Override res.end to record success/failure
      const originalEnd = res.end;
      res.end = (...args: any[]) => {
        if (res.statusCode >= 500) {
          this.recordFailure();
        } else {
          this.recordSuccess();
        }
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  private logScalingConfig(): void {
    logger.info('Scaling configuration loaded:', {
      horizontalScaling: this.config.horizontal.enabled,
      minInstances: this.config.horizontal.minInstances,
      maxInstances: this.config.horizontal.maxInstances,
      rateLimiting: this.config.rateLimiting.enabled,
      circuitBreaker: this.config.circuitBreaker.enabled,
      loadBalancing: this.config.loadBalancing.algorithm
    });
  }
}

// Export singleton instance
export const scalingManager = new ScalingManager();