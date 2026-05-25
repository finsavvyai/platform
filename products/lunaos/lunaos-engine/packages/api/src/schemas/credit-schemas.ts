/**
 * Zod schemas for credit system routes
 */

import { z } from 'zod';

export const creditEarnSchema = z.object({
  action: z.string().min(1, 'Action is required').max(64),
});
