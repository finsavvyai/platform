/**
 * AI Management API Endpoints
 *
 * Comprehensive API for managing AI services, including:
 * - AI service health monitoring
 * - Provider configuration and quota management
 * - Usage analytics and cost tracking
 * - Test generation and optimization workflows
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import * as schema from '../db/schema';
import {
  getAITestGenerationService,
  initializeAITestGenerationService,
  AIServiceError,
  AITestGenerationService
} from '../services/ai-test-generation';

export class AIManagementAPI {
  private db: any;
  private aiService: AITestGenerationService;

  constructor(d1Database: D1Database) {
    this.db = drizzle(d1Database, { schema });

    // Initialize or get AI service instance
    try {
      this.aiService = getAITestGenerationService();
    } catch {
      this.aiService = initializeAITestGenerationService(d1Database);
    }
  }

  /**
   * Get AI service health status
   */
  async getHealthStatus(request: Request, env: any): Promise<Response> {
    try {
      const healthChecks = [];

      // Check each provider's health
      for (const [name, provider] of (this.aiService as any).providers) {
        const health = await provider.healthCheck();
        const quota = await provider.getQuotaUsage();

        healthChecks.push({
          provider: name,
          status: health.status,
          latency: health.latency,
          quotaUsage: {
            used: quota.used,
            limit: quota.limit,
            percentage: Math.round((quota.used / quota.limit) * 100),
            resetTime: quota.resetTime
          },
          lastChecked: new Date().toISOString()
        });
      }

      // Get overall service metrics
      const usageMetrics = this.aiService.getUsageMetrics();

      return Response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        providers: healthChecks,
        usage: {
          totalCost: usageMetrics.totalCost,
          costLimit: (this.aiService as any).config.costLimit,
          costPercentage: Math.round((usageMetrics.totalCost / (this.aiService as any).config.costLimit) * 100),
          totalTokens: usageMetrics.totalTokens,
          operationsCount: usageMetrics.operationsCount,
          successRate: usageMetrics.successRate
        },
        config: {
          defaultProvider: (this.aiService as any).config.defaultProvider,
          enableCaching: (this.aiService as any).config.enableCaching,
          enableFallback: (this.aiService as any).config.enableFallback,
          retryAttempts: (this.aiService as any).config.retryAttempts
        }
      });

    } catch (error) {
      console.error('Health check failed:', error);
      return Response.json({
        status: 'error',
        message: 'Failed to get AI service health status',
        error: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Generate AI test cases
   */
  async generateTestCases(request: Request, env: any): Promise<Response> {
    try {
      const body = await request.json();
      const {
        description,
        context = {},
        options = {},
        projectId
      } = body;

      if (!description) {
        return Response.json({
          error: 'Missing required field: description'
        }, { status: 400 });
      }

      // Log the generation request
      console.log(`🤖 Generating test cases for project ${projectId}: ${description.substring(0, 100)}...`);

      const testCases = await this.aiService.generateTestCases(description, context, options);

      // Store generation request in database
      if (projectId) {
        await this.db.insert(schema.aiGenerationLogs).values({
          projectId,
          description,
          context: JSON.stringify(context),
          options: JSON.stringify(options),
          resultCount: testCases.length,
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return Response.json({
        success: true,
        testCases,
        metadata: {
          count: testCases.length,
          generatedAt: new Date().toISOString(),
          provider: options.provider || (this.aiService as any).config.defaultProvider,
          context: {
            projectInfo: context.projectInfo?.name || 'Unknown',
            constraints: context.constraints || {}
          }
        }
      });

    } catch (error) {
      console.error('Test generation failed:', error);

      // Log failed request
      if (body.projectId) {
        await this.db.insert(schema.aiGenerationLogs).values({
          projectId: body.projectId,
          description: body.description,
          context: JSON.stringify(body.context || {}),
          options: JSON.stringify(body.options || {}),
          resultCount: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return Response.json({
        error: 'Failed to generate test cases',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof AIServiceError ? error.code : 'GENERATION_FAILED'
      }, { status: 500 });
    }
  }

  /**
   * Optimize existing test cases
   */
  async optimizeTestCases(request: Request, env: any): Promise<Response> {
    try {
      const body = await request.json();
      const {
        testCases,
        feedback,
        options = {},
        projectId
      } = body;

      if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
        return Response.json({
          error: 'Missing or invalid field: testCases'
        }, { status: 400 });
      }

      console.log(`🔧 Optimizing ${testCases.length} test cases for project ${projectId}`);

      const optimizedTests = await this.aiService.optimizeTestCases(testCases, feedback, options);

      // Store optimization request
      if (projectId) {
        await this.db.insert(schema.aiOptimizationLogs).values({
          projectId,
          originalTestCount: testCases.length,
          optimizedTestCount: optimizedTests.length,
          feedback: JSON.stringify(feedback || {}),
          improvements: optimizedTests.map(t => t.optimizations).flat(),
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      return Response.json({
        success: true,
        optimizedTests,
        metadata: {
          originalCount: testCases.length,
          optimizedCount: optimizedTests.length,
          averageImprovement: optimizedTests.reduce((sum, t) => sum + t.improvementScore, 0) / optimizedTests.length,
          totalEstimatedROI: optimizedTests.reduce((sum, t) => sum + t.estimatedROI, 0),
          optimizedAt: new Date().toISOString(),
          provider: options.provider || (this.aiService as any).config.defaultProvider
        }
      });

    } catch (error) {
      console.error('Test optimization failed:', error);

      return Response.json({
        error: 'Failed to optimize test cases',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof AIServiceError ? error.code : 'OPTIMIZATION_FAILED'
      }, { status: 500 });
    }
  }

  /**
   * Analyze test coverage
   */
  async analyzeCoverage(request: Request, env: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const projectId = url.searchParams.get('projectId');
      const options = {
        provider: url.searchParams.get('provider') || undefined,
        includeRecommendations: url.searchParams.get('includeRecommendations') === 'true'
      };

      if (!projectId) {
        return Response.json({
          error: 'Missing required parameter: projectId'
        }, { status: 400 });
      }

      console.log(`📊 Analyzing test coverage for project ${projectId}`);

      const coverageAnalysis = await this.aiService.analyzeTestCoverage(projectId, options);

      // Store analysis result
      await this.db.insert(schema.coverageAnalysisLogs).values({
        projectId,
        overallCoverage: coverageAnalysis.overallCoverage,
        functionalCoverage: coverageAnalysis.functionalCoverage,
        riskCoverage: coverageAnalysis.riskCoverage,
        gaps: JSON.stringify(coverageAnalysis.gaps),
        recommendations: JSON.stringify(coverageAnalysis.recommendations),
        analyzedAt: new Date()
      });

      return Response.json({
        success: true,
        coverage: coverageAnalysis,
        metadata: {
          projectId,
          analyzedAt: new Date().toISOString(),
          provider: options.provider || (this.aiService as any).config.defaultProvider,
          recommendationsCount: coverageAnalysis.recommendations.length,
          gapsCount: coverageAnalysis.gaps.length
        }
      });

    } catch (error) {
      console.error('Coverage analysis failed:', error);

      return Response.json({
        error: 'Failed to analyze test coverage',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof AIServiceError ? error.code : 'ANALYSIS_FAILED'
      }, { status: 500 });
    }
  }

  /**
   * Get AI usage analytics
   */
  async getUsageAnalytics(request: Request, env: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const timeframe = {
        from: url.searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: url.searchParams.get('to') || new Date().toISOString()
      };

      const usageMetrics = this.aiService.getUsageMetrics(timeframe);

      // Get detailed logs from database
      const generationLogs = await this.db.select()
        .from(schema.aiGenerationLogs)
        .where(and(
          gte(schema.aiGenerationLogs.createdAt, timeframe.from),
          lte(schema.aiGenerationLogs.createdAt, timeframe.to)
        ))
        .orderBy(desc(schema.aiGenerationLogs.createdAt))
        .limit(100);

      const optimizationLogs = await this.db.select()
        .from(schema.aiOptimizationLogs)
        .where(and(
          gte(schema.aiOptimizationLogs.createdAt, timeframe.from),
          lte(schema.aiOptimizationLogs.createdAt, timeframe.to)
        ))
        .orderBy(desc(schema.aiOptimizationLogs.createdAt))
        .limit(100);

      // Calculate trends
      const dailyUsage = this.calculateDailyUsage(generationLogs, optimizationLogs);
      const providerBreakdown = usageMetrics.providerBreakdown;

      return Response.json({
        success: true,
        analytics: {
          timeframe,
          summary: {
            totalCost: usageMetrics.totalCost,
            totalTokens: usageMetrics.totalTokens,
            operationsCount: usageMetrics.operationsCount,
            successRate: usageMetrics.successRate
          },
          providerBreakdown,
          trends: {
            dailyUsage,
            costProjection: this.calculateCostProjection(dailyUsage),
            efficiencyTrend: this.calculateEfficiencyTrend(generationLogs, optimizationLogs)
          },
          recentActivity: {
            generationLogs: generationLogs.slice(0, 10),
            optimizationLogs: optimizationLogs.slice(0, 10)
          }
        }
      });

    } catch (error) {
      console.error('Usage analytics failed:', error);

      return Response.json({
        error: 'Failed to get usage analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Get AI configuration
   */
  async getConfiguration(request: Request, env: any): Promise<Response> {
    try {
      const config = (this.aiService as any).config;
      const providers = [];

      // Get provider configurations
      for (const [name, provider] of (this.aiService as any).providers) {
        const quota = await provider.getQuotaUsage();
        providers.push({
          name,
          quota,
          status: 'active' // Would be determined by health checks
        });
      }

      return Response.json({
        success: true,
        configuration: {
          defaultProvider: config.defaultProvider,
          maxTokensPerRequest: config.maxTokensPerRequest,
          costLimit: config.costLimit,
          enableCaching: config.enableCaching,
          cacheExpiry: config.cacheExpiry,
          retryAttempts: config.retryAttempts,
          retryDelay: config.retryDelay,
          enableFallback: config.enableFallback,
          quotaThreshold: config.quotaThreshold
        },
        providers,
        metadata: {
          totalProviders: providers.length,
          activeProviders: providers.length,
          lastUpdated: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Get configuration failed:', error);

      return Response.json({
        error: 'Failed to get AI configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Update AI configuration
   */
  async updateConfiguration(request: Request, env: any): Promise<Response> {
    try {
      const body = await request.json();
      const updates = body.updates;

      if (!updates || typeof updates !== 'object') {
        return Response.json({
          error: 'Missing or invalid field: updates'
        }, { status: 400 });
      }

      // Validate updates
      const allowedFields = [
        'defaultProvider', 'maxTokensPerRequest', 'costLimit',
        'enableCaching', 'cacheExpiry', 'retryAttempts',
        'retryDelay', 'enableFallback', 'quotaThreshold'
      ];

      const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
      if (invalidFields.length > 0) {
        return Response.json({
          error: `Invalid configuration fields: ${invalidFields.join(', ')}`
        }, { status: 400 });
      }

      // Apply updates (in a real implementation, this would persist the configuration)
      Object.assign((this.aiService as any).config, updates);

      console.log('⚙️ AI configuration updated:', Object.keys(updates));

      return Response.json({
        success: true,
        configuration: (this.aiService as any).config,
        updatedFields: Object.keys(updates),
        updatedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Update configuration failed:', error);

      return Response.json({
        error: 'Failed to update AI configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Helper methods for analytics
   */
  private calculateDailyUsage(generationLogs: any[], optimizationLogs: any[]): any[] {
    const dailyData = new Map();

    // Process generation logs
    generationLogs.forEach(log => {
      const day = log.createdAt.split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, { generations: 0, optimizations: 0, cost: 0 });
      }
      dailyData.get(day).generations++;
    });

    // Process optimization logs
    optimizationLogs.forEach(log => {
      const day = log.createdAt.split('T')[0];
      if (!dailyData.has(day)) {
        dailyData.set(day, { generations: 0, optimizations: 0, cost: 0 });
      }
      dailyData.get(day).optimizations++;
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateCostProjection(dailyUsage: any[]): number {
    if (dailyUsage.length === 0) return 0;

    const averageDailyCost = dailyUsage.reduce((sum, day) => {
      const estimatedCost = (day.generations * 0.03) + (day.optimizations * 0.02);
      return sum + estimatedCost;
    }, 0) / dailyUsage.length;

    return averageDailyCost * 30; // 30-day projection
  }

  private calculateEfficiencyTrend(generationLogs: any[], optimizationLogs: any[]): 'improving' | 'stable' | 'declining' {
    // Simple trend calculation based on recent activity
    const recentGenerations = generationLogs.slice(0, 7).length;
    const olderGenerations = generationLogs.slice(7, 14).length;

    const recentOptimizations = optimizationLogs.slice(0, 7).length;
    const olderOptimizations = optimizationLogs.slice(7, 14).length;

    const recentTotal = recentGenerations + recentOptimizations;
    const olderTotal = olderGenerations + olderOptimizations;

    if (recentTotal > olderTotal * 1.2) return 'improving';
    if (recentTotal < olderTotal * 0.8) return 'declining';
    return 'stable';
  }
}

/**
 * Route handlers for the AI management API
 */
export async function handleAIHealthCheck(request: Request, env: any): Promise<Response> {
  const api = new AIManagementAPI(env.DB);
  return api.getHealthStatus(request, env);
}

export async function handleAITestGeneration(request: Request, env: any): Promise<Response> {
  const api = new AIManagementAPI(env.DB);
  return api.generateTestCases(request, env);
}

export async function handleAITestOptimization(request: Request, env: any): Promise<Response> {
  const api = new AIManagementAPI(env.DB);
  return api.optimizeTestCases(request, env);
}

export async function handleAICoverageAnalysis(request: Request, env: any): Promise<Response> {
  const api = new AIManagementAPI(env.DB);
  return api.analyzeCoverage(request, env);
}

export async function handleAIUsageAnalytics(request: Request, env: any): Promise<Response> {
  const api = new AIManagementAPI(env.DB);
  return api.getUsageAnalytics(request, env);
}

export async function handleAIConfiguration(request: Request, env: any): Promise<Response> {
  const api = new AIManagementAPI(env.DB);

  if (request.method === 'GET') {
    return api.getConfiguration(request, env);
  } else if (request.method === 'PUT') {
    return api.updateConfiguration(request, env);
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
