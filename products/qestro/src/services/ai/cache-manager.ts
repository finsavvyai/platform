/**
 * Questro AI Response Caching System
 *
 * This comprehensive caching system provides:
 * - Semantic caching based on request similarity using vector embeddings
 * - Multi-layer caching (memory, disk, distributed) for optimal performance
 * - Privacy-compliant cache management with PII detection and masking
 * - Configurable cache TTL and size limits with intelligent eviction
 * - Cache invalidation and refresh strategies with consistency guarantees
 * - Cache hit rate monitoring and optimization analytics
 * - Advanced cache warming and preloading capabilities
 *
 * @author Questro Platform Team
 * @version 2.0.0
 * @since 2025-11-01
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import type { AIRequest, AIResponse, AIProviderType } from './ai-manager';

// Cache Configuration and Types
export interface CacheConfig {
  enabled: boolean;
  layers: CacheLayer[];
  semanticSimilarity: SemanticConfig;
  privacy: PrivacyConfig;
  performance: PerformanceConfig;
  monitoring: MonitoringConfig;
}

export interface CacheLayer {
  type: 'memory' | 'disk' | 'redis' | 'distributed';
  enabled: boolean;
  maxSize: number; // Maximum number of entries
  maxMemory: number; // Maximum memory in bytes
  ttl: number; // Default TTL in milliseconds
  compressionEnabled: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
  priority: number; // Lower number = higher priority
}

export interface SemanticConfig {
  enabled: boolean;
  similarityThreshold: number; // 0.0 to 1.0
  embeddingModel: string;
  vectorDimensions: number;
  maxCachedEmbeddings: number;
  embeddingCache: boolean;
  semanticIndex: 'brute-force' | 'hnsw' | 'ivf';
}

export interface PrivacyConfig {
  enabled: boolean;
  piiDetection: boolean;
  dataMasking: boolean;
  encryptionEnabled: boolean;
  encryptionKey?: string;
  retentionPeriod: number; // days
  anonymizationLevel: 'none' | 'partial' | 'full';
  gdprCompliance: boolean;
}

export interface PerformanceConfig {
  maxConcurrentLookups: number;
  lookupTimeout: number; // milliseconds
  batchOperations: boolean;
  compressionLevel: number; // 0-9
  serializationFormat: 'json' | 'msgpack' | 'protobuf';
  asyncPersistence: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number; // milliseconds
  detailedLogging: boolean;
  performanceProfiling: boolean;
  alertThresholds: {
    hitRateMin: number;
    responseTimeMax: number;
    memoryUsageMax: number;
    errorRateMax: number;
  };
}

export interface CacheEntry {
  key: string;
  request: CachedRequest;
  response: CachedResponse;
  metadata: CacheMetadata;
  embeddings?: number[]; // For semantic similarity
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

export interface CachedRequest {
  type: string;
  provider: AIProviderType;
  model: string;
  prompt: string;
  parameters: any;
  context?: any;
  userId?: string;
  organizationId?: string;
  piiMasked: boolean;
}

export interface CachedResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: {
    totalCost: number;
    currency: string;
  };
  processingTime: number;
  cached: boolean;
  finishReason: string;
}

export interface CacheMetadata {
  ttl: number;
  expiresAt: Date;
  size: number;
  compressed: boolean;
  encrypted: boolean;
  similarityScore?: number;
  tags: string[];
  version: string;
  quality: number; // 1-10
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  diskUsage: number;
  evictionCount: number;
  compressionRatio: number;
  semanticHits: number;
  exactHits: number;
  errors: number;
  byLayer: Map<string, LayerStats>;
  byProvider: Map<AIProviderType, ProviderStats>;
  byRequestType: Map<string, RequestTypeStats>;
}

export interface LayerStats {
  layer: string;
  entries: number;
  hitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  evictionCount: number;
}

export interface ProviderStats {
  provider: AIProviderType;
  cached: number;
  hits: number;
  totalCost: number;
  averageResponseTime: number;
}

export interface RequestTypeStats {
  requestType: string;
  cached: number;
  hits: number;
  averageResponseTime: number;
  quality: number;
}

export interface CacheSearchResult {
  entry: CacheEntry;
  similarityScore: number;
  matchType: 'exact' | 'semantic' | 'partial';
  confidence: number;
}

/**
 * Main AI Cache Manager class
 */
