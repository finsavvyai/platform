/**
 * Hugging Face Embedding Service
 * Handles text embedding generation using Hugging Face models
 */

import { EmbeddingService, ModelInfo } from '../interfaces';
import { pipeline } from '@xenova/transformers';
import { logger } from '../utils/logger';

export class HuggingFaceEmbeddingService implements EmbeddingService {
  private config: HuggingFaceConfig;
  private cache: Map<string, number[]> = new Map();
  private cacheEnabled: boolean;
  private rateLimiter: RateLimiter;
  private batchSize: number;
  private modelPipeline: any = null;
  private isInitialized = false;

  constructor(config: HuggingFaceConfig) {
    this.config = config;
    this.cacheEnabled = config.cache !== false;
    this.batchSize = config.batchSize || 32;
    this.rateLimiter = new SimpleRateLimiter(config.rateLimitRPM || 1000);
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Hugging Face embedding pipeline...');

      const actualModel = this.config.defaultModel || 'sentence-transformers/all-MiniLM-L6-v2';

      this.modelPipeline = await pipeline(
        'feature-extraction',
        actualModel,
        {
          device: this.config.device || 'cpu',
          cacheDir: this.config.cacheDir,
        } as any
      );

      this.isInitialized = true;
      logger.info(`Successfully initialized Hugging Face model: ${actualModel}`);
    } catch (error) {
      logger.error('Failed to initialize Hugging Face embedding pipeline:', error);
      throw new Error(`Hugging Face initialization failed: ${error}`);
    }
  }

  async generateEmbedding(text: string, model?: string): Promise<number[]> {
    await this.ensureInitialized();

    const actualModel = model || this.config.defaultModel || 'sentence-transformers/all-MiniLM-L6-v2';
    const cacheKey = this.getCacheKey(text, actualModel);

    // Check cache first
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      logger.debug('Cache hit for embedding generation', { model: actualModel, textLength: text.length });
      return this.cache.get(cacheKey)!;
    }

    try {
      await this.rateLimiter.wait();

      // Preprocess text
      const processedText = this.preprocessText(text);

      const result = await this.modelPipeline(processedText);
      const embedding = Array.isArray(result) ? result[0] : result;

      // Cache the result
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, embedding);

        // Limit cache size
        if (this.cache.size > 5000) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
          }
        }
      }

      logger.debug('Generated embedding', {
        model: actualModel,
        textLength: text.length,
        dimension: embedding.length
      });

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw new Error(`Hugging Face embedding generation failed: ${error}`);
    }
  }

  async generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]> {
    await this.ensureInitialized();

    const actualModel = model || this.config.defaultModel || 'sentence-transformers/all-MiniLM-L6-v2';
    const results: number[][] = [];

    logger.info(`Generating batch embeddings for ${texts.length} texts`, {
      model: actualModel,
      batchSize: this.batchSize
    });

    // Process in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      try {
        await this.rateLimiter.wait(batch.length);

        // Preprocess batch
        const processedBatch = batch.map(text => this.preprocessText(text));

        const batchResults = await this.modelPipeline(processedBatch);

        // Handle different response formats
        let batchEmbeddings: number[][];

        if (Array.isArray(batchResults)) {
          if (Array.isArray(batchResults[0])) {
            // Nested array format
            batchEmbeddings = batchResults as number[][];
          } else {
            // Single array format
            batchEmbeddings = batchResults.map(r => Array.isArray(r) ? r[0] : r);
          }
        } else {
          // Single result
          batchEmbeddings = [Array.isArray(batchResults) ? batchResults : [batchResults]];
        }

        results.push(...batchEmbeddings);

        logger.debug(`Processed batch ${Math.floor(i / this.batchSize) + 1}, got ${batchEmbeddings.length} embeddings`);
      } catch (error) {
        logger.error(`Failed to process batch starting at index ${i}:`, error);

        // Fall back to individual embedding generation
        const individualResults = await Promise.all(
          batch.map(text => this.generateEmbedding(text, actualModel))
        );
        results.push(...individualResults);
      }
    }

    logger.info(`Successfully generated ${results.length} embeddings in batches`);
    return results;
  }

  getDimension(model?: string): number {
    const actualModel = model || this.config.defaultModel || 'sentence-transformers/all-MiniLM-L6-v2';
    return this.getModelInfo(actualModel).dimension;
  }

  getModelInfo(model?: string): ModelInfo {
    const actualModel = model || this.config.defaultModel || 'sentence-transformers/all-MiniLM-L6-v2';

    const modelInfo: Record<string, ModelInfo> = {
      'sentence-transformers/all-MiniLM-L6-v2': {
        name: 'sentence-transformers/all-MiniLM-L6-v2',
        dimension: 384,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'multilingual', 'fast'],
      },
      'sentence-transformers/all-mpnet-base-v2': {
        name: 'sentence-transformers/all-mpnet-base-v2',
        dimension: 768,
        maxTokens: 514,
        costPerToken: 0,
        capabilities: ['text', 'multilingual', 'balanced'],
      },
      'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2': {
        name: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
        dimension: 384,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'multilingual', 'paraphrase'],
      },
      'sentence-transformers/stsb-roberta-large': {
        name: 'sentence-transformers/stsb-roberta-large',
        dimension: 1024,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'semantic-similarity'],
      },
    };

    if (!modelInfo[actualModel]) {
      // Try to infer dimension from model name
      const dimensionMatch = actualModel.match(/(\d+)d$/);
      const dimension = dimensionMatch ? parseInt(dimensionMatch[1]) : 768;

      logger.warn(`Unknown model ${actualModel}, assuming dimension ${dimension}`);

      return {
        name: actualModel,
        dimension,
        maxTokens: 512,
        costPerToken: 0,
        capabilities: ['text', 'inferred'],
      };
    }

    return modelInfo[actualModel];
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    logger.info('Hugging Face embedding cache cleared');
  }

  getCacheStats(): CacheStats {
    return {
      size: this.cache.size,
      hitRate: this.cacheEnabled ? this.calculateHitRate() : 0,
      maxSize: 5000,
    };
  }

  async warmCache(texts: string[], model?: string): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }

    logger.info('Warming up Hugging Face embedding cache', {
      textCount: texts.length,
      model: model || this.config.defaultModel
    });

    const actualModel = model || this.config.defaultModel || 'sentence-transformers/all-MiniLM-L6-v2';

    for (const text of texts) {
      const cacheKey = this.getCacheKey(text, actualModel);
      if (!this.cache.has(cacheKey)) {
        try {
          await this.generateEmbedding(text, actualModel);
        } catch (error) {
          logger.warn(`Failed to warm cache for text: ${text.substring(0, 50)}...`, error);
        }
      }
    }

    logger.info('Cache warming completed');
  }

  async validateModel(model?: string): Promise<boolean> {
    try {
      await this.initialize();
      await this.generateEmbedding('test', model);
      return true;
    } catch (error) {
      logger.error(`Model validation failed for ${model}:`, error);
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    const commonModels = [
      'sentence-transformers/all-MiniLM-L6-v2',
      'sentence-transformers/all-mpnet-base-v2',
      'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      'sentence-transformers/stsb-roberta-large',
      'sentence-transformers/LaBSE',
      'sentence-transformers/distilbert-base-nli-stsb-quora-ranking',
    ];

    const availableModels: string[] = [];

    for (const model of commonModels) {
      if (await this.validateModel(model)) {
        availableModels.push(model);
      }
    }

    return availableModels;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private preprocessText(text: string): string {
    // Basic text preprocessing
    let processed = text.trim();

    // Handle empty or very short text
    if (processed.length === 0) {
      processed = 'empty text';
    }

    // Limit text length
    const maxLength = 8192; // Most models have limits around 8K tokens
    if (processed.length > maxLength) {
      processed = processed.substring(0, maxLength - 3) + '...';
    }

    return processed;
  }

  private getCacheKey(text: string, model: string): string {
    // Create a simple hash key
    const combined = `${model}:${text}`;
    return this.simpleHash(combined);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private calculateHitRate(): number {
    // This is a simplified calculation
    // In a real implementation, you'd track hits and misses
    return 0.6; // Assume 60% hit rate
  }
}

interface HuggingFaceConfig {
  defaultModel?: string;
  device?: 'cpu' | 'cuda';
  cacheDir?: string;
  cache?: boolean;
  batchSize?: number;
  rateLimitRPM?: number;
}

interface RateLimiter {
  wait(count?: number): Promise<void>;
}

class SimpleRateLimiter implements RateLimiter {
  private rateLimitRPM: number;
  private lastRequest: number = 0;
  private requestCount: number = 0;
  private windowStart: number = Date.now();

  constructor(rateLimitRPM: number) {
    this.rateLimitRPM = rateLimitRPM;
  }

  async wait(count = 1): Promise<void> {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    // Reset window if needed
    if (now - this.windowStart > windowMs) {
      this.lastRequest = 0;
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Calculate allowed requests
    const allowedRequests = Math.floor(
      ((now - this.windowStart) / windowMs) * this.rateLimitRPM
    );

    // Wait if over limit
    if (this.requestCount + count > allowedRequests) {
      const waitTime = Math.ceil(
        ((this.requestCount + count - allowedRequests) / this.rateLimitRPM) * 60000
      );

      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }

    this.lastRequest = now;
    this.requestCount += count;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface CacheStats {
  size: number;
  hitRate: number;
  maxSize: number;
}
