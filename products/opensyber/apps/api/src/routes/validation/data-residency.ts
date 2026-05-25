import { z } from 'zod';

export const updateResidencySchema = z.object({
  region: z.enum(['eu', 'us', 'ap']),
  enforceStrict: z.boolean().optional(),
});
