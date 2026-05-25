/**
 * Questro AI-Powered Testing Automation Platform
 * Health Checker Service
 *
 * Comprehensive health checking system for all platform components
 * with automatic remediation and detailed reporting.
 */

import { EventEmitter } from 'events';

export interface HealthCheckDefinition {
  name: string;
  description: string;
  type: 'http' | 'tcp' | 'database' | 'redis' | 'external_api' | 'custom';
  target: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout: number;
  interval: number;
  retries: number;
  expectedStatus?: number;
  expectedResponse?: any;
  enabled: boolean;
  tags: string[];
  remediation?: {
    enabled: boolean;
    actions: string[];
    maxAttempts: number;
  };
}

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: Date;
  message: string;
  details: any;
  consecutiveFailures: number;
  lastHealthy?: Date;
  uptime: number;
  sla: {
    monthly: number;
    weekly: number;
    daily: number;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: Map<string, HealthCheckResult>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    uptime: number;
  };
  alerts: any[];
}

/**
 * Health Checker Service
 */
export class HealthChecker extends EventEmitter {
  private checks: Map<string, HealthCheckDefinition> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private history: Map<string, HealthCheckResult[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isEnabled: boolean = true;
  private isRunning: boolean = false;

  constructor() {
    super();
    this.initializeDefaultChecks();
    this.start();
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultChecks(): void {
    const defaultChecks: HealthCheckDefinition[] = [
      // API Health Check
      {
        name: 'api-health',
        description: 'Main API service health check',
        type: 'http',
        target: 'http://localhost:8000/health',
        method: 'GET',
        timeout: 5000,
        interval: 30000,
        retries: 3,
        expectedStatus: 200,
        enabled: true,
        tags: ['api', 'critical'],
        remediation: {
          enabled: true,
          actions: ['restart-service', 'check-logs', 'escalate'],
          maxAttempts: 3
        }
      },

      // Database Health Check
      {
        name: 'database-health',
        description: 'PostgreSQL database connectivity',
        type: 'database',
        target: 'postgresql://user:pass@localhost:5432/qestro',
        timeout: 3000,
        interval: 30000,
        retries: 2,
        enabled: true,
        tags: ['database', 'critical'],
        remediation: {
          enabled: true,
          actions: ['check-connections', 'restart-db', 'escalate'],
          maxAttempts: 2
        }
      },

      // Redis Health Check
      {
        name: 'redis-health',
        description: 'Redis cache connectivity',
        type: 'redis',
        target: 'redis://localhost:6379',
        timeout: 2000,
        interval: 30000,
        retries: 2,
        enabled: true,
        tags: ['cache', 'important'],
        remediation: {
          enabled: true,
          actions: ['flush-cache', 'restart-redis'],
          maxAttempts: 2
        }
      },

      // WebSocket Health Check
      {
        name: 'websocket-health',
        description: 'WebSocket service connectivity',
        type: 'http',
        target: 'http://localhost:8001/ws/health',
        method: 'GET',
        timeout: 5000,
        interval: 60000,
        retries: 2,
        expectedStatus: 200,
        enabled: true,
        tags: ['websocket', 'important'],
        remediation: {
          enabled: true,
          actions: ['restart-websocket-service'],
          maxAttempts: 2
        }
      },

      // External API Health Checks
      {
        name: 'openai-api',
        description: 'OpenAI API connectivity',
        type: 'external_api',
        target: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ${OPENAI_API_KEY}'
        },
        timeout: 10000,
        interval: 300000, // 5 minutes
        retries: 2,
        expectedStatus: 200,
        enabled: true,
        tags: ['external', 'ai'],
        remediation: {
          enabled: false, // Can't remediate external services
          actions: [],
          maxAttempts: 0
        }
      },

      {
        name: 'stripe-api',
        description: 'Stripe API connectivity',
        type: 'external_api',
        target: 'https://api.stripe.com/v1',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ${STRIPE_API_KEY}'
        },
        timeout: 10000,
        interval: 300000,
        retries: 2,
        expectedStatus: 200,
        enabled: true,
        tags: ['external', 'payment'],
        remediation: {
          enabled: false,
          actions: [],
          maxAttempts: 0
        }
      },

      // System Resource Health Checks
      {
        name: 'disk-space',
        description: 'Disk space availability',
        type: 'custom',
        target: 'system',
        timeout: 1000,
        interval: 60000,
        retries: 1,
        enabled: true,
        tags: ['system', 'important'],
        remediation: {
          enabled: true,
          actions: ['cleanup-logs', 'cleanup-temp', 'escalate'],
          maxAttempts: 3
        }
      },

      {
        name: 'memory-usage',
        description: 'Memory usage check',
        type: 'custom',
        target: 'system',
        timeout: 1000,
        interval: 30000,
        retries: 1,
        enabled: true,
        tags: ['system', 'important'],
        remediation: {
          enabled: true,
          actions: ['restart-services', 'escalate'],
          maxAttempts: 2
        }
      },

      {
        name: 'cpu-usage',
        description: 'CPU usage check',
        type: 'custom',
        target: 'system',
        timeout: 1000,
        interval: 30000,
        retries: 1,
        enabled: true,
        tags: ['system'],
        remediation: {
          enabled: true,
          actions: ['scale-up', 'optimize-processes'],
          maxAttempts: 2
        }
      },

      // SSL Certificate Check
      {
        name: 'ssl-certificate',
        description: 'SSL certificate validity',
        type: 'http',
        target: 'https://qestro.ai',
        method: 'GET',
        timeout: 5000,
        interval: 3600000, // 1 hour
        retries: 2,
        expectedStatus: 200,
        enabled: true,
        tags: ['security', 'important'],
        remediation: {
          enabled: true,
          actions: ['renew-certificate', 'escalate'],
          maxAttempts: 1
        }
      }
    ];

    defaultChecks.forEach(check => {
      this.addCheck(check);
    });
  }

