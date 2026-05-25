/**
 * Revenue Recognition Validation Schemas
 * Zod schemas for API request/response payloads.
 * Validates date ranges, contract references, and period boundaries.
 */

import { z } from 'zod';
import { performanceObligationSchema } from './revrec-models';

// --- Common ---

const uuidField = z.string().uuid('Invalid ID format');
const dateTimeField = z.string().datetime('Invalid date format (ISO 8601 required)');

// --- Create Contract Schema ---

export const createContractSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
  name: z.string().min(1, 'Contract name is required').max(255, 'Name too long'),
  start_date: dateTimeField,
  end_date: dateTimeField,
  total_value: z.number().positive('Total value must be positive'),
  currency: z
    .string()
    .length(3, 'Currency must be 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency must be uppercase ISO 4217 code'),
  performance_obligations: z
    .array(performanceObligationSchema)
    .min(1, 'At least one performance obligation required')
    .max(50, 'Maximum 50 obligations per contract'),
}).refine(
  (data) => new Date(data.start_date) < new Date(data.end_date),
  {
    message: 'start_date must be before end_date',
    path: ['end_date'],
  },
);

export type CreateContractInput = z.infer<typeof createContractSchema>;

// --- Generate Report Schema ---

const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;

export const generateReportSchema = z.object({
  period_start: dateTimeField,
  period_end: dateTimeField,
}).refine(
  (data) => new Date(data.period_start) < new Date(data.period_end),
  {
    message: 'period_start must be before period_end',
    path: ['period_end'],
  },
).refine(
  (data) => {
    const diff = new Date(data.period_end).getTime() - new Date(data.period_start).getTime();
    return diff <= ONE_YEAR_MS;
  },
  {
    message: 'Reporting period cannot exceed 1 year',
    path: ['period_end'],
  },
);

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

// --- List Contracts Query Schema ---

export const listContractsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
  customer_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

// --- Get Report Schema ---

export const getReportSchema = z.object({
  report_id: uuidField,
});

export type GetReportInput = z.infer<typeof getReportSchema>;
