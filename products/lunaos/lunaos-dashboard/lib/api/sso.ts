/**
 * LunaOS Dashboard — SSO API client
 * Wraps /v1/sso/* endpoints.
 *
 * SECURITY (FIND-005): SSO admin & discovery calls authenticate via the
 * `sso_session` HttpOnly cookie set by the engine on IdP callback. We do NOT
 * attach a Bearer token here — `credentials: 'include'` causes the browser
 * (or Next server runtime when called server-side with a forwarded Cookie
 * header) to send the cookie. This isolates the SSO surface from the legacy
 * localStorage-backed Bearer flow used elsewhere in the dashboard.
 *
 * Backend coordination requirement: the engine middleware on /v1/sso/* must
 * accept either Bearer or `sso_session` cookie. See PR description for the
 * `cookie-or-bearer-auth` middleware spec.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lunaos.ai';

export type IdpType = 'saml' | 'oidc';
export type DefaultRole = 'member' | 'admin';

export interface IdentityProvider {
    id: string;
    name: string;
    type: IdpType;
    emailDomain: string;
    defaultRole: DefaultRole;
    jitEnabled: boolean;
    enabled: boolean;
    createdAt: string;
    // OIDC fields (may be redacted from server)
    oidcIssuer?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
    oidcDiscoveryUrl?: string;
    oidcScopes?: string;
    // SAML fields (may be redacted from server)
    samlEntityId?: string;
    samlSsoUrl?: string;
    samlCertificate?: string;
    samlSloUrl?: string;
}

export interface CreateIdpInput {
    name: string;
    type: IdpType;
    emailDomain: string;
    defaultRole: DefaultRole;
    jitEnabled: boolean;
    oidcIssuer?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
    oidcDiscoveryUrl?: string;
    oidcScopes?: string;
    samlEntityId?: string;
    samlSsoUrl?: string;
    samlCertificate?: string;
    samlSloUrl?: string;
}

export interface SsoDiscoveryResult {
    idpId: string;
    type: IdpType;
    initiateUrl: string;
}

export interface SsoInitiateResult {
    redirectUrl?: string;
    method?: 'GET' | 'POST';
    url?: string;
    params?: Record<string, string>;
}

/**
 * Cookie-credentialed fetch for SSO endpoints. Always sends cookies, never
 * attaches a Bearer header. An optional `forwardCookie` argument lets server
 * components (Next.js App Router) pass through the client's cookie when
 * calling cross-origin from the Next server runtime.
 */
async function ssoFetch(path: string, options: RequestInit = {}, forwardCookie?: string): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined ?? {}),
    };
    if (forwardCookie) headers['Cookie'] = forwardCookie;
    return fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers,
    });
}

export interface SsoFetchContext {
    /** Forwarded cookie header for server-component calls (Next App Router). */
    cookie?: string;
}

export const ssoApi = {
    list: async (ctx: SsoFetchContext = {}): Promise<{ idps: IdentityProvider[] }> => {
        const res = await ssoFetch('/v1/sso/idp', {}, ctx.cookie);
        if (!res.ok) throw Object.assign(new Error('list_failed'), { status: res.status });
        return res.json();
    },

    get: async (id: string, ctx: SsoFetchContext = {}): Promise<{ idp: IdentityProvider }> => {
        const res = await ssoFetch(`/v1/sso/idp/${id}`, {}, ctx.cookie);
        if (!res.ok) throw Object.assign(new Error('get_failed'), { status: res.status });
        return res.json();
    },

    create: async (input: CreateIdpInput): Promise<{ idp: IdentityProvider }> => {
        const res = await ssoFetch('/v1/sso/idp', {
            method: 'POST',
            body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw Object.assign(new Error('create_failed'), { status: res.status, data });
        return data;
    },

    update: async (id: string, input: Partial<CreateIdpInput> & { enabled?: boolean }): Promise<{ idp: IdentityProvider }> => {
        const res = await ssoFetch(`/v1/sso/idp/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw Object.assign(new Error('update_failed'), { status: res.status, data });
        return data;
    },

    remove: async (id: string): Promise<void> => {
        const res = await ssoFetch(`/v1/sso/idp/${id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 204) throw Object.assign(new Error('delete_failed'), { status: res.status });
    },

    discover: async (email: string): Promise<SsoDiscoveryResult | null> => {
        const res = await ssoFetch(`/v1/sso/discovery?email=${encodeURIComponent(email)}`);
        if (res.status === 404) return null;
        if (!res.ok) throw Object.assign(new Error('discover_failed'), { status: res.status });
        return res.json();
    },

    initiateOidc: async (idpId: string, returnPath?: string): Promise<SsoInitiateResult> => {
        const res = await ssoFetch('/v1/sso/oidc/initiate', {
            method: 'POST',
            body: JSON.stringify({ idpId, returnPath }),
        });
        if (!res.ok) throw Object.assign(new Error('initiate_failed'), { status: res.status });
        return res.json();
    },

    initiateSaml: async (idpId: string, returnPath?: string): Promise<SsoInitiateResult> => {
        const res = await ssoFetch('/v1/sso/saml/initiate', {
            method: 'POST',
            body: JSON.stringify({ idpId, returnPath }),
        });
        if (!res.ok) throw Object.assign(new Error('initiate_failed'), { status: res.status });
        return res.json();
    },
};

// Exported for tests
export { ssoFetch, API_URL };
