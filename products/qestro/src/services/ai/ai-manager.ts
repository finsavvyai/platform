/**
 * Questro AI Manager - Enterprise AI Provider Abstraction Layer
 *
 * This service provides a unified interface for multiple AI providers with:
 * - Multi-provider support (OpenAI, Hugging Face, Custom)
 * - Intelligent provider selection and fallback logic
 * - Cost calculation and usage tracking per provider
 * - Rate limiting and quota management
 * - Provider health monitoring and automatic failover
 * - Request/response caching for cost optimization
 * - Comprehensive error handling and retry mechanisms
 *
 * @author Questro Platform Team
 * @version 2.0.0
 * @since 2025-11-01
 */

import { EventEmitter } from 'events';

// Provider Types and Interfaces
export type AIProviderType = 'openai' | 'huggingface' | 'custom' | 'anthropic' | 'cohere';

export interface AIProvider {
  name: string;
  type: AIProviderType;
  models: AIModel[];
  pricing: PricingConfig;
  rateLimits: RateLimitConfig;
  healthStatus: ProviderHealthStatus;
  isAvailable: boolean;
  priority: number; // Lower number = higher priority
  capabilities: AICapabilities[];
}

export interface AIModel {
  id: string;
  name: string;
  type: 'text-generation' | 'text-analysis' | 'code-generation' | 'image-generation' | 'embedding';
  maxTokens: number;
  costPerToken: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  capabilities: string[];
  supportedLanguages: string[];
  responseTime: number; // Average response time in ms
  quality: number; // Quality score (1-10)
}

export interface PricingConfig {
  currency: string;
  inputTokenPrice: number;
  outputTokenPrice: number;
  requestPrice?: number;
  billingUnit: 'tokens' | 'requests' | 'minutes';
  freeQuota?: number;
  enterpriseDiscount?: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
  concurrencyLimit?: number;
}

export interface ProviderHealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastError?: string;
}

export interface AICapabilities {
  textGeneration: boolean;
  codeGeneration: boolean;
  analysis: boolean;
  translation: boolean;
  summarization: boolean;
  classification: boolean;
  embedding: boolean;
  imageGeneration?: boolean;
}

export interface AIRequest {
  id: string;
  userId: string;
  organizationId?: string;
  type: AIRequestType;
  provider?: AIProviderType;
  model?: string;
  prompt: string;
  context?: any;
  parameters: AIRequestParameters;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface AIRequestParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
  systemPrompt?: string;
  tools?: any[];
  toolChoice?: any;
  responseFormat?: 'text' | 'json' | 'markdown';
}

export interface AIResponse {
  id: string;
  requestId: string;
  provider: AIProviderType;
  model: string;
  content: string;
  usage: TokenUsage;
  cost: CostBreakdown;
  metadata: ResponseMetadata;
  processingTime: number;
  cached: boolean;
  createdAt: Date;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  provider: string;
  model: string;
  discount?: number;
}

export interface ResponseMetadata {
  finishReason: 'stop' | 'length' | 'content_filter' | 'function_call';
  processingTime: number;
  queueTime: number;
  providerResponseTime: number;
  retryAttempts: number;
  cacheHit: boolean;
  quality?: number;
}

export type AIRequestType =
  | 'test_generation'
  | 'bug_analysis'
  | 'performance_analysis'
  | 'code_optimization'
  | 'test_maintenance'
  | 'requirement_analysis'
  | 'documentation_generation'
  | 'user_support'
  | 'chat_completion'
  | 'embedding'
  | 'classification'
  | 'summarization';

export interface ProviderSelectionStrategy {
  strategy: 'cost' | 'speed' | 'quality' | 'availability' | 'round_robin';
  fallbackEnabled: boolean;
  costThreshold?: number;
  speedThreshold?: number;
  qualityThreshold?: number;
}

/**
 * Main AI Manager class providing unified AI service interface
 */
export class AIManager extends EventEmitter {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private requestQueue: Map<string, AIRequest> = new Map();
  private activeRequests: Map<string, AIRequest> = new Map();
  private usageStats: Map<string, UsageStats> = new Map();
  private providerMetrics: Map<AIProviderType, ProviderMetrics> = new Map();
  private cache: AICache;
  private rateLimiters: Map<AIProviderType, RateLimiter> = new Map();
  private healthChecker: ProviderHealthChecker;
  private config: AIManagerConfig;

