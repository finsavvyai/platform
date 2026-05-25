/**
 * Subscription Management Service
 *
 * Comprehensive subscription system with tier management, usage tracking,
 * billing integration, and AI-powered optimization recommendations.
 */

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_interval: 'monthly' | 'yearly';
  features: SubscriptionFeature[];
  limits: SubscriptionLimits;
  ai_features: AIFeatureLimits;
  metadata: Record<string, any>;
  active: boolean;
  created_at: number;
  updated_at: number;
}

export interface SubscriptionFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
  unit?: string;
}

export interface SubscriptionLimits {
  api_requests_per_month: number;
  ai_requests_per_month: number;
  storage_gb: number;
  users: number;
  transactions_per_month: number;
  kyc_verifications_per_month: number;
  risk_assessments_per_month: number;
  custom_agents: number;
  webhooks: number;
  api_calls_per_minute: number;
  concurrent_sessions: number;
}

export interface AIFeatureLimits {
  fraud_detection: boolean;
  document_verification: boolean;
  transaction_categorization: boolean;
  cash_flow_forecasting: boolean;
  risk_assessment: boolean;
  anomaly_detection: boolean;
  natural_language_processing: boolean;
  multimodal_processing: boolean;
  custom_ai_models: boolean;
  advanced_analytics: boolean;
  confidence_threshold_min: number;
  ai_support_level: 'basic' | 'standard' | 'premium' | 'enterprise';
}

export interface Subscription {
  id: string;
  organization_id: string;
  tier_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  current_period_start: number;
  current_period_end: number;
  trial_start?: number;
  trial_end?: number;
  canceled_at?: number;
  cancel_at_period_end: boolean;
  usage: SubscriptionUsage;
  billing_info: BillingInfo;
  ai_usage: AIUsage;
  metadata: Record<string, any>;
  created_at: number;
  updated_at: number;
}

export interface SubscriptionUsage {
  api_requests: {
    current: number;
    limit: number;
    reset_date: number;
  };
  ai_requests: {
    current: number;
    limit: number;
    reset_date: number;
  };
  storage: {
    current_gb: number;
    limit_gb: number;
  };
  users: {
    current: number;
    limit: number;
  };
  transactions: {
    current: number;
    limit: number;
    reset_date: number;
  };
  kyc_verifications: {
    current: number;
    limit: number;
    reset_date: number;
  };
  risk_assessments: {
    current: number;
    limit: number;
    reset_date: number;
  };
  custom_agents: {
    current: number;
    limit: number;
  };
  webhooks: {
    current: number;
    limit: number;
  };
}

export interface AIUsage {
  fraud_detection: number;
  document_verification: number;
  transaction_categorization: number;
  cash_flow_forecasting: number;
  risk_assessment: number;
  anomaly_detection: number;
  natural_language_processing: number;
  multimodal_processing: number;
  custom_ai_models: number;
  total_ai_requests: number;
  ai_processing_time_ms: number;
  accuracy_score_average: number;
  last_reset: number;
}

export interface BillingInfo {
  customer_id: string;
  payment_method_id?: string;
  next_billing_date: number;
  next_amount: number;
  currency: string;
  tax_rate: number;
  discounts: BillingDiscount[];
  addons: SubscriptionAddon[];
}

export interface BillingDiscount {
  id: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  description: string;
  expires_at?: number;
  active: boolean;
}

export interface SubscriptionAddon {
  id: string;
  name: string;
  price: number;
  billing_interval: 'monthly' | 'yearly';
  features: string[];
  quantity: number;
  active: boolean;
}

export interface UsageEvent {
  id: string;
  subscription_id: string;
  organization_id: string;
  event_type: string;
  quantity: number;
  unit: string;
  metadata: Record<string, any>;
  timestamp: number;
  processed: boolean;
}

export interface SubscriptionAnalytics {
  subscription_id: string;
  period_start: number;
  period_end: number;
  total_usage: Record<string, number>;
  cost_breakdown: CostBreakdown;
  efficiency_metrics: EfficiencyMetrics;
  ai_insights: AIInsights;
  recommendations: SubscriptionRecommendation[];
}

export interface CostBreakdown {
  base_subscription: number;
  addons: number;
  usage_charges: number;
  ai_processing: number;
  discounts: number;
  taxes: number;
  total: number;
}

