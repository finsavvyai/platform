import { z } from 'zod';

const VALID_PROVIDERS = ['saml', 'oidc'] as const;
const VALID_ROLES = ['owner', 'admin', 'security', 'developer', 'viewer'] as const;

export const upsertSsoConfigSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
  entityId: z.string().max(500).nullish(),
  ssoUrl: z.string().url().max(2000).nullish(),
  certificate: z.string().max(10000).nullish(),
  oidcClientId: z.string().max(256).nullish(),
  oidcClientSecret: z.string().max(256).nullish(),
  oidcIssuer: z.string().url().max(2000).nullish(),
  autoProvision: z.boolean().optional().default(false),
  defaultRole: z.enum(VALID_ROLES).optional().default('viewer'),
  isActive: z.boolean().optional().default(false),
});
