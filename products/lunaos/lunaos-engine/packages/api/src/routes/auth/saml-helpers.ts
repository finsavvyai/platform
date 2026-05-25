/**
 * Internal helpers for the SAML SP routes (split out of saml.ts to keep each
 * file under the 200-line cap). All exports here are SAML-route-private — do
 * not import from outside src/routes/auth/.
 */

import type { IdentityProvider } from '../../types/sso';

export const RELAY_TTL = 600;
export const AUTHNREQ_TTL = 600;
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export async function loadIdp(
    db: D1Database,
    id: string,
): Promise<IdentityProvider | null> {
    const row = await db
        .prepare('SELECT * FROM identity_providers WHERE id = ? LIMIT 1')
        .bind(id)
        .first<any>();
    if (!row) return null;
    return {
        id: row.id,
        orgId: row.org_id,
        type: row.type,
        name: row.name,
        enabled: !!row.enabled,
        emailDomain: row.email_domain ?? null,
        jitEnabled: !!row.jit_enabled,
        defaultRole: row.default_role,
        oidcIssuer: row.oidc_issuer ?? null,
        oidcClientId: row.oidc_client_id ?? null,
        oidcClientSecret: row.oidc_client_secret ?? null,
        oidcDiscoveryUrl: row.oidc_discovery_url ?? null,
        oidcScopes: row.oidc_scopes ?? null,
        samlEntityId: row.saml_entity_id ?? null,
        samlSsoUrl: row.saml_sso_url ?? null,
        samlCertificate: row.saml_certificate ?? null,
        samlSloUrl: row.saml_slo_url ?? null,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
    };
}

export function randomToken(bytes: number): string {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return base64UrlEncode(buf);
}

export function base64UrlEncode(bytes: Uint8Array): string {
    return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64Encode(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}

/**
 * Validate a return path: must start with a single '/', must not be a
 * protocol-relative URL ('//foo'), and must not contain '://'. Falls back to
 * '/dashboard' on any rejection. Length-bounded.
 */
export function sanitiseReturnPath(p: string | undefined | null): string {
    if (!p || typeof p !== 'string') return '/dashboard';
    if (!p.startsWith('/')) return '/dashboard';
    if (p.startsWith('//')) return '/dashboard';
    if (p.includes('://')) return '/dashboard';
    return p.length > 512 ? '/dashboard' : p;
}

export function safeJsonParse(s: string): any | null {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

/** HMAC-SHA256-signed cookie value: "<sessionId>.<sig>". */
export async function signCookieValue(
    sessionId: string,
    secret: string,
): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(sessionId),
    );
    return `${sessionId}.${base64UrlEncode(new Uint8Array(sig))}`;
}
