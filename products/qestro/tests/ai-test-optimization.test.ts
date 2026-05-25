/**
 * Test Suite for AI Test Optimization and Enhancement Service
 * Tests test optimization, flakiness detection, performance analysis,
 * and quality improvement recommendations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AITestOptimizer, TestOptimizationRequest, OptimizationType } from '../../src/services/ai/test-optimizer';
import { AIManager } from '../../src/services/ai/ai-manager';
import { AICostTracker } from '../../src/services/ai/cost-tracker';
import { AICacheManager } from '../../src/services/ai/cache-manager';

// Mock dependencies
vi.mock('../../src/services/ai/ai-manager');
vi.mock('../../src/services/ai/cost-tracker');
vi.mock('../../src/services/ai/cache-manager');

describe('AITestOptimizer', () => {
  let testOptimizer: AITestOptimizer;
  let mockAIManager: vi.Mocked<AIManager>;
  let mockCostTracker: vi.Mocked<AICostTracker>;
  let mockCacheManager: vi.Mocked<AICacheManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAIManager = {
      executeRequest: vi.fn()
    } as any;

    mockCostTracker = {
      trackUsage: vi.fn().mockResolvedValue(undefined)
    } as any;

    mockCacheManager = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined)
    } as any;

    (AIManager as any).mockImplementation(() => mockAIManager);
    (AICostTracker as any).mockImplementation(() => mockCostTracker);
    (AICacheManager as any).mockImplementation(() => mockCacheManager);

    testOptimizer = new AITestOptimizer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('optimizeTests', () => {
    it('should generate comprehensive optimization suggestions', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'comprehensive',
        priority: 'high',
        tests: [
          {
            id: 'test1',
            name: 'Login Test',
            type: 'web',
            content: `
              describe('Login', () => {
                it('should login successfully', async () => {
                  await page.goto('/login');
                  await page.fill('#username', 'user@example.com');
                  await page.fill('#password', 'password123');
                  await page.click('#login-button');
                  await expect(page.locator('.welcome')).toBeVisible();
                });
              });
            `,
            metadata: {
              lastRunStatus: 'failed',
              averageExecutionTime: 5000,
              lastRunDuration: 8000,
              runCount: 50,
              failureRate: 0.3,
              lastFailure: '2025-10-30T10:00:00Z',
              complexity: 'medium',
              coverage: ['login', 'authentication']
            }
          },
          {
            id: 'test2',
            name: 'Search Test',
            type: 'web',
            content: `
              describe('Search', () => {
                it('should search for products', async () => {
                  await page.goto('/');
                  await page.fill('#search', 'laptop');
                  await sleep(2000);
                  await page.click('#search-button');
                  await expect(page.locator('.results')).toContainText('laptop');
                });
              });
            `,
            metadata: {
              lastRunStatus: 'passed',
              averageExecutionTime: 3000,
              lastRunDuration: 3500,
              runCount: 100,
              failureRate: 0.05,
              complexity: 'low',
              coverage: ['search', 'products']
            }
          }
        ],
        projectContext: {
          framework: 'Playwright',
          targetPlatforms: ['Chrome', 'Firefox'],
          performanceThresholds: {
            maxExecutionTime: 5000,
            maxFailureRate: 0.1
          }
        }
      };

      const mockAIResponse = {
        id: 'ai-response-123',
        content: JSON.stringify({
          optimizations: [
            {
              type: 'flakiness_fix',
              category: 'reliability',
              title: 'Fix Login Test Flakiness',
              description: 'The login test has high failure rate due to timing issues',
              testIds: ['test1'],
              impact: {
                level: 'high',
                description: 'Significantly improve test reliability',
                metrics: {
                  reliabilityImprovement: 0.6,
                  performanceImprovement: 0.2,
                  maintainabilityImprovement: 0.1
                }
              },
              implementation: {
                effort: 'medium',
                risk: 'low',
                steps: [
                  'Add explicit wait for login button to be clickable',
                  'Implement proper authentication state management',
                  'Add retry mechanism for network failures'
                ],
                codeChanges: [{
                  testId: 'test1',
                  original: 'await page.click(\'#login-button\');',
                  optimized: 'await page.waitForSelector(\'#login-button\', { state: \'visible\' });\nawait page.click(\'#login-button\');',
                  explanation: 'Adding explicit wait ensures element is ready for interaction'
                }]
              },
              reasoning: 'High failure rate indicates timing and stability issues',
              confidence: 0.9
            },
            {
              type: 'performance_optimization',
              category: 'performance',
              title: 'Remove Explicit Sleep in Search Test',
              description: 'Replace hardcoded sleep with efficient wait condition',
              testIds: ['test2'],
              impact: {
                level: 'medium',
                description: 'Reduce test execution time and improve reliability',
                metrics: {
                  performanceImprovement: 0.4,
                  reliabilityImprovement: 0.2,
                  maintainabilityImprovement: 0.1
                }
              },
              implementation: {
                effort: 'low',
                risk: 'low',
                steps: [
                  'Replace sleep() with waitForSelector()',
                  'Add condition-based waiting'
                ],
                codeChanges: [{
                  testId: 'test2',
                  original: 'await sleep(2000);',
                  optimized: 'await page.waitForSelector(\'.loading\', { state: \'hidden\' });',
                  explanation: 'Replace fixed wait with condition-based wait for better performance'
                }]
              },
              reasoning: 'Hardcoded sleeps are inefficient and unreliable',
              confidence: 0.95
            }
          ],
          summary: {
            totalOptimizations: 2,
            priorityTests: ['test1', 'test2'],
            quickWins: ['opt_1'],
            strategicImprovements: ['opt_0']
          }
        }),
        confidence: 0.9
      };

      mockAIManager.executeRequest.mockResolvedValue(mockAIResponse);

      // Act
      const result = await testOptimizer.optimizeTests(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.optimizations).toHaveLength(2);
      expect(result.summary.totalOptimizations).toBe(2);
      expect(result.estimatedImpact.reliabilityImprovement).toBeGreaterThan(0);
      expect(result.estimatedImpact.performanceImprovement).toBeGreaterThan(0);
      expect(result.confidence).toBe(0.9);

      // Verify optimization types and categories
      expect(result.optimizations[0].type).toBe('flakiness_fix');
      expect(result.optimizations[0].category).toBe('reliability');
      expect(result.optimizations[1].type).toBe('performance_optimization');
      expect(result.optimizations[1].category).toBe('performance');

      // Verify implementation details
      expect(result.optimizations[0].implementation.steps).toContain('Add explicit wait for login button to be clickable');
      expect(result.optimizations[1].implementation.codeChanges).toHaveLength(1);
      expect(result.optimizations[1].implementation.codeChanges[0].original).toBe('await sleep(2000);');

      // Verify AI manager was called
      expect(mockAIManager.executeRequest).toHaveBeenCalledTimes(1);
      expect(mockCostTracker.trackUsage).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should return cached result when available', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'performance',
        priority: 'medium',
        tests: [{
          id: 'test1',
          name: 'Simple Test',
          type: 'web',
          content: 'it("should work", () => {});',
          metadata: {
            runCount: 10,
            failureRate: 0,
            complexity: 'low'
          }
        }]
      };

      const cachedResult = {
        id: 'cached-123',
        optimizations: [],
        summary: { totalOptimizations: 0 },
        estimatedImpact: {
          reliabilityImprovement: 0,
          performanceImprovement: 0,
          maintainabilityScore: 0,
          estimatedEffortSaved: 0
        },
        confidence: 0.8,
        generatedAt: new Date()
      };

      mockCacheManager.get.mockResolvedValue({
        response: { content: JSON.stringify(cachedResult) }
      } as any);

      // Act
      const result = await testOptimizer.optimizeTests(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('cached-123');
      expect(mockAIManager.executeRequest).not.toHaveBeenCalled();
      expect(mockCacheManager.get).toHaveBeenCalledTimes(1);
    });

    it('should handle AI response parsing failure gracefully', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'comprehensive',
        priority: 'high',
        tests: [{
          id: 'test1',
          name: 'Failing Test',
          type: 'web',
          content: 'failing test content',
          metadata: {
            runCount: 10,
            failureRate: 0.8, // High failure rate
            complexity: 'high',
            lastRunStatus: 'failed'
          }
        }]
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-123',
        content: 'Invalid JSON response',
        confidence: 0.5
      });

      // Act
      const result = await testOptimizer.optimizeTests(request);

      // Assert
      expect(result).toBeDefined();
      expect(result.optimizations).toHaveLength(1);
      expect(result.optimizations[0].type).toBe('flakiness_fix');
      expect(result.optimizations[0].title).toContain('Reduce flakiness');
      expect(result.optimizations[0].confidence).toBe(0.7);
    });
  });

  describe('Test Analysis Methods', () => {
    it('should calculate flakiness score correctly', async () => {
      // Arrange
      const testWithHighFailureRate = {
        id: 'test1',
        name: 'Flaky Test',
        type: 'web' as const,
        content: 'test content',
        metadata: {
          runCount: 50,
          failureRate: 0.6, // 60% failure rate
          complexity: 'high' as const,
          lastFailure: '2025-10-31T00:00:00Z', // Recent failure
          averageExecutionTime: 5000,
          lastRunDuration: 7000
        }
      };

      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'reliability',
        priority: 'high',
        tests: [testWithHighFailureRate]
      };

      // Mock AI manager to prevent actual AI calls
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({ optimizations: [], summary: { totalOptimizations: 0 } }),
        confidence: 0.8
      });

      // Act
      await testOptimizer.optimizeTests(request);

      // Assert - The flakiness score should be calculated internally
      // We can't directly access it, but we know high failure rate + high complexity + recent failure
      // should result in a high flakiness score
      expect(mockAIManager.executeRequest).toHaveBeenCalled();

      const promptCall = mockAIManager.executeRequest.mock.calls[0][0];
      expect(promptCall.input).toContain('Flakiness Score:');
    });

    it('should identify performance issues correctly', async () => {
      // Arrange
      const slowTest = {
        id: 'test1',
        name: 'Slow Test',
        type: 'web' as const,
        content: 'test with sleep(5000) and other delays',
        metadata: {
          runCount: 20,
          failureRate: 0.1,
          complexity: 'medium' as const,
          lastRunDuration: 8000, // Very slow
          averageExecutionTime: 6000
        }
      };

      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'performance',
        priority: 'medium',
        tests: [slowTest],
        projectContext: {
          framework: 'Playwright',
          targetPlatforms: ['Chrome'],
          performanceThresholds: {
            maxExecutionTime: 5000, // Threshold is 5000ms, test takes 8000ms
            maxFailureRate: 0.15
          }
        }
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({ optimizations: [], summary: { totalOptimizations: 0 } }),
        confidence: 0.8
      });

      // Act
      await testOptimizer.optimizeTests(request);

      // Assert
      const promptCall = mockAIManager.executeRequest.mock.calls[0][0];
      expect(promptCall.input).toContain('Performance Issues:');
      expect(promptCall.input).toContain('slow_execution');
    });

    it('should calculate quality metrics accurately', async () => {
      // Arrange
      const complexTest = {
        id: 'test1',
        name: 'Complex Test',
        type: 'web' as const,
        content: 'a'.repeat(1000), // Long content
        metadata: {
          runCount: 30,
          failureRate: 0.2,
          complexity: 'high' as const,
          coverage: ['feature1', 'feature2', 'feature3', 'feature4', 'feature5']
        }
      };

      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'maintainability',
        priority: 'low',
        tests: [complexTest]
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({ optimizations: [], summary: { totalOptimizations: 0 } }),
        confidence: 0.8
      });

      // Act
      await testOptimizer.optimizeTests(request);

      // Assert
      const promptCall = mockAIManager.executeRequest.mock.calls[0][0];
      expect(promptCall.input).toContain('Quality Metrics:');
      expect(promptCall.input).toContain('complexity');
      expect(promptCall.input).toContain('maintainability');
      expect(promptCall.input).toContain('readability');
      expect(promptCall.input).toContain('coverage');
    });
  });

  describe('Optimization Types', () => {
    const mockTest = {
      id: 'test1',
      name: 'Test for optimization',
      type: 'web' as const,
      content: 'test content',
      metadata: {
        runCount: 10,
        failureRate: 0,
        complexity: 'medium' as const
      }
    };

    const baseRequest: TestOptimizationRequest = {
      userId: 'user123',
      projectId: 'project456',
      tests: [mockTest]
    };

    it('should handle reliability-focused optimization', async () => {
      const request = {
        ...baseRequest,
        optimizationType: 'reliability' as const,
        priority: 'high' as const
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({
          optimizations: [{
            type: 'flakiness_fix' as OptimizationType,
            category: 'reliability',
            title: 'Improve Test Reliability',
            description: 'Make test more stable',
            testIds: ['test1'],
            impact: {
              level: 'high' as const,
              description: 'Significant reliability improvement',
              metrics: { reliabilityImprovement: 0.8 }
            },
            implementation: {
              effort: 'medium' as const,
              risk: 'low' as const,
              steps: ['Step 1', 'Step 2']
            },
            reasoning: 'Test needs reliability improvements',
            confidence: 0.9
          }],
          summary: { totalOptimizations: 1, priorityTests: [], quickWins: [], strategicImprovements: [] }
        }),
        confidence: 0.9
      });

      const result = await testOptimizer.optimizeTests(request);

      expect(result.optimizations[0].type).toBe('flakiness_fix');
      expect(result.optimizations[0].category).toBe('reliability');
    });

    it('should handle performance-focused optimization', async () => {
      const request = {
        ...baseRequest,
        optimizationType: 'performance' as const,
        priority: 'medium' as const
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({
          optimizations: [{
            type: 'performance_optimization' as OptimizationType,
            category: 'performance',
            title: 'Optimize Test Performance',
            description: 'Make test run faster',
            testIds: ['test1'],
            impact: {
              level: 'medium' as const,
              description: 'Performance improvement',
              metrics: { performanceImprovement: 0.6 }
            },
            implementation: {
              effort: 'low' as const,
              risk: 'low' as const,
              steps: ['Optimize waits']
            },
            reasoning: 'Test is slow',
            confidence: 0.85
          }],
          summary: { totalOptimizations: 1, priorityTests: [], quickWins: [], strategicImprovements: [] }
        }),
        confidence: 0.85
      });

      const result = await testOptimizer.optimizeTests(request);

      expect(result.optimizations[0].type).toBe('performance_optimization');
      expect(result.optimizations[0].category).toBe('performance');
    });

    it('should handle maintainability-focused optimization', async () => {
      const request = {
        ...baseRequest,
        optimizationType: 'maintainability' as const,
        priority: 'low' as const
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({
          optimizations: [{
            type: 'code_quality_improvement' as OptimizationType,
            category: 'maintainability',
            title: 'Improve Code Quality',
            description: 'Refactor for better maintainability',
            testIds: ['test1'],
            impact: {
              level: 'low' as const,
              description: 'Better maintainability',
              metrics: { maintainabilityImprovement: 0.4 }
            },
            implementation: {
              effort: 'medium' as const,
              risk: 'low' as const,
              steps: ['Refactor code']
            },
            reasoning: 'Code needs improvement',
            confidence: 0.8
          }],
          summary: { totalOptimizations: 1, priorityTests: [], quickWins: [], strategicImprovements: [] }
        }),
        confidence: 0.8
      });

      const result = await testOptimizer.optimizeTests(request);

      expect(result.optimizations[0].type).toBe('code_quality_improvement');
      expect(result.optimizations[0].category).toBe('maintainability');
    });
  });

  describe('applyOptimizations', () => {
    it('should apply optimizations to specified tests', async () => {
      // Act
      const result = await testOptimizer.applyOptimizations('user123', 'opt123', ['test1', 'test2']);

      // Assert
      expect(result.applied).toEqual(['test1', 'test2']);
      expect(result.failed).toEqual([]);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].optimizedContent).toContain('Optimized content for test1');
    });
  });

  describe('getOptimizationHistory', () => {
    it('should return optimization history and trends', async () => {
      // Act
      const history = await testOptimizer.getOptimizationHistory('user123', 'project456', 'month');

      // Assert
      expect(history).toBeDefined();
      expect(history.totalOptimizations).toBe(0);
      expect(history.appliedOptimizations).toBe(0);
      expect(history.improvementTrends).toHaveProperty('reliability');
      expect(history.improvementTrends).toHaveProperty('performance');
      expect(history.improvementTrends).toHaveProperty('maintainability');
      expect(history.topOptimizationTypes).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle optimization errors gracefully', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'comprehensive',
        priority: 'high',
        tests: [{
          id: 'test1',
          name: 'Error Test',
          type: 'web',
          content: 'test content',
          metadata: {
            runCount: 1,
            failureRate: 0,
            complexity: 'low'
          }
        }]
      };

      mockAIManager.executeRequest.mockRejectedValue(new Error('AI service unavailable'));

      // Act & Assert
      await expect(testOptimizer.optimizeTests(request)).rejects.toThrow('Failed to optimize tests: AI service unavailable');
    });

    it('should handle empty test list', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'comprehensive',
        priority: 'medium',
        tests: []
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({ optimizations: [], summary: { totalOptimizations: 0 } }),
        confidence: 0.8
      });

      // Act
      const result = await testOptimizer.optimizeTests(request);

      // Assert
      expect(result.optimizations).toEqual([]);
      expect(result.summary.totalOptimizations).toBe(0);
    });
  });

  describe('Cache Integration', () => {
    it('should check cache before making AI calls', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'performance',
        priority: 'medium',
        tests: [{
          id: 'test1',
          name: 'Cached Test',
          type: 'web',
          content: 'test content',
          metadata: {
            runCount: 5,
            failureRate: 0,
            complexity: 'low'
          }
        }]
      };

      // First call - cache miss
      mockCacheManager.get.mockResolvedValue(null);
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({ optimizations: [], summary: { totalOptimizations: 0 } }),
        confidence: 0.8
      });

      // Act
      await testOptimizer.optimizeTests(request);

      // Assert
      expect(mockCacheManager.get).toHaveBeenCalledTimes(1);
      expect(mockAIManager.executeRequest).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should store results in cache', async () => {
      // Arrange
      const request: TestOptimizationRequest = {
        userId: 'user123',
        projectId: 'project456',
        optimizationType: 'comprehensive',
        priority: 'high',
        tests: [{
          id: 'test1',
          name: 'Cache Storage Test',
          type: 'web',
          content: 'test content',
          metadata: {
            runCount: 10,
            failureRate: 0,
            complexity: 'medium'
          }
        }]
      };

      mockCacheManager.get.mockResolvedValue(null);
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response',
        content: JSON.stringify({
          optimizations: [{
            type: 'performance_optimization' as OptimizationType,
            category: 'performance',
            title: 'Cache Test Optimization',
            description: 'Test caching',
            testIds: ['test1'],
            impact: {
              level: 'low' as const,
              description: 'Test impact',
              metrics: {}
            },
            implementation: {
              effort: 'low' as const,
              risk: 'low' as const,
              steps: ['Test step']
            },
            reasoning: 'Test reasoning',
            confidence: 0.8
          }],
          summary: { totalOptimizations: 1, priorityTests: [], quickWins: [], strategicImprovements: [] }
        }),
        confidence: 0.8
      });

      // Act
      await testOptimizer.optimizeTests(request);

      // Assert
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generate_tests',
          userId: 'user123'
        }),
        expect.objectContaining({
          content: expect.stringContaining('Cache Test Optimization'),
          confidence: 0.8
        })
      );
    });
  });
});

describe('AITestOptimizer Integration', () => {
  it('should handle real-world optimization scenario', async () => {
    // This test simulates a real-world scenario with multiple test types
    const testOptimizer = new AITestOptimizer();

    const request: TestOptimizationRequest = {
      userId: 'enterprise-user',
      projectId: 'saas-platform',
      optimizationType: 'comprehensive',
      priority: 'high',
      tests: [
        {
          id: 'mobile-login-test',
          name: 'Mobile App Login Flow',
          type: 'mobile',
          platform: 'iOS',
          content: `
            - tapOn: "Login"
            - inputText: "user@example.com"
            - inputText: "password123"
            - tapOn: "Sign In"
            - assertVisible: "Welcome"
          `,
          metadata: {
            lastRunStatus: 'flaky',
            averageExecutionTime: 8000,
            lastRunDuration: 12000,
            runCount: 100,
            failureRate: 0.4,
            lastFailure: '2025-10-31T08:00:00Z',
            complexity: 'medium',
            coverage: ['authentication', 'mobile-app']
          }
        },
        {
          id: 'web-api-test',
          name: 'API Endpoint Validation',
          type: 'api',
          content: `
            GET /api/users
            EXPECT status 200
            EXPECT contains "users"
          `,
          metadata: {
            lastRunStatus: 'passed',
            averageExecutionTime: 1500,
            lastRunDuration: 1800,
            runCount: 200,
            failureRate: 0.02,
            complexity: 'low',
            coverage: ['api', 'users']
          }
        },
        {
          id: 'web-checkout-test',
          name: 'E-commerce Checkout Flow',
          type: 'web',
          content: `
            describe('Checkout', () => {
              it('should complete purchase', async () => {
                await page.goto('/checkout');
                await page.fill('#email', 'test@example.com');
                await page.fill('#card', '4242424242424242');
                await page.fill('#expiry', '12/25');
                await page.fill('#cvv', '123');
                await page.click('#submit-payment');
                await sleep(5000);
                await expect(page.locator('.success')).toBeVisible();
              });
            });
          `,
          metadata: {
            lastRunStatus: 'failed',
            averageExecutionTime: 15000,
            lastRunDuration: 20000,
            runCount: 25,
            failureRate: 0.6,
            lastFailure: '2025-10-30T15:30:00Z',
            complexity: 'high',
            coverage: ['checkout', 'payment', 'e-commerce']
          }
        }
      ],
      projectContext: {
        framework: 'Multi-framework (Maestro, Playwright, Custom API)',
        targetPlatforms: ['iOS', 'Android', 'Web', 'API'],
        performanceThresholds: {
          maxExecutionTime: 10000,
          maxFailureRate: 0.1
        }
      }
    };

    // Mock comprehensive AI response for this complex scenario
    vi.mocked(AIManager.prototype.executeRequest).mockResolvedValue({
      id: 'comprehensive-ai-response',
      content: JSON.stringify({
        optimizations: [
          {
            type: 'flakiness_fix',
            category: 'reliability',
            title: 'Stabilize Mobile Login Timing',
            description: 'Add proper waits and retry logic for mobile login flow',
            testIds: ['mobile-login-test'],
            impact: {
              level: 'high',
              description: 'Reduce mobile test failures by 60%',
              metrics: {
                reliabilityImprovement: 0.6,
                performanceImprovement: 0.1,
                maintainabilityImprovement: 0.2
              }
            },
            implementation: {
              effort: 'medium',
              risk: 'low',
              steps: [
                'Add waitForElementVisible before interactions',
                'Implement retry mechanism for network failures',
                'Add device state validation'
              ],
              codeChanges: [{
                testId: 'mobile-login-test',
                original: '- tapOn: "Login"',
                optimized: '- waitForElementVisible: "Login", timeout: 5000\n- tapOn: "Login"',
                explanation: 'Add explicit wait to ensure element is ready for interaction'
              }]
            },
            reasoning: 'High failure rate indicates timing and device state issues',
            confidence: 0.9
          },
          {
            type: 'performance_optimization',
            category: 'performance',
            title: 'Optimize Checkout Test Performance',
            description: 'Remove hardcoded sleep and improve wait conditions',
            testIds: ['web-checkout-test'],
            impact: {
              level: 'high',
              description: 'Reduce execution time by 40%',
              metrics: {
                performanceImprovement: 0.4,
                reliabilityImprovement: 0.3,
                maintainabilityImprovement: 0.1
              }
            },
            implementation: {
              effort: 'low',
              risk: 'low',
              steps: [
                'Replace sleep(5000) with condition-based wait',
                'Add loading state detection',
                'Optimize page load waits'
              ],
              codeChanges: [{
                testId: 'web-checkout-test',
                original: 'await sleep(5000);',
                optimized: 'await page.waitForSelector(\'.processing\', { state: \'hidden\' });',
                explanation: 'Replace fixed delay with intelligent wait condition'
              }]
            },
            reasoning: 'Hardcoded delays cause inconsistent performance',
            confidence: 0.95
          },
          {
            type: 'test_consolidation',
            category: 'maintainability',
            title: 'Consolidate Authentication Tests',
            description: 'Merge similar authentication logic into shared utilities',
            testIds: ['mobile-login-test', 'web-checkout-test'],
            impact: {
              level: 'medium',
              description: 'Reduce code duplication and improve maintainability',
              metrics: {
                maintainabilityImprovement: 0.5,
                reliabilityImprovement: 0.2,
                performanceImprovement: 0.1
              }
            },
            implementation: {
              effort: 'high',
              risk: 'medium',
              steps: [
                'Create shared authentication helper functions',
                'Extract common login/assertion logic',
                'Implement cross-platform authentication utilities'
              ]
            },
            reasoning: 'Duplicate authentication code across tests increases maintenance burden',
            confidence: 0.8
          }
        ],
        summary: {
          totalOptimizations: 3,
          priorityTests: ['mobile-login-test', 'web-checkout-test'],
          quickWins: ['opt_1'],
          strategicImprovements: ['opt_2']
        }
      }),
      confidence: 0.9
    });

    // Execute optimization
    const result = await testOptimizer.optimizeTests(request);

    // Verify comprehensive optimization results
    expect(result.optimizations).toHaveLength(3);
    expect(result.summary.totalOptimizations).toBe(3);
    expect(result.estimatedImpact.reliabilityImprovement).toBeGreaterThan(0.5);
    expect(result.estimatedImpact.performanceImprovement).toBeGreaterThan(0.3);
    expect(result.estimatedImpact.estimatedEffortSaved).toBeGreaterThan(30);

    // Verify optimization variety
    const optimizationTypes = result.optimizations.map(opt => opt.type);
    expect(optimizationTypes).toContain('flakiness_fix');
    expect(optimizationTypes).toContain('performance_optimization');
    expect(optimizationTypes).toContain('test_consolidation');

    // Verify multi-platform support
    const affectedTests = result.optimizations.flatMap(opt => opt.testIds);
    expect(affectedTests).toContain('mobile-login-test');
    expect(affectedTests).toContain('web-checkout-test');

    // Verify impact estimates
    expect(result.summary.quickWins).toHaveLength(1);
    expect(result.summary.strategicImprovements).toHaveLength(1);
    expect(result.summary.priorityTests).toContain('mobile-login-test');
    expect(result.summary.priorityTests).toContain('web-checkout-test');
  });
});