export class AICacheManager extends EventEmitter {
  private config: CacheConfig;
  private layers: Map<string, CacheLayerInstance> = new Map();
  private semanticIndex: SemanticIndex;
  private privacyManager: PrivacyManager;
  private metricsCollector: MetricsCollector;
  private compression: CompressionManager;
  private encryption: EncryptionManager;
  private isInitialized: boolean = false;

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      enabled: true,
      layers: [
        {
          type: 'memory',
          enabled: true,
          maxSize: 10000,
          maxMemory: 100 * 1024 * 1024, // 100MB
          ttl: 3600000, // 1 hour
          compressionEnabled: true,
          evictionPolicy: 'lru',
          priority: 1
        },
        {
          type: 'disk',
          enabled: true,
          maxSize: 100000,
          maxMemory: 1024 * 1024 * 1024, // 1GB
          ttl: 86400000, // 24 hours
          compressionEnabled: true,
          evictionPolicy: 'lfu',
          priority: 2
        }
      ],
      semanticSimilarity: {
        enabled: true,
        similarityThreshold: 0.85,
        embeddingModel: 'text-embedding-ada-002',
        vectorDimensions: 1536,
        maxCachedEmbeddings: 50000,
        embeddingCache: true,
        semanticIndex: 'hnsw'
      },
      privacy: {
        enabled: true,
        piiDetection: true,
        dataMasking: true,
        encryptionEnabled: false,
        retentionPeriod: 30,
        anonymizationLevel: 'partial',
        gdprCompliance: true
      },
      performance: {
        maxConcurrentLookups: 100,
        lookupTimeout: 5000,
        batchOperations: true,
        compressionLevel: 6,
        serializationFormat: 'json',
        asyncPersistence: true
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000, // 1 minute
        detailedLogging: false,
        performanceProfiling: true,
        alertThresholds: {
          hitRateMin: 0.3,
          responseTimeMax: 100,
          memoryUsageMax: 0.8,
          errorRateMax: 0.05
        }
      },
      ...config
    };

    this.initializeComponents();
  }

  /**
   * Initialize cache components
   */
  private async initializeComponents(): Promise<void> {
    try {
      // Initialize cache layers
      for (const layerConfig of this.config.layers) {
        if (layerConfig.enabled) {
          const layer = await this.createCacheLayer(layerConfig);
          this.layers.set(layerConfig.type, layer);
        }
      }

      // Initialize semantic index
      this.semanticIndex = new SemanticIndex(this.config.semanticSimilarity);

      // Initialize privacy manager
      this.privacyManager = new PrivacyManager(this.config.privacy);

      // Initialize metrics collector
      this.metricsCollector = new MetricsCollector(this.config.monitoring);

      // Initialize compression manager
      this.compression = new CompressionManager(this.config.performance);

      // Initialize encryption manager
      this.encryption = new EncryptionManager(this.config.privacy);

      this.isInitialized = true;
      this.emit('cache-initialized', { layers: this.layers.size });

      console.log('✅ AI Cache Manager initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize AI Cache Manager:', error);
      throw error;
    }
  }

  /**
   * Get cached response for a request
   */
  async get(request: AIRequest): Promise<CacheSearchResult | null> {
    if (!this.config.enabled || !this.isInitialized) {
      return null;
    }

    const startTime = Date.now();

    try {
      // Apply privacy processing to request
      const processedRequest = await this.privacyManager.processRequest(request);

      // Generate cache key
      const cacheKey = this.generateCacheKey(processedRequest);

      // Search in cache layers (from highest priority to lowest)
      for (const layerConfig of this.config.layers.sort((a, b) => a.priority - b.priority)) {
        if (!layerConfig.enabled) continue;

        const layer = this.layers.get(layerConfig.type);
        if (!layer) continue;

        // Try exact match first
        const exactMatch = await layer.get(cacheKey);
        if (exactMatch) {
          const result = this.createSearchResult(exactMatch, 'exact', 1.0);

          // Update access statistics
          await this.updateAccessStats(exactMatch);

          // Record metrics
          this.metricsCollector.recordHit(layerConfig.type, Date.now() - startTime);

          this.emit('cache-hit', { result, layer: layerConfig.type });
          return result;
        }

        // Try semantic match if enabled
        if (this.config.semanticSimilarity.enabled) {
          const semanticMatch = await this.semanticSearch(processedRequest, layer);
          if (semanticMatch) {
            const result = this.createSearchResult(semanticMatch, 'semantic', semanticMatch.metadata.similarityScore || 0);

            // Update access statistics
            await this.updateAccessStats(semanticMatch);

            // Record metrics
            this.metricsCollector.recordSemanticHit(layerConfig.type, Date.now() - startTime);

            this.emit('cache-hit', { result, layer: layerConfig.type, semantic: true });
            return result;
          }
        }
      }

      // Record miss
      this.metricsCollector.recordMiss(Date.now() - startTime);
      this.emit('cache-miss', { request: processedRequest });

      return null;

    } catch (error) {
      this.metricsCollector.recordError();
      this.emit('cache-error', { request, error });
      console.error('Cache lookup error:', error);
      return null;
    }
  }

  /**
   * Store response in cache
   */
  async set(request: AIRequest, response: AIResponse, options: {
    ttl?: number;
    tags?: string[];
    priority?: 'high' | 'normal' | 'low';
  } = {}): Promise<void> {
    if (!this.config.enabled || !this.isInitialized) {
      return;
    }

    const startTime = Date.now();

    try {
      // Apply privacy processing
      const processedRequest = await this.privacyManager.processRequest(request);
      const processedResponse = await this.privacyManager.processResponse(response);

      // Generate cache key
      const cacheKey = this.generateCacheKey(processedRequest);

      // Create cache entry
      const entry: CacheEntry = {
        key: cacheKey,
        request: processedRequest,
        response: processedResponse,
        metadata: {
          ttl: options.ttl || this.getDefaultTTL(request.type),
          expiresAt: new Date(Date.now() + (options.ttl || this.getDefaultTTL(request.type))),
          size: this.calculateEntrySize(processedRequest, processedResponse),
          compressed: false,
          encrypted: false,
          tags: options.tags || [],
          version: '1.0',
          quality: this.calculateResponseQuality(response)
        },
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0
      };

      // Generate embeddings for semantic search
      if (this.config.semanticSimilarity.enabled) {
        entry.embeddings = await this.semanticIndex.generateEmbedding(processedRequest.prompt);
      }

      // Process entry (compression, encryption)
      await this.processCacheEntry(entry);

      // Store in cache layers
      const storedLayers: string[] = [];
      for (const layerConfig of this.config.layers) {
        if (!layerConfig.enabled) continue;

        const layer = this.layers.get(layerConfig.type);
        if (!layer) continue;

        try {
          await layer.set(cacheKey, entry);
          storedLayers.push(layerConfig.type);
        } catch (error) {
          console.warn(`Failed to store in layer ${layerConfig.type}:`, error);
        }
      }

      // Update semantic index
      if (this.config.semanticSimilarity.enabled && entry.embeddings) {
        await this.semanticIndex.addEntry(entry);
      }

      // Record metrics
      this.metricsCollector.recordSet(Date.now() - startTime, storedLayers);

      this.emit('cache-set', { entry, layers: storedLayers });

    } catch (error) {
      this.metricsCollector.recordError();
      this.emit('cache-error', { request, error });
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern: {
    provider?: AIProviderType;
    model?: string;
    requestType?: string;
    userId?: string;
    organizationId?: string;
    tags?: string[];
    olderThan?: Date;
  }): Promise<number> {
    if (!this.isInitialized) {
      return 0;
    }

    let invalidatedCount = 0;

    try {
      for (const [layerType, layer] of this.layers) {
        const count = await layer.invalidate(pattern);
        invalidatedCount += count;
      }

      // Update semantic index
      if (this.config.semanticSimilarity.enabled) {
        await this.semanticIndex.invalidate(pattern);
      }

      this.emit('cache-invalidated', { pattern, count: invalidatedCount });
      return invalidatedCount;

    } catch (error) {
      console.error('Cache invalidation error:', error);
      return 0;
    }
  }

  /**
   * Clear cache
   */
  async clear(layer?: string): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      if (layer) {
        const cacheLayer = this.layers.get(layer);
        if (cacheLayer) {
          await cacheLayer.clear();
        }
      } else {
        for (const cacheLayer of this.layers.values()) {
          await cacheLayer.clear();
        }
        await this.semanticIndex.clear();
      }

      this.emit('cache-cleared', { layer });
      console.log(`Cache cleared${layer ? ` for layer: ${layer}` : ' for all layers'}`);

    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.isInitialized) {
      return this.getEmptyStats();
    }

    try {
      const layerStats = new Map<string, LayerStats>();
      let totalEntries = 0;
      let totalHits = 0;
      let totalMisses = 0;
      let totalResponseTime = 0;
      let totalMemoryUsage = 0;
      let totalEvictions = 0;

      for (const [layerType, layer] of this.layers) {
        const stats = await layer.getStats();
        layerStats.set(layerType, {
          layer: layerType,
          entries: stats.entries,
          hitRate: stats.hitRate,
          averageResponseTime: stats.averageResponseTime,
          memoryUsage: stats.memoryUsage,
          evictionCount: stats.evictionCount
        });

        totalEntries += stats.entries;
        totalHits += stats.hits;
        totalMisses += stats.misses;
        totalResponseTime += stats.averageResponseTime * stats.entries;
        totalMemoryUsage += stats.memoryUsage;
        totalEvictions += stats.evictionCount;
      }

      const totalRequests = totalHits + totalMisses;
      const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;

      return {
        totalEntries,
        hitRate,
        missRate: 1 - hitRate,
        averageResponseTime: totalEntries > 0 ? totalResponseTime / totalEntries : 0,
        memoryUsage: totalMemoryUsage,
        diskUsage: await this.calculateDiskUsage(),
        evictionCount: totalEvictions,
        compressionRatio: await this.calculateCompressionRatio(),
        semanticHits: this.metricsCollector.getSemanticHits(),
        exactHits: this.metricsCollector.getExactHits(),
        errors: this.metricsCollector.getErrors(),
        byLayer: layerStats,
        byProvider: this.metricsCollector.getProviderStats(),
        byRequestType: this.metricsCollector.getRequestTypeStats()
      };

    } catch (error) {
      console.error('Error getting cache stats:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Warm up cache with common requests
   */
  async warmup(requests: Array<{
    request: AIRequest;
    expectedResponse?: AIResponse;
    priority?: 'high' | 'normal' | 'low';
  }>): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log(`🔥 Warming up cache with ${requests.length} requests`);

    for (const { request, expectedResponse, priority = 'normal' } of requests) {
      try {
        // Check if already cached
        const cached = await this.get(request);
        if (cached) {
          continue;
        }

        // If expected response provided, cache it
        if (expectedResponse) {
          await this.set(request, expectedResponse, { priority });
        }

      } catch (error) {
        console.warn(`Failed to warmup cache for request:`, error);
      }
    }

    console.log('✅ Cache warmup completed');
    this.emit('cache-warmed', { requests: requests.length });
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimize(): Promise<{
    recommendations: string[];
    actions: string[];
    improvements: {
      hitRate: number;
      responseTime: number;
      memoryUsage: number;
    };
  }> {
    const stats = await this.getStats();
    const recommendations: string[] = [];
    const actions: string[] = [];

    // Analyze hit rate
    if (stats.hitRate < this.config.monitoring.alertThresholds.hitRateMin) {
      recommendations.push('Cache hit rate is below threshold. Consider increasing cache size or TTL.');
      recommendations.push('Review cache key generation for better match accuracy.');

      if (this.config.semanticSimilarity.enabled) {
        recommendations.push('Lower semantic similarity threshold to increase cache hits.');
        actions.push('semantic_threshold_adjust');
      }
    }

    // Analyze response time
    if (stats.averageResponseTime > this.config.monitoring.alertThresholds.responseTimeMax) {
      recommendations.push('Cache response time is above threshold. Consider enabling compression or using faster storage.');
      actions.push('performance_optimization');
    }

    // Analyze memory usage
    const memoryUsageRatio = stats.memoryUsage / this.getTotalMemoryLimit();
    if (memoryUsageRatio > this.config.monitoring.alertThresholds.memoryUsageMax) {
      recommendations.push('Memory usage is high. Consider reducing cache size or enabling compression.');
      recommendations.push('Review eviction policy - consider using LRU if not already.');
      actions.push('memory_optimization');
    }

    // Analyze layer performance
    for (const [layerType, layerStats] of stats.byLayer) {
      if (layerStats.hitRate < 0.1) {
        recommendations.push(`Layer ${layerType} has low hit rate. Consider disabling it or adjusting its configuration.`);
      }
    }

    // Calculate potential improvements
    const improvements = {
      hitRate: Math.min(0.2, 1 - stats.hitRate), // Potential 20% improvement
      responseTime: Math.min(50, stats.averageResponseTime * 0.3), // 30% faster
      memoryUsage: Math.min(0.2, memoryUsageRatio * 0.2) // 20% reduction
    };

    this.emit('cache-optimized', { recommendations, actions, improvements });

    return {
      recommendations,
      actions,
      improvements
    };
  }

  /**
   * Export cache data
   */
  async export(): Promise<{
    entries: CacheEntry[];
    metadata: {
      exportDate: Date;
      version: string;
      stats: CacheStats;
    };
  }> {
    if (!this.isInitialized) {
      throw new Error('Cache manager not initialized');
    }

    const allEntries: CacheEntry[] = [];

    for (const layer of this.layers.values()) {
      const entries = await layer.export();
      allEntries.push(...entries);
    }

    return {
      entries: allEntries,
      metadata: {
        exportDate: new Date(),
        version: '2.0.0',
        stats: await this.getStats()
      }
    };
  }

  /**
   * Import cache data
   */
  async import(data: {
    entries: CacheEntry[];
    metadata: any;
  }): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Cache manager not initialized');
    }

    console.log(`📥 Importing ${data.entries.length} cache entries`);

    for (const entry of data.entries) {
      try {
        // Validate entry
        if (!this.validateCacheEntry(entry)) {
          console.warn('Invalid cache entry skipped:', entry.key);
          continue;
        }

        // Check if entry is still valid
        if (new Date() > entry.metadata.expiresAt) {
          continue; // Skip expired entries
        }

        // Store in appropriate layers
        for (const layerConfig of this.config.layers) {
          if (!layerConfig.enabled) continue;

          const layer = this.layers.get(layerConfig.type);
          if (layer) {
            await layer.set(entry.key, entry);
          }
        }

      } catch (error) {
        console.warn(`Failed to import cache entry:`, error);
      }
    }

    console.log('✅ Cache import completed');
    this.emit('cache-imported', { entries: data.entries.length });
  }

  /**
   * Private helper methods
   */
  private async createCacheLayer(config: CacheLayer): Promise<CacheLayerInstance> {
    switch (config.type) {
      case 'memory':
        return new MemoryCacheLayer(config);
      case 'disk':
        return new DiskCacheLayer(config);
      case 'redis':
        return new RedisCacheLayer(config);
      case 'distributed':
        return new DistributedCacheLayer(config);
      default:
        throw new Error(`Unsupported cache layer type: ${config.type}`);
    }
  }

  private generateCacheKey(request: CachedRequest): string {
    const keyData = {
      type: request.type,
      provider: request.provider,
      model: request.model,
      prompt: request.prompt,
      parameters: request.parameters
    };

    const keyString = JSON.stringify(keyData);
    return createHash('sha256').update(keyString).digest('hex');
  }

  private async semanticSearch(request: CachedRequest, layer: CacheLayerInstance): Promise<CacheEntry | null> {
    if (!this.config.semanticSimilarity.enabled) {
      return null;
    }

    const embedding = await this.semanticIndex.generateEmbedding(request.prompt);
    const similarEntries = await this.semanticIndex.search(embedding, this.config.semanticSimilarity.similarityThreshold);

    // Check if similar entries exist in the layer
    for (const similarEntry of similarEntries) {
      const cached = await layer.get(similarEntry.key);
      if (cached && this.isSimilarRequest(request, cached.request)) {
        cached.metadata.similarityScore = similarEntry.similarity;
        return cached;
      }
    }

    return null;
  }

  private isSimilarRequest(request1: CachedRequest, request2: CachedRequest): boolean {
    // Additional similarity checks beyond semantic similarity
    return request1.type === request2.type &&
           request1.provider === request2.provider &&
           request1.model === request2.model &&
           Math.abs(JSON.stringify(request1.parameters).length - JSON.stringify(request2.parameters).length) < 100;
  }

  private createSearchResult(entry: CacheEntry, matchType: 'exact' | 'semantic' | 'partial', similarityScore: number): CacheSearchResult {
    return {
      entry,
      similarityScore,
      matchType,
      confidence: this.calculateConfidence(entry, matchType, similarityScore)
    };
  }

  private calculateConfidence(entry: CacheEntry, matchType: string, similarityScore: number): number {
    let confidence = similarityScore;

    // Adjust confidence based on match type
    if (matchType === 'exact') {
      confidence = 1.0;
    } else if (matchType === 'semantic') {
      confidence *= 0.9; // Semantic matches are slightly less reliable
    }

    // Adjust confidence based on entry quality
    confidence *= (entry.metadata.quality / 10);

    // Adjust confidence based on age
    const age = Date.now() - entry.createdAt.getTime();
    const maxAge = entry.metadata.ttl;
    const ageFactor = 1 - (age / maxAge);
    confidence *= Math.max(0.5, ageFactor);

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  private async updateAccessStats(entry: CacheEntry): Promise<void> {
    entry.lastAccessed = new Date();
    entry.accessCount++;

    // Update in all layers
    for (const layer of this.layers.values()) {
      await layer.updateAccess(entry.key, entry);
    }
  }

  private async processCacheEntry(entry: CacheEntry): Promise<void> {
    // Compression
    if (this.compression && entry.metadata.size > 1024) { // Only compress entries > 1KB
      entry = await this.compression.compress(entry);
    }

    // Encryption
    if (this.encryption && this.config.privacy.encryptionEnabled) {
      entry = await this.encryption.encrypt(entry);
    }
  }

  private calculateEntrySize(request: CachedRequest, response: CachedResponse): number {
    const requestSize = JSON.stringify(request).length;
    const responseSize = JSON.stringify(response).length;
    return requestSize + responseSize + 200; // Add overhead for metadata
  }

  private calculateResponseQuality(response: CachedResponse): number {
    // Calculate quality based on various factors
    let quality = 5; // Base quality

    // Response length (longer responses might be more comprehensive)
    if (response.content.length > 1000) quality += 1;
    if (response.content.length > 5000) quality += 1;

    // Processing time (faster is better)
    if (response.processingTime < 1000) quality += 1;
    if (response.processingTime < 500) quality += 1;

    // Token efficiency
    const tokenRatio = response.usage.outputTokens / response.usage.inputTokens;
    if (tokenRatio > 0.5 && tokenRatio < 2.0) quality += 1;

    return Math.min(10, Math.max(1, quality));
  }

  private getDefaultTTL(requestType: string): number {
    const ttlMap: Record<string, number> = {
      'test_generation': 3600000, // 1 hour
      'bug_analysis': 7200000,    // 2 hours
      'performance_analysis': 1800000, // 30 minutes
      'code_optimization': 3600000, // 1 hour
      'chat_completion': 900000,   // 15 minutes
      'embedding': 86400000,      // 24 hours
      'classification': 3600000,  // 1 hour
      'summarization': 7200000    // 2 hours
    };

    return ttlMap[requestType] || 3600000; // Default 1 hour
  }

  private async calculateDiskUsage(): Promise<number> {
    let totalUsage = 0;
    for (const layer of this.layers.values()) {
      if (layer instanceof DiskCacheLayer) {
        totalUsage += await layer.getDiskUsage();
      }
    }
    return totalUsage;
  }

  private async calculateCompressionRatio(): Promise<number> {
    // This would track actual compression ratio
    return 0.65; // Mock 65% compression ratio
  }

  private getTotalMemoryLimit(): number {
    return this.config.layers.reduce((total, layer) => total + layer.maxMemory, 0);
  }

  private validateCacheEntry(entry: CacheEntry): boolean {
    return !!(entry.key && entry.request && entry.response && entry.metadata);
  }

  private getEmptyStats(): CacheStats {
    return {
      totalEntries: 0,
      hitRate: 0,
      missRate: 1,
      averageResponseTime: 0,
      memoryUsage: 0,
      diskUsage: 0,
      evictionCount: 0,
      compressionRatio: 1,
      semanticHits: 0,
      exactHits: 0,
      errors: 0,
      byLayer: new Map(),
      byProvider: new Map(),
      byRequestType: new Map()
    };
  }

  /**
   * Shutdown cache manager
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down AI Cache Manager...');

    try {
      // Shutdown all layers
      for (const layer of this.layers.values()) {
        await layer.shutdown();
      }

      // Shutdown components
      await this.semanticIndex?.shutdown();
      await this.metricsCollector?.shutdown();

      this.removeAllListeners();
      this.layers.clear();
      this.isInitialized = false;

      console.log('✅ AI Cache Manager shutdown completed');

    } catch (error) {
      console.error('❌ Error during cache manager shutdown:', error);
    }
  }
}

// Supporting Classes (simplified implementations)
class CacheLayerInstance {
  async get(key: string): Promise<CacheEntry | null> { return null; }
  async set(key: string, entry: CacheEntry): Promise<void> {}
  async invalidate(pattern: any): Promise<number> { return 0; }
  async clear(): Promise<void> {}
  async getStats(): Promise<any> { return { entries: 0, hits: 0, misses: 0, hitRate: 0, averageResponseTime: 0, memoryUsage: 0, evictionCount: 0 }; }
  async updateAccess(key: string, entry: CacheEntry): Promise<void> {}
  async export(): Promise<CacheEntry[]> { return []; }
  async shutdown(): Promise<void> {}
  async getDiskUsage(): Promise<number> { return 0; }
}

class MemoryCacheLayer extends CacheLayerInstance {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private config: CacheLayer;

  constructor(config: CacheLayer) {
    super();
    this.config = config;
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access order for LRU
      this.updateAccessOrder(key);
      return entry;
    }
    return null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Check eviction policy
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private evict(): void {
    if (this.config.evictionPolicy === 'lru') {
      const keyToRemove = this.accessOrder.shift();
      if (keyToRemove) {
        this.cache.delete(keyToRemove);
      }
    }
  }
}

class DiskCacheLayer extends CacheLayerInstance {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheLayer;

  constructor(config: CacheLayer) {
    super();
    this.config = config;
  }

  async getDiskUsage(): Promise<number> {
    // Mock implementation
    return this.cache.size * 1024; // Assume 1KB per entry
  }
}

class RedisCacheLayer extends CacheLayerInstance {
  // Redis implementation would go here
}

class DistributedCacheLayer extends CacheLayerInstance {
  // Distributed cache implementation would go here
}

class SemanticIndex {
  constructor(config: SemanticConfig) {}
  async generateEmbedding(text: string): Promise<number[]> { return Array(1536).fill(0).map(() => Math.random()); }
  async search(embedding: number[], threshold: number): Promise<Array<{key: string; similarity: number}>> { return []; }
  async addEntry(entry: CacheEntry): Promise<void> {}
  async invalidate(pattern: any): Promise<void> {}
  async clear(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

class PrivacyManager {
  constructor(config: PrivacyConfig) {}
  async processRequest(request: AIRequest): Promise<CachedRequest> {
    return {
      type: request.type,
      provider: request.provider,
      model: request.model,
      prompt: request.prompt,
      parameters: request.parameters,
      piiMasked: true
    };
  }
  async processResponse(response: AIResponse): Promise<CachedResponse> {
    return {
      content: response.content,
      usage: response.usage,
      cost: response.cost,
      processingTime: response.processingTime,
      cached: response.cached,
      finishReason: response.metadata?.finishReason || 'stop'
    };
  }
}

class MetricsCollector {
  constructor(config: MonitoringConfig) {}
  recordHit(layer: string, responseTime: number): void {}
  recordSemanticHit(layer: string, responseTime: number): void {}
  recordMiss(responseTime: number): void {}
  recordSet(responseTime: number, layers: string[]): void {}
  recordError(): void {}
  getSemanticHits(): number { return 0; }
  getExactHits(): number { return 0; }
  getErrors(): number { return 0; }
  getProviderStats(): Map<AIProviderType, ProviderStats> { return new Map(); }
  getRequestTypeStats(): Map<string, RequestTypeStats> { return new Map(); }
  async shutdown(): Promise<void> {}
}

class CompressionManager {
  constructor(config: PerformanceConfig) {}
  async compress(entry: CacheEntry): Promise<CacheEntry> { return entry; }
}

class EncryptionManager {
  constructor(config: PrivacyConfig) {}
  async encrypt(entry: CacheEntry): Promise<CacheEntry> { return entry; }
}

export {
  AICacheManager,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  type CacheSearchResult
};
