import { z } from 'zod';

export const updateVulnStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'fixed', 'ignored', 'false_positive']),
});
