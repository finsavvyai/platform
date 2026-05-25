import { z } from 'zod';

export const reviewSubmissionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(2000).optional(),
});
