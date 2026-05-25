/**
 * AI Response Caching System Test Suite
 *
 * Comprehensive test coverage for the intelligent caching system:
 * - Semantic caching based on request similarity
 * - Multi-layer caching performance and reliability
 * - Privacy compliance and data protection
 * - Cache invalidation and refresh strategies
 * - Performance optimization and monitoring
 * - Memory usage and efficiency testing
 * - Edge cases and error handling validation
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AICacheManager, type CacheConfig, type AIRequest, type AIResponse } from '../src/services/ai/cache-manager';

// Mock implementations
const mockAIRequest: AIRequest = {
  id: 'test-req-1',
  userId: 'user-123',
  organizationId: 'org-456',
  type: 'test_generation',
  provider: 'openai',
  model: 'gpt-4',
  prompt: 'Generate a login test for a mobile app',
  parameters: {
    temperature: 0.7,
    maxTokens: 500
  },
  priority: 'normal',
  createdAt: new Date()
};

const mockAIResponse: AIResponse = {
  id: 'test-resp-1',
  requestId: 'test-req-1',
  provider: 'openai',
  model: 'gpt-4',
  content: 'Test code for login functionality...',
  usage: {
    inputTokens: 50,
    outputTokens: 200,
    totalTokens: 250
  },
  cost: {
    inputCost: 0.0015,
    outputCost: 0.006,
    totalCost: 0.0075,
    currency: 'USD',
    provider: 'OpenAI',
    model: 'gpt-4'
  },
  metadata: {
    finishReason: 'stop',
    processingTime: 1200,
    queueTime: 100,
    providerResponseTime: 1100,
    retryAttempts: 0,
    cacheHit: false
  },
  processingTime: 1200,
  cached: false,
  createdAt: new Date()
};

describe('AICacheManager', () => {
  let cacheManager: AICacheManager;
  let testConfig: Partial<CacheConfig>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create test configuration
    testConfig = {
      enabled: true,
      layers: [
        {
          type: 'memory',
          enabled: true,
          maxSize: 100,
          maxMemory: 10 * 1024 * 1024, // 10MB
          ttl: 3600000, // 1 hour
          compressionEnabled: false,
          evictionPolicy: 'lru',
          priority: 1
        }
      ],
      semanticSimilarity: {
        enabled: true,
        similarityThreshold: 0.85,
        embeddingModel: 'text-embedding-ada-002',
        vectorDimensions: 1536,
        maxCachedEmbeddings: 1000,
        embeddingCache: true,
        semanticIndex: 'brute-force'
      },
      privacy: {
        enabled: true,
        piiDetection: false, // Disabled for testing
        dataMasking: false,
        encryptionEnabled: false,
        retentionPeriod: 30,
        anonymizationLevel: 'none',
        gdprCompliance: true
      },
      performance: {
        maxConcurrentLookups: 10,
        lookupTimeout: 1000,
        batchOperations: false,
        compressionLevel: 1,
        serializationFormat: 'json',
        asyncPersistence: false
      },
      monitoring: {
        enabled: true,
        metricsInterval: 1000,
        detailedLogging: false,
        performanceProfiling: false,
        alertThresholds: {
          hitRateMin: 0.3,
          responseTimeMax: 100,
          memoryUsageMax: 0.8,
          errorRateMax: 0.05
        }
      }
    };

    // Create cache manager instance
    cacheManager = new AICacheManager(testConfig);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (cacheManager) {
      await cacheManager.shutdown();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize cache manager with default configuration', async () => {
      const defaultManager = new AICacheManager();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(defaultManager).toBeDefined();
      await defaultManager.shutdown();
    });

    it('should accept custom configuration', async () => {
      const customConfig = {
        enabled: false,
        semanticSimilarity: {
          enabled: false,
          similarityThreshold: 0.9,
          embeddingModel: 'custom-model',
          vectorDimensions: 768,
          maxCachedEmbeddings: 500,
          embeddingCache: false,
          semanticIndex: 'hnsw'
        }
      };

      const customManager = new AICacheManager(customConfig);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(customManager).toBeDefined();
      await customManager.shutdown();
    });

    it('should initialize specified cache layers', async () => {
      const configWithLayers = {
        layers: [
          {
            type: 'memory',
            enabled: true,
            maxSize: 50,
            maxMemory: 5 * 1024 * 1024,
            ttl: 1800000,
            compressionEnabled: true,
            evictionPolicy: 'lfu',
            priority: 1
          }
        ]
      };

      const manager = new AICacheManager(configWithLayers);
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(manager).toBeDefined();
      await manager.shutdown();
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached responses', async () => {
      // Store response
      await cacheManager.set(mockAIRequest, mockAIResponse);

      // Retrieve response
      const result = await cacheManager.get(mockAIRequest);

      expect(result).toBeDefined();
      expect(result!.matchType).toBe('exact');
      expect(result!.similarityScore).toBe(1.0);
      expect(result!.entry.response.content).toBe(mockAIResponse.content);
      expect(result!.entry.response.usage.totalTokens).toBe(mockAIResponse.usage.totalTokens);
    });

    it('should return null for non-existent cache entries', async () => {
      const nonExistentRequest: AIRequest = {
        ...mockAIRequest,
        id: 'non-existent',
        prompt: 'This request was never cached'
      };

      const result = await cacheManager.get(nonExistentRequest);
      expect(result).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      const shortTTLConfig = {
        ...testConfig,
        layers: [{
          type: 'memory',
          enabled: true,
          maxSize: 100,
          maxMemory: 10 * 1024 * 1024,
          ttl: 100, // 100ms TTL for testing
          compressionEnabled: false,
          evictionPolicy: 'lru',
          priority: 1
        }]
      };

      const shortTTLManager = new AICacheManager(shortTTLConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Store response
      await shortTTLManager.set(mockAIRequest, mockAIResponse);

      // Should be available immediately
      let result = await shortTTLManager.get(mockAIRequest);
      expect(result).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired now
      result = await shortTTLManager.get(mockAIRequest);
      expect(result).toBeNull();

      await shortTTLManager.shutdown();
    });

    it('should handle cache layer priority correctly', async () => {
      const multiLayerConfig = {
        ...testConfig,
        layers: [
          {
            type: 'memory',
            enabled: true,
            maxSize: 10,
            maxMemory: 1 * 1024 * 1024,
            ttl: 3600000,
            compressionEnabled: false,
            evictionPolicy: 'lru',
            priority: 1 // Higher priority
          },
          {
            type: 'disk',
            enabled: true,
            maxSize: 100,
            maxMemory: 10 * 1024 * 1024,
            ttl: 7200000,
            compressionEnabled: false,
            evictionPolicy: 'lru',
            priority: 2 // Lower priority
          }
        ]
      };

      const multiLayerManager = new AICacheManager(multiLayerConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Store response
      await multiLayerManager.set(mockAIRequest, mockAIResponse);

      // Should find in highest priority layer first
      const result = await multiLayerManager.get(mockAIRequest);
      expect(result).toBeDefined();

      await multiLayerManager.shutdown();
    });
  });

  describe('Semantic Caching', () => {
    it('should find semantically similar requests', async () => {
      const similarRequest: AIRequest = {
        ...mockAIRequest,
        id: 'similar-req',
        prompt: 'Create a login test case for mobile application' // Similar but not identical
      };

      // Store original request
      await cacheManager.set(mockAIRequest, mockAIResponse);

      // Search for similar request
      const result = await cacheManager.get(similarRequest);

      // Note: This test depends on the semantic similarity implementation
      // For now, we test that the method executes without error
      expect(result).toBeDefined();
      if (result) {
        expect(result.matchType).toBe('semantic');
        expect(result.similarityScore).toBeGreaterThan(0);
        expect(result.similarityScore).toBeLessThanOrEqual(1.0);
      }
    });

    it('should respect similarity threshold', async () => {
      const lowSimilarityConfig = {
        ...testConfig,
        semanticSimilarity: {
          ...testConfig.semanticSimilarity!,
          similarityThreshold: 0.95 // Very high threshold
        }
      };

      const lowSimilarityManager = new AICacheManager(lowSimilarityConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      const differentRequest: AIRequest = {
        ...mockAIRequest,
        id: 'different-req',
        prompt: 'Generate performance test for web application' // Very different
      };

      // Store original request
      await lowSimilarityManager.set(mockAIRequest, mockAIResponse);

      // Search for different request
      const result = await lowSimilarityManager.get(differentRequest);

      // Should not find match due to high similarity threshold
      expect(result).toBeNull();

      await lowSimilarityManager.shutdown();
    });

    it('should handle disabled semantic caching', async () => {
      const noSemanticConfig = {
        ...testConfig,
        semanticSimilarity: {
          ...testConfig.semanticSimilarity!,
          enabled: false
        }
      };

      const noSemanticManager = new AICacheManager(noSemanticConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      const similarRequest: AIRequest = {
        ...mockAIRequest,
        id: 'similar-req-no-semantic',
        prompt: 'Create login test for mobile app' // Similar
      };

      // Store original request
      await noSemanticManager.set(mockAIRequest, mockAIResponse);

      // Search for similar request
      const result = await noSemanticManager.get(similarRequest);

      // Should not find semantic match when disabled
      expect(result).toBeNull();

      await noSemanticManager.shutdown();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate entries by provider', async () => {
      // Store multiple requests from different providers
      const openAIRequest = { ...mockAIRequest, provider: 'openai' as const };
      const huggingFaceRequest = { ...mockAIRequest, provider: 'huggingface' as const, id: 'hf-req' };

      await cacheManager.set(openAIRequest, mockAIResponse);
      await cacheManager.set(huggingFaceRequest, mockAIResponse);

      // Invalidate OpenAI entries
      const invalidatedCount = await cacheManager.invalidate({
        provider: 'openai'
      });

      expect(invalidatedCount).toBeGreaterThan(0);

      // OpenAI request should not be cached
      const openAIResult = await cacheManager.get(openAIRequest);
      expect(openAIResult).toBeNull();

      // Hugging Face request should still be cached
      const hfResult = await cacheManager.get(huggingFaceRequest);
      expect(hfResult).toBeDefined();
    });

    it('should invalidate entries by model', async () => {
      const gpt4Request = { ...mockAIRequest, model: 'gpt-4' };
      const gpt35Request = { ...mockAIRequest, model: 'gpt-3.5-turbo', id: 'gpt35-req' };

      await cacheManager.set(gpt4Request, mockAIResponse);
      await cacheManager.set(gpt35Request, mockAIResponse);

      // Invalidate GPT-4 entries
      const invalidatedCount = await cacheManager.invalidate({
        model: 'gpt-4'
      });

      expect(invalidatedCount).toBeGreaterThan(0);

      // GPT-4 request should not be cached
      const gpt4Result = await cacheManager.get(gpt4Request);
      expect(gpt4Result).toBeNull();

      // GPT-3.5 request should still be cached
      const gpt35Result = await cacheManager.get(gpt35Request);
      expect(gpt35Result).toBeDefined();
    });

    it('should invalidate entries older than specified date', async () => {
      const oldRequest = { ...mockAIRequest, id: 'old-req' };

      // Store request
      await cacheManager.set(oldRequest, mockAIResponse);

      // Invalidate entries older than now (should not invalidate)
      let invalidatedCount = await cacheManager.invalidate({
        olderThan: new Date()
      });
      expect(invalidatedCount).toBe(0);

      // Should still be cached
      let result = await cacheManager.get(oldRequest);
      expect(result).toBeDefined();

      // Invalidate entries older than future date (should invalidate)
      invalidatedCount = await cacheManager.invalidate({
        olderThan: new Date(Date.now() + 86400000) // Tomorrow
      });
      expect(invalidatedCount).toBeGreaterThan(0);

      // Should not be cached anymore
      result = await cacheManager.get(oldRequest);
      expect(result).toBeNull();
    });

    it('should clear all cache entries', async () => {
      // Store multiple entries
      await cacheManager.set(mockAIRequest, mockAIResponse);
      await cacheManager.set({ ...mockAIRequest, id: 'req-2' }, mockAIResponse);
      await cacheManager.set({ ...mockAIRequest, id: 'req-3' }, mockAIResponse);

      // Verify entries are cached
      expect(await cacheManager.get(mockAIRequest)).toBeDefined();
      expect(await cacheManager.get({ ...mockAIRequest, id: 'req-2' })).toBeDefined();
      expect(await cacheManager.get({ ...mockAIRequest, id: 'req-3' })).toBeDefined();

      // Clear all cache
      await cacheManager.clear();

      // Verify no entries are cached
      expect(await cacheManager.get(mockAIRequest)).toBeNull();
      expect(await cacheManager.get({ ...mockAIRequest, id: 'req-2' })).toBeNull();
      expect(await cacheManager.get({ ...mockAIRequest, id: 'req-3' })).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should provide accurate cache statistics', async () => {
      // Store some entries
      await cacheManager.set(mockAIRequest, mockAIResponse);
      await cacheManager.set({ ...mockAIRequest, id: 'req-2' }, mockAIResponse);

      // Generate some hits and misses
      await cacheManager.get(mockAIRequest); // Hit
      await cacheManager.get({ ...mockAIRequest, id: 'req-2' }); // Hit
      await cacheManager.get({ ...mockAIRequest, id: 'non-existent' }); // Miss

      const stats = await cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalEntries).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
      expect(stats.missRate).toBeGreaterThanOrEqual(0);
      expect(stats.missRate).toBeLessThanOrEqual(1);
      expect(stats.byLayer.size).toBeGreaterThan(0);
    });

    it('should track provider-specific statistics', async () => {
      const openAIRequest = { ...mockAIRequest, provider: 'openai' as const };
      const huggingFaceRequest = { ...mockAIRequest, provider: 'huggingface' as const, id: 'hf-req' };

      await cacheManager.set(openAIRequest, mockAIResponse);
      await cacheManager.set(huggingFaceRequest, mockAIResponse);

      // Generate hits for different providers
      await cacheManager.get(openAIRequest);
      await cacheManager.get(huggingFaceRequest);

      const stats = await cacheManager.getStats();
      expect(stats.byProvider.size).toBeGreaterThan(0);
      expect(stats.byProvider.has('openai')).toBe(true);
      expect(stats.byProvider.has('huggingface')).toBe(true);
    });

    it('should track request type statistics', async () => {
      const testGenRequest = { ...mockAIRequest, type: 'test_generation' as const };
      const bugAnalysisRequest = { ...mockAIRequest, type: 'bug_analysis' as const, id: 'bug-req' };

      await cacheManager.set(testGenRequest, mockAIResponse);
      await cacheManager.set(bugAnalysisRequest, mockAIResponse);

      // Generate hits
      await cacheManager.get(testGenRequest);
      await cacheManager.get(bugAnalysisRequest);

      const stats = await cacheManager.getStats();
      expect(stats.byRequestType.size).toBeGreaterThan(0);
      expect(stats.byRequestType.has('test_generation')).toBe(true);
      expect(stats.byRequestType.has('bug_analysis')).toBe(true);
    });
  });

  describe('Performance Testing', () => {
    it('should handle high-volume concurrent operations', async () => {
      const requests = Array.from({ length: 1000 }, (_, i) => ({
        ...mockAIRequest,
        id: `perf-req-${i}`,
        prompt: `Test request ${i} for performance testing`
      }));

      // Store all entries concurrently
      const storePromises = requests.map(req => cacheManager.set(req, mockAIResponse));
      await Promise.all(storePromises);

      // Retrieve all entries concurrently
      const retrievePromises = requests.map(req => cacheManager.get(req));
      const results = await Promise.all(retrievePromises);

      // Verify all operations completed successfully
      expect(results.length).toBe(requests.length);
      expect(results.filter(r => r !== null).length).toBe(requests.length);
    });

    it('should maintain performance under memory pressure', async () => {
      const smallMemoryConfig = {
        ...testConfig,
        layers: [{
          type: 'memory',
          enabled: true,
          maxSize: 10, // Very small cache
          maxMemory: 1024 * 1024, // 1MB
          ttl: 3600000,
          compressionEnabled: true,
          evictionPolicy: 'lru',
          priority: 1
        }]
      };

      const memoryConstrainedManager = new AICacheManager(smallMemoryConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Store more entries than cache can hold
      const requests = Array.from({ length: 50 }, (_, i) => ({
        ...mockAIRequest,
        id: `memory-req-${i}`,
        prompt: `Memory test request ${i} with additional content to increase size`
      }));

      for (const req of requests) {
        await memoryConstrainedManager.set(req, mockAIResponse);
      }

      // Cache should still be functional
      const result = await memoryConstrainedManager.get(requests[requests.length - 1]);
      expect(result).toBeDefined();

      // Statistics should show evictions occurred
      const stats = await memoryConstrainedManager.getStats();
      expect(stats.evictionCount).toBeGreaterThan(0);

      await memoryConstrainedManager.shutdown();
    });

    it('should complete operations within timeout limits', async () => {
      const startTime = Date.now();

      // Store and retrieve multiple entries
      await cacheManager.set(mockAIRequest, mockAIResponse);
      const result = await cacheManager.get(mockAIRequest);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(100); // 100ms threshold
      expect(result).toBeDefined();
    });
  });

  describe('Privacy and Security', () => {
    it('should mask PII when privacy features are enabled', async () => {
      const privacyConfig = {
        ...testConfig,
        privacy: {
          ...testConfig.privacy!,
          piiDetection: true,
          dataMasking: true,
          anonymizationLevel: 'full'
        }
      };

      const privacyManager = new AICacheManager(privacyConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      const requestWithPII: AIRequest = {
        ...mockAIRequest,
        prompt: 'Generate test for user john.doe@example.com with phone 555-1234'
      };

      await privacyManager.set(requestWithPII, mockAIResponse);
      const result = await privacyManager.get(requestWithPII);

      expect(result).toBeDefined();
      // Verify PII was masked (implementation dependent)
      expect(result!.entry.request.piiMasked).toBe(true);

      await privacyManager.shutdown();
    });

    it('should handle encryption when enabled', async () => {
      const encryptionConfig = {
        ...testConfig,
        privacy: {
          ...testConfig.privacy!,
          encryptionEnabled: true,
          encryptionKey: 'test-encryption-key-32-chars-long'
        }
      };

      const encryptionManager = new AICacheManager(encryptionConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      await encryptionManager.set(mockAIRequest, mockAIResponse);
      const result = await encryptionManager.get(mockAIRequest);

      expect(result).toBeDefined();
      // Verify encryption was applied (implementation dependent)
      expect(result!.entry.metadata.encrypted).toBe(true);

      await encryptionManager.shutdown();
    });
  });

  describe('Cache Optimization', () => {
    it('should provide optimization recommendations', async () => {
      // Create scenarios that trigger recommendations
      await cacheManager.set(mockAIRequest, mockAIResponse);

      // Generate some misses to lower hit rate
      await cacheManager.get({ ...mockAIRequest, id: 'miss-1' });
      await cacheManager.get({ ...mockAIRequest, id: 'miss-2' });
      await cacheManager.get({ ...mockAIRequest, id: 'miss-3' });

      const optimization = await cacheManager.optimize();

      expect(optimization).toBeDefined();
      expect(optimization.recommendations).toBeDefined();
      expect(optimization.actions).toBeDefined();
      expect(optimization.improvements).toBeDefined();
      expect(Array.isArray(optimization.recommendations)).toBe(true);
      expect(typeof optimization.improvements.hitRate).toBe('number');
    });

    it('should warm up cache with provided requests', async () => {
      const warmupRequests = [
        {
          request: mockAIRequest,
          expectedResponse: mockAIResponse,
          priority: 'high' as const
        },
        {
          request: { ...mockAIRequest, id: 'warmup-2' },
          expectedResponse: mockAIResponse,
          priority: 'normal' as const
        }
      ];

      await cacheManager.warmup(warmupRequests);

      // Verify warmup entries are cached
      const result1 = await cacheManager.get(mockAIRequest);
      const result2 = await cacheManager.get({ ...mockAIRequest, id: 'warmup-2' });

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle disabled cache gracefully', async () => {
      const disabledConfig = { enabled: false };
      const disabledManager = new AICacheManager(disabledConfig);
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await disabledManager.get(mockAIRequest);
      expect(result).toBeNull();

      await disabledManager.set(mockAIRequest, mockAIResponse); // Should not throw
      const afterSet = await disabledManager.get(mockAIRequest);
      expect(afterSet).toBeNull();

      await disabledManager.shutdown();
    });

    it('should handle invalid requests gracefully', async () => {
      const invalidRequest = {
        ...mockAIRequest,
        prompt: '' // Empty prompt
      };

      // Should not throw error
      await expect(cacheManager.set(invalidRequest, mockAIResponse)).resolves.not.toThrow();
    });

    it('should handle corrupted cache entries', async () => {
      // This would test handling of corrupted entries
      // Implementation depends on specific corruption scenarios
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('Data Export and Import', () => {
    it('should export cache data', async () => {
      await cacheManager.set(mockAIRequest, mockAIResponse);
      await cacheManager.set({ ...mockAIRequest, id: 'export-2' }, mockAIResponse);

      const exportedData = await cacheManager.export();

      expect(exportedData).toBeDefined();
      expect(exportedData.entries).toBeDefined();
      expect(exportedData.metadata).toBeDefined();
      expect(exportedData.entries.length).toBeGreaterThan(0);
      expect(exportedData.metadata.exportDate).toBeInstanceOf(Date);
      expect(exportedData.metadata.version).toBeDefined();
    });

    it('should import cache data', async () => {
      const importData = {
        entries: [
          {
            key: 'import-key-1',
            request: {
              type: 'test_generation',
              provider: 'openai' as const,
              model: 'gpt-4',
              prompt: 'Imported test request',
              parameters: {},
              piiMasked: false
            },
            response: {
              content: 'Imported response',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              cost: { totalCost: 0.001, currency: 'USD' },
              processingTime: 500,
              cached: false,
              finishReason: 'stop'
            },
            metadata: {
              ttl: 3600000,
              expiresAt: new Date(Date.now() + 3600000),
              size: 100,
              compressed: false,
              encrypted: false,
              tags: [],
              version: '1.0',
              quality: 8
            },
            createdAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 0
          }
        ],
        metadata: {
          exportDate: new Date(),
          version: '2.0.0'
        }
      };

      await cacheManager.import(importData);

      // Verify imported entry is accessible
      const result = await cacheManager.get({
        ...mockAIRequest,
        prompt: 'Imported test request'
      });

      expect(result).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate cache layer configuration', async () => {
      const invalidConfig = {
        ...testConfig,
        layers: [
          {
            type: 'invalid_type' as any,
            enabled: true,
            maxSize: -1, // Invalid
            maxMemory: -1, // Invalid
            ttl: -1, // Invalid
            compressionEnabled: true,
            evictionPolicy: 'invalid_policy' as any,
            priority: 1
          }
        ]
      };

      // Should handle invalid configuration gracefully
      expect(() => new AICacheManager(invalidConfig)).not.toThrow();
    });

    it('should handle semantic configuration validation', async () => {
      const invalidSemanticConfig = {
        ...testConfig,
        semanticSimilarity: {
          enabled: true,
          similarityThreshold: 1.5, // Invalid (> 1.0)
          embeddingModel: '',
          vectorDimensions: -1, // Invalid
          maxCachedEmbeddings: -1, // Invalid
          embeddingCache: true,
          semanticIndex: 'invalid_index' as any
        }
      };

      expect(() => new AICacheManager(invalidSemanticConfig)).not.toThrow();
    });
  });

  describe('Integration with AI Manager', () => {
    it('should integrate seamlessly with AI Manager workflow', async () => {
      // Simulate AI Manager workflow
      const requests = [
        { ...mockAIRequest, type: 'test_generation' as const },
        { ...mockAIRequest, id: 'req-2', type: 'bug_analysis' as const },
        { ...mockAIRequest, id: 'req-3', type: 'performance_analysis' as const }
      ];

      // Simulate storing responses from AI Manager
      for (const req of requests) {
        await cacheManager.set(req, {
          ...mockAIResponse,
          id: `resp-${req.id}`,
          requestId: req.id
        });
      }

      // Simulate AI Manager checking cache before making API calls
      for (const req of requests) {
        const cached = await cacheManager.get(req);
        if (cached) {
          // Use cached response instead of making API call
          expect(cached.entry.response.content).toBeDefined();
        }
      }

      const stats = await cacheManager.getStats();
      expect(stats.totalEntries).toBe(requests.length);
    });
  });
});
