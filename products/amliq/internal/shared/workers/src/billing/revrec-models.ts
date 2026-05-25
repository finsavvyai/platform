/**
 * Revenue Recognition Domain Models
 * ASC 606 / IFRS 15 compliant data structures with Zod validation.
 * Handles performance obligations, recognition schedules, and reporting.
 */

import { z } from 'zod';

// --- Enums ---

export const RecognitionType = {
  POINT_IN_TIME: 'point_in_time',
  OVER_TIME: 'over_time',
} as const;

export type RecognitionType = (typeof RecognitionType)[keyof typeof RecognitionType];

export const ObligationStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  SATISFIED: 'satisfied',
} as const;

export type ObligationStatus = (typeof ObligationStatus)[keyof typeof ObligationStatus];

export const ContractStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

// --- Zod Schemas ---

export const performanceObligationSchema = z.object({
  id: z.string().min(1, 'Obligation ID required'),
  description: z.string().min(1).max(500),
  standalone_selling_price: z.number().nonnegative('Price must be non-negative'),
  allocated_price: z.number().nonnegative().default(0),
  recognition_type: z.enum(['point_in_time', 'over_time']),
  satisfaction_date: z.string().datetime().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'satisfied']).default('pending'),
});

export type PerformanceObligation = z.infer<typeof performanceObligationSchema>;

export const revenueContractSchema = z.object({
  contract_id: z.string().uuid('Invalid contract ID'),
  tenant_id: z.string().uuid('Invalid tenant ID'),
  customer_id: z.string().min(1, 'Customer ID required'),
  name: z.string().min(1).max(255),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  total_value: z.number().positive('Total value must be positive'),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/, 'Invalid currency'),
  performance_obligations: z
    .array(performanceObligationSchema)
    .min(1, 'At least one performance obligation required')
    .max(50, 'Maximum 50 obligations per contract'),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).default('active'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
}).refine(
  (data) => new Date(data.start_date) < new Date(data.end_date),
  { message: 'start_date must be before end_date', path: ['end_date'] },
);

export type RevenueContract = z.infer<typeof revenueContractSchema>;

export const revenuePeriodSchema = z.object({
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  recognized_amount: z.number().nonnegative(),
  deferred_amount: z.number().nonnegative(),
});

export type RevenuePeriod = z.infer<typeof revenuePeriodSchema>;

export const revenueScheduleSchema = z.object({
  contract_id: z.string().uuid(),
  periods: z.array(revenuePeriodSchema).min(1),
  total_recognized: z.number().nonnegative(),
  total_deferred: z.number().nonnegative(),
});

export type RevenueSchedule = z.infer<typeof revenueScheduleSchema>;

export const revenueWaterfallSchema = z.object({
  opening_deferred: z.number().nonnegative(),
  new_bookings: z.number().nonnegative(),
  recognized: z.number().nonnegative(),
  closing_deferred: z.number().nonnegative(),
});

export type RevenueWaterfall = z.infer<typeof revenueWaterfallSchema>;

export const revenueReportSchema = z.object({
  report_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  total_recognized: z.number().nonnegative(),
  total_deferred: z.number().nonnegative(),
  waterfall: revenueWaterfallSchema,
  contract_breakdowns: z.array(z.object({
    contract_id: z.string().uuid(),
    contract_name: z.string(),
    recognized: z.number().nonnegative(),
    deferred: z.number().nonnegative(),
    completion_pct: z.number().min(0).max(100),
  })),
  generated_at: z.string().datetime(),
});

export type RevenueReport = z.infer<typeof revenueReportSchema>;
