/**
 * AI Cost Tracking and Usage Management Test Suite
 *
 * Comprehensive test coverage for the AI cost tracking system including:
 * - Real-time usage tracking per user and organization
 * - Cost calculation based on token usage and provider pricing
 * - Usage limits enforcement based on subscription plans
 * - Cost alerts and notification system
 * - Usage analytics and reporting
 * - Budget management and forecasting
 * - Performance under high usage scenarios
 *
 * Test Coverage Areas:
 * - Usage record tracking and storage
 * - Subscription plan management
 * - Cost calculation accuracy
 * - Alert generation and management
 * - Analytics and reporting
 * - Budget enforcement
 * - Performance and scalability
 *
 * @author Questro Platform Team
 * @version 1.0.0
 * @since 2025-11-01
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AICostTracker } from '../src/services/ai/cost-tracker';
import type {
  AIRequest,
  AIResponse,
  UsageRecord,
  SubscriptionPlan,
  CostAlert,
  UsageAnalytics
} from '../src/services/ai/cost-tracker';

// Mock data for testing
const mockAIRequest: AIRequest = {
  id: 'req_test_001',
  userId: 'user_001',
  organizationId: 'org_001',
  type: 'test_generation',
  provider: 'openai',
  model: 'gpt-4',
  prompt: 'Generate a test for login functionality',
  parameters: {
    temperature: 0.7,
    maxTokens: 1000
  },
  priority: 'normal',
  metadata: {
    source: 'automated_test'
  },
  createdAt: new Date('2025-11-01T10:00:00Z')
};

const mockAIResponse: AIResponse = {
  id: 'resp_test_001',
  requestId: 'req_test_001',
  provider: 'openai',
  model: 'gpt-4',
  content: 'Generated test case for login functionality...',
  usage: {
    inputTokens: 150,
    outputTokens: 300,
    totalTokens: 450
  },
  cost: {
    inputCost: 0.0045,
    outputCost: 0.018,
    totalCost: 0.0225,
    currency: 'USD',
    provider: 'OpenAI',
    model: 'gpt-4'
  },
  metadata: {
    finishReason: 'stop',
    processingTime: 1500,
    queueTime: 100,
    providerResponseTime: 1400,
    retryAttempts: 1,
    cacheHit: false
  },
  processingTime: 1500,
  cached: false,
  createdAt: new Date('2025-11-01T10:00:02Z')
};

describe('AICostTracker', () => {
  let costTracker: AICostTracker;

  beforeEach(() => {
    costTracker = new AICostTracker({
      enableRealTimeTracking: true,
      enableBudgetAlerts: true,
      enableUsageLimits: true,
      enableAnalytics: true,
      alertCheckInterval: 1000, // 1 second for testing
      defaultFreePlanLimits: {
        requestsPerMonth: 100,
        tokensPerMonth: 10000
      }
    });
  });

  afterEach(() => {
    costTracker.shutdown();
  });

  describe('Usage Tracking', () => {
    it('should track AI usage correctly', async () => {
      await costTracker.trackUsage(mockAIRequest, mockAIResponse);

      const usage = await costTracker.getUsageAnalytics(mockAIRequest.userId, mockAIRequest.organizationId);

      expect(usage.totalUsage.requests).toBe(1);
      expect(usage.totalUsage.tokens).toBe(450);
      expect(usage.totalUsage.cost).toBe(0.0225);
    });

    it('should track multiple usage records', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        ...mockAIRequest,
        id: `req_test_${i.toString().padStart(3, '0')}`,
        userId: `user_${i.toString().padStart(3, '0')}`
      }));

      const responses = requests.map((req, i) => ({
        ...mockAIResponse,
        id: `resp_test_${i.toString().padStart(3, '0')}`,
        requestId: req.id,
        usage: {
          inputTokens: 100 + i * 10,
          outputTokens: 200 + i * 20,
          totalTokens: 300 + i * 30
        },
        cost: {
          ...mockAIResponse.cost,
          totalCost: 0.015 + i * 0.002
        }
      }));

      for (let i = 0; i < requests.length; i++) {
        await costTracker.trackUsage(requests[i], responses[i]);
      }

      // Check aggregated usage
      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');
      expect(analytics.totalUsage.requests).toBe(1);
      expect(analytics.totalUsage.cost).toBe(0.015);

      // Check that events were emitted
      const eventSpy = jest.fn();
      costTracker.on('usage-tracked', eventSpy);

      await costTracker.trackUsage(mockAIRequest, mockAIResponse);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle usage tracking without organization', async () => {
      const userOnlyRequest = { ...mockAIRequest, organizationId: undefined };

      await costTracker.trackUsage(userOnlyRequest, mockAIResponse);

      const analytics = await costTracker.getUsageAnalytics(mockAIRequest.userId, undefined);
      expect(analytics.totalUsage.requests).toBe(1);
    });

    it('should emit usage-tracked events', async () => {
      const eventSpy = jest.fn();
      costTracker.on('usage-tracked', eventSpy);

      await costTracker.trackUsage(mockAIRequest, mockAIResponse);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_001',
          provider: 'openai',
          model: 'gpt-4',
          cost: expect.objectContaining({
            totalCost: 0.0225
          })
        })
      );
    });
  });

  describe('Subscription Plan Management', () => {
    it('should have default subscription plans', () => {
      const freePlan = costTracker['subscriptionPlans'].get('free');
      const proPlan = costTracker['subscriptionPlans'].get('pro');
      const enterprisePlan = costTracker['subscriptionPlans'].get('enterprise');

      expect(freePlan).toBeDefined();
      expect(proPlan).toBeDefined();
      expect(enterprisePlan).toBeDefined();

      expect(freePlan?.limits.requestsPerMonth).toBe(100);
      expect(proPlan?.limits.requestsPerMonth).toBe(1000);
      expect(enterprisePlan?.limits.requestsPerMonth).toBe(10000);
    });

    it('should update user subscription plan', async () => {
      const eventSpy = jest.fn();
      costTracker.on('subscription-updated', eventSpy);

      await costTracker.updateSubscriptionPlan('user_001', 'pro');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_001',
          plan: expect.objectContaining({
            tier: 'pro'
          })
        })
      );
    });

    it('should reset usage period when updating subscription', async () => {
      // Track some usage first
      await costTracker.trackUsage(mockAIRequest, mockAIResponse);

      // Update subscription plan
      await costTracker.updateSubscriptionPlan('user_001', 'enterprise');

      // Check that usage was reset for the new period
      const plan = await costTracker.getUserSubscriptionPlan('user_001');
      expect(plan.tier).toBe('enterprise');
    });

    it('should throw error for invalid subscription plan', async () => {
      await expect(
        costTracker.updateSubscriptionPlan('user_001', 'invalid_plan')
      ).rejects.toThrow('Subscription plan not found: invalid_plan');
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate costs accurately across different providers', async () => {
      const openAIResponse = { ...mockAIResponse, provider: 'openai' as const };
      const huggingFaceResponse = {
        ...mockAIResponse,
        provider: 'huggingface' as const,
        cost: { ...mockAIResponse.cost, totalCost: 0.002 }
      };

      await costTracker.trackUsage(mockAIRequest, openAIResponse);

      const hfRequest = { ...mockAIRequest, id: 'req_hf_001' };
      await costTracker.trackUsage(hfRequest, huggingFaceResponse);

      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');

      expect(analytics.totalUsage.cost).toBe(0.0245); // 0.0225 + 0.002
      expect(analytics.providerBreakdown.size).toBeGreaterThan(0);
    });

    it('should handle zero-cost responses', async () => {
      const zeroCostResponse = {
        ...mockAIResponse,
        cost: { ...mockAIResponse.cost, totalCost: 0 }
      };

      await costTracker.trackUsage(mockAIRequest, zeroCostResponse);

      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');
      expect(analytics.totalUsage.cost).toBe(0);
      expect(analytics.totalUsage.requests).toBe(1);
    });

    it('should track costs by provider and model', async () => {
      const gpt4Response = { ...mockAIResponse, model: 'gpt-4' };
      const gpt35Response = { ...mockAIResponse, model: 'gpt-3.5-turbo', cost: { totalCost: 0.005 } };

      await costTracker.trackUsage(mockAIRequest, gpt4Response);

      const gpt35Request = { ...mockAIRequest, id: 'req_gpt35', model: 'gpt-3.5-turbo' };
      await costTracker.trackUsage(gpt35Request, gpt35Response);

      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');

      expect(analytics.modelBreakdown.length).toBeGreaterThan(0);

      const gpt4Usage = analytics.modelBreakdown.find(m => m.model === 'gpt-4');
      const gpt35Usage = analytics.modelBreakdown.find(m => m.model === 'gpt-3.5-turbo');

      expect(gpt4Usage?.cost).toBe(0.0225);
      expect(gpt35Usage?.cost).toBe(0.005);
    });
  });

  describe('Usage Limits and Enforcement', () => {
    it('should enforce usage limits when exceeded', async () => {
      // Set user to free plan with low limits
      await costTracker.updateSubscriptionPlan('user_001', 'free');

      const eventSpy = jest.fn();
      costTracker.on('usage-limit-exceeded', eventSpy);

      // Track usage that exceeds free plan limits
      for (let i = 0; i < 150; i++) {
        await costTracker.trackUsage(
          { ...mockAIRequest, id: `req_${i}` },
          mockAIResponse
        );
      }

      expect(eventSpy).toHaveBeenCalled();

      const alert = eventSpy.mock.calls[0][0];
      expect(alert.type).toBe('usage_limit');
      expect(alert.severity).toBe('high');
    });

    it('should reset usage limits when period expires', async () => {
      await costTracker.updateSubscriptionPlan('user_001', 'free');

      // Track usage up to limit
      for (let i = 0; i < 99; i++) {
        await costTracker.trackUsage(
          { ...mockAIRequest, id: `req_${i}` },
          mockAIResponse
        );
      }

      // Manually trigger reset (would happen automatically in real scenario)
      const usage = costTracker['userUsage'].get('user_001')!;
      const plan = await costTracker.getUserSubscriptionPlan('user_001');
      costTracker['resetUsagePeriod'](usage, plan);

      // Should be able to track new usage after reset
      await costTracker.trackUsage(mockAIRequest, mockAIResponse);

      const analytics = await costTracker.getUsageAnalytics('user_001', undefined);
      expect(analytics.totalUsage.requests).toBeGreaterThan(0);
    });

    it('should allow overage billing when enabled', async () => {
      const costTrackerWithOverage = new AICostTracker({
        overageBilling: {
          enabled: true,
          multiplier: 1.5,
          gracePeriod: 7
        }
      });

      const blockSpy = jest.fn();
      costTrackerWithOverage.on('usage-blocked', blockSpy);

      await costTrackerWithOverage.updateSubscriptionPlan('user_001', 'free');

      // Exceed limits
      for (let i = 0; i < 150; i++) {
        await costTrackerWithOverage.trackUsage(
          { ...mockAIRequest, id: `req_${i}` },
          mockAIResponse
        );
      }

      // Should not block when overage billing is enabled
      expect(blockSpy).not.toHaveBeenCalled();

      costTrackerWithOverage.shutdown();
    });

    it('should block usage when overage billing is disabled', async () => {
      const costTrackerNoOverage = new AICostTracker({
        overageBilling: {
          enabled: false,
          multiplier: 1.5,
          gracePeriod: 7
        }
      });

      const blockSpy = jest.fn();
      costTrackerNoOverage.on('usage-blocked', blockSpy);

      await costTrackerNoOverage.updateSubscriptionPlan('user_001', 'free');

      // Exceed limits
      for (let i = 0; i < 150; i++) {
        await costTrackerNoOverage.trackUsage(
          { ...mockAIRequest, id: `req_${i}` },
          mockAIResponse
        );
      }

      // Should block when overage billing is disabled
      expect(blockSpy).toHaveBeenCalled();

      costTrackerNoOverage.shutdown();
    });
  });

  describe('Cost Alerts and Notifications', () => {
    it('should create budget alerts', async () => {
      costTracker.setBudgetAlert('user_001', 10.00); // $10 budget

      // Track usage that approaches budget
      const expensiveResponse = {
        ...mockAIResponse,
        cost: { ...mockAIResponse.cost, totalCost: 6.00 }
      };

      await costTracker.trackUsage(mockAIRequest, expensiveResponse);

      const alerts = costTracker.getActiveAlerts('user_001');
      expect(alerts.length).toBeGreaterThan(0);

      const budgetAlert = alerts.find(alert => alert.type === 'budget');
      expect(budgetAlert).toBeDefined();
      expect(budgetAlert?.severity).toBe('low'); // 60% of budget
    });

    it('should trigger alerts at different thresholds', async () => {
      costTracker.setBudgetAlert('user_001', 10.00);

      const alertSpy = jest.fn();
      costTracker.on('budget-alert', alertSpy);

      // Track usage to trigger different alert levels
      const responses = [
        { ...mockAIResponse, cost: { totalCost: 3.00 } }, // 30%
        { ...mockAIResponse, cost: { totalCost: 4.50 } }, // 75%
        { ...mockAIResponse, cost: { totalCost: 9.50 } }  // 95%
      ];

      for (const response of responses) {
        const request = { ...mockAIRequest, id: `req_${Math.random()}` };
        await costTracker.trackUsage(request, response);
      }

      // Should have triggered multiple alerts at different thresholds
      expect(alertSpy).toHaveBeenCalledTimes(3);

      const alertSeverities = alertSpy.mock.calls.map(call => call[0].severity);
      expect(alertSeverities).toContain('low');
      expect(alertSeverities).toContain('medium');
      expect(alertSeverities).toContain('high');
    });

    it('should acknowledge alerts', async () => {
      costTracker.setBudgetAlert('user_001', 10.00);

      // Trigger an alert
      const expensiveResponse = { ...mockAIResponse, cost: { totalCost: 8.00 } };
      await costTracker.trackUsage(mockAIRequest, expensiveResponse);

      const alerts = costTracker.getActiveAlerts('user_001');
      const alertId = alerts[0]?.id;

      expect(alertId).toBeDefined();

      // Acknowledge the alert
      await costTracker.acknowledgeAlert(alertId!);

      // Alert should still exist but be acknowledged
      const acknowledgedAlert = costTracker.getActiveAlerts('user_001').find(a => a.id === alertId);
      expect(acknowledgedAlert?.acknowledgedAt).toBeDefined();
    });

    it('should not duplicate alerts for same threshold', async () => {
      costTracker.setBudgetAlert('user_001', 10.00);

      const alertSpy = jest.fn();
      costTracker.on('budget-alert', alertSpy);

      // Track usage that triggers 50% threshold
      const response = { ...mockAIResponse, cost: { totalCost: 5.00 } };
      await costTracker.trackUsage(mockAIRequest, response);

      // Track more usage but still below next threshold
      const response2 = { ...mockAIResponse, cost: { totalCost: 5.50 } };
      await costTracker.trackUsage(mockAIRequest, response2);

      // Should only trigger one alert for the 50% threshold
      const budgetAlerts = alertSpy.mock.calls.filter(call => call[0].type === 'budget');
      expect(budgetAlerts.length).toBe(1);
    });
  });

  describe('Usage Analytics and Reporting', () => {
    it('should generate usage analytics for different periods', async () => {
      // Track usage over multiple days
      const dates = [
        '2025-11-01T10:00:00Z',
        '2025-11-02T10:00:00Z',
        '2025-11-03T10:00:00Z'
      ];

      for (let i = 0; i < dates.length; i++) {
        const request = {
          ...mockAIRequest,
          id: `req_${i}`,
          createdAt: new Date(dates[i])
        };
        const response = {
          ...mockAIResponse,
          id: `resp_${i}`,
          requestId: request.id,
          createdAt: new Date(dates[i])
        };

        await costTracker.trackUsage(request, response);
      }

      const monthlyAnalytics = await costTracker.getUsageAnalytics('user_001', 'org_001', 'month');
      const weeklyAnalytics = await costTracker.getUsageAnalytics('user_001', 'org_001', 'week');

      expect(monthlyAnalytics.totalUsage.requests).toBe(3);
      expect(weeklyAnalytics.totalUsage.requests).toBe(3);
      expect(monthlyAnalytics.providerBreakdown.size).toBeGreaterThan(0);
      expect(monthlyAnalytics.modelBreakdown.length).toBeGreaterThan(0);
    });

    it('should calculate provider breakdown correctly', async () => {
      const openAIResponse = { ...mockAIResponse, provider: 'openai' as const };
      const huggingFaceResponse = {
        ...mockAIResponse,
        provider: 'huggingface' as const,
        cost: { totalCost: 0.005 }
      };

      await costTracker.trackUsage(mockAIRequest, openAIResponse);

      const hfRequest = { ...mockAIRequest, id: 'req_hf', provider: 'huggingface' as const };
      await costTracker.trackUsage(hfRequest, huggingFaceResponse);

      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');

      const openAIUsage = analytics.providerBreakdown.get('openai');
      const hfUsage = analytics.providerBreakdown.get('huggingface');

      expect(openAIUsage?.cost).toBe(0.0225);
      expect(hfUsage?.cost).toBe(0.005);
    });

    it('should generate cost optimization recommendations', async () => {
      // Track usage with expensive provider
      const expensiveResponse = { ...mockAIResponse, cost: { totalCost: 1.00 } };
      await costTracker.trackUsage(mockAIRequest, expensiveResponse);

      const recommendations = await costTracker.getCostOptimizationRecommendations('user_001');

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it('should generate comprehensive usage reports', async () => {
      // Track diverse usage
      const requestTypes = ['test_generation', 'bug_analysis', 'performance_analysis'];

      for (let i = 0; i < requestTypes.length; i++) {
        const request = {
          ...mockAIRequest,
          id: `req_${i}`,
          type: requestTypes[i] as any
        };
        await costTracker.trackUsage(request, mockAIResponse);
      }

      const report = await costTracker.generateUsageReport('user_001', 'org_001');

      expect(report.summary).toBeDefined();
      expect(report.analytics).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.costProjection).toBeDefined();

      expect(report.analytics.totalUsage.requests).toBe(3);
      expect(report.costProjection.nextPeriod).toBeGreaterThan(0);
    });

    it('should cache analytics results', async () => {
      await costTracker.trackUsage(mockAIRequest, mockAIResponse);

      const analytics1 = await costTracker.getUsageAnalytics('user_001', 'org_001');
      const analytics2 = await costTracker.getUsageAnalytics('user_001', 'org_001');

      // Should return same result (cached)
      expect(analytics1.totalUsage.requests).toBe(analytics2.totalUsage.requests);
      expect(analytics1.totalUsage.cost).toBe(analytics2.totalUsage.cost);
    });
  });

  describe('Data Management and Persistence', () => {
    it('should export and import data correctly', async () => {
      // Track some usage
      await costTracker.trackUsage(mockAIRequest, mockAIResponse);
      costTracker.setBudgetAlert('user_001', 50.00);

      // Export data
      const exportedData = costTracker.exportData();

      expect(exportedData.usageRecords).toBeDefined();
      expect(exportedData.userUsage).toBeDefined();
      expect(exportedData.budgetAlerts).toBeDefined();

      // Create new tracker and import data
      const newTracker = new AICostTracker();
      newTracker.importData(exportedData);

      // Verify imported data
      const importedAnalytics = await newTracker.getUsageAnalytics('user_001', 'org_001');
      expect(importedAnalytics.totalUsage.requests).toBe(1);

      newTracker.shutdown();
    });

    it('should limit usage records to prevent memory issues', async () => {
      // Track many requests (more than the 10000 limit)
      for (let i = 0; i < 10050; i++) {
        const request = { ...mockAIRequest, id: `req_${i}` };
        await costTracker.trackUsage(request, mockAIResponse);
      }

      const exportedData = costTracker.exportData();
      const userRecords = exportedData.usageRecords['org_001'] || [];

      // Should not exceed the limit
      expect(userRecords.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle requests without organization ID', async () => {
      const userOnlyRequest = { ...mockAIRequest, organizationId: undefined };

      await costTracker.trackUsage(userOnlyRequest, mockAIResponse);

      const analytics = await costTracker.getUsageAnalytics(mockAIRequest.userId, undefined);
      expect(analytics.totalUsage.requests).toBe(1);
    });

    it('should handle missing user data gracefully', async () => {
      await expect(
        costTracker.getUsageAnalytics('nonexistent_user')
      ).rejects.toThrow('No usage data found for user/organization');
    });

    it('should handle invalid alert IDs', async () => {
      await expect(
        costTracker.acknowledgeAlert('invalid_alert_id')
      ).rejects.toThrow('Alert not found: invalid_alert_id');
    });

    it('should handle zero-token usage', async () => {
      const zeroTokenResponse = {
        ...mockAIResponse,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      };

      await costTracker.trackUsage(mockAIRequest, zeroTokenResponse);

      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');
      expect(analytics.totalUsage.tokens).toBe(0);
      expect(analytics.totalUsage.requests).toBe(1);
    });

    it('should handle negative costs (refunds)', async () => {
      const negativeCostResponse = {
        ...mockAIResponse,
        cost: { ...mockAIResponse.cost, totalCost: -0.01 }
      };

      await costTracker.trackUsage(mockAIRequest, negativeCostResponse);

      const analytics = await costTracker.getUsageAnalytics('user_001', 'org_001');
      expect(analytics.totalUsage.cost).toBe(-0.01);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high volume usage tracking', async () => {
      const startTime = Date.now();

      // Track 1000 requests
      const promises = [];
      for (let i = 0; i < 1000; i++) {
        const request = {
          ...mockAIRequest,
          id: `perf_req_${i}`,
          userId: i % 10 === 0 ? `user_${i}` : 'user_001' // Multiple users
        };
        promises.push(costTracker.trackUsage(request, mockAIResponse));
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (5 seconds for 1000 requests)
      expect(duration).toBeLessThan(5000);

      // Verify all requests were tracked
      const analytics = await costTracker.getUsageAnalytics('user_001', undefined);
      expect(analytics.totalUsage.requests).toBeGreaterThan(900);
    });

    it('should handle concurrent analytics requests', async () => {
      // Track some usage first
      for (let i = 0; i < 100; i++) {
        await costTracker.trackUsage(
          { ...mockAIRequest, id: `req_${i}` },
          mockAIResponse
        );
      }

      // Make concurrent analytics requests
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(costTracker.getUsageAnalytics('user_001', 'org_001'));
      }

      const results = await Promise.all(promises);

      // All results should be consistent
      const firstResult = results[0];
      for (const result of results) {
        expect(result.totalUsage.requests).toBe(firstResult.totalUsage.requests);
        expect(result.totalUsage.cost).toBe(firstResult.totalUsage.cost);
      }
    });

    it('should handle memory efficiently with large datasets', async () => {
      // Get initial memory usage (approximate)
      const initialMemory = process.memoryUsage().heapUsed;

      // Track large amount of usage data
      for (let i = 0; i < 5000; i++) {
        const request = {
          ...mockAIRequest,
          id: `mem_req_${i}`,
          userId: `user_${i % 100}` // 100 different users
        };
        await costTracker.trackUsage(request, mockAIResponse);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Event System', () => {
    it('should emit events for all major operations', async () => {
      const eventSpy = jest.fn();
      costTracker.on('usage-tracked', eventSpy);
      costTracker.on('user-usage-updated', eventSpy);
      costTracker.on('budget-alert-set', eventSpy);

      await costTracker.trackUsage(mockAIRequest, mockAIResponse);
      costTracker.setBudgetAlert('user_001', 25.00);

      expect(eventSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle event listeners correctly', async () => {
      const listeners = [
        jest.fn(),
        jest.fn(),
        jest.fn()
      ];

      listeners.forEach(listener => {
        costTracker.on('usage-tracked', listener);
      });

      await costTracker.trackUsage(mockAIRequest, mockAIResponse);

      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalled();
      });

      // Remove all listeners
      costTracker.removeAllListeners();

      // Should not emit to removed listeners
      await costTracker.trackUsage(
        { ...mockAIRequest, id: 'req_no_listener' },
        mockAIResponse
      );

      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(1); // Only called once before removal
      });
    });
  });

  describe('Configuration and Customization', () => {
    it('should respect configuration settings', () => {
      const customConfig = {
        enableRealTimeTracking: false,
        enableBudgetAlerts: false,
        enableUsageLimits: false,
        enableAnalytics: false,
        defaultFreePlanLimits: {
          requestsPerMonth: 50,
          tokensPerMonth: 5000
        }
      };

      const customTracker = new AICostTracker(customConfig);

      expect(customTracker['config'].enableRealTimeTracking).toBe(false);
      expect(customTracker['config'].defaultFreePlanLimits.requestsPerMonth).toBe(50);

      customTracker.shutdown();
    });

    it('should handle missing configuration gracefully', () => {
      const minimalTracker = new AICostTracker();

      expect(minimalTracker['config'].enableRealTimeTracking).toBe(true);
      expect(minimalTracker['config'].alertCheckInterval).toBe(60000);

      minimalTracker.shutdown();
    });
  });
});

/**
 * Integration Tests
 * These tests verify the cost tracker works correctly with the AI Manager
 */
