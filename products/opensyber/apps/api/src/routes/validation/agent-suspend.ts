import { z } from 'zod';

export const suspendActionSchema = z.object({
  currentStatus: z.string().optional(),
  reason: z.string().max(1000).optional(),
});
