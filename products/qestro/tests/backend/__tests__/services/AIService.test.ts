import { jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;
const mockExecuteWithFailover = jest.fn<AnyFn>();
const mockSelectModelForPlan = jest.fn<AnyFn>();
const mockCalculateCost = jest.fn<AnyFn>();
const mockHfTextGen = jest.fn<AnyFn>();
jest.mock('../../../../backend/src/services/AIProviderClient.js', () => ({
  aiProviderClient: {
    executeWithFailover: mockExecuteWithFailover, selectModelForPlan: mockSelectModelForPlan,
    calculateCost: mockCalculateCost, huggingFace: { textGeneration: mockHfTextGen },
    openAI: {}, anthropic: {},
  },
}));

const mockCacheGet = jest.fn<AnyFn>();
const mockCacheSet = jest.fn<AnyFn>();
jest.mock('../../../../backend/src/services/CacheService.js', () => ({
  cacheService: { get: mockCacheGet, set: mockCacheSet },
}));

const mockGetActiveSub = jest.fn<AnyFn>();
const mockTrackUsage = jest.fn<AnyFn>();
jest.mock('../../../../backend/src/services/SubscriptionService.js', () => ({
  subscriptionService: { getActiveSubscription: mockGetActiveSub, trackUsage: mockTrackUsage },
}));

jest.mock('../../../../backend/src/services/AIInsightsService.js', () => ({
  aiInsightsService: {
    generateAlertMessage: jest.fn(), generateTestInsights: jest.fn(),
    generateText: jest.fn(), generateContent: jest.fn(),
  },
}));

const mockBuildTestPrompt = jest.fn<AnyFn>();
const mockBuildBugPrompt = jest.fn<AnyFn>();
jest.mock('../../../../backend/src/services/AIPromptBuilder.js', () => ({
  buildTestGenerationPrompt: mockBuildTestPrompt, buildBugAnalysisPrompt: mockBuildBugPrompt,
  buildPerformanceAnalysisPrompt: jest.fn(() => 'perf-prompt'),
  buildCodeOptimizationPrompt: jest.fn(() => 'code-prompt'),
}));

const mockCalcConfidence = jest.fn<AnyFn>();
const mockExtractSuggestions = jest.fn<AnyFn>();
const mockParseBugAnalysis = jest.fn<AnyFn>();
const mockEstimateSeverity = jest.fn<AnyFn>();
jest.mock('../../../../backend/src/services/AIResponseParser.js', () => ({
  calculateConfidence: mockCalcConfidence, extractSuggestions: mockExtractSuggestions,
  parseBugAnalysis: mockParseBugAnalysis, estimateSeverity: mockEstimateSeverity,
  parsePerformanceAnalysis: jest.fn(() => ({ bottlenecks: [] })),
  extractImprovements: jest.fn(() => []), estimatePerformanceGain: jest.fn(() => 0.2),
}));

jest.mock('../../../../backend/src/utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { AIService } from '../../../../backend/src/services/AIService.js';
import type { AIRequest } from '../../../../backend/src/services/AIService.js';

describe('AIService', () => {
  let service: AIService;
  const makeRequest = (overrides: Partial<AIRequest> = {}): AIRequest => ({
    userId: 'user-1', type: 'test_generation', feature: 'test_gen',
    data: { description: 'Login test', platform: 'web', complexity: 'simple' },
    ...overrides,
  });

  beforeEach(() => {
    service = new AIService();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(true);
    mockTrackUsage.mockResolvedValue(undefined);
    mockBuildTestPrompt.mockReturnValue('test-prompt');
    mockBuildBugPrompt.mockReturnValue('bug-prompt');
    mockCalcConfidence.mockReturnValue(0.9);
    mockExtractSuggestions.mockReturnValue(['suggestion1']);
    mockParseBugAnalysis.mockReturnValue({ severity: 'high', category: 'functional' });
    mockEstimateSeverity.mockReturnValue('medium');
  });

  it('should call executeWithFailover for paid plans on test_generation', async () => {
    mockGetActiveSub.mockResolvedValue({ planId: 'professional' });
    mockSelectModelForPlan.mockReturnValue('gpt-4-turbo');
    mockExecuteWithFailover.mockResolvedValue({
      content: 'test code here function test', model: 'gpt-4-turbo',
      tokensUsed: 500, cost: 0.005,
    });
    const result = await service.processAIRequest(makeRequest());
    expect(result.success).toBe(true);
    expect(result.model).toBe('gpt-4-turbo');
    expect(mockExecuteWithFailover).toHaveBeenCalledWith(
      expect.stringContaining('QA engineer'), 'test-prompt', 'gpt-4-turbo',
    );
  });

  it('should use basic analysis for free plan on bug_analysis', async () => {
    mockGetActiveSub.mockResolvedValue(null);
    mockSelectModelForPlan.mockReturnValue('basic-analysis');
    const result = await service.processAIRequest(makeRequest({
      type: 'bug_analysis', feature: 'bug',
      data: { title: 'Crash', description: 'App crashes on load' },
    }));
    expect(result.success).toBe(true);
    expect(result.model).toBe('basic-analysis');
    expect(result.cost).toBe(0);
    expect(mockExecuteWithFailover).not.toHaveBeenCalled();
  });

  it('should return success false when dispatch throws an error', async () => {
    mockGetActiveSub.mockResolvedValue({ planId: 'starter' });
    mockSelectModelForPlan.mockReturnValue('gpt-3.5-turbo');
    mockExecuteWithFailover.mockRejectedValue(new Error('Provider unavailable'));
    const result = await service.processAIRequest(makeRequest());
    expect(result.success).toBe(false);
    expect(result.result).toEqual({ error: 'Provider unavailable' });
    expect(result.cost).toBe(0);
    expect(result.model).toBe('none');
  });

  it('should check AI limits and reject when limit check fails', async () => {
    mockGetActiveSub.mockRejectedValue(new Error('DB connection lost'));
    const result = await service.processAIRequest(makeRequest());
    expect(result.success).toBe(false);
    expect(result.result).toEqual({ error: 'AI feature limit exceeded for current plan' });
  });

  it('should track usage after a successful request', async () => {
    mockGetActiveSub.mockResolvedValue({ planId: 'starter' });
    mockSelectModelForPlan.mockReturnValue('gpt-3.5-turbo');
    mockExecuteWithFailover.mockResolvedValue({
      content: 'generated test function test', model: 'gpt-3.5-turbo',
      tokensUsed: 200, cost: 0.002,
    });
    await service.processAIRequest(makeRequest());
    expect(mockTrackUsage).toHaveBeenCalledWith('user-1', 'api', expect.any(Number));
  });

  it('should reject free plan users for performance_analysis', async () => {
    mockGetActiveSub.mockResolvedValue(null);
    mockSelectModelForPlan.mockReturnValue('none');
    const result = await service.processAIRequest(makeRequest({
      type: 'performance_analysis', feature: 'perf',
      data: { metrics: [], timeRange: '24h', platform: 'web' },
    }));
    expect(result.success).toBe(false);
    expect(result.result).toEqual({ error: expect.stringContaining('paid plan') });
  });

  it('should return cached response when available', async () => {
    const cached = {
      success: true, result: { testCode: 'cached' },
      cost: 0, model: 'gpt-4', processingTime: 10,
    };
    mockCacheGet.mockResolvedValue(cached);
    const result = await service.processAIRequest(makeRequest());
    expect(result).toEqual(cached);
    expect(mockExecuteWithFailover).not.toHaveBeenCalled();
  });

  it('should cache the response after a successful request', async () => {
    mockGetActiveSub.mockResolvedValue({ planId: 'professional' });
    mockSelectModelForPlan.mockReturnValue('gpt-4-turbo');
    mockExecuteWithFailover.mockResolvedValue({
      content: 'test function test code', model: 'gpt-4-turbo',
      tokensUsed: 300, cost: 0.003,
    });
    await service.processAIRequest(makeRequest());
    expect(mockCacheSet).toHaveBeenCalledWith(
      { key: expect.stringContaining('ai:user-1:'), ttl: 86400 },
      expect.objectContaining({ success: true }),
    );
  });

  it('should expose delegated insight methods', () => {
    expect(typeof service.generateAlertMessage).toBe('function');
    expect(typeof service.generateTestInsights).toBe('function');
    expect(typeof service.generateText).toBe('function');
    expect(typeof service.generateContent).toBe('function');
  });
});
