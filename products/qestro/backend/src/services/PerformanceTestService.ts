import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import OpenAI from 'openai';
import { subscriptionService } from './SubscriptionService';
import { logger } from '../utils/logger';

export interface PerformanceTestConfig {
  userId: string;
  name: string;
  type: 'load' | 'stress' | 'spike' | 'endurance' | 'volume';
  users: number;
  rampUpTime: number; // seconds
  duration: number; // minutes
  regions?: string[];
  protocols?: string[];
  targets: TestTarget[];
  scenarios?: PerformanceScenario[];
  thresholds: PerformanceThresholds;
  generateScenarios?: boolean;
}

export interface TestTarget {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  weight: number; // percentage of traffic
}

export interface PerformanceScenario {
  name: string;
  description: string;
  userPercentage: number;
  actions: ScenarioAction[];
  thinkTime: number; // milliseconds between actions
}

export interface ScenarioAction {
  type: 'http_request' | 'wait' | 'javascript' | 'form_submit';
  target?: string;
  method?: string;
  data?: any;
  validation?: any[];
}

export interface PerformanceThresholds {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: number; // requests per second
  errorRate: number; // percentage
  availability: number; // percentage
}

export interface PerformanceExecution {
  id: string;
  testId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  metrics: PerformanceMetrics;
  regions: string[];
  scenarios: PerformanceScenario[];
  violations: ThresholdViolation[];
}

export interface PerformanceMetrics {
  activeUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  errorRate: number;
  responseTime: {
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  bytesReceived: number;
  bytesSent: number;
  systemMetrics?: {
    cpu: number;
    memory: number;
    network: number;
    disk: number;
  };
}

export class PerformanceTestService extends EventEmitter {
  private openAIClient: OpenAI;
  private activeExecutions: Map<string, PerformanceExecution> = new Map();
  private loadGenerators: Map<string, Worker[]> = new Map();
  private metricsCollectors: Map<string, NodeJS.Timer> = new Map();

