/**
 * Questro AI Cost Tracker and Usage Management System
 *
 * This comprehensive system provides:
 * - Real-time usage tracking per user and organization
 * - Cost calculation based on token usage and provider pricing
 * - Usage limits enforcement based on subscription plans
 * - Cost alerts and notification system
 * - Usage analytics and reporting dashboard
 * - Budget management and forecasting
 * - Cost optimization recommendations
 *
 * @author Questro Platform Team
 * @version 2.0.0
 * @since 2025-11-01
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import type { AIProviderType, AIRequest, AIResponse, TokenUsage, CostBreakdown } from './ai-manager';

// Usage and Cost Tracking Types
export interface UsageRecord {
  id: string;
  userId: string;
  organizationId?: string;
  provider: AIProviderType;
  model: string;
  requestType: string;
  usage: TokenUsage;
  cost: CostBreakdown;
  timestamp: Date;
  metadata: {
    duration: number;
    cached: boolean;
    success: boolean;
    errorCode?: string;
    requestId: string;
  };
}

export interface UserUsage {
  userId: string;
  organizationId?: string;
  currentPeriod: {
    requests: number;
    tokens: number;
    cost: number;
    lastReset: Date;
    resetDate: Date;
  };
  totalUsage: {
    requests: number;
    tokens: number;
    cost: number;
    startDate: Date;
  };
  byProvider: Map<AIProviderType, ProviderUsage>;
  byModel: Map<string, ModelUsage>;
  byRequestType: Map<string, RequestTypeUsage>;
  dailyUsage: DailyUsage[];
  alerts: CostAlert[];
}

export interface ProviderUsage {
  provider: AIProviderType;
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
  successRate: number;
  errors: number;
}

export interface ModelUsage {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
  quality: number;
}

export interface RequestTypeUsage {
  requestType: string;
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
  successRate: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  uniqueUsers: number;
  byProvider: Map<AIProviderType, number>;
  topModels: Array<{ model: string; usage: number }>;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise' | 'custom';
  limits: {
    requestsPerMonth: number;
    tokensPerMonth: number;
    costPerMonth: number;
    includedModels: string[];
    features: string[];
  };
  overage: {
    requestPrice: number;
    tokenPrice: number;
    billingInterval: 'monthly' | 'yearly';
  };
}

export interface CostAlert {
  id: string;
  userId: string;
  organizationId?: string;
  type: 'budget' | 'usage_limit' | 'cost_spike' | 'daily_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface BudgetAlert {
  userId: string;
  organizationId?: string;
  budgetLimit: number;
  currentSpend: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  alertThresholds: number[]; // Percentages for alerts (e.g., [50, 75, 90, 100])
}

export interface UsageAnalytics {
  period: 'hour' | 'day' | 'week' | 'month' | 'year';
  startDate: Date;
  endDate: Date;
  totalUsage: {
    requests: number;
    tokens: number;
    cost: number;
  };
  userBreakdown: Array<{
    userId: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  providerBreakdown: Map<AIProviderType, ProviderUsage>;
  modelBreakdown: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
    avgResponseTime: number;
  }>;
  requestTypeBreakdown: Map<string, RequestTypeUsage>;
  trends: {
    costGrowth: number;
    usageGrowth: number;
    efficiencyImprovement: number;
  };
  predictions: {
    nextMonthCost: number;
    nextMonthUsage: number;
    recommendedActions: string[];
  };
}

export interface CostTrackerConfig {
  enableRealTimeTracking: boolean;
  enableBudgetAlerts: boolean;
  enableUsageLimits: boolean;
  enableAnalytics: boolean;
  alertCheckInterval: number; // milliseconds
  analyticsRetentionPeriod: number; // days
  defaultFreePlanLimits: {
    requestsPerMonth: number;
    tokensPerMonth: number;
  };
  overageBilling: {
    enabled: boolean;
    multiplier: number;
    gracePeriod: number; // days
  };
}

/**
 * Main AI Cost Tracker class
 */
