/**
 * Dunning Template Utilities
 * PII masking, template interpolation, and default notification templates.
 */

import { NotificationType } from './dunning-models';

// --- PII Masking ---

export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 1) return '***@***';
  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  const visible = localPart.substring(0, 2);
  return `${visible}***${domain}`;
}

// --- Template Interpolation ---

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

// --- Default Templates ---

export const DEFAULT_TEMPLATES: Record<string, string> = {
  [NotificationType.PAYMENT_FAILED]:
    'Your payment of {{amount}} for {{plan_name}} has failed. ' +
    'We will retry automatically. Please update your payment method.',
  [NotificationType.RETRY_SCHEDULED]:
    'We will retry your payment of {{amount}} on {{retry_date}}. ' +
    'Update your payment method to avoid service interruption.',
  [NotificationType.FINAL_WARNING]:
    'Final notice: your payment is past due. Your {{plan_name}} subscription ' +
    'will be {{action}} in {{days_remaining}} day(s) unless payment is received.',
  [NotificationType.SUBSCRIPTION_ACTION]:
    'Your {{plan_name}} subscription has been {{action}} due to payment failure. ' +
    'Contact support to restore your account.',
};