export interface EfficiencyMetrics {
  api_request_efficiency: number; // requests per dollar
  ai_request_efficiency: number;  // AI requests per dollar
  storage_efficiency: number;     // GB per dollar
  user_efficiency: number;        // users per dollar
  utilization_rate: number;       // percentage of limits used
  cost_per_transaction: number;
  roi_score: number;
}

export interface AIInsights {
  usage_patterns: UsagePattern[];
  optimization_opportunities: OptimizationOpportunity[];
  predicted_growth: number;
  recommended_tier?: string;
  cost_savings_potential: number;
  feature_adoption_rates: Record<string, number>;
}

export interface UsagePattern {
  feature: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  growth_rate: number;
  seasonality: boolean;
  peak_usage_times: number[];
  efficiency_score: number;
}

export interface OptimizationOpportunity {
  type: 'upgrade' | 'downgrade' | 'addon' | 'usage_optimization';
  description: string;
  potential_savings: number;
  confidence: number;
  implementation_difficulty: 'easy' | 'medium' | 'hard';
  impact: 'low' | 'medium' | 'high';
}

export interface SubscriptionRecommendation {
  type: 'tier_change' | 'addon' | 'usage_optimization' | 'billing_change';
  title: string;
  description: string;
  financial_impact: {
    monthly_change: number;
    annual_change: number;
    roi_months?: number;
  };
  benefits: string[];
  implementation_steps: string[];
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  valid_until: number;
}

/**
 * Main Subscription Service class
 */
export class SubscriptionService {
  private db: any;
  private paymentService: any;
  private aiService: any;
  private notificationService: any;

  constructor(env: any) {
    this.db = env.DB;
    this.paymentService = env.PAYMENT_SERVICE;
    this.aiService = env.AI_SERVICE;
    this.notificationService = env.NOTIFICATION_SERVICE;
  }

  /**
   * Create a new subscription
   */
  async createSubscription(data: {
    organization_id: string;
    tier_id: string;
    payment_method_id?: string;
    trial_days?: number;
    billing_info?: Partial<BillingInfo>;
    metadata?: Record<string, any>;
  }): Promise<Subscription> {
    const subscriptionId = this.generateId();
    const now = Date.now();

    // Get tier information
    const tier = await this.getSubscriptionTier(data.tier_id);
    if (!tier || !tier.active) {
      throw new Error('Invalid or inactive subscription tier');
    }

    // Calculate trial period
    let trialStart, trialEnd;
    if (data.trial_days && data.trial_days > 0) {
      trialStart = now;
      trialEnd = now + (data.trial_days * 24 * 60 * 60 * 1000);
    }

    // Calculate billing period
    const periodStart = trialEnd || now;
    const periodEnd = this.calculatePeriodEnd(periodStart, tier.billing_interval);

    // Initialize usage
    const usage = this.initializeUsage(tier.limits);

    // Create subscription record
    const subscription: Subscription = {
      id: subscriptionId,
      organization_id: data.organization_id,
      tier_id: data.tier_id,
      status: trialEnd ? 'trialing' : 'active',
      current_period_start: periodStart,
      current_period_end: periodEnd,
      trial_start: trialStart,
      trial_end: trialEnd,
      cancel_at_period_end: false,
      usage,
      billing_info: {
        customer_id: await this.createOrGetCustomer(data.organization_id),
        payment_method_id: data.payment_method_id,
        next_billing_date: periodEnd,
        next_amount: tier.price,
        currency: tier.currency,
        tax_rate: 0.08, // Default tax rate
        discounts: [],
        addons: []
      },
      ai_usage: this.initializeAIUsage(),
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now
    };

    // Save to database
    await this.db.query(`
      INSERT INTO subscriptions (
        id, organization_id, tier_id, status,
        current_period_start, current_period_end,
        trial_start, trial_end, cancel_at_period_end,
        usage, billing_info, ai_usage, metadata,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      subscription.id,
      subscription.organization_id,
      subscription.tier_id,
      subscription.status,
      subscription.current_period_start,
      subscription.current_period_end,
      subscription.trial_start,
      subscription.trial_end,
      subscription.cancel_at_period_end,
      JSON.stringify(subscription.usage),
      JSON.stringify(subscription.billing_info),
      JSON.stringify(subscription.ai_usage),
      JSON.stringify(subscription.metadata),
      subscription.created_at,
      subscription.updated_at
    ]);

    // Set up payment method if provided
    if (data.payment_method_id) {
      await this.attachPaymentMethod(subscription.id, data.payment_method_id);
    }

    // Send welcome notification
    await this.notificationService.sendSubscriptionWelcome(subscription);

    return subscription;
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(
    subscriptionId: string,
    newTierId: string,
    effectiveImmediately: boolean = false
  ): Promise<Subscription> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    const newTier = await this.getSubscriptionTier(newTierId);
    if (!newTier || !newTier.active) {
      throw new Error('Invalid or inactive subscription tier');
    }

    const now = Date.now();

    if (effectiveImmediately) {
      // Update immediately
      subscription.tier_id = newTierId;
      subscription.usage = this.initializeUsage(newTier.limits);
      subscription.billing_info.next_amount = newTier.price;
      subscription.updated_at = now;

      // Prorate current billing cycle
      await this.processProration(subscription, newTier);

    } else {
      // Update at next billing cycle
      subscription.metadata.pending_tier_change = newTierId;
      subscription.metadata.pending_tier_change_date = subscription.current_period_end;
    }

    // Save changes
    await this.db.query(`
      UPDATE subscriptions
      SET tier_id = ?, usage = ?, billing_info = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `, [
      subscription.tier_id,
      JSON.stringify(subscription.usage),
      JSON.stringify(subscription.billing_info),
      JSON.stringify(subscription.metadata),
      subscription.updated_at,
      subscriptionId
    ]);

    // Send notification
    await this.notificationService.sendTierChangeNotification(subscription, newTier, effectiveImmediately);

    return subscription;
  }

  /**
   * Record usage event
   */
  async recordUsage(event: {
    subscription_id: string;
    organization_id: string;
    event_type: string;
    quantity: number;
    unit: string;
    metadata?: Record<string, any>;
  }): Promise<UsageEvent> {
    const usageEvent: UsageEvent = {
      id: this.generateId(),
      ...event,
      timestamp: Date.now(),
      processed: false
    };

    // Store usage event
    await this.db.query(`
      INSERT INTO usage_events (
        id, subscription_id, organization_id, event_type,
        quantity, unit, metadata, timestamp, processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      usageEvent.id,
      usageEvent.subscription_id,
      usageEvent.organization_id,
      usageEvent.event_type,
      usageEvent.quantity,
      usageEvent.unit,
      JSON.stringify(usageEvent.metadata || {}),
      usageEvent.timestamp,
      usageEvent.processed
    ]);

    // Process usage immediately
    await this.processUsageEvent(usageEvent);

    return usageEvent;
  }

