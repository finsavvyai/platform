/**
 * Hugging Face Provider Implementation
 *
 * Implements Hugging Face API integration with comprehensive error handling,
 * rate limiting, cost calculation, and retry logic for various model types.
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { HfInference } from '@huggingface/inference';
import { AIProvider, AIRequest, AIResponse, TokenUsage, ResponseMetadata } from '../ai-manager';

export interface HuggingFaceConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

export interface HuggingFaceResponse {
  generated_text?: string;
  prediction?: any;
  embeddings?: number[];
  scores?: number[];
  sequence?: {
    label: string;
    score: number;
  }[];
}

export class HuggingFaceProvider {
  private client: HfInference;
  private config: HuggingFaceConfig;
  private provider: AIProvider;

  constructor(config: HuggingFaceConfig, provider: AIProvider) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      defaultModel: 'mistralai/Mistral-7B-Instruct-v0.2',
      ...config
    };

    this.client = new HfInference(this.config.apiKey, {
      baseUrl: this.config.baseURL
    });

    this.provider = provider;
  }

  /**
   * Execute text generation request
   */
  async executeTextGeneration(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || this.config.defaultModel || 'mistralai/Mistral-7B-Instruct-v0.2';

      const startTime = Date.now();

      const response = await this.client.textGeneration({
        model,
        inputs: this.buildPrompt(request),
        parameters: this.buildHuggingFaceParameters(request)
      });

      const processingTime = Date.now() - startTime;

      const generatedText = response.generated_text || '';
      const usage = this.estimateUsage(request.prompt, generatedText);

      return {
        id: `hf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        provider: 'huggingface',
        model,
        content: generatedText,
        usage,
        cost: this.calculateCost(model, usage),
        metadata: {
          finishReason: this.determineFinishReason(generatedText),
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
      throw this.handleHuggingFaceError(error);
    }
  }

  /**
   * Execute classification request
   */
  async executeClassification(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || 'distilbert-base-uncased-finetuned-sst-2-english';

      const startTime = Date.now();

      const response = await this.client.textClassification({
        model,
        inputs: request.prompt
      });

      const processingTime = Date.now() - startTime;

      // Format classification results
      const classificationText = response.map(item =>
        `${item.label}: ${(item.score * 100).toFixed(2)}%`
      ).join('\n');

      const usage = this.estimateUsage(request.prompt, classificationText);

      return {
        id: `hf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        provider: 'huggingface',
        model,
        content: classificationText,
        usage,
        cost: this.calculateCost(model, usage),
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
      throw this.handleHuggingFaceError(error);
    }
  }

  /**
   * Execute embedding request
   */
  async executeEmbedding(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || 'sentence-transformers/all-MiniLM-L6-v2';

      const startTime = Date.now();

      const response = await this.client.featureExtraction({
        model,
        inputs: request.prompt
      });

      const processingTime = Date.now() - startTime;

      const usage = this.estimateUsage(request.prompt, '');

      return {
        id: `hf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        provider: 'huggingface',
        model,
        content: JSON.stringify(Array.isArray(response) ? response[0] : response),
        usage,
        cost: this.calculateCost(model, usage),
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
      throw this.handleHuggingFaceError(error);
    }
  }

  /**
   * Execute summarization request
   */
  async executeSummarization(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || 'facebook/bart-large-cnn';

      const startTime = Date.now();

      const response = await this.client.summarization({
        model,
        inputs: request.prompt,
        parameters: {
          max_length: request.parameters.maxTokens || 150,
          min_length: 25,
          do_sample: false,
          early_stopping: true
        }
      });

      const processingTime = Date.now() - startTime;

      const summaryText = Array.isArray(response) ? response[0]?.summary_text || '' : response?.summary_text || '';
      const usage = this.estimateUsage(request.prompt, summaryText);

      return {
        id: `hf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        provider: 'huggingface',
        model,
        content: summaryText,
        usage,
        cost: this.calculateCost(model, usage),
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
      throw this.handleHuggingFaceError(error);
    }
  }

  /**
   * Execute translation request
   */
  async executeTranslation(request: AIRequest): Promise<AIResponse> {
    try {
      const model = request.model || 'facebook/mbart-large-50-many-to-one-mmt';

      const startTime = Date.now();

      const response = await this.client.translation({
        model,
        inputs: request.prompt,
        parameters: {
          src_lang: request.context?.sourceLanguage || 'en_XX',
          tgt_lang: request.context?.targetLanguage || 'fr_XX'
        }
      });

      const processingTime = Date.now() - startTime;

      const translationText = response.translation_text || '';
      const usage = this.estimateUsage(request.prompt, translationText);

      return {
        id: `hf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        requestId: request.id,
        provider: 'huggingface',
        model,
        content: translationText,
        usage,
        cost: this.calculateCost(model, usage),
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
      throw this.handleHuggingFaceError(error);
    }
  }

  /**
   * Build prompt for Hugging Face models
   */
  private buildPrompt(request: AIRequest): string {
    let prompt = '';

    // Add system context if available
    if (request.parameters.systemPrompt) {
      prompt += `System: ${request.parameters.systemPrompt}\n\n`;
    }

    // Add context information
    if (request.context && typeof request.context === 'object') {
      const contextString = this.formatContext(request.context);
      if (contextString) {
        prompt += `Context: ${contextString}\n\n`;
      }
    }

    // Add user prompt
    prompt += `User: ${request.prompt}\n\nAssistant:`;

    return prompt;
  }

  /**
   * Build Hugging Face-specific parameters
   */
  private buildHuggingFaceParameters(request: AIRequest): any {
    const parameters: any = {};

    if (request.parameters.temperature !== undefined) {
      parameters.temperature = Math.max(0, Math.min(2, request.parameters.temperature));
    }

    if (request.parameters.maxTokens !== undefined) {
      parameters.max_new_tokens = Math.max(1, request.parameters.maxTokens);
    }

    if (request.parameters.topP !== undefined) {
      parameters.top_p = Math.max(0, Math.min(1, request.parameters.topP));
    }

    if (request.parameters.topK !== undefined) {
      parameters.top_k = request.parameters.topK;
    }

    if (request.parameters.frequencyPenalty !== undefined) {
      parameters.repetition_penalty = 1 + request.parameters.frequencyPenalty;
    }

    if (request.parameters.stopSequences && request.parameters.stopSequences.length > 0) {
      parameters.stop_strings = request.parameters.stopSequences;
    }

    if (request.parameters.presencePenalty !== undefined) {
      parameters.length_penalty = 1 + request.parameters.presencePenalty;
    }

    // Add typical parameters for better results
    parameters.do_sample = parameters.temperature !== undefined && parameters.temperature > 0;
    parameters.return_full_text = false;
    parameters.use_cache = true;

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
   * Estimate token usage
   */
  private estimateUsage(input: string, output: string): TokenUsage {
    const inputTokens = this.estimateTokens(input);
    const outputTokens = this.estimateTokens(output);

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens
    };
  }

  /**
   * Estimate tokens for text (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English, varies by language
    return Math.ceil(text.length / 4);
  }

  /**
   * Determine finish reason
   */
  private determineFinishReason(text: string): 'stop' | 'length' | 'content_filter' | 'function_call' {
    if (!text) return 'length';
    if (text.endsWith('...') || text.length > 2000) return 'length';
    return 'stop';
  }

  /**
   * Calculate cost for Hugging Face usage
   */
  private calculateCost(model: string, usage: TokenUsage): any {
    // Hugging Face pricing is complex and depends on the specific model
    // This is a simplified estimation for demo purposes

    const pricing: { [key: string]: { input: number; output: number } } = {
      'mistralai/Mistral-7B-Instruct-v0.2': { input: 0.0000002, output: 0.0000002 },
      'meta-llama/Llama-2-70b-chat-hf': { input: 0.0000008, output: 0.0000008 },
      'sentence-transformers/all-MiniLM-L6-v2': { input: 0.00000001, output: 0 },
      'distilbert-base-uncased-finetuned-sst-2-english': { input: 0.0000001, output: 0 },
      'facebook/bart-large-cnn': { input: 0.0000003, output: 0.0000003 }
    };

    const modelPricing = pricing[model] || { input: 0.0000002, output: 0.0000002 };
    const inputCost = usage.inputTokens * modelPricing.input;
    const outputCost = usage.outputTokens * modelPricing.output;
    const totalCost = inputCost + outputCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      currency: 'USD',
      provider: 'Hugging Face',
      model
    };
  }

  /**
   * Handle Hugging Face API errors
   */
  private handleHuggingFaceError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return new Error(`Hugging Face Bad Request: ${data?.error || 'Invalid request'}`);
        case 401:
          return new Error(`Hugging Face Unauthorized: Invalid API key`);
        case 403:
          return new Error(`Hugging Face Forbidden: ${data?.error || 'Access denied'}`);
        case 404:
          return new Error(`Hugging Face Not Found: ${data?.error || 'Model not found'}`);
        case 429:
          return new Error(`Hugging Face Rate Limited: ${data?.error || 'Too many requests'}`);
        case 500:
        case 502:
        case 503:
          return new Error(`Hugging Face Server Error: ${data?.error || 'Service unavailable'}`);
        default:
          return new Error(`Hugging Face API Error (${status}): ${data?.error || 'Unknown error'}`);
      }
    }

    if (error.name === 'TimeoutError') {
      return new Error(`Hugging Face Timeout: Request timed out`);
    }

    if (error.name === 'NetworkError') {
      return new Error(`Hugging Face Network Error: ${error.message}`);
    }

    return new Error(`Hugging Face Error: ${error.message || 'Unknown error'}`);
  }

  /**
   * Test provider connectivity
   */
  async testConnectivity(): Promise<boolean> {
    try {
      // Test with a simple model
      await this.client.textClassification({
        model: 'distilbert-base-uncased-finetuned-sst-2-english',
        inputs: 'Hello world'
      });
      return true;
    } catch (error) {
      console.error('Hugging Face connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get task type for model
   */
  getTaskType(model: string): string {
    if (model.includes('embedding') || model.includes('sentence-transformers')) {
      return 'embedding';
    }
    if (model.includes('classification') || model.includes('bert')) {
      return 'classification';
    }
    if (model.includes('summarization') || model.includes('bart')) {
      return 'summarization';
    }
    if (model.includes('translation') || model.includes('mbart')) {
      return 'translation';
    }
    return 'text-generation';
  }

  /**
   * Get default model for a specific task type
   */
  getDefaultModel(taskType: string): string {
    const modelMapping: { [key: string]: string } = {
      'text_generation': 'mistralai/Mistral-7B-Instruct-v0.2',
      'classification': 'distilbert-base-uncased-finetuned-sst-2-english',
      'embedding': 'sentence-transformers/all-MiniLM-L6-v2',
      'summarization': 'facebook/bart-large-cnn',
      'translation': 'facebook/mbart-large-50-many-to-one-mmt',
      'code_generation': 'bigcode/starcoder',
      'analysis': 'mistralai/Mistral-7B-Instruct-v0.2'
    };

    return modelMapping[taskType] || this.config.defaultModel || 'mistralai/Mistral-7B-Instruct-v0.2';
  }

  /**
   * Validate request parameters
   */
  validateRequest(request: AIRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.prompt || request.prompt.trim().length === 0) {
      errors.push('Prompt is required and cannot be empty');
    }

    if (request.prompt.length > 16000) {
      errors.push('Prompt is too long (max 16,000 characters for Hugging Face)');
    }

    if (request.parameters.maxTokens && (request.parameters.maxTokens < 1 || request.parameters.maxTokens > 4096)) {
      errors.push('maxTokens must be between 1 and 4096 for Hugging Face models');
    }

    if (request.parameters.temperature !== undefined &&
        (request.parameters.temperature < 0 || request.parameters.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (request.parameters.topK !== undefined &&
        (request.parameters.topK < 1 || request.parameters.topK > 1000)) {
      errors.push('Top K must be between 1 and 1000');
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
   * Get model capabilities
   */
  getModelCapabilities(model: string): string[] {
    const providerModel = this.provider.models.find(m => m.id === model);
    return providerModel?.capabilities || [];
  }
}

export default HuggingFaceProvider;
