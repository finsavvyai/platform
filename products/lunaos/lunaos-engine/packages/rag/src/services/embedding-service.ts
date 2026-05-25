/**
 * Embedding Service
 * Handles text embedding generation with multiple providers
 */

import {
  EmbeddingService,
  ModelInfo
} from '../interfaces';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export class OpenAIEmbeddingService extends EventEmitter implements EmbeddingService {
  private apiKey: string;
  private baseURL: string;
  private model: string;
  private dimension!: number;
  private maxTokens!: number;
  private batchSize: number;
  private cache: Map<string, { embedding: number[]; timestamp: number; model: string }> = new Map();
  private cacheEnabled: boolean;
  private cacheMaxSize: number;
  private cacheTTL: number;
  private rateLimiter: RateLimiter;

  constructor(config: {
    apiKey: string;
    baseURL?: string;
    model?: string;
    batchSize?: number;
    cacheEnabled?: boolean;
    cacheMaxSize?: number;
    cacheTTL?: number;
    rateLimitRpm?: number;
  }) {
    super();

    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.model = config.model || 'text-embedding-3-small';
    this.batchSize = config.batchSize || 100;
    this.cacheEnabled = config.cacheEnabled !== false;
    this.cacheMaxSize = config.cacheMaxSize || 10000;
    this.cacheTTL = config.cacheTTL || 3600000; // 1 hour
    this.rateLimiter = new RateLimiter(config.rateLimitRpm || 3000);

    // Set model-specific configuration
    this.setModelConfig(this.model);
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelToUse = model || this.model;

    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.getFromCache(text, modelToUse);
      if (cached) {
        return cached;
      }
    }

    // Apply rate limiting
    await this.rateLimiter.acquire();

    try {
      logger.debug(`Generating embedding for text (${text.length} chars)`, { model: modelToUse });

      const response = await fetch(`${this.baseURL}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          input: text,
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      const embedding = data.data[0].embedding;

      // Cache result
      if (this.cacheEnabled) {
        this.setCache(text, modelToUse, embedding);
      }

      logger.debug(`Successfully generated embedding (dimension: ${embedding.length})`);
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]> {
    const modelToUse = model || this.model;

    // Check cache for all texts
    if (this.cacheEnabled) {
      const cachedResults: (number[] | null)[] = [];
      const uncachedTexts: string[] = [];
      const uncachedIndices: number[] = [];

      texts.forEach((text, index) => {
        const cached = this.getFromCache(text, modelToUse);
        if (cached) {
          cachedResults[index] = cached;
        } else {
          cachedResults[index] = null;
          uncachedTexts.push(text);
          uncachedIndices.push(index);
        }
      });

      if (uncachedTexts.length === 0) {
        return cachedResults as number[][];
      }

      // Generate embeddings for uncached texts
      const newEmbeddings = await this.processBatch(uncachedTexts, modelToUse);

      // Merge cached and new results
      const results: number[][] = new Array(texts.length);
      let newEmbeddingIndex = 0;

      for (let i = 0; i < texts.length; i++) {
        if (cachedResults[i]) {
          results[i] = cachedResults[i]!;
        } else {
          results[i] = newEmbeddings[newEmbeddingIndex++];
          // Cache the new embedding
          this.setCache(texts[i], modelToUse, results[i]);
        }
      }

      return results;
    }

    // Process entire batch without caching
    return this.processBatch(texts, modelToUse);
  }

  getDimension(model?: string): number {
    const modelToUse = model || this.model;
    return this.getModelInfo(modelToUse).dimension;
  }

  getModelInfo(model?: string): ModelInfo {
    const modelToUse = model || this.model;

    const modelConfigs: Record<string, ModelInfo> = {
      'text-embedding-3-small': {
        name: 'text-embedding-3-small',
        dimension: 1536,
        maxTokens: 8191,
        costPerToken: 0.00000002,
        capabilities: ['text', 'code', 'multilingual'],
      },
      'text-embedding-3-large': {
        name: 'text-embedding-3-large',
        dimension: 3072,
        maxTokens: 8191,
        costPerToken: 0.00000013,
        capabilities: ['text', 'code', 'multilingual', 'high-accuracy'],
      },
      'text-embedding-ada-002': {
        name: 'text-embedding-ada-002',
        dimension: 1536,
        maxTokens: 8191,
        costPerToken: 0.0000001,
        capabilities: ['text', 'code'],
      },
    };

    if (modelToUse in modelConfigs) {
      return modelConfigs[modelToUse];
    }

    // Default fallback
    return {
      name: modelToUse,
      dimension: 1536,
      maxTokens: 8191,
      costPerToken: 0.0000001,
      capabilities: ['text', 'code'],
    };
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('Embedding cache cleared');
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      hitRate: this.rateLimiter.getHitRate(),
    };
  }

  private async processBatch(texts: string[], model: string): Promise<number[][]> {
    const results: number[][] = [];

    // Process in batches to respect API limits
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      // Apply rate limiting
      for (let j = 0; j < batch.length; j++) {
        await this.rateLimiter.acquire();
      }

      try {
        logger.debug(`Processing embedding batch (${batch.length} texts)`, {
          model,
          batchIndex: Math.floor(i / this.batchSize) + 1,
          totalBatches: Math.ceil(texts.length / this.batchSize)
        });

        const response = await fetch(`${this.baseURL}/embeddings`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: batch,
            encoding_format: 'float',
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${error}`);
        }

        const data = await response.json() as any;
        const batchEmbeddings = data.data.map((item: any) => item.embedding);
        results.push(...batchEmbeddings);

        logger.debug(`Successfully processed embedding batch (${batchEmbeddings.length} embeddings)`);

      } catch (error) {
        logger.error(`Failed to process embedding batch:`, error);

        // Return empty arrays for failed items to maintain array structure
        const nullEmbeddings = batch.map(() => []);
        results.push(...nullEmbeddings);
      }
    }

    return results;
  }

  private setCache(text: string, model: string, embedding: number[]): void {
    const key = this.getCacheKey(text, model);
    const cacheEntry = {
      embedding,
      timestamp: Date.now(),
      model,
    };

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, cacheEntry);
  }

  private getFromCache(text: string, model: string): number[] | null {
    const key = this.getCacheKey(text, model);
    const cacheEntry = this.cache.get(key);

    if (!cacheEntry) {
      return null;
    }

    // Check if cache entry is expired
    if (Date.now() - cacheEntry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    // Update hit rate
    this.rateLimiter.recordHit();
    return cacheEntry.embedding;
  }

  private getCacheKey(text: string, model: string): string {
    // Use a hash function to create a consistent key
    // For simplicity, we'll use the text + model as the key
    // In production, you might want to use a proper hash function
    const normalizedText = text.trim().toLowerCase();
    return `${model}:${normalizedText}`;
  }

  private setModelConfig(model: string): void {
    const modelInfo = this.getModelInfo(model);
    this.model = model;
    this.dimension = modelInfo.dimension;
    this.maxTokens = modelInfo.maxTokens;

    logger.info(`Using embedding model: ${model}`, {
      dimension: this.dimension,
      maxTokens: this.maxTokens,
    });
  }
}

