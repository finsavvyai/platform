import { z } from 'zod';

export const validateCloudConnectionSchema = z.object({
  provider: z.enum(['aws', 'gcp', 'azure']),
  credentials: z.record(z.string()),
});
