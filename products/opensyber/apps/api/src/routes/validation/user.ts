import { z } from 'zod';

export const updateOnboardingSchema = z.object({
  step: z.string().min(1).max(100).optional(),
  dismiss: z.boolean().optional(),
}).refine((data) => data.step || data.dismiss, {
  message: 'Provide step or dismiss',
});