  constructor() {
    super();
    
    this.openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async createPerformanceTest(config: PerformanceTestConfig): Promise<{ testId: string; estimatedCost: number }> {
    try {
      // Validate performance testing limits
      const canCreateTest = await this.validatePerformanceTestLimits(config.userId, config);
      if (!canCreateTest.allowed) {
        throw new Error(canCreateTest.reason);
      }

      // Generate AI-powered scenarios if requested
      if (config.generateScenarios) {
        config.scenarios = await this.generatePerformanceScenarios(config);
      }

      const testId = `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate estimated cost
      const estimatedCost = this.calculateTestCost(config);

      // Store test configuration
      await this.storeTestConfiguration(testId, config);

      this.emit('performance:test:created', { 
        testId, 
        userId: config.userId, 
        config, 
        estimatedCost 
      });

      logger.info(`Created performance test ${testId} for user ${config.userId}`);

      return { testId, estimatedCost };
    } catch (error) {
      logger.error(`Failed to create performance test: ${error}`);
      throw new Error(`Failed to create performance test: ${error.message}`);
    }
  }

  async executePerformanceTest(testId: string, userId: string): Promise<PerformanceExecution> {
    try {
      const testConfig = await this.getTestConfiguration(testId, userId);
      
      // Check execution limits
      const canExecute = await subscriptionService.hasUsageRemaining(userId, 'execution');
      if (!canExecute) {
        throw new Error('Performance test execution limit exceeded for current plan');
      }

      const execution: PerformanceExecution = {
        id: `exec_${Date.now()}`,
        testId,
        userId,
        startedAt: new Date(),
        status: 'running',
        metrics: this.initializeMetrics(),
        regions: testConfig.regions || ['us-east-1'],
        scenarios: testConfig.scenarios || [],
        violations: []
      };

      this.activeExecutions.set(execution.id, execution);

      // Deploy load generators
      await this.deployLoadGenerators(execution, testConfig);

      // Start metrics collection
      await this.startMetricsCollection(execution.id);

      // Begin load generation
      await this.startLoadGeneration(execution, testConfig);

      // Track usage
      await subscriptionService.trackUsage(userId, 'execution', 1);

      this.emit('performance:execution:started', { execution, userId });

      logger.info(`Started performance test execution ${execution.id} for test ${testId}`);

      return execution;
    } catch (error) {
      logger.error(`Failed to execute performance test: ${error}`);
      throw new Error(`Failed to execute performance test: ${error.message}`);
    }
  }

  private async validatePerformanceTestLimits(userId: string, config: PerformanceTestConfig): Promise<{ allowed: boolean; reason?: string }> {
    const subscription = await subscriptionService.getActiveSubscription(userId);
    const planId = subscription?.planId || 'free';

    const limits = {
      free: { maxUsers: 10, maxDuration: 5, regions: 1 },
      starter: { maxUsers: 100, maxDuration: 30, regions: 2 },
      professional: { maxUsers: 1000, maxDuration: 120, regions: 5 },
      enterprise: { maxUsers: 10000, maxDuration: 480, regions: 10 }
    };

    const planLimits = limits[planId as keyof typeof limits];

    if (config.users > planLimits.maxUsers) {
      return {
        allowed: false,
        reason: `User limit exceeded. ${planId} plan allows ${planLimits.maxUsers} virtual users, but ${config.users} requested`
      };
    }

    if (config.duration > planLimits.maxDuration) {
      return {
        allowed: false,
        reason: `Duration limit exceeded. ${planId} plan allows ${planLimits.maxDuration} minutes, but ${config.duration} requested`
      };
    }

    if ((config.regions?.length || 1) > planLimits.regions) {
      return {
        allowed: false,
        reason: `Region limit exceeded. ${planId} plan allows ${planLimits.regions} regions`
      };
    }

    return { allowed: true };
  }

  private async generatePerformanceScenarios(config: PerformanceTestConfig): Promise<PerformanceScenario[]> {
    const prompt = `
    Generate realistic performance testing scenarios for this application:
    
    Test Type: ${config.type}
    Target URLs: ${config.targets.map(t => `${t.method} ${t.url}`).join(', ')}
    Expected Users: ${config.users}
    Duration: ${config.duration} minutes
    
    Create ${Math.min(5, Math.max(2, Math.floor(config.users / 20)))} realistic user scenarios that include:
    
    1. **Authentication flows** (login, logout, session management)
    2. **Core business workflows** (search, browse, purchase, etc.)
    3. **Data operations** (create, read, update, delete)
    4. **File operations** (upload, download if applicable)
    5. **API interactions** (if API endpoints provided)
    
    For each scenario, specify:
    - Realistic user behavior patterns
    - Think time between actions (1-5 seconds)
    - Data variations and parameters
    - Error handling and retry logic
    - Load distribution (percentage of total users)
    - Expected response times
    
    Ensure scenarios are:
    - Realistic and based on actual user behavior
    - Properly distributed across the user base
    - Include both happy path and error scenarios
    - Account for different user types (new vs returning)
    
    Return as JSON array of scenarios with complete action sequences.
    `;

    const response = await this.openAIClient.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000
    });

    const scenarios = JSON.parse(response.choices[0].message.content || '[]');
    
    // Validate and normalize scenarios
    return this.validateAndNormalizeScenarios(scenarios);
  }

  private validateAndNormalizeScenarios(scenarios: any[]): PerformanceScenario[] {
    const normalizedScenarios: PerformanceScenario[] = [];
    let totalPercentage = 0;

    for (const scenario of scenarios) {
      if (scenario.name && scenario.actions && Array.isArray(scenario.actions)) {
        const normalizedScenario: PerformanceScenario = {
          name: scenario.name,
          description: scenario.description || '',
          userPercentage: scenario.userPercentage || 20,
          thinkTime: scenario.thinkTime || 2000,
          actions: scenario.actions.map((action: any) => ({
            type: action.type || 'http_request',
            target: action.target,
            method: action.method || 'GET',
            data: action.data,
            validation: action.validation || []
          }))
        };

        normalizedScenarios.push(normalizedScenario);
        totalPercentage += normalizedScenario.userPercentage;
      }
    }

    // Normalize percentages to total 100%
    if (totalPercentage !== 100 && normalizedScenarios.length > 0) {
      const factor = 100 / totalPercentage;
      normalizedScenarios.forEach(scenario => {
        scenario.userPercentage = Math.round(scenario.userPercentage * factor);
      });
    }

    return normalizedScenarios;
  }

  private async deployLoadGenerators(execution: PerformanceExecution, config: PerformanceTestConfig): Promise<void> {
    const workers: Worker[] = [];
    const workersPerRegion = Math.ceil(config.users / execution.regions.length);

    for (const region of execution.regions) {
      const regionWorkers = Math.min(workersPerRegion, 10); // Max 10 workers per region
      
      for (let i = 0; i < regionWorkers; i++) {
        const worker = new Worker('./dist/workers/performance-worker.js', {
          workerData: {
            executionId: execution.id,
            region,
            workerId: `${region}_${i}`,
            usersPerWorker: Math.ceil(config.users / (execution.regions.length * regionWorkers)),
            scenarios: execution.scenarios,
            targets: config.targets,
            duration: config.duration * 60 * 1000, // Convert to milliseconds
            rampUpTime: config.rampUpTime * 1000
          }
        });

        worker.on('message', (message) => {
          this.handleWorkerMessage(execution.id, message);
        });

        worker.on('error', (error) => {
          logger.error(`Performance worker error: ${error}`);
          // Handle worker error
        });

        workers.push(worker);
      }
    }

    this.loadGenerators.set(execution.id, workers);
  }

  private async startMetricsCollection(executionId: string): Promise<void> {
    const interval = setInterval(async () => {
      const execution = this.activeExecutions.get(executionId);
      if (!execution || execution.status !== 'running') {
        clearInterval(interval);
        this.metricsCollectors.delete(executionId);
        return;
      }

      // Collect and aggregate metrics from all workers
      const aggregatedMetrics = await this.collectAggregatedMetrics(executionId);
      
      // Update execution metrics
      execution.metrics = aggregatedMetrics;
      
      // Check performance thresholds
      const violations = await this.checkPerformanceThresholds(executionId, aggregatedMetrics);
      execution.violations.push(...violations);

      // Emit real-time metrics update
      this.emit('performance:metrics:update', {
        executionId,
        metrics: aggregatedMetrics,
        violations,
        timestamp: new Date()
      });

      // Send voice alerts for critical violations
      if (violations.some(v => v.severity === 'critical')) {
        await this.sendPerformanceAlert(execution, violations);
      }
    }, 5000); // Collect metrics every 5 seconds

    this.metricsCollectors.set(executionId, interval);
  }

  private async startLoadGeneration(execution: PerformanceExecution, config: PerformanceTestConfig): Promise<void> {
    const workers = this.loadGenerators.get(execution.id) || [];
    
    // Start all workers
    for (const worker of workers) {
      worker.postMessage({
        action: 'start',
        timestamp: Date.now()
      });
    }

    // Schedule test completion
    setTimeout(async () => {
      await this.stopExecution(execution.id);
    }, config.duration * 60 * 1000);
  }

  private handleWorkerMessage(executionId: string, message: any): void {
    switch (message.type) {
      case 'metrics':
        // Worker metrics are collected during aggregation
        break;
      case 'error':
        logger.error(`Worker error for execution ${executionId}: ${message.error}`);
        break;
      case 'completed':
        logger.info(`Worker completed for execution ${executionId}`);
        break;
    }
  }

  private async collectAggregatedMetrics(executionId: string): Promise<PerformanceMetrics> {
    const workers = this.loadGenerators.get(executionId) || [];
    const allMetrics: any[] = [];

    // Collect metrics from all workers
    for (const worker of workers) {
      try {
        const workerMetrics = await this.getWorkerMetrics(worker);
        allMetrics.push(workerMetrics);
      } catch (error) {
        logger.error(`Failed to collect worker metrics: ${error}`);
      }
    }

    // Aggregate metrics
    return this.aggregateMetrics(allMetrics);
  }

  private async getWorkerMetrics(worker: Worker): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker metrics timeout'));
      }, 1000);

      worker.once('message', (message) => {
        clearTimeout(timeout);
        if (message.type === 'metrics') {
          resolve(message.data);
        } else {
          reject(new Error('Invalid metrics response'));
        }
      });

      worker.postMessage({ action: 'get_metrics' });
    });
  }

  private aggregateMetrics(workerMetrics: any[]): PerformanceMetrics {
    if (workerMetrics.length === 0) {
      return this.initializeMetrics();
    }

    const aggregated = {
      activeUsers: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      errorRate: 0,
      responseTime: {
        average: 0,
        min: Infinity,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0
      },
      throughput: 0,
      bytesReceived: 0,
      bytesSent: 0
    };

    const responseTimes: number[] = [];

    for (const metrics of workerMetrics) {
      aggregated.activeUsers += metrics.activeUsers || 0;
      aggregated.totalRequests += metrics.totalRequests || 0;
      aggregated.successfulRequests += metrics.successfulRequests || 0;
      aggregated.failedRequests += metrics.failedRequests || 0;
      aggregated.throughput += metrics.throughput || 0;
      aggregated.bytesReceived += metrics.bytesReceived || 0;
      aggregated.bytesSent += metrics.bytesSent || 0;

      if (metrics.responseTimes && Array.isArray(metrics.responseTimes)) {
        responseTimes.push(...metrics.responseTimes);
      }

      aggregated.responseTime.min = Math.min(aggregated.responseTime.min, metrics.responseTime?.min || Infinity);
      aggregated.responseTime.max = Math.max(aggregated.responseTime.max, metrics.responseTime?.max || 0);
    }

    // Calculate aggregated response time metrics
    if (responseTimes.length > 0) {
      responseTimes.sort((a, b) => a - b);
      aggregated.responseTime.average = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
      aggregated.responseTime.p50 = this.calculatePercentile(responseTimes, 50);
      aggregated.responseTime.p95 = this.calculatePercentile(responseTimes, 95);
      aggregated.responseTime.p99 = this.calculatePercentile(responseTimes, 99);
    }

    // Fix infinity values
    if (aggregated.responseTime.min === Infinity) {
      aggregated.responseTime.min = 0;
    }

    // Calculate rates
    if (aggregated.totalRequests > 0) {
      aggregated.successRate = (aggregated.successfulRequests / aggregated.totalRequests) * 100;
      aggregated.errorRate = (aggregated.failedRequests / aggregated.totalRequests) * 100;
    }

    return aggregated;
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private async checkPerformanceThresholds(executionId: string, metrics: PerformanceMetrics): Promise<ThresholdViolation[]> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return [];

    const testConfig = await this.getTestConfiguration(execution.testId, execution.userId);
    const thresholds = testConfig.thresholds;
    const violations: ThresholdViolation[] = [];

    // Check response time thresholds
    if (metrics.responseTime.average > thresholds.responseTime.average) {
      violations.push({
        type: 'response_time_average',
        threshold: thresholds.responseTime.average,
        actual: metrics.responseTime.average,
        severity: 'warning',
        message: `Average response time ${metrics.responseTime.average}ms exceeds threshold ${thresholds.responseTime.average}ms`
      });
    }

    if (metrics.responseTime.p95 > thresholds.responseTime.p95) {
      violations.push({
        type: 'response_time_p95',
        threshold: thresholds.responseTime.p95,
        actual: metrics.responseTime.p95,
        severity: 'warning',
        message: `95th percentile response time ${metrics.responseTime.p95}ms exceeds threshold ${thresholds.responseTime.p95}ms`
      });
    }

    // Check error rate thresholds
    if (metrics.errorRate > thresholds.errorRate) {
      violations.push({
        type: 'error_rate',
        threshold: thresholds.errorRate,
        actual: metrics.errorRate,
        severity: metrics.errorRate > thresholds.errorRate * 2 ? 'critical' : 'warning',
        message: `Error rate ${metrics.errorRate.toFixed(2)}% exceeds threshold ${thresholds.errorRate}%`
      });
    }

    // Check throughput thresholds
    if (metrics.throughput < thresholds.throughput) {
      violations.push({
        type: 'throughput',
        threshold: thresholds.throughput,
        actual: metrics.throughput,
        severity: 'warning',
        message: `Throughput ${metrics.throughput.toFixed(2)} req/s is below threshold ${thresholds.throughput} req/s`
      });
    }

    return violations;
  }

  private async sendPerformanceAlert(execution: PerformanceExecution, violations: ThresholdViolation[]): Promise<void> {
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    
    if (criticalViolations.length > 0) {
      const alertText = `Critical performance alert: Your performance test is experiencing ${criticalViolations.length} critical violations. ${criticalViolations.map(v => v.message).join(', ')}. Please check the dashboard immediately.`;

      // Send voice alert
      console.log('Voice alert would be sent:', alertText);
    }
  }

  async stopExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    // Stop all workers
    const workers = this.loadGenerators.get(executionId) || [];
    for (const worker of workers) {
      worker.postMessage({ action: 'stop' });
      worker.terminate();
    }

    // Stop metrics collection
    const metricsInterval = this.metricsCollectors.get(executionId);
    if (metricsInterval) {
      clearInterval(metricsInterval as any);
      this.metricsCollectors.delete(executionId);
    }

    // Update execution status
    execution.status = 'completed';
    execution.endedAt = new Date();

    // Clean up
    this.loadGenerators.delete(executionId);
    
    this.emit('performance:execution:completed', { execution });

    logger.info(`Stopped performance test execution ${executionId}`);
  }

  private calculateTestCost(config: PerformanceTestConfig): number {
    // Cost calculation based on users, duration, and regions
    const baseCost = 0.01; // $0.01 per user-minute
    const regionMultiplier = config.regions?.length || 1;
    const userMinutes = config.users * config.duration;
    
    return baseCost * userMinutes * regionMultiplier;
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      activeUsers: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      errorRate: 0,
      responseTime: {
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0
      },
      throughput: 0,
      bytesReceived: 0,
      bytesSent: 0
    };
  }

  private async storeTestConfiguration(testId: string, config: PerformanceTestConfig): Promise<void> {
    // TODO: Store in database
    logger.info(`Stored test configuration for ${testId}`);
  }

  private async getTestConfiguration(testId: string, userId: string): Promise<PerformanceTestConfig> {
    // TODO: Retrieve from database
    throw new Error('Test configuration not found');
  }

  async getActiveExecutions(userId: string): Promise<PerformanceExecution[]> {
    return Array.from(this.activeExecutions.values())
      .filter(execution => execution.userId === userId);
  }

  async getExecutionMetrics(executionId: string, userId: string): Promise<PerformanceMetrics | null> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.userId !== userId) {
      return null;
    }
    return execution.metrics;
  }
}

interface ThresholdViolation {
  type: string;
  threshold: number;
  actual: number;
  severity: 'warning' | 'critical';
  message: string;
}

export const performanceTestService = new PerformanceTestService();
