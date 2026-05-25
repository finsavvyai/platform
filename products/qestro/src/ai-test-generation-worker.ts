/**
 * AI Test Generation Service Test Worker
 *
 * Comprehensive testing and validation interface for the AI Test Generation Service.
 * Provides HTTP endpoints for testing AI-powered test generation, optimization,
 * and coverage analysis capabilities.
 */

import { AITestGenerationService, createAITestGenerationService } from '../services/ai-test-generation';

// Mock D1 database for testing
const mockD1Database = {
  prepare: (query: string) => ({
    bind: (...params: any[]) => ({
      run: () => Promise.resolve({ success: true, meta: { duration: 5 }, changes: 1 }),
      first: () => Promise.resolve({
        id: 'test-project-001',
        name: 'Test Project',
        description: 'AI Test Generation Demo Project',
        platform: 'web',
        technology: ['React', 'TypeScript'],
        framework: ['Playwright', 'Jest'],
        requirements: ['Authentication', 'User Management', 'Data Validation']
      }),
      all: () => Promise.resolve({
        results: [
          {
            id: 'test-case-001',
            name: 'User Login Test',
            steps: ['Open login page', 'Enter credentials', 'Submit'],
            complexity: 'medium',
            riskLevel: 'high'
          }
        ]
      })
    })
  })
};

