/**
 * Performance Testing Utilities
 *
 * Comprehensive utilities for performance and load testing including:
 * - Realistic test data generation for performance scenarios
 * - Performance metrics collection and analysis
 * - Resource usage monitoring (CPU, memory, network)
 * - Load testing scenario generators
 * - Performance baseline management
 */

import { performance } from 'perf_hooks';
import { randomBytes } from 'crypto';

// Interfaces for performance testing
export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    activeConnections: number;
  };
  responseTime: number;
  throughput: number;
  errorRate: number;
}

export interface LoadTestScenario {
  id: string;
  name: string;
  description: string;
  duration: number;
  users: number;
  rampUpTime: number;
  operations: LoadTestOperation[];
  thinkTime: {
    min: number;
    max: number;
  };
  goals: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface LoadTestOperation {
  endpoint: string;
  method: string;
  weight: number; // Probability weight for operation selection
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number;
  timeout: number;
}

export interface UserScenario {
  id: string;
  type: 'lightweight' | 'standard' | 'heavy';
  operations: TestOperation[];
  sessionId: string;
  userId: string;
}

export interface TestOperation {
  endpoint: string;
  method: string;
  token: string;
  body?: any;
  weight?: number;
}

export interface PerformanceBaseline {
  version: string;
  timestamp: number;
  environment: string;
  metrics: {
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
      average: number;
    };
    throughput: number;
    errorRate: number;
    resourceUsage: {
      memory: number;
      cpu: number;
    };
  };
}

/**
 * Performance Test Data Generator
 */
export class PerformanceTestDataGenerator {
  private readonly userTypes = ['admin', 'user', 'tester', 'viewer'];
  private readonly projectTypes = ['web', 'mobile', 'api', 'hybrid'];
  private readonly testTypes = ['unit', 'integration', 'e2e', 'performance', 'security'];
  private readonly platforms = ['chrome', 'firefox', 'safari', 'android', 'ios'];

