/**
 * IdP Service — DB helpers for identity_providers CRUD operations.
 *
 * All writes accept an Env for secret-vault operations.
 * safeIdp() redacts encrypted secrets before returning to callers.
 */

import { encryptSecret, redactForDisplay } from './secret-vault';
import { CreateIdpInput, UpdateIdpInput } from '../types/sso';

/** Minimal env shape required by secret-vault operations. */
export interface IdpVaultEnv {
    SSO_VAULT_KEY?: string;
}

/** Safe display row — never exposes raw encrypted secret. */
export async function safeIdp(row: Record<string, unknown>) {
    return {
        id: row.id,
        orgId: row.org_id,
        type: row.type,
        name: row.name,
        enabled: Boolean(row.enabled),
        emailDomain: row.email_domain ?? null,
        jitEnabled: Boolean(row.jit_enabled),
        defaultRole: row.default_role,
        oidcIssuer: row.oidc_issuer ?? null,
        oidcClientId: row.oidc_client_id ?? null,
        oidcClientSecretHint: row.oidc_client_secret
            ? await redactForDisplay(row.oidc_client_secret as string)
            : null,
        oidcDiscoveryUrl: row.oidc_discovery_url ?? null,
        oidcScopes: row.oidc_scopes ?? null,
        samlEntityId: row.saml_entity_id ?? null,
        samlSsoUrl: row.saml_sso_url ?? null,
        samlCertificate: row.saml_certificate ?? null,
        samlSloUrl: row.saml_slo_url ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** Insert a new identity_provider row. Returns the generated id. */
export async function createIdp(
    db: D1Database,
    env: IdpVaultEnv,
    input: CreateIdpInput,
): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const encryptedSecret =
        input.type === 'oidc' && input.oidcClientSecret
            ? await encryptSecret(input.oidcClientSecret, env)
            : null;

    await db.prepare(`
        INSERT INTO identity_providers (
            id, org_id, type, name, enabled, email_domain, jit_enabled, default_role,
            oidc_issuer, oidc_client_id, oidc_client_secret, oidc_discovery_url, oidc_scopes,
            saml_entity_id, saml_sso_url, saml_certificate, saml_slo_url,
            created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
        id, input.orgId, input.type, input.name,
        input.enabled ? 1 : 0,
        input.emailDomain ?? null,
        input.jitEnabled ? 1 : 0,
        input.defaultRole,
        input.type === 'oidc' ? input.oidcIssuer : null,
        input.type === 'oidc' ? input.oidcClientId : null,
        encryptedSecret,
        input.type === 'oidc' ? input.oidcDiscoveryUrl : null,
        input.type === 'oidc' ? (input.oidcScopes ?? 'openid email profile') : null,
        input.type === 'saml' ? input.samlEntityId : null,
        input.type === 'saml' ? input.samlSsoUrl : null,
        input.type === 'saml' ? input.samlCertificate : null,
        input.type === 'saml' ? (input.samlSloUrl ?? null) : null,
        now, now,
    ).run();

    return id;
}

export interface PatchResult {
    sets: string[];
    vals: unknown[];
    diffFields: string[];
}

/** Build SQL SET clauses + values for a partial UpdateIdpInput. */
export async function buildPatchClauses(
    env: IdpVaultEnv,
    input: UpdateIdpInput,
): Promise<PatchResult> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const diffFields: string[] = [];

    if (input.name !== undefined) { sets.push('name = ?'); vals.push(input.name); diffFields.push('name'); }
    if (input.enabled !== undefined) { sets.push('enabled = ?'); vals.push(input.enabled ? 1 : 0); diffFields.push('enabled'); }
    if (input.emailDomain !== undefined) { sets.push('email_domain = ?'); vals.push(input.emailDomain); diffFields.push('emailDomain'); }
    if (input.jitEnabled !== undefined) { sets.push('jit_enabled = ?'); vals.push(input.jitEnabled ? 1 : 0); diffFields.push('jitEnabled'); }
    if (input.defaultRole !== undefined) { sets.push('default_role = ?'); vals.push(input.defaultRole); diffFields.push('defaultRole'); }

    const provider = input.provider;
    if (provider) {
        if (provider.type === 'oidc') {
            if (provider.oidcIssuer) { sets.push('oidc_issuer = ?'); vals.push(provider.oidcIssuer); diffFields.push('oidcIssuer'); }
            if (provider.oidcClientId) { sets.push('oidc_client_id = ?'); vals.push(provider.oidcClientId); diffFields.push('oidcClientId'); }
            if (provider.oidcClientSecret) {
                const enc = await encryptSecret(provider.oidcClientSecret, env);
                sets.push('oidc_client_secret = ?'); vals.push(enc);
                diffFields.push('oidcClientSecret');
            }
            if (provider.oidcDiscoveryUrl) { sets.push('oidc_discovery_url = ?'); vals.push(provider.oidcDiscoveryUrl); diffFields.push('oidcDiscoveryUrl'); }
            if (provider.oidcScopes) { sets.push('oidc_scopes = ?'); vals.push(provider.oidcScopes); diffFields.push('oidcScopes'); }
        } else if (provider.type === 'saml') {
            if (provider.samlEntityId) { sets.push('saml_entity_id = ?'); vals.push(provider.samlEntityId); diffFields.push('samlEntityId'); }
            if (provider.samlSsoUrl) { sets.push('saml_sso_url = ?'); vals.push(provider.samlSsoUrl); diffFields.push('samlSsoUrl'); }
            if (provider.samlCertificate) { sets.push('saml_certificate = ?'); vals.push(provider.samlCertificate); diffFields.push('samlCertificate'); }
            if (provider.samlSloUrl) { sets.push('saml_slo_url = ?'); vals.push(provider.samlSloUrl); diffFields.push('samlSloUrl'); }
        }
    }

    return { sets, vals, diffFields };
}
