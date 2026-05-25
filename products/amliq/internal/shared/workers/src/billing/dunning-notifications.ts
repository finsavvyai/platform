/**
 * Dunning Notification Service
 * Sends customer notifications at each dunning stage.
 * PII is always masked in log output.
 */

import { NotificationType } from './dunning-models';
import {
  maskEmail,
  interpolateTemplate,
  DEFAULT_TEMPLATES,
} from './dunning-templates';

// Re-export utilities used by tests
export { maskEmail, interpolateTemplate, DEFAULT_TEMPLATES } from './dunning-templates';

// --- Interfaces ---

export interface EmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}

export interface WebhookEmitter {
  emit(event: string, payload: Record<string, unknown>): Promise<void>;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface SubscriptionInfo {
  id: string;
  customer_email: string;
  plan_name: string;
  amount: string;
  currency: string;
}

// --- Dunning Notifier ---

export class DunningNotifier {
  private readonly templates: Record<string, string>;

  constructor(
    private readonly emailSender: EmailSender,
    private readonly webhookEmitter: WebhookEmitter,
    private readonly logger: Logger,
    customTemplates?: Partial<Record<string, string>>
  ) {
    this.templates = { ...DEFAULT_TEMPLATES, ...customTemplates };
  }

  async sendPaymentFailed(
    subscription: SubscriptionInfo,
    attemptNumber: number
  ): Promise<void> {
    const vars = this.buildVars(subscription, { attempt: String(attemptNumber) });
    const body = interpolateTemplate(this.templates[NotificationType.PAYMENT_FAILED], vars);
    await this.send(subscription, NotificationType.PAYMENT_FAILED,
      'Payment Failed - Action Required', body, { attempt_number: attemptNumber });
  }

  async sendRetryScheduled(
    subscription: SubscriptionInfo,
    nextRetryDate: string
  ): Promise<void> {
    const vars = this.buildVars(subscription, { retry_date: nextRetryDate });
    const body = interpolateTemplate(this.templates[NotificationType.RETRY_SCHEDULED], vars);
    await this.send(subscription, NotificationType.RETRY_SCHEDULED,
      'Payment Retry Scheduled', body, { next_retry_date: nextRetryDate });
  }

  async sendFinalWarning(
    subscription: SubscriptionInfo,
    daysRemaining: number,
    action: string
  ): Promise<void> {
    const vars = this.buildVars(subscription, { days_remaining: String(daysRemaining), action });
    const body = interpolateTemplate(this.templates[NotificationType.FINAL_WARNING], vars);
    await this.send(subscription, NotificationType.FINAL_WARNING,
      'Final Payment Warning', body, { days_remaining: daysRemaining, action });
  }

  async sendSubscriptionAction(
    subscription: SubscriptionInfo,
    action: string
  ): Promise<void> {
    const vars = this.buildVars(subscription, { action });
    const body = interpolateTemplate(this.templates[NotificationType.SUBSCRIPTION_ACTION], vars);
    const label = action.charAt(0).toUpperCase() + action.slice(1);
    await this.send(subscription, NotificationType.SUBSCRIPTION_ACTION,
      `Subscription ${label}`, body, { action });
  }

  private buildVars(
    sub: SubscriptionInfo,
    extra: Record<string, string> = {}
  ): Record<string, string> {
    return {
      plan_name: sub.plan_name,
      amount: `${sub.currency} ${sub.amount}`,
      subscription_id: sub.id,
      ...extra,
    };
  }

  private async send(
    sub: SubscriptionInfo,
    type: string,
    subject: string,
    body: string,
    webhookPayload: Record<string, unknown>
  ): Promise<void> {
    const masked = maskEmail(sub.customer_email);
    this.logger.info('Sending dunning notification', {
      type, subscription_id: sub.id, recipient: masked,
    });

    try {
      await this.emailSender.send(sub.customer_email, subject, body);
    } catch (error) {
      this.logger.error('Email delivery failed', {
        type, subscription_id: sub.id, recipient: masked,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    try {
      await this.webhookEmitter.emit(`dunning.${type}`, {
        subscription_id: sub.id, type, ...webhookPayload,
      });
    } catch (error) {
      this.logger.error('Webhook emission failed', {
        type, subscription_id: sub.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
