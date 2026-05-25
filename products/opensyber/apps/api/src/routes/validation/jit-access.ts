import { z } from 'zod';

export const createJitRequestSchema = z.object({
  secretId: z.string().min(1).max(256),
  reason: z.string().min(1).max(1000),
  durationMinutes: z.number().int().min(1).max(1440).optional().default(60),
});
