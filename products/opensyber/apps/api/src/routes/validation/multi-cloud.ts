import { z } from 'zod';

const PROVIDERS = ['aws', 'gcp', 'azure'] as const;

export const createMultiCloudConfigSchema = z.object({
  provider: z.enum(PROVIDERS),
  displayName: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional().default({}),
  region: z.string().max(50).nullish(),
});
