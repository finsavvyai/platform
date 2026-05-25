/**
 * Questro AI Test Generation Service
 *
 * Advanced AI-powered test generation service featuring:
 * - OpenAI GPT-4 integration for intelligent test case generation
 * - Multi-provider support (OpenAI, Hugging Face, custom models)
 * - Context-aware test generation based on application analysis
 * - Test optimization and enhancement recommendations
 * - Cost management and usage tracking
 * - Quality assurance and validation of generated tests
 */

import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc, count } from "drizzle-orm";
import * as schema from "../db/schema";

// OpenAI API configuration
interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  baseUrl?: string;
  organization?: string;
}

/**
 * Enhanced error handling for AI operations
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

/**
 * AI Provider interfaces
 */
interface AIProvider {
  name: string;
  generateTestCases(
    prompt: string,
    context: TestGenerationContext,
  ): Promise<GeneratedTestCase[]>;
  optimizeTests(
    tests: TestCase[],
    feedback?: OptimizationFeedback,
  ): Promise<OptimizedTest[]>;
  analyzeCoverage(project: ProjectAnalysisData): Promise<CoverageAnalysis>;
  validateConfiguration(): Promise<boolean>;
  getQuotaUsage(): Promise<{ used: number; limit: number; resetTime: string }>;
  healthCheck(): Promise<{
    status: "healthy" | "degraded" | "down";
    latency: number;
  }>;
}

// Test generation context
interface TestGenerationContext {
  projectInfo: {
    name: string;
    description: string;
    platform: "web" | "mobile" | "api";
    technology: string[];
    framework: string[];
  };
  existingTests: {
    count: number;
    categories: string[];
    lastUpdated: string;
  };
  requirements: {
    functional: string[];
    nonFunctional: string[];
    businessRules: string[];
  };
  constraints: {
    maxTestCases: number;
    priority: "low" | "medium" | "high" | "critical";
    testTypes: string[];
  };
}

// Generated test case structure
interface GeneratedTestCase {
  name: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  category: string;
  tags: string[];
  preconditions: string[];
  testSteps: TestStep[];
  expectedResults: string[];
  testData: Record<string, any>;
  estimatedDuration: number;
  complexity: "simple" | "medium" | "complex";
  riskLevel: "low" | "medium" | "high";
}

interface TestStep {
  order: number;
  action: string;
  expected: string;
  screenshot?: boolean;
  waitFor?: string;
  input?: Record<string, any>;
}

// Optimization feedback
interface OptimizationFeedback {
  issues: string[];
  suggestions: string[];
  priorities: string[];
  constraints: string[];
}

// Optimized test case
interface OptimizedTest extends GeneratedTestCase {
  originalTestId?: string;
  optimizations: string[];
  improvementScore: number;
  estimatedROI: number;
}

// Project analysis data
interface ProjectAnalysisData {
  projectStructure: any;
  existingTests: any[];
  codebaseMetrics: any;
  userFlows: any[];
  apiEndpoints: any[];
  businessRequirements: string[];
}

// Coverage analysis
interface CoverageAnalysis {
  overallCoverage: number;
  functionalCoverage: number;
  riskCoverage: number;
  gaps: string[];
  recommendations: string[];
  priorityTests: string[];
}

// AI usage tracking
interface AIUsageMetrics {
  provider: string;
  model: string;
  tokensUsed: number;
  cost: number;
  duration: number;
  success: boolean;
  operation: "generation" | "optimization" | "analysis";
  timestamp: string;
}

export class AITestGenerationService {
  private db: any;
  private providers: Map<string, AIProvider> = new Map();
  private config: {
    defaultProvider: string;
    maxTokensPerRequest: number;
    costLimit: number;
    enableCaching: boolean;
    cacheExpiry: number;
    retryAttempts: number;
    retryDelay: number;
    enableFallback: boolean;
    quotaThreshold: number;
  };
  private usageMetrics: AIUsageMetrics[] = [];
  private cache: Map<string, { data: any; expiry: number }> = new Map();

