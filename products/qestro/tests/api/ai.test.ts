/**
 * Tests for AI API Endpoints
 * Covers all AI service endpoints with comprehensive validation, error handling,
 * rate limiting, and integration testing
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { aiRoutes } from '../../src/api/ai';
import { AIManager } from '../../src/services/ai/ai-manager';
import { AITestGenerator } from '../../src/services/ai/test-generator';
import { AITestOptimizer } from '../../src/services/ai/test-optimizer';
import { AIBugAnalyzer } from '../../src/services/ai/bug-analyzer';
import { AICostTracker } from '../../src/services/ai/cost-tracker';
import { AICacheManager } from '../../src/services/ai/cache-manager';

// Mock dependencies
vi.mock('../../src/services/ai/ai-manager');
vi.mock('../../src/services/ai/test-generator');
vi.mock('../../src/services/ai/test-optimizer');
vi.mock('../../src/services/ai/bug-analyzer');
vi.mock('../../src/services/ai/cost-tracker');
vi.mock('../../src/services/ai/cache-manager');

describe('AI API Routes', () => {
  let app: Hono;
  let mockAIManager: Mocked<AIManager>;
  let mockTestGenerator: Mocked<AITestGenerator>;
  let mockTestOptimizer: Mocked<AITestOptimizer>;
  let mockBugAnalyzer: Mocked<AIBugAnalyzer>;
  let mockCostTracker: Mocked<AICostTracker>;
  let mockCacheManager: Mocked<AICacheManager>;

  beforeEach(() => {
    mockAIManager = new AIManager() as Mocked<AIManager>;
    mockTestGenerator = new AITestGenerator() as Mocked<AITestGenerator>;
    mockTestOptimizer = new AITestOptimizer() as Mocked<AITestOptimizer>;
    mockBugAnalyzer = new AIBugAnalyzer() as Mocked<AIBugAnalyzer>;
    mockCostTracker = new AICostTracker() as Mocked<AICostTracker>;
    mockCacheManager = new AICacheManager() as Mocked<AICacheManager>;

    vi.mocked(AIManager).mockImplementation(() => mockAIManager);
    vi.mocked(AITestGenerator).mockImplementation(() => mockTestGenerator);
    vi.mocked(AITestOptimizer).mockImplementation(() => mockTestOptimizer);
    vi.mocked(AIBugAnalyzer).mockImplementation(() => mockBugAnalyzer);
    vi.mocked(AICostTracker).mockImplementation(() => mockCostTracker);
    vi.mocked(AICacheManager).mockImplementation(() => mockCacheManager);

    app = new Hono();
    app.route('/api/ai', aiRoutes);
  });

  describe('POST /api/ai/generate-test', () => {
    it('should generate tests successfully with valid input', async () => {
      const requestBody = {
        description: 'Test user login functionality with valid credentials',
        platform: 'web',
        framework: 'playwright',
        context: {
          applicationType: 'web',
          targetEnvironment: 'staging'
        },
        options: {
          includeEdgeCases: true,
          generateAssertions: true,
          complexity: 'intermediate',
          outputFormat: 'yaml'
        }
      };

      const mockGenerationResult = createMockTestGenerationResult();
      mockTestGenerator.generateTests.mockResolvedValue(mockGenerationResult);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: true,
        remainingQuota: 850,
        monthlyLimit: 1000
      });

      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123',
          'x-project-id': 'project-456'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.generatedTests).toHaveLength(2);
      expect(body.data.confidence).toBe(0.9);
      expect(body.data.metadata.platform).toBe('web');
      expect(body.data.metadata.framework).toBe('playwright');
      expect(body.usage.tokensUsed).toBe(150);
      expect(body.usage.remainingQuota).toBe(850);
    });

    it('should reject requests when user limit is exceeded', async () => {
      const requestBody = {
        description: 'Test user login functionality',
        platform: 'web'
      };

      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: false,
        remainingQuota: 0,
        monthlyLimit: 1000
      });

      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toBe('Too many requests');
      expect(body.message).toContain('Test generation limit reached');
    });

    it('should validate input and reject invalid requests', async () => {
      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: '', // Empty description should fail validation
          platform: 'invalid'
        })
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Validation error');
    });

    it('should handle AI service failures gracefully', async () => {
      const requestBody = {
        description: 'Test user login functionality',
        platform: 'web'
      };

      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: true,
        remainingQuota: 500
      });
      mockTestGenerator.generateTests.mockRejectedValue(new Error('AI service unavailable'));

      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
      expect(body.message).toBe('Failed to generate tests');
    });
  });

  describe('POST /api/ai/optimize-test', () => {
    it('should optimize tests successfully', async () => {
      const requestBody = {
        tests: [
          {
            id: 'test-1',
            name: 'Login Test',
            type: 'web',
            platform: 'chrome',
            content: 'test login functionality',
            metadata: {
              runCount: 10,
              failureRate: 0.2,
              complexity: 'medium'
            }
          }
        ],
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome', 'firefox']
        },
        optimizationType: 'comprehensive',
        priority: 'high'
      };

      const mockOptimizationResult = createMockTestOptimizationResult();
      mockTestOptimizer.optimizeTests.mockResolvedValue(mockOptimizationResult);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canOptimizeTest: true,
        remainingQuota: 750
      });

      const response = await app.request('/api/ai/optimize-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123',
          'x-project-id': 'project-456'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.optimizations).toHaveLength(2);
      expect(body.data.summary.totalOptimizations).toBe(2);
      expect(body.data.estimatedImpact.reliabilityImprovement).toBeGreaterThan(0);
      expect(body.data.metadata.testsAnalyzed).toBe(1);
    });

    it('should reject empty test array', async () => {
      const response = await app.request('/api/ai/optimize-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tests: [] })
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Validation error');
    });

    it('should handle optimization service failures', async () => {
      const requestBody = {
        tests: [
          {
            id: 'test-1',
            name: 'Login Test',
            type: 'web',
            content: 'test content',
            metadata: { runCount: 5, failureRate: 0.1, complexity: 'low' }
          }
        ]
      };

      mockCostTracker.checkUserLimits.mockResolvedValue({
        canOptimizeTest: true,
        remainingQuota: 500
      });
      mockTestOptimizer.optimizeTests.mockRejectedValue(new Error('Optimization service error'));

      const response = await app.request('/api/ai/optimize-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/ai/analyze-failure', () => {
    it('should analyze failures successfully', async () => {
      const requestBody = {
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
            metadata: {
              runCount: 10,
              failureRate: 0.3
            }
          }
        ],
        projectContext: {
          framework: 'playwright',
          targetPlatforms: ['chrome'],
          applicationType: 'web'
        },
        analysisType: 'comprehensive',
        priority: 'high'
      };

      const mockAnalysisResult = createMockBugAnalysisResult();
      mockBugAnalyzer.analyzeFailures.mockResolvedValue(mockAnalysisResult);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canAnalyzeFailure: true,
        remainingQuota: 900
      });

      const response = await app.request('/api/ai/analyze-failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123',
          'x-project-id': 'project-456'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.classifications).toHaveLength(1);
      expect(body.data.rootCauseAnalysis).toBeDefined();
      expect(body.data.suggestedFixes).toHaveLength(1);
      expect(body.data.summary.totalFailures).toBe(1);
      expect(body.data.metadata.criticalFailures).toBe(0);
    });

    it('should handle multiple failures with pattern analysis', async () => {
      const failures = Array.from({ length: 3 }, (_, i) => ({
        id: `failure-${i + 1}`,
        testCaseId: `test-${i + 1}`,
        testName: `Test ${i + 1}`,
        testType: 'web' as const,
        platform: 'chrome',
        failureTime: new Date().toISOString(),
        errorMessage: `Timeout error ${i + 1}`,
        errorType: 'timeout_error'
      }));

      const requestBody = {
        failures,
        analysisType: 'pattern_analysis'
      };

      const mockAnalysisResult = createMockBugAnalysisResult();
      mockAnalysisResult.patternAnalysis = {
        detectedPatterns: [
          {
            pattern: 'multiple_timeout_errors',
            description: 'Multiple timeout failures detected',
            frequency: 3,
            affectedTests: failures.map(f => f.testCaseId),
            timeSpan: '1 hour',
            trend: 'increasing'
          }
        ],
        failureCorrelations: [],
        environmentPatterns: [],
        temporalPatterns: []
      };

      mockBugAnalyzer.analyzeFailures.mockResolvedValue(mockAnalysisResult);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canAnalyzeFailure: true,
        remainingQuota: 800
      });

      const response = await app.request('/api/ai/analyze-failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.patternAnalysis).toBeDefined();
      expect(body.data.patternAnalysis.detectedPatterns).toHaveLength(1);
      expect(body.data.summary.totalFailures).toBe(3);
    });

    it('should reject empty failures array', async () => {
      const response = await app.request('/api/ai/analyze-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failures: [] })
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Validation error');
    });
  });

  describe('GET /api/ai/usage', () => {
    it('should return usage analytics successfully', async () => {
      const mockUsageAnalytics = {
        totalUsage: 150,
        cost: 0.75,
        requests: 25,
        breakdown: {
          testGeneration: { requests: 10, cost: 0.50 },
          testOptimization: { requests: 8, cost: 0.15 },
          failureAnalysis: { requests: 7, cost: 0.10 }
        },
        byService: {},
        byType: {},
        byProvider: {}
      };

      mockCostTracker.getUsageAnalytics.mockResolvedValue(mockUsageAnalytics);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        monthlyLimit: 1000,
        remainingQuota: 850,
        resetDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        features: ['test_generation', 'test_optimization', 'failure_analysis']
      });

      const response = await app.request('/api/ai/usage?granularity=day&includeBreakdown=true', {
        method: 'GET',
        headers: { 'x-user-id': 'user-123' }
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.currentUsage.totalUsage).toBe(150);
      expect(body.data.limits.monthlyLimit).toBe(1000);
      expect(body.data.limits.remainingQuota).toBe(850);
      expect(body.data.period.granularity).toBe('day');
      expect(body.data.breakdown).toBeDefined();
    });

    it('should use default granularity when not specified', async () => {
      mockCostTracker.getUsageAnalytics.mockResolvedValue({ totalUsage: 0 });
      mockCostTracker.checkUserLimits.mockResolvedValue({
        monthlyLimit: 1000,
        remainingQuota: 1000
      });

      const response = await app.request('/api/ai/usage', {
        method: 'GET',
        headers: { 'x-user-id': 'user-123' }
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.period.granularity).toBe('day');
    });
  });

  describe('GET /api/ai/models', () => {
    it('should return available AI models and providers', async () => {
      const mockProviders = [
        {
          id: 'openai-gpt-4',
          name: 'GPT-4',
          type: 'openai',
          capabilities: ['text_generation', 'analysis'],
          pricing: { input: 0.03, output: 0.06 },
          status: 'available',
          supportedFeatures: ['test_generation', 'optimization', 'analysis']
        },
        {
          id: 'huggingface-codegen',
          name: 'Code Generation Model',
          type: 'huggingface',
          capabilities: ['code_generation'],
          pricing: { input: 0.01, output: 0.02 },
          status: 'available',
          supportedFeatures: ['test_generation']
        }
      ];

      mockAIManager.getAvailableProviders.mockResolvedValue(mockProviders);
      mockAIManager.getDefaultProvider.mockReturnValue('openai-gpt-4');

      const response = await app.request('/api/ai/models', { method: 'GET' });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.providers).toHaveLength(2);
      expect(body.data.providers[0].name).toBe('GPT-4');
      expect(body.data.defaultProvider).toBe('openai-gpt-4');
      expect(body.data.totalProviders).toBe(2);
    });

    it('should handle provider service failures', async () => {
      mockAIManager.getAvailableProviders.mockRejectedValue(new Error('Provider service unavailable'));

      const response = await app.request('/api/ai/models', { method: 'GET' });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Internal server error');
      expect(body.message).toBe('Failed to retrieve model information');
    });
  });

  describe('GET /api/ai/health', () => {
    it('should return healthy status when all services are operational', async () => {
      mockAIManager.getHealthStatus.mockResolvedValue({ status: 'healthy', responseTime: 45 });
      mockCacheManager.getHealthStatus.mockResolvedValue({ status: 'healthy', hitRate: 0.85 });

      const response = await app.request('/api/ai/health', { method: 'GET' });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
      expect(body.data.services.aiManager.status).toBe('healthy');
      expect(body.data.services.cacheManager.status).toBe('healthy');
      expect(body.data.version).toBe('1.0.0');
      expect(body.data.uptime).toBeGreaterThan(0);
    });

    it('should return degraded status when services have issues', async () => {
      mockAIManager.getHealthStatus.mockRejectedValue(new Error('AI Manager down'));
      mockCacheManager.getHealthStatus.mockResolvedValue({ status: 'healthy' });

      const response = await app.request('/api/ai/health', { method: 'GET' });

      expect(response.status).toBe(503);
      const body = await response.json();

      expect(body.success).toBe(false);
      expect(body.data.status).toBe('degraded');
      expect(body.data.error).toBeDefined();
    });
  });

  describe('POST /api/ai/cache/clear', () => {
    it('should clear cache successfully for admin users', async () => {
      mockCacheManager.clearCache.mockResolvedValue(25);

      const response = await app.request('/api/ai/cache/clear', {
        method: 'POST',
        headers: {
          'x-user-id': 'admin-123',
          'x-admin-role': 'true'
        }
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.clearedEntries).toBe(25);
      expect(body.data.cacheKey).toBe('all');
    });

    it('should reject cache clear requests from non-admin users', async () => {
      const response = await app.request('/api/ai/cache/clear', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' }
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(body.message).toBe('Admin access required');
    });

    it('should clear specific cache key when provided', async () => {
      mockCacheManager.clearCache.mockResolvedValue(1);

      const response = await app.request('/api/ai/cache/clear?key=test-key-123', {
        method: 'POST',
        headers: {
          'x-user-id': 'admin-123',
          'x-admin-role': 'true'
        }
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.cacheKey).toBe('test-key-123');
      expect(body.data.clearedEntries).toBe(1);
    });
  });

  describe('GET /api/ai/capabilities', () => {
    it('should return comprehensive capabilities information', async () => {
      const response = await app.request('/api/ai/capabilities', { method: 'GET' });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data.testGeneration).toBeDefined();
      expect(body.data.testGeneration.supportedPlatforms).toContain('web');
      expect(body.data.testGeneration.supportedFrameworks).toContain('playwright');
      expect(body.data.testOptimization).toBeDefined();
      expect(body.data.failureAnalysis).toBeDefined();
      expect(body.data.limits).toBeDefined();
      expect(body.data.limits.maxTestsPerRequest).toBe(50);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const requestBody = {
        description: 'Test login functionality',
        platform: 'web'
      };

      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: true,
        remainingQuota: 500
      });
      mockTestGenerator.generateTests.mockResolvedValue(createMockTestGenerationResult());

      // Make multiple requests within limit
      for (let i = 0; i < 5; i++) {
        const response = await app.request('/api/ai/generate-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'user-123',
            'cf-connecting-ip': '192.168.1.1'
          },
          body: JSON.stringify(requestBody)
        });

        expect(response.status).toBe(200);
      }
    });

    it('should reject requests when rate limit is exceeded', async () => {
      const requestBody = {
        description: 'Test login functionality',
        platform: 'web'
      };

      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: true,
        remainingQuota: 500
      });

      // Make requests that exceed rate limit
      const responses = [];
      for (let i = 0; i < 105; i++) {
        const response = await app.request('/api/ai/generate-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'user-123',
            'cf-connecting-ip': '192.168.1.2'
          },
          body: JSON.stringify(requestBody)
        });
        responses.push(response.status);
      }

      // At least one request should be rate limited
      expect(responses.some(status => status === 429)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing content-type header', async () => {
      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        body: '{"description": "test"}'
      });

      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON', async () => {
      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"description": "test"' // Invalid JSON
      });

      expect(response.status).toBe(400);
    });

    it('should include timestamp and path in error responses', async () => {
      mockTestGenerator.generateTests.mockRejectedValue(new Error('Service error'));
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: true,
        remainingQuota: 500
      });

      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123'
        },
        body: JSON.stringify({
          description: 'test login',
          platform: 'web'
        })
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.timestamp).toBeDefined();
      expect(body.path).toBe('/api/ai/generate-test');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complex test generation with all options', async () => {
      const requestBody = {
        description: 'Comprehensive e-commerce checkout flow testing including payment processing, inventory management, and user authentication scenarios',
        platform: 'web',
        framework: 'playwright',
        context: {
          applicationType: 'web',
          targetEnvironment: 'production',
          existingTests: ['login-spec.ts', 'product-page-spec.ts'],
          testingGuidelines: 'Follow AAA pattern, use data-driven testing, include accessibility tests',
          performanceRequirements: {
            maxExecutionTime: 30000,
            maxFailureRate: 0.05
          }
        },
        options: {
          includeEdgeCases: true,
          generateAssertions: true,
          complexity: 'advanced',
          outputFormat: 'typescript'
        }
      };

      const mockResult = createMockTestGenerationResult();
      mockResult.generatedTests = [
        {
          id: 'test-1',
          name: 'Checkout Flow - Happy Path',
          content: 'complex test content for checkout',
          type: 'checkout',
          assertions: ['verifyCartUpdated', 'verifyPaymentProcessed'],
          estimatedDuration: 25000
        },
        {
          id: 'test-2',
          name: 'Checkout Flow - Payment Failure',
          content: 'complex test content for payment failure',
          type: 'checkout',
          assertions: ['verifyErrorMessage', 'verifyCartRetained'],
          estimatedDuration: 20000
        }
      ];
      mockResult.estimatedExecutionTime = 45000;
      mockResult.complexityLevel = 'advanced';

      mockTestGenerator.generateTests.mockResolvedValue(mockResult);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canGenerateTest: true,
        remainingQuota: 700
      });

      const response = await app.request('/api/ai/generate-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123',
          'x-project-id': 'ecommerce-project'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.data.generatedTests).toHaveLength(2);
      expect(body.data.metadata.complexityLevel).toBe('advanced');
      expect(body.data.metadata.estimatedExecutionTime).toBe(45000);
      expect(body.data.metadata.testCount).toBe(2);
    });

    it('should handle comprehensive failure analysis with regression detection', async () => {
      const recentChange = new Date();
      recentChange.setHours(recentChange.getHours() - 2);

      const requestBody = {
        failures: [
          {
            id: 'failure-1',
            testCaseId: 'test-1',
            testName: 'Critical Payment Processing Test',
            testType: 'api',
            platform: 'node',
            failureTime: new Date().toISOString(),
            errorMessage: 'Payment gateway returned 500 error',
            errorType: 'api_error',
            networkLogs: [
              {
                url: 'https://api.payment.com/process',
                method: 'POST',
                status: 500,
                responseTime: 5000,
                error: 'Internal Server Error'
              }
            ],
            consoleLogs: [
              {
                level: 'error',
                message: 'Payment processing failed',
                timestamp: new Date().toISOString(),
                source: 'payment-service'
              }
            ],
            executionContext: {
              environment: 'production',
              testData: { paymentId: 'test-123', amount: 99.99 }
            },
            previousRuns: [
              {
                timestamp: new Date(Date.now() - 60 * 60 * 1000),
                status: 'passed',
                duration: 2000
              }
            ]
          }
        ],
        projectContext: {
          framework: 'jest',
          targetPlatforms: ['node'],
          applicationType: 'api',
          recentChanges: [
            {
              type: 'code',
              description: 'Updated payment gateway integration',
              timestamp: recentChange.toISOString()
            }
          ],
          environmentInfo: {
            networkConditions: 'stable'
          }
        },
        analysisType: 'regression_detection',
        priority: 'critical',
        integrationSettings: {
          bugTracker: 'jira',
          autoCreateTickets: true,
          notificationSettings: {
            slack: '#critical-alerts',
            email: 'devops@company.com'
          }
        }
      };

      const mockAnalysisResult = createMockBugAnalysisResult();
      mockAnalysisResult.regressionAnalysis = {
        regressionDetected: true,
        suspectedChanges: [
          {
            changeType: 'code',
            description: 'Updated payment gateway integration',
            likelihood: 0.9,
            evidence: ['Change occurred 2 hours ago', 'First failure after change']
          }
        ],
        impactAssessment: {
          affectedFeatures: ['payment processing'],
          affectedTests: ['test-1'],
          severity: 'critical'
        },
        firstSeenFailure: new Date(),
        recommendedActions: ['Investigate payment gateway changes', 'Consider rollback', 'Monitor system health']
      };

      mockBugAnalyzer.analyzeFailures.mockResolvedValue(mockAnalysisResult);
      mockCostTracker.checkUserLimits.mockResolvedValue({
        canAnalyzeFailure: true,
        remainingQuota: 600
      });

      const response = await app.request('/api/ai/analyze-failure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'user-123',
          'x-project-id': 'payment-project'
        },
        body: JSON.stringify(requestBody)
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body.data.regressionAnalysis).toBeDefined();
      expect(body.data.regressionAnalysis.regressionDetected).toBe(true);
      expect(body.data.regressionAnalysis.suspectedChanges).toHaveLength(1);
      expect(body.data.regressionAnalysis.impactAssessment.severity).toBe('critical');
      expect(body.data.metadata.analysisType).toBe('regression_detection');
    });
  });
});

// Helper functions to create mock objects
function createMockTestGenerationResult() {
  return {
    id: 'gen-123',
    requestId: 'req-456',
    generatedTests: [
      {
        id: 'test-1',
        name: 'Login Test',
        content: 'test login functionality with valid credentials',
        type: 'authentication',
        framework: 'playwright',
        platform: 'web',
        assertions: ['verifyLoginSuccess', 'verifyDashboardAccess'],
        estimatedDuration: 5000
      },
      {
        id: 'test-2',
        name: 'Login Failure Test',
        content: 'test login with invalid credentials',
        type: 'authentication',
        framework: 'playwright',
        platform: 'web',
        assertions: ['verifyErrorMessage', 'verifyLoginFailure'],
        estimatedDuration: 3000
      }
    ],
    platform: 'web',
    framework: 'playwright',
    confidence: 0.9,
    estimatedExecutionTime: 8000,
    complexityLevel: 'intermediate',
    generationTime: 2500,
    tokensUsed: 150,
    cost: 0.75
  };
}

function createMockTestOptimizationResult() {
  return {
    id: 'opt-123',
    requestId: 'req-789',
    optimizations: [
      {
        id: 'opt-1',
        type: 'flakiness_fix',
        category: 'reliability',
        title: 'Fix element selector stability',
        description: 'Update selectors to be more resilient to DOM changes',
        testIds: ['test-1'],
        impact: {
          level: 'high',
          description: 'Significantly reduce test flakiness',
          metrics: { reliabilityImprovement: 0.3, performanceImprovement: 0.1 }
        },
        implementation: {
          effort: 'low',
          risk: 'low',
          steps: ['Update selectors', 'Add explicit waits', 'Test stability']
        },
        confidence: 0.85
      },
      {
        id: 'opt-2',
        type: 'performance_optimization',
        category: 'performance',
        title: 'Optimize test execution time',
        description: 'Reduce unnecessary waits and optimize test flow',
        testIds: ['test-1'],
        impact: {
          level: 'medium',
          description: 'Improve test execution speed',
          metrics: { performanceImprovement: 0.4 }
        },
        implementation: {
          effort: 'medium',
          risk: 'low',
          steps: ['Remove redundant waits', 'Optimize assertions', 'Parallelize operations']
        },
        confidence: 0.8
      }
    ],
    summary: {
      totalOptimizations: 2,
      optimizationsByType: {
        flakiness_fix: 1,
        performance_optimization: 1
      },
      optimizationsByCategory: {
        reliability: 1,
        performance: 1
      },
      priorityTests: ['test-1'],
      quickWins: [{ id: 'opt-1', title: 'Fix element selector stability' }],
      strategicImprovements: [{ id: 'opt-2', title: 'Optimize test execution time' }],
      estimatedTotalImpact: {
        reliabilityImprovement: 0.3,
        performanceImprovement: 0.5,
        maintainabilityScore: 0,
        effortSaved: 45
      }
    },
    estimatedImpact: {
      reliabilityImprovement: 0.3,
      performanceImprovement: 0.4,
      maintainabilityScore: 0.2,
      estimatedEffortSaved: 45
    },
    confidence: 0.82
  };
}

function createMockBugAnalysisResult() {
  return {
    id: 'analysis-123',
    requestId: 'req-999',
    analysisType: 'comprehensive',
    failures: [
      {
        id: 'failure-1',
        testCaseId: 'test-1',
        testName: 'Login Test',
        testType: 'web',
        platform: 'chrome',
        failureTime: new Date(),
        errorMessage: 'Element not found: #login-button',
        errorType: 'element_not_found'
      }
    ],
    classifications: [
      {
        failureId: 'failure-1',
        category: 'element_not_found',
        severity: 'medium',
        subcategory: 'ui_element_missing',
        description: 'UI element not found during test execution',
        symptoms: ['Element not present in DOM'],
        potentialCauses: ['Element removed', 'Incorrect selector'],
        diagnosticSteps: ['Inspect DOM', 'Verify selector'],
        confidence: 0.9,
        relatedFailures: [],
        tags: ['ui', 'selector']
      }
    ],
    rootCauseAnalysis: {
      primaryCause: {
        type: 'ui_element_missing',
        description: 'UI element expected in test is not present',
        likelihood: 0.85,
        evidence: ['Element not found in DOM']
      },
      contributingFactors: [],
      affectedComponents: [],
      reproductionSteps: ['Navigate to page', 'Wait for element'],
      investigationPath: [],
      confidence: 0.85
    },
    suggestedFixes: [
      {
        id: 'fix-1',
        type: 'code_fix',
        title: 'Update element selector',
        description: 'Update the test selector to match current UI',
        priority: 'medium',
        effort: 'low',
        risk: 'low',
        steps: ['Update selector', 'Test functionality'],
        verificationSteps: ['Run updated test'],
        estimatedTimeToFix: 15,
        confidence: 0.9
      }
    ],
    patternAnalysis: undefined,
    regressionAnalysis: undefined,
    relatedIssues: [],
    bugTickets: [],
    summary: {
      totalFailures: 1,
      criticalFailures: 0,
      highFailures: 0,
      categories: { element_not_found: 1 },
      severityDistribution: { critical: 0, high: 0, medium: 1, low: 0 },
      recommendedImmediateActions: ['Update selectors'],
      recommendedLongTermActions: ['Improve element waiting strategies'],
      estimatedResolutionTime: 30,
      potentialImpact: {
        usersAffected: 0,
        featuresAffected: ['login'],
        revenueImpact: 'low'
      }
    },
    confidence: 0.88
  };
}
