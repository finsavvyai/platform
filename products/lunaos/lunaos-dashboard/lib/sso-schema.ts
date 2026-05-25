/**
 * Zod schema for the IdP create/edit form.
 * Used by both /admin/sso/new and /admin/sso/[id] pages.
 */
import { z } from 'zod';

const baseShape = {
    name: z.string().min(1, 'Name is required').max(100),
    type: z.enum(['saml', 'oidc'] as const, { required_error: 'Provider type is required' }),
    emailDomain: z
        .string()
        .min(1, 'Email domain is required')
        .toLowerCase()
        .regex(/^[a-z0-9]+([\-.][a-z0-9]+)*\.[a-z]{2,}$/, 'Enter a valid domain (e.g. acme.com)'),
    defaultRole: z.enum(['member', 'admin'] as const),
    jitEnabled: z.boolean(),
    oidcIssuer: z.string().optional(),
    oidcClientId: z.string().optional(),
    oidcClientSecret: z.string().optional(),
    oidcDiscoveryUrl: z.string().optional(),
    oidcScopes: z.string().optional(),
    samlEntityId: z.string().optional(),
    samlSsoUrl: z.string().optional(),
    samlCertificate: z.string().optional(),
    samlSloUrl: z.string().optional(),
};

type BaseData = {
    type: 'saml' | 'oidc';
    oidcIssuer?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
    oidcDiscoveryUrl?: string;
    samlEntityId?: string;
    samlSsoUrl?: string;
    samlCertificate?: string;
};

function oidcSamlRefine(data: BaseData, ctx: z.RefinementCtx, requireSecrets: boolean) {
    if (data.type === 'oidc') {
        if (!data.oidcIssuer) ctx.addIssue({ path: ['oidcIssuer'], code: 'custom', message: 'Issuer URL is required for OIDC' });
        if (!data.oidcClientId) ctx.addIssue({ path: ['oidcClientId'], code: 'custom', message: 'Client ID is required for OIDC' });
        if (requireSecrets && !data.oidcClientSecret) ctx.addIssue({ path: ['oidcClientSecret'], code: 'custom', message: 'Client Secret is required for OIDC' });
        if (!data.oidcDiscoveryUrl) ctx.addIssue({ path: ['oidcDiscoveryUrl'], code: 'custom', message: 'Discovery URL is required for OIDC' });
    }
    if (data.type === 'saml') {
        if (!data.samlEntityId) ctx.addIssue({ path: ['samlEntityId'], code: 'custom', message: 'Entity ID is required for SAML' });
        if (!data.samlSsoUrl) ctx.addIssue({ path: ['samlSsoUrl'], code: 'custom', message: 'SSO URL is required for SAML' });
        if (requireSecrets && !data.samlCertificate) ctx.addIssue({ path: ['samlCertificate'], code: 'custom', message: 'Certificate is required for SAML' });
    }
}

/** Schema for creating a new provider — secrets are required */
export const idpFormSchema = z.object(baseShape).superRefine((data, ctx) => {
    oidcSamlRefine(data, ctx, true);
});

/** Schema for editing — secrets optional (empty = keep current) */
export const idpEditSchema = z.object(baseShape).superRefine((data, ctx) => {
    oidcSamlRefine(data, ctx, false);
});

export type IdpFormValues = z.infer<typeof idpFormSchema>;
