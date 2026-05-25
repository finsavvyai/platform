import { z } from 'zod';

export const rateSkillSchema = z.object({
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});
