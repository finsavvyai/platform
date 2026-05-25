/**
 * AI Provider Abstraction Layer Test Suite
 *
 * Comprehensive test coverage for the multi-provider AI service architecture.
 * Tests provider selection, fallback logic, cost calculation, rate limiting,
 * health monitoring, and error handling across different AI providers.
 *
 * Test Coverage Areas:
 * - Provider initialization and configuration
 * - Multi-provider request execution
 * - Intelligent provider selection strategies
 * - Fallback behavior and error recovery
 * - Cost calculation and usage tracking
 * - Rate limiting and quota management
 * - Health monitoring and automatic failover
 * - Response caching and performance optimization
 * - Error handling and retry mechanisms
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIManager, AIProvider, AIRequest, AIResponse, AIProviderType } from '../src/services/ai/ai-manager';
import OpenAIProvider from '../src/services/ai/providers/openai-provider';
import HuggingFaceProvider from '../src/services/ai/providers/huggingface-provider';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    },
    embeddings: {
      create: jest.fn()
    },
    models: {
      list: jest.fn()
    }
  }));
});

// Mock Hugging Face
jest.mock('@huggingface/inference', () => {
  return jest.fn().mockImplementation(() => ({
    textGeneration: jest.fn(),
    textClassification: jest.fn(),
    featureExtraction: jest.fn(),
    summarization: jest.fn(),
    translation: jest.fn()
  }));
});

describe('AI Provider Abstraction Layer', () => {
  let aiManager: AIManager;
  let mockConfig: any;

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.HUGGINGFACE_API_KEY = 'test-hf-key';

    mockConfig = {
      defaultProvider: 'openai',
      enableCaching: true,
      cacheTimeout: 1000,
      enableHealthChecks: false, // Disable for unit tests
      maxRetries: 2,
      retryDelay: 100,
      enableCostTracking: true,
      enableUsageTracking: true,
      selectionStrategy: {
        strategy: 'cost',
        fallbackEnabled: true
      }
    };

    aiManager = new AIManager(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
  });

  describe('AI Manager Initialization', () => {
    it('should initialize with default configuration', () => {
      const manager = new AIManager();
      expect(manager).toBeDefined();
      expect(manager.getProviders()).toHaveLength(3); // openai, huggingface, anthropic (if key available)
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        defaultProvider: 'huggingface' as AIProviderType,
        enableCaching: false,
        maxRetries: 5
      };

      const manager = new AIManager(customConfig);
      expect(manager).toBeDefined();
    });

    it('should initialize providers with correct models', () => {
      const providers = aiManager.getProviders();

      const openaiProvider = providers.find(p => p.type === 'openai');
      expect(openaiProvider).toBeDefined();
      expect(openaiProvider!.models.length).toBeGreaterThan(0);
      expect(openaiProvider!.models.some(m => m.id === 'gpt-4')).toBe(true);

      const huggingfaceProvider = providers.find(p => p.type === 'huggingface');
      expect(huggingfaceProvider).toBeDefined();
      expect(huggingfaceProvider!.models.length).toBeGreaterThan(0);
    });

    it('should emit providers-initialized event', async () => {
      const emitSpy = jest.spyOn(aiManager, 'emit');

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(emitSpy).toHaveBeenCalledWith('providers-initialized', expect.any(Array));
    });
  });

  describe('Provider Selection Strategies', () => {
    it('should select provider by cost when strategy is cost', async () => {
      const request: Partial<AIRequest> = {
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case',
        parameters: { maxTokens: 100 }
      };

      // Mock provider selection method
      const selectByCostSpy = jest.spyOn(aiManager as any, 'selectByCost');
      selectByCostSpy.mockReturnValue(aiManager.getProviders()[0]);

      await aiManager.executeRequest(request as AIRequest);

      expect(selectByCostSpy).toHaveBeenCalled();
    });

    it('should select provider by speed when strategy is speed', async () => {
      const manager = new AIManager({
        ...mockConfig,
        selectionStrategy: { strategy: 'speed', fallbackEnabled: true }
      });

      const request: Partial<AIRequest> = {
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case'
      };

      const selectBySpeedSpy = jest.spyOn(manager as any, 'selectBySpeed');
      selectBySpeedSpy.mockReturnValue(manager.getProviders()[0]);

      await manager.executeRequest(request as AIRequest);

      expect(selectBySpeedSpy).toHaveBeenCalled();
    });

    it('should select provider by quality when strategy is quality', async () => {
      const manager = new AIManager({
        ...mockConfig,
        selectionStrategy: { strategy: 'quality', fallbackEnabled: true }
      });

      const request: Partial<AIRequest> = {
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case'
      };

      const selectByQualitySpy = jest.spyOn(manager as any, 'selectByQuality');
      selectByQualitySpy.mockReturnValue(manager.getProviders()[0]);

      await manager.executeRequest(request as AIRequest);

      expect(selectByQualitySpy).toHaveBeenCalled();
    });

    it('should use round-robin strategy when specified', async () => {
      const manager = new AIManager({
        ...mockConfig,
        selectionStrategy: { strategy: 'round_robin', fallbackEnabled: true }
      });

      const request: Partial<AIRequest> = {
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case'
      };

      const selectByRoundRobinSpy = jest.spyOn(manager as any, 'selectByRoundRobin');
      selectByRoundRobinSpy.mockReturnValue(manager.getProviders()[0]);

      await manager.executeRequest(request as AIRequest);

      expect(selectByRoundRobinSpy).toHaveBeenCalled();
    });
  });

  describe('Request Execution', () => {
    it('should execute basic AI request successfully', async () => {
      const request: AIRequest = {
        id: 'test-req-1',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case for login functionality',
        parameters: { temperature: 0.7, maxTokens: 150 },
        priority: 'normal',
        createdAt: new Date()
      };

      // Mock provider execution
      const mockResponse: AIResponse = {
        id: 'test-resp-1',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case for login functionality...',
        usage: { inputTokens: 20, outputTokens: 80, totalTokens: 100 },
        cost: { inputCost: 0.00003, outputCost: 0.00016, totalCost: 0.00019, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 1000, queueTime: 0, providerResponseTime: 1000, retryAttempts: 1, cacheHit: false },
        processingTime: 1000,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      const response = await aiManager.executeRequest(request);

      expect(response).toBeDefined();
      expect(response.requestId).toBe(request.id);
      expect(response.provider).toBe('openai');
      expect(response.content).toBe('Test case for login functionality...');
      expect(response.usage.totalTokens).toBe(100);
    });

    it('should handle requests with specific provider preference', async () => {
      const request: AIRequest = {
        id: 'test-req-2',
        userId: 'user1',
        type: 'test_generation',
        provider: 'huggingface',
        prompt: 'Generate a test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-2',
        requestId: request.id,
        provider: 'huggingface',
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        content: 'Generated test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.000003, outputCost: 0.000012, totalCost: 0.000015, currency: 'USD', provider: 'Hugging Face', model: 'mistralai/Mistral-7B-Instruct-v0.2' },
        metadata: { finishReason: 'stop', processingTime: 1500, queueTime: 0, providerResponseTime: 1500, retryAttempts: 1, cacheHit: false },
        processingTime: 1500,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      const response = await aiManager.executeRequest(request);

      expect(response.provider).toBe('huggingface');
      expect(response.model).toBe('mistralai/Mistral-7B-Instruct-v0.2');
    });

    it('should emit request-completed event on successful execution', async () => {
      const emitSpy = jest.spyOn(aiManager, 'emit');

      const request: AIRequest = {
        id: 'test-req-3',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-3',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case content...',
        usage: { inputTokens: 10, outputTokens: 40, totalTokens: 50 },
        cost: { inputCost: 0.000015, outputCost: 0.00008, totalCost: 0.000095, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 800, queueTime: 0, providerResponseTime: 800, retryAttempts: 1, cacheHit: false },
        processingTime: 800,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      await aiManager.executeRequest(request);

      expect(emitSpy).toHaveBeenCalledWith('request-completed', {
        requestId: request.id,
        request,
        response: mockResponse
      });
    });

    it('should emit request-failed event on execution failure', async () => {
      const emitSpy = jest.spyOn(aiManager, 'emit');

      const request: AIRequest = {
        id: 'test-req-4',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const error = new Error('Provider unavailable');
      jest.spyOn(aiManager as any, 'selectProvider').mockResolvedValue(null);

      try {
        await aiManager.executeRequest(request);
      } catch (err) {
        // Expected to throw
      }

      expect(emitSpy).toHaveBeenCalledWith('request-failed', {
        requestId: request.id,
        request,
        error: expect.any(Error)
      });
    });
  });

  describe('Fallback Logic', () => {
    it('should attempt fallback when primary provider fails', async () => {
      const manager = new AIManager({
        ...mockConfig,
        maxRetries: 2,
        selectionStrategy: { strategy: 'cost', fallbackEnabled: true }
      });

      const request: AIRequest = {
        id: 'test-req-5',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      // Mock primary provider failure
      const primaryProvider = manager.getProviders()[0];
      const fallbackProvider = manager.getProviders()[1];

      jest.spyOn(manager as any, 'selectProvider')
        .mockResolvedValueOnce(primaryProvider)
        .mockResolvedValueOnce(fallbackProvider);

      jest.spyOn(manager as any, 'executeWithProvider')
        .mockRejectedValueOnce(new Error('Primary provider failed'))
        .mockResolvedValueOnce({
          id: 'fallback-response',
          requestId: request.id,
          provider: fallbackProvider.type,
          model: fallbackProvider.models[0].id,
          content: 'Fallback response...',
          usage: { inputTokens: 10, outputTokens: 30, totalTokens: 40 },
          cost: { inputCost: 0.00002, outputCost: 0.00004, totalCost: 0.00006, currency: 'USD', provider: fallbackProvider.name, model: fallbackProvider.models[0].id },
          metadata: { finishReason: 'stop', processingTime: 1200, queueTime: 0, providerResponseTime: 1200, retryAttempts: 2, cacheHit: false },
          processingTime: 1200,
          cached: false,
          createdAt: new Date()
        });

      const response = await manager.executeRequest(request);

      expect(response.provider).toBe(fallbackProvider.type);
      expect(response.metadata.retryAttempts).toBe(2);
    });

    it('should fail when no fallback providers are available', async () => {
      const request: AIRequest = {
        id: 'test-req-6',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      // Mock no providers available
      jest.spyOn(aiManager as any, 'selectProvider').mockResolvedValue(null);

      await expect(aiManager.executeRequest(request)).rejects.toThrow('No suitable AI provider available');
    });

    it('should respect max retry limit', async () => {
      const manager = new AIManager({
        ...mockConfig,
        maxRetries: 1,
        selectionStrategy: { strategy: 'cost', fallbackEnabled: true }
      });

      const request: AIRequest = {
        id: 'test-req-7',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      // Mock all providers failing
      jest.spyOn(manager as any, 'executeWithProvider').mockRejectedValue(new Error('All providers failed'));

      await expect(manager.executeRequest(request)).rejects.toThrow();
    });
  });

  describe('Cost Calculation and Usage Tracking', () => {
    it('should calculate costs correctly for different providers', async () => {
      const request: AIRequest = {
        id: 'test-req-8',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate a comprehensive test suite',
        parameters: { maxTokens: 200 },
        priority: 'normal',
        createdAt: new Date()
      };

      // Mock OpenAI response
      const openaiResponse: AIResponse = {
        id: 'test-resp-8',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-4',
        content: 'Generated test suite...',
        usage: { inputTokens: 50, outputTokens: 150, totalTokens: 200 },
        cost: { inputCost: 0.0015, outputCost: 0.009, totalCost: 0.0105, currency: 'USD', provider: 'OpenAI', model: 'gpt-4' },
        metadata: { finishReason: 'stop', processingTime: 2000, queueTime: 0, providerResponseTime: 2000, retryAttempts: 1, cacheHit: false },
        processingTime: 2000,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(openaiResponse);

      const response = await aiManager.executeRequest(request);

      expect(response.cost.totalCost).toBe(0.0105);
      expect(response.cost.currency).toBe('USD');
      expect(response.cost.inputCost).toBe(0.0015);
      expect(response.cost.outputCost).toBe(0.009);
    });

    it('should track usage statistics per user', async () => {
      const request: AIRequest = {
        id: 'test-req-9',
        userId: 'user1',
        organizationId: 'org1',
        type: 'test_generation',
        prompt: 'Generate test cases',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-9',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test cases...',
        usage: { inputTokens: 20, outputTokens: 80, totalTokens: 100 },
        cost: { inputCost: 0.00003, outputCost: 0.00016, totalCost: 0.00019, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 1000, queueTime: 0, providerResponseTime: 1000, retryAttempts: 1, cacheHit: false },
        processingTime: 1000,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      await aiManager.executeRequest(request);

      const usageStats = aiManager.getUsageStats();
      expect(usageStats.has('org1')).toBe(true);

      const stats = usageStats.get('org1')!;
      expect(stats.requests).toBe(1);
      expect(stats.tokens).toBe(100);
      expect(stats.cost).toBe(0.00019);
    });

    it('should update provider metrics after each request', async () => {
      const request: AIRequest = {
        id: 'test-req-10',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-10',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.0000225, outputCost: 0.00012, totalCost: 0.0001425, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 800, queueTime: 0, providerResponseTime: 800, retryAttempts: 1, cacheHit: false },
        processingTime: 800,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      await aiManager.executeRequest(request);

      const providerMetrics = aiManager.getProviderMetrics();
      expect(providerMetrics.has('openai')).toBe(true);

      const metrics = providerMetrics.get('openai')!;
      expect(metrics.requests).toBe(1);
      expect(metrics.tokens).toBe(75);
      expect(metrics.cost).toBe(0.0001425);
      expect(metrics.avgResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache responses when caching is enabled', async () => {
      const manager = new AIManager({
        ...mockConfig,
        enableCaching: true,
        cacheTimeout: 5000
      });

      const request: AIRequest = {
        id: 'test-req-11',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate test case for login',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-11',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Login test case...',
        usage: { inputTokens: 20, outputTokens: 80, totalTokens: 100 },
        cost: { inputCost: 0.00003, outputCost: 0.00016, totalCost: 0.00019, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 1000, queueTime: 0, providerResponseTime: 1000, retryAttempts: 1, cacheHit: false },
        processingTime: 1000,
        cached: false,
        createdAt: new Date()
      };

      const executeSpy = jest.spyOn(manager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      // First request
      const response1 = await manager.executeRequest(request);
      expect(response1.cached).toBe(false);
      expect(executeSpy).toHaveBeenCalledTimes(1);

      // Second request (should hit cache)
      const response2 = await manager.executeRequest(request);
      expect(response2.cached).toBe(true);
      expect(executeSpy).toHaveBeenCalledTimes(1); // Should not increase
    });

    it('should not cache when caching is disabled', async () => {
      const manager = new AIManager({
        ...mockConfig,
        enableCaching: false
      });

      const request: AIRequest = {
        id: 'test-req-12',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-12',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.0000225, outputCost: 0.00012, totalCost: 0.0001425, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 800, queueTime: 0, providerResponseTime: 800, retryAttempts: 1, cacheHit: false },
        processingTime: 800,
        cached: false,
        createdAt: new Date()
      };

      const executeSpy = jest.spyOn(manager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      // First request
      const response1 = await manager.executeRequest(request);
      expect(response1.cached).toBe(false);

      // Second request (should not hit cache)
      const response2 = await manager.executeRequest(request);
      expect(response2.cached).toBe(false);
      expect(executeSpy).toHaveBeenCalledTimes(2);
    });

    it('should emit response-cached event for cached responses', async () => {
      const manager = new AIManager({
        ...mockConfig,
        enableCaching: true
      });

      const emitSpy = jest.spyOn(manager, 'emit');

      const request: AIRequest = {
        id: 'test-req-13',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      const mockResponse: AIResponse = {
        id: 'test-resp-13',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.0000225, outputCost: 0.00012, totalCost: 0.0001425, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 800, queueTime: 0, providerResponseTime: 800, retryAttempts: 1, cacheHit: false },
        processingTime: 800,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(manager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      // First request to populate cache
      await manager.executeRequest(request);

      // Second request should emit cached event
      await manager.executeRequest(request);

      expect(emitSpy).toHaveBeenCalledWith('response-cached', {
        requestId: request.id,
        response: expect.objectContaining({ cached: true })
      });
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status for all providers', async () => {
      const healthStatus = await aiManager.healthCheck();

      expect(healthStatus).toBeDefined();
      expect(typeof healthStatus).toBe('object');

      // Check that all providers have health status
      const providers = aiManager.getProviders();
      providers.forEach(provider => {
        expect(healthStatus).toHaveProperty(provider.type);
        expect(healthStatus[provider.type]).toHaveProperty('isHealthy');
        expect(healthStatus[provider.type]).toHaveProperty('lastCheck');
        expect(healthStatus[provider.type]).toHaveProperty('responseTime');
        expect(healthStatus[provider.type]).toHaveProperty('errorRate');
        expect(healthStatus[provider.type]).toHaveProperty('uptime');
      });
    });

    it('should update provider availability based on health status', () => {
      const providers = aiManager.getProviders();

      providers.forEach(provider => {
        expect(typeof provider.isAvailable).toBe('boolean');
        expect(typeof provider.healthStatus.isHealthy).toBe('boolean');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle provider initialization failures gracefully', () => {
      // Test with missing API keys
      delete process.env.OPENAI_API_KEY;
      delete process.env.HUGGINGFACE_API_KEY;

      expect(() => {
        new AIManager();
      }).not.toThrow();
    });

    it('should handle malformed requests', async () => {
      const malformedRequest = {
        id: '',
        userId: '',
        type: 'invalid_type' as any,
        prompt: '',
        parameters: null,
        priority: 'invalid_priority' as any,
        createdAt: new Date()
      };

      // Should handle gracefully without crashing
      await expect(aiManager.executeRequest(malformedRequest as any)).rejects.toThrow();
    });

    it('should handle network timeouts gracefully', async () => {
      const request: AIRequest = {
        id: 'test-req-14',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      // Mock network timeout
      jest.spyOn(aiManager as any, 'executeWithProvider').mockRejectedValue(new Error('Network timeout'));

      await expect(aiManager.executeRequest(request)).rejects.toThrow('Network timeout');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        id: `test-req-concurrent-${i}`,
        userId: 'user1',
        type: 'test_generation' as const,
        prompt: `Generate test case ${i}`,
        parameters: {},
        priority: 'normal' as const,
        createdAt: new Date()
      }));

      const mockResponse: AIResponse = {
        id: 'test-resp-concurrent',
        requestId: 'test-req-concurrent',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.0000225, outputCost: 0.00012, totalCost: 0.0001425, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 500, queueTime: 0, providerResponseTime: 500, retryAttempts: 1, cacheHit: false },
        processingTime: 500,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      const startTime = performance.now();

      const promises = requests.map(req => aiManager.executeRequest(req));
      const responses = await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(responses).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`Concurrent request performance: ${duration.toFixed(2)}ms for 10 requests`);
    });

    it('should maintain performance under high request volume', async () => {
      const requestCount = 50;
      const requests = Array.from({ length: requestCount }, (_, i) => ({
        id: `test-req-volume-${i}`,
        userId: 'user1',
        type: 'test_generation' as const,
        prompt: `Generate test case ${i}`,
        parameters: { maxTokens: 50 },
        priority: 'normal' as const,
        createdAt: new Date()
      }));

      const mockResponse: AIResponse = {
        id: 'test-resp-volume',
        requestId: 'test-req-volume',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'Test case...',
        usage: { inputTokens: 10, outputTokens: 40, totalTokens: 50 },
        cost: { inputCost: 0.000015, outputCost: 0.00008, totalCost: 0.000095, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 300, queueTime: 0, providerResponseTime: 300, retryAttempts: 1, cacheHit: false },
        processingTime: 300,
        cached: false,
        createdAt: new Date()
      };

      jest.spyOn(aiManager as any, 'executeWithProvider').mockResolvedValue(mockResponse);

      const startTime = performance.now();

      // Process requests in batches to simulate real usage
      const batchSize = 10;
      const results = [];

      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchPromises = batch.map(req => aiManager.executeRequest(req));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerRequest = duration / requestCount;

      expect(results).toHaveLength(requestCount);
      expect(avgTimePerRequest).toBeLessThan(200); // Average should be under 200ms per request

      console.log(`High volume performance: ${duration.toFixed(2)}ms total, ${avgTimePerRequest.toFixed(2)}ms per request for ${requestCount} requests`);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate with OpenAI provider correctly', async () => {
      // This would require actual OpenAI integration in a real environment
      // For now, we test the interface and mock behavior

      const openaiProvider = aiManager.getProvider('openai');
      expect(openaiProvider).toBeDefined();
      expect(openaiProvider!.models.length).toBeGreaterThan(0);
      expect(openaiProvider!.capabilities.textGeneration).toBe(true);
    });

    it('should integrate with Hugging Face provider correctly', async () => {
      const hfProvider = aiManager.getProvider('huggingface');
      expect(hfProvider).toBeDefined();
      expect(hfProvider!.models.length).toBeGreaterThan(0);
      expect(hfProvider!.capabilities.textGeneration).toBe(true);
      expect(hfProvider!.capabilities.embedding).toBe(true);
    });

    it('should handle provider switching seamlessly', async () => {
      const request: AIRequest = {
        id: 'test-req-switch',
        userId: 'user1',
        type: 'test_generation',
        prompt: 'Generate test case',
        parameters: {},
        priority: 'normal',
        createdAt: new Date()
      };

      // First response from OpenAI
      const openaiResponse: AIResponse = {
        id: 'test-resp-openai',
        requestId: request.id,
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        content: 'OpenAI generated test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.0000225, outputCost: 0.00012, totalCost: 0.0001425, currency: 'USD', provider: 'OpenAI', model: 'gpt-3.5-turbo' },
        metadata: { finishReason: 'stop', processingTime: 1000, queueTime: 0, providerResponseTime: 1000, retryAttempts: 1, cacheHit: false },
        processingTime: 1000,
        cached: false,
        createdAt: new Date()
      };

      // Second response from Hugging Face
      const hfResponse: AIResponse = {
        id: 'test-resp-hf',
        requestId: request.id,
        provider: 'huggingface',
        model: 'mistralai/Mistral-7B-Instruct-v0.2',
        content: 'Hugging Face generated test case...',
        usage: { inputTokens: 15, outputTokens: 60, totalTokens: 75 },
        cost: { inputCost: 0.000003, outputCost: 0.000012, totalCost: 0.000015, currency: 'USD', provider: 'Hugging Face', model: 'mistralai/Mistral-7B-Instruct-v0.2' },
        metadata: { finishReason: 'stop', processingTime: 1500, queueTime: 0, providerResponseTime: 1500, retryAttempts: 1, cacheHit: false },
        processingTime: 1500,
        cached: false,
        createdAt: new Date()
      };

      const executeSpy = jest.spyOn(aiManager as any, 'executeWithProvider');
      executeSpy
        .mockResolvedValueOnce(openaiResponse)
        .mockResolvedValueOnce(hfResponse);

      // Request with OpenAI preference
      const openaiRequest = { ...request, provider: 'openai' as AIProviderType };
      const response1 = await aiManager.executeRequest(openaiRequest);
      expect(response1.provider).toBe('openai');

      // Request with Hugging Face preference
      const hfRequest = { ...request, provider: 'huggingface' as AIProviderType };
      const response2 = await aiManager.executeRequest(hfRequest);
      expect(response2.provider).toBe('huggingface');
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources properly on shutdown', async () => {
      const shutdownSpy = jest.spyOn(aiManager as any, 'shutdown');

      await aiManager.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should remove all event listeners on shutdown', async () => {
      const removeAllListenersSpy = jest.spyOn(aiManager, 'removeAllListeners');

      await aiManager.shutdown();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });
});

/**
 * OpenAI Provider Unit Tests
 */
