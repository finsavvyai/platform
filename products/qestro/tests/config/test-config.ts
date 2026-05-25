/**
 * Test Configuration for AI API Tests
 *
 * Central configuration for test environments, mocks, and utilities
 */

export interface TestConfig {
  apiBaseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  performanceThresholds: {
    testGeneration: number; // ms
    testOptimization: number; // ms
    failureAnalysis: number; // ms
    usageAnalytics: number; // ms
    healthCheck: number; // ms
  };
  rateLimits: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  mockResponses: {
    enabled: boolean;
    latency: {
      min: number;
      max: number;
    };
    failureRate: number;
  };
}

export const testConfig: TestConfig = {
  apiBaseUrl: process.env.AI_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second

  performanceThresholds: {
    testGeneration: 10000, // 10 seconds
    testOptimization: 8000, // 8 seconds
    failureAnalysis: 12000, // 12 seconds
    usageAnalytics: 1000, // 1 second
    healthCheck: 500 // 500ms
  },

  rateLimits: {
    requestsPerMinute: 100,
    burstLimit: 20
  },

  mockResponses: {
    enabled: process.env.NODE_ENV === 'test',
    latency: {
      min: 100,
      max: 2000
    },
    failureRate: 0.05 // 5% failure rate for testing
  }
};

export interface MockAIProvider {
  id: string;
  name: string;
  type: 'openai' | 'huggingface' | 'custom';
  capabilities: string[];
  pricing: {
    input: number;
    output: number;
  };
  status: 'available' | 'unavailable' | 'degraded';
  supportedFeatures: string[];
  latency: number;
}

export const mockAIProviders: MockAIProvider[] = [
  {
    id: 'openai-gpt-4',
    name: 'GPT-4',
    type: 'openai',
    capabilities: ['text_generation', 'analysis', 'code_generation'],
    pricing: { input: 0.03, output: 0.06 },
    status: 'available',
    supportedFeatures: ['test_generation', 'optimization', 'analysis'],
    latency: 2000
  },
  {
    id: 'openai-gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    type: 'openai',
    capabilities: ['text_generation', 'analysis'],
    pricing: { input: 0.001, output: 0.002 },
    status: 'available',
    supportedFeatures: ['test_generation', 'analysis'],
    latency: 1000
  },
  {
    id: 'huggingface-codegen',
    name: 'Code Generation Model',
    type: 'huggingface',
    capabilities: ['code_generation'],
    pricing: { input: 0.01, output: 0.02 },
    status: 'available',
    supportedFeatures: ['test_generation'],
    latency: 1500
  }
];

export interface TestDataFactory {
  createTestGenerationRequest: (overrides?: Partial<any>) => any;
  createTestOptimizationRequest: (overrides?: Partial<any>) => any;
  createFailureAnalysisRequest: (overrides?: Partial<any>) => any;
  createMockUser: (overrides?: Partial<any>) => any;
  createMockProject: (overrides?: Partial<any>) => any;
}

export const testDataFactory: TestDataFactory = {
  createTestGenerationRequest: (overrides = {}) => ({
    description: 'Test user login functionality',
    platform: 'web',
    framework: 'playwright',
    context: {
      applicationType: 'web',
      targetEnvironment: 'staging',
      existingTests: ['login.spec.ts'],
      testingGuidelines: 'Follow AAA pattern'
    },
    options: {
      includeEdgeCases: true,
      generateAssertions: true,
      complexity: 'intermediate',
      outputFormat: 'typescript'
    },
    ...overrides
  }),

  createTestOptimizationRequest: (overrides = {}) => ({
    tests: [
      {
        id: 'test-1',
        name: 'Login Test',
        type: 'web',
        platform: 'chrome',
        content: 'test login functionality',
        metadata: {
          runCount: 10,
          failureRate: 0.1,
          complexity: 'medium'
        }
      }
    ],
    projectContext: {
      framework: 'playwright',
      targetPlatforms: ['chrome', 'firefox']
    },
    optimizationType: 'comprehensive',
    priority: 'medium',
    ...overrides
  }),

  createFailureAnalysisRequest: (overrides = {}) => ({
    failures: [
      {
        id: 'failure-1',
        testCaseId: 'test-1',
        testName: 'Login Test',
        testType: 'web',
        platform: 'chrome',
        failureTime: new Date().toISOString(),
        errorMessage: 'Element not found: #login-button',
        errorType: 'element_not_found',
        stackTrace: 'Error: Element not found\\n    at TestRunner.run',
        networkLogs: [
          {
            url: 'https://api.example.com/auth/login',
            method: 'POST',
            status: 200,
            responseTime: 250
          }
        ],
        consoleLogs: [
          {
            level: 'error',
            message: 'Login button not found',
            timestamp: new Date().toISOString(),
            source: 'test-runner'
          }
        ],
        executionContext: {
          environment: 'staging',
          testData: { username: 'testuser@example.com' }
        },
        previousRuns: [
          {
            timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            status: 'passed',
            duration: 2000
          }
        ]
      }
    ],
    projectContext: {
      framework: 'playwright',
      targetPlatforms: ['chrome'],
      applicationType: 'web'
    },
    analysisType: 'comprehensive',
    priority: 'high',
    ...overrides
  }),

  createMockUser: (overrides = {}) => ({
    id: 'user-123',
    email: 'test@example.com',
    plan: 'pro',
    aiQuota: 1000,
    remainingQuota: 850,
    token: 'mock-jwt-token',
    isAdmin: false,
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  createMockProject: (overrides = {}) => ({
    id: 'project-456',
    name: 'Test Project',
    userId: 'user-123',
    framework: 'playwright',
    platforms: ['chrome', 'firefox'],
    settings: {
      enableAI: true,
      optimizeTests: true,
      analyzeFailures: true
    },
    createdAt: new Date().toISOString(),
    ...overrides
  })
};

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage?: number;
  cpuUsage?: number;
  requestSize: number;
  responseSize: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];

  async measureRequest<T>(
    requestFn: () => Promise<T>,
    requestSize: number = 0
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startTime = performance.now();

    try {
      const result = await requestFn();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const metrics: PerformanceMetrics = {
        responseTime,
        requestSize,
        responseSize: JSON.stringify(result).length
      };

      this.metrics.push(metrics);

      return { result, metrics };
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const metrics: PerformanceMetrics = {
        responseTime,
        requestSize,
        responseSize: 0
      };

      this.metrics.push(metrics);

      throw error;
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;
    return this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / this.metrics.length;
  }

  getPercentileResponseTime(percentile: number): number {
    if (this.metrics.length === 0) return 0;
    const sorted = this.metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    return sorted[index];
  }

  clear(): void {
    this.metrics = [];
  }

  generateReport(): {
    count: number;
    averageResponseTime: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    minResponseTime: number;
    maxResponseTime: number;
  } {
    const responseTimes = this.metrics.map(m => m.responseTime).sort((a, b) => a - b);

    return {
      count: this.metrics.length,
      averageResponseTime: this.getAverageResponseTime(),
      p50: this.getPercentileResponseTime(50),
      p90: this.getPercentileResponseTime(90),
      p95: this.getPercentileResponseTime(95),
      p99: this.getPercentileResponseTime(99),
      minResponseTime: responseTimes[0] || 0,
      maxResponseTime: responseTimes[responseTimes.length - 1] || 0
    };
  }
}

export class RetryHelper {
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = testConfig.retryAttempts,
    delay: number = testConfig.retryDelay
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          throw lastError;
        }

        // Exponential backoff
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError!;
  }
}

