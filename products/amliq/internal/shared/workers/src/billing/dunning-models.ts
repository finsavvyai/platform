/**
 * Dunning Domain Models and Configuration
 * Types and Zod schemas for automated dunning and retry logic.
 * Handles failed subscription payments with configurable backoff.
 */

import { z } from 'zod';

// --- Enums ---

export const DunningFinalAction = {
  CANCEL: 'cancel',
  PAUSE: 'pause',
  DOWNGRADE: 'downgrade',
} as const;

export type DunningFinalAction = (typeof DunningFinalAction)[keyof typeof DunningFinalAction];

export const DunningAttemptStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;

export type DunningAttemptStatus = (typeof DunningAttemptStatus)[keyof typeof DunningAttemptStatus];

export const DunningScheduleStatus = {
  ACTIVE: 'active',
  SUCCEEDED: 'succeeded',
  EXHAUSTED: 'exhausted',
  CANCELLED: 'cancelled',
} as const;

export type DunningScheduleStatus = (typeof DunningScheduleStatus)[keyof typeof DunningScheduleStatus];

export const NotificationType = {
  PAYMENT_FAILED: 'payment_failed',
  RETRY_SCHEDULED: 'retry_scheduled',
  FINAL_WARNING: 'final_warning',
  SUBSCRIPTION_ACTION: 'subscription_action',
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// --- Zod Schemas ---

export const dunningConfigSchema = z.object({
  retry_intervals_days: z
    .array(z.number().int().positive('Interval must be positive'))
    .min(1, 'At least one retry interval required')
    .max(10, 'Maximum 10 retry intervals'),
  max_retries: z.number().int().min(1).max(10),
  grace_period_days: z.number().int().min(0).max(30),
  final_action: z.enum(['cancel', 'pause', 'downgrade']),
});

export type DunningConfig = z.infer<typeof dunningConfigSchema>;

export const dunningAttemptSchema = z.object({
  attempt_number: z.number().int().min(1),
  scheduled_at: z.string().datetime(),
  executed_at: z.string().datetime().nullable(),
  status: z.enum(['pending', 'processing', 'succeeded', 'failed']),
  error_message: z.string().max(500).nullable(),
  payment_provider_response: z.string().max(2000).nullable(),
  idempotency_key: z.string().min(1).max(100),
});

export type DunningAttempt = z.infer<typeof dunningAttemptSchema>;

export const dunningScheduleSchema = z.object({
  id: z.string().uuid(),
  subscription_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  config: dunningConfigSchema,
  attempts: z.array(dunningAttemptSchema),
  current_status: z.enum(['active', 'succeeded', 'exhausted', 'cancelled']),
  next_retry_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DunningSchedule = z.infer<typeof dunningScheduleSchema>;

export const dunningNotificationSchema = z.object({
  id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  type: z.enum([
    'payment_failed',
    'retry_scheduled',
    'final_warning',
    'subscription_action',
  ]),
  recipient_email: z.string().email(),
  sent_at: z.string().datetime().nullable(),
  template_vars: z.record(z.string()),
});

export type DunningNotification = z.infer<typeof dunningNotificationSchema>;

// --- Default Configuration ---

export function createDefaultDunningConfig(): DunningConfig {
  return {
    retry_intervals_days: [1, 3, 5, 7],
    max_retries: 4,
    grace_period_days: 3,
    final_action: 'cancel',
  };
}

// --- Idempotency Key Generator ---

export function generateIdempotencyKey(
  scheduleId: string,
  attemptNumber: number
): string {
  return `dunning_${scheduleId}_attempt_${attemptNumber}`;
}

// --- Next Retry Calculator ---

export function calculateNextRetryAt(
  config: DunningConfig,
  attemptNumber: number,
  baseDate: Date = new Date()
): Date | null {
  if (attemptNumber >= config.max_retries) {
    return null;
  }

  const intervalIndex = Math.min(
    attemptNumber,
    config.retry_intervals_days.length - 1
  );
  const daysToAdd = config.retry_intervals_days[intervalIndex];
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}
