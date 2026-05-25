/**
 * Dunning Validation Schemas
 * Zod schemas for dunning API operations.
 * Follows the same pattern as validation-schemas.ts.
 */

import { z } from 'zod';

// --- Common patterns ---

const uuidSchema = z.string().uuid('Invalid ID format');

// --- Create Dunning Config Schema ---

export const createDunningConfigSchema = z.object({
  retry_intervals_days: z
    .array(z.number().int().positive('Interval must be positive'))
    .min(1, 'At least one retry interval required')
    .max(10, 'Maximum 10 retry intervals'),
  max_retries: z
    .number()
    .int()
    .min(1, 'At least 1 retry required')
    .max(10, 'Maximum 10 retries'),
  grace_period_days: z
    .number()
    .int()
    .min(0, 'Grace period cannot be negative')
    .max(30, 'Grace period cannot exceed 30 days'),
  final_action: z.enum(['cancel', 'pause', 'downgrade'], {
    errorMap: () => ({ message: 'Final action must be cancel, pause, or downgrade' }),
  }),
}).refine(
  (data) => data.retry_intervals_days.length <= data.max_retries,
  {
    message: 'Number of retry intervals cannot exceed max_retries',
    path: ['retry_intervals_days'],
  }
);

// --- Update Dunning Config Schema ---

export const updateDunningConfigSchema = z.object({
  retry_intervals_days: z
    .array(z.number().int().positive())
    .min(1)
    .max(10)
    .optional(),
  max_retries: z.number().int().min(1).max(10).optional(),
  grace_period_days: z.number().int().min(0).max(30).optional(),
  final_action: z.enum(['cancel', 'pause', 'downgrade']).optional(),
}).refine(
  (data) => Object.keys(data).some((key) => data[key as keyof typeof data] !== undefined),
  {
    message: 'At least one field must be provided for update',
    path: [],
  }
);

// --- Dunning Webhook Schema ---

export const dunningWebhookSchema = z.object({
  type: z.enum([
    'invoice.payment_failed',
    'subscription_payment_failed',
  ], {
    errorMap: () => ({ message: 'Unsupported webhook event type' }),
  }),
  data: z.object({
    subscription_id: uuidSchema,
    invoice_id: uuidSchema,
    tenant_id: uuidSchema,
    amount: z.number().positive('Amount must be positive'),
    currency: z.string().length(3).regex(/^[A-Z]{3}$/, 'Invalid currency code'),
    failure_reason: z.string().max(500).optional(),
    payment_method_type: z.string().max(50).optional(),
  }),
  event_id: z.string().min(1, 'Event ID is required').max(100),
  timestamp: z.string().datetime('Invalid timestamp format'),
});

// --- Manual Retry Schema ---

export const manualRetrySchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
  override_idempotency: z.boolean().default(false),
});

// --- Dunning Status Query Schema ---

export const dunningStatusQuerySchema = z.object({
  subscription_id: uuidSchema.optional(),
  status: z.enum(['active', 'succeeded', 'exhausted', 'cancelled']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.from_date && data.to_date) {
      return new Date(data.from_date) <= new Date(data.to_date);
    }
    return true;
  },
  {
    message: 'from_date must be before or equal to to_date',
    path: ['from_date'],
  }
);

// --- Dashboard Metrics Query Schema ---

export const dunningDashboardQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter']).default('month'),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

// --- Type Exports ---

export type CreateDunningConfigInput = z.infer<typeof createDunningConfigSchema>;
export type UpdateDunningConfigInput = z.infer<typeof updateDunningConfigSchema>;
export type DunningWebhookInput = z.infer<typeof dunningWebhookSchema>;
export type ManualRetryInput = z.infer<typeof manualRetrySchema>;
export type DunningStatusQuery = z.infer<typeof dunningStatusQuerySchema>;
export type DunningDashboardQuery = z.infer<typeof dunningDashboardQuerySchema>;