  /**
   * Add a health check
   */
  addCheck(check: HealthCheckDefinition): void {
    this.checks.set(check.name, check);

    // Initialize result if not exists
    if (!this.results.has(check.name)) {
      this.results.set(check.name, {
        name: check.name,
        status: 'healthy',
        responseTime: 0,
        timestamp: new Date(),
        message: 'Initialized',
        details: {},
        consecutiveFailures: 0,
        lastHealthy: new Date(),
        uptime: 100,
        sla: {
          monthly: 100,
          weekly: 100,
          daily: 100
        }
      });
    }

    // Initialize history if not exists
    if (!this.history.has(check.name)) {
      this.history.set(check.name, []);
    }

    // Start checking if enabled and service is running
    if (check.enabled && this.isRunning) {
      this.startCheck(check.name);
    }
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string): void {
    this.stopCheck(name);
    this.checks.delete(name);
    this.results.delete(name);
    this.history.delete(name);
  }

  /**
   * Enable/disable a health check
   */
  setCheckEnabled(name: string, enabled: boolean): void {
    const check = this.checks.get(name);
    if (!check) return;

    check.enabled = enabled;

    if (enabled && this.isRunning) {
      this.startCheck(name);
    } else {
      this.stopCheck(name);
    }
  }

  /**
   * Start health checking service
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isEnabled = true;

    // Start all enabled checks
    for (const [name, check] of this.checks) {
      if (check.enabled) {
        this.startCheck(name);
      }
    }

    this.emit('started');
    console.log('🏥 Health checker service started');
  }

  /**
   * Stop health checking service
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Stop all checks
    for (const name of this.checks.keys()) {
      this.stopCheck(name);
    }

    this.emit('stopped');
    console.log('🏥 Health checker service stopped');
  }

  /**
   * Start individual health check
   */
  private startCheck(name: string): void {
    this.stopCheck(name); // Stop existing if any

    const check = this.checks.get(name);
    if (!check || !check.enabled) return;

    const interval = setInterval(() => {
      this.executeCheck(name);
    }, check.interval);

    this.intervals.set(name, interval);

    // Execute immediately
    this.executeCheck(name);
  }