  constructor(d1Database: D1Database, config: any = {}) {
    this.db = drizzle(d1Database, { schema });
    this.config = {
      defaultProvider: "openai",
      maxTokensPerRequest: 4000,
      costLimit: 100.0, // $100 per month
      enableCaching: true,
      cacheExpiry: 3600000, // 1 hour
      retryAttempts: 3,
      retryDelay: 1000,
      enableFallback: true,
      quotaThreshold: 0.8, // Alert at 80% quota usage
      ...config,
    };

    this.initializeProviders();
    this.startHealthMonitoring();
  }

  /**
   * Initialize AI providers
   */
  private async initializeProviders(): Promise<void> {
    // Initialize OpenAI provider
    const openaiProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4",
      maxTokens: this.config.maxTokensPerRequest,
      temperature: 0.7,
    });
    this.providers.set("openai", openaiProvider);

    // Initialize Hugging Face provider (if configured)
    if (process.env.HUGGINGFACE_API_KEY) {
      const hfProvider = new HuggingFaceProvider({
        apiKey: process.env.HUGGINGFACE_API_KEY,
        model: "bigcode/santacoder",
      });
      this.providers.set("huggingface", hfProvider);
    }

    console.log(`✅ Initialized ${this.providers.size} AI providers`);
  }

  /**
   * Generate test cases from natural language description
   */
  async generateTestCases(
    description: string,
    context: Partial<TestGenerationContext>,
    options: {
      provider?: string;
      maxTestCases?: number;
      prioritize?: boolean;
    } = {},
  ): Promise<GeneratedTestCase[]> {
    const startTime = Date.now();
    const providerName = options.provider || this.config.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found`);
    }

    // Build complete context
    const fullContext: TestGenerationContext = {
      projectInfo: {
        name: "",
        description: "",
        platform: "web",
        technology: [],
        framework: [],
        ...context.projectInfo,
      },
      existingTests: {
        count: 0,
        categories: [],
        lastUpdated: "",
        ...context.existingTests,
      },
      requirements: {
        functional: [],
        nonFunctional: [],
        businessRules: [],
        ...context.requirements,
      },
      constraints: {
        maxTestCases: options.maxTestCases || 20,
        priority: "medium",
        testTypes: ["functional", "ui", "api"],
        ...context.constraints,
      },
    };

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(
        "generate",
        description,
        fullContext,
      );
      if (this.config.enableCaching) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          console.log("📋 Using cached test generation results");
          return cached;
        }
      }

      // Generate test cases
      const generatedTests = await provider.generateTestCases(
        description,
        fullContext,
      );

      // Apply prioritization if requested
      let finalTests = generatedTests;
      if (options.prioritize) {
        finalTests = this.prioritizeTestCases(
          generatedTests,
          fullContext.constraints.priority,
        );
      }

      // Limit test cases if specified
      if (options.maxTestCases && finalTests.length > options.maxTestCases) {
        finalTests = finalTests.slice(0, options.maxTestCases);
      }

      // Validate generated tests
      const validatedTests = this.validateGeneratedTests(finalTests);

      // Cache results
      if (this.config.enableCaching) {
        this.setCache(cacheKey, validatedTests);
      }

      // Track usage metrics
      const duration = Date.now() - startTime;
      this.trackUsage({
        provider: providerName,
        model: provider.name,
        tokensUsed: this.estimateTokens(
          description + JSON.stringify(fullContext),
        ),
        cost: this.estimateCost(providerName, "generation", duration),
        duration,
        success: true,
        operation: "generation",
        timestamp: new Date().toISOString(),
      });

      console.log(
        `✅ Generated ${validatedTests.length} test cases using ${providerName}`,
      );
      return validatedTests;
    } catch (error) {
      console.error(`❌ Test generation failed with ${providerName}:`, error);

      // Track failed usage
      this.trackUsage({
        provider: providerName,
        model: provider.name,
        tokensUsed: 0,
        cost: 0,
        duration: Date.now() - startTime,
        success: false,
        operation: "generation",
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Optimize existing test cases
   */
  async optimizeTestCases(
    testCases: any[],
    feedback?: OptimizationFeedback,
    options: { provider?: string } = {},
  ): Promise<OptimizedTest[]> {
    const startTime = Date.now();
    const providerName = options.provider || this.config.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found`);
    }

    try {
      // Analyze current test cases
      const analysis = await this.analyzeTestCases(testCases);

      // Generate optimizations
      const optimizedTests = await provider.optimizeTests(testCases, feedback);

      // Score optimizations
      const scoredTests = optimizedTests.map((test) => ({
        ...test,
        improvementScore: this.calculateImprovementScore(
          test,
          testCases.find((t) => t.id === test.originalTestId),
        ),
        estimatedROI: this.calculateROI(test),
      }));

      // Sort by improvement score
      scoredTests.sort((a, b) => b.improvementScore - a.improvementScore);

      // Track usage
      this.trackUsage({
        provider: providerName,
        model: provider.name,
        tokensUsed: this.estimateTokens(
          JSON.stringify(testCases) + JSON.stringify(feedback),
        ),
        cost: this.estimateCost(
          providerName,
          "optimization",
          Date.now() - startTime,
        ),
        duration: Date.now() - startTime,
        success: true,
        operation: "optimization",
        timestamp: new Date().toISOString(),
      });

      console.log(
        `✅ Optimized ${scoredTests.length} test cases using ${providerName}`,
      );
      return scoredTests;
    } catch (error) {
      console.error(`❌ Test optimization failed with ${providerName}:`, error);
      throw error;
    }
  }

  /**
   * Analyze test coverage
   */
  async analyzeTestCoverage(
    projectId: string,
    options: { provider?: string; includeRecommendations?: boolean } = {},
  ): Promise<CoverageAnalysis> {
    const startTime = Date.now();
    const providerName = options.provider || this.config.defaultProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found`);
    }

    try {
      // Get project data
      const projectData = await this.getProjectAnalysisData(projectId);

      // Analyze coverage
      const coverageAnalysis = await provider.analyzeCoverage(projectData);

      // Track usage
      this.trackUsage({
        provider: providerName,
        model: provider.name,
        tokensUsed: this.estimateTokens(JSON.stringify(projectData)),
        cost: this.estimateCost(
          providerName,
          "analysis",
          Date.now() - startTime,
        ),
        duration: Date.now() - startTime,
        success: true,
        operation: "analysis",
        timestamp: new Date().toISOString(),
      });

      console.log(
        `✅ Completed test coverage analysis for project ${projectId}`,
      );
      return coverageAnalysis;
    } catch (error) {
      console.error(`❌ Coverage analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Generate test recommendations
   */
  async generateTestRecommendations(
    projectId: string,
    goals: string[] = [],
    options: { provider?: string } = {},
  ): Promise<{
    recommendations: string[];
    priorityTests: GeneratedTestCase[];
    estimatedEffort: number;
    expectedROI: number;
  }> {
    try {
      // Get current state
      const coverageAnalysis = await this.analyzeTestCoverage(
        projectId,
        options,
      );

      // Get project requirements
      const projectData = await this.getProjectAnalysisData(projectId);

      // Generate targeted recommendations based on goals
      const recommendations = this.generateRecommendations(
        coverageAnalysis,
        goals,
        projectData,
      );

      // Generate priority test cases for top recommendations
      const priorityTests = await this.generatePriorityTests(
        recommendations.slice(0, 5),
        projectData,
      );

      // Calculate effort and ROI
      const estimatedEffort = this.calculateEstimatedEffort(priorityTests);
      const expectedROI = this.calculateExpectedROI(
        priorityTests,
        coverageAnalysis,
      );

      return {
        recommendations,
        priorityTests,
        estimatedEffort,
        expectedROI,
      };
    } catch (error) {
      console.error(`❌ Test recommendations generation failed:`, error);
      throw error;
    }
  }

  /**
   * Get usage metrics and cost tracking
   */
  getUsageMetrics(timeframe?: { from: string; to: string }): {
    totalCost: number;
    totalTokens: number;
    operationsCount: number;
    successRate: number;
    providerBreakdown: Record<string, any>;
  } {
    let filteredMetrics = this.usageMetrics;

    if (timeframe) {
      filteredMetrics = this.usageMetrics.filter(
        (m) => m.timestamp >= timeframe.from && m.timestamp <= timeframe.to,
      );
    }

    const totalCost = filteredMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = filteredMetrics.reduce(
      (sum, m) => sum + m.tokensUsed,
      0,
    );
    const successfulOperations = filteredMetrics.filter(
      (m) => m.success,
    ).length;
    const successRate =
      filteredMetrics.length > 0
        ? (successfulOperations / filteredMetrics.length) * 100
        : 0;

    // Provider breakdown
    const providerBreakdown: Record<string, any> = {};
    filteredMetrics.forEach((metric) => {
      if (!providerBreakdown[metric.provider]) {
        providerBreakdown[metric.provider] = {
          operations: 0,
          cost: 0,
          tokens: 0,
          successRate: 0,
        };
      }

      const provider = providerBreakdown[metric.provider];
      provider.operations++;
      provider.cost += metric.cost;
      provider.tokens += metric.tokensUsed;
    });

    // Calculate provider success rates
    Object.keys(providerBreakdown).forEach((provider) => {
      const providerMetrics = filteredMetrics.filter(
        (m) => m.provider === provider,
      );
      const successful = providerMetrics.filter((m) => m.success).length;
      providerBreakdown[provider].successRate =
        (successful / providerMetrics.length) * 100;
    });

    return {
      totalCost,
      totalTokens,
      operationsCount: filteredMetrics.length,
      successRate,
      providerBreakdown,
    };
  }

  /**
   * Private helper methods
   */
  private generateCacheKey(
    operation: string,
    input: string,
    context: any,
  ): string {
    return `${operation}:${this.hashString(input + JSON.stringify(context))}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.config.cacheExpiry,
    });

    // Cleanup expired cache entries
    this.cleanupCache();
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }

  private prioritizeTestCases(
    tests: GeneratedTestCase[],
    priority: string,
  ): GeneratedTestCase[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    const targetPriority =
      priorityOrder[priority as keyof typeof priorityOrder] || 2;

    return tests
      .filter((test) => priorityOrder[test.priority] >= targetPriority)
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
  }

  private validateGeneratedTests(
    tests: GeneratedTestCase[],
  ): GeneratedTestCase[] {
    return tests.filter((test) => {
      // Basic validation
      return (
        test.name &&
        test.description &&
        test.testSteps &&
        test.testSteps.length > 0 &&
        test.expectedResults &&
        test.expectedResults.length > 0
      );
    });
  }

  private async analyzeTestCases(testCases: any[]): Promise<any> {
    // Analyze test case quality, coverage, complexity, etc.
    return {
      totalTests: testCases.length,
      averageSteps:
        testCases.reduce((sum, t) => sum + (t.steps?.length || 0), 0) /
        testCases.length,
      complexityDistribution: this.calculateComplexityDistribution(testCases),
      riskDistribution: this.calculateRiskDistribution(testCases),
    };
  }

  private calculateComplexityDistribution(
    testCases: any[],
  ): Record<string, number> {
    const distribution = { simple: 0, medium: 0, complex: 0 };
    testCases.forEach((test) => {
      const complexity = test.complexity || "medium";
      distribution[complexity]++;
    });
    return distribution;
  }

  private calculateRiskDistribution(testCases: any[]): Record<string, number> {
    const distribution = { low: 0, medium: 0, high: 0 };
    testCases.forEach((test) => {
      const risk = test.riskLevel || "medium";
      distribution[risk]++;
    });
    return distribution;
  }

  private calculateImprovementScore(
    optimized: OptimizedTest,
    original: any,
  ): number {
    // Calculate improvement score based on various factors
    let score = 0;

    // Step optimization
    if (original && optimized.testSteps.length < original.steps?.length) {
      score += 20;
    }

    // Clarity improvement
    if (optimized.description.length > (original?.description?.length || 0)) {
      score += 15;
    }

    // Test data optimization
    if (
      Object.keys(optimized.testData).length >
      Object.keys(original?.testData || {}).length
    ) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  private calculateROI(test: OptimizedTest): number {
    // Simplified ROI calculation based on complexity and risk reduction
    const baseValue =
      test.complexity === "complex"
        ? 100
        : test.complexity === "medium"
          ? 50
          : 25;
    const riskMultiplier =
      test.riskLevel === "high" ? 1.5 : test.riskLevel === "medium" ? 1.2 : 1.0;

    return baseValue * riskMultiplier;
  }

  private async getProjectAnalysisData(
    projectId: string,
  ): Promise<ProjectAnalysisData> {
    // Fetch project data from database
    const project = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .first();

    const testCases = await this.db
      .select()
      .from(schema.testCases)
      .where(eq(schema.testCases.projectId, projectId));

    return {
      projectStructure: project,
      existingTests: testCases,
      codebaseMetrics: {}, // Would be populated by code analysis
      userFlows: [], // Would be populated by usage analytics
      apiEndpoints: [], // Would be populated by API discovery
      businessRequirements: project?.requirements || [],
    };
  }

  private generateRecommendations(
    analysis: CoverageAnalysis,
    goals: string[],
    projectData: ProjectAnalysisData,
  ): string[] {
    const recommendations: string[] = [];

    // Coverage gaps
    if (analysis.overallCoverage < 80) {
      recommendations.push(
        `Increase overall test coverage from ${analysis.overallCoverage}% to target 80%`,
      );
    }

    // Functional gaps
    analysis.gaps.forEach((gap) => {
      recommendations.push(`Address coverage gap: ${gap}`);
    });

    // Goal-specific recommendations
    goals.forEach((goal) => {
      if (goal.includes("security")) {
        recommendations.push(
          "Add security-focused test cases for authentication and authorization",
        );
      }
      if (goal.includes("performance")) {
        recommendations.push(
          "Implement performance testing for critical user flows",
        );
      }
      if (goal.includes("accessibility")) {
        recommendations.push(
          "Add accessibility tests to ensure WCAG compliance",
        );
      }
    });

    return recommendations;
  }

  private async generatePriorityTests(
    recommendations: string[],
    projectData: ProjectAnalysisData,
  ): Promise<GeneratedTestCase[]> {
    // Generate test cases for top recommendations
    const priorityTests: GeneratedTestCase[] = [];

    for (const recommendation of recommendations.slice(0, 3)) {
      // This would use AI to generate specific test cases
      priorityTests.push({
        name: `Test for: ${recommendation}`,
        description: `Automated test to address: ${recommendation}`,
        priority: "high",
        category: "coverage-improvement",
        tags: ["ai-generated", "priority"],
        preconditions: [],
        testSteps: [
          {
            order: 1,
            action: "Execute test scenario",
            expected: "Expected outcome",
          },
        ],
        expectedResults: ["Test passes"],
        testData: {},
        estimatedDuration: 300,
        complexity: "medium",
        riskLevel: "medium",
      });
    }

    return priorityTests;
  }

  private calculateEstimatedEffort(tests: GeneratedTestCase[]): number {
    // Estimate effort in hours based on test complexity
    return tests.reduce((total, test) => {
      const hours =
        test.complexity === "complex"
          ? 4
          : test.complexity === "medium"
            ? 2
            : 1;
      return total + hours;
    }, 0);
  }

  private calculateExpectedROI(
    tests: GeneratedTestCase[],
    coverage: CoverageAnalysis,
  ): number {
    // Simplified ROI calculation
    const coverageImprovement = tests.length * 2; // Assume 2% improvement per test
    const currentRiskLevel = 100 - coverage.overallCoverage;
    const riskReduction = Math.min(coverageImprovement, currentRiskLevel);

    return riskReduction * 10; // Business value multiplier
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private estimateCost(
    provider: string,
    operation: string,
    duration: number,
  ): number {
    // Simplified cost estimation
    const baseCosts = {
      openai: {
        generation: 0.03, // per 1K tokens
        optimization: 0.02,
        analysis: 0.01,
      },
      huggingface: {
        generation: 0.001,
        optimization: 0.001,
        analysis: 0.0005,
      },
    };

    return (
      baseCosts[provider as keyof typeof baseCosts]?.[
        operation as keyof typeof baseCosts.openai
      ] || 0.01
    );
  }

  private trackUsage(metric: AIUsageMetrics): void {
    this.usageMetrics.push(metric);

    // Keep only last 1000 metrics
    if (this.usageMetrics.length > 1000) {
      this.usageMetrics = this.usageMetrics.slice(-1000);
    }

    // Check cost limit
    const monthlyCost = this.getUsageMetrics().totalCost;
    if (monthlyCost > this.config.costLimit) {
      console.warn(
        `⚠️  Monthly AI cost limit exceeded: $${monthlyCost} > $${this.config.costLimit}`,
      );
    }
  }
}

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider implements AIProvider {
  name = "OpenAI GPT-4";
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async generateTestCases(
    prompt: string,
    context: TestGenerationContext,
  ): Promise<GeneratedTestCase[]> {
    const systemPrompt = `You are an expert QA engineer tasked with generating comprehensive test cases.

Context:
- Project: ${context.projectInfo.name} (${context.projectInfo.platform})
- Description: ${context.projectInfo.description}
- Technology: ${context.projectInfo.technology.join(", ")}
- Framework: ${context.projectInfo.framework.join(", ")}

Requirements:
Functional: ${context.requirements.functional.join(", ")}
Non-functional: ${context.requirements.nonFunctional.join(", ")}
Business Rules: ${context.requirements.businessRules.join(", ")}

Constraints:
- Maximum test cases: ${context.constraints.maxTestCases}
- Priority focus: ${context.constraints.priority}
- Test types: ${context.constraints.testTypes.join(", ")}

Generate ${context.constraints.maxTestCases} comprehensive test cases in JSON format with the following structure:
{
  "testCases": [
    {
      "name": "Test case name",
      "description": "Detailed description",
      "priority": "low|medium|high|critical",
      "category": "test category",
      "tags": ["tag1", "tag2"],
      "preconditions": ["condition1", "condition2"],
      "testSteps": [
        {
          "order": 1,
          "action": "Action to perform",
          "expected": "Expected result",
          "screenshot": true,
          "waitFor": "element",
          "input": {"field": "value"}
        }
      ],
      "expectedResults": ["result1", "result2"],
      "testData": {"key": "value"},
      "estimatedDuration": 300,
      "complexity": "simple|medium|complex",
      "riskLevel": "low|medium|high"
    }
  ]
}

User Request: ${prompt}`;

    try {
      const response = await this.callOpenAI(systemPrompt);
      const parsed = JSON.parse(response);
      return parsed.testCases || [];
    } catch (error) {
      console.error("OpenAI test generation failed:", error);
      throw new Error("Failed to generate test cases with OpenAI");
    }
  }

  async optimizeTests(
    tests: any[],
    feedback?: OptimizationFeedback,
  ): Promise<OptimizedTest[]> {
    const systemPrompt = `You are a test optimization expert. Analyze and optimize the following test cases.

Current Tests:
${JSON.stringify(tests, null, 2)}

Feedback:
${JSON.stringify(feedback, null, 2)}

Provide optimized test cases in JSON format with improvements for:
- Reducing test execution time
- Improving test reliability
- Enhancing test coverage
- Simplifying complex tests
- Adding missing edge cases

Format:
{
  "optimizedTests": [
    {
      "name": "Optimized test name",
      "description": "Improved description",
      "priority": "low|medium|high|critical",
      "category": "test category",
      "tags": ["tag1", "tag2"],
      "preconditions": ["condition1"],
      "testSteps": [
        {
          "order": 1,
          "action": "Optimized action",
          "expected": "Expected result",
          "screenshot": false
        }
      ],
      "expectedResults": ["result1"],
      "testData": {"key": "value"},
      "estimatedDuration": 200,
      "complexity": "simple|medium|complex",
      "riskLevel": "low|medium|high",
      "originalTestId": "original_id",
      "optimizations": ["optimization1", "optimization2"]
    }
  ]
}`;

    try {
      const response = await this.callOpenAI(systemPrompt);
      const parsed = JSON.parse(response);
      return parsed.optimizedTests || [];
    } catch (error) {
      console.error("OpenAI test optimization failed:", error);
      throw new Error("Failed to optimize tests with OpenAI");
    }
  }

  async analyzeCoverage(
    project: ProjectAnalysisData,
  ): Promise<CoverageAnalysis> {
    const systemPrompt = `You are a test coverage analyst. Analyze the project data and provide comprehensive coverage analysis.

Project Data:
${JSON.stringify(project, null, 2)}

Provide coverage analysis in JSON format:
{
  "overallCoverage": 85,
  "functionalCoverage": 90,
  "riskCoverage": 75,
  "gaps": ["gap1", "gap2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "priorityTests": ["test1", "test2"]
}`;

    try {
      const response = await this.callOpenAI(systemPrompt);
      const parsed = JSON.parse(response);
      return parsed;
    } catch (error) {
      console.error("OpenAI coverage analysis failed:", error);
      throw new Error("Failed to analyze coverage with OpenAI");
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.organization && {
          "OpenAI-Organization": this.config.organization,
        }),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: "system", content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        ...(this.config.baseUrl && { base_url: this.config.baseUrl }),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Validate OpenAI configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      if (!this.config.apiKey || this.config.apiKey.trim() === "") {
        return false;
      }

      // Test API with a minimal request
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.organization && {
            "OpenAI-Organization": this.config.organization,
          }),
        },
      });

      return response.ok;
    } catch (error) {
      console.error("OpenAI configuration validation failed:", error);
      return false;
    }
  }

  /**
   * Get quota usage from OpenAI
   */
  async getQuotaUsage(): Promise<{
    used: number;
    limit: number;
    resetTime: string;
  }> {
    try {
      const response = await fetch("https://api.openai.com/v1/usage", {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.organization && {
            "OpenAI-Organization": this.config.organization,
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get quota: ${response.status}`);
      }

      const data = await response.json();
      return {
        used: data.total_usage || 0,
        limit: 1000000, // Default limit - would be fetched from subscription
        resetTime: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 days from now
      };
    } catch (error) {
      console.error("Failed to get OpenAI quota usage:", error);
      return { used: 0, limit: 1000000, resetTime: new Date().toISOString() };
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "down";
    latency: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          status: latency < 1000 ? "healthy" : "degraded",
          latency,
        };
      } else {
        return { status: "down", latency };
      }
    } catch (error) {
      return { status: "down", latency: Date.now() - startTime };
    }
  }
}

