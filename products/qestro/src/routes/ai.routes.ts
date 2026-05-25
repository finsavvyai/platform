/**
 * Qestro AI Service API Routes
 * Provides comprehensive AI-powered testing capabilities
 *
 * Features:
 * - AI test generation from natural language
 * - Intelligent test optimization and analysis
 * - Bug detection and root cause analysis
 * - Performance analysis and recommendations
 * - Test maintenance and automation
 *
 * @author Qestro Platform Team
 * @version 1.0.0
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { AIManager, AIRequestType, AIProviderType } from '../services/ai/ai-manager';
import { drizzle } from 'drizzle-orm/d1';
import { schema } from '../db/schema';
import { HTTPException } from 'hono/http-exception';

// Initialize Hono router with proper typing
const aiRoutes = new Hono<{ Bindings: Env }>();

// Initialize AI Manager
const aiManager = new AIManager({
  defaultProvider: 'openai',
  enableCaching: true,
  enableHealthChecks: true,
  enableCostTracking: true,
  enableUsageTracking: true,
  maxRetries: 3,
  selectionStrategy: {
    strategy: 'cost',
    fallbackEnabled: true
  }
});

// Request validation schemas
const generateTestSchema = z.object({
  description: z.string().min(10, 'Test description must be at least 10 characters'),
  context: z.object({
    platform: z.enum(['mobile', 'web', 'desktop']),
    type: z.enum(['ui', 'api', 'e2e', 'unit', 'integration']),
    framework: z.string().optional(),
    application_type: z.string().optional(),
    target_audience: z.string().optional(),
    complexity: z.enum(['basic', 'intermediate', 'advanced']).default('intermediate')
  }).optional(),
  options: z.object({
    provider: z.enum(['openai', 'anthropic', 'huggingface', 'auto']).default('auto'),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).default(0.7),
    max_tokens: z.number().min(100).max(4000).default(2000),
    include_negative_tests: z.boolean().default(true),
    include_edge_cases: z.boolean().default(true),
    focus_areas: z.array(z.string()).optional()
  }).optional(),
  project_id: z.string().optional()
});

const optimizeTestSchema = z.object({
  tests: z.array(z.object({
    name: z.string(),
    description: z.string(),
    steps: z.array(z.string()),
    expected: z.string(),
    actual_result: z.string().optional(),
    error: z.string().optional()
  })).min(1, 'At least one test must be provided'),
  feedback: z.object({
    failed_tests: z.array(z.string()).optional(),
    success_rate: z.number().min(0).max(100).optional(),
    execution_time: z.number().optional(),
    issues: z.array(z.string()).optional(),
    performance_issues: z.array(z.string()).optional(),
    user_feedback: z.string().optional()
  }).optional(),
  options: z.object({
    provider: z.enum(['openai', 'anthropic', 'huggingface', 'auto']).default('auto'),
    optimization_type: z.enum(['performance', 'maintainability', 'coverage', 'all']).default('all'),
    preserve_functionality: z.boolean().default(true)
  }).optional()
});

const analyzeFailureSchema = z.object({
  test_name: z.string(),
  test_case: z.string(),
  error_message: z.string(),
  error_stack: z.string().optional(),
  test_logs: z.string().optional(),
  environment: z.object({
    browser: z.string().optional(),
    os: z.string().optional(),
    device: z.string().optional(),
    network: z.string().optional()
  }).optional(),
  context: z.object({
    recent_changes: z.string().optional(),
    application_version: z.string().optional(),
    test_dependencies: z.array(z.string()).optional()
  }).optional()
});

const analyzePerformanceSchema = z.object({
  test_results: z.array(z.object({
    test_name: z.string(),
    execution_time: z.number(),
    response_time: z.number().optional(),
    resource_usage: z.object({
      cpu: z.number().optional(),
      memory: z.number().optional(),
      network: z.number().optional()
    }).optional(),
    timestamps: z.array(z.number()).optional()
  })).min(1),
  baselines: z.record(z.number()).optional(),
  environment: z.object({
    device_type: z.string(),
    network_speed: z.string(),
    location: z.string()
  }).optional(),
  thresholds: z.object({
    max_response_time: z.number().optional(),
    max_execution_time: z.number().optional(),
    max_cpu_usage: z.number().optional(),
    max_memory_usage: z.number().optional()
  }).optional()
});

/**
 * POST /api/ai/generate-test
 * Generate comprehensive test cases from natural language description
 */
