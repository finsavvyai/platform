import { z } from 'zod';

export const updateSlaConfigSchema = z.object({
  targetUptime: z.number().min(90).max(100).optional(),
  checkIntervalMinutes: z.number().int().min(1).max(60).optional(),
  alertOnBreach: z.boolean().optional(),
});
