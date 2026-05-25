/**
 * SSO Connection Zod Schemas.
 * Shared between sso.ts route definitions and sso-handlers.ts.
 */

import { z } from 'zod';

export const createSchema = z.object({
	provider: z.enum(['saml', 'oidc']),
	displayName: z.string().min(1).max(100),
	domain: z.string().min(1).max(255),
	issuerUrl: z.string().url().optional(),
	clientId: z.string().max(500).optional(),
	metadataUrl: z.string().url().optional(),
	certificate: z.string().max(10000).optional(),
	jitEnabled: z.boolean().default(true),
});

export const updateSchema = createSchema.partial().extend({
	status: z.enum(['active', 'inactive']).optional(),
});
