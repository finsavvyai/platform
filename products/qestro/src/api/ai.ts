/**
 * AI API Routes
 *
 * Comprehensive API endpoints for AI-powered testing features including:
 * - Natural language test generation
 * - Test optimization and enhancement
 * - Bug analysis and root cause detection
 * - Usage tracking and analytics
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";

// Import AI services
import { AIManager } from "../services/ai/ai-manager";
import { AITestGenerator } from "../services/ai/test-generator";
import { AITestOptimizer } from "../services/ai/test-optimizer";
import { AIBugAnalyzer } from "../services/ai/bug-analyzer";
import { AICostTracker } from "../services/ai/cost-tracker";
import { AICacheManager } from "../services/ai/cache-manager";

// Initialize AI services
const aiManager = new AIManager();
const testGenerator = new AITestGenerator();
const testOptimizer = new AITestOptimizer();
const bugAnalyzer = new AIBugAnalyzer();
const costTracker = new AICostTracker();
const cacheManager = new AICacheManager();

const ai = new Hono();

// Error handling middleware
ai.onError((err, c) => {
  console.error("AI API Error:", err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
        timestamp: new Date().toISOString(),
        path: c.req.path,
      },
      err.status,
    );
  }

  return c.json(
    {
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
      timestamp: new Date().toISOString(),
      path: c.req.path,
    },
    500,
  );
});

// Rate limiting middleware (simplified - in production use a proper rate limiter)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const rateLimitMiddleware = async (c: any, next: any) => {
  const clientId =
    c.req.header("x-client-id") ||
    c.req.header("cf-connecting-ip") ||
    "anonymous";
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100; // requests per minute

  const now = Date.now();
  const clientData = rateLimitMap.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
    await next();
    return;
  }

  if (clientData.count >= maxRequests) {
    return c.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
      },
      429,
    );
  }

  clientData.count++;
  await next();
};

// Apply rate limiting to all AI endpoints
ai.use("*", rateLimitMiddleware);

// Request validation schemas
const generateTestSchema = z.object({
  description: z
    .string()
    .min(1, "Test description is required")
    .max(5000, "Description too long"),
  platform: z.enum(["ios", "android", "web", "api"]).optional(),
  framework: z
    .enum(["maestro", "playwright", "cypress", "jest", "postman"])
    .optional(),
  context: z
    .object({
      applicationType: z.enum(["mobile", "web", "api"]).optional(),
      targetEnvironment: z.string().optional(),
      existingTests: z.array(z.string()).optional(),
      testingGuidelines: z.string().optional(),
      performanceRequirements: z
        .object({
          maxExecutionTime: z.number().optional(),
          maxFailureRate: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  options: z
    .object({
      includeEdgeCases: z.boolean().optional(),
      generateAssertions: z.boolean().optional(),
      complexity: z.enum(["basic", "intermediate", "advanced"]).optional(),
      outputFormat: z.enum(["yaml", "json", "typescript"]).optional(),
    })
    .optional(),
});

const optimizeTestSchema = z.object({
  tests: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(["mobile", "web", "api"]),
        platform: z.string().optional(),
        content: z.string(),
        metadata: z.object({
          lastRunStatus: z.enum(["passed", "failed", "flaky"]).optional(),
          averageExecutionTime: z.number().optional(),
          lastRunDuration: z.number().optional(),
          runCount: z.number(),
          failureRate: z.number().min(0).max(1),
          lastFailure: z.string().optional(),
          complexity: z.enum(["low", "medium", "high"]),
          coverage: z.array(z.string()).optional(),
        }),
      }),
    )
    .min(1, "At least one test is required"),
  projectContext: z
    .object({
      framework: z.string(),
      targetPlatforms: z.array(z.string()),
      testingGuidelines: z.string().optional(),
      performanceThresholds: z
        .object({
          maxExecutionTime: z.number(),
          maxFailureRate: z.number(),
        })
        .optional(),
    })
    .optional(),
  optimizationType: z
    .enum(["comprehensive", "performance", "maintainability", "reliability"])
    .optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

const analyzeFailureSchema = z.object({
  failures: z
    .array(
      z.object({
        id: z.string(),
        testCaseId: z.string(),
        testName: z.string(),
        testType: z.enum(["mobile", "web", "api"]),
        platform: z.string().optional(),
        failureTime: z.string().transform((val) => new Date(val)),
        errorMessage: z.string(),
        errorType: z.string().optional(),
        stackTrace: z.string().optional(),
        screenshots: z.array(z.string()).optional(),
        networkLogs: z
          .array(
            z.object({
              url: z.string(),
              method: z.string(),
              status: z.number(),
              responseTime: z.number(),
              error: z.string().optional(),
            }),
          )
          .optional(),
        consoleLogs: z
          .array(
            z.object({
              level: z.enum(["error", "warn", "info", "debug"]),
              message: z.string(),
              timestamp: z.string().transform((val) => new Date(val)),
              source: z.string().optional(),
            }),
          )
          .optional(),
        executionContext: z
          .object({
            testData: z.any().optional(),
            environment: z.string().optional(),
            deviceState: z.any().optional(),
            browserState: z.any().optional(),
          })
          .optional(),
        previousRuns: z
          .array(
            z.object({
              timestamp: z.string().transform((val) => new Date(val)),
              status: z.enum(["passed", "failed"]),
              error: z.string().optional(),
              duration: z.number(),
            }),
          )
          .optional(),
        relatedFailures: z.array(z.string()).optional(),
      }),
    )
    .min(1, "At least one failure is required"),
  projectContext: z
    .object({
      framework: z.string(),
      targetPlatforms: z.array(z.string()),
      applicationType: z.enum(["mobile", "web", "api"]),
      recentChanges: z
        .array(
          z.object({
            type: z.enum(["code", "config", "environment", "dependency"]),
            description: z.string(),
            timestamp: z.string().transform((val) => new Date(val)),
          }),
        )
        .optional(),
      environmentInfo: z
        .object({
          os: z.string().optional(),
          browser: z.string().optional(),
          device: z.string().optional(),
          networkConditions: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  analysisType: z
    .enum([
      "single_failure",
      "pattern_analysis",
      "regression_detection",
      "comprehensive",
    ])
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  integrationSettings: z
    .object({
      bugTracker: z.enum(["jira", "github", "gitlab", "azure"]).optional(),
      autoCreateTickets: z.boolean().optional(),
      notificationSettings: z
        .object({
          slack: z.string().optional(),
          email: z.string().optional(),
          teams: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const usageQuerySchema = z.object({
  startDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  endDate: z
    .string()
    .transform((val) => new Date(val))
    .optional(),
  granularity: z.enum(["hour", "day", "week", "month"]).optional(),
  includeBreakdown: z.boolean().optional(),
});

/**
 * POST /api/ai/generate-test
 * Generate test cases from natural language descriptions
 */