  constructor(config: Partial<AIManagerConfig> = {}) {
    super();

    this.config = {
      defaultProvider: 'openai',
      enableCaching: true,
      cacheTimeout: 3600000, // 1 hour
      enableHealthChecks: true,
      healthCheckInterval: 60000, // 1 minute
      maxRetries: 3,
      retryDelay: 1000,
      enableCostTracking: true,
      enableUsageTracking: true,
      maxConcurrentRequests: 100,
      selectionStrategy: {
        strategy: 'cost',
        fallbackEnabled: true
      },
      ...config
    };

    this.cache = new AICache(this.config.cacheTimeout);
    this.healthChecker = new ProviderHealthChecker(this.providers, this.config.healthCheckInterval);

    this.initializeProviders();
    this.setupHealthChecks();
    this.setupMetrics();
  }

  /**
   * Initialize AI providers
   */
  private async initializeProviders(): Promise<void> {
    try {
      // Initialize OpenAI Provider
      await this.initializeOpenAIProvider();

      // Initialize Hugging Face Provider
      await this.initializeHuggingFaceProvider();

      // Initialize Custom Providers
      await this.initializeCustomProviders();

      this.emit('providers-initialized', Array.from(this.providers.keys()));
      console.log('✅ AI Providers initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize AI providers:', error);
      throw error;
    }
  }