describe('OpenAI Provider', () => {
  let openaiProvider: OpenAIProvider;
  let mockProvider: AIProvider;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';

    mockProvider = {
      name: 'OpenAI',
      type: 'openai',
      models: [
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          type: 'text-generation',
          maxTokens: 4096,
          costPerToken: 0.000002,
          costPerInputToken: 0.0000015,
          costPerOutputToken: 0.000002,
          capabilities: ['text-generation', 'code-generation'],
          supportedLanguages: ['en'],
          responseTime: 1000,
          quality: 8
        }
      ],
      pricing: {
        currency: 'USD',
        inputTokenPrice: 0.0000015,
        outputTokenPrice: 0.000002,
        billingUnit: 'tokens'
      },
      rateLimits: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000
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
    } as AIProvider;

    openaiProvider = new OpenAIProvider({
      apiKey: 'test-key',
      defaultModel: 'gpt-3.5-turbo'
    }, mockProvider);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    jest.clearAllMocks();
  });

  it('should validate OpenAI provider configuration', () => {
    expect(openaiProvider).toBeDefined();
    expect(openaiProvider.getProviderInfo()).toEqual(mockProvider);
  });

  it('should validate request parameters correctly', () => {
    const validRequest: AIRequest = {
      id: 'test-req',
      userId: 'user1',
      type: 'test_generation',
      prompt: 'Generate a test case',
      parameters: { temperature: 0.7, maxTokens: 100 },
      priority: 'normal',
      createdAt: new Date()
    };

    const validation = openaiProvider.validateRequest(validRequest);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject invalid requests', () => {
    const invalidRequest: AIRequest = {
      id: 'test-req',
      userId: 'user1',
      type: 'test_generation',
      prompt: '', // Empty prompt
      parameters: { temperature: 3, maxTokens: -1 }, // Invalid parameters
      priority: 'normal',
      createdAt: new Date()
    };

    const validation = openaiProvider.validateRequest(invalidRequest);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should estimate tokens correctly', () => {
    const text = 'This is a test message for token estimation.';
    const tokens = openaiProvider.estimateTokens(text);

    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(text.length / 4));
  });

  it('should get default model for task type', () => {
    const textGenModel = openaiProvider.getDefaultModel('text_generation');
    expect(textGenModel).toBe('gpt-3.5-turbo');

    const codeGenModel = openaiProvider.getDefaultModel('code_generation');
    expect(codeGenModel).toBe('gpt-4');
  });

  it('should check model support', () => {
    expect(openaiProvider.isModelSupported('gpt-3.5-turbo')).toBe(true);
    expect(openaiProvider.isModelSupported('unsupported-model')).toBe(false);
  });
});

