import { z } from 'zod';

export const updateUserAdminSchema = z.object({
  isSuspended: z.boolean().optional(),
  plan: z.enum(['free', 'personal', 'pro', 'team']).optional(),
  isAdmin: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' },
);
