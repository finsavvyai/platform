/**
 * Enterprise per-org OIDC SSO routes — separate from social OAuth in
 * src/routes/oauth.ts (those are user-level Google/GitHub/etc).
 *
 * Mount: app.route('/v1/sso/oidc', oidcRouter)
 *   POST /v1/sso/oidc/initiate   → { redirectUrl }
 *   GET  /v1/sso/oidc/callback   → 302 to allow-listed returnPath
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { IdentityProvider } from '../../types/sso';
import { OidcProvider, verifyState, type Env } from '../../services/oidc-provider';
import { provisionUser } from '../../services/jit-provisioner';
import { logAuditEvent, getClientInfo } from '../../services/audit-logger';
import { validateJson } from '../../middleware/validation';
import { ipRateLimit } from '../../middleware/ip-rate-limiter';
import { mapInternalToPublic } from './error-mapping';

export const oidcRouter = new Hono<{ Bindings: Env }>();

const COOKIE_NAME = 'sso_session';
const COOKIE_TTL_SECONDS = 8 * 3600;
const DEFAULT_RETURN_PATH = '/dashboard';

const initiateSchema = z.object({
    idpId: z.string().min(1).max(64),
    returnPath: z.string().optional(),
});

function corr(): string { return crypto.randomUUID(); }

function err(c: any, code: number, error: string, correlationId: string, extra?: Record<string, unknown>) {
    return c.json({ error, correlationId, ...(extra ?? {}) }, code);
}

/** allow-list: must start with '/', not '//', not contain '://'. */
function safeReturnPath(p: string | undefined): string {
    if (!p) return DEFAULT_RETURN_PATH;
    if (!p.startsWith('/')) return DEFAULT_RETURN_PATH;
    if (p.startsWith('//')) return DEFAULT_RETURN_PATH;
    if (p.includes('://')) return DEFAULT_RETURN_PATH;
    return p;
}

async function loadIdp(env: Env, idpId: string): Promise<IdentityProvider | null> {
    const row = await env.DB.prepare(
        `SELECT id, org_id as orgId, type, name, enabled, email_domain as emailDomain,
                jit_enabled as jitEnabled, default_role as defaultRole,
                oidc_issuer as oidcIssuer, oidc_client_id as oidcClientId,
                oidc_client_secret as oidcClientSecret,
                oidc_discovery_url as oidcDiscoveryUrl, oidc_scopes as oidcScopes,
                saml_entity_id as samlEntityId, saml_sso_url as samlSsoUrl,
                saml_certificate as samlCertificate, saml_slo_url as samlSloUrl,
                created_at as createdAt, updated_at as updatedAt
         FROM identity_providers WHERE id = ? LIMIT 1`,
    ).bind(idpId).first<any>();
    if (!row) return null;
    return {
        ...row,
        enabled: row.enabled === 1 || row.enabled === true,
        jitEnabled: row.jitEnabled === 1 || row.jitEnabled === true,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    } as IdentityProvider;
}

// ─── HMAC cookie signing (Web Crypto) ───────────────────────────────────────
const enc = new TextEncoder();
function toBuf(u: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(u.byteLength);
    new Uint8Array(out).set(u);
    return out;
}
async function signCookie(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', toBuf(enc.encode(secret)),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, toBuf(enc.encode(value))));
    let bin = ''; for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
    const sigB64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    return `${value}.${sigB64}`;
}

function setSsoCookie(c: any, signed: string) {
    const attrs = [
        `${COOKIE_NAME}=${signed}`,
        'HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/',
        `Max-Age=${COOKIE_TTL_SECONDS}`,
    ];
    c.header('Set-Cookie', attrs.join('; '));
}

// ─── POST /initiate ──────────────────────────────────────────────────────────

oidcRouter.post('/initiate', ipRateLimit, validateJson(initiateSchema), async (c) => {
    const correlationId = corr();
    const { idpId, returnPath } = c.req.valid('json');
    const idp = await loadIdp(c.env, idpId);
    if (!idp || idp.type !== 'oidc' || !idp.enabled) {
        return err(c, 404, 'idp_not_found_or_disabled', correlationId);
    }
    try {
        const provider = new OidcProvider(c.env);
        const safe = safeReturnPath(returnPath);
        const { url } = await provider.buildAuthorizationUrl(idp, safe);
        return c.json({ redirectUrl: url, correlationId });
    } catch (e) {
        console.error(`[oidc.initiate] ${correlationId}:`, (e as Error).message);
        return err(c, 502, 'sso_initiate_failed', correlationId);
    }
});

// ─── GET /callback ───────────────────────────────────────────────────────────

oidcRouter.get('/callback', async (c) => {
    const correlationId = corr();
    const error = c.req.query('error');
    const code = c.req.query('code');
    const stateToken = c.req.query('state');
    if (error) return err(c, 400, 'idp_error', correlationId, { reason: 'idp_returned_error' });
    if (!code || !stateToken) return err(c, 400, 'missing_params', correlationId);

    try {
        const state = await verifyState(stateToken, c.env.SESSION_SECRET);
        const idp = await loadIdp(c.env, state.idpId);
        if (!idp || idp.type !== 'oidc' || !idp.enabled) {
            return err(c, 404, 'idp_not_found_or_disabled', correlationId);
        }
        const provider = new OidcProvider(c.env);
        const tokens = await provider.exchangeCode(idp, code, state.codeVerifier);
        const claims = await provider.verifyIdToken(idp, tokens.id_token, state.nonce);

        const email = String(claims.email ?? '').toLowerCase();
        const name = String(claims.name ?? claims.preferred_username ?? '');
        // FIND-009: do not echo internal claim-detail codes.
        if (!email) return err(c, 400, mapInternalToPublic('sso_callback_failed'), correlationId);

        const user = await provisionUser(c.env, {
            email, name, orgId: idp.orgId, defaultRole: idp.defaultRole,
            emailDomain: idp.emailDomain ?? undefined,
            // FIND-002 alignment: pass per-IdP gating fields explicitly.
            jitEnabled: idp.jitEnabled, idpId: idp.id,
        });

        // Create SsoSession row
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const exp = new Date(now.getTime() + COOKIE_TTL_SECONDS * 1000);
        const nameId = String(claims.sub ?? email);
        await c.env.DB.prepare(
            `INSERT INTO sso_sessions (id, user_id, org_id, idp_id, name_id, session_index, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
        ).bind(sessionId, user.id, idp.orgId, idp.id, nameId, exp.toISOString(), now.toISOString()).run();

        const signed = await signCookie(sessionId, c.env.SESSION_SECRET);
        setSsoCookie(c, signed);

        const info = getClientInfo(c);
        await logAuditEvent(c.env.DB, {
            action: 'auth.login',
            userId: user.id,
            resourceType: 'sso_session',
            resourceId: sessionId,
            metadata: { idpId: idp.id, orgId: idp.orgId, jit: user.created, correlationId },
            ipAddress: info.ipAddress,
            userAgent: info.userAgent,
        }).catch(() => { });

        return c.redirect(safeReturnPath(state.returnPath), 302);
    } catch (e) {
        // FIND-009 fix: never echo the internal code to the client. Log it for
        // operator triage; respond with the generic public code only.
        const internal = (e as Error).message || 'sso_callback_failed';
        console.error(`[oidc.callback] ${correlationId}: ${internal}`);
        return err(c, 400, mapInternalToPublic('sso_callback_failed'), correlationId);
    }
});