  /**
   * Initialize OpenAI provider
   */
  private async initializeOpenAIProvider(): Promise<void> {
    const openAIProvider: AIProvider = {
      name: 'OpenAI',
      type: 'openai',
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          type: 'text-generation',
          maxTokens: 8192,
          costPerToken: 0.00003,
          costPerInputToken: 0.00003,
          costPerOutputToken: 0.00006,
          capabilities: ['text-generation', 'code-generation', 'analysis', 'summarization'],
          supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja'],
          responseTime: 2000,
          quality: 9
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          type: 'text-generation',
          maxTokens: 4096,
          costPerToken: 0.000002,
          costPerInputToken: 0.0000015,
          costPerOutputToken: 0.000002,
          capabilities: ['text-generation', 'code-generation', 'analysis', 'summarization'],
          supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja'],
          responseTime: 1000,
          quality: 8
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          type: 'text-generation',
          maxTokens: 128000,
          costPerToken: 0.00001,
          costPerInputToken: 0.00001,
          costPerOutputToken: 0.00003,
          capabilities: ['text-generation', 'code-generation', 'analysis', 'summarization'],
          supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja'],
          responseTime: 3000,
          quality: 10
        }
      ],
      pricing: {
        currency: 'USD',
        inputTokenPrice: 0.0000015,
        outputTokenPrice: 0.000002,
        billingUnit: 'tokens',
        freeQuota: 1000000, // 1M tokens free tier
        enterpriseDiscount: 0.15
      },
      rateLimits: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000,
        requestsPerDay: 10000,
        tokensPerDay: 1000000
      },
      healthStatus: {
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        uptime: 100
      },
      isAvailable: true,
      priority: 1,
      capabilities: {
        textGeneration: true,
        codeGeneration: true,
        analysis: true,
        translation: true,
        summarization: true,
        classification: true,
        embedding: true
      }
    };

    this.providers.set('openai', openAIProvider);
    this.rateLimiters.set('openai', new RateLimiter(openAIProvider.rateLimits));
  }

  /**
   * Initialize Hugging Face provider
   */
  private async initializeHuggingFaceProvider(): Promise<void> {
    const huggingFaceProvider: AIProvider = {
      name: 'Hugging Face',
      type: 'huggingface',
      models: [
        {
          id: 'mistralai/Mistral-7B-Instruct-v0.2',
          name: 'Mistral 7B Instruct',
          type: 'text-generation',
          maxTokens: 8192,
          costPerToken: 0.0000002,
          capabilities: ['text-generation', 'code-generation', 'analysis'],
          supportedLanguages: ['en', 'fr', 'de', 'es', 'it'],
          responseTime: 1500,
          quality: 7
        },
        {
          id: 'meta-llama/Llama-2-70b-chat-hf',
          name: 'Llama 2 70B Chat',
          type: 'text-generation',
          maxTokens: 4096,
          costPerToken: 0.0000008,
          capabilities: ['text-generation', 'analysis', 'summarization'],
          supportedLanguages: ['en'],
          responseTime: 3000,
          quality: 8
        },
        {
          id: 'sentence-transformers/all-MiniLM-L6-v2',
          name: 'MiniLM L6 v2',
          type: 'embedding',
          maxTokens: 512,
          costPerToken: 0.00000001,
          capabilities: ['embedding'],
          supportedLanguages: ['en', 'zh', 'de', 'es', 'fr', 'it'],
          responseTime: 500,
          quality: 8
        }
      ],
      pricing: {
        currency: 'USD',
        inputTokenPrice: 0.0000002,
        outputTokenPrice: 0.0000002,
        billingUnit: 'tokens',
        freeQuota: 30000 // 30K requests free tier
      },
      rateLimits: {
        requestsPerMinute: 300,
        tokensPerMinute: 160000
      },
      healthStatus: {
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        uptime: 100
      },
      isAvailable: true,
      priority: 2,
      capabilities: {
        textGeneration: true,
        codeGeneration: true,
        analysis: true,
        translation: true,
        summarization: true,
        classification: true,
        embedding: true
      }
    };

    this.providers.set('huggingface', huggingFaceProvider);
    this.rateLimiters.set('huggingface', new RateLimiter(huggingFaceProvider.rateLimits));
  }

  /**
   * Initialize custom providers
   */
  private async initializeCustomProviders(): Promise<void> {
    // Initialize Anthropic if available
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicProvider: AIProvider = {
        name: 'Anthropic',
        type: 'anthropic',
        models: [
          {
            id: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            type: 'text-generation',
            maxTokens: 4096,
            costPerToken: 0.000075,
            costPerInputToken: 0.000015,
            costPerOutputToken: 0.000075,
            capabilities: ['text-generation', 'code-generation', 'analysis', 'summarization'],
            supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja'],
            responseTime: 2500,
            quality: 10
          },
          {
            id: 'claude-3-sonnet-20240229',
            name: 'Claude 3 Sonnet',
            type: 'text-generation',
            maxTokens: 4096,
            costPerToken: 0.000015,
            costPerInputToken: 0.000003,
            costPerOutputToken: 0.000015,
            capabilities: ['text-generation', 'code-generation', 'analysis', 'summarization'],
            supportedLanguages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja'],
            responseTime: 1500,
            quality: 9
          }
        ],
        pricing: {
          currency: 'USD',
          inputTokenPrice: 0.000003,
          outputTokenPrice: 0.000015,
          billingUnit: 'tokens'
        },
        rateLimits: {
          requestsPerMinute: 1000,
          tokensPerMinute: 40000
        },
        healthStatus: {
          isHealthy: true,
          lastCheck: new Date(),
          responseTime: 0,
          errorRate: 0,
          uptime: 100
        },
        isAvailable: true,
        priority: 1.5,
        capabilities: {
          textGeneration: true,
          codeGeneration: true,
          analysis: true,
          translation: true,
          summarization: true,
          classification: true
        }
      };

      this.providers.set('anthropic', anthropicProvider);
      this.rateLimiters.set('anthropic', new RateLimiter(anthropicProvider.rateLimits));
    }
  }

  /**
   * Main method to execute AI requests
   */
  async executeRequest(request: Omit<AIRequest, 'id' | 'createdAt'>): Promise<AIResponse> {
    const requestId = this.generateRequestId();
    const fullRequest: AIRequest = {
      ...request,
      id: requestId,
      createdAt: new Date()
    };

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cachedResponse = await this.cache.get(request);
        if (cachedResponse) {
          this.emit('response-cached', { requestId, response: cachedResponse });
          return { ...cachedResponse, cached: true, requestId };
        }
      }

      // Select best provider
      const provider = await this.selectProvider(request);
      if (!provider) {
        throw new Error('No suitable AI provider available');
      }

      // Check rate limits
      const rateLimiter = this.rateLimiters.get(provider.type);
      if (rateLimiter && !(await rateLimiter.checkLimit())) {
        throw new Error(`Rate limit exceeded for provider ${provider.name}`);
      }

      // Execute request with retry logic
      const response = await this.executeWithRetry(fullRequest, provider);

      // Cache response
      if (this.config.enableCaching && !response.metadata.cacheHit) {
        await this.cache.set(request, response, this.config.cacheTimeout);
      }

      // Update usage stats
      if (this.config.enableUsageTracking) {
        this.updateUsageStats(request.userId, request.organizationId, response);
      }

      // Update provider metrics
      this.updateProviderMetrics(provider.type, response);

      // Emit events
      this.emit('request-completed', { requestId, request: fullRequest, response });

      return response;

    } catch (error) {
      this.emit('request-failed', { requestId, request: fullRequest, error });
      throw error;
    }
  }

  /**
   * Select the best provider for a given request
   */
  private async selectProvider(request: Omit<AIRequest, 'id' | 'createdAt'>): Promise<AIProvider | null> {
    const availableProviders = Array.from(this.providers.values())
      .filter(provider => provider.isAvailable && provider.healthStatus.isHealthy);

    if (availableProviders.length === 0) {
      return null;
    }

    // If specific provider requested, try that first
    if (request.provider) {
      const specificProvider = availableProviders.find(p => p.type === request.provider);
      if (specificProvider) {
        return specificProvider;
      }
    }

    // Select based on strategy
    const strategy = this.config.selectionStrategy;

    switch (strategy.strategy) {
      case 'cost':
        return this.selectByCost(availableProviders, request);
      case 'speed':
        return this.selectBySpeed(availableProviders, request);
      case 'quality':
        return this.selectByQuality(availableProviders, request);
      case 'availability':
        return this.selectByAvailability(availableProviders);
      case 'round_robin':
        return this.selectByRoundRobin(availableProviders);
      default:
        return availableProviders[0];
    }
  }

  /**
   * Select provider by cost
   */
  private selectByCost(providers: AIProvider[], request: Omit<AIRequest, 'id' | 'createdAt'>): AIProvider {
    return providers.reduce((best, current) => {
      const bestCost = this.estimateRequestCost(best, request);
      const currentCost = this.estimateRequestCost(current, request);
      return currentCost < bestCost ? current : best;
    });
  }

  /**
   * Select provider by speed
   */
  private selectBySpeed(providers: AIProvider[], request: Omit<AIRequest, 'id' | 'createdAt'>): AIProvider {
    return providers.reduce((best, current) =>
      current.models[0].responseTime < best.models[0].responseTime ? current : best
    );
  }

  /**
   * Select provider by quality
   */
  private selectByQuality(providers: AIProvider[], request: Omit<AIRequest, 'id' | 'createdAt'>): AIProvider {
    return providers.reduce((best, current) =>
      current.models[0].quality > best.models[0].quality ? current : best
    );
  }

  /**
   * Select provider by availability
   */
  private selectByAvailability(providers: AIProvider[]): AIProvider {
    return providers.reduce((best, current) =>
      current.healthStatus.uptime > best.healthStatus.uptime ? current : best
    );
  }

  /**
   * Select provider by round robin
   */
  private selectByRoundRobin(providers: AIProvider[]): AIProvider {
    const now = Date.now();
    const providerIndex = Math.floor(now / 60000) % providers.length; // Change every minute
    return providers[providerIndex];
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry(request: AIRequest, provider: AIProvider, attempt = 1): Promise<AIResponse> {
    try {
      return await this.executeWithProvider(request, provider);
    } catch (error) {
      if (attempt < this.config.maxRetries && this.config.selectionStrategy.fallbackEnabled) {
        console.warn(`Provider ${provider.name} failed (attempt ${attempt}), trying fallback:`, error);

        // Try alternative provider
        const fallbackProvider = await this.selectFallbackProvider(request, provider);
        if (fallbackProvider) {
          await this.delay(this.config.retryDelay * attempt);
          return this.executeWithRetry(request, fallbackProvider, attempt + 1);
        }
      }
      throw error;
    }
  }

  /**
   * Select fallback provider
   */
  private async selectFallbackProvider(request: AIRequest, failedProvider: AIProvider): Promise<AIProvider | null> {
    const availableProviders = Array.from(this.providers.values())
      .filter(provider =>
        provider.isAvailable &&
        provider.healthStatus.isHealthy &&
        provider.type !== failedProvider.type
      );

    if (availableProviders.length === 0) {
      return null;
    }

    // Select best alternative provider
    return this.selectByCost(availableProviders, request);
  }

  /**
   * Execute request with specific provider
   */
  private async executeWithProvider(request: AIRequest, provider: AIProvider): Promise<AIResponse> {
    const startTime = Date.now();

    // Update rate limiter
    const rateLimiter = this.rateLimiters.get(provider.type);
    if (rateLimiter) {
      await rateLimiter.recordRequest();
    }

    try {
      // This would be implemented by specific provider classes
      const response = await this.callProviderAPI(request, provider);

      const processingTime = Date.now() - startTime;

      return {
        id: this.generateResponseId(),
        requestId: request.id,
        provider: provider.type,
        model: request.model || provider.models[0].id,
        content: response.content,
        usage: response.usage,
        cost: this.calculateCost(provider, response.usage),
        metadata: {
          finishReason: response.finishReason || 'stop',
          processingTime,
          queueTime: 0,
          providerResponseTime: processingTime,
          retryAttempts: 1,
          cacheHit: false
        },
        processingTime,
        cached: false,
        createdAt: new Date()
      };

    } catch (error) {
      // Update provider health status
      provider.healthStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
      provider.healthStatus.errorRate += 0.1;

      throw error;
    }
  }

  /**
   * Call provider API with actual implementation for different providers
   */
  private async callProviderAPI(request: AIRequest, provider: AIProvider): Promise<any> {
    switch (provider.type) {
      case 'openai':
        return await this.callOpenAIAPI(request);
      case 'anthropic':
        return await this.callAnthropicAPI(request);
      case 'huggingface':
        return await this.callHuggingFaceAPI(request);
      case 'custom':
        return await this.callCustomAPI(request);
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  /**
   * Call OpenAI API with proper test generation prompts
   */
  private async callOpenAIAPI(request: AIRequest): Promise<any> {
    const apiKey = globalThis.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = request.model || 'gpt-4-turbo';

    // Craft specialized prompts for different request types
    let systemPrompt = '';
    let responseFormat = 'text';

    switch (request.type) {
      case 'test_generation':
        systemPrompt = `You are an expert test automation engineer. Generate comprehensive test cases based on the given description.
        Provide clear, actionable test steps with expected outcomes. Focus on edge cases and user scenarios.
        Return valid JSON format with: {"tests": [{"name": "Test Name", "description": "Test Description", "steps": ["Step 1", "Step 2"], "expected": "Expected outcome"}]}`;
        responseFormat = 'json';
        break;

      case 'bug_analysis':
        systemPrompt = `You are a senior software engineer specializing in debugging and root cause analysis.
        Analyze the given test failure and provide detailed diagnosis with potential fixes.
        Return JSON: {"analysis": {"rootCause": "Root cause", "severity": "high/medium/low", "suggestedFix": "Fix description", "prevention": "Prevention advice"}}`;
        responseFormat = 'json';
        break;

      case 'performance_analysis':
        systemPrompt = `You are a performance testing expert. Analyze the provided test data and identify performance bottlenecks.
        Return JSON: {"performance": {"metrics": {}, "bottlenecks": [], "recommendations": []}}`;
        responseFormat = 'json';
        break;

      case 'code_optimization':
        systemPrompt = `You are a senior developer focused on test code optimization. Review and improve the provided test code.
        Focus on maintainability, performance, and best practices. Return optimized code with explanations.`;
        break;

      default:
        systemPrompt = 'You are a helpful AI assistant for software testing and quality assurance.';
    }

    const requestBody = {
      model: model,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: request.prompt }
      ],
      temperature: request.parameters.temperature || 0.7,
      max_tokens: request.parameters.maxTokens || 2000,
      top_p: request.parameters.topP || 1,
      frequency_penalty: request.parameters.frequencyPenalty || 0,
      presence_penalty: request.parameters.presencePenalty || 0,
      ...(responseFormat === 'json' && { response_format: { type: 'json_object' as const } })
    };

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        finishReason: choice.finish_reason,
        model: data.model
      };

    } catch (error) {
      console.error('OpenAI API call failed:', error);
      throw error;
    }
  }

  /**
   * Call Anthropic Claude API
   */
  private async callAnthropicAPI(request: AIRequest): Promise<any> {
    const apiKey = globalThis.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const model = request.model || 'claude-3-sonnet-20240229';

    // Specialized prompts for Claude
    let systemPrompt = '';
    switch (request.type) {
      case 'test_generation':
        systemPrompt = 'You are an expert test automation engineer. Generate comprehensive test cases in JSON format with clear steps and expected outcomes.';
        break;
      case 'bug_analysis':
        systemPrompt = 'You are a senior debugging expert. Provide detailed analysis and solutions for test failures in JSON format.';
        break;
      default:
        systemPrompt = 'You are a helpful AI assistant for software testing and quality assurance.';
    }

    const requestBody = {
      model: model,
      max_tokens: request.parameters.maxTokens || 2000,
      temperature: request.parameters.temperature || 0.7,
      messages: [
        { role: 'user' as const, content: `${systemPrompt}\n\n${request.prompt}` }
      ]
    };

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();

      return {
        content: data.content[0].text,
        usage: {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        },
        finishReason: data.stop_reason,
        model: data.model
      };

    } catch (error) {
      console.error('Anthropic API call failed:', error);
      throw error;
    }
  }

  /**
   * Call Hugging Face API
   */
  private async callHuggingFaceAPI(request: AIRequest): Promise<any> {
    const apiKey = globalThis.HUGGING_FACE_API_KEY || process.env.HUGGING_FACE_API_KEY;
    if (!apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    const model = request.model || 'mistralai/Mistral-7B-Instruct-v0.2';

    const requestBody = {
      inputs: request.prompt,
      parameters: {
        temperature: request.parameters.temperature || 0.7,
        max_new_tokens: request.parameters.maxTokens || 2000,
        top_p: request.parameters.topP || 1,
        do_sample: true,
        return_full_text: false
      }
    };

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();

      // Hugging Face response format varies by model
      const content = Array.isArray(data) ? data[0]?.generated_text : data.generated_text || '';

      return {
        content: content.trim(),
        usage: {
          inputTokens: Math.floor(request.prompt.length / 4), // Estimate
          outputTokens: Math.floor(content.length / 4), // Estimate
          totalTokens: Math.floor((request.prompt.length + content.length) / 4)
        },
        finishReason: 'stop',
        model: model
      };

    } catch (error) {
      console.error('Hugging Face API call failed:', error);
      throw error;
    }
  }

  /**
   * Call custom API endpoint
   */
  private async callCustomAPI(request: AIRequest): Promise<any> {
    // For custom providers, you would implement custom logic here
    // This could be self-hosted models, specialized APIs, etc.
    const customEndpoint = globalThis.CUSTOM_AI_ENDPOINT || process.env.CUSTOM_AI_ENDPOINT;

    if (!customEndpoint) {
      throw new Error('Custom AI endpoint not configured');
    }

    const response = await fetch(customEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CUSTOM_AI_API_KEY || ''}`
      },
      body: JSON.stringify({
        prompt: request.prompt,
        parameters: request.parameters,
        type: request.type
      })
    });

    if (!response.ok) {
      throw new Error(`Custom AI API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.content || data.text || data.response,
      usage: data.usage || {
        inputTokens: Math.floor(request.prompt.length / 4),
        outputTokens: Math.floor((data.content?.length || 0) / 4),
        totalTokens: 0
      },
      finishReason: 'stop',
      model: data.model || 'custom'
    };
  }

  /**
   * Estimate request cost for provider selection
   */
  private estimateRequestCost(provider: AIProvider, request: Omit<AIRequest, 'id' | 'createdAt'>): number {
    const estimatedTokens = request.prompt.length / 4; // Rough estimate
    const model = provider.models.find(m => m.id === request.model) || provider.models[0];

    return (estimatedTokens * (model.costPerInputToken || model.costPerToken)) +
           (estimatedTokens * 0.5 * (model.costPerOutputToken || model.costPerToken));
  }

  /**
   * Calculate actual cost based on usage
   */
  private calculateCost(provider: AIProvider, usage: TokenUsage): CostBreakdown {
    const model = provider.models[0]; // Simplified - would use actual model

    const inputCost = usage.inputTokens * (model.costPerInputToken || model.costPerToken);
    const outputCost = usage.outputTokens * (model.costPerOutputToken || model.costPerToken);
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: provider.pricing.currency,
      provider: provider.name,
      model: model.id,
      discount: provider.pricing.enterpriseDiscount
    };
  }

  /**
   * Update usage statistics
   */
  private updateUsageStats(userId: string, organizationId: string | undefined, response: AIResponse): void {
    const key = organizationId || userId;

    if (!this.usageStats.has(key)) {
      this.usageStats.set(key, {
        requests: 0,
        tokens: 0,
        cost: 0,
        lastReset: new Date()
      });
    }

    const stats = this.usageStats.get(key)!;
    stats.requests++;
    stats.tokens += response.usage.totalTokens;
    stats.cost += response.cost.totalCost;
  }

  /**
   * Update provider metrics
   */
  private updateProviderMetrics(providerType: AIProviderType, response: AIResponse): void {
    if (!this.providerMetrics.has(providerType)) {
      this.providerMetrics.set(providerType, {
        requests: 0,
        tokens: 0,
        cost: 0,
        errors: 0,
        avgResponseTime: 0,
        lastUpdated: new Date()
      });
    }

    const metrics = this.providerMetrics.get(providerType)!;
    metrics.requests++;
    metrics.tokens += response.usage.totalTokens;
    metrics.cost += response.cost.totalCost;
    metrics.avgResponseTime = (metrics.avgResponseTime + response.processingTime) / 2;
    metrics.lastUpdated = new Date();
  }

  /**
   * Setup health checks
   */
  private setupHealthChecks(): void {
    if (!this.config.enableHealthChecks) return;

    this.healthChecker.on('health-update', (providerType, health) => {
      const provider = this.providers.get(providerType);
      if (provider) {
        provider.healthStatus = health;
        provider.isAvailable = health.isHealthy;
      }
    });

    // Health checker start disabled for Cloudflare Workers compatibility
    // this.healthChecker.start();
  }

  /**
   * Setup metrics collection
   */
  private setupMetrics(): void {
    // Metrics emission disabled for Cloudflare Workers compatibility
    // setInterval(() => {
    //   this.emit('metrics-updated', {
    //     usage: this.getUsageStats(),
    //     providers: this.getProviderMetrics(),
    //     cache: this.cache.getStats()
    //   });
    // }, 60000);
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateResponseId(): string {
    return `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public API methods
   */
  getUsageStats(): Map<string, UsageStats> {
    return new Map(this.usageStats);
  }

  getProviderMetrics(): Map<AIProviderType, ProviderMetrics> {
    return new Map(this.providerMetrics);
  }

  getProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getProvider(type: AIProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  async healthCheck(): Promise<{ [key: string]: ProviderHealthStatus }> {
    const results: { [key: string]: ProviderHealthStatus } = {};

    for (const [type, provider] of this.providers) {
      results[type] = provider.healthStatus;
    }

    return results;
  }

  async shutdown(): Promise<void> {
    this.healthChecker.stop();
    this.removeAllListeners();
    console.log('AI Manager shutdown completed');
  }
}

// Supporting Classes

class AICache {
  private cache: Map<string, { response: AIResponse; expires: Date }> = new Map();
  private defaultTimeout: number;
  private cleanupInterval: Timer | null = null;

  constructor(defaultTimeout: number = 3600000) {
    this.defaultTimeout = defaultTimeout;
    // Don't start cleanup in constructor - do it lazily
  }

  async get(request: Omit<AIRequest, 'id' | 'createdAt'>): Promise<AIResponse | null> {
    // Manual cleanup on each access (Cloudflare Workers limitation)
    this.manualCleanup();

    const key = this.generateKey(request);
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() > item.expires.getTime()) {
      this.cache.delete(key);
      return null;
    }

    return item.response;
  }

  async set(request: Omit<AIRequest, 'id' | 'createdAt'>, response: AIResponse, ttl?: number): Promise<void> {
    const key = this.generateKey(request);
    const expires = new Date(Date.now() + (ttl || this.defaultTimeout));

    this.cache.set(key, { response, expires });
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need to track hits/misses
    };
  }

  private generateKey(request: Omit<AIRequest, 'id' | 'createdAt'>): string {
    return `${request.type}_${request.model}_${request.prompt.substring(0, 100)}`;
  }

  private manualCleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires.getTime()) {
        this.cache.delete(key);
      }
    }
  }

  private startCleanup(): void {
    // Note: setInterval not allowed in Cloudflare Workers global scope
    // Cleanup will be done manually on cache access
    this.cleanupInterval = null;
  }
}

class RateLimiter {
  private config: RateLimitConfig;
  private requests: number[] = [];
  private tokens: number[] = [];
  private dailyRequests: number = 0;
  private dailyTokens: number = 0;
  private lastReset: number = Date.now();

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(): Promise<boolean> {
    this.resetIfNeeded();

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.requests = this.requests.filter(time => time > oneMinuteAgo);
    this.tokens = this.tokens.filter(time => time > oneMinuteAgo);

    // Check limits
    if (this.config.requestsPerMinute && this.requests.length >= this.config.requestsPerMinute) {
      return false;
    }

    if (this.config.tokensPerMinute && this.tokens.length >= this.config.tokensPerMinute) {
      return false;
    }

    if (this.config.requestsPerDay && this.dailyRequests >= this.config.requestsPerDay) {
      return false;
    }

    if (this.config.tokensPerDay && this.dailyTokens >= this.config.tokensPerDay) {
      return false;
    }

    return true;
  }

  async recordRequest(tokens: number = 0): Promise<void> {
    const now = Date.now();
    this.requests.push(now);
    this.tokens.push(now);
    this.dailyRequests++;
    this.dailyTokens += tokens;
  }

  private resetIfNeeded(): void {
    const now = Date.now();
    const oneDayAgo = now - 86400000;

    if (this.lastReset < oneDayAgo) {
      this.dailyRequests = 0;
      this.dailyTokens = 0;
      this.lastReset = now;
    }
  }
}

class ProviderHealthChecker extends EventEmitter {
  private providers: Map<AIProviderType, AIProvider>;
  private interval: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(providers: Map<AIProviderType, AIProvider>, interval: number = 60000) {
    super();
    this.providers = providers;
    this.interval = interval;
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(async () => {
      await this.checkAllProviders();
    }, this.interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async checkAllProviders(): Promise<void> {
    for (const [type, provider] of this.providers) {
      try {
        const health = await this.checkProviderHealth(provider);
        this.emit('health-update', type, health);
      } catch (error) {
        const failedHealth: ProviderHealthStatus = {
          isHealthy: false,
          lastCheck: new Date(),
          responseTime: 0,
          errorRate: 1,
          uptime: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        };
        this.emit('health-update', type, failedHealth);
      }
    }
  }

  private async checkProviderHealth(provider: AIProvider): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    // Implement actual health check logic here
    // For now, simulate a health check
    await new Promise(resolve => setTimeout(resolve, 100));

    const responseTime = Date.now() - startTime;

    return {
      isHealthy: true,
      lastCheck: new Date(),
      responseTime,
      errorRate: 0,
      uptime: 100
    };
  }
}

// Type definitions for supporting classes
interface AIManagerConfig {
  defaultProvider: AIProviderType;
  enableCaching: boolean;
  cacheTimeout: number;
  enableHealthChecks: boolean;
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
  enableCostTracking: boolean;
  enableUsageTracking: boolean;
  maxConcurrentRequests: number;
  selectionStrategy: ProviderSelectionStrategy;
}

interface UsageStats {
  requests: number;
  tokens: number;
  cost: number;
  lastReset: Date;
}

interface ProviderMetrics {
  requests: number;
  tokens: number;
  cost: number;
  errors: number;
  avgResponseTime: number;
  lastUpdated: Date;
}

// The classes are already exported with their class declarations
export { AICache, RateLimiter, ProviderHealthChecker };