export class ResponseValidator {
  static validateTestGenerationResponse(response: any): void {
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.id).toBeDefined();
    expect(response.data.generatedTests).toBeDefined();
    expect(Array.isArray(response.data.generatedTests)).toBe(true);
    expect(response.data.confidence).toBeGreaterThan(0);
    expect(response.data.metadata).toBeDefined();
    expect(response.usage).toBeDefined();
  }

  static validateTestOptimizationResponse(response: any): void {
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.id).toBeDefined();
    expect(response.data.optimizations).toBeDefined();
    expect(Array.isArray(response.data.optimizations)).toBe(true);
    expect(response.data.summary).toBeDefined();
    expect(response.data.estimatedImpact).toBeDefined();
  }

  static validateFailureAnalysisResponse(response: any): void {
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.id).toBeDefined();
    expect(response.data.classifications).toBeDefined();
    expect(Array.isArray(response.data.classifications)).toBe(true);
    expect(response.data.rootCauseAnalysis).toBeDefined();
    expect(response.data.suggestedFixes).toBeDefined();
    expect(Array.isArray(response.data.suggestedFixes)).toBe(true);
    expect(response.data.summary).toBeDefined();
  }

  static validateUsageResponse(response: any): void {
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.currentUsage).toBeDefined();
    expect(response.data.limits).toBeDefined();
    expect(response.data.period).toBeDefined();
  }

  static validateErrorResponse(response: any, expectedStatus?: number): void {
    expect(response).toBeDefined();
    if (expectedStatus) {
      expect(response.status).toBe(expectedStatus);
    }
    expect(response.error).toBeDefined();
    expect(response.timestamp).toBeDefined();
    expect(response.path).toBeDefined();
  }
}

export class MockDataGenerator {
  static generateTestFailure(
    overrides: Partial<any> = {}
  ): any {
    return {
      id: `failure-${Math.random().toString(36).substr(2, 9)}`,
      testCaseId: `test-${Math.random().toString(36).substr(2, 9)}`,
      testName: `Test ${Math.random().toString(36).substr(2, 9)}`,
      testType: 'web',
      platform: 'chrome',
      failureTime: new Date().toISOString(),
      errorMessage: `Error message ${Math.random().toString(36).substr(2, 9)}`,
      errorType: ['timeout_error', 'element_not_found', 'assertion_failure', 'network_error'][Math.floor(Math.random() * 4)],
      stackTrace: `Error: ${Math.random().toString(36).substr(2, 9)}\\n    at TestRunner.run`,
      networkLogs: [
        {
          url: `https://api.example.com/${Math.random().toString(36).substr(2, 9)}`,
          method: 'GET',
          status: 200,
          responseTime: 100 + Math.random() * 500
        }
      ],
      consoleLogs: [
        {
          level: 'error',
          message: `Log message ${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          source: 'test-runner'
        }
      ],
      executionContext: {
        environment: 'test',
        testData: { key: Math.random().toString(36).substr(2, 9) }
      },
      previousRuns: [
        {
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          status: Math.random() > 0.3 ? 'passed' : 'failed',
          duration: 1000 + Math.random() * 4000
        }
      ],
      ...overrides
    };
  }

  static generateLargeTestDescription(length: number = 5000): string {
    const sentences = [
      'Create comprehensive test coverage for',
      'Implement robust testing scenarios including',
      'Design test cases that verify',
      'Build automated tests for',
      'Develop validation tests that ensure',
      'Construct end-to-end tests covering',
      'Establish integration tests for',
      'Formulate performance tests measuring'
    ];

    let description = '';
    while (description.length < length) {
      const sentence = sentences[Math.floor(Math.random() * sentences.length)];
      const details = Array.from({ length: 3 + Math.floor(Math.random() * 5) }, () =>
        Math.random().toString(36).substr(2, 7)
      ).join(', ');
      description += `${sentence} ${details}. `;
    }

    return description.substring(0, length);
  }
}