  /**
   * Generate test users for performance testing
   */
  generateTestUsers(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-user-${i}`,
      email: `perf-user-${i}@test.com`,
      password: 'test-password-123',
      fullName: `Performance Test User ${i}`,
      firstName: `Perf${i}`,
      lastName: `User${i}`,
      company: 'Test Company Inc',
      role: this.userTypes[i % this.userTypes.length],
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  /**
   * Generate test projects for performance testing
   */
  generateTestProjects(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-project-${i}`,
      name: `Performance Test Project ${i}`,
      description: `Test project for performance testing scenario ${i}`,
      type: this.projectTypes[i % this.projectTypes.length],
      platform: this.platforms[i % this.platforms.length],
      url: `https://test-project-${i}.example.com`,
      repository: `https://github.com/test/project-${i}`,
      isActive: true,
      createdAt: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
      testCount: Math.floor(Math.random() * 500) + 10,
      lastRun: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  /**
   * Generate test cases for performance testing
   */
  generateTestCases(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-test-${i}`,
      name: `Performance Test Case ${i}`,
      description: `Test case for performance testing ${i}`,
      type: this.testTypes[i % this.testTypes.length],
      platform: this.platforms[i % this.platforms.length],
      framework: this.platforms[i % this.platforms.length] === 'mobile' ? 'maestro' : 'playwright',
      priority: ['low', 'medium', 'high', 'critical'][i % 4],
      estimatedDuration: Math.floor(Math.random() * 300) + 30, // 30-330 seconds
      steps: this.generateTestSteps(Math.floor(Math.random() * 10) + 3),
      tags: ['performance', 'automated', 'regression', 'smoke'].slice(0, Math.floor(Math.random() * 3) + 1),
      createdAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  /**
   * Generate test steps
   */
  private generateTestSteps(count: number): any[] {
    const actions = ['navigate', 'click', 'fill', 'wait', 'assert', 'select', 'hover', 'scroll'];
    const targets = [
      '[data-testid="login-button"]',
      '[data-testid="email-input"]',
      '[data-testid="password-input"]',
      '[data-testid="dashboard"]',
      '[data-testid="profile-menu"]',
      '[data-testid="create-test-button"]',
      '[data-testid="test-editor"]',
      '[data-testid="run-test-button"]'
    ];

    return Array.from({ length: count }, (_, i) => ({
      id: `step-${i}`,
      action: actions[i % actions.length],
      target: targets[i % targets.length],
      value: i % 3 === 1 ? `test-value-${i}` : undefined,
      timeout: Math.floor(Math.random() * 10000) + 5000,
      assertion: i % 4 === 0 ? {
        type: 'visible',
        target: targets[i % targets.length]
      } : undefined
    }));
  }

  /**
   * Generate test execution scenarios
   */
  generateTestExecutions(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `perf-execution-${i}`,
      testId: `perf-test-${i % 20}`,
      environment: ['development', 'staging', 'production'][i % 3],
      deviceConfig: {
        platform: this.platforms[i % this.platforms.length],
        version: this.generatePlatformVersion(this.platforms[i % this.platforms.length]),
        viewport: {
          width: [1920, 1366, 768, 375][i % 4],
          height: [1080, 768, 1024, 667][i % 4]
        },
        userAgent: this.generateUserAgent(this.platforms[i % this.platforms.length])
      },
      options: {
        timeout: Math.floor(Math.random() * 30000) + 30000,
        retries: Math.floor(Math.random() * 3),
        parallel: i % 3 === 0,
        headless: i % 2 === 0,
        video: i % 4 === 0,
        screenshots: true
      },
      scheduledAt: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  /**
   * Generate platform version
   */
  private generatePlatformVersion(platform: string): string {
    const versions = {
      chrome: ['120.0.0', '119.0.0', '118.0.0'],
      firefox: ['121.0.0', '120.0.0', '119.0.0'],
      safari: ['17.1', '17.0', '16.6'],
      android: ['14', '13', '12', '11'],
      ios: ['17.1', '17.0', '16.7', '16.6']
    };
    return versions[platform]?.[Math.floor(Math.random() * 3)] || 'latest';
  }

  /**
   * Generate user agent string
   */
  private generateUserAgent(platform: string): string {
    const userAgents = {
      chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      android: 'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
    };
    return userAgents[platform] || userAgents.chrome;
  }

  /**
   * Generate user scenarios for load testing
   */
  generateUserScenarios(count: number, type: 'standard' | 'lightweight' | 'heavy' = 'standard'): UserScenario[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `scenario-${i}`,
      type: type,
      sessionId: randomBytes(16).toString('hex'),
      userId: `perf-user-${i}`,
      operations: this.generateUserOperations(type)
    }));
  }

  /**
   * Generate operations for user scenarios
   */
  private generateUserOperations(type: string): TestOperation[] {
    const lightweightOps = [
      { endpoint: '/api/health', method: 'GET', weight: 0.4 },
      { endpoint: '/api/user/profile', method: 'GET', weight: 0.3 },
      { endpoint: '/api/dashboard', method: 'GET', weight: 0.3 }
    ];

    const standardOps = [
      { endpoint: '/api/projects', method: 'GET', weight: 0.25 },
      { endpoint: '/api/tests', method: 'GET', weight: 0.25 },
      { endpoint: '/api/test-results', method: 'GET', weight: 0.2 },
      { endpoint: '/api/analytics/dashboard', method: 'GET', weight: 0.15 },
      { endpoint: '/api/notifications', method: 'GET', weight: 0.15 }
    ];

    const heavyOps = [
      { endpoint: '/api/tests', method: 'POST', weight: 0.2, body: this.generateTestRequestBody() },
      { endpoint: '/api/test-execution/execute', method: 'POST', weight: 0.15, body: this.generateExecutionBody() },
      { endpoint: '/api/analytics/comprehensive', method: 'GET', weight: 0.1 },
      { endpoint: '/api/ai/generate-test', method: 'POST', weight: 0.1, body: this.generateAIBody() },
      { endpoint: '/api/tests', method: 'GET', weight: 0.15 },
      { endpoint: '/api/test-results', method: 'GET', weight: 0.15 },
      { endpoint: '/api/projects', method: 'GET', weight: 0.15 }
    ];

    const operations = type === 'lightweight' ? lightweightOps : type === 'heavy' ? heavyOps : standardOps;

    return operations.map(op => ({
      ...op,
      token: this.generateTestToken(),
      body: op.body
    }));
  }

  /**
   * Generate test request body
   */
  private generateTestRequestBody(): any {
    return {
      name: `Performance Test ${Date.now()}`,
      description: 'Generated test for performance testing',
      type: 'e2e',
      platform: 'web',
      framework: 'playwright',
      steps: this.generateTestSteps(5)
    };
  }

  /**
   * Generate execution request body
   */
  private generateExecutionBody(): any {
    return {
      testId: `perf-test-${Math.floor(Math.random() * 100)}`,
      environment: 'staging',
      deviceConfig: {
        platform: 'chrome',
        viewport: { width: 1920, height: 1080 }
      },
      options: {
        timeout: 30000,
        retries: 2,
        screenshots: true
      }
    };
  }

  /**
   * Generate AI request body
   */
  private generateAIBody(): any {
    return {
      description: 'Generate a comprehensive test for user authentication flow',
      platform: 'web',
      framework: 'playwright',
      complexity: 'intermediate',
      includeAssertions: true,
      includeErrorHandling: true
    };
  }

  /**
   * Generate mixed workload for throughput testing
   */
  generateMixedWorkload(): TestOperation[] {
    return [
      {
        endpoint: '/api/health',
        method: 'GET',
        token: this.generateTestToken()
      },
      {
        endpoint: '/api/user/profile',
        method: 'GET',
        token: this.generateTestToken()
      },
      {
        endpoint: '/api/projects',
        method: 'GET',
        token: this.generateTestToken()
      },
      {
        endpoint: '/api/tests?limit=10',
        method: 'GET',
        token: this.generateTestToken()
      },
      {
        endpoint: '/api/analytics/dashboard',
        method: 'GET',
        token: this.generateTestToken()
      },
      {
        endpoint: '/api/notifications',
        method: 'GET',
        token: this.generateTestToken()
      }
    ];
  }

  /**
   * Generate test authentication token
   */
  generateTestToken(): string {
    const payload = {
      userId: `perf-user-${Math.floor(Math.random() * 1000)}`,
      email: `perf-user@test.com`,
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    // Return mock JWT token (in real implementation, would be properly signed)
    return `mock.jwt.token.${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  /**
   * Generate load test scenarios
   */
  generateLoadTestScenarios(): LoadTestScenario[] {
    return [
      {
        id: 'smoke-test',
        name: 'Smoke Test Load',
        description: 'Light load test for basic functionality validation',
        duration: 60000, // 1 minute
        users: 10,
        rampUpTime: 10000, // 10 seconds
        operations: [
          { endpoint: '/api/health', method: 'GET', weight: 0.4, expectedStatus: 200, timeout: 5000 },
          { endpoint: '/api/user/profile', method: 'GET', weight: 0.3, expectedStatus: 200, timeout: 10000 },
          { endpoint: '/api/dashboard', method: 'GET', weight: 0.3, expectedStatus: 200, timeout: 15000 }
        ],
        thinkTime: { min: 1000, max: 3000 },
        goals: { responseTime: 2000, throughput: 50, errorRate: 0.01 }
      },
      {
        id: 'standard-load',
        name: 'Standard Load Test',
        description: 'Realistic user load simulation',
        duration: 300000, // 5 minutes
        users: 100,
        rampUpTime: 30000, // 30 seconds
        operations: [
          { endpoint: '/api/projects', method: 'GET', weight: 0.2, expectedStatus: 200, timeout: 10000 },
          { endpoint: '/api/tests', method: 'GET', weight: 0.25, expectedStatus: 200, timeout: 10000 },
          { endpoint: '/api/tests', method: 'POST', weight: 0.1, expectedStatus: 201, timeout: 15000 },
          { endpoint: '/api/test-execution/execute', method: 'POST', weight: 0.15, expectedStatus: 202, timeout: 5000 },
          { endpoint: '/api/test-results', method: 'GET', weight: 0.15, expectedStatus: 200, timeout: 10000 },
          { endpoint: '/api/analytics/dashboard', method: 'GET', weight: 0.1, expectedStatus: 200, timeout: 15000 },
          { endpoint: '/api/notifications', method: 'GET', weight: 0.05, expectedStatus: 200, timeout: 5000 }
        ],
        thinkTime: { min: 2000, max: 5000 },
        goals: { responseTime: 5000, throughput: 200, errorRate: 0.02 }
      },
      {
        id: 'stress-test',
        name: 'Stress Test',
        description: 'High load test to find system limits',
        duration: 600000, // 10 minutes
        users: 500,
        rampUpTime: 60000, // 1 minute
        operations: [
          { endpoint: '/api/tests', method: 'GET', weight: 0.3, expectedStatus: 200, timeout: 15000 },
          { endpoint: '/api/test-execution/execute', method: 'POST', weight: 0.2, expectedStatus: 202, timeout: 5000 },
          { endpoint: '/api/ai/generate-test', method: 'POST', weight: 0.1, expectedStatus: 200, timeout: 30000 },
          { endpoint: '/api/analytics/comprehensive', method: 'GET', weight: 0.1, expectedStatus: 200, timeout: 20000 },
          { endpoint: '/api/test-results', method: 'GET', weight: 0.2, expectedStatus: 200, timeout: 15000 },
          { endpoint: '/api/health', method: 'GET', weight: 0.1, expectedStatus: 200, timeout: 3000 }
        ],
        thinkTime: { min: 500, max: 2000 },
        goals: { responseTime: 10000, throughput: 100, errorRate: 0.05 }
      },
      {
        id: 'spike-test',
        name: 'Spike Test',
        description: 'Sudden load increase to test system resilience',
        duration: 300000, // 5 minutes
        users: 50,
        rampUpTime: 5000, // 5 seconds (very fast ramp-up)
        operations: [
          { endpoint: '/api/test-execution/execute', method: 'POST', weight: 0.3, expectedStatus: 202, timeout: 5000 },
          { endpoint: '/api/tests', method: 'GET', weight: 0.4, expectedStatus: 200, timeout: 10000 },
          { endpoint: '/api/ai/generate-test', method: 'POST', weight: 0.1, expectedStatus: 200, timeout: 30000 },
          { endpoint: '/api/analytics/dashboard', method: 'GET', weight: 0.2, expectedStatus: 200, timeout: 15000 }
        ],
        thinkTime: { min: 200, max: 1000 },
        goals: { responseTime: 15000, throughput: 300, errorRate: 0.1 }
      }
    ];
  }
}

/**
 * Performance Metrics Collector
 */
export class PerformanceMetricsCollector {
  private metrics: PerformanceMetrics[] = [];
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private baseline?: PerformanceBaseline;

  /**
   * Start performance monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('📊 Starting performance metrics collection...');

    // Collect initial baseline
    this.baseline = await this.collectBaseline();

    // Start periodic collection
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.collectMetrics();
      }
    }, 1000); // Collect every second

    console.log('✅ Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('🛑 Performance monitoring stopped');
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics(): Promise<void> {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cpu: await this.getCPUUsage(),
      memory: this.getMemoryUsage(),
      network: await this.getNetworkUsage(),
      responseTime: 0, // Will be calculated from API calls
      throughput: 0,  // Will be calculated from API calls
      errorRate: 0     // Will be calculated from API calls
    };

    this.metrics.push(metrics);

    // Keep only last 60 seconds of metrics
    const cutoff = Date.now() - 60000;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get current CPU usage
   */
  private async getCPUUsage(): Promise<{ usage: number; loadAverage: number[] }> {
    try {
      // In a real implementation, this would use system monitoring libraries
      // For now, return simulated data
      const usage = Math.random() * 20 + 10; // 10-30% usage
      const loadAverage = [usage / 100, usage / 100, usage / 100]; // Simulated load average

      return { usage, loadAverage };
    } catch (error) {
      console.warn('Failed to get CPU usage:', error);
      return { usage: 0, loadAverage: [0, 0, 0] };
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): PerformanceMetrics['memory'] {
    try {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss
      };
    } catch (error) {
      console.warn('Failed to get memory usage:', error);
      return {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0
      };
    }
  }

  /**
   * Get current network usage
   */
  private async getNetworkUsage(): Promise<{ bytesReceived: number; bytesSent: number; activeConnections: number }> {
    try {
      // In a real implementation, this would use network monitoring
      // For now, return simulated data
      return {
        bytesReceived: Math.floor(Math.random() * 1000000),
        bytesSent: Math.floor(Math.random() * 1000000),
        activeConnections: Math.floor(Math.random() * 100) + 10
      };
    } catch (error) {
      console.warn('Failed to get network usage:', error);
      return {
        bytesReceived: 0,
        bytesSent: 0,
        activeConnections: 0
      };
    }
  }

  /**
   * Get current resource usage
   */
  async getResourceUsage(): Promise<{ memory: PerformanceMetrics['memory']; cpu: PerformanceMetrics['cpu'] }> {
    return {
      memory: this.getMemoryUsage(),
      cpu: await this.getCPUUsage()
    };
  }

  /**
   * Collect performance baseline
   */
  private async collectBaseline(): Promise<PerformanceBaseline> {
    const initialMetrics = Array.from({ length: 10 }, async () => {
      await this.collectMetrics();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await Promise.all(initialMetrics);

    const responseTimes = this.metrics.slice(-10).map(m => m.responseTime).filter(t => t > 0);
    const avgResponseTime = responseTimes.length > 0 ?
      responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0;

    return {
      version: process.env.npm_package_version || '1.0.0',
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'test',
      metrics: {
        responseTime: {
          p50: this.calculatePercentile(responseTimes, 50),
          p95: this.calculatePercentile(responseTimes, 95),
          p99: this.calculatePercentile(responseTimes, 99),
          average: avgResponseTime
        },
        throughput: 0, // Will be calculated from actual requests
        errorRate: 0,  // Will be calculated from actual requests
        resourceUsage: {
          memory: this.metrics[this.metrics.length - 1]?.memory.heapUsed || 0,
          cpu: this.metrics[this.metrics.length - 1]?.cpu.usage || 0
        }
      }
    };
  }

  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get collected metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get performance baseline
   */
  getBaseline(): PerformanceBaseline | undefined {
    return this.baseline;
  }

  /**
   * Generate performance report
   */
  async generateReport(): Promise<void> {
    if (this.metrics.length === 0) {
      console.log('No metrics collected to generate report');
      return;
    }

    const report = {
      summary: this.generateSummary(),
      timeline: this.metrics,
      baseline: this.baseline,
      recommendations: this.generateRecommendations()
    };

    // Write report to file (in real implementation)
    console.log('📋 Performance Report Summary:');
    console.log(`  Duration: ${this.metrics.length} seconds`);
    console.log(`  Average CPU: ${(report.summary.avgCPU).toFixed(2)}%`);
    console.log(`  Peak Memory: ${(report.summary.peakMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Recommendations: ${report.recommendations.length}`);

    report.recommendations.forEach((rec, i) => {
      console.log(`    ${i + 1}. ${rec}`);
    });
  }

  /**
   * Generate performance summary
   */
  private generateSummary() {
    const cpuUsages = this.metrics.map(m => m.cpu.usage);
    const memoryUsages = this.metrics.map(m => m.memory.heapUsed);
    const networkUsages = this.metrics.map(m => m.network.activeConnections);

    return {
      duration: this.metrics.length,
      avgCPU: cpuUsages.reduce((sum, cpu) => sum + cpu, 0) / cpuUsages.length,
      peakCPU: Math.max(...cpuUsages),
      avgMemory: memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length,
      peakMemory: Math.max(...memoryUsages),
      avgConnections: networkUsages.reduce((sum, conn) => sum + conn, 0) / networkUsages.length,
      peakConnections: Math.max(...networkUsages)
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const summary = this.generateSummary();

    if (summary.avgCPU > 70) {
      recommendations.push('High CPU usage detected. Consider optimizing algorithms or scaling horizontally.');
    }

    if (summary.peakMemory > 512 * 1024 * 1024) { // 512MB
      recommendations.push('High memory usage detected. Check for memory leaks or optimize data structures.');
    }

    if (summary.avgConnections > 80) {
      recommendations.push('High number of active connections. Implement connection pooling or limits.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance metrics are within acceptable ranges.');
    }

    return recommendations;
  }
}
