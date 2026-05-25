import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DunningNotifier,
  EmailSender,
  WebhookEmitter,
  Logger,
  SubscriptionInfo,
  maskEmail,
  interpolateTemplate,
  DEFAULT_TEMPLATES,
} from '../dunning-notifications';

function createMockEmailSender(): EmailSender {
  return { send: vi.fn(async () => {}) };
}

function createMockWebhookEmitter(): WebhookEmitter {
  return { emit: vi.fn(async () => {}) };
}

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
  };
}

const SUB_INFO: SubscriptionInfo = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  customer_email: 'john.doe@example.com',
  plan_name: 'Pro',
  amount: '49.99',
  currency: 'USD',
};

describe('maskEmail', () => {
  it('masks email keeping first two characters of local part', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com');
  });

  it('handles short local parts', () => {
    expect(maskEmail('a@example.com')).toBe('***@***');
  });

  it('handles single character local part', () => {
    expect(maskEmail('x@test.com')).toBe('***@***');
  });

  it('handles two character local part', () => {
    expect(maskEmail('ab@test.com')).toBe('ab***@test.com');
  });
});

describe('interpolateTemplate', () => {
  it('replaces template variables', () => {
    const result = interpolateTemplate(
      'Hello {{name}}, your plan is {{plan}}.',
      { name: 'John', plan: 'Pro' }
    );
    expect(result).toBe('Hello John, your plan is Pro.');
  });

  it('preserves unmatched variables', () => {
    const result = interpolateTemplate(
      'Amount: {{amount}}, Date: {{date}}',
      { amount: '$50' }
    );
    expect(result).toBe('Amount: $50, Date: {{date}}');
  });

  it('handles empty variables', () => {
    const result = interpolateTemplate('No vars here', {});
    expect(result).toBe('No vars here');
  });

  it('handles multiple occurrences of same variable', () => {
    const result = interpolateTemplate(
      '{{name}} and {{name}}',
      { name: 'Alice' }
    );
    expect(result).toBe('Alice and Alice');
  });
});

describe('DunningNotifier', () => {
  let emailSender: EmailSender;
  let webhookEmitter: WebhookEmitter;
  let logger: Logger;
  let notifier: DunningNotifier;

  beforeEach(() => {
    emailSender = createMockEmailSender();
    webhookEmitter = createMockWebhookEmitter();
    logger = createMockLogger();
    notifier = new DunningNotifier(emailSender, webhookEmitter, logger);
  });

  describe('sendPaymentFailed', () => {
    it('sends email and webhook for payment failure', async () => {
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      expect(emailSender.send).toHaveBeenCalledOnce();
      expect(webhookEmitter.emit).toHaveBeenCalledWith(
        'dunning.payment_failed',
        expect.objectContaining({ subscription_id: SUB_INFO.id, attempt_number: 1 })
      );
    });

    it('includes amount in email body', async () => {
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      const emailBody = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(emailBody).toContain('USD 49.99');
    });
  });

  describe('sendRetryScheduled', () => {
    it('sends retry notification with date', async () => {
      await notifier.sendRetryScheduled(SUB_INFO, '2026-03-05');
      expect(emailSender.send).toHaveBeenCalledOnce();
      const emailBody = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(emailBody).toContain('2026-03-05');
    });

    it('emits webhook with next retry date', async () => {
      await notifier.sendRetryScheduled(SUB_INFO, '2026-03-05');
      expect(webhookEmitter.emit).toHaveBeenCalledWith(
        'dunning.retry_scheduled',
        expect.objectContaining({ next_retry_date: '2026-03-05' })
      );
    });
  });

  describe('sendFinalWarning', () => {
    it('sends final warning with days remaining', async () => {
      await notifier.sendFinalWarning(SUB_INFO, 3, 'cancel');
      const emailBody = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(emailBody).toContain('3 day(s)');
      expect(emailBody).toContain('cancel');
    });
  });

  describe('sendSubscriptionAction', () => {
    it('sends action notification', async () => {
      await notifier.sendSubscriptionAction(SUB_INFO, 'cancelled');
      const subject = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(subject).toContain('Cancelled');
      const emailBody = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(emailBody).toContain('cancelled');
    });
  });

  describe('PII masking in logs', () => {
    it('masks email in log output', async () => {
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      const logCall = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
      const meta = logCall[1];
      expect(meta.recipient).toBe('jo***@example.com');
      expect(meta.recipient).not.toContain('john.doe');
    });

    it('masks email in error log on email failure', async () => {
      (emailSender.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('SMTP error'));
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      const errorCall = (logger.error as ReturnType<typeof vi.fn>).mock.calls[0];
      const meta = errorCall[1];
      expect(meta.recipient).toBe('jo***@example.com');
      expect(meta.recipient).not.toContain('john.doe');
    });

    it('does not log raw email address anywhere', async () => {
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      const allLogCalls = [
        ...(logger.info as ReturnType<typeof vi.fn>).mock.calls,
        ...(logger.error as ReturnType<typeof vi.fn>).mock.calls,
      ];
      for (const call of allLogCalls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain('john.doe@example.com');
      }
    });
  });

  describe('error handling', () => {
    it('continues with webhook even if email fails', async () => {
      (emailSender.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('SMTP fail'));
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      expect(webhookEmitter.emit).toHaveBeenCalledOnce();
      expect(logger.error).toHaveBeenCalledOnce();
    });

    it('logs error when webhook fails', async () => {
      (webhookEmitter.emit as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Webhook fail'));
      await notifier.sendPaymentFailed(SUB_INFO, 1);
      expect(logger.error).toHaveBeenCalledOnce();
    });
  });

  describe('custom templates', () => {
    it('uses custom templates when provided', async () => {
      const customNotifier = new DunningNotifier(
        emailSender,
        webhookEmitter,
        logger,
        { payment_failed: 'Custom: your {{amount}} payment failed!' }
      );
      await customNotifier.sendPaymentFailed(SUB_INFO, 1);
      const emailBody = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(emailBody).toContain('Custom: your USD 49.99 payment failed!');
    });

    it('falls back to defaults for non-overridden templates', async () => {
      const customNotifier = new DunningNotifier(
        emailSender,
        webhookEmitter,
        logger,
        { payment_failed: 'Custom message' }
      );
      await customNotifier.sendRetryScheduled(SUB_INFO, '2026-03-05');
      const emailBody = (emailSender.send as ReturnType<typeof vi.fn>).mock.calls[0][2];
      expect(emailBody).toContain('retry');
    });
  });
});
