import { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentProvider } from '@finsavvyai/pay';
import {
  BillingConfig, Subscription, CreateSubscriptionParams,
  UpdateSubscriptionParams, CancelSubscriptionParams,
  CheckoutSession, BillingError, DEFAULT_TIER_CONFIGS,
} from './types';

interface SubscriptionOpsDeps {
  config: BillingConfig;
  paymentClient: PaymentProvider;
  getAdminClient: () => SupabaseClient;
  createOrGetCustomer: (userId: string, email: string, name?: string) => Promise<{ id: string; processorCustomerId: string }>;
}

function billingError(code: string, msg: string, processor: string): BillingError {
  return new BillingError({ code, message: msg, processor: processor as 'stripe', timestamp: new Date() });
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export class SubscriptionOps {
  private deps: SubscriptionOpsDeps;
  constructor(deps: SubscriptionOpsDeps) { this.deps = deps; }

  async createCheckoutSession(params: CreateSubscriptionParams): Promise<CheckoutSession> {
    try {
      const customer = await this.deps.createOrGetCustomer(params.userId, params.email, params.email);
      const tierConfig = DEFAULT_TIER_CONFIGS[params.tier];
      const productId = 'sdlc';
      const priceId = this.getPriceId(tierConfig);

      // Use @finsavvyai/pay PaymentProvider for checkout creation
      const session = await this.deps.paymentClient.createCheckout({
        customerId: customer.processorCustomerId,
        priceId,
        successUrl: params.successUrl || `${this.deps.config.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: params.cancelUrl || `${this.deps.config.cancelUrl}`,
      });

      return this.persistCheckoutSession(session, customer, params, tierConfig, productId);
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw billingError('CHECKOUT_SESSION_FAILED', `Failed to create checkout session: ${errMsg(error)}`, this.deps.config.processor);
    }
  }

  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    try {
      const { data, error } = await this.deps.getAdminClient()
        .from('subscriptions').select(`*, customers!inner(user_id)`)
        .eq('customers.user_id', userId).eq('status', 'active');
      if (error) throw error;
      return data as Subscription[];
    } catch (error) {
      throw billingError('FETCH_SUBSCRIPTIONS_FAILED', `Failed to fetch user subscriptions: ${errMsg(error)}`, this.deps.config.processor);
    }
  }

  async updateSubscription(params: UpdateSubscriptionParams): Promise<Subscription> {
    try {
      const admin = this.deps.getAdminClient();
      const { data: currentSub, error: fetchError } = await admin
        .from('subscriptions').select('*').eq('id', params.subscriptionId).single();
      if (fetchError || !currentSub) throw new Error('Subscription not found');

      let result = currentSub as Subscription;
      if (params.tier) {
        result = await this.updateTier(admin, params, currentSub);
      }
      if (params.cancelAtPeriodEnd !== undefined) {
        result = await this.updateCancelFlag(admin, params);
      }
      return result;
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw billingError('SUBSCRIPTION_UPDATE_FAILED', `Failed to update subscription: ${errMsg(error)}`, this.deps.config.processor);
    }
  }

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    try {
      const admin = this.deps.getAdminClient();
      const { data: sub, error: fetchError } = await admin
        .from('subscriptions').select('*').eq('id', params.subscriptionId).single();
      if (fetchError || !sub) throw new Error('Subscription not found');

      // Use @finsavvyai/pay PaymentProvider for cancellation
      if (params.immediately) {
        await this.deps.paymentClient.cancelSubscription(sub.processor_subscription_id);
      }

      await admin.from('subscriptions').update({
        status: params.immediately ? 'cancelled' : 'active',
        cancel_at_period_end: !params.immediately, updated_at: new Date().toISOString(),
      }).eq('id', params.subscriptionId);

      await admin.from('subscription_cancellations').insert({
        id: crypto.randomUUID(), subscription_id: params.subscriptionId,
        reason: params.reason || '', feedback: params.feedback || '',
        cancelled_immediately: params.immediately, created_at: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof BillingError) throw error;
      throw billingError('SUBSCRIPTION_CANCEL_FAILED', `Failed to cancel subscription: ${errMsg(error)}`, this.deps.config.processor);
    }
  }

  private getPriceId(tierConfig: (typeof DEFAULT_TIER_CONFIGS)['starter']): string {
    const processor = this.deps.config.processor;
    return tierConfig.processorPriceIds?.[processor] || 'price_placeholder';
  }

  private async persistCheckoutSession(
    session: { id: string; url: string },
    customer: { id: string }, params: CreateSubscriptionParams,
    tierConfig: (typeof DEFAULT_TIER_CONFIGS)['starter'], productId: string,
  ): Promise<CheckoutSession> {
    const { data, error } = await this.deps.getAdminClient().from('checkout_sessions').insert({
      id: crypto.randomUUID(), customer_id: customer.id, user_id: params.userId,
      product_id: productId, tier: params.tier, processor: this.deps.config.processor,
      processor_session_id: session.id, amount: tierConfig.price, currency: tierConfig.currency,
      url: session.url, created_at: new Date().toISOString(),
    }).select('*').single();
    if (error) throw error;
    return {
      id: data.id, url: data.url, customerId: customer.id, userId: params.userId,
      productId, tier: params.tier, processor: this.deps.config.processor,
      amount: tierConfig.price, currency: tierConfig.currency, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  private async updateTier(
    admin: SupabaseClient, params: UpdateSubscriptionParams, _currentSub: Record<string, unknown>,
  ): Promise<Subscription> {
    // Tier update is a DB-level operation; processor-side update
    // would require re-subscribing which is handled via new checkout
    const { data, error } = await admin.from('subscriptions')
      .update({ tier: params.tier, updated_at: new Date().toISOString() })
      .eq('id', params.subscriptionId).select('*').single();
    if (error) throw error;
    return data as Subscription;
  }

  private async updateCancelFlag(admin: SupabaseClient, params: UpdateSubscriptionParams): Promise<Subscription> {
    const { data, error } = await admin.from('subscriptions')
      .update({ cancel_at_period_end: params.cancelAtPeriodEnd, updated_at: new Date().toISOString() })
      .eq('id', params.subscriptionId).select('*').single();
    if (error) throw error;
    return data as Subscription;
  }
}
