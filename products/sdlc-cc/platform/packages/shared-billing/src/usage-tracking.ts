import { SupabaseClient } from '@supabase/supabase-js';
import {
  BillingConfig,
  TrackUsageParams,
  UsageQuota,
  BillingError,
  SubscriptionTier,
  DEFAULT_TIER_CONFIGS,
} from './types';

interface UsageTrackingDeps {
  config: BillingConfig;
  getAdminClient: () => SupabaseClient;
}

export class UsageTracking {
  private deps: UsageTrackingDeps;

  constructor(deps: UsageTrackingDeps) {
    this.deps = deps;
  }

  async trackUsage(params: TrackUsageParams): Promise<void> {
    try {
      const admin = this.deps.getAdminClient();
      const billingCycle = new Date().toISOString().slice(0, 7);

      await admin.from('usage_records').insert({
        id: crypto.randomUUID(),
        user_id: params.userId,
        subscription_id: params.subscriptionId,
        product_id: params.productId,
        metric: params.metric,
        quantity: params.quantity,
        billing_cycle: billingCycle,
        metadata: params.metadata,
        timestamp: new Date().toISOString(),
      });

      await this.checkAndNotifyQuotaExceeded(params.userId, params.productId, params.metric);
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  async getUsageQuota(userId: string, productId: string, metric: string): Promise<UsageQuota> {
    try {
      const admin = this.deps.getAdminClient();
      const billingCycle = new Date().toISOString().slice(0, 7);

      const { data: subscription, error: subError } = await admin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (subError || !subscription) {
        throw new Error('No active subscription found');
      }

      const tierConfig = DEFAULT_TIER_CONFIGS[subscription.tier as keyof typeof DEFAULT_TIER_CONFIGS];
      const products = tierConfig.products as unknown as Record<string, Record<string, number | string[]>>;
      const section = products[productId];
      const limit = (section && typeof section[metric] === 'number') ? section[metric] as number : 0;

      const { data: usage, error: usageError } = await admin
        .from('usage_records')
        .select('quantity')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .eq('metric', metric)
        .eq('billing_cycle', billingCycle);

      if (usageError) throw usageError;

      const used = usage?.reduce((sum, record) => sum + record.quantity, 0) || 0;

      return {
        userId, productId, metric, limit, used,
        remaining: limit === -1 ? -1 : Math.max(0, limit - used),
        billingCycle,
      };
    } catch (error) {
      throw new BillingError({
        code: 'QUOTA_CHECK_FAILED',
        message: `Failed to check usage quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processor: this.deps.config.processor,
        timestamp: new Date(),
      });
    }
  }

  async checkAndNotifyQuotaExceeded(userId: string, productId: string, metric: string): Promise<void> {
    try {
      const quota = await this.getUsageQuota(userId, productId, metric);

      if (quota.limit === -1) return;

      if (quota.used > quota.limit) {
        const overage = quota.used - quota.limit;

        let suggestedTier: SubscriptionTier = 'starter';
        if (overage > 100) {
          suggestedTier = 'enterprise';
        } else if (overage > 10) {
          suggestedTier = 'professional';
        }

        await this.deps.getAdminClient()
          .from('quota_exceeded_notifications')
          .insert({
            id: crypto.randomUUID(),
            user_id: userId,
            product_id: productId,
            metric,
            limit: quota.limit,
            used: quota.used,
            overage,
            suggested_tier: suggestedTier,
            created_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error('Failed to check quota exceeded:', error);
    }
  }
}
