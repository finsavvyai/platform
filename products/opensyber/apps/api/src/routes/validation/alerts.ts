import { z } from 'zod';

export const createAlertRuleSchema = z.object({
  name: z.string({ required_error: 'name is required' }).min(1, 'name is required').max(200),
  eventType: z.string({ required_error: 'eventType is required' }).min(1, 'eventType is required').max(200),
  severityFilter: z.string().max(50).optional(),
  threshold: z.number().int().min(1).optional().default(1),
  windowMinutes: z.number().int().min(1).optional().default(60),
  cooldownMinutes: z.number().int().min(0).optional().default(30),
});

export const updateAlertRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  eventType: z.string().min(1).max(200).optional(),
  severityFilter: z.string().max(50).nullable().optional(),
  threshold: z.number().int().min(1).optional(),
  windowMinutes: z.number().int().min(1).optional(),
  cooldownMinutes: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateAlertStatusSchema = z.object({
  status: z.enum(['acknowledged', 'resolved'], {
    errorMap: () => ({ message: 'status must be "acknowledged" or "resolved"' }),
  }),
});
