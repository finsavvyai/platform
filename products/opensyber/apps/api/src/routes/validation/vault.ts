import { z } from 'zod';

export const storeSecretSchema = z.object({
  key: z.string().min(1).max(256).trim(),
  value: z.string().min(1).max(65536),
});