  /**
   * Process usage event and update subscription usage
   */
  private async processUsageEvent(event: UsageEvent): Promise<void> {
    const subscription = await this.getSubscription(event.subscription_id);
    if (!subscription) return;

    // Update appropriate usage counter
    switch (event.event_type) {
      case 'api_request':
        subscription.usage.api_requests.current += event.quantity;
        break;

      case 'ai_request':
        subscription.usage.ai_requests.current += event.quantity;
        subscription.ai_usage.total_ai_requests += event.quantity;
        break;

      case 'storage':
        subscription.usage.storage.current_gb += event.quantity / 1024; // Convert MB to GB
        break;

      case 'transaction':
        subscription.usage.transactions.current += event.quantity;
        break;

      case 'kyc_verification':
        subscription.usage.kyc_verifications.current += event.quantity;
        break;

      case 'risk_assessment':
        subscription.usage.risk_assessments.current += event.quantity;
        break;

      // Add AI-specific usage tracking
      default:
        if (event.event_type.startsWith('ai_')) {
          const aiFeature = event.event_type.replace('ai_', '');
          if (aiFeature in subscription.ai_usage) {
            subscription.ai_usage[aiFeature] += event.quantity;
          }
        }
    }

    // Update subscription
    await this.db.query(`
      UPDATE subscriptions
      SET usage = ?, ai_usage = ?, updated_at = ?
      WHERE id = ?
    `, [
      JSON.stringify(subscription.usage),
      JSON.stringify(subscription.ai_usage),
      Date.now(),
      event.subscription_id
    ]);

    // Check for usage alerts
    await this.checkUsageAlerts(subscription);

    // Mark event as processed
    await this.db.query(`
      UPDATE usage_events SET processed = true WHERE id = ?
    `, [event.id]);
  }