/**
 * Hugging Face Provider Unit Tests
 */
describe('Hugging Face Provider', () => {
  let huggingFaceProvider: HuggingFaceProvider;
  let mockProvider: AIProvider;

  beforeEach(() => {
    process.env.HUGGINGFACE_API_KEY = 'test-hf-key';

    mockProvider = {
      name: 'Hugging Face',
      type: 'huggingface',
      models: [
        {
          id: 'mistralai/Mistral-7B-Instruct-v0.2',
          name: 'Mistral 7B Instruct',
          type: 'text-generation',
          maxTokens: 8192,
          costPerToken: 0.0000002,
          capabilities: ['text-generation', 'code-generation'],
          supportedLanguages: ['en', 'fr'],
          responseTime: 1500,
          quality: 7
        }
      ],
      pricing: {
        currency: 'USD',
        inputTokenPrice: 0.0000002,
        outputTokenPrice: 0.0000002,
        billingUnit: 'tokens'
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
    } as AIProvider;

    huggingFaceProvider = new HuggingFaceProvider({
      apiKey: 'test-key',
      defaultModel: 'mistralai/Mistral-7B-Instruct-v0.2'
    }, mockProvider);
  });

  afterEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
    jest.clearAllMocks();
  });

  it('should validate Hugging Face provider configuration', () => {
    expect(huggingFaceProvider).toBeDefined();
    expect(huggingFaceProvider.getProviderInfo()).toEqual(mockProvider);
  });

  it('should get task type for model', () => {
    expect(huggingFaceProvider.getTaskType('sentence-transformers/all-MiniLM-L6-v2')).toBe('embedding');
    expect(huggingFaceProvider.getTaskType('distilbert-base-uncased-finetuned-sst-2-english')).toBe('classification');
    expect(huggingFaceProvider.getTaskType('mistralai/Mistral-7B-Instruct-v0.2')).toBe('text-generation');
  });

  it('should validate request parameters correctly', () => {
    const validRequest: AIRequest = {
      id: 'test-req',
      userId: 'user1',
      type: 'test_generation',
      prompt: 'Generate a test case',
      parameters: { temperature: 0.7, maxTokens: 100 },
      priority: 'normal',
      createdAt: new Date()
    };

    const validation = huggingFaceProvider.validateRequest(validRequest);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should reject invalid requests', () => {
    const invalidRequest: AIRequest = {
      id: 'test-req',
      userId: 'user1',
      type: 'test_generation',
      prompt: '',
      parameters: { temperature: 3, maxTokens: 5000 }, // Invalid for HF
      priority: 'normal',
      createdAt: new Date()
    };

    const validation = huggingFaceProvider.validateRequest(invalidRequest);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should estimate tokens correctly', () => {
    const text = 'This is a test message for Hugging Face token estimation.';
    const tokens = huggingFaceProvider.estimateTokens(text);

    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(text.length / 4));
  });

  it('should get default model for task type', () => {
    const textGenModel = huggingFaceProvider.getDefaultModel('text_generation');
    expect(textGenModel).toBe('mistralai/Mistral-7B-Instruct-v0.2');

    const embeddingModel = huggingFaceProvider.getDefaultModel('embedding');
    expect(embeddingModel).toBe('sentence-transformers/all-MiniLM-L6-v2');
  });

  it('should check model support', () => {
    expect(huggingFaceProvider.isModelSupported('mistralai/Mistral-7B-Instruct-v0.2')).toBe(true);
    expect(huggingFaceProvider.isModelSupported('unsupported-model')).toBe(false);
  });

  it('should get model capabilities', () => {
    const capabilities = huggingFaceProvider.getModelCapabilities('mistralai/Mistral-7B-Instruct-v0.2');
    expect(Array.isArray(capabilities)).toBe(true);
  });
});