export class AICostTracker extends EventEmitter {
  private usageRecords: Map<string, UsageRecord[]> = new Map();
  private userUsage: Map<string, UserUsage> = new Map();
  private organizationUsage: Map<string, UserUsage[]> = new Map();
  private subscriptionPlans: Map<string, SubscriptionPlan> = new Map();
  private costAlerts: Map<string, CostAlert[]> = new Map();
  private budgetAlerts: Map<string, BudgetAlert> = new Map();
  private analyticsCache: Map<string, UsageAnalytics> = new Map();
  private config: CostTrackerConfig;
  private alertTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CostTrackerConfig> = {}) {
    super();

    this.config = {
      enableRealTimeTracking: true,
      enableBudgetAlerts: true,
      enableUsageLimits: true,
      enableAnalytics: true,
      alertCheckInterval: 60000, // 1 minute
      analyticsRetentionPeriod: 365,
      defaultFreePlanLimits: {
        requestsPerMonth: 100,
        tokensPerMonth: 10000
      },
      overageBilling: {
        enabled: true,
        multiplier: 1.5,
        gracePeriod: 7
      },
      ...config
    };

    this.initializeSubscriptionPlans();
    this.setupAlertMonitoring();
  }

  /**
   * Initialize default subscription plans
   */
  private initializeSubscriptionPlans(): void {
    const freePlan: SubscriptionPlan = {
      id: 'free',
      name: 'Free Tier',
      tier: 'free',
      limits: {
        requestsPerMonth: 100,
        tokensPerMonth: 10000,
        costPerMonth: 0,
        includedModels: ['gpt-3.5-turbo'],
        features: ['basic-test-generation', 'bug-analysis']
      },
      overage: {
        requestPrice: 0.01,
        tokenPrice: 0.000002,
        billingInterval: 'monthly'
      }
    };

    const proPlan: SubscriptionPlan = {
      id: 'pro',
      name: 'Professional',
      tier: 'pro',
      limits: {
        requestsPerMonth: 1000,
        tokensPerMonth: 100000,
        costPerMonth: 29,
        includedModels: ['gpt-3.5-turbo', 'gpt-4', 'mistral-7b'],
        features: ['advanced-test-generation', 'performance-analysis', 'code-optimization']
      },
      overage: {
        requestPrice: 0.008,
        tokenPrice: 0.0000015,
        billingInterval: 'monthly'
      }
    };

    const enterprisePlan: SubscriptionPlan = {
      id: 'enterprise',
      name: 'Enterprise',
      tier: 'enterprise',
      limits: {
        requestsPerMonth: 10000,
        tokensPerMonth: 1000000,
        costPerMonth: 299,
        includedModels: ['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'llama-2-70b'],
        features: ['all-features', 'priority-support', 'custom-models', 'advanced-analytics']
      },
      overage: {
        requestPrice: 0.005,
        tokenPrice: 0.000001,
        billingInterval: 'monthly'
      }
    };

    this.subscriptionPlans.set('free', freePlan);
    this.subscriptionPlans.set('pro', proPlan);
    this.subscriptionPlans.set('enterprise', enterprisePlan);
  }

  /**
   * Track AI usage and cost for a request
   */
  async trackUsage(request: AIRequest, response: AIResponse): Promise<void> {
    if (!this.config.enableRealTimeTracking) return;

    const usageRecord: UsageRecord = {
      id: this.generateUsageId(),
      userId: request.userId,
      organizationId: request.organizationId,
      provider: response.provider,
      model: response.model,
      requestType: request.type,
      usage: response.usage,
      cost: response.cost,
      timestamp: new Date(),
      metadata: {
        duration: response.processingTime,
        cached: response.cached,
        success: true,
        requestId: request.id
      }
    };

    // Store usage record
    this.storeUsageRecord(usageRecord);

    // Update user usage
    await this.updateUserUsage(request.userId, request.organizationId, usageRecord);

    // Check usage limits
    if (this.config.enableUsageLimits) {
      await this.checkUsageLimits(request.userId, request.organizationId);
    }

    // Check budget alerts
    if (this.config.enableBudgetAlerts) {
      await this.checkBudgetAlerts(request.userId, request.organizationId);
    }

    // Emit events for real-time monitoring
    this.emit('usage-tracked', usageRecord);
  }

  /**
   * Store usage record
   */
  private storeUsageRecord(record: UsageRecord): void {
    const key = record.organizationId || record.userId;

    if (!this.usageRecords.has(key)) {
      this.usageRecords.set(key, []);
    }

    const records = this.usageRecords.get(key)!;
    records.push(record);

    // Keep only last 10000 records per user/organization
    if (records.length > 10000) {
      records.splice(0, records.length - 10000);
    }
  }

  /**
   * Update user usage statistics
   */
  private async updateUserUsage(userId: string, organizationId: string | undefined, record: UsageRecord): Promise<void> {
    const key = organizationId || userId;

    if (!this.userUsage.has(key)) {
      this.userUsage.set(key, this.createUserUsage(userId, organizationId));
    }

    const usage = this.userUsage.get(key)!;

    // Update current period usage
    usage.currentPeriod.requests++;
    usage.currentPeriod.tokens += record.usage.totalTokens;
    usage.currentPeriod.cost += record.cost.totalCost;

    // Update total usage
    usage.totalUsage.requests++;
    usage.totalUsage.tokens += record.usage.totalTokens;
    usage.totalUsage.cost += record.cost.totalCost;

    // Update provider breakdown
    if (!usage.byProvider.has(record.provider)) {
      usage.byProvider.set(record.provider, this.createProviderUsage(record.provider));
    }
    const providerUsage = usage.byProvider.get(record.provider)!;
    providerUsage.requests++;
    providerUsage.tokens += record.usage.totalTokens;
    providerUsage.cost += record.cost.totalCost;
    providerUsage.averageResponseTime = (providerUsage.averageResponseTime + record.metadata.duration) / 2;

    // Update model breakdown
    if (!usage.byModel.has(record.model)) {
      usage.byModel.set(record.model, this.createModelUsage(record.model));
    }
    const modelUsage = usage.byModel.get(record.model)!;
    modelUsage.requests++;
    modelUsage.tokens += record.usage.totalTokens;
    modelUsage.cost += record.cost.totalCost;

    // Update request type breakdown
    if (!usage.byRequestType.has(record.requestType)) {
      usage.byRequestType.set(record.requestType, this.createRequestTypeUsage(record.requestType));
    }
    const requestTypeUsage = usage.byRequestType.get(record.requestType)!;
    requestTypeUsage.requests++;
    requestTypeUsage.tokens += record.usage.totalTokens;
    requestTypeUsage.cost += record.cost.totalCost;

    // Update daily usage
    this.updateDailyUsage(usage, record);

    // Emit usage update event
    this.emit('user-usage-updated', { userId, organizationId, usage, record });
  }

  /**
   * Check if user has exceeded usage limits
   */
  private async checkUsageLimits(userId: string, organizationId: string | undefined): Promise<void> {
    const key = organizationId || userId;
    const usage = this.userUsage.get(key);

    if (!usage) return;

    const plan = await this.getUserSubscriptionPlan(userId, organizationId);

    // Check if period needs reset
    if (new Date() > usage.currentPeriod.resetDate) {
      this.resetUsagePeriod(usage, plan);
      return;
    }

    const requestsExceeded = usage.currentPeriod.requests > plan.limits.requestsPerMonth;
    const tokensExceeded = usage.currentPeriod.tokens > plan.limits.tokensPerMonth;

    if (requestsExceeded || tokensExceeded) {
      const alert: CostAlert = {
        id: this.generateAlertId(),
        userId,
        organizationId,
        type: 'usage_limit',
        severity: 'high',
        threshold: plan.limits.requestsPerMonth,
        currentValue: usage.currentPeriod.requests,
        message: `Usage limit exceeded: ${usage.currentPeriod.requests}/${plan.limits.requestsPerMonth} requests`,
        isActive: true,
        createdAt: new Date(),
        triggeredAt: new Date()
      };

      await this.createAlert(alert);
      this.emit('usage-limit-exceeded', alert);

      // Block further requests if overage billing is disabled
      if (!this.config.overageBilling.enabled) {
        this.emit('usage-blocked', { userId, organizationId, reason: 'limit_exceeded' });
      }
    }
  }

  /**
   * Check budget alerts
   */
  private async checkBudgetAlerts(userId: string, organizationId: string | undefined): Promise<void> {
    const key = organizationId || userId;
    const budgetAlert = this.budgetAlerts.get(key);

    if (!budgetAlert) return;

    const usage = this.userUsage.get(key);
    if (!usage) return;

    const currentSpend = usage.currentPeriod.cost;
    const budgetPercentage = (currentSpend / budgetAlert.budgetLimit) * 100;

    for (const threshold of budgetAlert.alertThresholds) {
      if (budgetPercentage >= threshold) {
        const existingAlert = this.findExistingAlert(userId, organizationId, 'budget', threshold);

        if (!existingAlert) {
          const alert: CostAlert = {
            id: this.generateAlertId(),
            userId,
            organizationId,
            type: 'budget',
            severity: this.getAlertSeverity(threshold),
            threshold: budgetPercentage,
            currentValue: currentSpend,
            message: `Budget alert: ${budgetPercentage.toFixed(1)}% of budget used ($${currentSpend.toFixed(2)}/$${budgetAlert.budgetLimit.toFixed(2)})`,
            isActive: true,
            createdAt: new Date(),
            triggeredAt: new Date()
          };

          await this.createAlert(alert);
          this.emit('budget-alert', alert);
        }
      }
    }
  }

  /**
   * Get usage analytics for a user or organization
   */
  async getUsageAnalytics(
    userId: string | undefined,
    organizationId: string | undefined,
    period: 'hour' | 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<UsageAnalytics> {
    const key = organizationId || userId;
    if (!key) {
      throw new Error('Either userId or organizationId must be provided');
    }

    const cacheKey = `${key}_${period}_${Date.now()}`;

    // Check cache first
    if (this.analyticsCache.has(cacheKey)) {
      return this.analyticsCache.get(cacheKey)!;
    }

    const usage = this.userUsage.get(key);
    if (!usage) {
      throw new Error('No usage data found for user/organization');
    }

    const endDate = new Date();
    const startDate = this.getStartDate(endDate, period);

    // Filter usage records for the period
    const periodRecords = this.getRecordsForPeriod(key, startDate, endDate);

    const analytics: UsageAnalytics = {
      period,
      startDate,
      endDate,
      totalUsage: {
        requests: periodRecords.length,
        tokens: periodRecords.reduce((sum, record) => sum + record.usage.totalTokens, 0),
        cost: periodRecords.reduce((sum, record) => sum + record.cost.totalCost, 0)
      },
      userBreakdown: organizationId ? this.getUserBreakdown(organizationId, period) : [],
      providerBreakdown: this.calculateProviderBreakdown(periodRecords),
      modelBreakdown: this.calculateModelBreakdown(periodRecords),
      requestTypeBreakdown: this.calculateRequestTypeBreakdown(periodRecords),
      trends: this.calculateTrends(usage, period),
      predictions: this.generatePredictions(usage, period)
    };

    // Cache the result
    this.analyticsCache.set(cacheKey, analytics);

    return analytics;
  }

  /**
   * Create cost alert
   */
  async createAlert(alert: CostAlert): Promise<void> {
    const key = alert.organizationId || alert.userId;

    if (!this.costAlerts.has(key)) {
      this.costAlerts.set(key, []);
    }

    const alerts = this.costAlerts.get(key)!;
    alerts.push(alert);

    this.emit('alert-created', alert);
  }

  /**
   * Get active alerts for a user or organization
   */
  getActiveAlerts(userId?: string, organizationId?: string): CostAlert[] {
    if (!userId && !organizationId) {
      // Return all active alerts
      const allAlerts: CostAlert[] = [];
      for (const alerts of this.costAlerts.values()) {
        allAlerts.push(...alerts.filter(alert => alert.isActive));
      }
      return allAlerts;
    }

    const key = organizationId || userId;
    const alerts = this.costAlerts.get(key) || [];
    return alerts.filter(alert => alert.isActive);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    for (const alerts of this.costAlerts.values()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.acknowledgedAt = new Date();
        this.emit('alert-acknowledged', alert);
        return;
      }
    }
    throw new Error(`Alert not found: ${alertId}`);
  }

  /**
   * Set budget alert
   */
  setBudgetAlert(userId: string, budgetLimit: number, organizationId?: string): void {
    const key = organizationId || userId;

    const budgetAlert: BudgetAlert = {
      userId,
      organizationId,
      budgetLimit,
      currentSpend: 0,
      period: 'monthly',
      alertThresholds: [50, 75, 90, 100]
    };

    this.budgetAlerts.set(key, budgetAlert);
    this.emit('budget-alert-set', budgetAlert);
  }

  /**
   * Get user's subscription plan
   */
  async getUserSubscriptionPlan(userId: string, organizationId?: string): Promise<SubscriptionPlan> {
    // This would typically fetch from database
    // For now, return default free plan
    return this.subscriptionPlans.get('free')!;
  }

  /**
   * Update user's subscription plan
   */
  async updateSubscriptionPlan(userId: string, planId: string, organizationId?: string): Promise<void> {
    const plan = this.subscriptionPlans.get(planId);
    if (!plan) {
      throw new Error(`Subscription plan not found: ${planId}`);
    }

    const key = organizationId || userId;
    let usage = this.userUsage.get(key);

    if (!usage) {
      usage = this.createUserUsage(userId, organizationId);
      this.userUsage.set(key, usage);
    }

    // Reset current period with new limits
    this.resetUsagePeriod(usage, plan);

    this.emit('subscription-updated', { userId, organizationId, plan });
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimizationRecommendations(userId: string, organizationId?: string): Promise<string[]> {
    const key = organizationId || userId;
    const usage = this.userUsage.get(key);

    if (!usage) {
      return ['No usage data available for recommendations'];
    }

    const recommendations: string[] = [];

    // Analyze provider usage
    const providerCosts = Array.from(usage.byProvider.entries())
      .sort(([, a], [, b]) => b.cost - a.cost);

    if (providerCosts.length > 1) {
      const mostExpensive = providerCosts[0];
      const cheapest = providerCosts[providerCosts.length - 1];

      if (mostExpensive[1].cost > cheapest[1].cost * 2) {
        recommendations.push(`Consider using ${cheapest[0]} provider more frequently - it's ${((mostExpensive[1].cost / cheapest[1].cost) * 100).toFixed(0)}% cheaper`);
      }
    }

    // Analyze model usage
    const modelUsage = Array.from(usage.byModel.entries())
      .sort(([, a], [, b]) => b.cost - a.cost);

    if (modelUsage.length > 1) {
      const expensiveModel = modelUsage[0];
      const cheaperModels = modelUsage.slice(1);

      if (cheaperModels.length > 0 && expensiveModel[1].cost > cheaperModels[0][1].cost * 1.5) {
        recommendations.push(`Consider using ${cheaperModels[0][0]} instead of ${expensiveModel[0]} for cost savings`);
      }
    }

    // Check request patterns
    const avgRequestCost = usage.currentPeriod.cost / usage.currentPeriod.requests;
    if (avgRequestCost > 0.10) {
      recommendations.push('Optimize prompts to reduce token usage and lower per-request costs');
    }

    // Check caching effectiveness
    const cachedRequests = this.usageRecords.get(key)?.filter(r => r.metadata.cached).length || 0;
    const cacheHitRate = cachedRequests / usage.currentPeriod.requests;

    if (cacheHitRate < 0.2) {
      recommendations.push('Enable request caching to improve cost efficiency');
    }

    // Check subscription plan
    const plan = await this.getUserSubscriptionPlan(userId, organizationId);
    const utilizationRate = usage.currentPeriod.requests / plan.limits.requestsPerMonth;

    if (utilizationRate < 0.3 && plan.tier !== 'free') {
      recommendations.push('Consider downgrading your subscription plan based on current usage patterns');
    } else if (utilizationRate > 0.9) {
      recommendations.push('Consider upgrading your subscription plan to avoid overage charges');
    }

    return recommendations.length > 0 ? recommendations : ['Your usage patterns are well optimized'];
  }

  /**
   * Generate usage report
   */
  async generateUsageReport(
    userId: string,
    organizationId?: string,
    period: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{
    summary: UserUsage;
    analytics: UsageAnalytics;
    recommendations: string[];
    alerts: CostAlert[];
    costProjection: {
      nextPeriod: number;
      yearlyProjection: number;
      variance: number;
    };
  }> {
    const key = organizationId || userId;
    const usage = this.userUsage.get(key);

    if (!usage) {
      throw new Error('No usage data available for report generation');
    }

    const analytics = await this.getUsageAnalytics(userId, organizationId, period === 'quarter' ? 'month' : period);
    const recommendations = await this.getCostOptimizationRecommendations(userId, organizationId);
    const alerts = this.getActiveAlerts(userId, organizationId);

    const costProjection = this.calculateCostProjection(usage, period);

    return {
      summary: usage,
      analytics,
      recommendations,
      alerts,
      costProjection
    };
  }

  /**
   * Private helper methods
   */
  private createUserUsage(userId: string, organizationId?: string): UserUsage {
    return {
      userId,
      organizationId,
      currentPeriod: {
        requests: 0,
        tokens: 0,
        cost: 0,
        lastReset: new Date(),
        resetDate: this.getNextMonthDate()
      },
      totalUsage: {
        requests: 0,
        tokens: 0,
        cost: 0,
        startDate: new Date()
      },
      byProvider: new Map(),
      byModel: new Map(),
      byRequestType: new Map(),
      dailyUsage: [],
      alerts: []
    };
  }

  private createProviderUsage(provider: AIProviderType): ProviderUsage {
    return {
      provider,
      requests: 0,
      tokens: 0,
      cost: 0,
      averageResponseTime: 0,
      successRate: 100,
      errors: 0
    };
  }

  private createModelUsage(model: string): ModelUsage {
    return {
      model,
      requests: 0,
      tokens: 0,
      cost: 0,
      averageResponseTime: 0,
      quality: 0
    };
  }

  private createRequestTypeUsage(requestType: string): RequestTypeUsage {
    return {
      requestType,
      requests: 0,
      tokens: 0,
      cost: 0,
      averageResponseTime: 0,
      successRate: 100
    };
  }

  private updateDailyUsage(usage: UserUsage, record: UsageRecord): void {
    const dateStr = record.timestamp.toISOString().split('T')[0];
    let dailyUsage = usage.dailyUsage.find(d => d.date === dateStr);

    if (!dailyUsage) {
      dailyUsage = {
        date: dateStr,
        requests: 0,
        tokens: 0,
        cost: 0,
        uniqueUsers: 1,
        byProvider: new Map(),
        topModels: []
      };
      usage.dailyUsage.push(dailyUsage);

      // Keep only last 90 days
      if (usage.dailyUsage.length > 90) {
        usage.dailyUsage.splice(0, usage.dailyUsage.length - 90);
      }
    }

    dailyUsage.requests++;
    dailyUsage.tokens += record.usage.totalTokens;
    dailyUsage.cost += record.cost.totalCost;

    // Update provider breakdown
    const providerCount = dailyUsage.byProvider.get(record.provider) || 0;
    dailyUsage.byProvider.set(record.provider, providerCount + 1);
  }

  private resetUsagePeriod(usage: UserUsage, plan: SubscriptionPlan): void {
    usage.currentPeriod = {
      requests: 0,
      tokens: 0,
      cost: 0,
      lastReset: new Date(),
      resetDate: this.getNextMonthDate()
    };

    this.emit('usage-period-reset', { usage, plan });
  }

  private setupAlertMonitoring(): void {
    if (!this.config.enableBudgetAlerts) return;

    this.alertTimer = setInterval(async () => {
      // Check all budget alerts
      for (const [key, budgetAlert] of this.budgetAlerts) {
        await this.checkBudgetAlerts(budgetAlert.userId, budgetAlert.organizationId);
      }
    }, this.config.alertCheckInterval);
  }

  private findExistingAlert(
    userId: string,
    organizationId: string | undefined,
    type: string,
    threshold: number
  ): CostAlert | undefined {
    const key = organizationId || userId;
    const alerts = this.costAlerts.get(key) || [];

    return alerts.find(alert =>
      alert.type === type &&
      alert.threshold >= threshold &&
      alert.threshold < threshold + 10 &&
      alert.isActive &&
      !alert.acknowledgedAt
    );
  }

  private getAlertSeverity(threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    if (threshold >= 100) return 'critical';
    if (threshold >= 90) return 'high';
    if (threshold >= 75) return 'medium';
    return 'low';
  }

  private getRecordsForPeriod(key: string, startDate: Date, endDate: Date): UsageRecord[] {
    const records = this.usageRecords.get(key) || [];
    return records.filter(record =>
      record.timestamp >= startDate && record.timestamp <= endDate
    );
  }

  private getStartDate(endDate: Date, period: string): Date {
    const startDate = new Date(endDate);

    switch (period) {
      case 'hour':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return startDate;
  }

  private getUserBreakdown(organizationId: string, period: string): Array<{userId: string; requests: number; tokens: number; cost: number}> {
    // This would analyze usage by users within an organization
    // For now, return empty array
    return [];
  }

  private calculateProviderBreakdown(records: UsageRecord[]): Map<AIProviderType, ProviderUsage> {
    const breakdown = new Map<AIProviderType, ProviderUsage>();

    for (const record of records) {
      if (!breakdown.has(record.provider)) {
        breakdown.set(record.provider, this.createProviderUsage(record.provider));
      }

      const usage = breakdown.get(record.provider)!;
      usage.requests++;
      usage.tokens += record.usage.totalTokens;
      usage.cost += record.cost.totalCost;
      usage.averageResponseTime = (usage.averageResponseTime + record.metadata.duration) / 2;
    }

    return breakdown;
  }

  private calculateModelBreakdown(records: UsageRecord[]): Array<{model: string; requests: number; tokens: number; cost: number; avgResponseTime: number}> {
    const modelStats = new Map<string, {requests: number; tokens: number; cost: number; totalTime: number}>();

    for (const record of records) {
      if (!modelStats.has(record.model)) {
        modelStats.set(record.model, { requests: 0, tokens: 0, cost: 0, totalTime: 0 });
      }

      const stats = modelStats.get(record.model)!;
      stats.requests++;
      stats.tokens += record.usage.totalTokens;
      stats.cost += record.cost.totalCost;
      stats.totalTime += record.metadata.duration;
    }

    return Array.from(modelStats.entries()).map(([model, stats]) => ({
      model,
      requests: stats.requests,
      tokens: stats.tokens,
      cost: stats.cost,
      avgResponseTime: stats.totalTime / stats.requests
    }));
  }

  private calculateRequestTypeBreakdown(records: UsageRecord[]): Map<string, RequestTypeUsage> {
    const breakdown = new Map<string, RequestTypeUsage>();

    for (const record of records) {
      if (!breakdown.has(record.requestType)) {
        breakdown.set(record.requestType, this.createRequestTypeUsage(record.requestType));
      }

      const usage = breakdown.get(record.requestType)!;
      usage.requests++;
      usage.tokens += record.usage.totalTokens;
      usage.cost += record.cost.totalCost;
      usage.averageResponseTime = (usage.averageResponseTime + record.metadata.duration) / 2;
    }

    return breakdown;
  }

  private calculateTrends(usage: UserUsage, period: string): {costGrowth: number; usageGrowth: number; efficiencyImprovement: number} {
    // This would calculate trends based on historical data
    // For now, return mock data
    return {
      costGrowth: 5.2,
      usageGrowth: 8.7,
      efficiencyImprovement: 12.3
    };
  }

  private generatePredictions(usage: UserUsage, period: string): {nextMonthCost: number; nextMonthUsage: number; recommendedActions: string[]} {
    const currentCost = usage.currentPeriod.cost;
    const currentUsage = usage.currentPeriod.requests;

    return {
      nextMonthCost: currentCost * 1.1, // 10% growth prediction
      nextMonthUsage: currentUsage * 1.12,
      recommendedActions: [
        'Consider enabling response caching',
        'Optimize prompt engineering',
        'Review provider selection strategy'
      ]
    };
  }

  private calculateCostProjection(usage: UserUsage, period: string): {nextPeriod: number; yearlyProjection: number; variance: number} {
    const currentCost = usage.currentPeriod.cost;
    const monthlyGrowthRate = 0.05; // 5% monthly growth assumption

    const nextPeriod = currentCost * (1 + monthlyGrowthRate);
    const yearlyProjection = nextPeriod * 12 * (1 + monthlyGrowthRate * 6); // Compound growth
    const variance = 0.15; // 15% variance assumption

    return {
      nextPeriod,
      yearlyProjection,
      variance
    };
  }

  private getNextMonthDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  private generateUsageId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.alertTimer) {
      clearInterval(this.alertTimer);
      this.alertTimer = null;
    }

    this.removeAllListeners();
    this.usageRecords.clear();
    this.userUsage.clear();
    this.costAlerts.clear();
    this.analyticsCache.clear();

    console.log('AI Cost Tracker shutdown completed');
  }

  /**
   * Export data for backup/analysis
   */
  exportData(): {
    usageRecords: Record<string, UsageRecord[]>;
    userUsage: Record<string, UserUsage>;
    alerts: Record<string, CostAlert[]>;
    budgetAlerts: Record<string, BudgetAlert>;
  } {
    return {
      usageRecords: Object.fromEntries(this.usageRecords),
      userUsage: Object.fromEntries(this.userUsage),
      alerts: Object.fromEntries(this.costAlerts),
      budgetAlerts: Object.fromEntries(this.budgetAlerts)
    };
  }

  /**
   * Import data from backup
   */
  importData(data: {
    usageRecords?: Record<string, UsageRecord[]>;
    userUsage?: Record<string, UserUsage>;
    alerts?: Record<string, CostAlert[]>;
    budgetAlerts?: Record<string, BudgetAlert>;
  }): void {
    if (data.usageRecords) {
      this.usageRecords = new Map(Object.entries(data.usageRecords));
    }

    if (data.userUsage) {
      this.userUsage = new Map(Object.entries(data.userUsage));
    }

    if (data.alerts) {
      this.costAlerts = new Map(Object.entries(data.alerts));
    }

    if (data.budgetAlerts) {
      this.budgetAlerts = new Map(Object.entries(data.budgetAlerts));
    }

    this.emit('data-imported', { importedAt: new Date() });
  }
}

export {
  AICostTracker,
  type UsageRecord,
  type UserUsage,
  type SubscriptionPlan,
  type CostAlert,
  type BudgetAlert,
  type UsageAnalytics,
  type CostTrackerConfig
};
