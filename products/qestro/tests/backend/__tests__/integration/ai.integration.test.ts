import { aiService } from '../../../../backend/src/services/AIService';
import { subscriptionService } from '../../../../backend/src/services/SubscriptionService';
import { cacheService } from '../../../../backend/src/services/CacheService';
import { aiProviderClient } from '../../../../backend/src/services/AIProviderClient';

jest.mock('../../../../backend/src/services/SubscriptionService', () => ({
    subscriptionService: {
        getActiveSubscription: jest.fn(),
        trackUsage: jest.fn(),
    }
}));

jest.mock('../../../../backend/src/services/CacheService', () => ({
    cacheService: {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(true)
    }
}));

jest.mock('../../../../backend/src/services/AIProviderClient', () => ({
    aiProviderClient: {
        openAI: { chat: { completions: { create: jest.fn() } } },
        anthropic: { messages: { create: jest.fn() } },
        huggingFace: { textGeneration: jest.fn() },
        selectModelForPlan: jest.fn(),
        calculateCost: jest.fn().mockReturnValue(0.001),
        executeWithFailover: jest.fn(),
    }
}));

jest.mock('../../../../backend/src/services/AIInsightsService', () => ({
    aiInsightsService: {
        generateAlertMessage: jest.fn(),
        generateTestInsights: jest.fn(),
        generateText: jest.fn(),
        generateContent: jest.fn(),
    }
}));

describe('AIService Integration', () => {
    const userId = 'user_123';

    beforeEach(() => {
        jest.clearAllMocks();
        (cacheService.set as jest.Mock).mockResolvedValue(true);
        (subscriptionService.trackUsage as jest.Mock).mockResolvedValue(undefined);
    });

    describe('Caching behavior', () => {
        it('returns cached response if available', async () => {
            const mockCachedResponse = {
                success: true,
                result: {
                    testCode: 'const x = 1;',
                    framework: 'playwright',
                    platform: 'web',
                    confidence: 0.9,
                    suggestions: []
                },
                model: 'gpt-4-turbo',
                cost: 0.001,
                tokensUsed: 100,
                processingTime: 10
            };

            (cacheService.get as jest.Mock).mockResolvedValueOnce(mockCachedResponse);

            const response = await aiService.processAIRequest({
                userId,
                type: 'test_generation',
                feature: 'test_generation',
                data: { description: 'test', platform: 'web', complexity: 'simple' }
            });

            expect(response).toEqual(mockCachedResponse);
            expect(cacheService.get).toHaveBeenCalled();
            expect(subscriptionService.getActiveSubscription).not.toHaveBeenCalled();
        });
    });

    describe('Fallback behavior', () => {
        it('falls back to Anthropic when OpenAI fails via executeWithFailover', async () => {
            (cacheService.get as jest.Mock).mockResolvedValueOnce(null);
            (subscriptionService.getActiveSubscription as jest.Mock).mockResolvedValueOnce({ planId: 'professional' });
            (aiProviderClient.selectModelForPlan as jest.Mock).mockReturnValue('gpt-4');
            (aiProviderClient.executeWithFailover as jest.Mock).mockResolvedValue({
                content: '{"severity":"high","category":"runtime","suggestedFix":"Fix the null check"}',
                model: 'claude-3-sonnet-20240229',
                tokensUsed: 100,
                cost: 0.003,
            });

            const response = await aiService.processAIRequest({
                userId,
                type: 'bug_analysis',
                feature: 'bug_analysis',
                data: { title: 'Bug', description: 'Error' }
            });

            expect(response.success).toBe(true);
            expect(response.model).toContain('claude');
            expect(aiProviderClient.executeWithFailover).toHaveBeenCalled();
        });
    });
});