class RateLimiter {
  private requestsPerMinute: number;
  private requestTimes: number[] = [];
  private hits = 0;
  private total = 0;

  constructor(requestsPerMinute: number) {
    this.requestsPerMinute = requestsPerMinute;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old request times (older than 1 minute)
    this.requestTimes = this.requestTimes.filter(time => now - time < 60000);

    // Check if we're at the limit
    if (this.requestTimes.length >= this.requestsPerMinute) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = 60000 - (now - oldestRequest);

      if (waitTime > 0) {
        logger.debug(`Rate limiting: waiting ${waitTime}ms`);
        await this.delay(waitTime);
      }
    }

    this.requestTimes.push(now);
    this.total++;
  }

  recordHit(): void {
    this.hits++;
  }

  getHitRate(): number {
    return this.total > 0 ? this.hits / this.total : 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class HuggingFaceEmbeddingService extends EventEmitter implements EmbeddingService {
  private apiKey: string;
  private model: string;
  private dimension!: number;
  private baseURL: string;

  constructor(config: {
    apiKey: string;
    model?: string;
    baseURL?: string;
  }) {
    super();

    this.apiKey = config.apiKey;
    this.model = config.model || 'sentence-transformers/all-MiniLM-L6-v2';
    this.baseURL = config.baseURL || 'https://api-inference.huggingface.co';

    // Set model-specific configuration
    this.setModelConfig(this.model);
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    const modelToUse = model || this.model;

    try {
      logger.debug(`Generating HuggingFace embedding for text (${text.length} chars)`, { model: modelToUse });

      const response = await fetch(`${this.baseURL}/pipeline/${modelToUse}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const embedding = Array.isArray(data) ? data[0] : data;

      logger.debug(`Successfully generated HuggingFace embedding (dimension: ${embedding.length})`);
      return embedding;
    } catch (error) {
      logger.error('Failed to generate HuggingFace embedding:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]> {
    const modelToUse = model || this.model;

    try {
      logger.debug(`Generating HuggingFace batch embeddings (${texts.length} texts)`, { model: modelToUse });

      const response = await fetch(`${this.baseURL}/pipeline/${modelToUse}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: texts,
          options: {
            wait_for_model: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HuggingFace API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const embeddings = Array.isArray(data) ? data : [data];

      logger.debug(`Successfully generated HuggingFace batch embeddings (${embeddings.length} embeddings)`);
      return embeddings;
    } catch (error) {
      logger.error('Failed to generate HuggingFace batch embeddings:', error);
      this.emit('error', error);
      throw error;
    }
  }

  getDimension(model?: string): number {
    const modelToUse = model || this.model;
    return this.getModelInfo(modelToUse).dimension;
  }

  getModelInfo(model?: string): ModelInfo {
    const modelToUse = model || this.model;

    const modelConfigs: Record<string, ModelInfo> = {
      'sentence-transformers/all-MiniLM-L6-v2': {
        name: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'multilingual'],
      },
      'sentence-transformers/all-MiniLM-L12-v2': {
        name: 'sentence-transformers/all-MiniLM-L12-v2',
        dimension: 384,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'multilingual'],
      },
      'sentence-transformers/paraphrase-MiniLM-L6-v2': {
        name: 'sentence-transformers/paraphrase-MiniLM-L6-v2',
        dimension: 384,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'paraphrase'],
      },
    };

    if (modelToUse in modelConfigs) {
      return modelConfigs[modelToUse];
    }

    // Default fallback
    return {
      name: modelToUse,
      dimension: 384,
      maxTokens: 512,
      costPerToken: 0,
      capabilities: ['text'],
    };
  }

  private setModelConfig(model: string): void {
    const modelInfo = this.getModelInfo(model);
    this.model = model;
    this.dimension = modelInfo.dimension;

    logger.info(`Using HuggingFace embedding model: ${model}`, {
      dimension: this.dimension,
    });
  }
}

// Factory function to create embedding service based on configuration
export function createEmbeddingService(config: any): EmbeddingService {
  switch (config.provider?.toLowerCase()) {
    case 'openai':
      return new OpenAIEmbeddingService(config);
    case 'huggingface':
      return new HuggingFaceEmbeddingService(config);
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`);
  }
}