aiRoutes.post('/generate-test', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = generateTestSchema.parse(body);

    // Get project context if provided
    let projectContext = {};
    if (validatedData.project_id) {
      const db = drizzle(c.env.DB, { schema });
      const project = await db.query.projects.findFirst({
        where: (projects, { eq }) => eq(projects.id, validatedData.project_id!),
        with: {
          testCases: {
            limit: 5,
            orderBy: (testCases, { desc }) => desc(testCases.createdAt)
          }
        }
      });

      if (project) {
        projectContext = {
          project_name: project.name,
          project_type: project.type,
          platform: project.platform,
          existing_tests: project.testCases?.map(tc => ({
            name: tc.name,
            description: tc.description,
            type: tc.type
          }))
        };
      }
    }

    // Craft comprehensive prompt
    const prompt = `
Generate comprehensive test cases for the following scenario:

Test Description: ${validatedData.description}

Context:
${JSON.stringify({ ...validatedData.context, ...projectContext }, null, 2)}

Options:
${JSON.stringify(validatedData.options, null, 2)}

Requirements:
1. Generate diverse test cases covering happy paths, edge cases, and error scenarios
2. Include detailed step-by-step instructions that are easy to follow
3. Provide clear expected outcomes for each test
4. Consider the target platform (${validatedData.context?.platform || 'web'})
5. Focus on ${validatedData.context?.type || 'ui'} testing
6. Complexity level: ${validatedData.context?.complexity || 'intermediate'}

Return the response in valid JSON format with the following structure:
{
  "tests": [
    {
      "name": "Clear, descriptive test name",
      "description": "What this test validates",
      "type": "ui|api|e2e|unit|integration",
      "priority": "high|medium|low",
      "steps": [
        "Detailed step 1 with specific actions",
        "Detailed step 2 with expected elements/conditions"
      ],
      "expected": "Clear expected outcome",
      "tags": ["relevant", "test", "tags"],
      "estimated_duration": "in minutes"
    }
  ],
  "coverage": {
    "features_covered": ["feature1", "feature2"],
    "test_types": ["functional", "ui", "api"],
    "estimated_coverage_percentage": 85
  },
  "recommendations": ["additional", "test", "suggestions"]
}
    `;

    // Create AI request
    const aiRequest = {
      userId: authUser.id,
      type: 'test_generation' as AIRequestType,
      provider: validatedData.options?.provider === 'auto' ? undefined : validatedData.options?.provider as AIProviderType,
      model: validatedData.options?.model,
      prompt: prompt.trim(),
      parameters: {
        temperature: validatedData.options?.temperature,
        maxTokens: validatedData.options?.max_tokens,
        responseFormat: 'json' as const
      },
      priority: 'normal' as const,
      metadata: {
        description: validatedData.description,
        context: validatedData.context,
        options: validatedData.options,
        project_id: validatedData.project_id
      }
    };

    // Execute AI request
    const aiResponse = await aiManager.executeRequest(aiRequest);

    try {
      // Parse the JSON response
      const generatedContent = JSON.parse(aiResponse.content);

      // Log usage
      if (validatedData.project_id) {
        const db = drizzle(c.env.DB, { schema });
        await db.insert(schema.aiGenerationLogs).values({
          id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: validatedData.project_id,
          description: validatedData.description,
          context: JSON.stringify(validatedData.context),
          options: JSON.stringify(validatedData.options),
          resultCount: generatedContent.tests?.length || 0,
          status: 'completed',
          tokensUsed: aiResponse.usage.totalTokens,
          cost: aiResponse.cost.totalCost,
          provider: aiResponse.provider,
          model: aiResponse.model,
          duration: aiResponse.processingTime,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      return c.json({
        success: true,
        data: {
          tests: generatedContent.tests || [],
          coverage: generatedContent.coverage || {},
          recommendations: generatedContent.recommendations || [],
          metadata: {
            generated_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            cost: aiResponse.cost.totalCost,
            processing_time: aiResponse.processingTime,
            cached: aiResponse.cached
          }
        }
      });

    } catch (parseError) {
      // Fallback: return raw content if JSON parsing fails
      return c.json({
        success: true,
        data: {
          raw_response: aiResponse.content,
          metadata: {
            generated_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            cost: aiResponse.cost.totalCost,
            processing_time: aiResponse.processingTime,
            warning: 'Response could not be parsed as JSON'
          }
        }
      });
    }

  } catch (error) {
    console.error('AI test generation failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to generate tests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai/optimize-test
 * Optimize existing test cases using AI analysis
 */
aiRoutes.post('/optimize-test', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = optimizeTestSchema.parse(body);

    const prompt = `
Analyze and optimize the following test cases based on performance, maintainability, and effectiveness:

Tests to Optimize:
${JSON.stringify(validatedData.tests, null, 2)}

Feedback and Performance Data:
${JSON.stringify(validatedData.feedback, null, 2)}

Optimization Type: ${validatedData.options?.optimization_type || 'all'}

Requirements:
1. Identify performance bottlenecks and suggest improvements
2. Enhance test maintainability and readability
3. Improve test reliability and reduce flakiness
4. Suggest better test organization and structure
5. Recommend additional test scenarios for better coverage

Return the response in valid JSON format:
{
  "optimizations": [
    {
      "test_name": "Original test name",
      "issues": ["Identified issues"],
      "optimized_test": {
        "name": "Improved test name",
        "steps": ["Optimized steps"],
        "expected": "Clear expected outcome",
        "improvements": ["Specific improvements made"]
      },
      "improvement_score": 85,
      "estimated_savings": "Time saved in minutes"
    }
  ],
  "overall_metrics": {
    "performance_improvement": "percentage",
    "maintainability_improvement": "percentage",
    "coverage_improvement": "percentage"
  },
  "recommendations": ["Additional", "optimization", "suggestions"]
}
    `;

    const aiRequest = {
      userId: authUser.id,
      type: 'code_optimization' as AIRequestType,
      provider: validatedData.options?.provider === 'auto' ? undefined : validatedData.options?.provider as AIProviderType,
      prompt: prompt.trim(),
      parameters: {
        temperature: 0.3, // Lower temperature for more focused optimization
        maxTokens: 3000,
        responseFormat: 'json' as const
      },
      priority: 'normal' as const,
      metadata: {
        original_test_count: validatedData.tests.length,
        feedback: validatedData.feedback,
        options: validatedData.options
      }
    };

    const aiResponse = await aiManager.executeRequest(aiRequest);

    try {
      const optimizedContent = JSON.parse(aiResponse.content);

      return c.json({
        success: true,
        data: {
          optimizations: optimizedContent.optimizations || [],
          overall_metrics: optimizedContent.overall_metrics || {},
          recommendations: optimizedContent.recommendations || [],
          metadata: {
            optimized_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            cost: aiResponse.cost.totalCost,
            processing_time: aiResponse.processingTime
          }
        }
      });

    } catch (parseError) {
      return c.json({
        success: true,
        data: {
          raw_response: aiResponse.content,
          metadata: {
            optimized_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            warning: 'Response could not be parsed as JSON'
          }
        }
      });
    }

  } catch (error) {
    console.error('AI test optimization failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to optimize tests',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai/analyze-failure
 * Analyze test failures and provide intelligent debugging assistance
 */
aiRoutes.post('/analyze-failure', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = analyzeFailureSchema.parse(body);

    const prompt = `
Analyze the following test failure and provide detailed debugging assistance:

Test Information:
- Test Name: ${validatedData.test_name}
- Test Case: ${validatedData.test_case}
- Error Message: ${validatedData.error_message}
- Error Stack: ${validatedData.error_stack || 'Not available'}
- Test Logs: ${validatedData.test_logs || 'Not available'}

Environment:
${JSON.stringify(validatedData.environment, null, 2)}

Context:
${JSON.stringify(validatedData.context, null, 2)}

Requirements:
1. Identify the root cause of the failure
2. Assess the severity and impact
3. Provide specific fix recommendations
4. Suggest preventive measures
5. Recommend additional tests to prevent regression

Return the response in valid JSON format:
{
  "analysis": {
    "root_cause": "Primary cause of failure",
    "severity": "critical|high|medium|low",
    "category": "functional|performance|environment|data|infrastructure",
    "confidence": 85
  },
  "suggested_fix": {
    "description": "Detailed fix description",
    "code_changes": ["Specific code changes needed"],
    "configuration_changes": ["Config changes if any"],
    "estimated_effort": "Complexity level (low/medium/high)"
  },
  "prevention": {
    "measures": ["Preventive measures"],
    "monitoring_suggestions": ["Monitoring recommendations"],
    "additional_tests": ["Tests to prevent regression"]
  },
  "related_issues": ["Potentially related issues"],
  "next_steps": ["Immediate action items"]
}
    `;

    const aiRequest = {
      userId: authUser.id,
      type: 'bug_analysis' as AIRequestType,
      prompt: prompt.trim(),
      parameters: {
        temperature: 0.5, // Balanced creativity and accuracy
        maxTokens: 2500,
        responseFormat: 'json' as const
      },
      priority: 'high' as const, // Higher priority for failure analysis
      metadata: {
        test_name: validatedData.test_name,
        error_message: validatedData.error_message,
        environment: validatedData.environment
      }
    };

    const aiResponse = await aiManager.executeRequest(aiRequest);

    try {
      const analysisContent = JSON.parse(aiResponse.content);

      return c.json({
        success: true,
        data: {
          analysis: analysisContent.analysis || {},
          suggested_fix: analysisContent.suggested_fix || {},
          prevention: analysisContent.prevention || {},
          related_issues: analysisContent.related_issues || [],
          next_steps: analysisContent.next_steps || [],
          metadata: {
            analyzed_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            cost: aiResponse.cost.totalCost,
            processing_time: aiResponse.processingTime
          }
        }
      });

    } catch (parseError) {
      return c.json({
        success: true,
        data: {
          raw_analysis: aiResponse.content,
          metadata: {
            analyzed_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            warning: 'Response could not be parsed as JSON'
          }
        }
      });
    }

  } catch (error) {
    console.error('AI failure analysis failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to analyze test failure',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/ai/analyze-performance
 * Analyze test performance data and provide optimization recommendations
 */
aiRoutes.post('/analyze-performance', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = await c.req.json();
    const validatedData = analyzePerformanceSchema.parse(body);

    const prompt = `
Analyze the following test performance data and provide optimization recommendations:

Test Results:
${JSON.stringify(validatedData.test_results, null, 2)}

Performance Baselines:
${JSON.stringify(validatedData.baselines, null, 2)}

Environment:
${JSON.stringify(validatedData.environment, null, 2)}

Performance Thresholds:
${JSON.stringify(validatedData.thresholds, null, 2)}

Requirements:
1. Identify performance bottlenecks and slow tests
2. Compare against baselines and thresholds
3. Suggest performance optimizations
4. Recommend test structure improvements
5. Identify trends and patterns

Return the response in valid JSON format:
{
  "performance_analysis": {
    "overall_health": "excellent|good|fair|poor",
    "average_response_time": 1234,
    "average_execution_time": 2345,
    "performance_score": 85,
    "issues_found": 3
  },
  "bottlenecks": [
    {
      "test_name": "Test name",
      "issue": "Specific performance issue",
      "impact": "high|medium|low",
      "recommendation": "Specific optimization"
    }
  ],
  "optimizations": [
    {
      "category": "test_structure|data_setup|execution|cleanup",
      "recommendation": "Optimization description",
      "estimated_improvement": "percentage",
      "effort": "low|medium|high"
    }
  ],
  "trends": {
    "performance_trend": "improving|stable|degrading",
    "recommendations": ["Trend-based recommendations"]
  }
}
    `;

    const aiRequest = {
      userId: authUser.id,
      type: 'performance_analysis' as AIRequestType,
      prompt: prompt.trim(),
      parameters: {
        temperature: 0.3, // Lower temperature for more analytical response
        maxTokens: 2500,
        responseFormat: 'json' as const
      },
      priority: 'normal' as const,
      metadata: {
        test_count: validatedData.test_results.length,
        environment: validatedData.environment
      }
    };

    const aiResponse = await aiManager.executeRequest(aiRequest);

    try {
      const performanceContent = JSON.parse(aiResponse.content);

      return c.json({
        success: true,
        data: {
          performance_analysis: performanceContent.performance_analysis || {},
          bottlenecks: performanceContent.bottlenecks || [],
          optimizations: performanceContent.optimizations || [],
          trends: performanceContent.trends || {},
          metadata: {
            analyzed_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            cost: aiResponse.cost.totalCost,
            processing_time: aiResponse.processingTime
          }
        }
      });

    } catch (parseError) {
      return c.json({
        success: true,
        data: {
          raw_analysis: aiResponse.content,
          metadata: {
            analyzed_by: aiResponse.provider,
            model: aiResponse.model,
            tokens_used: aiResponse.usage.totalTokens,
            warning: 'Response could not be parsed as JSON'
          }
        }
      });
    }

  } catch (error) {
    console.error('AI performance analysis failed:', error);

    if (error instanceof z.ZodError) {
      throw new HTTPException(400, {
        message: 'Invalid request data',
        details: error.errors
      });
    }

    throw new HTTPException(500, {
      message: 'Failed to analyze performance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ai/usage
 * Get AI usage statistics and costs for the authenticated user
 */
aiRoutes.get('/usage', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const db = drizzle(c.env.DB, { schema });

    // Get usage metrics from last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const usageMetrics = await db.query.aiUsageMetrics.findMany({
      where: (metrics, { and, gte, eq }) =>
        and(
          eq(metrics.userId, authUser.id),
          gte(metrics.timestamp, thirtyDaysAgo)
        ),
      orderBy: (metrics, { desc }) => desc(metrics.timestamp),
      limit: 100
    });

    // Get generation logs
    const generationLogs = await db.query.aiGenerationLogs.findMany({
      where: (logs, { and, eq }) => eq(logs.projectId, authUser.id), // This would need project filtering
      orderBy: (logs, { desc }) => desc(logs.createdAt),
      limit: 50
    });

    // Calculate statistics
    const totalCost = usageMetrics.reduce((sum, metric) => sum + metric.cost, 0);
    const totalTokens = usageMetrics.reduce((sum, metric) => sum + metric.tokensUsed, 0);
    const totalRequests = usageMetrics.length;
    const successRate = usageMetrics.filter(metric => metric.success).length / Math.max(totalRequests, 1) * 100;

    const providerUsage = usageMetrics.reduce((acc, metric) => {
      acc[metric.provider] = (acc[metric.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return c.json({
      success: true,
      data: {
        summary: {
          total_requests: totalRequests,
          total_cost: totalCost,
          total_tokens: totalTokens,
          success_rate: Math.round(successRate * 100) / 100,
          average_cost_per_request: totalRequests > 0 ? totalCost / totalRequests : 0
        },
        provider_usage: providerUsage,
        recent_metrics: usageMetrics.slice(0, 20),
        recent_generations: generationLogs.slice(0, 10),
        period: 'Last 30 days',
        currency: 'USD'
      }
    });

  } catch (error) {
    console.error('Failed to fetch AI usage:', error);
    throw new HTTPException(500, {
      message: 'Failed to fetch usage statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ai/providers
 * Get status and health information for AI providers
 */
aiRoutes.get('/providers', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const providers = aiManager.getProviders();
    const healthStatus = await aiManager.healthCheck();
    const providerMetrics = aiManager.getProviderMetrics();

    const providersInfo = providers.map(provider => ({
      name: provider.name,
      type: provider.type,
      is_available: provider.isAvailable,
      is_healthy: healthStatus[provider.type]?.isHealthy || false,
      priority: provider.priority,
      models: provider.models.map(model => ({
        id: model.id,
        name: model.name,
        type: model.type,
        max_tokens: model.maxTokens,
        quality: model.quality,
        response_time: model.responseTime
      })),
      capabilities: provider.capabilities,
      rate_limits: provider.rateLimits,
      metrics: providerMetrics.get(provider.type) || {
        requests: 0,
        avg_response_time: 0,
        cost: 0
      },
      health_status: healthStatus[provider.type] || {
        is_healthy: false,
        uptime: 0,
        error_rate: 0
      }
    }));

    return c.json({
      success: true,
      data: {
        providers: providersInfo,
        default_provider: aiManager.getProvider('openai') ? 'openai' : 'unknown',
        total_providers: providers.length,
        healthy_providers: providersInfo.filter(p => p.is_healthy).length
      }
    });

  } catch (error) {
    console.error('Failed to fetch AI providers:', error);
    throw new HTTPException(500, {
      message: 'Failed to fetch provider information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/ai/health
 * Health check endpoint for AI services
 */
aiRoutes.get('/health', async (c) => {
  try {
    const healthStatus = await aiManager.healthCheck();
    const providers = aiManager.getProviders();

    const healthyProviders = Object.entries(healthStatus)
      .filter(([_, status]) => status.isHealthy)
      .length;

    const overallHealth = healthyProviders === providers.length ? 'healthy' :
                         healthyProviders > 0 ? 'degraded' : 'unhealthy';

    return c.json({
      status: overallHealth,
      timestamp: new Date().toISOString(),
      providers: providers.length,
      healthy_providers: healthyProviders,
      details: healthStatus
    });

  } catch (error) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 503);
  }
});

export { aiRoutes };