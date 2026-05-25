/**
 * Comprehensive Input Validation Schemas
 * Zod schemas for all billing and subscription operations
 */

import { z } from 'zod';

// Common validation patterns
const uuidSchema = z.string().uuid('Invalid ID format');
const emailSchema = z.string().email('Invalid email format');
const currencySchema = z.string().length(3).regex(/^[A-Z]{3}$/, 'Invalid currency code');
const timestampSchema = z.string().datetime('Invalid datetime format');
const positiveNumberSchema = z.number().positive('Must be a positive number');
const nonNegativeIntegerSchema = z.number().int().nonnegative('Must be a non-negative integer');

// Customer validation schemas
export const createCustomerSchema = z.object({
  email: emailSchema,
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/, 'Invalid phone number').optional(),
  address: z.object({
    line1: z.string().min(1, 'Address line 1 is required').max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1, 'City is required').max(100),
    state: z.string().min(1, 'State is required').max(100),
    postal_code: z.string().min(1, 'Postal code is required').max(20),
    country: z.string().length(2).regex(/^[A-Z]{2}$/, 'Invalid country code')
  }).optional(),
  tax_id: z.string().regex(/^[A-Z0-9\s-]+$/, 'Invalid tax ID format').optional(),
  metadata: z.record(z.any()).optional()
});

// Subscription validation schemas
export const createSubscriptionSchema = z.object({
  customer_id: uuidSchema,
  plan_id: uuidSchema,
  billing_cycle: z.enum(['monthly', 'yearly', 'quarterly'], {
    errorMap: () => ({ message: 'Billing cycle must be monthly, yearly, or quarterly' })
  }),
  trial_period_days: nonNegativeIntegerSchema.max(365, 'Trial period cannot exceed 365 days').optional(),
  start_date: timestampSchema.optional(),
  payment_method_id: z.string().min(1, 'Payment method ID is required').max(100).optional(),
  quantity: nonNegativeIntegerSchema.max(1000, 'Quantity cannot exceed 1000').default(1),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    if (data.trial_period_days && data.trial_period_days > 0 && !data.payment_method_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Payment method ID is required when trial period is specified',
    path: ['payment_method_id']
  }
);

export const updateSubscriptionSchema = z.object({
  plan_id: uuidSchema.optional(),
  quantity: nonNegativeIntegerSchema.max(1000, 'Quantity cannot exceed 1000').optional(),
  billing_cycle: z.enum(['monthly', 'yearly', 'quarterly']).optional(),
  pause_at: timestampSchema.optional(),
  resume_at: timestampSchema.optional(),
  cancel_at_period_end: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    // Cannot have both pause_at and resume_at
    if (data.pause_at && data.resume_at) {
      return false;
    }
    // If resume_at is provided, it must be after pause_at
    if (data.resume_at && data.pause_at && new Date(data.resume_at) <= new Date(data.pause_at)) {
      return false;
    }
    return true;
  },
  {
    message: 'Invalid pause/resume configuration',
    path: ['pause_at']
  }
);

export const cancelSubscriptionSchema = z.object({
  cancel_at_period_end: z.boolean().default(true),
  reason: z.string().min(1, 'Cancellation reason is required').max(500, 'Reason too long').optional(),
  feedback: z.object({
    rating: z.number().int().min(1).max(5).optional(),
    comments: z.string().max(1000).optional(),
    category: z.enum(['price', 'features', 'support', 'technical', 'other']).optional(),
    would_recommend: z.boolean().optional()
  }).optional()
});

// Subscription plan validation schemas
export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100, 'Plan name too long'),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  amount: positiveNumberSchema.max(999999.99, 'Amount too large'),
  currency: currencySchema,
  billing_cycle: z.enum(['monthly', 'yearly', 'quarterly']),
  features: z.array(z.string().min(1).max(200)).max(50, 'Too many features'),
  metadata: z.record(z.any()).optional(),
  active: z.boolean().default(true)
}).refine(
  (data) => {
    // Validate amount based on billing cycle
    if (data.billing_cycle === 'monthly' && data.amount < 0.99) {
      return false;
    }
    if (data.billing_cycle === 'yearly' && data.amount < 9.99) {
      return false;
    }
    return true;
  },
  {
    message: 'Minimum amount is $0.99 for monthly and $9.99 for yearly plans',
    path: ['amount']
  }
);