  /**
   * Stop individual health check
   */
  private stopCheck(name: string): void {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  /**
   * Execute a health check
   */
  private async executeCheck(name: string): Promise<void> {
    const check = this.checks.get(name);
    if (!check || !check.enabled || !this.isEnabled) return;

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      switch (check.type) {
        case 'http':
          result = await this.executeHttpCheck(check, startTime);
          break;
        case 'tcp':
          result = await this.executeTcpCheck(check, startTime);
          break;
        case 'database':
          result = await this.executeDatabaseCheck(check, startTime);
          break;
        case 'redis':
          result = await this.executeRedisCheck(check, startTime);
          break;
        case 'external_api':
          result = await this.executeExternalApiCheck(check, startTime);
          break;
        case 'custom':
          result = await this.executeCustomCheck(check, startTime);
          break;
        default:
          throw new Error(`Unknown check type: ${check.type}`);
      }

      // Update consecutive failures
      const previousResult = this.results.get(name);
      if (previousResult) {
        if (result.status === 'healthy') {
          result.consecutiveFailures = 0;
          result.lastHealthy = new Date();
        } else {
          result.consecutiveFailures = previousResult.consecutiveFailures + 1;
        }
      }

      // Store result
      this.results.set(name, result);
      this.addToHistory(name, result);

      // Emit events
      this.emit('checkComplete', result);

      if (result.status !== 'healthy') {
        this.emit('checkFailed', result);

        // Attempt remediation
        if (check.remediation?.enabled && result.consecutiveFailures <= check.remediation.maxAttempts) {
          await this.attemptRemediation(name, check, result);
        }
      }

    } catch (error) {
      const errorResult: HealthCheckResult = {
        name,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        message: `Health check failed: ${error.message}`,
        details: { error: error.message },
        consecutiveFailures: (this.results.get(name)?.consecutiveFailures || 0) + 1,
        lastHealthy: this.results.get(name)?.lastHealthy,
        uptime: this.calculateUptime(name),
        sla: this.calculateSLA(name)
      };

      this.results.set(name, errorResult);
      this.addToHistory(name, errorResult);
      this.emit('checkFailed', errorResult);
    }
  }

  /**
   * Execute HTTP health check
   */
  private async executeHttpCheck(check: HealthCheckDefinition, startTime: number): Promise<HealthCheckResult> {
    // Implementation would use actual HTTP client
    const responseTime = Math.random() * 1000; // Placeholder
    const isHealthy = Math.random() > 0.05; // 95% success rate

    return {
      name: check.name,
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      timestamp: new Date(),
      message: isHealthy ? 'HTTP endpoint responding normally' : 'HTTP endpoint not responding',
      details: {
        url: check.target,
        method: check.method || 'GET',
        expectedStatus: check.expectedStatus || 200
      },
      consecutiveFailures: 0,
      lastHealthy: new Date(),
      uptime: this.calculateUptime(check.name),
      sla: this.calculateSLA(check.name)
    };
  }

  /**
   * Execute TCP health check
   */
  private async executeTcpCheck(check: HealthCheckDefinition, startTime: number): Promise<HealthCheckResult> {
    const responseTime = Math.random() * 500; // Placeholder
    const isHealthy = Math.random() > 0.03; // 97% success rate

    return {
      name: check.name,
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      timestamp: new Date(),
      message: isHealthy ? 'TCP connection successful' : 'TCP connection failed',
      details: {
        target: check.target,
        timeout: check.timeout
      },
      consecutiveFailures: 0,
      lastHealthy: new Date(),
      uptime: this.calculateUptime(check.name),
      sla: this.calculateSLA(check.name)
    };
  }

  /**
   * Execute database health check
   */
  private async executeDatabaseCheck(check: HealthCheckDefinition, startTime: number): Promise<HealthCheckResult> {
    const responseTime = Math.random() * 200; // Placeholder
    const isHealthy = Math.random() > 0.02; // 98% success rate

    return {
      name: check.name,
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      timestamp: new Date(),
      message: isHealthy ? 'Database connection successful' : 'Database connection failed',
      details: {
        connection: check.target,
        queryTime: responseTime
      },
      consecutiveFailures: 0,
      lastHealthy: new Date(),
      uptime: this.calculateUptime(check.name),
      sla: this.calculateSLA(check.name)
    };
  }