// Initialize AI service
const aiService = createAITestGenerationService(mockD1Database as any, {
  defaultProvider: 'openai',
  maxTokensPerRequest: 2000,
  costLimit: 10.0,
  enableCaching: true,
  cacheExpiry: 1800000 // 30 minutes
});

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    console.log(`🤖 AI Test Generation Service: ${method} ${path}`);

    try {
      // Health check endpoint
      if (path === '/health' && method === 'GET') {
        return Response.json({
          status: 'healthy',
          service: 'AI Test Generation Service',
          version: '1.0.0',
          capabilities: {
            testGeneration: true,
            testOptimization: true,
            coverageAnalysis: true,
            recommendations: true
          },
          providers: ['OpenAI', 'Hugging Face'],
          timestamp: new Date().toISOString()
        });
      }

      // Generate test cases endpoint
      if (path === '/ai-test-generation/generate' && method === 'POST') {
        try {
          const body = await request.json();
          const { description, context, options } = body;

          if (!description) {
            return Response.json({
              error: 'Description is required'
            }, { status: 400 });
          }

          console.log(`🧪 Generating test cases for: ${description.substring(0, 50)}...`);

          const startTime = Date.now();
          const testCases = await aiService.generateTestCases(description, context, options);
          const duration = Date.now() - startTime;

          return Response.json({
            success: true,
            data: {
              testCases,
              metadata: {
                generatedCount: testCases.length,
                generationTime: duration,
                provider: options?.provider || 'openai',
                context: context
              }
            }
          });

        } catch (error) {
          console.error('❌ Test generation failed:', error);
          return Response.json({
            error: 'Test generation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Optimize test cases endpoint
      if (path === '/ai-test-generation/optimize' && method === 'POST') {
        try {
          const body = await request.json();
          const { testCases, feedback, options } = body;

          if (!testCases || !Array.isArray(testCases)) {
            return Response.json({
              error: 'Test cases array is required'
            }, { status: 400 });
          }

          console.log(`⚡ Optimizing ${testCases.length} test cases`);

          const startTime = Date.now();
          const optimizedTests = await aiService.optimizeTestCases(testCases, feedback, options);
          const duration = Date.now() - startTime;

          return Response.json({
            success: true,
            data: {
              optimizedTests,
              metadata: {
                originalCount: testCases.length,
                optimizedCount: optimizedTests.length,
                optimizationTime: duration,
                averageImprovement: optimizedTests.reduce((sum, test) => sum + (test.improvementScore || 0), 0) / optimizedTests.length
              }
            }
          });

        } catch (error) {
          console.error('❌ Test optimization failed:', error);
          return Response.json({
            error: 'Test optimization failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Analyze test coverage endpoint
      if (path === '/ai-test-generation/coverage-analysis' && method === 'POST') {
        try {
          const body = await request.json();
          const { projectId, options } = body;

          if (!projectId) {
            return Response.json({
              error: 'Project ID is required'
            }, { status: 400 });
          }

          console.log(`📊 Analyzing test coverage for project: ${projectId}`);

          const startTime = Date.now();
          const coverageAnalysis = await aiService.analyzeTestCoverage(projectId, options);
          const duration = Date.now() - startTime;

          return Response.json({
            success: true,
            data: {
              coverage: coverageAnalysis,
              metadata: {
                projectId,
                analysisTime: duration,
                provider: options?.provider || 'openai'
              }
            }
          });

        } catch (error) {
          console.error('❌ Coverage analysis failed:', error);
          return Response.json({
            error: 'Coverage analysis failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Generate test recommendations endpoint
      if (path === '/ai-test-generation/recommendations' && method === 'POST') {
        try {
          const body = await request.json();
          const { projectId, goals, options } = body;

          if (!projectId) {
            return Response.json({
              error: 'Project ID is required'
            }, { status: 400 });
          }

          console.log(`💡 Generating test recommendations for project: ${projectId}`);

          const startTime = Date.now();
          const recommendations = await aiService.generateTestRecommendations(projectId, goals, options);
          const duration = Date.now() - startTime;

          return Response.json({
            success: true,
            data: {
              recommendations,
              metadata: {
                projectId,
                goals,
                recommendationTime: duration,
                estimatedEffort: recommendations.estimatedEffort,
                expectedROI: recommendations.expectedROI
              }
            }
          });

        } catch (error) {
          console.error('❌ Recommendation generation failed:', error);
          return Response.json({
            error: 'Recommendation generation failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Get usage metrics endpoint
      if (path === '/ai-test-generation/metrics' && method === 'GET') {
        try {
          const timeframe = url.searchParams.get('timeframe');
          let timeFilter;

          if (timeframe) {
            const days = parseInt(timeframe);
            const now = new Date();
            const from = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
            timeFilter = { from: from.toISOString(), to: now.toISOString() };
          }

          const metrics = aiService.getUsageMetrics(timeFilter);

          return Response.json({
            success: true,
            data: {
              metrics,
              timeframe: timeFilter || 'all-time',
              timestamp: new Date().toISOString()
            }
          });

        } catch (error) {
          console.error('❌ Metrics retrieval failed:', error);
          return Response.json({
            error: 'Metrics retrieval failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Comprehensive test endpoint
      if (path === '/ai-test-generation/comprehensive-test' && method === 'POST') {
        try {
          console.log('🧪 Starting comprehensive AI test generation test...');

          const results = {
            testGeneration: { status: 'pending', duration: 0, success: false },
            testOptimization: { status: 'pending', duration: 0, success: false },
            coverageAnalysis: { status: 'pending', duration: 0, success: false },
            recommendations: { status: 'pending', duration: 0, success: false },
            metrics: { status: 'pending', duration: 0, success: false }
          };

          // Test 1: Test Generation
          try {
            const startTime = Date.now();
            const testCases = await aiService.generateTestCases(
              'User authentication system with login, logout, and password reset',
              {
                projectInfo: {
                  name: 'Test Project',
                  description: 'Web application with user authentication',
                  platform: 'web' as const,
                  technology: ['React', 'Node.js'],
                  framework: ['Playwright']
                },
                constraints: {
                  maxTestCases: 5,
                  priority: 'high' as const,
                  testTypes: ['functional', 'security']
                }
              },
              { maxTestCases: 5 }
            );

            results.testGeneration = {
              status: 'completed',
              duration: Date.now() - startTime,
              success: testCases.length > 0,
              testCasesGenerated: testCases.length
            };
          } catch (error) {
            results.testGeneration.status = 'failed';
            results.testGeneration.error = error instanceof Error ? error.message : 'Unknown error';
          }

          // Test 2: Test Optimization
          try {
            const startTime = Date.now();
            const mockTests = [
              {
                id: 'test-001',
                name: 'Login Test',
                description: 'Test user login functionality',
                steps: ['Open page', 'Enter credentials', 'Submit'],
                complexity: 'medium',
                riskLevel: 'high'
              }
            ];

            const optimizedTests = await aiService.optimizeTestCases(mockTests, {
              issues: ['Test steps too verbose'],
              suggestions: ['Simplify test steps', 'Add assertions'],
              priorities: ['Focus on critical paths'],
              constraints: ['Reduce execution time']
            });

            results.testOptimization = {
              status: 'completed',
              duration: Date.now() - startTime,
              success: optimizedTests.length > 0,
              testsOptimized: optimizedTests.length
            };
          } catch (error) {
            results.testOptimization.status = 'failed';
            results.testOptimization.error = error instanceof Error ? error.message : 'Unknown error';
          }

          // Test 3: Coverage Analysis
          try {
            const startTime = Date.now();
            const coverage = await aiService.analyzeTestCoverage('test-project-001');

            results.coverageAnalysis = {
              status: 'completed',
              duration: Date.now() - startTime,
              success: coverage.overallCoverage > 0,
              overallCoverage: coverage.overallCoverage,
              gapsIdentified: coverage.gaps.length
            };
          } catch (error) {
            results.coverageAnalysis.status = 'failed';
            results.coverageAnalysis.error = error instanceof Error ? error.message : 'Unknown error';
          }

          // Test 4: Recommendations
          try {
            const startTime = Date.now();
            const recommendations = await aiService.generateTestRecommendations(
              'test-project-001',
              ['improve security', 'increase coverage']
            );

            results.recommendations = {
              status: 'completed',
              duration: Date.now() - startTime,
              success: recommendations.recommendations.length > 0,
              recommendationsGenerated: recommendations.recommendations.length,
              priorityTestsGenerated: recommendations.priorityTests.length
            };
          } catch (error) {
            results.recommendations.status = 'failed';
            results.recommendations.error = error instanceof Error ? error.message : 'Unknown error';
          }

          // Test 5: Metrics
          try {
            const startTime = Date.now();
            const metrics = aiService.getUsageMetrics();

            results.metrics = {
              status: 'completed',
              duration: Date.now() - startTime,
              success: true,
              operationsTracked: metrics.operationsCount,
              totalCost: metrics.totalCost
            };
          } catch (error) {
            results.metrics.status = 'failed';
            results.metrics.error = error instanceof Error ? error.message : 'Unknown error';
          }

          // Calculate overall success
          const successCount = Object.values(results).filter(r => r.success).length;
          const totalTests = Object.keys(results).length;
          const overallSuccess = successCount >= totalTests * 0.8; // 80% success rate

          return Response.json({
            success: overallSuccess,
            data: {
              results,
              summary: {
                totalTests: totalTests,
                successfulTests: successCount,
                successRate: (successCount / totalTests) * 100,
                overallSuccess,
                testDuration: results.testGeneration.duration +
                              results.testOptimization.duration +
                              results.coverageAnalysis.duration +
                              results.recommendations.duration
              }
            }
          });

        } catch (error) {
          console.error('❌ Comprehensive test failed:', error);
          return Response.json({
            error: 'Comprehensive test failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Demo/test data setup endpoint
      if (path === '/ai-test-generation/setup-demo' && method === 'POST') {
        try {
          const demoData = {
            sampleDescription: 'E-commerce checkout process with payment processing and user authentication',
            sampleContext: {
              projectInfo: {
                name: 'Questro E-commerce Platform',
                description: 'Modern e-commerce platform with AI-powered testing',
                platform: 'web' as const,
                technology: ['React', 'Node.js', 'PostgreSQL'],
                framework: ['Playwright', 'Cypress']
              },
              requirements: {
                functional: [
                  'User registration and authentication',
                  'Product browsing and search',
                  'Shopping cart management',
                  'Payment processing',
                  'Order management'
                ],
                nonFunctional: [
                  'Page load time < 3 seconds',
                  'Mobile responsiveness',
                  'Accessibility compliance',
                  'Security best practices'
                ],
                businessRules: [
                  'User must be authenticated to checkout',
                  'Payment validation required',
                  'Inventory must be checked before purchase'
                ]
              },
              constraints: {
                maxTestCases: 10,
                priority: 'high' as const,
                testTypes: ['functional', 'security', 'performance']
              }
            }
          };

          return Response.json({
            success: true,
            data: {
              message: 'Demo data configured successfully',
              demoData,
              usageExamples: {
                generateTestCases: 'POST /ai-test-generation/generate with description and context',
                optimizeTests: 'POST /ai-test-generation/optimize with test cases array',
                analyzeCoverage: 'POST /ai-test-generation/coverage-analysis with projectId',
                getRecommendations: 'POST /ai-test-generation/recommendations with projectId and goals',
                viewMetrics: 'GET /ai-test-generation/metrics',
                runComprehensiveTest: 'POST /ai-test-generation/comprehensive-test'
              }
            }
          });

        } catch (error) {
          console.error('❌ Demo setup failed:', error);
          return Response.json({
            error: 'Demo setup failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 });
        }
      }

      // Default 404 response
      return Response.json({
        error: 'Endpoint not found',
        availableEndpoints: [
          'GET /health',
          'POST /ai-test-generation/generate',
          'POST /ai-test-generation/optimize',
          'POST /ai-test-generation/coverage-analysis',
          'POST /ai-test-generation/recommendations',
          'GET /ai-test-generation/metrics',
          'POST /ai-test-generation/comprehensive-test',
          'POST /ai-test-generation/setup-demo'
        ]
      }, { status: 404 });

    } catch (error) {
      console.error('❌ Unhandled error:', error);
      return Response.json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }
};
