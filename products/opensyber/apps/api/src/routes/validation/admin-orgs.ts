import { z } from 'zod';

export const updateOrgAdminSchema = z.object({
  plan: z.enum(['free', 'personal', 'pro', 'team']).optional(),
  maxInstances: z.number().int().min(0).max(100).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);
