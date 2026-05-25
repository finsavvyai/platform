import { z } from 'zod';

export const createOauthAppSchema = z.object({
  appName: z.string().min(1).max(255),
  appId: z.string().min(1).max(255),
  provider: z.string().min(1).max(100),
  scopes: z.array(z.string()).default([]),
  grantedBy: z.string().max(255).optional(),
});
