/**
 * Natural Language to Test Generation System Test Suite
 *
 * Comprehensive test coverage for the AI-powered test generation service:
 * - Cross-platform test generation (mobile, web, API)
 * - Context-aware generation with application structure analysis
 * - Quality assessment and confidence scoring
 * - Template-based generation with customization
 * - Performance and scalability testing
 * - Error handling and edge case validation
 * - Integration testing with AI Provider Abstraction Layer
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AITestGenerator } from '../src/services/ai/test-generator';
import { AIManager } from '../src/services/ai/ai-manager';
import { AICacheManager } from '../src/services/ai/cache-manager';
import type {
  TestGenerationRequest,
  GeneratedTest,
  GenerationResult,
  TestGenerationContext,
  GenerationOptions
} from '../src/services/ai/test-generator';

// Mock AI Manager
const mockAIManager = {
  executeRequest: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
} as any;

// Mock Cache Manager
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
} as any;

describe('AITestGenerator', () => {
  let testGenerator: AITestGenerator;
  let mockRequest: TestGenerationRequest;

  beforeEach(() => {
    testGenerator = new AITestGenerator(mockAIManager, mockCacheManager);

    mockRequest = {
      id: 'test-req-1',
      userId: 'user-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      description: 'Test user login functionality with valid credentials',
      platform: 'web',
      framework: 'playwright',
      options: {
        includeAssertions: true,
        includeEdgeCases: false,
        includeTestData: true,
        complexity: 'simple',
        testCount: 1,
        language: 'javascript',
        style: 'bdd',
        includeComments: true,
        includeErrorHandling: false
      },
      priority: 'normal'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with AI Manager and Cache Manager', () => {
      expect(testGenerator).toBeDefined();
    });

    it('should emit initialization event', (done) => {
      const generator = new AITestGenerator(mockAIManager, mockCacheManager);
      generator.on('test-generator-initialized', () => {
        done();
      });
    });
  });

  describe('Test Generation', () => {
    it('should generate tests successfully for web platform', async () => {
      // Mock AI response
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-1',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'User Login Test',
              description: 'Test user login with valid credentials',
              type: 'e2e',
              steps: [
                {
                  action: 'Navigate to login page',
                  target: '/login'
                },
                {
                  action: 'Enter username',
                  target: '#username',
                  value: 'testuser@example.com'
                },
                {
                  action: 'Enter password',
                  target: '#password',
                  value: 'password123'
                },
                {
                  action: 'Click login button',
                  target: '#login-button'
                }
              ],
              assertions: [
                {
                  type: 'element',
                  target: '.welcome-message',
                  operator: 'exists',
                  value: true
                }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 150,
          outputTokens: 300,
          totalTokens: 450
        },
        cost: {
          totalCost: 0.05,
          currency: 'USD'
        },
        processingTime: 2000
      });

      mockCacheManager.get.mockResolvedValue(null); // Cache miss
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result).toBeDefined();
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].name).toBe('User Login Test');
      expect(result.tests[0].platform).toBe('web');
      expect(result.tests[0].framework).toBe('playwright');
      expect(result.tests[0].steps).toHaveLength(4);
      expect(result.tests[0].assertions).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should generate tests for mobile platform with Maestro framework', async () => {
      const mobileRequest = {
        ...mockRequest,
        platform: 'mobile' as const,
        framework: 'maestro'
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-2',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Mobile Login Test',
              description: 'Test mobile app login',
              type: 'e2e',
              steps: [
                {
                  action: 'Launch app',
                  target: 'com.example.app'
                },
                {
                  action: 'Tap login button',
                  target: 'LoginButton'
                },
                {
                  action: 'Enter credentials',
                  target: 'LoginForm'
                }
              ],
              assertions: [
                {
                  type: 'element',
                  target: 'HomeScreen',
                  operator: 'exists',
                  value: true
                }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 120,
          outputTokens: 250,
          totalTokens: 370
        },
        cost: {
          totalCost: 0.04,
          currency: 'USD'
        },
        processingTime: 1800
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mobileRequest);

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].framework).toBe('maestro');
      expect(result.summary.byType.e2e).toBe(1);
    });

    it('should generate API tests', async () => {
      const apiRequest = {
        ...mockRequest,
        platform: 'api' as const,
        description: 'Test user registration API endpoint',
        framework: 'postman'
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-3',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'User Registration API Test',
              description: 'Test user registration endpoint',
              type: 'api',
              steps: [
                {
                  action: 'POST',
                  target: '/api/users/register',
                  value: {
                    email: 'test@example.com',
                    password: 'password123'
                  }
                }
              ],
              assertions: [
                {
                  type: 'element',
                  target: 'status',
                  operator: 'equals',
                  value: 201
                }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300
        },
        cost: {
          totalCost: 0.03,
          currency: 'USD'
        },
        processingTime: 1500
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(apiRequest);

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].type).toBe('api');
      expect(result.summary.byType.api).toBe(1);
    });

    it('should use cached results when available', async () => {
      const cachedResult = {
        requestId: 'test-req-1',
        tests: [
          {
            id: 'cached-test-1',
            name: 'Cached Test',
            description: 'Test from cache',
            type: 'e2e' as const,
            framework: 'playwright',
            language: 'javascript',
            code: 'console.log("cached test");',
            steps: [],
            assertions: [],
            testData: [],
            metadata: {
              generatedAt: new Date(),
              version: '2.0.0',
              author: 'AI Generator',
              context: 'Cached',
              references: [],
              dependencies: [],
              tags: [],
              risk: 'low' as const
            },
            confidence: 0.9,
            quality: 8,
            estimatedDuration: 10,
            tags: []
          }
        ],
        summary: {
          totalTests: 1,
          byType: { e2e: 1 },
          byComplexity: { simple: 1 },
          averageConfidence: 0.9,
          averageQuality: 8,
          totalSteps: 0,
          totalAssertions: 0,
          estimatedTotalDuration: 10
        },
        confidence: 0.9,
        processingTime: 100,
        cost: 0,
        recommendations: [],
        warnings: [],
        errors: []
      };

      mockCacheManager.get.mockResolvedValue({
        entry: {
          response: JSON.stringify(cachedResult)
        }
      } as any);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result).toEqual(cachedResult);
      expect(mockAIManager.executeRequest).not.toHaveBeenCalled();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should handle AI service errors gracefully', async () => {
      mockAIManager.executeRequest.mockRejectedValue(new Error('AI service unavailable'));
      mockCacheManager.get.mockResolvedValue(null);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('AI service unavailable');
      expect(result.tests).toHaveLength(0);
      expect(result.confidence).toBe(0);
    });

    it('should include edge cases when requested', async () => {
      const requestWithEdgeCases = {
        ...mockRequest,
        options: {
          ...mockRequest.options,
          includeEdgeCases: true
        }
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-4',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Login with Edge Cases',
              description: 'Test login with various edge cases',
              type: 'e2e',
              steps: [
                {
                  action: 'Test with invalid credentials',
                  target: '#login-form'
                },
                {
                  action: 'Test with empty fields',
                  target: '#login-form'
                },
                {
                  action: 'Test with special characters',
                  target: '#login-form'
                }
              ],
              assertions: [
                {
                  type: 'element',
                  target: '.error-message',
                  operator: 'exists',
                  value: true
                }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 180,
          outputTokens: 350,
          totalTokens: 530
        },
        cost: {
          totalCost: 0.06,
          currency: 'USD'
        },
        processingTime: 2500
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(requestWithEdgeCases);

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].steps.length).toBeGreaterThan(2);
      expect(result.recommendations).toContain('Consider adding edge case scenarios and error handling tests');
    });

    it('should generate appropriate test data when requested', async () => {
      const requestWithTestData = {
        ...mockRequest,
        options: {
          ...mockRequest.options,
          includeTestData: true
        }
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-5',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Login Test with Data',
              description: 'Test login with various test data',
              type: 'e2e',
              steps: [
                {
                  action: 'Enter username',
                  target: '#username',
                  value: '{{validEmail}}'
                }
              ],
              assertions: [],
              testData: [
                {
                  name: 'validEmail',
                  type: 'string',
                  value: 'test@example.com',
                  description: 'Valid email address'
                },
                {
                  name: 'validPassword',
                  type: 'string',
                  value: 'Password123!',
                  description: 'Valid password'
                }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 150,
          outputTokens: 300,
          totalTokens: 450
        },
        cost: {
          totalCost: 0.05,
          currency: 'USD'
        },
        processingTime: 2000
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(requestWithTestData);

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].testData).toHaveLength(2);
      expect(result.tests[0].testData[0].name).toBe('validEmail');
      expect(result.recommendations).toContain('Consider adding test data for comprehensive testing scenarios');
    });

    it('should calculate confidence scores based on test quality', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-6',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'High Quality Test',
              description: 'Well-structured test',
              type: 'e2e',
              steps: [
                { action: 'Step 1', target: 'target1' },
                { action: 'Step 2', target: 'target2' }
              ],
              assertions: [
                { type: 'element', target: 'element1', operator: 'exists' }
              ],
              confidence: 0.95
            }
          ]
        }),
        usage: {
          inputTokens: 120,
          outputTokens: 250,
          totalTokens: 370
        },
        cost: {
          totalCost: 0.04,
          currency: 'USD'
        },
        processingTime: 1800
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.summary.averageConfidence).toBeGreaterThan(0.8);
    });

    it('should generate warnings for problematic tests', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'ai-response-7',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Problematic Test',
              description: 'Test with issues',
              type: 'e2e',
              steps: Array(20).fill(null).map((_, i) => ({
                action: `Step ${i + 1}`,
                target: `target${i + 1}`
              })),
              assertions: [], // No assertions
              confidence: 0.3, // Low confidence
              estimatedDuration: 120 // Very long
            }
          ]
        }),
        usage: {
          inputTokens: 200,
          outputTokens: 400,
          totalTokens: 600
        },
        cost: {
          totalCost: 0.08,
          currency: 'USD'
        },
        processingTime: 3000
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('very long estimated duration'))).toBe(true);
      expect(result.warnings.some(w => w.includes('low confidence score'))).toBe(true);
      expect(result.warnings.some(w => w.includes('no assertions'))).toBe(true);
      expect(result.warnings.some(w => w.includes('very complex'))).toBe(true);
    });

    it('should handle different complexity levels', async () => {
      const simpleRequest = { ...mockRequest, options: { ...mockRequest.options, complexity: 'simple' as const } };
      const complexRequest = { ...mockRequest, options: { ...mockRequest.options, complexity: 'complex' as const } };

      // Mock simple test
      mockAIManager.executeRequest.mockResolvedValueOnce({
        id: 'simple-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [{
            name: 'Simple Test',
            steps: [{ action: 'Simple step', target: 'target' }],
            assertions: [{ type: 'element', target: 'element', operator: 'exists' }]
          }]
        }),
        usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        cost: { totalCost: 0.02, currency: 'USD' },
        processingTime: 1000
      });

      // Mock complex test
      mockAIManager.executeRequest.mockResolvedValueOnce({
        id: 'complex-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [{
            name: 'Complex Test',
            steps: Array(12).fill(null).map((_, i) => ({ action: `Step ${i + 1}`, target: `target${i + 1}` })),
            assertions: Array(8).fill(null).map((_, i) => ({ type: 'element', target: `element${i + 1}`, operator: 'exists' }))
          }]
        }),
        usage: { inputTokens: 300, outputTokens: 600, totalTokens: 900 },
        cost: { totalCost: 0.12, currency: 'USD' },
        processingTime: 5000
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const simpleResult = await testGenerator.generateTests(simpleRequest);
      const complexResult = await testGenerator.generateTests(complexRequest);

      expect(simpleResult.tests[0].steps.length).toBeLessThan(complexResult.tests[0].steps.length);
      expect(simpleResult.tests[0].assertions.length).toBeLessThan(complexResult.tests[0].assertions.length);
      expect(simpleResult.cost).toBeLessThan(complexResult.cost);
      expect(simpleResult.summary.byComplexity).toBeDefined();
      expect(complexResult.summary.byComplexity).toBeDefined();
    });
  });

  describe('Context-Aware Generation', () => {
    it('should enhance request with application structure context', async () => {
      const requestWithContext = {
        ...mockRequest,
        context: {
          applicationStructure: {
            screens: [
              {
                id: 'login-screen',
                name: 'Login Screen',
                type: 'form',
                elements: [
                  { id: 'username-field', type: 'input', selector: '#username' },
                  { id: 'password-field', type: 'input', selector: '#password' },
                  { id: 'login-button', type: 'button', selector: '#login-button' }
                ],
                interactions: ['tap', 'type'],
                validations: ['required', 'email-format', 'password-strength']
              }
            ]
          }
        }
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'context-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Context-Aware Login Test',
              description: 'Test with enhanced context',
              type: 'e2e',
              steps: [
                {
                  action: 'Enter username in #username field',
                  target: '#username',
                  value: 'test@example.com'
                },
                {
                  action: 'Enter password in #password field',
                  target: '#password',
                  value: 'Password123!'
                },
                {
                  action: 'Tap #login-button',
                  target: '#login-button'
                }
              ],
              assertions: [
                {
                  type: 'element',
                  target: '#username',
                  operator: 'exists',
                  value: true
                },
                {
                  type: 'element',
                  target: '#password',
                  operator: 'exists',
                  value: true
                }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 180,
          outputTokens: 350,
          totalTokens: 530
        },
        cost: {
          totalCost: 0.06,
          currency: 'USD'
        },
        processingTime: 2500
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(requestWithContext);

      expect(result.tests[0].steps).toHaveLength(3);
      expect(result.tests[0].assertions).toHaveLength(2);
      expect(result.tests[0].steps[0].target).toBe('#username');
      expect(result.tests[0].steps[1].target).toBe('#password');
    });

    it('should use existing test patterns for consistency', async () => {
      const requestWithPatterns = {
        ...mockRequest,
        context: {
          existingTests: [
            {
              id: 'existing-login-test',
              name: 'Login Test',
              type: 'e2e',
              coverage: { elements: ['username', 'password', 'login-button'], flows: ['login'] },
              patterns: ['navigate', 'input', 'click', 'assert'],
              quality: 8,
              lastUpdated: new Date()
            }
          ]
        }
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'patterns-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Consistent Login Test',
              description: 'Test following existing patterns',
              type: 'e2e',
              steps: [
                { action: 'navigate', target: '/login' },
                { action: 'input', target: '#username', value: 'test@example.com' },
                { action: 'input', target: '#password', value: 'Password123!' },
                { action: 'click', target: '#login-button' },
                { action: 'assert', target: '.welcome-message', operator: 'exists' }
              ],
              assertions: [
                { type: 'element', target: '.welcome-message', operator: 'exists', value: true }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 160,
          outputTokens: 320,
          totalTokens: 480
        },
        cost: {
          totalCost: 0.05,
          currency: 'USD'
        },
        processingTime: 2200
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(requestWithPatterns);

      expect(result.tests[0].steps).toHaveLength(5);
      expect(result.tests[0].steps.some(step => step.action === 'navigate')).toBe(true);
      expect(result.tests[0].steps.some(step => step.action === 'input')).toBe(true);
      expect(result.tests[0].steps.some(step => step.action === 'click')).toBe(true);
      expect(result.tests[0].steps.some(step => step.action === 'assert')).toBe(true);
    });
  });

  describe('Quality Assessment', () => {
    it('should assess test quality and provide scores', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'quality-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'High Quality Test',
              description: 'Well-structured test',
              type: 'e2e',
              steps: [
                { action: 'Navigate', target: '/login' },
                { action: 'Input', target: '#username', value: 'test@example.com' },
                { action: 'Input', target: '#password', value: 'Password123!' },
                { action: 'Click', target: '#login-button' }
              ],
              assertions: [
                { type: 'element', target: '.welcome-message', operator: 'exists' },
                { type: 'element', target: '#username', operator: 'exists', value: false }
              ]
            }
          ]
        }),
        usage: {
          inputTokens: 140,
          outputTokens: 280,
          totalTokens: 420
        },
        cost: {
          totalCost: 0.05,
          currency: 'USD'
        },
        processingTime: 2100
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.tests[0].quality).toBeGreaterThan(0);
      expect(result.tests[0].confidence).toBeGreaterThan(0);
      expect(result.summary.averageQuality).toBeGreaterThan(0);
      expect(result.summary.averageConfidence).toBeGreaterThan(0);
    });

    it('should identify quality issues and provide recommendations', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'quality-issues-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Poor Quality Test',
              description: 'Test with quality issues',
              type: 'e2e',
              steps: [{ action: 'Single step' }],
              assertions: [], // No assertions
            }
          ]
        }),
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300
        },
        cost: {
          totalCost: 0.04,
          currency: 'USD'
        },
        processingTime: 1500
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => rec.includes('quality'))).toBe(true);
      expect(result.warnings.some(warn => warn.includes('no assertions'))).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent generation requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        ...mockRequest,
        id: `test-req-${i}`,
        description: `Test request ${i}: ${mockRequest.description}`
      }));

      // Mock AI responses for concurrent requests
      mockAIManager.executeRequest.mockImplementation(async (request) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          id: `ai-response-${request.id}`,
          provider: 'openai',
          model: 'gpt-4',
          content: JSON.stringify({
            tests: [
              {
                name: `Concurrent Test ${request.id}`,
                description: request.description,
                type: 'e2e',
                steps: [{ action: 'Step', target: 'target' }],
                assertions: [{ type: 'element', target: 'element', operator: 'exists' }]
              }
            ]
          }),
          usage: {
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300
          },
          cost: {
            totalCost: 0.04,
            currency: 'USD'
          },
          processingTime: 2000
        };
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const startTime = Date.now();
      const results = await Promise.all(requests.map(req => testGenerator.generateTests(req)));
      const endTime = Date.now();

      expect(results).toHaveLength(10);
      expect(results.every(result => result.tests.length === 1)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should process requests within acceptable time limits', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'performance-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              name: 'Performance Test',
              description: 'Test for performance',
              type: 'e2e',
              steps: [{ action: 'Step', target: 'target' }],
              assertions: [{ type: 'element', target: 'element', operator: 'exists' }]
            }
          ]
        }),
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300
        },
        cost: {
          totalCost: 0.04,
          currency: 'USD'
        },
        processingTime: 1000
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.cost).toBeLessThan(1.0); // Cost should be reasonable
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed AI responses', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'malformed-response',
        provider: 'openai',
        model: 'gpt-4',
        content: 'Invalid JSON response',
        usage: {
          inputTokens: 50,
          outputTokens: 100,
          totalTokens: 150
        },
        cost: {
          totalCost: 0.02,
          currency: 'USD'
        },
        processingTime: 500
      });

      mockCacheManager.get.mockResolvedValue(null);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid AI response format');
      expect(result.tests).toHaveLength(0);
    });

    it('should handle missing required fields in AI response', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'missing-fields-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [
            {
              // Missing required fields like name, type, steps
              description: 'Test with missing fields'
            }
          ]
        }),
        usage: {
          inputTokens: 80,
          outputTokens: 160,
          totalTokens: 240
        },
        cost: {
          totalCost: 0.03,
          currency: 'USD'
        },
        processingTime: 1200
      });

      mockCacheManager.get.mockResolvedValue(null);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.tests).toHaveLength(1);
      expect(result.tests[0].name).toBeDefined(); // Should have default values
      expect(result.tests[0].type).toBeDefined();
      expect(result.tests[0].steps).toBeDefined();
    });

    it('should handle empty AI response', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'empty-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: []
        }),
        usage: {
          inputTokens: 50,
          outputTokens: 100,
          totalTokens: 150
        },
        cost: {
          totalCost: 0.02,
          currency: 'USD'
        },
        processingTime: 500
      });

      mockCacheManager.get.mockResolvedValue(null);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.tests).toHaveLength(0);
      expect(result.summary.totalTests).toBe(0);
      expect(result.recommendations).toContain('Consider reviewing and enhancing generated tests for better quality');
    });

    it('should handle timeout scenarios', async () => {
      mockAIManager.executeRequest.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        throw new Error('Request timeout');
      });

      mockCacheManager.get.mockResolvedValue(null);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.errors).toHaveLength(1);
      expect(result.processingTime).toBeGreaterThan(9000);
    });
  });

  describe('Integration with AI Provider Abstraction Layer', () => {
    it('should properly integrate with AI Manager for provider selection', async () => {
      const customRequest = {
        ...mockRequest,
        metadata: {
          preferredProvider: 'huggingface',
          maxCost: 0.03
        }
      };

      mockAIManager.executeRequest.mockResolvedValue({
        id: 'integration-response',
        provider: 'huggingface',
        model: 'mistral-7b',
        content: JSON.stringify({
          tests: [
            {
              name: 'Integration Test',
              description: 'Test with Hugging Face provider',
              type: 'e2e',
              steps: [{ action: 'Step', target: 'target' }],
              assertions: [{ type: 'element', target: 'element', operator: 'exists' }]
            }
          ]
        }),
        usage: {
          inputTokens: 80,
          outputTokens: 160,
          totalTokens: 240
        },
        cost: {
          totalCost: 0.025,
          currency: 'USD'
        },
        processingTime: 1500
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await testGenerator.generateTests(customRequest);

      expect(result.tests).toHaveLength(1);
      expect(result.cost).toBeLessThan(0.03);
      expect(mockAIManager.executeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test_generation',
          prompt: expect.any(String),
          parameters: expect.objectContaining({
            temperature: 0.3,
            maxTokens: 4000,
            responseFormat: 'json'
          })
        })
      );
    });

    it('should use caching with the AI Provider Abstraction Layer', async () => {
      mockCacheManager.get.mockResolvedValue({
        entry: {
          response: JSON.stringify({
            requestId: 'test-req-1',
            tests: [{ id: 'cached-test', name: 'Cached Test' }],
            summary: { totalTests: 1, byType: {}, byComplexity: {}, averageConfidence: 0.8, averageQuality: 7, totalSteps: 0, totalAssertions: 0, estimatedTotalDuration: 5 },
            confidence: 0.8,
            processingTime: 100,
            cost: 0.02,
            recommendations: [],
            warnings: [],
            errors: []
          })
        }
      } as any);

      const result = await testGenerator.generateTests(mockRequest);

      expect(mockAIManager.executeRequest).not.toHaveBeenCalled();
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test_generation',
          prompt: mockRequest.description
        })
      );
    });
  });

  describe('Template System', () => {
    it('should select appropriate template based on platform and complexity', async () => {
      const simpleRequest = { ...mockRequest, platform: 'mobile' as const, options: { ...mockRequest.options, complexity: 'simple' as const } };
      const complexRequest = { ...mockRequest, platform: 'web' as const, options: { ...mockRequest.options, complexity: 'complex' as const } };

      // Test that different templates are used
      mockAIManager.executeRequest.mockImplementation(async (request) => {
        const prompt = request.prompt as string;

        if (prompt.includes('simple mobile test automation engineer')) {
          return {
            id: 'simple-mobile-response',
            provider: 'openai',
            model: 'gpt-4',
            content: JSON.stringify({
              tests: [{ name: 'Simple Mobile Test', steps: [], assertions: [] }]
            }),
            usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
            cost: { totalCost: 0.02, currency: 'USD' },
            processingTime: 800
          };
        } else if (prompt.includes('complex web test automation engineer')) {
          return {
            id: 'complex-web-response',
            provider: 'openai',
            model: 'gpt-4',
            content: JSON.stringify({
              tests: [{ name: 'Complex Web Test', steps: [], assertions: [] }]
            }),
            usage: { inputTokens: 200, outputTokens: 400, totalTokens: 600 },
            cost: { totalCost: 0.08, currency: 'USD' },
            processingTime: 3000
          };
        }

        return {
          id: 'default-response',
          provider: 'openai',
          model: 'gpt-4',
          content: JSON.stringify({
            tests: [{ name: 'Default Test', steps: [], assertions: [] }]
          }),
          usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
          cost: { totalCost: 0.04, currency: 'USD' },
          processingTime: 1500
        };
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      const simpleResult = await testGenerator.generateTests(simpleRequest);
      const complexResult = await testGenerator.generateTests(complexRequest);

      expect(simpleResult.cost).toBeLessThan(complexResult.cost);
      expect(simpleResult.processingTime).toBeLessThan(complexResult.processingTime);
    });
  });

  describe('Cache Integration', () => {
    it('should cache generation results with appropriate TTL', async () => {
      mockAIManager.executeRequest.mockResolvedValue({
        id: 'cache-ttl-response',
        provider: 'openai',
        model: 'gpt-4',
        content: JSON.stringify({
          tests: [{ name: 'Cached Test', steps: [], assertions: [] }]
        }),
        usage: {
          inputTokens: 100,
          outputTokens: 200,
          totalTokens: 300
        },
        cost: {
          totalCost: 0.04,
          currency: 'USD'
        },
        processingTime: 1500
      });

      mockCacheManager.get.mockResolvedValue(null);
      mockCacheManager.set.mockResolvedValue(undefined);

      await testGenerator.generateTests(mockRequest);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          userId: mockRequest.userId,
          organizationId: mockRequest.organizationId,
          type: 'test_generation'
        }),
        expect.objectContaining({
          content: expect.any(String),
          usage: expect.any(Object),
          cost: expect.any(Object)
        }),
        3600000 // 1 hour TTL
      );
    });

    it('should include cache metadata in cached responses', async () => {
      mockCacheManager.get.mockResolvedValue({
        entry: {
          response: JSON.stringify({
            requestId: 'cached-with-metadata',
            tests: [{
              id: 'cached-test',
              name: 'Cached Test',
              metadata: {
                generatedAt: new Date(),
                version: '2.0.0',
                author: 'AI Generator',
                context: 'Natural Language',
                references: [],
                dependencies: [],
                tags: [],
                risk: 'low'
              }
            }],
            summary: { totalTests: 1, byType: {}, byComplexity: {}, averageConfidence: 0.8, averageQuality: 7, totalSteps: 0, totalAssertions: 0, estimatedTotalDuration: 5 },
            confidence: 0.8,
            processingTime: 100,
            cost: 0.02,
            recommendations: [],
            warnings: [],
            errors: []
          })
        }
      } as any);

      const result = await testGenerator.generateTests(mockRequest);

      expect(result.tests[0].metadata).toBeDefined();
      expect(result.tests[0].metadata.author).toBe('AI Generator');
      expect(result.tests[0].metadata.version).toBe('2.0.0');
    });
  });
});