  /**
   * Check if subscription can make a request
   */
  async checkSubscriptionLimits(
    subscriptionId: string,
    requestType: string,
    quantity: number = 1
  ): Promise<{
    allowed: boolean;
    remaining: number;
    reset_date?: number;
    upgrade_required?: boolean;
    suggested_tier?: string;
  }> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Check subscription status
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return {
        allowed: false,
        remaining: 0,
        upgrade_required: true
      };
    }

    let currentUsage, limit, resetDate;

    switch (requestType) {
      case 'api_request':
        currentUsage = subscription.usage.api_requests.current;
        limit = subscription.usage.api_requests.limit;
        resetDate = subscription.usage.api_requests.reset_date;
        break;

      case 'ai_request':
        currentUsage = subscription.usage.ai_requests.current;
        limit = subscription.usage.ai_requests.limit;
        resetDate = subscription.usage.ai_requests.reset_date;
        break;

      case 'storage':
        currentUsage = subscription.usage.storage.current_gb;
        limit = subscription.usage.storage.limit_gb;
        break;

      case 'transaction':
        currentUsage = subscription.usage.transactions.current;
        limit = subscription.usage.transactions.limit;
        resetDate = subscription.usage.transactions.reset_date;
        break;

      default:
        throw new Error(`Unknown request type: ${requestType}`);
    }

    const remaining = Math.max(0, limit - currentUsage);
    const allowed = remaining >= quantity;

    // Get upgrade suggestions if over limit
    let upgradeRequired = false;
    let suggestedTier;

    if (!allowed) {
      upgradeRequired = true;
      suggestedTier = await this.getSuggestedUpgradeTier(subscription.tier_id, requestType);
    }

    return {
      allowed,
      remaining,
      reset_date: resetDate,
      upgrade_required: upgradeRequired,
      suggested_tier: suggestedTier
    };
  }

  /**
   * Generate subscription analytics
   */
  async generateSubscriptionAnalytics(
    subscriptionId: string,
    periodStart: number,
    periodEnd: number
  ): Promise<SubscriptionAnalytics> {
    const subscription = await this.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Get usage data for the period
    const usageData = await this.getUsageData(subscriptionId, periodStart, periodEnd);

    // Calculate cost breakdown
    const costBreakdown = await this.calculateCostBreakdown(subscription, usageData);

    // Calculate efficiency metrics
    const efficiencyMetrics = this.calculateEfficiencyMetrics(costBreakdown, usageData);

    // Generate AI insights
    const aiInsights = await this.generateAIInsights(subscription, usageData, efficiencyMetrics);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(subscription, aiInsights, efficiencyMetrics);

    return {
      subscription_id: subscriptionId,
      period_start: periodStart,
      period_end: periodEnd,
      total_usage: usageData,
      cost_breakdown: costBreakdown,
      efficiency_metrics: efficiencyMetrics,
      ai_insights: aiInsights,
      recommendations
    };
  }

  /**
   * Get suggested upgrade tier based on usage
   */
  private async getSuggestedUpgradeTier(currentTierId: string, requestType: string): Promise<string> {
    const tiers = await this.getAllSubscriptionTiers();
    const currentTier = tiers.find(t => t.id === currentTierId);

    if (!currentTier) return null;

    // Find next tier with higher limits for the specific request type
    const higherTiers = tiers
      .filter(t => t.price > currentTier.price && t.active)
      .sort((a, b) => a.price - b.price);

    for (const tier of higherTiers) {
      const currentLimit = currentTier.limits[requestType + '_per_month'];
      const newLimit = tier.limits[requestType + '_per_month'];

      if (newLimit > currentLimit) {
        return tier.id;
      }
    }

    return null;
  }

  /**
   * Initialize usage counters for a subscription tier
   */
  private initializeUsage(limits: SubscriptionLimits): SubscriptionUsage {
    const now = Date.now();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);

    return {
      api_requests: {
        current: 0,
        limit: limits.api_requests_per_month,
        reset_date: nextMonth.getTime()
      },
      ai_requests: {
        current: 0,
        limit: limits.ai_requests_per_month,
        reset_date: nextMonth.getTime()
      },
      storage: {
        current_gb: 0,
        limit_gb: limits.storage_gb
      },
      users: {
        current: 0,
        limit: limits.users
      },
      transactions: {
        current: 0,
        limit: limits.transactions_per_month,
        reset_date: nextMonth.getTime()
      },
      kyc_verifications: {
        current: 0,
        limit: limits.kyc_verifications_per_month,
        reset_date: nextMonth.getTime()
      },
      risk_assessments: {
        current: 0,
        limit: limits.risk_assessments_per_month,
        reset_date: nextMonth.getTime()
      },
      custom_agents: {
        current: 0,
        limit: limits.custom_agents
      },
      webhooks: {
        current: 0,
        limit: limits.webhooks
      }
    };
  }

  /**
   * Initialize AI usage tracking
   */
  private initializeAIUsage(): AIUsage {
    return {
      fraud_detection: 0,
      document_verification: 0,
      transaction_categorization: 0,
      cash_flow_forecasting: 0,
      risk_assessment: 0,
      anomaly_detection: 0,
      natural_language_processing: 0,
      multimodal_processing: 0,
      custom_ai_models: 0,
      total_ai_requests: 0,
      ai_processing_time_ms: 0,
      accuracy_score_average: 0,
      last_reset: Date.now()
    };
  }

  /**
   * Calculate period end date based on billing interval
   */
  private calculatePeriodEnd(startDate: number, interval: 'monthly' | 'yearly'): number {
    const start = new Date(startDate);

    if (interval === 'monthly') {
      start.setMonth(start.getMonth() + 1);
    } else {
      start.setFullYear(start.getFullYear() + 1);
    }

    return start.getTime();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Helper methods for database operations
   */
  private async getSubscription(id: string): Promise<Subscription | null> {
    const result = await this.db.query('SELECT * FROM subscriptions WHERE id = ?', [id]);
    return result.results.length > 0 ? result.results[0] : null;
  }

  private async getSubscriptionTier(id: string): Promise<SubscriptionTier | null> {
    const result = await this.db.query('SELECT * FROM subscription_tiers WHERE id = ?', [id]);
    return result.results.length > 0 ? result.results[0] : null;
  }

  private async getAllSubscriptionTiers(): Promise<SubscriptionTier[]> {
    const result = await this.db.query('SELECT * FROM subscription_tiers WHERE active = true ORDER BY price ASC');
    return result.results;
  }

  private async createOrGetCustomer(organizationId: string): Promise<string> {
    // Implementation for creating or retrieving payment customer
    return `cust_${organizationId}`;
  }

  private async attachPaymentMethod(subscriptionId: string, paymentMethodId: string): Promise<void> {
    // Implementation for attaching payment method
  }

  private async processProration(subscription: Subscription, newTier: SubscriptionTier): Promise<void> {
    // Implementation for processing proration charges
  }

  private async checkUsageAlerts(subscription: Subscription): Promise<void> {
    // Implementation for checking usage thresholds and sending alerts
  }

  private async getUsageData(subscriptionId: string, periodStart: number, periodEnd: number): Promise<Record<string, number>> {
    // Implementation for retrieving usage data for a period
    return {};
  }

  private async calculateCostBreakdown(subscription: Subscription, usageData: Record<string, number>): Promise<CostBreakdown> {
    // Implementation for calculating detailed cost breakdown
    return {
      base_subscription: 0,
      addons: 0,
      usage_charges: 0,
      ai_processing: 0,
      discounts: 0,
      taxes: 0,
      total: 0
    };
  }

  private calculateEfficiencyMetrics(costBreakdown: CostBreakdown, usageData: Record<string, number>): EfficiencyMetrics {
    // Implementation for calculating efficiency metrics
    return {
      api_request_efficiency: 0,
      ai_request_efficiency: 0,
      storage_efficiency: 0,
      user_efficiency: 0,
      utilization_rate: 0,
      cost_per_transaction: 0,
      roi_score: 0
    };
  }

  private async generateAIInsights(
    subscription: Subscription,
    usageData: Record<string, number>,
    efficiencyMetrics: EfficiencyMetrics
  ): Promise<AIInsights> {
    // Implementation for AI-powered usage insights
    return {
      usage_patterns: [],
      optimization_opportunities: [],
      predicted_growth: 0,
      cost_savings_potential: 0,
      feature_adoption_rates: {}
    };
  }

  private async generateRecommendations(
    subscription: Subscription,
    aiInsights: AIInsights,
    efficiencyMetrics: EfficiencyMetrics
  ): Promise<SubscriptionRecommendation[]> {
    // Implementation for generating subscription recommendations
    return [];
  }
}