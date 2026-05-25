import { z } from 'zod';

export const moderateSkillSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(1000).optional(),
});