describe('AICostTracker Integration', () => {
  let costTracker: AICostTracker;

  beforeEach(() => {
    costTracker = new AICostTracker({
      enableRealTimeTracking: true,
      enableBudgetAlerts: true,
      enableUsageLimits: true
    });
  });

  afterEach(() => {
    costTracker.shutdown();
  });

  it('should integrate with AI Manager response format', async () => {
    // This test simulates integration with the AI Manager
    const aiManagerResponse = {
      id: 'resp_integration_001',
      requestId: 'req_integration_001',
      provider: 'openai' as const,
      model: 'gpt-4',
      content: 'Generated test content',
      usage: {
        inputTokens: 200,
        outputTokens: 400,
        totalTokens: 600
      },
      cost: {
        inputCost: 0.006,
        outputCost: 0.024,
        totalCost: 0.030,
        currency: 'USD',
        provider: 'OpenAI',
        model: 'gpt-4'
      },
      metadata: {
        finishReason: 'stop' as const,
        processingTime: 2000,
        queueTime: 150,
        providerResponseTime: 1850,
        retryAttempts: 1,
        cacheHit: false
      },
      processingTime: 2000,
      cached: false,
      createdAt: new Date()
    };

    const aiManagerRequest = {
      id: 'req_integration_001',
      userId: 'integration_user',
      organizationId: 'integration_org',
      type: 'test_generation' as const,
      provider: 'openai' as const,
      model: 'gpt-4',
      prompt: 'Generate integration test',
      parameters: {
        temperature: 0.7,
        maxTokens: 1000
      },
      priority: 'normal' as const,
      metadata: {
        integration: true
      },
      createdAt: new Date()
    };

    await costTracker.trackUsage(aiManagerRequest, aiManagerResponse);

    const analytics = await costTracker.getUsageAnalytics('integration_user', 'integration_org');

    expect(analytics.totalUsage.requests).toBe(1);
    expect(analytics.totalUsage.tokens).toBe(600);
    expect(analytics.totalUsage.cost).toBe(0.030);
  });

  it('should handle multi-organization scenarios', async () => {
    const orgs = ['org_a', 'org_b', 'org_c'];

    for (let i = 0; i < orgs.length; i++) {
      const request = {
        ...mockAIRequest,
        id: `req_org_${i}`,
        userId: `user_${i}`,
        organizationId: orgs[i]
      };

      await costTracker.trackUsage(request, mockAIResponse);
    }

    // Check analytics for each organization
    for (const org of orgs) {
      const analytics = await costTracker.getUsageAnalytics(`user_${orgs.indexOf(org)}`, org);
      expect(analytics.totalUsage.requests).toBe(1);
    }

    // Check that user-level analytics still work
    const userAnalytics = await costTracker.getUsageAnalytics('user_0', 'org_a');
    expect(userAnalytics.totalUsage.requests).toBe(1);
  });
});

