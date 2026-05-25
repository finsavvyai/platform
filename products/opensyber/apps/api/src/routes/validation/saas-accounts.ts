import { z } from 'zod';

export const createSaasAccountSchema = z.object({
  provider: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  connectionType: z.enum(['oauth', 'api_key', 'saml']).default('oauth'),
});
