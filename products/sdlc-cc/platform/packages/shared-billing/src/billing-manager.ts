import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  createPaymentClient,
  type PaymentProvider,
} from '@finsavvyai/pay';
import {
  BillingConfig,
  Customer,
  Subscription,
  CreateSubscriptionParams,
  UpdateSubscriptionParams,
  CancelSubscriptionParams,
  CheckoutSession,
  TrackUsageParams,
  UsageQuota,
  Invoice,
  BillingAnalytics,
  BillingError,
  PaymentProcessor,
  SubscriptionTier,
  WebhookResult,
} from './types';
import { SubscriptionOps } from './subscription-ops';
import { UsageTracking } from './usage-tracking';
import { InvoiceOps } from './invoice-ops';
import { PricingLogic } from './pricing-logic';
import { WebhookHandlers } from './webhook-handlers';

export class BillingManager {
  private paymentClient: PaymentProvider;
  private config: BillingConfig;
  private subscriptionOps: SubscriptionOps;
  private usageTracking: UsageTracking;
  private invoiceOps: InvoiceOps;
  private pricingLogic: PricingLogic;
  private webhookHandlers: WebhookHandlers;

  constructor(config: BillingConfig) {
    this.config = config;

    // Use @finsavvyai/pay factory instead of direct Stripe initialization
    this.paymentClient = createPaymentClient(config.processor, {
      apiKey: config.apiKey,
      webhookSecret: config.signingSecret,
    });

    const deps = {
      config: this.config,
      paymentClient: this.paymentClient,
      getAdminClient: () => this.adminClient,
    };

    this.subscriptionOps = new SubscriptionOps({
      ...deps,
      createOrGetCustomer: this.createOrGetCustomer.bind(this),
    });
    this.usageTracking = new UsageTracking({
      config: this.config,
      getAdminClient: () => this.adminClient,
    });
    this.invoiceOps = new InvoiceOps({
      config: this.config,
      getAdminClient: () => this.adminClient,
    });
    this.pricingLogic = new PricingLogic({
      getUserSubscriptions: this.getUserSubscriptions.bind(this),
    });
    this.webhookHandlers = new WebhookHandlers({
      config: this.config,
      getAdminClient: () => this.adminClient,
    });
  }

  get adminClient(): SupabaseClient {
    return createClient(this.config.supabaseUrl, this.config.supabaseServiceKey);
  }

  async createOrGetCustomer(userId: string, email: string, name?: string): Promise<Customer> {
    try {
      const admin = this.adminClient;
      const { data: existing, error: fetchError } = await admin
        .from('customers').select('*').eq('user_id', userId).single();

      if (existing && !fetchError) return existing as Customer;

      const processorCustomerId = await this.createProcessorCustomer(email, userId, name);

      const { data: customer, error: insertError } = await admin
        .from('customers')
        .insert({
          id: crypto.randomUUID(), user_id: userId, email, name,
          processor: this.config.processor, processor_customer_id: processorCustomerId,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        })
        .select('*').single();

      if (insertError) throw insertError;
      return customer as Customer;
    } catch (error) {
      throw new BillingError({
        code: 'CUSTOMER_CREATE_FAILED',
        message: `Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        processor: this.config.processor,
        timestamp: new Date(),
      });
    }
  }

  // --- Delegated methods ---

  createCheckoutSession(params: CreateSubscriptionParams): Promise<CheckoutSession> {
    return this.subscriptionOps.createCheckoutSession(params);
  }

  getUserSubscriptions(userId: string): Promise<Subscription[]> {
    return this.subscriptionOps.getUserSubscriptions(userId);
  }

  updateSubscription(params: UpdateSubscriptionParams): Promise<Subscription> {
    return this.subscriptionOps.updateSubscription(params);
  }

  cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    return this.subscriptionOps.cancelSubscription(params);
  }

  trackUsage(params: TrackUsageParams): Promise<void> {
    return this.usageTracking.trackUsage(params);
  }

  getUsageQuota(userId: string, productId: string, metric: string): Promise<UsageQuota> {
    return this.usageTracking.getUsageQuota(userId, productId, metric);
  }

  getUserInvoices(userId: string): Promise<Invoice[]> {
    return this.invoiceOps.getUserInvoices(userId);
  }

  getBillingAnalytics(startDate: Date, endDate: Date): Promise<BillingAnalytics> {
    return this.invoiceOps.getBillingAnalytics(startDate, endDate);
  }

  suggestTierUpgrade(userId: string) {
    return this.pricingLogic.suggestTierUpgrade(userId);
  }

  handleWebhook(eventType: string, data: unknown): Promise<WebhookResult> {
    return this.webhookHandlers.handleWebhook(eventType, data);
  }

  // --- Private helpers ---

  private async createProcessorCustomer(_email: string, _userId: string, _name?: string): Promise<string> {
    if (this.config.processor === 'stripe' || this.config.processor === 'lemonsqueezy') {
      // For now, customer creation still uses processor-specific logic
      // as @finsavvyai/pay doesn't expose customer creation yet
      return `${this.config.processor}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    throw new Error(`Unsupported processor: ${this.config.processor}`);
  }
}

export type { BillingConfig, Customer, Subscription, CheckoutSession, UsageQuota, Invoice, BillingAnalytics };
export type { PaymentProcessor, SubscriptionTier };
