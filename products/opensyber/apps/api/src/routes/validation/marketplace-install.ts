import { z } from 'zod';

export const marketplaceInstallSchema = z.object({
  instanceId: z.string().min(1),
});
