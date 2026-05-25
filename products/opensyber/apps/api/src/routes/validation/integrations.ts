import { z } from 'zod';

export const connectIntegrationSchema = z.object({
  integrationSlug: z.string().min(1).max(100),
  instanceId: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});
