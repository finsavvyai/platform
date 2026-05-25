import crypto from "crypto";
import { EventEmitter } from "events";
import { subscriptionService } from "./SubscriptionService.js";
import { logger } from "../utils/logger.js";
import { cacheService } from "./CacheService.js";
import { aiProviderClient } from "./AIProviderClient.js";
import { aiInsightsService } from "./AIInsightsService.js";
import * as prompts from "./AIPromptBuilder.js";
import * as parsers from "./AIResponseParser.js";
import type { AIRequest, AIResponse, TestGenerationRequest, BugAnalysisRequest, PerformanceAnalysisRequest } from "../types/ai.types.js";

export type { AIRequest, AIResponse, TestGenerationRequest, BugAnalysisRequest, PerformanceAnalysisRequest };

export class AIService extends EventEmitter {
  async processAIRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey(request);

    const cached = await this.tryGetCached(cacheKey);
    if (cached) {
      logger.info(`AI cache hit for ${request.type} for user ${request.userId}`);
      return cached;
    }

    try {
      const canUseAI = await this.checkAILimits(request.userId, request.feature);
      if (!canUseAI) {
        throw new Error("AI feature limit exceeded for current plan");
      }

      const { result, model, cost, tokensUsed } = await this.dispatch(request);

      await this.trackAIUsage(request.userId, request.feature, cost);
      const processingTime = Date.now() - startTime;

      this.emit("ai:request:completed", {
        userId: request.userId, type: request.type,
        feature: request.feature, model, cost, tokensUsed, processingTime,
      });
      logger.info(`AI request completed: ${request.type} for user ${request.userId} using ${model}`);

      const response: AIResponse = { success: true, result, cost, model, tokensUsed, processingTime };
      await cacheService.set({ key: cacheKey, ttl: 86400 }, response).catch(
        (e: unknown) => logger.warn(`Failed to set cache: ${e}`),
      );
      return response;
    } catch (error: unknown) {
      const processingTime = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`AI request failed: ${message} for user ${request.userId}`);
      this.emit("ai:request:failed", {
        userId: request.userId, type: request.type, error: message, processingTime,
      });
      return { success: false, result: { error: message }, cost: 0, model: "none", processingTime };
    }
  }

  generateAlertMessage = aiInsightsService.generateAlertMessage.bind(aiInsightsService);
  generateTestInsights = aiInsightsService.generateTestInsights.bind(aiInsightsService);
  generateText = aiInsightsService.generateText.bind(aiInsightsService);
  generateContent = aiInsightsService.generateContent.bind(aiInsightsService);

  private async dispatch(request: AIRequest) {
    switch (request.type) {
      case "test_generation":
        return this.generateTest(request.data as TestGenerationRequest, request.userId);
      case "bug_analysis":
        return this.analyzeBug(request.data as BugAnalysisRequest, request.userId);
      case "performance_analysis":
        return this.analyzePerformance(request.data as PerformanceAnalysisRequest, request.userId);
      case "code_optimization":
        return this.optimizeCode(request.data as { code: string; framework?: string; issues?: string[] }, request.userId);
      default:
        throw new Error(`Unsupported AI request type: ${request.type}`);
    }
  }

  private async generateTest(request: TestGenerationRequest, userId: string) {
    const planId = await this.getPlanId(userId);
    const model = aiProviderClient.selectModelForPlan(planId, "test_generation");
    const prompt = prompts.buildTestGenerationPrompt(request);

    if (model.startsWith("gpt-")) {
      const { content, model: finalModel, tokensUsed, cost } = await aiProviderClient.executeWithFailover(
        "You are an expert QA engineer. Generate robust, maintainable test code following best practices.",
        prompt, model,
      );
      return {
        result: { testCode: content, framework: request.framework, platform: request.platform,
          confidence: parsers.calculateConfidence(content), suggestions: parsers.extractSuggestions(content) },
        model: finalModel, cost, tokensUsed,
      };
    }

    const response = await aiProviderClient.huggingFace.textGeneration({
      model: "codellama/CodeLlama-7b-Instruct-hf",
      inputs: prompt,
      parameters: { max_new_tokens: 1000, temperature: 0.3 },
    });
    const tokensUsed = prompt.length / 4;
    return {
      result: { testCode: response.generated_text, framework: request.framework,
        platform: request.platform, confidence: 0.7, suggestions: [] },
      model: "codellama-7b", cost: aiProviderClient.calculateCost("huggingface-basic", tokensUsed), tokensUsed,
    };
  }

  private async analyzeBug(request: BugAnalysisRequest, userId: string) {
    const planId = await this.getPlanId(userId);
    const model = aiProviderClient.selectModelForPlan(planId, "bug_analysis");

    if (model.startsWith("gpt-")) {
      const { content, model: finalModel, tokensUsed, cost } = await aiProviderClient.executeWithFailover(
        "You are an expert software debugger. Provide detailed and actionable bug analysis.",
        prompts.buildBugAnalysisPrompt(request), model,
      );
      return { result: parsers.parseBugAnalysis(content), model: finalModel, cost, tokensUsed };
    }
    return {
      result: { severity: parsers.estimateSeverity(request), category: "general",
        suggestedFix: "Please review the error message and check common causes", confidence: 0.5 },
      model: "basic-analysis", cost: 0, tokensUsed: 0,
    };
  }

  private async analyzePerformance(request: PerformanceAnalysisRequest, userId: string) {
    const planId = await this.getPlanId(userId);
    if (planId === "free") throw new Error("Performance analysis requires paid plan");
    const model = aiProviderClient.selectModelForPlan(planId, "performance_analysis");
    const { content, model: finalModel, tokensUsed, cost } = await aiProviderClient.executeWithFailover(
      "You are an expert performance engineer. Analyze metrics and provide structured insights.",
      prompts.buildPerformanceAnalysisPrompt(request), model,
    );
    return { result: parsers.parsePerformanceAnalysis(content), model: finalModel, cost, tokensUsed };
  }

  private async optimizeCode(data: { code: string; framework?: string; issues?: string[] }, userId: string) {
    const planId = await this.getPlanId(userId);
    const model = aiProviderClient.selectModelForPlan(planId, "code_optimization");
    const { content, model: finalModel, tokensUsed, cost } = await aiProviderClient.executeWithFailover(
      "You are an expert code optimizer.", prompts.buildCodeOptimizationPrompt(data), model,
    );
    return {
      result: { optimizedCode: content, improvements: parsers.extractImprovements(content),
        performanceGain: parsers.estimatePerformanceGain(data.code, content) },
      model: finalModel, cost, tokensUsed,
    };
  }

  private async getPlanId(userId: string): Promise<string> {
    try {
      const subscription = await subscriptionService.getActiveSubscription(userId);
      return subscription?.planId || "free";
    } catch {
      return "free"; // Tolerate missing subscription (anonymous, new users, test envs)
    }
  }

  private buildCacheKey(request: AIRequest): string {
    const raw = JSON.stringify({ type: request.type, feature: request.feature, data: request.data });
    const hash = crypto.createHash("sha256").update(raw).digest("hex").substring(0, 32);
    return `ai:${request.userId}:${hash}`;
  }

  private async tryGetCached(cacheKey: string): Promise<AIResponse | null> {
    try {
      return await cacheService.get<AIResponse>(cacheKey);
    } catch (e: unknown) {
      logger.warn(`Failed to read from cache: ${e}`);
      return null;
    }
  }

  private async checkAILimits(userId: string, _feature: string): Promise<boolean> {
    try {
      const planId = await this.getPlanId(userId);
      if (planId === "enterprise") return true;
      return true; // TODO: Enforce per-plan limits from database usage tracking
    } catch (error: unknown) {
      logger.error(`Failed to check AI limits: ${error}`);
      return false;
    }
  }

  private async trackAIUsage(userId: string, feature: string, cost: number): Promise<void> {
    try {
      await subscriptionService.trackUsage(userId, "api", Math.ceil(cost * 1000));
      this.emit("ai:usage:tracked", { userId, feature, cost, timestamp: new Date() });
    } catch (error: unknown) {
      logger.error(`Failed to track AI usage: ${error}`);
    }
  }
}

export const aiService = new AIService();