export const updateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  amount: positiveNumberSchema.max(999999.99).optional(),
  currency: currencySchema.optional(),
  features: z.array(z.string().min(1).max(200)).max(50).optional(),
  metadata: z.record(z.any()).optional(),
  active: z.boolean().optional()
});

// Invoice validation schemas
export const createInvoiceSchema = z.object({
  customer_id: uuidSchema,
  items: z.array(z.object({
    description: z.string().min(1, 'Item description is required').max(500),
    quantity: positiveNumberSchema.max(999999, 'Quantity too large'),
    unit_price: positiveNumberSchema.max(999999.99, 'Unit price too large'),
    tax_rate: z.number().min(0).max(1, 'Tax rate must be between 0 and 1'),
    product_id: uuidSchema.optional(),
    category: z.string().min(1).max(100).optional()
  })).min(1, 'At least one item is required').max(100, 'Too many items'),
  due_date: timestampSchema.optional(),
  currency: currencySchema.default('USD'),
  purchase_order: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    // Calculate total and validate against business rules
    const total = data.items.reduce((sum, item) =>
      sum + (item.quantity * item.unit_price * (1 + item.tax_rate)), 0
    );
    return total > 0 && total <= 999999999.99; // Max $999,999,999.99
  },
  {
    message: 'Invoice total must be between $0.01 and $999,999,999.99',
    path: ['items']
  }
);

// Payment validation schemas
export const createPaymentSchema = z.object({
  invoice_id: uuidSchema,
  amount: positiveNumberSchema.max(999999.99, 'Payment amount too large'),
  currency: currencySchema,
  provider: z.enum(['stripe', 'lemonsqueezy', 'paypal']),
  payment_method_id: z.string().min(1, 'Payment method ID is required').max(100),
  metadata: z.record(z.any()).optional()
});

export const refundPaymentSchema = z.object({
  payment_id: uuidSchema,
  amount: positiveNumberSchema.max(999999.99, 'Refund amount too large'),
  reason: z.string().min(1, 'Refund reason is required').max(500),
  metadata: z.record(z.any()).optional()
}).refine(
  (data) => {
    // Refund amount cannot exceed typical limits
    return data.amount <= 50000; // Max $50,000 refund
  },
  {
    message: 'Refund amount cannot exceed $50,000',
    path: ['amount']
  }
);

// Query parameter validation schemas
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
  customer_id: uuidSchema.optional(),
  plan_id: uuidSchema.optional(),
  from_date: timestampSchema.optional(),
  to_date: timestampSchema.optional(),
  search: z.string().max(100).optional()
}).refine(
  (data) => {
    if (data.from_date && data.to_date && new Date(data.from_date) > new Date(data.to_date)) {
      return false;
    }
    return true;
  },
  {
    message: 'From date must be before to date',
    path: ['from_date']
  }
);

export const analyticsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
  from_date: timestampSchema.optional(),
  to_date: timestampSchema.optional(),
  metrics: z.array(z.enum(['mrr', 'arr', 'churn', 'ltv', 'acquisition', 'retention'])).optional()
}).refine(
  (data) => {
    if (data.from_date && data.to_date && new Date(data.from_date) > new Date(data.to_date)) {
      return false;
    }
    return true;
  },
  {
    message: 'From date must be before to date',
    path: ['from_date']
  }
);

// Security validation schemas
export const apiKeySchema = z.object({
  key: z.string().min(20, 'API key too short').max(200, 'API key too long'),
  name: z.string().min(1, 'API key name is required').max(100),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).min(1, 'At least one permission required'),
  expires_at: timestampSchema.optional()
});

export const webhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string().min(1)).min(1, 'At least one event required'),
  secret: z.string().min(20, 'Webhook secret too short').max(200),
  active: z.boolean().default(true)
});

// Error types for consistent error responses
export type ValidationError = z.ZodError;
export type ValidationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ValidationError;
};

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

// Sanitization helpers
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input.trim().slice(0, maxLength);
}

export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof key === 'string' && key.length <= 100) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value, 1000);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value) && value.length <= 100) {
        sanitized[key] = value.slice(0, 100);
      }
    }
  }
  return sanitized;
}
