/**
 * OpenAI Provider Implementation
 *
 * Implements OpenAI API integration with comprehensive error handling,
 * rate limiting, cost calculation, and retry logic.
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import OpenAI from 'openai';
import { AIProvider, AIRequest, AIResponse, TokenUsage, ResponseMetadata } from '../ai-manager';

export interface OpenAIConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAI.Chat.Completions.ChatCompletion.Choice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider {
  private client: OpenAI;
  private config: OpenAIConfig;
  private provider: AIProvider;

  constructor(config: OpenAIConfig, provider: AIProvider) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      defaultModel: 'gpt-3.5-turbo',
      ...config
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organization,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });

    this.provider = provider;
  }

  /**
   * Execute chat completion request
   */
  async executeChatCompletion(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || this.config.defaultModel || 'gpt-3.5-turbo';

      const messages = this.buildMessages(request);
      const parameters = this.buildOpenAIParameters(request);

      const startTime = Date.now();

      const response: OpenAIResponse = await this.client.chat.completions.create({
        model,
        messages,
        ...parameters
      });

      const processingTime = Date.now() - startTime;

      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No response choices returned from OpenAI');
      }

      return {
        id: response.id,
        requestId: request.id,
        provider: 'openai',
        model: response.model,
        content: choice.message?.content || '',
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        cost: this.calculateCost(response.model, response.usage),
        metadata: {
          finishReason: this.mapFinishReason(choice.finish_reason),
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
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Execute embedding request
   */
  async executeEmbedding(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || 'text-embedding-ada-002';

      const startTime = Date.now();

      const response = await this.client.embeddings.create({
        model,
        input: request.prompt
      });

      const processingTime = Date.now() - startTime;

      const embedding = response.data[0];
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI');
      }

      return {
        id: `embedding_${Date.now()}`,
        requestId: request.id,
        provider: 'openai',
        model: response.model,
        content: JSON.stringify(embedding.embedding),
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: 0,
          totalTokens: response.usage?.prompt_tokens || 0
        },
        cost: this.calculateCost(response.model, response.usage),
        metadata: {
          finishReason: 'stop',
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
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Build messages array for OpenAI chat completion
   */
  private buildMessages(request: AIRequest): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Add system prompt if provided
    if (request.parameters.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.parameters.systemPrompt
      });
    }

    // Add context as system message if available
    if (request.context && typeof request.context === 'object') {
      const contextString = this.formatContext(request.context);
      if (contextString) {
        messages.push({
          role: 'system',
          content: `Context: ${contextString}`
        });
      }
    }

    // Add user prompt
    messages.push({
      role: 'user',
      content: request.prompt
    });

    return messages;
  }

  /**
   * Build OpenAI-specific parameters
   */
  private buildOpenAIParameters(request: AIRequest): Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> {
    const parameters: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {};

    if (request.parameters.temperature !== undefined) {
      parameters.temperature = Math.max(0, Math.min(2, request.parameters.temperature));
    }

    if (request.parameters.maxTokens !== undefined) {
      parameters.max_tokens = Math.max(1, request.parameters.maxTokens);
    }

    if (request.parameters.topP !== undefined) {
      parameters.top_p = Math.max(0, Math.min(1, request.parameters.topP));
    }

    if (request.parameters.frequencyPenalty !== undefined) {
      parameters.frequency_penalty = Math.max(-2, Math.min(2, request.parameters.frequencyPenalty));
    }

    if (request.parameters.presencePenalty !== undefined) {
      parameters.presence_penalty = Math.max(-2, Math.min(2, request.parameters.presencePenalty));
    }

    if (request.parameters.stopSequences && request.parameters.stopSequences.length > 0) {
      parameters.stop = request.parameters.stopSequences.slice(0, 4); // OpenAI supports max 4 stop sequences
    }

    if (request.parameters.stream) {
      parameters.stream = true;
    }

    if (request.parameters.tools && request.parameters.tools.length > 0) {
      parameters.tools = request.parameters.tools;
      parameters.tool_choice = request.parameters.toolChoice || 'auto';
    }

    if (request.parameters.responseFormat) {
      parameters.response_format = { type: request.parameters.responseFormat as 'text' | 'json_object' };
    }

    return parameters;
  }

  /**
   * Format context object into string
   */
  private formatContext(context: any): string {
    if (!context) return '';

    try {
      if (typeof context === 'string') {
        return context;
      }

      if (Array.isArray(context)) {
        return context.map(item => this.formatContext(item)).filter(Boolean).join('\n');
      }

      if (typeof context === 'object') {
        return Object.entries(context)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join('\n');
      }

      return String(context);
    } catch (error) {
      console.warn('Error formatting context:', error);
      return '';
    }
  }

  /**
   * Map OpenAI finish reason to our standard format
   */
  private mapFinishReason(reason: string | null | undefined): 'stop' | 'length' | 'content_filter' | 'function_call' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      case 'function_call':
        return 'function_call';
      case 'tool_calls':
        return 'function_call';
      default:
        return 'stop';
    }
  }

  /**
   * Calculate cost for OpenAI usage
   */
  private calculateCost(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }): any {
    if (!usage) {
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: 'USD',
        provider: 'OpenAI',
        model
      };
    }

    // OpenAI pricing (as of 2024, simplified for example)
    const pricing: { [key: string]: { input: number; output: number } } = {
      'gpt-4': { input: 0.00003, output: 0.00006 },
      'gpt-4-turbo': { input: 0.00001, output: 0.00003 },
      'gpt-3.5-turbo': { input: 0.0000015, output: 0.000002 },
      'text-embedding-ada-002': { input: 0.0000001, output: 0 },
      'text-embedding-3-small': { input: 0.00000002, output: 0 },
      'text-embedding-3-large': { input: 0.00000013, output: 0 }
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    const inputCost = (usage.prompt_tokens || 0) * modelPricing.input;
    const outputCost = (usage.completion_tokens || 0) * modelPricing.output;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
      provider: 'OpenAI',
      model
    };
  }

  /**
   * Handle OpenAI API errors
   */
  private handleOpenAIError(error: any): Error {
    if (error instanceof OpenAI.APIError) {
      const message = this.formatOpenAIErrorMessage(error);

      switch (error.status) {
        case 400:
          return new Error(`OpenAI Bad Request: ${message}`);
        case 401:
          return new Error(`OpenAI Unauthorized: Invalid API key. ${message}`);
        case 403:
          return new Error(`OpenAI Forbidden: ${message}`);
        case 404:
          return new Error(`OpenAI Not Found: ${message}`);
        case 429:
          return new Error(`OpenAI Rate Limited: ${message}`);
        case 500:
        case 502:
        case 503:
          return new Error(`OpenAI Server Error: ${message}`);
        default:
          return new Error(`OpenAI API Error (${error.status}): ${message}`);
      }
    }

    if (error instanceof OpenAI.RateLimitError) {
      return new Error(`OpenAI Rate Limit Exceeded: ${error.message}`);
    }

    if (error instanceof OpenAI.AuthenticationError) {
      return new Error(`OpenAI Authentication Failed: ${error.message}`);
    }

    if (error instanceof OpenAI.APIConnectionError) {
      return new Error(`OpenAI Connection Error: ${error.message}`);
    }

    return new Error(`OpenAI Error: ${error.message || 'Unknown error'}`);
  }

  /**
   * Format OpenAI error message
   */
  private formatOpenAIErrorMessage(error: OpenAI.APIError): string {
    if (error.error) {
      const errorObj = error.error as any;
      return errorObj.message || errorObj.error?.message || 'Unknown error';
    }
    return error.message || 'Unknown error';
  }

  /**
   * Test provider connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const response = await this.client.models.list();
      return response.data.length > 0;
    } catch (error) {
      console.error('OpenAI connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      return response.data.map(model => model.id);
    } catch (error) {
      console.error('Failed to fetch OpenAI models:', error);
      return [];
    }
  }

  /**
   * Estimate tokens for a text
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate request parameters
   */
  validateRequest(request: AIRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required and cannot be empty');
    }

    if (request.prompt.length > 100000) {
      errors.push('Prompt is too long (max 100,000 characters)');
    }

    if (request.parameters.maxTokens && (request.parameters.maxTokens < 1 || request.parameters.maxTokens > 32000)) {
      errors.push('maxTokens must be between 1 and 32000');
    }

    if (request.parameters.temperature !== undefined &&
        (request.parameters.temperature < 0 || request.parameters.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (request.parameters.topP !== undefined &&
        (request.parameters.topP < 0 || request.parameters.topP > 1)) {
      errors.push('Top P must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get provider information
   */
  getProviderInfo(): AIProvider {
    return { ...this.provider };
  }

  /**
   * Check if model is supported
   */
  isModelSupported(model: string): boolean {
    return this.provider.models.some(m => m.id === model);
  }

  /**
   * Get default model for a specific task type
   */
  getDefaultModel(taskType: string): string {
    const modelMapping: { [key: string]: string } = {
      'text_generation': 'gpt-3.5-turbo',
      'code_generation': 'gpt-4',
      'analysis': 'gpt-4',
      'summarization': 'gpt-3.5-turbo',
      'translation': 'gpt-4',
      'classification': 'gpt-3.5-turbo',
      'embedding': 'text-embedding-ada-002'
    };

    return modelMapping[taskType] || this.config.defaultModel || 'gpt-3.5-turbo';
  }
}

export default OpenAIProvider;
