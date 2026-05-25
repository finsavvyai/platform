import { z } from 'zod';

export const autoTriggerSchema = z.object({
  severity: z.string().max(50).optional(),
  type: z.string().max(100).optional(),
});
