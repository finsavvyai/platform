import { z } from 'zod';

export const evaluateKillChainSchema = z.object({
  eventId: z.string().min(1),
});
