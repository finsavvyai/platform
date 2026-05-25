import { SupabaseClient } from '@supabase/supabase-js';
import {
  WebhookHandler as PayWebhookHandler,
  type WebhookEvent,
} from '@finsavvyai/pay';
import {
  BillingConfig,
  WebhookResult,
} from './types';

interface WebhookHandlerDeps {
  config: BillingConfig;
  getAdminClient: () => SupabaseClient;
}

export class WebhookHandlers {
  private deps: WebhookHandlerDeps;
  private payWebhookHandler: PayWebhookHandler;

  constructor(deps: WebhookHandlerDeps) {
    this.deps = deps;
    this.payWebhookHandler = new PayWebhookHandler({
      provider: deps.config.processor,
      secret: deps.config.signingSecret,
    });
  }

  async handleWebhook(eventType: string, data: unknown): Promise<WebhookResult> {
    try {
      switch (eventType) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(data as Record<string, unknown>);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaid(data as Record<string, unknown>);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoiceFailed(data as Record<string, unknown>);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(data as Record<string, unknown>);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(data as Record<string, unknown>);
          break;
        default:
          console.log(`Unhandled webhook event type: ${eventType}`);
      }
      return { success: true, processed: true };
    } catch (error) {
      console.error('Webhook processing failed:', error);
      return {
        success: false, processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /** Verify and parse raw webhook using @finsavvyai/pay */
  async verifyAndParse(signature: string, payload: string): Promise<WebhookEvent> {
    return this.payWebhookHandler.handle(signature, payload);
  }

  private async handleCheckoutCompleted(session: Record<string, unknown>): Promise<void> {
    const admin = this.deps.getAdminClient();
    const metadata = session.metadata as Record<string, string> | undefined;
    if (!metadata) return;

    await admin.from('checkout_sessions')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('processor_session_id', session.id);

    await admin.from('subscriptions').insert({
      id: crypto.randomUUID(),
      customer_id: session.customer as string,
      user_id: metadata.user_id,
      product_id: metadata.product_id,
      tier: metadata.tier,
      processor: this.deps.config.processor,
      processor_subscription_id: session.subscription as string,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date((session.expires_at as number) * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  private async handleInvoicePaid(invoice: Record<string, unknown>): Promise<void> {
    const admin = this.deps.getAdminClient();
    await admin.from('invoices').insert({
      id: crypto.randomUUID(),
      processor: this.deps.config.processor,
      processor_invoice_id: invoice.id,
      number: invoice.number,
      amount: (invoice.amount_paid as number) / 100,
      currency: (invoice.currency as string).toUpperCase(),
      status: 'paid',
      due_date: new Date((invoice.due_date as number) * 1000).toISOString(),
      paid_at: new Date((invoice.created as number) * 1000).toISOString(),
      pdf_url: invoice.invoice_pdf,
      created: new Date((invoice.created as number) * 1000).toISOString(),
    });
  }

  private async handleInvoiceFailed(invoice: Record<string, unknown>): Promise<void> {
    const admin = this.deps.getAdminClient();
    await admin.from('invoices').insert({
      id: crypto.randomUUID(),
      processor: this.deps.config.processor,
      processor_invoice_id: invoice.id,
      number: invoice.number,
      amount: (invoice.amount_due as number) / 100,
      currency: (invoice.currency as string).toUpperCase(),
      status: 'open',
      due_date: new Date((invoice.due_date as number) * 1000).toISOString(),
      created: new Date((invoice.created as number) * 1000).toISOString(),
    });

    if (invoice.subscription) {
      await admin.from('subscriptions')
        .update({ status: 'past_due' })
        .eq('processor_subscription_id', invoice.subscription);
    }
  }

  private async handleSubscriptionUpdated(subscription: Record<string, unknown>): Promise<void> {
    await this.deps.getAdminClient().from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
        current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('processor_subscription_id', subscription.id);
  }

  private async handleSubscriptionDeleted(subscription: Record<string, unknown>): Promise<void> {
    await this.deps.getAdminClient().from('subscriptions')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('processor_subscription_id', subscription.id);
  }
}