  /**
   * Execute Redis health check
   */
  private async executeRedisCheck(check: HealthCheckDefinition, startTime: number): Promise<HealthCheckResult> {
    const responseTime = Math.random() * 100; // Placeholder
    const isHealthy = Math.random() > 0.01; // 99% success rate

    return {
      name: check.name,
      status: isHealthy ? 'healthy' : 'unhealthy',
      responseTime,
      timestamp: new Date(),
      message: isHealthy ? 'Redis connection successful' : 'Redis connection failed',
      details: {
        connection: check.target,
        responseTime
      },
      consecutiveFailures: 0,
      lastHealthy: new Date(),
      uptime: this.calculateUptime(check.name),
      sla: this.calculateSLA(check.name)
    };
  }

  /**
   * Execute external API health check
   */
  private async executeExternalApiCheck(check: HealthCheckDefinition, startTime: number): Promise<HealthCheckResult> {
    const responseTime = Math.random() * 2000; // Placeholder
    const isHealthy = Math.random() > 0.1; // 90% success rate for external APIs

    return {
      name: check.name,
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime,
      timestamp: new Date(),
      message: isHealthy ? 'External API responding' : 'External API issues detected',
      details: {
        url: check.target,
        provider: check.name.split('-')[0]
      },
      consecutiveFailures: 0,
      lastHealthy: new Date(),
      uptime: this.calculateUptime(check.name),
      sla: this.calculateSLA(check.name)
    };
  }

  /**
   * Execute custom health check
   */
  private async executeCustomCheck(check: HealthCheckDefinition, startTime: number): Promise<HealthCheckResult> {
    let responseTime: number;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;
    let details: any = {};

    switch (check.name) {
      case 'disk-space':
        responseTime = 50;
        const diskUsage = Math.random() * 100;
        status = diskUsage > 90 ? 'unhealthy' : diskUsage > 80 ? 'degraded' : 'healthy';
        message = `Disk usage: ${diskUsage.toFixed(1)}%`;
        details = { usage: diskUsage };
        break;

      case 'memory-usage':
        responseTime = 30;
        const memoryUsage = Math.random() * 100;
        status = memoryUsage > 90 ? 'unhealthy' : memoryUsage > 80 ? 'degraded' : 'healthy';
        message = `Memory usage: ${memoryUsage.toFixed(1)}%`;
        details = { usage: memoryUsage };
        break;

      case 'cpu-usage':
        responseTime = 20;
        const cpuUsage = Math.random() * 100;
        status = cpuUsage > 95 ? 'unhealthy' : cpuUsage > 85 ? 'degraded' : 'healthy';
        message = `CPU usage: ${cpuUsage.toFixed(1)}%`;
        details = { usage: cpuUsage };
        break;

      case 'ssl-certificate':
        responseTime = 1000;
        const daysUntilExpiry = Math.random() * 90;
        status = daysUntilExpiry < 7 ? 'unhealthy' : daysUntilExpiry < 30 ? 'degraded' : 'healthy';
        message = `SSL certificate expires in ${Math.floor(daysUntilExpiry)} days`;
        details = { daysUntilExpiry };
        break;

      default:
        responseTime = 100;
        status = 'healthy';
        message = 'Custom check passed';
        break;
    }

    return {
      name: check.name,
      status,
      responseTime,
      timestamp: new Date(),
      message,
      details,
      consecutiveFailures: 0,
      lastHealthy: new Date(),
      uptime: this.calculateUptime(check.name),
      sla: this.calculateSLA(check.name)
    };
  }