ai.post("/generate-test", zValidator("json", generateTestSchema), async (c) => {
  const userId = c.get("userId") || c.req.header("x-user-id") || "anonymous";
  const projectId =
    c.get("projectId") || c.req.header("x-project-id") || "default";

  try {
    const requestData = c.req.valid("json");

    // Check user's subscription limits
    const userLimits = await costTracker.checkUserLimits(userId);
    if (!userLimits.canGenerateTest) {
      throw new HTTPException(429, {
        message: "Test generation limit reached for your subscription plan",
      });
    }

    const generationRequest = {
      userId,
      projectId,
      description: requestData.description,
      platform: requestData.platform,
      framework: requestData.framework,
      context: requestData.context || {},
      options: {
        includeEdgeCases: requestData.options?.includeEdgeCases ?? true,
        generateAssertions: requestData.options?.generateAssertions ?? true,
        complexity: requestData.options?.complexity ?? "intermediate",
        outputFormat: requestData.options?.outputFormat ?? "yaml",
      },
    };

    const result = await testGenerator.generateTests(generationRequest);

    return c.json({
      success: true,
      data: {
        id: result.id,
        requestId: result.requestId,
        generatedTests: result.generatedTests,
        confidence: result.confidence,
        metadata: {
          platform: result.platform,
          framework: result.framework,
          estimatedExecutionTime: result.estimatedExecutionTime,
          complexityLevel: result.complexityLevel,
          testCount: result.generatedTests.length,
          generationTime: result.generationTime,
        },
      },
      usage: {
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0,
        remainingQuota: userLimits.remainingQuota,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Test generation error:", error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: "Failed to generate tests" });
  }
});

/**
 * POST /api/ai/optimize-test
 * Analyze and optimize existing tests
 */
ai.post("/optimize-test", zValidator("json", optimizeTestSchema), async (c) => {
  const userId = c.get("userId") || c.req.header("x-user-id") || "anonymous";
  const projectId =
    c.get("projectId") || c.req.header("x-project-id") || "default";

  try {
    const requestData = c.req.valid("json");

    // Check user's subscription limits
    const userLimits = await costTracker.checkUserLimits(userId);
    if (!userLimits.canOptimizeTest) {
      throw new HTTPException(429, {
        message: "Test optimization limit reached for your subscription plan",
      });
    }

    const optimizationRequest = {
      userId,
      projectId,
      tests: requestData.tests,
      projectContext: requestData.projectContext || {},
      optimizationType: requestData.optimizationType || "comprehensive",
      priority: requestData.priority || "medium",
    };

    const result = await testOptimizer.optimizeTests(optimizationRequest);

    return c.json({
      success: true,
      data: {
        id: result.id,
        requestId: result.requestId,
        optimizations: result.optimizations,
        summary: result.summary,
        estimatedImpact: result.estimatedImpact,
        confidence: result.confidence,
        metadata: {
          totalOptimizations: result.optimizations.length,
          quickWins: result.summary.quickWins.length,
          strategicImprovements: result.summary.strategicImprovements.length,
          optimizationType: requestData.optimizationType,
          testsAnalyzed: requestData.tests.length,
        },
      },
      usage: {
        tokensUsed: 0, // Would be tracked by the AI manager
        cost: 0,
        remainingQuota: userLimits.remainingQuota,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Test optimization error:", error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: "Failed to optimize tests" });
  }
});

/**
 * POST /api/ai/analyze-failure
 * Analyze test failures and provide debugging assistance
 */
ai.post(
  "/analyze-failure",
  zValidator("json", analyzeFailureSchema),
  async (c) => {
    const userId = c.get("userId") || c.req.header("x-user-id") || "anonymous";
    const projectId =
      c.get("projectId") || c.req.header("x-project-id") || "default";

    try {
      const requestData = c.req.valid("json");

      // Check user's subscription limits
      const userLimits = await costTracker.checkUserLimits(userId);
      if (!userLimits.canAnalyzeFailure) {
        throw new HTTPException(429, {
          message: "Failure analysis limit reached for your subscription plan",
        });
      }

      const analysisRequest = {
        userId,
        projectId,
        failures: requestData.failures,
        projectContext: requestData.projectContext || {},
        analysisType: requestData.analysisType || "comprehensive",
        priority: requestData.priority || "high",
        integrationSettings: requestData.integrationSettings || {},
      };

      const result = await bugAnalyzer.analyzeFailures(analysisRequest);

      return c.json({
        success: true,
        data: {
          id: result.id,
          requestId: result.requestId,
          analysisType: result.analysisType,
          classifications: result.classifications,
          rootCauseAnalysis: result.rootCauseAnalysis,
          suggestedFixes: result.suggestedFixes,
          patternAnalysis: result.patternAnalysis,
          regressionAnalysis: result.regressionAnalysis,
          relatedIssues: result.relatedIssues,
          bugTickets: result.bugTickets,
          summary: result.summary,
          confidence: result.confidence,
          metadata: {
            totalFailures: result.failures.length,
            criticalFailures: result.summary.criticalFailures,
            highFailures: result.summary.highFailures,
            analysisType: requestData.analysisType,
            bugTicketsCreated: result.bugTickets?.length || 0,
          },
        },
        usage: {
          tokensUsed: 0,
          cost: 0,
          remainingQuota: userLimits.remainingQuota,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failure analysis error:", error);
      if (error instanceof HTTPException) {
        throw error;
      }
      throw new HTTPException(500, { message: "Failed to analyze failures" });
    }
  },
);

/**
 * GET /api/ai/usage
 * Get AI usage statistics and analytics
 */
ai.get("/usage", zValidator("query", usageQuerySchema), async (c) => {
  const userId = c.get("userId") || c.req.header("x-user-id") || "anonymous";
  const projectId =
    c.get("projectId") || c.req.header("x-project-id") || "default";

  try {
    const queryData = c.req.valid("query");

    const usageAnalytics = await costTracker.getUsageAnalytics(
      userId,
      queryData.granularity || "day",
      queryData.startDate,
      queryData.endDate,
      queryData.includeBreakdown ?? false,
    );

    const userLimits = await costTracker.checkUserLimits(userId);

    return c.json({
      success: true,
      data: {
        currentUsage: usageAnalytics,
        limits: {
          monthlyLimit: userLimits.monthlyLimit,
          remainingQuota: userLimits.remainingQuota,
          resetDate: userLimits.resetDate,
          features: userLimits.features,
        },
        period: {
          startDate:
            queryData.startDate ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: queryData.endDate || new Date(),
          granularity: queryData.granularity || "day",
        },
        breakdown: queryData.includeBreakdown
          ? {
              byService: usageAnalytics.byService || {},
              byType: usageAnalytics.byType || {},
              byProvider: usageAnalytics.byProvider || {},
            }
          : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Usage analytics error:", error);
    throw new HTTPException(500, {
      message: "Failed to retrieve usage analytics",
    });
  }
});

/**
 * GET /api/ai/models
 * Get available AI models and providers
 */
ai.get("/models", async (c) => {
  try {
    const availableProviders = await aiManager.getAvailableProviders();
    const modelInfo = availableProviders.map((provider) => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      capabilities: provider.capabilities,
      pricing: provider.pricing,
      status: provider.status,
      supportedFeatures: provider.supportedFeatures,
    }));

    return c.json({
      success: true,
      data: {
        providers: modelInfo,
        defaultProvider: aiManager.getDefaultProvider(),
        totalProviders: modelInfo.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Model info error:", error);
    throw new HTTPException(500, {
      message: "Failed to retrieve model information",
    });
  }
});

/**
 * GET /api/ai/health
 * Health check for AI services
 */
ai.get("/health", async (c) => {
  try {
    const healthStatus = await aiManager.getHealthStatus();
    const cacheStatus = await cacheManager.getHealthStatus();

    return c.json({
      success: true,
      data: {
        status: "healthy",
        services: {
          aiManager: healthStatus,
          cacheManager: cacheStatus,
          testGenerator: "operational",
          testOptimizer: "operational",
          bugAnalyzer: "operational",
          costTracker: "operational",
        },
        version: "1.0.0",
        uptime: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    return c.json(
      {
        success: false,
        data: {
          status: "degraded",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      },
      503,
    );
  }
});

/**
 * POST /api/ai/cache/clear
 * Clear AI response cache (admin only)
 */
ai.post("/cache/clear", async (c) => {
  const userId = c.get("userId") || c.req.header("x-user-id");
  const isAdmin = c.get("isAdmin") || c.req.header("x-admin-role") === "true";

  if (!isAdmin) {
    throw new HTTPException(403, { message: "Admin access required" });
  }

  try {
    const cacheKey = c.req.query("key");
    const clearedCount = await cacheManager.clearCache(cacheKey);

    return c.json({
      success: true,
      data: {
        clearedEntries: clearedCount,
        cacheKey: cacheKey || "all",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Cache clear error:", error);
    throw new HTTPException(500, { message: "Failed to clear cache" });
  }
});

/**
 * GET /api/ai/capabilities
 * Get AI service capabilities and features
 */
ai.get("/capabilities", async (c) => {
  try {
    const capabilities = {
      testGeneration: {
        supportedPlatforms: ["ios", "android", "web", "api"],
        supportedFrameworks: [
          "maestro",
          "playwright",
          "cypress",
          "jest",
          "postman",
        ],
        maxDescriptionLength: 5000,
        supportedLanguages: ["english"],
        features: [
          "natural_language_processing",
          "context_aware_generation",
          "quality_assessment",
        ],
      },
      testOptimization: {
        supportedTypes: [
          "flakiness_detection",
          "performance_optimization",
          "test_consolidation",
          "assertion_enhancement",
        ],
        analysisDepth: ["basic", "comprehensive"],
        optimizationCategories: [
          "reliability",
          "performance",
          "maintainability",
          "coverage",
          "best_practices",
        ],
      },
      failureAnalysis: {
        supportedCategories: [
          "assertion_failure",
          "timeout_error",
          "element_not_found",
          "network_error",
          "authentication_error",
        ],
        analysisTypes: [
          "single_failure",
          "pattern_analysis",
          "regression_detection",
          "comprehensive",
        ],
        integrationSupports: ["jira", "github", "gitlab", "azure"],
      },
      limits: {
        maxTestsPerRequest: 50,
        maxFailuresPerRequest: 100,
        maxDescriptionLength: 5000,
        maxResponseSize: "10MB",
      },
    };

    return c.json({
      success: true,
      data: capabilities,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Capabilities error:", error);
    throw new HTTPException(500, {
      message: "Failed to retrieve capabilities",
    });
  }
});

export { ai as aiRoutes };