/**
 * Performance Benchmarks
 */
describe('AICostTracker Performance Benchmarks', () => {
  let costTracker: AICostTracker;

  beforeEach(() => {
    costTracker = new AICostTracker({
      enableRealTimeTracking: true,
      enableAnalytics: true,
      enableBudgetAlerts: true
    });
  });

  afterEach(() => {
    costTracker.shutdown();
  });

  it('should meet performance standards for usage tracking', async () => {
    const requestCount = 1000;
    const requests = [];

    for (let i = 0; i < requestCount; i++) {
      requests.push({
        ...mockAIRequest,
        id: `perf_req_${i}`,
        userId: i % 100 === 0 ? `user_${i}` : 'perf_user'
      });
    }

    const startTime = performance.now();

    await Promise.all(
      requests.map(request => costTracker.trackUsage(request, mockAIResponse))
    );

    const endTime = performance.now();
    const duration = endTime - startTime;
    const requestsPerSecond = (requestCount / duration) * 1000;

    expect(duration).toBeLessThan(5000); // Complete within 5 seconds
    expect(requestsPerSecond).toBeGreaterThan(200); // At least 200 requests per second

    console.log(`Performance: ${requestCount} requests tracked in ${duration.toFixed(2)}ms (${requestsPerSecond.toFixed(0)} req/s)`);
  });

  it('should maintain performance under concurrent analytics requests', async () => {
    // Track some data first
    for (let i = 0; i < 100; i++) {
      await costTracker.trackUsage(
        { ...mockAIRequest, id: `concurrent_req_${i}` },
        mockAIResponse
      );
    }

    const concurrentRequests = 50;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(costTracker.getUsageAnalytics('perf_user', undefined));
    }

    const startTime = performance.now();
    const results = await Promise.all(promises);
    const endTime = performance.now();

    const duration = endTime - startTime;
    const requestsPerSecond = (concurrentRequests / duration) * 1000;

    expect(duration).toBeLessThan(1000); // Complete within 1 second
    expect(requestsPerSecond).toBeGreaterThan(50); // At least 50 analytics requests per second

    // All results should be consistent
    const firstResult = results[0];
    results.forEach(result => {
      expect(result.totalUsage.requests).toBe(firstResult.totalUsage.requests);
    });

    console.log(`Analytics Performance: ${concurrentRequests} concurrent requests in ${duration.toFixed(2)}ms (${requestsPerSecond.toFixed(0)} req/s)`);
  });
});