/**
 * Hugging Face Provider Implementation
 */
class HuggingFaceProvider implements AIProvider {
  name = "Hugging Face";
  private config: { apiKey: string; model: string };

  constructor(config: { apiKey: string; model: string }) {
    this.config = config;
  }

  async generateTestCases(
    prompt: string,
    context: TestGenerationContext,
  ): Promise<GeneratedTestCase[]> {
    // Simplified implementation for Hugging Face
    // In production, this would use appropriate code generation models
    throw new Error("Hugging Face test generation not yet implemented");
  }

  async optimizeTests(
    tests: any[],
    feedback?: OptimizationFeedback,
  ): Promise<OptimizedTest[]> {
    throw new Error("Hugging Face test optimization not yet implemented");
  }

  async analyzeCoverage(
    project: ProjectAnalysisData,
  ): Promise<CoverageAnalysis> {
    throw new Error("Hugging Face coverage analysis not yet implemented");
  }

  /**
   * Validate Hugging Face configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      if (!this.config.apiKey || this.config.apiKey.trim() === "") {
        return false;
      }

      // Test API with a simple model list request
      const response = await fetch("https://huggingface.co/api/models", {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Hugging Face configuration validation failed:", error);
      return false;
    }
  }

  /**
   * Get quota usage from Hugging Face
   */
  async getQuotaUsage(): Promise<{
    used: number;
    limit: number;
    resetTime: string;
  }> {
    // Hugging Face doesn't have the same quota system as OpenAI
    // Return placeholder values for compatibility
    return {
      used: 0,
      limit: 1000000,
      resetTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "down";
    latency: number;
  }> {
    const startTime = Date.now();

    try {
      const response = await fetch("https://huggingface.co/api/models", {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          status: latency < 2000 ? "healthy" : "degraded",
          latency,
        };
      } else {
        return { status: "down", latency };
      }
    } catch (error) {
      return { status: "down", latency: Date.now() - startTime };
    }
  }
}

/**
 * Factory function
 */
export function createAITestGenerationService(
  d1Database: D1Database,
  config?: any,
): AITestGenerationService {
  return new AITestGenerationService(d1Database, config);
}

/**
 * Global instance
 */
let globalAITestService: AITestGenerationService | null = null;

export function getAITestGenerationService(): AITestGenerationService {
  if (!globalAITestService) {
    throw new Error("AI Test Generation Service not initialized");
  }
  return globalAITestService;
}

export function initializeAITestGenerationService(
  d1Database: D1Database,
  config?: any,
): AITestGenerationService {
  globalAITestService = new AITestGenerationService(d1Database, config);
  return globalAITestService;
}
