/**
 * SSO type definitions and Zod schemas
 *
 * Single source of truth for IdentityProvider and SsoSession across the
 * engine. Sibling services (sso-saml, sso-oidc, login-router, admin UI)
 * import from this module — do not redefine these types elsewhere.
 *
 * Validation rules:
 *  - type='oidc' requires oidcIssuer + oidcClientId + oidcClientSecret +
 *    oidcDiscoveryUrl.
 *  - type='saml' requires samlEntityId + samlSsoUrl + samlCertificate
 *    (PEM-formatted X.509).
 */

import { z } from 'zod';

// ─── Discriminator ───────────────────────────────────────────────────────────

export const IDP_TYPES = ['saml', 'oidc'] as const;
export type IdpType = (typeof IDP_TYPES)[number];

// ─── Reusable primitives ─────────────────────────────────────────────────────

const cuid = z.string().min(1, 'required').max(64);
const orgIdSchema = z.string().min(1, 'orgId required');
const idpNameSchema = z
    .string()
    .min(1, 'name required')
    .max(120, 'name too long');
const emailDomainSchema = z
    .string()
    .min(3, 'invalid domain')
    .max(253, 'invalid domain')
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'invalid domain')
    .optional()
    .nullable();
const httpsUrl = z
    .string()
    .url('must be a URL')
    .regex(/^https:\/\//i, 'must use https');

// PEM cert: must contain a BEGIN CERTIFICATE marker. Body validated downstream.
const pemCertificate = z
    .string()
    .min(64, 'certificate too short')
    .regex(
        /-----BEGIN CERTIFICATE-----/,
        'certificate must be PEM (-----BEGIN CERTIFICATE-----)',
    );

// ─── OIDC and SAML branches ──────────────────────────────────────────────────

const oidcBranch = z.object({
    type: z.literal('oidc'),
    oidcIssuer: httpsUrl,
    oidcClientId: z.string().min(1, 'oidcClientId required'),
    oidcClientSecret: z.string().min(1, 'oidcClientSecret required'),
    oidcDiscoveryUrl: httpsUrl,
    oidcScopes: z.string().min(1).default('openid email profile'),
    // SAML fields explicitly absent on this branch.
    samlEntityId: z.undefined().optional(),
    samlSsoUrl: z.undefined().optional(),
    samlCertificate: z.undefined().optional(),
    samlSloUrl: z.undefined().optional(),
});

const samlBranch = z.object({
    type: z.literal('saml'),
    samlEntityId: z.string().min(1, 'samlEntityId required'),
    samlSsoUrl: httpsUrl,
    samlCertificate: pemCertificate,
    samlSloUrl: httpsUrl.optional(),
    // OIDC fields explicitly absent on this branch.
    oidcIssuer: z.undefined().optional(),
    oidcClientId: z.undefined().optional(),
    oidcClientSecret: z.undefined().optional(),
    oidcDiscoveryUrl: z.undefined().optional(),
    oidcScopes: z.undefined().optional(),
});

const commonInput = z.object({
    orgId: orgIdSchema,
    name: idpNameSchema,
    enabled: z.boolean().default(true),
    emailDomain: emailDomainSchema,
    jitEnabled: z.boolean().default(true),
    defaultRole: z.string().min(1).max(64).default('member'),
});

// ─── Input schemas (create / update) ─────────────────────────────────────────

export const CreateIdpInput = z.discriminatedUnion('type', [
    oidcBranch.merge(commonInput),
    samlBranch.merge(commonInput),
]);
export type CreateIdpInput = z.infer<typeof CreateIdpInput>;

// Update is a partial of common fields plus an optional discriminated payload.
// The discriminator is required when any provider-specific field is updated;
// callers that only flip `enabled` may omit it.
const updateProviderPayload = z
    .discriminatedUnion('type', [
        oidcBranch.partial().required({ type: true }),
        samlBranch.partial().required({ type: true }),
    ])
    .optional();

export const UpdateIdpInput = commonInput
    .partial()
    .extend({
        provider: updateProviderPayload,
    });
export type UpdateIdpInput = z.infer<typeof UpdateIdpInput>;

// ─── Persisted-row schemas ───────────────────────────────────────────────────

export const IdentityProviderSchema = z.object({
    id: cuid,
    orgId: orgIdSchema,
    type: z.enum(IDP_TYPES),
    name: idpNameSchema,
    enabled: z.boolean(),
    emailDomain: z.string().nullable(),
    jitEnabled: z.boolean(),
    defaultRole: z.string(),

    oidcIssuer: z.string().nullable(),
    oidcClientId: z.string().nullable(),
    oidcClientSecret: z.string().nullable(),
    oidcDiscoveryUrl: z.string().nullable(),
    oidcScopes: z.string().nullable(),

    samlEntityId: z.string().nullable(),
    samlSsoUrl: z.string().nullable(),
    samlCertificate: z.string().nullable(),
    samlSloUrl: z.string().nullable(),

    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type IdentityProvider = z.infer<typeof IdentityProviderSchema>;

export const SsoSessionSchema = z.object({
    id: cuid,
    userId: z.string().min(1),
    orgId: orgIdSchema,
    idpId: cuid,
    nameId: z.string().min(1),
    sessionIndex: z.string().nullable(),
    expiresAt: z.coerce.date(),
    createdAt: z.coerce.date(),
});
export type SsoSession = z.infer<typeof SsoSessionSchema>;