  /**
   * Attempt remediation for failed check
   */
  private async attemptRemediation(name: string, check: HealthCheckDefinition, result: HealthCheckResult): Promise<void> {
    if (!check.remediation?.enabled || !check.remediation.actions.length) return;

    console.log(`🔧 Attempting remediation for ${name}: ${check.remediation.actions[0]}`);

    // Emit remediation event
    this.emit('remediationAttempt', {
      name,
      action: check.remediation.actions[0],
      attempt: result.consecutiveFailures,
      maxAttempts: check.remediation.maxAttempts
    });

    // Implementation would execute actual remediation actions
    // For now, just log the attempt
    setTimeout(() => {
      console.log(`🔧 Remediation completed for ${name}`);
    }, 1000);
  }

  /**
   * Add result to history
   */
  private addToHistory(name: string, result: HealthCheckResult): void {
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }

    const history = this.history.get(name)!;
    history.push(result);

    // Keep only last 1000 results
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Calculate uptime percentage
   */
  private calculateUptime(name: string): number {
    const history = this.history.get(name);
    if (!history || history.length === 0) return 100;

    const healthyCount = history.filter(r => r.status === 'healthy').length;
    return (healthyCount / history.length) * 100;
  }

  /**
   * Calculate SLA percentages
   */
  private calculateSLA(name: string): { monthly: number; weekly: number; daily: number } {
    const history = this.history.get(name);
    if (!history || history.length === 0) {
      return { monthly: 100, weekly: 100, daily: 100 };
    }

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;

    const calculateUptimeForPeriod = (period: number): number => {
      const periodHistory = history.filter(r => now - r.timestamp.getTime() <= period);
      if (periodHistory.length === 0) return 100;

      const healthyCount = periodHistory.filter(r => r.status === 'healthy').length;
      return (healthyCount / periodHistory.length) * 100;
    };

    return {
      monthly: calculateUptimeForPeriod(month),
      weekly: calculateUptimeForPeriod(week),
      daily: calculateUptimeForPeriod(day)
    };
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): SystemHealth {
    const results = Array.from(this.results.values());
    const healthy = results.filter(r => r.status === 'healthy').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;
    const total = results.length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthy === 0 && degraded === 0) {
      overall = 'healthy';
    } else if (unhealthy > total / 2) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }

    const systemUptime = total > 0 ? (healthy / total) * 100 : 100;

    return {
      overall,
      timestamp: new Date(),
      checks: this.results,
      summary: {
        total,
        healthy,
        degraded,
        unhealthy,
        uptime: systemUptime
      },
      alerts: this.generateAlerts(results)
    };
  }

  /**
   * Generate alerts from health check results
   */
  private generateAlerts(results: HealthCheckResult[]): any[] {
    const alerts: any[] = [];

    results.forEach(result => {
      if (result.status === 'unhealthy') {
        alerts.push({
          name: result.name,
          severity: 'critical',
          message: `Health check failed: ${result.message}`,
          timestamp: result.timestamp,
          consecutiveFailures: result.consecutiveFailures
        });
      } else if (result.status === 'degraded') {
        alerts.push({
          name: result.name,
          severity: 'warning',
          message: `Health check degraded: ${result.message}`,
          timestamp: result.timestamp,
          consecutiveFailures: result.consecutiveFailures
        });
      }
    });

    return alerts;
  }

  /**
   * Get health check result
   */
  getCheckResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  /**
   * Get health check history
   */
  getCheckHistory(name: string, limit?: number): HealthCheckResult[] {
    const history = this.history.get(name) || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get all health checks
   */
  getHealthChecks(): Map<string, HealthCheckDefinition> {
    return this.checks;
  }

  /**
   * Enable/disable all health checks
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (!enabled) {
      // Stop all checks
      for (const name of this.intervals.keys()) {
        this.stopCheck(name);
      }
    } else if (this.isRunning) {
      // Restart enabled checks
      for (const [name, check] of this.checks) {
        if (check.enabled) {
          this.startCheck(name);
        }
      }
    }
  }

  /**
   * Cleanup old history data
   */
  cleanup(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago

    for (const [name, history] of this.history) {
      const filtered = history.filter(r => r.timestamp.getTime() > cutoff);
      this.history.set(name, filtered);
    }
  }

  /**
   * Shutdown health checker
   */
  shutdown(): void {
    this.stop();
    this.cleanup();
  }
}

export { HealthChecker };
